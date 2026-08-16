/**
 * ============================================================
 * SERVIÇO SEFAZ — TRANSMISSÃO REAL DE EVENTOS
 * ============================================================
 * Comunicação SOAP com os WebServices da SEFAZ para:
 * - Recepção de Eventos (NFeRecepcaoEvento4)
 * - Consulta de Protocolo (NFeConsulta4)
 * - Distribuição de DF-e (NFeDistribuicaoDFe)
 * 
 * Suporte a ambientes de Homologação (tpAmb=2) e Produção (tpAmb=1).
 * O certificado A1 é lido do cofre seguro e usado em memória.
 * ============================================================
 */

import https from 'https';
import fs from 'fs';
import crypto from 'crypto';
import zlib from 'zlib';
import { SEFAZ, CERTIFICADO } from '../config';
import { getDatabase } from '../db/database';

// =========================================================
// TABELA IBGE UF -> cUF
// =========================================================
export const UF_TO_CUF: Record<string, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27',
  SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41',
  SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53',
};

// =========================================================
// TIPOS
// =========================================================
export interface EventoSefazRequest {
  chaveAcesso: string;
  codigoEvento: string;
  nomeEvento: string;
  nSeqEvento?: number;
  justificativa?: string;
  tpAmb: '1' | '2';
  cnpjAutor: string;
  empresaId: string;
}

export interface EventoSefazResponse {
  success: boolean;
  cStat: string;
  xMotivo: string;
  nProt?: string;
  dhRegEvento?: string;
  xmlEnvio: string;
  xmlRetorno: string;
  tpAmb: string;
}

export interface DistribucaoDfeRequest {
  cnpj: string;
  ultNSU?: string;
  chNFe?: string;
  nsuEspecifico?: string;
  tpAmb: '1' | '2';
  empresaId: string;
  ufAutor?: string;
  fluxo?: 'entrada' | 'saida';
  manifestarCienciaAutomatica?: boolean;
}

export interface DocumentoDfeExtraido {
  id: string;
  schema: string;
  nsu: string;
  tipo: 'NFe' | 'CTe' | 'MDFe' | 'NFSe' | 'NFCe';
  numero: string;
  serie: string;
  chaveAcesso: string;
  dataEmissao: string;
  emitenteCnpj: string;
  emitenteNome: string;
  emitenteUf: string;
  destinatarioCnpj: string;
  destinatarioNome: string;
  destinatarioUf: string;
  valorTotal: number;
  valorIcms: number;
  valorIpi: number;
  valorPis: number;
  valorCofins: number;
  aliquotaCbs: number;
  valorCbs: number;
  aliquotaIbs: number;
  valorIbs: number;
  valorImpostoSeletivo: number;
  statusAuditoria: 'conforme' | 'inconsistente' | 'pendente_ccc';
  alertasAuditoria: string[];
  eventoUltimo: string;
  statusSincronizacaoErp: 'pendente' | 'sincronizado';
  xmlRaw: string;
  isResumoApenas?: boolean;
}

export interface DistribucaoDfeResponse {
  success: boolean;
  cStat: string;
  xMotivo: string;
  ultNSU: string;
  maxNSU: string;
  tpAmb: string;
  docs: DocumentoDfeExtraido[];
  xmlEnvio: string;
  xmlRetorno: string;
}

// =========================================================
// CONSTRUÇÃO DO ENVELOPE XML SOAP
// =========================================================

/**
 * Monta o XML do lote de evento conforme layout 1.00 do WebService
 * NFeRecepcaoEvento4 (NT 2025.002-RTC compatível).
 */
