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
import forge from 'node-forge';
import { SEFAZ, CERTIFICADO } from '../config';
import { getDatabase } from '../db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';
import { salvarXmlLocalmente } from '../utils/fileStorage';

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
 * O arquivo PFX descriptografado NUNCA é gravado em disco desprotegido.
 */
async function descriptografarCertificado(empresaId: string, cnpj?: string): Promise<CertificadoDescriptografado | null> {
  let cert: any = null;

  // 1. Tentar buscar no Supabase
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      if (empresaId) {
        const { data: supaCert } = await supabase
          .from('certificados')
          .select('*')
          .eq('empresa_id', empresaId)
          .neq('status_alerta', 'expirado')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (supaCert) {
          cert = supaCert;
        }
      }

      // Se não achou por empresa_id e temos o CNPJ, busca pelas empresas vinculadas
      if (!cert && cnpj) {
        const clean = cnpj.replace(/\D/g, '');
        const { data: empByCnpj } = await supabase
          .from('empresas')
          .select('id')
          .eq('cnpj_raiz', clean.substring(0, 8))
          .limit(5);

        if (empByCnpj && empByCnpj.length > 0) {
          const empIds = empByCnpj.map(e => e.id);
          const { data: certByEmp } = await supabase
            .from('certificados')
            .select('*')
            .in('empresa_id', empIds)
            .neq('status_alerta', 'expirado')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (certByEmp) {
            cert = certByEmp;
          }
        }
      }
    }
  }

  // 2. Fallback SQLite local
  if (!cert) {
    const db = getDatabase();
    if (empresaId) {
      cert = db.prepare(`
        SELECT arquivo_path_enc, senha_enc, iv, auth_tag
        FROM certificados
        WHERE empresa_id = ? AND status_alerta != 'expirado'
        ORDER BY validade DESC LIMIT 1
      `).get(empresaId) as any;
    }

    if (!cert && cnpj) {
      const clean = cnpj.replace(/\D/g, '');
      cert = db.prepare(`
        SELECT c.arquivo_path_enc, c.senha_enc, c.iv, c.auth_tag
        FROM certificados c
        JOIN empresas e ON e.id = c.empresa_id
        WHERE (e.cnpj_raiz = ? OR REPLACE(REPLACE(REPLACE(e.cnpj_completo, '.', ''), '/', ''), '-', '') = ?)
          AND c.status_alerta != 'expirado'
        ORDER BY c.validade DESC LIMIT 1
      `).get(clean.substring(0, 8), clean) as any;
    }
  }

  if (!cert) {
    return null;
  }

  let encryptionKey = CERTIFICADO.ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.length !== 64) {
    encryptionKey = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'radar_fiscal_default_secure_key_2026').digest('hex');
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

    // Obter buffer do PFX (suporte a base64 na coluna ou arquivo em disco)
    let pfxBuffer: Buffer | null = null;
    if (cert.arquivo_path_enc && cert.arquivo_path_enc.startsWith('base64:')) {
      pfxBuffer = Buffer.from(cert.arquivo_path_enc.replace('base64:', ''), 'base64');
    } else if (cert.arquivo_path_enc && fs.existsSync(cert.arquivo_path_enc)) {
      pfxBuffer = fs.readFileSync(cert.arquivo_path_enc);
    }

    if (!pfxBuffer) {
      console.error(`❌ Arquivo PFX não encontrado no caminho: ${cert.arquivo_path_enc}`);
      return null;
    }

    return { pfxBuffer, senha: senhaPfx };
  } catch (err: any) {
    console.error('❌ Falha ao descriptografar certificado:', err.message);
    return null;
  }
}

// =========================================================
// TRANSMISSÃO HTTPS COM CERTIFICADO A1 (mTLS)
// =========================================================

export interface PemCertificado {
  key: string;
  cert: string;
  ca?: string[];
}

/**
 * Converte o arquivo PKCS#12 (.PFX) em certificados e chave privada PEM
 * usando node-forge puro para compatibilidade total com OpenSSL 3 / Node 18+
 * e certificados ICP-Brasil (Certisign, Serasa, Soluti, Valid, SafeWeb, etc).
 */
