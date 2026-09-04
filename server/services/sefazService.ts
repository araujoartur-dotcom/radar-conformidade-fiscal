/**
 * ============================================================
 * SERVIÇO SEFAZ — TRANSMISSÃO REAL & MONITORAMENTO 360°
 * ============================================================
 * Comunicação SOAP com WebServices da SEFAZ:
 * - NFeRecepcaoEvento4 (Recepção de Eventos Próprios)
 * - NFeDistribuicaoDFe (Distribuição de DF-e, Resumos e Eventos de Terceiros)
 * - NFeConsulta4 (Consulta de Protocolo / Conectividade)
 * 
 * - Padronizado para Horário Oficial de Brasília (America/Sao_Paulo).
 * - Monitoramento 360° de Eventos de Terceiros (Desconhecimento 210220, Operação não Realizada 210240, Confirmação 210200).
 * - Transações atômicas seguras com zero erro de Foreign Key.
 * ============================================================
 */

import https from 'https';
import fs from 'fs';
import crypto from 'crypto';
import zlib from 'zlib';
import forge from 'node-forge';
import { v4 as uuidv4 } from 'uuid';
import { SEFAZ, CERTIFICADO } from '../config';
import { getDatabase } from '../db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';
import { salvarXmlLocalmente } from '../utils/fileStorage';
import { getBrasiliaTimestamp, getBrasiliaDate } from '../utils/timezone';
import { parseFiscalXml, parseEventoSefazXml, sanitizeXmlAntiXXE, extractTagRegex, extractSubTagRegex } from '../utils/xmlParser';
import { resolveSupabaseEmpresaId } from '../utils/tenantHelper';

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
  userId?: string;
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
  userId?: string;
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
  situacaoManifestacao?: string;
  statusSincronizacaoErp: 'pendente' | 'sincronizado';
  xmlRaw: string;
  isResumoApenas?: boolean;
  isEventoTerceiro?: boolean;
  itens?: any[];
}

export interface DistribucaoDfeResponse {
  success: boolean;
  cStat: string;
  xMotivo: string;
  ultNSU: string;
  maxNSU: string;
  tpAmb: string;
  docs: DocumentoDfeExtraido[];
  eventosTerceiros?: any[];
  xmlEnvio: string;
  xmlRetorno: string;
}

// =========================================================
// CONSTRUÇÃO DO ENVELOPE XML SOAP
// =========================================================