function buildEventoXml(params: EventoSefazRequest, nSeq: number): string {
  const {
    chaveAcesso,
    codigoEvento,
    justificativa,
    tpAmb,
    cnpjAutor,
  } = params;

  const orgaoUf = chaveAcesso.substring(0, 2); // cUF da chave de acesso
  const dhEvento = new Date().toISOString().replace(/\.\d{3}Z$/, '-03:00');
  const idEvento = `ID${codigoEvento}${chaveAcesso}${String(nSeq).padStart(2, '0')}`;

  // Bloco de detalhes do evento (varia conforme tipo)
  let detEvento = '';
  if (justificativa) {
    detEvento = `<xJust>${justificativa}</xJust>`;
  }

  // Modelo de XML conforme Manual de Orientação do Contribuinte v7.0
  const xmlEvento = `<?xml version="1.0" encoding="UTF-8"?>
<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
  <idLote>${Date.now()}</idLote>
  <evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
    <infEvento Id="${idEvento}">
      <cOrgao>${orgaoUf}</cOrgao>
      <tpAmb>${tpAmb}</tpAmb>
      <CNPJ>${cnpjAutor.replace(/\D/g, '')}</CNPJ>
      <chNFe>${chaveAcesso}</chNFe>
      <dhEvento>${dhEvento}</dhEvento>
      <tpEvento>${codigoEvento}</tpEvento>
      <nSeqEvento>${nSeq}</nSeqEvento>
      <verEvento>1.00</verEvento>
      <detEvento versao="1.00">
        <descEvento>${params.nomeEvento}</descEvento>
        ${detEvento}
      </detEvento>
    </infEvento>
  </evento>
</envEvento>`;

  return xmlEvento;
}

/**
 * Envelopa o XML do evento em um SOAP Envelope para o WebService
 */
function buildSoapEnvelope(xmlEvento: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">
      ${xmlEvento}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

// =========================================================
// DESCRIPTOGRAFIA DO CERTIFICADO A1
// =========================================================

interface CertificadoDescriptografado {
  pfxBuffer: Buffer;
  senha: string;
}

/**
 * Descriptografa o certificado A1 do cofre seguro em MEMÓRIA.
 * O arquivo PFX descriptografado NUNCA é gravado em disco.
 */
function descriptografarCertificado(empresaId: string): CertificadoDescriptografado | null {
  const db = getDatabase();

  const cert = db.prepare(`
    SELECT arquivo_path_enc, senha_enc, iv, auth_tag
    FROM certificados
    WHERE empresa_id = ? AND status_alerta != 'expirado'
    ORDER BY validade DESC LIMIT 1
  `).get(empresaId) as any;

  if (!cert) {
    return null;
  }

  const encryptionKey = CERTIFICADO.ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error('❌ CERT_ENCRYPTION_KEY não definida. Impossível descriptografar certificado.');
    return null;
  }

  try {
    // Descriptografar senha do PFX (AES-256-GCM)
    const keyBuffer = Buffer.from(encryptionKey, 'hex');
    const ivBuffer = Buffer.from(cert.iv, 'hex');
    const authTag = Buffer.from(cert.auth_tag, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
    decipher.setAuthTag(authTag);

    let senhaPfx = decipher.update(cert.senha_enc, 'hex', 'utf8');
    senhaPfx += decipher.final('utf8');

    // Ler o arquivo PFX criptografado
    if (!fs.existsSync(cert.arquivo_path_enc)) {
      console.error(`❌ Arquivo PFX não encontrado: ${cert.arquivo_path_enc}`);
      return null;
    }

    const pfxBuffer = fs.readFileSync(cert.arquivo_path_enc);

    return { pfxBuffer, senha: senhaPfx };
  } catch (err: any) {
    console.error('❌ Falha ao descriptografar certificado:', err.message);
    return null;
  }
}

// =========================================================
// TRANSMISSÃO HTTPS COM CERTIFICADO A1
// =========================================================

/**
 * Envia o SOAP Envelope ao WebService da SEFAZ usando mTLS (certificado A1).
 */
async function enviarParaSefaz(
  url: string,
  soapEnvelope: string,
  pfxBuffer: Buffer,
  senhaPfx: string
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);

    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(soapEnvelope, 'utf8'),
      },
      pfx: pfxBuffer,
      passphrase: senhaPfx,
      rejectUnauthorized: true,
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode || 0, body });
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Falha na comunicação com SEFAZ: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout na comunicação com a SEFAZ (30s)'));
    });

    req.write(soapEnvelope);
    req.end();
  });
}

// =========================================================
// PARSER SIMPLES DO RETORNO XML DA SEFAZ
// =========================================================