export function converterPfxParaPem(pfxBuffer: Buffer, passphrase: string): PemCertificado {
  try {
    const pfxDer = pfxBuffer.toString('binary');
    const pfxAsn1 = forge.asn1.fromDer(pfxDer);
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, passphrase);

    let keyPem = '';
    let certPem = '';
    const caPems: string[] = [];

    for (const safeContent of pfx.safeContents) {
      for (const safeBag of safeContent.safeBags) {
        if (safeBag.key) {
          keyPem = forge.pki.privateKeyToPem(safeBag.key);
        }
        if (safeBag.cert) {
          const pem = forge.pki.certificateToPem(safeBag.cert);
          if (!certPem) {
            certPem = pem;
          } else {
            caPems.push(pem);
          }
        }
      }
    }

    if (!keyPem || !certPem) {
      throw new Error('Não foi possível extrair a chave privada ou certificado X509 do arquivo PFX.');
    }

    return {
      key: keyPem,
      cert: certPem,
      ca: caPems.length > 0 ? caPems : undefined,
    };
  } catch (err: any) {
    console.error('❌ Erro ao converter PFX para PEM via node-forge:', err.message);
    throw new Error(`Falha ao descriptografar arquivo PFX (verifique a senha do certificado): ${err.message}`);
  }
}

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

    // Converter PFX para PEM para contornar limitações do OpenSSL 3 com PKCS#12 legados
    let pem: PemCertificado | null = null;
    try {
      pem = converterPfxParaPem(pfxBuffer, senhaPfx);
    } catch (err: any) {
      return reject(err);
    }

    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse',
        'Content-Length': Buffer.byteLength(soapEnvelope, 'utf8'),
      },
      key: pem.key,
      cert: pem.cert,
      ca: pem.ca,
      rejectUnauthorized: false,
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

  return `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap12:Body><nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg>${xmlDist}</nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>`;
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
  const certificado = await descriptografarCertificado(empresaId, params.cnpjAutor);

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
  const certificado = await descriptografarCertificado(empresaId, cnpj);

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
          aliquotaCbs: 0.9,
          valorCbs: Number((vNF * 0.009).toFixed(2)),
          aliquotaIbs: 0.1,
          valorIbs: Number((vNF * 0.001).toFixed(2)),
          valorImpostoSeletivo: 0,
          statusAuditoria: 'conforme',
          alertasAuditoria: [],
          eventoUltimo: 'Autorizado o uso da NF-e',
          statusSincronizacaoErp: 'pendente',
          xmlRaw: xml,
          isResumoApenas: false,
        });

        // Gravação física automática no disco: C:\SEFAZ\XMLs\[CNPJ_RAIZ]\[Entrada|Saida]\
        try {
          const cnpjRaizSalvar = (params.fluxo === 'saida' ? emitCnpj : destCnpj || params.cnpj || '').replace(/\D/g, '').substring(0, 8);
          salvarXmlLocalmente(xml, cnpjRaizSalvar, params.fluxo === 'saida' ? 'Saída' : 'Entrada', dhEmi, chaveAcesso);
        } catch (diskErr: any) {
          console.warn('Aviso: Falha ao salvar no disco local:', diskErr.message);
        }

        // Gravação automática no banco de dados SQLite
        try {
          const db = getDatabase();
          const tipoOperacaoDoc = params.fluxo === 'saida' ? 'Saída' : 'Entrada';
          db.prepare(`
            INSERT OR REPLACE INTO dfe_documentos (
              id, empresa_id, tipo_doc, chave_acesso, tipo_operacao, numero_serie, data_emissao, data_entrada, 
              fornecedor_cnpj, fornecedor_razao, fornecedor_uf, 
              cliente_cnpj, cliente_razao, cliente_uf, situacao_doc, valor_total,
              valor_icms, valor_ipi, valor_pis, valor_cofins, valor_cbs, valor_ibs
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?
            )
          `).run(
            `doc-${chaveAcesso}`, empresaId, tipoDoc, chaveAcesso, tipoOperacaoDoc, `${nNF} / ${serie}`, dhEmi.split('T')[0], new Date().toISOString(),
            emitCnpj, emitNome, emitUf,
            destCnpj, destNome, destUf, 'autorizado', vNF,
            vICMS, vIPI, vPIS, vCOFINS, Number((vNF * 0.009).toFixed(2)), Number((vNF * 0.001).toFixed(2))
          );
        } catch (dbErr: any) {
          console.warn('Aviso: Falha ao inserir documento no banco:', dbErr.message);
        }
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