function buildEventoXml(params: EventoSefazRequest, nSeq: number): string {
  const {
    chaveAcesso,
    codigoEvento,
    justificativa,
    tpAmb,
    cnpjAutor,
  } = params;

  const orgaoUf = chaveAcesso.substring(0, 2);
  const dhEvento = getBrasiliaTimestamp(); // Padrão SEFAZ YYYY-MM-DDThh:mm:ss-03:00
  const idEvento = `ID${codigoEvento}${chaveAcesso}${String(nSeq).padStart(2, '0')}`;

  let detEvento = '';
  if (justificativa) {
    detEvento = `<xJust>${justificativa}</xJust>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
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
}

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

function buildDistDFeSoapEnvelope(params: DistribucaoDfeRequest): string {
  const { cnpj, ultNSU, chNFe, nsuEspecifico, tpAmb, ufAutor } = params;
  const cleanCnpj = cnpj.replace(/\D/g, '');
  const cUF = (ufAutor && UF_TO_CUF[ufAutor.toUpperCase()]) || '35';

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
// DESCRIPTOGRAFIA DO CERTIFICADO A1
// =========================================================

interface CertificadoDescriptografado {
  pfxBuffer: Buffer;
  senha: string;
}

async function descriptografarCertificado(empresaId: string, cnpj?: string): Promise<CertificadoDescriptografado | null> {
  let cert: any = null;

  // 1. Tentar buscar no Supabase se configurado
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

        if (supaCert) cert = supaCert;
      }

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

          if (certByEmp) cert = certByEmp;
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

  if (!cert) return null;

  let encryptionKey = CERTIFICADO.ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.length !== 64) {
    encryptionKey = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'radar_fiscal_default_secure_key_2026').digest('hex');
  }

  try {
    const keyBuffer = Buffer.from(encryptionKey, 'hex');
    const ivBuffer = Buffer.from(cert.iv, 'hex');
    const authTag = Buffer.from(cert.auth_tag, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
    decipher.setAuthTag(authTag);

    let senhaPfx = decipher.update(cert.senha_enc, 'hex', 'utf8');
    senhaPfx += decipher.final('utf8');

    let pfxBuffer: Buffer | null = null;
    if (cert.arquivo_path_enc && cert.arquivo_path_enc.startsWith('base64:')) {
      pfxBuffer = Buffer.from(cert.arquivo_path_enc.replace('base64:', ''), 'base64');
    } else if (cert.arquivo_path_enc && fs.existsSync(cert.arquivo_path_enc)) {
      pfxBuffer = fs.readFileSync(cert.arquivo_path_enc);
    }

    if (!pfxBuffer) {
      console.error(`❌ Arquivo PFX não encontrado: ${cert.arquivo_path_enc}`);
      return null;
    }

    return { pfxBuffer, senha: senhaPfx };
  } catch (err: any) {
    console.error('❌ Falha ao descriptografar certificado:', err.message);
    return null;
  }
}

export function converterPfxParaPem(pfxBuffer: Buffer, passphrase: string): { key: string; cert: string; ca?: string[] } {
  try {
    const pfxDer = pfxBuffer.toString('binary');
    const pfxAsn1 = forge.asn1.fromDer(pfxDer);
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, passphrase);

    let keyPem = '';
    let certPem = '';
    const caPems: string[] = [];

    for (const safeContent of pfx.safeContents) {
      for (const safeBag of safeContent.safeBags) {
        if (safeBag.key) keyPem = forge.pki.privateKeyToPem(safeBag.key);
        if (safeBag.cert) {
          const pem = forge.pki.certificateToPem(safeBag.cert);
          if (!certPem) certPem = pem;
          else caPems.push(pem);
        }
      }
    }

    if (!keyPem || !certPem) {
      throw new Error('Chave privada ou certificado X509 não encontrados no arquivo PFX.');
    }

    return { key: keyPem, cert: certPem, ca: caPems.length > 0 ? caPems : undefined };
  } catch (err: any) {
    console.error('❌ Erro na conversão PFX -> PEM via node-forge:', err.message);
    throw new Error(`Falha ao descriptografar PFX (verifique a senha do certificado): ${err.message}`);
  }
}

async function enviarParaSefaz(url: string, soapEnvelope: string, pfxBuffer: Buffer, senhaPfx: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    let pem;
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
      res.on('end', () => { resolve({ statusCode: res.statusCode || 0, body }); });
    });

    req.on('error', (err) => { reject(new Error(`Falha na comunicação com SEFAZ: ${err.message}`)); });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout na comunicação com a SEFAZ (30s)')); });

    req.write(soapEnvelope);
    req.end();
  });
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

// =========================================================
// TRANSMITIR EVENTO FISCAL (SEFAZ)
// =========================================================

export async function transmitirEventoSefaz(params: EventoSefazRequest): Promise<EventoSefazResponse> {
  const { tpAmb, empresaId } = params;
  const endpoints = tpAmb === '1' ? SEFAZ.SVRS_PRODUCAO : SEFAZ.SVRS_HOMOLOGACAO;
  const url = endpoints.RECEPCAO_EVENTO;

  const nSeq = params.nSeqEvento || 1;
  const xmlEvento = buildEventoXml(params, nSeq);
  const soapEnvelope = buildSoapEnvelope(xmlEvento);

  const certificado = await descriptografarCertificado(empresaId, params.cnpjAutor);

  if (!certificado) {
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
    console.log(`📡 [${getBrasiliaTimestamp()}] Transmitindo evento ${params.codigoEvento} para SEFAZ (${url})...`);
    const response = await enviarParaSefaz(url, soapEnvelope, certificado.pfxBuffer, certificado.senha);

    const cStat = extractTagRegex(response.body, 'cStat');
    const xMotivo = extractTagRegex(response.body, 'xMotivo');
    const nProt = extractTagRegex(response.body, 'nProt');
    const dhRegEvento = extractTagRegex(response.body, 'dhRegEvento') || getBrasiliaTimestamp();

    const success = ['128', '135', '136'].includes(cStat);
    console.log(`${success ? '✅' : '❌'} SEFAZ cStat=${cStat}: ${xMotivo} (nProt=${nProt})`);

    return {
      success,
      cStat,
      xMotivo,
      nProt: nProt || undefined,
      dhRegEvento,
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
// CONSULTA NFeDistribuicaoDFe & MONITOR 360° DE EVENTOS
// =========================================================

export async function consultarDistribuicaoDFe(params: DistribucaoDfeRequest): Promise<DistribucaoDfeResponse> {
  const { tpAmb, empresaId, cnpj, manifestarCienciaAutomatica } = params;

  const url = tpAmb === '1'
    ? (SEFAZ.SVRS_PRODUCAO.DISTRIBUICAO_DFE || 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx')
    : (SEFAZ.SVRS_HOMOLOGACAO.DISTRIBUICAO_DFE || 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx');

  const soapEnvelope = buildDistDFeSoapEnvelope(params);
  const certificado = await descriptografarCertificado(empresaId, cnpj);

  if (!certificado) {
    return {
      success: false,
      cStat: '999',
      xMotivo: 'Certificado Digital A1 não configurado no cofre seguro para este CNPJ.',
      ultNSU: params.ultNSU || '000000000000000',
      maxNSU: '000000000000000',
      tpAmb,
      docs: [],
      xmlEnvio: soapEnvelope,
      xmlRetorno: '',
    };
  }

  try {
    console.log(`📡 [${getBrasiliaTimestamp()}] Consultando NFeDistribuicaoDFe para CNPJ ${cnpj} (ultNSU=${params.ultNSU})...`);
    const response = await enviarParaSefaz(url, soapEnvelope, certificado.pfxBuffer, certificado.senha);

    const cStat = extractTagRegex(response.body, 'cStat') || '999';
    const xMotivo = extractTagRegex(response.body, 'xMotivo') || 'Sem resposta';
    const ultNSURetorno = extractTagRegex(response.body, 'ultNSU') || params.ultNSU || '000000000000000';
    const maxNSURetorno = extractTagRegex(response.body, 'maxNSU') || '000000000000000';

    const rawDocs = extrairDocZips(response.body);
    const docsProcessados: DocumentoDfeExtraido[] = [];
    const eventosTerceiros: any[] = [];
    const db = getDatabase();

    // Resolver ID de usuário para integridade de eventos
    let defaultUserId = params.userId || '';
    if (!defaultUserId) {
      const uRow = db.prepare("SELECT id FROM usuarios WHERE perfil = 'admin_master' OR status = 'ativo' LIMIT 1").get() as any;
      defaultUserId = uRow?.id || uuidv4();
    }

    const brasiliaNow = getBrasiliaTimestamp();

    for (const raw of rawDocs) {
      const xml = raw.xmlContent;
      const sanitizedXml = sanitizeXmlAntiXXE(xml);

      // ── CASO A: EVENTO SEFAZ DE TERCEIROS (procEventoNFe / resEvento) ──
      if (raw.schema.includes('procEvento') || raw.schema.includes('resEvento') || xml.includes('<procEventoNFe') || xml.includes('<evento')) {
        const parsedEvt = parseEventoSefazXml(sanitizedXml, cnpj);
        if (parsedEvt) {
          console.log(`🔔 [Monitor 360°] Evento SEFAZ detectado: ${parsedEvt.codigoEvento} (${parsedEvt.nomeEvento}) na chave ${parsedEvt.chaveAcesso} (Autor: ${parsedEvt.autorCnpj})`);

          eventosTerceiros.push(parsedEvt);

          // Persistência Transacional Atômica do Evento de Terceiro
          try {
            db.transaction(() => {
              const docDbId = `doc-${parsedEvt.chaveAcesso}`;

              // 1. Garantir que o documento pai exista em dfe_documentos
              const existingDoc = db.prepare('SELECT id, situacao_doc, tipo_operacao FROM dfe_documentos WHERE chave_acesso = ?').get(parsedEvt.chaveAcesso) as any;

              let situacaoManifestacao = 'sem_manifestacao';
              let situacaoDoc = 'autorizado';
              let alertaFraude = 0;

              if (parsedEvt.isDesconhecimento) {
                situacaoManifestacao = 'desconhecida_pelo_destinatario';
                situacaoDoc = 'desconhecido_pelo_destinatario';
                alertaFraude = 1;
              } else if (parsedEvt.isOperacaoNaoRealizada) {
                situacaoManifestacao = 'operacao_nao_realizada';
                situacaoDoc = 'operacao_nao_realizada';
                alertaFraude = 1;
              } else if (parsedEvt.isConfirmacao) {
                situacaoManifestacao = 'confirmada';
                situacaoDoc = 'autorizado';
              } else if (parsedEvt.isCiencia) {
                situacaoManifestacao = 'ciencia_emitida';
              }

              if (!existingDoc) {
                // Auto-provisiona registro pai na tabela dfe_documentos
                db.prepare(`
                  INSERT OR REPLACE INTO dfe_documentos (
                    id, empresa_id, tipo_doc, chave_acesso, tipo_operacao, numero_serie,
                    data_emissao, data_entrada, competencia,
                    fornecedor_cnpj, fornecedor_razao, fornecedor_uf,
                    cliente_cnpj, cliente_razao, cliente_uf,
                    situacao_doc, situacao_manifestacao, evento_ultimo,
                    valor_total, alerta_fraude, download_at, created_at, updated_at
                  ) VALUES (
                    ?, ?, 'NFe', ?, 'Saída', ?,
                    ?, ?, ?,
                    ?, 'EMITENTE (MINHA EMPRESA)', 'SP',
                    ?, 'CLIENTE DESTINATÁRIO', 'SP',
                    ?, ?, ?,
                    0, ?, ?, ?, ?
                  )
                `).run(
                  docDbId,
                  empresaId,
                  parsedEvt.chaveAcesso,
                  `${parsedEvt.chaveAcesso.substring(25, 34)} / ${parsedEvt.chaveAcesso.substring(22, 25)}`,
                  getBrasiliaDate(),
                  brasiliaNow,
                  getBrasiliaDate().substring(0, 7),
                  cnpj.replace(/\D/g, ''),
                  parsedEvt.autorCnpj || '00000000000000',
                  situacaoDoc,
                  situacaoManifestacao,
                  parsedEvt.nomeEvento,
                  alertaFraude,
                  brasiliaNow,
                  brasiliaNow,
                  brasiliaNow
                );
              } else {
                // Atualiza o documento pai existente
                db.prepare(`
                  UPDATE dfe_documentos
                  SET situacao_manifestacao = ?,
                      situacao_doc = CASE WHEN ? = 1 THEN ? ELSE situacao_doc END,
                      evento_ultimo = ?,
                      alerta_fraude = CASE WHEN ? = 1 THEN 1 ELSE alerta_fraude END,
                      updated_at = ?
                  WHERE chave_acesso = ?
                `).run(
                  situacaoManifestacao,
                  alertaFraude,
                  situacaoDoc,
                  parsedEvt.nomeEvento,
                  alertaFraude,
                  brasiliaNow,
                  parsedEvt.chaveAcesso
                );
              }

              // 2. Gravar o evento na tabela de histórico
              const eventoDbId = `evt-${parsedEvt.chaveAcesso}-${parsedEvt.codigoEvento}-${Date.now()}`;
              db.prepare(`
                INSERT OR REPLACE INTO eventos_transmitidos (
                  id, empresa_id, usuario_id, documento_id, chave_acesso,
                  tipo_dfe, codigo_evento, nome_evento, categoria,
                  autor_cnpj, origem_evento, justificativa, ambiente,
                  protocolo_sefaz, xml_envio, xml_retorno, codigo_retorno,
                  motivo_retorno, status, data_hora, created_at
                ) VALUES (
                  ?, ?, ?, ?, ?,
                  'NFe', ?, ?, 'destinatario',
                  ?, ?, ?, ?,
                  ?, '', ?, ?,
                  ?, 'processado', ?, ?
                )
              `).run(
                eventoDbId,
                empresaId,
                defaultUserId,
                docDbId,
                parsedEvt.chaveAcesso,
                parsedEvt.codigoEvento,
                parsedEvt.nomeEvento,
                parsedEvt.autorCnpj,
                parsedEvt.origemEvento,
                parsedEvt.justificativa,
                tpAmb,
                parsedEvt.protocolo,
                sanitizedXml,
                parsedEvt.cStat,
                parsedEvt.xMotivo,
                parsedEvt.dhEvento || brasiliaNow,
                brasiliaNow
              );
            })();
          } catch (evtErr: any) {
            console.error('❌ Falha ao persistir evento de terceiro no banco:', evtErr.message);
          }
        }
        continue;
      }

      // ── CASO B: RESUMO DE NF-e (<resNFe>) ──────────────────────────
      if (raw.schema.includes('resNFe') || xml.includes('<resNFe')) {
        const chNFe = extractTagRegex(sanitizedXml, 'chNFe');
        const emitCnpj = extractTagRegex(sanitizedXml, 'CNPJ') || extractTagRegex(sanitizedXml, 'CPF');
        const emitNome = extractTagRegex(sanitizedXml, 'xNome') || 'Emitente Localizado (Resumo SEFAZ)';
        const vNF = parseFloat(extractTagRegex(sanitizedXml, 'vNF') || '0');
        const dhEmiRaw = extractTagRegex(sanitizedXml, 'dhEmi') || brasiliaNow;
        const dhEmi = getBrasiliaDate(dhEmiRaw);

        // Se configurado para manifestar ciência automática
        let manifestado = false;
        if (manifestarCienciaAutomatica && chNFe) {
          try {
            console.log(`⚡ [${getBrasiliaTimestamp()}] Disparando Ciência da Operação automática para chave ${chNFe}...`);
            await transmitirEventoSefaz({
              chaveAcesso: chNFe,
              codigoEvento: '210210',
              nomeEvento: 'Ciencia da Operacao',
              tpAmb,
              cnpjAutor: cnpj,
              empresaId,
              userId: defaultUserId,
            });
            manifestado = true;
          } catch (e: any) {
            console.warn(`Aviso: falha na ciência automática para ${chNFe}:`, e.message);
          }
        }

        // Persistência do Resumo em dfe_documentos
        const docDbId = `doc-${chNFe}`;
        try {
          db.transaction(() => {
            db.prepare(`
              INSERT OR REPLACE INTO dfe_documentos (
                id, empresa_id, tipo_doc, chave_acesso, tipo_operacao, numero_serie,
                data_emissao, data_entrada, competencia,
                fornecedor_cnpj, fornecedor_razao, fornecedor_uf,
                cliente_cnpj, cliente_razao, cliente_uf,
                situacao_doc, situacao_manifestacao, evento_ultimo,
                valor_total, valor_cbs, valor_ibs,
                xml_raw, download_at, created_at, updated_at
              ) VALUES (
                ?, ?, 'NFe', ?, 'Entrada', ?,
                ?, ?, ?,
                ?, ?, 'SP',
                ?, 'MINHA EMPRESA', 'SP',
                'autorizado', ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?
              )
            `).run(
              docDbId,
              empresaId,
              chNFe,
              `${chNFe.substring(25, 34)} / ${chNFe.substring(22, 25)}`,
              dhEmi,
              brasiliaNow,
              dhEmi.substring(0, 7),
              emitCnpj,
              emitNome,
              cnpj.replace(/\D/g, ''),
              manifestado ? 'ciencia_emitida' : 'sem_manifestacao',
              manifestado ? 'Ciência da Emissão' : 'Resumo Capturado',
              vNF,
              0,
              0,
              sanitizedXml,
              brasiliaNow,
              brasiliaNow,
              brasiliaNow
            );
          })();

          // Sincronização segura no Supabase (Resumo)
          if (isSupabaseConfigured()) {
            const supabase = getSupabaseAdmin();
            if (supabase) {
              try {
                const supaEmpresaId = await resolveSupabaseEmpresaId(supabase, {
                  id: empresaId,
                  cnpj_completo: cnpj,
                  cnpj_raiz: cnpj.substring(0, 8),
                  razao_social: emitNome
                });

                const { error: summaryErr } = await supabase.from('dfe_documentos').upsert({
                  id: docDbId,
                  empresa_id: supaEmpresaId,
                  tipo_doc: 'NFe',
                  chave_acesso: chNFe,
                  tipo_operacao: 'Entrada',
                  numero_serie: `${chNFe.substring(25, 34)} / ${chNFe.substring(22, 25)}`,
                  data_emissao: dhEmi,
                  data_entrada: brasiliaNow,
                  competencia: dhEmi.substring(0, 7),
                  fornecedor_cnpj: emitCnpj,
                  fornecedor_razao: emitNome,
                  fornecedor_uf: 'SP',
                  cliente_cnpj: cnpj.replace(/\D/g, ''),
                  cliente_razao: 'MINHA EMPRESA',
                  cliente_uf: 'SP',
                  situacao_doc: 'autorizado',
                  situacao_manifestacao: manifestado ? 'ciencia_emitida' : 'sem_manifestacao',
                  evento_ultimo: manifestado ? 'Ciência da Emissão' : 'Resumo Capturado',
                  valor_total: vNF,
                  valor_cbs: 0,
                  valor_ibs: 0,
                  xml_raw: sanitizedXml,
                  download_at: brasiliaNow,
                  updated_at: brasiliaNow
                }, { onConflict: 'chave_acesso' });

                if (summaryErr) {
                  console.warn('⚠️ Supabase summary sync error:', summaryErr.message);
                }
              } catch (supaErr: any) {
                console.warn('⚠️ Supabase summary sync exception:', supaErr?.message || supaErr);
              }
            }
          }
        } catch (resErr: any) {
          console.warn('Aviso: falha ao persistir resumo no banco:', resErr.message);
        }

        docsProcessados.push({
          id: `res-${raw.nsu}-${Date.now()}`,
          schema: raw.schema,
          nsu: raw.nsu,
          tipo: 'NFe',
          numero: chNFe.length >= 34 ? chNFe.substring(25, 34) : '1',
          serie: chNFe.length >= 25 ? chNFe.substring(22, 25) : '1',
          chaveAcesso: chNFe,
          dataEmissao: dhEmi,
          emitenteCnpj: emitCnpj,
          emitenteNome: emitNome,
          emitenteUf: 'SP',
          destinatarioCnpj: cnpj,
          destinatarioNome: 'MINHA EMPRESA',
          destinatarioUf: 'SP',
          valorTotal: vNF,
          valorIcms: Number((vNF * 0.18).toFixed(2)),
          valorIpi: 0,
          valorPis: Number((vNF * 0.0165).toFixed(2)),
          valorCofins: Number((vNF * 0.076).toFixed(2)),
          aliquotaCbs: 0,
          valorCbs: 0,
          aliquotaIbs: 0,
          valorIbs: 0,
          valorImpostoSeletivo: 0,
          statusAuditoria: 'conforme',
          alertasAuditoria: manifestado ? ['Ciência da Operação transmitida automaticamente'] : ['Resumo SEFAZ - Manifestação pendente para XML completo'],
          eventoUltimo: manifestado ? 'Ciência da Emissão' : 'Resumo Capturado',
          situacaoManifestacao: manifestado ? 'ciencia_emitida' : 'sem_manifestacao',
          statusSincronizacaoErp: 'pendente',
          xmlRaw: sanitizedXml,
          isResumoApenas: true,
        });

        continue;
      }

      // ── CASO C: XML COMPLETO (<nfeProc>, <CTeProc>, etc.) ─────────
      try {
        const parsedDoc = await parseFiscalXml(sanitizedXml, cnpj);
        const tipoOperacaoDoc = params.fluxo === 'saida' ? 'Saída' : parsedDoc.tipoOperacao;
        const cnpjRaizSalvar = cnpj.replace(/\D/g, '').substring(0, 8);

        // 1. Salvar fisicamente no disco
        try {
          salvarXmlLocalmente(sanitizedXml, cnpjRaizSalvar, tipoOperacaoDoc, parsedDoc.dataEmissaoCompleta, parsedDoc.chaveAcesso);
        } catch (diskErr: any) {
          console.warn('Aviso: Falha ao salvar no disco local:', diskErr.message);
        }

        // 2. Persistência atômica no banco de dados (Documento + Itens)
        const docDbId = `doc-${parsedDoc.chaveAcesso}`;
        db.transaction(() => {
          db.prepare(`
            INSERT OR REPLACE INTO dfe_documentos (
              id, empresa_id, tipo_doc, chave_acesso, tipo_operacao, numero_serie,
              data_emissao, data_entrada, competencia,
              fornecedor_cnpj, fornecedor_razao, fornecedor_uf, fornecedor_municipio, fornecedor_ie,
              cliente_cnpj, cliente_razao, cliente_uf, cliente_ie,
              situacao_doc, situacao_manifestacao, evento_ultimo,
              valor_total, valor_icms, valor_ipi, valor_pis, valor_cofins,
              valor_cbs, valor_ibs, valor_is, valor_irrf, valor_inss, valor_iss, valor_csll,
              xml_raw, status_sefaz, protocolo_sefaz, download_at, created_at, updated_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?,
              ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?
            )
          `).run(
            docDbId,
            empresaId,
            parsedDoc.tipoDoc,
            parsedDoc.chaveAcesso,
            tipoOperacaoDoc,
            parsedDoc.numero,
            parsedDoc.dataEmissao,
            parsedDoc.dataEntrada,
            parsedDoc.competencia,
            parsedDoc.emitenteCnpj,
            parsedDoc.emitenteNome,
            parsedDoc.emitenteUf,
            parsedDoc.emitenteMunicipio,
            parsedDoc.emitenteIe,
            parsedDoc.destinatarioCnpj,
            parsedDoc.destinatarioNome,
            parsedDoc.destinatarioUf,
            parsedDoc.destinatarioIe,
            parsedDoc.situacaoDoc,
            parsedDoc.situacaoManifestacao,
            parsedDoc.eventoUltimo,
            parsedDoc.valorTotal,
            parsedDoc.valorIcms,
            parsedDoc.valorIpi,
            parsedDoc.valorPis,
            parsedDoc.valorCofins,
            parsedDoc.valorCbs,
            parsedDoc.valorIbs,
            parsedDoc.valorIs,
            parsedDoc.valorIrrf,
            parsedDoc.valorInss,
            parsedDoc.valorIss,
            parsedDoc.valorCsll,
            sanitizedXml,
            parsedDoc.statusSefaz,
            parsedDoc.protocoloSefaz,
            brasiliaNow,
            brasiliaNow,
            brasiliaNow
          );

          // Inserir itens
          if (parsedDoc.itens && parsedDoc.itens.length > 0) {
            const insertItemStmt = db.prepare(`
              INSERT OR REPLACE INTO dfe_itens (
                id, documento_id, item_nro, codigo_item, descricao_item, ncm, cest, cfop,
                cclasstrib, cst_csosn, natureza_operacao, quantidade, unidade,
                valor_unitario, valor_bruto_item, desconto_incondicional, frete_seguro_rateado,
                valor_liquido_item, base_icms, aliquota_icms, valor_icms,
                base_ipi, aliquota_ipi, valor_ipi,
                base_pis, aliquota_pis, valor_pis,
                base_cofins, aliquota_cofins, valor_cofins,
                base_ibs, aliquota_ibs, valor_ibs,
                base_cbs, aliquota_cbs, valor_cbs, valor_is, created_at
              ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?
              )
            `);

            for (const it of parsedDoc.itens) {
              const itemId = `item-${parsedDoc.chaveAcesso}-${it.numeroItem}`;
              insertItemStmt.run(
                itemId, docDbId, it.numeroItem, it.codigo, it.descricao, it.ncm, it.cest, it.cfop,
                it.cClassTrib, it.cstCsosn, it.naturezaOperacao, it.quantidade, it.unidade,
                it.valorUnitario, it.valorBruto, it.desconto, it.freteSeguro,
                it.valorLiquido, it.baseIcms, it.aliquotaIcms, it.valorIcms,
                it.baseIpi, it.aliquotaIpi, it.valorIpi,
                it.basePis, it.aliquotaPis, it.valorPis,
                it.baseCofins, it.aliquotaCofins, it.valorCofins,
                it.baseIbs, it.aliquotaIbs, it.valorIbs,
                it.baseCbs, it.aliquotaCbs, it.valorCbs, it.valorIs,
                brasiliaNow
              );
            }
          }
        })();

        // Sincronização segura no Supabase (XML Completo + Itens)
        if (isSupabaseConfigured()) {
          const supabase = getSupabaseAdmin();
          if (supabase) {
            try {
              const supaEmpresaId = await resolveSupabaseEmpresaId(supabase, {
                id: empresaId,
                cnpj_completo: cnpj || parsedDoc.destinatarioCnpj || parsedDoc.emitenteCnpj,
                cnpj_raiz: (cnpj || parsedDoc.destinatarioCnpj || parsedDoc.emitenteCnpj).replace(/\D/g, '').substring(0, 8),
                razao_social: parsedDoc.destinatarioNome || parsedDoc.emitenteNome
              });

              const { error: docError } = await supabase.from('dfe_documentos').upsert({
                id: docDbId,
                empresa_id: supaEmpresaId,
                tipo_doc: parsedDoc.tipoDoc,
                chave_acesso: parsedDoc.chaveAcesso,
                tipo_operacao: tipoOperacaoDoc,
                numero_serie: parsedDoc.numero,
                data_emissao: parsedDoc.dataEmissao,
                data_entrada: parsedDoc.dataEntrada,
                competencia: parsedDoc.competencia,
                fornecedor_cnpj: parsedDoc.emitenteCnpj,
                fornecedor_razao: parsedDoc.emitenteNome,
                fornecedor_uf: parsedDoc.emitenteUf,
                fornecedor_municipio: parsedDoc.emitenteMunicipio,
                fornecedor_ie: parsedDoc.emitenteIe || '',
                cliente_cnpj: parsedDoc.destinatarioCnpj,
                cliente_razao: parsedDoc.destinatarioNome,
                cliente_uf: parsedDoc.destinatarioUf,
                cliente_ie: parsedDoc.destinatarioIe || '',
                situacao_doc: parsedDoc.situacaoDoc,
                situacao_manifestacao: parsedDoc.situacaoManifestacao,
                evento_ultimo: parsedDoc.eventoUltimo,
                valor_total: parsedDoc.valorTotal,
                valor_icms: parsedDoc.valorIcms,
                valor_ipi: parsedDoc.valorIpi,
                valor_pis: parsedDoc.valorPis,
                valor_cofins: parsedDoc.valorCofins,
                valor_cbs: parsedDoc.valorCbs,
                valor_ibs: parsedDoc.valorIbs,
                valor_is: parsedDoc.valorIs,
                valor_irrf: parsedDoc.valorIrrf,
                valor_inss: parsedDoc.valorInss,
                valor_iss: parsedDoc.valorIss,
                valor_csll: parsedDoc.valorCsll,
                xml_raw: sanitizedXml,
                status_sefaz: parsedDoc.statusSefaz,
                protocolo_sefaz: parsedDoc.protocoloSefaz,
                download_at: brasiliaNow,
                updated_at: brasiliaNow
              }, { onConflict: 'chave_acesso' });

              if (docError) {
                console.error('❌ Erro ao sincronizar dfe_documentos no Supabase:', docError.message);
              } else if (parsedDoc.itens && parsedDoc.itens.length > 0) {
                const supaItens = parsedDoc.itens.map(it => ({
                  id: uuidv4(),
                  documento_id: docDbId,
                  item_nro: it.numeroItem,
                  codigo_item: it.codigo,
                  descricao_item: it.descricao,
                  ncm: it.ncm,
                  cest: it.cest,
                  cfop: it.cfop,
                  cclasstrib: it.cClassTrib,
                  cst_csosn: it.cstCsosn,
                  natureza_operacao: it.naturezaOperacao,
                  quantidade: it.quantidade,
                  unidade: it.unidade,
                  valor_unitario: it.valorUnitario,
                  valor_bruto_item: it.valorBruto,
                  desconto_incondicional: it.desconto,
                  frete_seguro_rateado: it.freteSeguro,
                  valor_liquido_item: it.valorLiquido,
                  base_icms: it.baseIcms,
                  aliquota_icms: it.aliquotaIcms,
                  valor_icms: it.valorIcms,
                  base_ipi: it.baseIpi,
                  aliquota_ipi: it.aliquotaIpi,
                  valor_ipi: it.valorIpi,
                  base_pis: it.basePis,
                  aliquota_pis: it.aliquotaPis,
                  valor_pis: it.valorPis,
                  base_cofins: it.baseCofins,
                  aliquota_cofins: it.aliquotaCofins,
                  valor_cofins: it.valorCofins,
                  base_ibs: it.baseIbs,
                  aliquota_ibs: it.aliquotaIbs,
                  valor_ibs: it.valorIbs,
                  base_cbs: it.baseCbs,
                  aliquota_cbs: it.aliquotaCbs,
                  valor_cbs: it.valorCbs,
                  valor_is: it.valorIs
                }));
                const { error: itensError } = await supabase.from('dfe_itens').upsert(supaItens);
                if (itensError) {
                  console.error('❌ Erro ao sincronizar dfe_itens no Supabase:', itensError.message);
                }
              }
            } catch (supaErr: any) {
              console.warn('⚠️ Supabase sync warning (full XML):', supaErr?.message || supaErr);
            }
          }
        }

        docsProcessados.push({
          id: docDbId,
          schema: raw.schema,
          nsu: raw.nsu,
          tipo: parsedDoc.tipoDoc,
          numero: parsedDoc.numero,
          serie: parsedDoc.serie,
          chaveAcesso: parsedDoc.chaveAcesso,
          dataEmissao: parsedDoc.dataEmissao,
          emitenteCnpj: parsedDoc.emitenteCnpj,
          emitenteNome: parsedDoc.emitenteNome,
          emitenteUf: parsedDoc.emitenteUf,
          destinatarioCnpj: parsedDoc.destinatarioCnpj,
          destinatarioNome: parsedDoc.destinatarioNome,
          destinatarioUf: parsedDoc.destinatarioUf,
          valorTotal: parsedDoc.valorTotal,
          valorIcms: parsedDoc.valorIcms,
          valorIpi: parsedDoc.valorIpi,
          valorPis: parsedDoc.valorPis,
          valorCofins: parsedDoc.valorCofins,
          aliquotaCbs: parsedDoc.valorTotal > 0 && parsedDoc.valorCbs > 0 ? Number(((parsedDoc.valorCbs / parsedDoc.valorTotal) * 100).toFixed(2)) : 0,
          valorCbs: parsedDoc.valorCbs,
          aliquotaIbs: parsedDoc.valorTotal > 0 && parsedDoc.valorIbs > 0 ? Number(((parsedDoc.valorIbs / parsedDoc.valorTotal) * 100).toFixed(2)) : 0,
          valorIbs: parsedDoc.valorIbs,
          valorImpostoSeletivo: parsedDoc.valorIs,
          statusAuditoria: 'conforme',
          alertasAuditoria: [],
          eventoUltimo: 'Autorizado o uso do DF-e',
          statusSincronizacaoErp: 'pendente',
          xmlRaw: sanitizedXml,
          isResumoApenas: false,
          itens: parsedDoc.itens,
        });
      } catch (procErr: any) {
        console.error('❌ Falha ao processar XML completo:', procErr.message);
      }
    }

    // 4. Atualizar NSU da empresa no banco
    try {
      db.prepare(`
        UPDATE empresas
        SET ultimo_nsu = ?, max_nsu = ?, updated_at = ?
        WHERE id = ?
      `).run(ultNSURetorno, maxNSURetorno, brasiliaNow, empresaId);
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
      eventosTerceiros,
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

// =========================================================
// TESTE DE CONEXÃO SEFAZ (PING)
// =========================================================

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
      res.resume();
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

export default {
  UF_TO_CUF,
  transmitirEventoSefaz,
  consultarDistribuicaoDFe,
  testarConexaoSefaz,
  converterPfxParaPem,
};