function extrairTagXml(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

function extrairSubTagXml(xml: string, parentTag: string, childTag: string): string {
  const parentRegex = new RegExp(`<${parentTag}[^>]*>([\\s\\S]*?)</${parentTag}>`, 'i');
  const parentMatch = xml.match(parentRegex);
  if (!parentMatch) return '';
  return extrairTagXml(parentMatch[1], childTag);
}

function descompactarDocZip(base64Content: string): string {
  try {
    const buffer = Buffer.from(base64Content, 'base64');
    const decompressed = zlib.gunzipSync(buffer);
    return decompressed.toString('utf8');
  } catch (err: any) {
    console.error('❌ Erro ao descompactar docZip:', err.message);
    return '';
  }
}

function extrairDocZips(xmlRetorno: string): Array<{ schema: string; nsu: string; xmlContent: string }> {
  const docs: Array<{ schema: string; nsu: string; xmlContent: string }> = [];
  const regex = /<docZip\s+([^>]*)>([^<]+)<\/docZip>/gi;
  let match;
  while ((match = regex.exec(xmlRetorno)) !== null) {
    const attrs = match[1];
    const base64 = match[2].trim();
    const schemaMatch = attrs.match(/schema="([^"]*)"/i);
    const nsuMatch = attrs.match(/NSU="([^"]*)"/i);
    const schema = schemaMatch ? schemaMatch[1] : '';
    const nsu = nsuMatch ? nsuMatch[1] : '';
    const xmlContent = descompactarDocZip(base64);
    if (xmlContent) {
      docs.push({ schema, nsu, xmlContent });
    }
  }
  return docs;
}

function buildDistDFeSoapEnvelope(params: DistribucaoDfeRequest): string {
  const { cnpj, ultNSU, chNFe, nsuEspecifico, tpAmb, ufAutor } = params;
  const cleanCnpj = cnpj.replace(/\D/g, '');
  const cUF = (ufAutor && UF_TO_CUF[ufAutor.toUpperCase()]) || '35'; // Default SP (35) or Ambiente Nacional (91)

  let distBody = '';
  if (chNFe && chNFe.replace(/\D/g, '').length === 44) {
    distBody = `<consChNFe><chNFe>${chNFe.replace(/\D/g, '')}</chNFe></consChNFe>`;
  } else if (nsuEspecifico && nsuEspecifico.trim() !== '') {
    distBody = `<consNSU><NSU>${nsuEspecifico.replace(/\D/g, '').padStart(15, '0')}</NSU></consNSU>`;
  } else {
    const nsuFormatted = String(ultNSU || '0').replace(/\D/g, '').padStart(15, '0');
    distBody = `<distNSU><ultNSU>${nsuFormatted}</ultNSU></distNSU>`;
  }

  const xmlDist = `<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>${tpAmb}</tpAmb><cUFAutor>${cUF}</cUFAutor><CNPJ>${cleanCnpj}</CNPJ>${distBody}</distDFeInt>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        ${xmlDist}
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;
}

// =========================================================
// FUNÇÃO PRINCIPAL — TRANSMITIR EVENTO FISCAL
// =========================================================

export async function transmitirEventoSefaz(params: EventoSefazRequest): Promise<EventoSefazResponse> {
  const { tpAmb, empresaId } = params;

  // 1. Determinar endpoint
  const endpoints = tpAmb === '1' ? SEFAZ.SVRS_PRODUCAO : SEFAZ.SVRS_HOMOLOGACAO;
  const url = endpoints.RECEPCAO_EVENTO;

  // 2. Construir XML do evento
  const nSeq = params.nSeqEvento || 1;
  const xmlEvento = buildEventoXml(params, nSeq);

  // 3. Envelopar em SOAP
  const soapEnvelope = buildSoapEnvelope(xmlEvento);

  // 4. Buscar e descriptografar certificado A1
  const certificado = descriptografarCertificado(empresaId);

  if (!certificado) {
    console.warn(`⚠️  Certificado A1 não disponível para empresa ${empresaId}.`);
    return {
      success: false,
      cStat: '999',
      xMotivo: 'Certificado Digital A1 não configurado para esta empresa no cofre seguro.',
      xmlEnvio: xmlEvento,
      xmlRetorno: '',
      tpAmb,
    };
  }

  try {
    // 5. Transmitir via HTTPS com mTLS
    console.log(`📡 Transmitindo evento ${params.codigoEvento} para ${url} (tpAmb=${tpAmb})...`);
    const response = await enviarParaSefaz(url, soapEnvelope, certificado.pfxBuffer, certificado.senha);

    // 6. Parsear resposta da SEFAZ
    const cStat = extrairTagXml(response.body, 'cStat');
    const xMotivo = extrairTagXml(response.body, 'xMotivo');
    const nProt = extrairTagXml(response.body, 'nProt');
    const dhRegEvento = extrairTagXml(response.body, 'dhRegEvento');

    const success = ['128', '135', '136'].includes(cStat);

    console.log(`${success ? '✅' : '❌'} SEFAZ cStat=${cStat}: ${xMotivo}`);

    return {
      success,
      cStat,
      xMotivo,
      nProt: nProt || undefined,
      dhRegEvento: dhRegEvento || undefined,
      xmlEnvio: xmlEvento,
      xmlRetorno: response.body,
      tpAmb,
    };
  } catch (err: any) {
    console.error('❌ Erro na transmissão para SEFAZ:', err.message);

    return {
      success: false,
      cStat: '999',
      xMotivo: `Erro de comunicação: ${err.message}`,
      xmlEnvio: xmlEvento,
      xmlRetorno: '',
      tpAmb,
    };
  }
}

// =========================================================
// FUNÇÃO PRINCIPAL — CONSULTA WEBSERVICE NFeDistribuicaoDFe
// =========================================================

export async function consultarDistribuicaoDFe(params: DistribucaoDfeRequest): Promise<DistribucaoDfeResponse> {
  const { tpAmb, empresaId, cnpj, manifestarCienciaAutomatica } = params;

  // 1. Determinar endpoint oficial do WebService NFeDistribuicaoDFe (Ambiente Nacional AN)
  const url = tpAmb === '1'
    ? (SEFAZ.SVRS_PRODUCAO.DISTRIBUICAO_DFE || 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx')
    : (SEFAZ.SVRS_HOMOLOGACAO.DISTRIBUICAO_DFE || 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx');

  // 2. Construir envelope SOAP
  const soapEnvelope = buildDistDFeSoapEnvelope(params);

  // 3. Buscar e descriptografar certificado A1 do cofre seguro
  const certificado = descriptografarCertificado(empresaId);

  if (!certificado) {
    console.warn(`⚠️  Certificado A1 não disponível para a empresa ${empresaId} (${cnpj}).`);
    return {
      success: false,
      cStat: '999',
      xMotivo: 'Certificado Digital A1 não configurado ou senha incorreta no cofre seguro. Vincule um .PFX válido na Carteira de CNPJs.',
      ultNSU: params.ultNSU || '000000000000000',
      maxNSU: '000000000000000',
      tpAmb,
      docs: [],
      xmlEnvio: soapEnvelope,
      xmlRetorno: '',
    };
  }

  try {
    console.log(`📡 Consultando NFeDistribuicaoDFe para CNPJ ${cnpj} em ${url} (tpAmb=${tpAmb})...`);
    const response = await enviarParaSefaz(url, soapEnvelope, certificado.pfxBuffer, certificado.senha);

    const cStat = extrairTagXml(response.body, 'cStat') || '999';
    const xMotivo = extrairTagXml(response.body, 'xMotivo') || 'Sem resposta';
    const ultNSURetorno = extrairTagXml(response.body, 'ultNSU') || params.ultNSU || '000000000000000';
    const maxNSURetorno = extrairTagXml(response.body, 'maxNSU') || '000000000000000';

    console.log(`📡 Resposta NFeDistribuicaoDFe cStat=${cStat} - ${xMotivo} (ultNSU=${ultNSURetorno}, maxNSU=${maxNSURetorno})`);

    // 4. Extrair e descompactar todos os docZips (GZip Base64 -> XML)
    const rawDocs = extrairDocZips(response.body);
    const docsProcessados: DocumentoDfeExtraido[] = [];

    for (const raw of rawDocs) {
      const xml = raw.xmlContent;
      let tipoDoc: 'NFe' | 'CTe' | 'MDFe' | 'NFSe' | 'NFCe' = 'NFe';

      if (raw.schema.includes('CTe') || xml.includes('<CTe') || xml.includes('<infCte')) tipoDoc = 'CTe';
      else if (raw.schema.includes('MDFe') || xml.includes('<MDFe')) tipoDoc = 'MDFe';
      else if (raw.schema.includes('NFSe') || xml.includes('<NFSe')) tipoDoc = 'NFSe';
      else if (raw.schema.includes('NFCe') || xml.includes('<NFCe')) tipoDoc = 'NFCe';

      // Verificar se é resumo (<resNFe>) ou proc completo (<nfeProc> / <procNFe>)
      if (xml.includes('<resNFe') || raw.schema.includes('resNFe')) {
        const chNFe = extrairTagXml(xml, 'chNFe');
        const emitCnpj = extrairTagXml(xml, 'CNPJ') || extrairTagXml(xml, 'CPF');
        const emitNome = extrairTagXml(xml, 'xNome');
        const vNF = parseFloat(extrairTagXml(xml, 'vNF') || '0');
        const dhEmi = extrairTagXml(xml, 'dhEmi') || new Date().toISOString();

        // Se configurado para manifestar ciência automática e é um resumo não manifestado
        let manifestado = false;
        if (manifestarCienciaAutomatica && chNFe) {
          try {
            console.log(`⚡ Disparando Ciência da Operação automática para chave ${chNFe}...`);
            await transmitirEventoSefaz({
              chaveAcesso: chNFe,
              codigoEvento: '210210',
              nomeEvento: 'Ciencia da Operacao',
              tpAmb,
              cnpjAutor: cnpj,
              empresaId,
            });
            manifestado = true;
          } catch (e: any) {
            console.warn(`Aviso: falha ao enviar ciência automática para ${chNFe}:`, e.message);
          }
        }

        docsProcessados.push({
          id: `res-${raw.nsu}-${Date.now()}`,
          schema: raw.schema,
          nsu: raw.nsu,
          tipo: tipoDoc,
          numero: extrairTagXml(xml, 'nNF') || (chNFe.length >= 34 ? chNFe.substring(25, 34) : ''),
          serie: extrairTagXml(xml, 'serie') || (chNFe.length >= 25 ? chNFe.substring(22, 25) : '1'),
          chaveAcesso: chNFe,
          dataEmissao: dhEmi.split('T')[0],
          emitenteCnpj: emitCnpj,
          emitenteNome: emitNome || 'Emitente Localizado (Resumo SEFAZ)',
          emitenteUf: chNFe.substring(0, 2) ? (Object.entries(UF_TO_CUF).find(([_, c]) => c === chNFe.substring(0, 2))?.[0] || 'SP') : 'SP',
          destinatarioCnpj: cnpj,
          destinatarioNome: 'MINHA EMPRESA',
          destinatarioUf: 'SP',
          valorTotal: vNF,
          valorIcms: Number((vNF * 0.18).toFixed(2)),
          valorIpi: 0,
          valorPis: Number((vNF * 0.0165).toFixed(2)),
          valorCofins: Number((vNF * 0.076).toFixed(2)),
          aliquotaCbs: 8.8,
          valorCbs: Number((vNF * 0.088).toFixed(2)),
          aliquotaIbs: 17.7,
          valorIbs: Number((vNF * 0.177).toFixed(2)),
          valorImpostoSeletivo: 0,
          statusAuditoria: 'conforme',
          alertasAuditoria: manifestado ? ['Ciência da Operação transmitida automaticamente'] : ['Resumo SEFAZ - Manifestação pendente para XML completo'],
          eventoUltimo: manifestado ? 'Ciência da Emissão' : 'Resumo Capturado',
          statusSincronizacaoErp: 'pendente',
          xmlRaw: xml,
          isResumoApenas: true,
        });

      } else {
        // XML Completo (<nfeProc>, <procNFe>, <NFe>, etc.)
        const chaveAcesso = extrairTagXml(xml, 'chNFe') || extrairTagXml(xml, 'chCTe') || (xml.match(/Id="NFe([0-9]{44})"/i)?.[1]) || '';
        const emitCnpj = extrairSubTagXml(xml, 'emit', 'CNPJ') || extrairSubTagXml(xml, 'emit', 'CPF');
        const emitNome = extrairSubTagXml(xml, 'emit', 'xNome');
        const emitUf = extrairSubTagXml(xml, 'enderEmit', 'UF') || 'SP';
        const destCnpj = extrairSubTagXml(xml, 'dest', 'CNPJ') || extrairSubTagXml(xml, 'dest', 'CPF');
        const destNome = extrairSubTagXml(xml, 'dest', 'xNome');
        const destUf = extrairSubTagXml(xml, 'enderDest', 'UF') || 'SP';
        const vNF = parseFloat(extrairSubTagXml(xml, 'ICMSTot', 'vNF') || extrairTagXml(xml, 'vNF') || '0');
        const vICMS = parseFloat(extrairSubTagXml(xml, 'ICMSTot', 'vICMS') || '0');
        const vIPI = parseFloat(extrairSubTagXml(xml, 'ICMSTot', 'vIPI') || '0');
        const vPIS = parseFloat(extrairSubTagXml(xml, 'ICMSTot', 'vPIS') || '0');
        const vCOFINS = parseFloat(extrairSubTagXml(xml, 'ICMSTot', 'vCOFINS') || '0');
        const nNF = extrairTagXml(xml, 'nNF') || extrairTagXml(xml, 'nCT') || '';
        const serie = extrairTagXml(xml, 'serie') || '1';
        const dhEmi = extrairTagXml(xml, 'dhEmi') || extrairTagXml(xml, 'dEmi') || new Date().toISOString();

        docsProcessados.push({
          id: `proc-${raw.nsu || Date.now()}-${Math.floor(Math.random() * 1000)}`,
          schema: raw.schema,
          nsu: raw.nsu,
          tipo: tipoDoc,
          numero: nNF,
          serie,
          chaveAcesso,
          dataEmissao: dhEmi.split('T')[0],
          emitenteCnpj: emitCnpj,
          emitenteNome: emitNome,
          emitenteUf: emitUf,
          destinatarioCnpj: destCnpj,
          destinatarioNome: destNome,
          destinatarioUf: destUf,
          valorTotal: vNF,
          valorIcms: vICMS,
          valorIpi: vIPI,
          valorPis: vPIS,
          valorCofins: vCOFINS,
          aliquotaCbs: 8.8,
          valorCbs: Number((vNF * 0.088).toFixed(2)),
          aliquotaIbs: 17.7,
          valorIbs: Number((vNF * 0.177).toFixed(2)),
          valorImpostoSeletivo: 0,
          statusAuditoria: 'conforme',
          alertasAuditoria: [],
          eventoUltimo: 'Autorizado o uso da NF-e',
          statusSincronizacaoErp: 'pendente',
          xmlRaw: xml,
          isResumoApenas: false,
        });
      }
    }

    // 5. Atualizar ultimo_nsu e max_nsu da empresa no banco de dados
    try {
      const db = getDatabase();
      db.prepare(`
        UPDATE empresas
        SET ultimo_nsu = ?, max_nsu = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(ultNSURetorno, maxNSURetorno, empresaId);
    } catch {}

    const success = ['137', '138'].includes(cStat);

    return {
      success,
      cStat,
      xMotivo,
      ultNSU: ultNSURetorno,
      maxNSU: maxNSURetorno,
      tpAmb,
      docs: docsProcessados,
      xmlEnvio: soapEnvelope,
      xmlRetorno: response.body,
    };
  } catch (err: any) {
    console.error('❌ Erro na consulta NFeDistribuicaoDFe:', err.message);
    return {
      success: false,
      cStat: '999',
      xMotivo: `Erro de comunicação com a SEFAZ: ${err.message}`,
      ultNSU: params.ultNSU || '000000000000000',
      maxNSU: '000000000000000',
      tpAmb,
      docs: [],
      xmlEnvio: soapEnvelope,
      xmlRetorno: '',
    };
  }
}

/**
 * Verifica conectividade com o WebService da SEFAZ (ping)
 */
export async function testarConexaoSefaz(tpAmb: '1' | '2'): Promise<{ online: boolean; latencyMs: number; endpoint: string; error?: string }> {
  const endpoints = tpAmb === '1' ? SEFAZ.SVRS_PRODUCAO : SEFAZ.SVRS_HOMOLOGACAO;
  const url = endpoints.CONSULTA_PROTOCOLO;

  const start = Date.now();

  return new Promise((resolve) => {
    const parsedUrl = new URL(url);

    const req = https.request({
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname,
      method: 'GET',
      timeout: 10000,
      rejectUnauthorized: true,
    }, (res) => {
      const latencyMs = Date.now() - start;
      resolve({
        online: res.statusCode !== undefined && res.statusCode < 500,
        latencyMs,
        endpoint: url,
      });
      res.resume(); // consume response
    });

    req.on('error', (err) => {
      resolve({
        online: false,
        latencyMs: Date.now() - start,
        endpoint: url,
        error: err.message,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        online: false,
        latencyMs: Date.now() - start,
        endpoint: url,
        error: 'Timeout (10s)',
      });
    });

    req.end();
  });
}
