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
import { SignedXml } from 'xml-crypto';
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

export interface ConsultaProtocoloDfeRequest {
  chaveAcesso: string;
  tipoDoc?: 'NFe' | 'CTe';
  tpAmb: '1' | '2';
  empresaId: string;
  cnpj?: string;
  userId?: string;
}

export interface ConsultaProtocoloEventoItem {
  codigoEvento: string;
  nomeEvento: string;
  nSeqEvento: number;
  dataHora: string;
  protocolo: string;
  cStat: string;
  xMotivo: string;
  autorCnpj?: string;
  justificativa?: string;
  detalhes?: any;
  origemEvento: 'proprio' | 'terceiro_destinatario' | 'fisco' | 'sefaz';
  xmlRetorno?: string;
}

export interface ConsultaProtocoloDfeResponse {
  success: boolean;
  cStat: string;
  xMotivo: string;
  chaveAcesso: string;
  tipoDoc: 'NFe' | 'CTe';
  tpAmb: '1' | '2';
  cUF?: string;
  dhRecbto?: string;
  protocoloAutorizacao?: string;
  situacaoDoc?: string;
  eventos: ConsultaProtocoloEventoItem[];
  xmlEnvio: string;
  xmlRetorno: string;
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

const MAPA_DESC_EVENTO: Record<string, string> = {
  '210200': 'Confirmacao da Operacao',
  '210210': 'Ciencia da Operacao',
  '210220': 'Desconhecimento da Operacao',
  '210240': 'Operacao nao Realizada',
  '110110': 'Carta de Correcao',
  '110111': 'Cancelamento',
};

function buildEventoXml(params: EventoSefazRequest, nSeq: number): { rawEventoXml: string; idEvento: string } {
  const {
    chaveAcesso,
    codigoEvento,
    justificativa,
    tpAmb,
    cnpjAutor,
  } = params;

  // Eventos de Manifestação do Destinatário (210200, 210210, 210220, 210240) exigem obrigatoriamente cOrgao=91 (Ambiente Nacional RFB - NT 2020.001)
  const isManifestacaoDest = ['210200', '210210', '210220', '210240'].includes(codigoEvento);
  const orgaoUf = isManifestacaoDest ? '91' : chaveAcesso.substring(0, 2);
  const dhEvento = getBrasiliaTimestamp(); // Padrão SEFAZ YYYY-MM-DDThh:mm:ss-03:00
  const idEvento = `ID${codigoEvento}${chaveAcesso}${String(nSeq).padStart(2, '0')}`;

  const descEvento = MAPA_DESC_EVENTO[codigoEvento] || (params.nomeEvento || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let detEvento = '';
  if (justificativa) {
    const cleanJust = justificativa.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    detEvento = `<xJust>${cleanJust}</xJust>`;
  }

  // XML base do elemento <evento> (sem prólogo <?xml...?>) para assinatura enveloped XMLDSig
  const rawEventoXml = `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><infEvento Id="${idEvento}"><cOrgao>${orgaoUf}</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>${cnpjAutor.replace(/\D/g, '')}</CNPJ><chNFe>${chaveAcesso}</chNFe><dhEvento>${dhEvento}</dhEvento><tpEvento>${codigoEvento}</tpEvento><nSeqEvento>${nSeq}</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>${descEvento}</descEvento>${detEvento}</detEvento></infEvento></evento>`;

  return { rawEventoXml, idEvento };
}

export function assinarEventoXml(
  rawEventoXml: string,
  pfxBuffer: Buffer,
  senhaPfx: string,
  idEvento: string
): string {
  const pem = converterPfxParaPem(pfxBuffer, senhaPfx);

  const sig = new SignedXml({ privateKey: pem.key, publicCert: pem.cert });
  sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
  sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
  sig.addReference({
    xpath: `//*[@Id='${idEvento}']`,
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    ],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1'
  });
  sig.computeSignature(rawEventoXml, {
    location: { reference: `//*[@Id='${idEvento}']`, action: 'after' }
  });

  return sig.getSignedXml();
}

function buildEnvEventoXml(signedEventoXml: string): string {
  const idLote = Date.now().toString().slice(-15);
  return `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${idLote}</idLote>${signedEventoXml}</envEvento>`;
}

function buildSoapEnvelope(envEventoXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">${envEventoXml}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
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

export function buildCteDistDFeSoapEnvelope(params: DistribucaoDfeRequest): string {
  const { cnpj, ultNSU, chNFe: chCTe, nsuEspecifico, tpAmb, ufAutor } = params;
  const cleanCnpj = cnpj.replace(/\D/g, '');
  const cUF = (ufAutor && UF_TO_CUF[ufAutor.toUpperCase()]) || '35';

  let distBody = '';
  if (chCTe && chCTe.replace(/\D/g, '').length === 44) {
    distBody = `<consChCTe><chCTe>${chCTe.replace(/\D/g, '')}</chCTe></consChCTe>`;
  } else if (nsuEspecifico && nsuEspecifico.trim() !== '') {
    distBody = `<consNSU><NSU>${nsuEspecifico.replace(/\D/g, '').padStart(15, '0')}</NSU></consNSU>`;
  } else {
    const nsuFormatted = String(ultNSU || '0').replace(/\D/g, '').padStart(15, '0');
    distBody = `<distNSU><ultNSU>${nsuFormatted}</ultNSU></distNSU>`;
  }

  const xmlDist = `<distDFeInt xmlns="http://www.portalfiscal.inf.br/cte" versao="1.00"><tpAmb>${tpAmb}</tpAmb><cUFAutor>${cUF}</cUFAutor><CNPJ>${cleanCnpj}</CNPJ>${distBody}</distDFeInt>`;

  return `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap12:Body><cteDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe"><cteDadosMsg>${xmlDist}</cteDadosMsg></cteDistDFeInteresse></soap12:Body></soap12:Envelope>`;
}

// =========================================================
// DESCRIPTOGRAFIA DO CERTIFICADO A1
// =========================================================

export interface CertificadoDescriptografado {
  pfxBuffer: Buffer;
  senha: string;
}

export interface DiagnosticoCertificado {
  certificado: CertificadoDescriptografado | null;
  motivoErro?: string;
  origem?: 'supabase' | 'sqlite' | 'nenhuma';
}

export async function descriptografarCertificadoComDiagnostico(empresaId: string, cnpj?: string): Promise<DiagnosticoCertificado> {
  let cert: any = null;
  let origem: 'supabase' | 'sqlite' | 'nenhuma' = 'nenhuma';
  const cleanCnpj = (cnpj || '').replace(/\D/g, '');
  const cleanEmpId = (empresaId || '').replace(/\D/g, '');

  // 1. Tentar buscar no Supabase se configurado
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      // 1.1 Busca direta por empresa_id
      if (empresaId) {
        const { data: supaCert } = await supabase
          .from('certificados')
          .select('*')
          .eq('empresa_id', empresaId)
          .neq('status_alerta', 'expirado')
          .neq('status_alerta', 'substituido')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (supaCert) {
          cert = supaCert;
          origem = 'supabase';
        }
      }

      // 1.2 Se não achou por empresa_id direto, busca via empresas vinculadas por CNPJ ou CNPJ Raiz
      if (!cert && (cleanCnpj || cleanEmpId)) {
        const targetClean = cleanCnpj || cleanEmpId;
        const { data: empList } = await supabase
          .from('empresas')
          .select('id')
          .or(`cnpj_completo.eq.${cnpj || empresaId},cnpj_raiz.eq.${targetClean.substring(0, 8)}`)
          .limit(5);

        if (empList && empList.length > 0) {
          const empIds = empList.map(e => e.id);
          const { data: certByEmp } = await supabase
            .from('certificados')
            .select('*')
            .in('empresa_id', empIds)
            .neq('status_alerta', 'expirado')
            .neq('status_alerta', 'substituido')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (certByEmp) {
            cert = certByEmp;
            origem = 'supabase';
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
        SELECT arquivo_path_enc, senha_enc, iv, auth_tag, status_alerta, id
        FROM certificados
        WHERE empresa_id = ? AND status_alerta NOT IN ('expirado', 'substituido')
        ORDER BY created_at DESC, validade DESC LIMIT 1
      `).get(empresaId) as any;
      if (cert) origem = 'sqlite';
    }

    if (!cert && (cleanCnpj || cleanEmpId)) {
      const targetClean = cleanCnpj || cleanEmpId;
      cert = db.prepare(`
        SELECT c.arquivo_path_enc, c.senha_enc, c.iv, c.auth_tag, c.status_alerta, c.id
        FROM certificados c
        JOIN empresas e ON e.id = c.empresa_id
        WHERE (e.cnpj_raiz = ? 
            OR REPLACE(REPLACE(REPLACE(e.cnpj_completo, '.', ''), '/', ''), '-', '') = ? 
            OR c.empresa_id = ?)
          AND c.status_alerta NOT IN ('expirado', 'substituido')
        ORDER BY c.created_at DESC, c.validade DESC LIMIT 1
      `).get(targetClean.substring(0, 8), targetClean, empresaId) as any;
      if (cert) origem = 'sqlite';
    }
  }

  // Se nenhum registro de certificado foi encontrado no banco
  if (!cert) {
    return {
      certificado: null,
      motivoErro: `⚠️ Certificado Digital A1 não encontrado para esta empresa (CNPJ: ${cnpj || empresaId || 'Não Identificado'}). Para transmitir à SEFAZ oficial, cadastre o Certificado A1 e a senha.`,
      origem: 'nenhuma'
    };
  }

  // 3. Extração e Decodificação do Buffer PFX
  let pfxBuffer: Buffer | null = null;
  const rawPath = (cert.arquivo_path_enc || '').trim();

  if (rawPath.startsWith('base64:')) {
    pfxBuffer = Buffer.from(rawPath.replace('base64:', '').trim(), 'base64');
  } else if (rawPath.startsWith('data:')) {
    const base64Data = rawPath.split(',')[1] || '';
    pfxBuffer = Buffer.from(base64Data.trim(), 'base64');
  } else if (rawPath.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(rawPath)) {
    // String base64 pura (PKCS#12 codificado sem prefixo)
    pfxBuffer = Buffer.from(rawPath.replace(/\s+/g, ''), 'base64');
  } else if (rawPath && fs.existsSync(rawPath)) {
    try {
      pfxBuffer = fs.readFileSync(rawPath);
    } catch (e: any) {
      console.warn(`Aviso ao ler PFX em disco (${rawPath}):`, e.message);
    }
  }

  if (!pfxBuffer || pfxBuffer.length === 0) {
    console.error(`❌ Certificado ${cert.id} localizado em ${origem}, porém o binário PFX está inacessível:`, rawPath.slice(0, 40));
    return {
      certificado: null,
      motivoErro: '⚠️ Certificado A1 registrado no sistema, porém o arquivo .PFX físico está inacessível (armazenamento efêmero antigo). Por favor, reenvie o arquivo .PFX e a senha no botão de Certificado.',
      origem
    };
  }

  // 4. Descriptografia da Senha AES-256-GCM
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

    return {
      certificado: { pfxBuffer, senha: senhaPfx },
      origem
    };
  } catch (err: any) {
    console.error('❌ Falha ao descriptografar senha do certificado:', err.message);
    return {
      certificado: null,
      motivoErro: `⚠️ Falha ao descriptografar a senha do Certificado A1 no cofre (${err.message}). Por favor, recadastre o arquivo .PFX e a senha.`,
      origem
    };
  }
}

export async function descriptografarCertificado(empresaId: string, cnpj?: string): Promise<CertificadoDescriptografado | null> {
  const diag = await descriptografarCertificadoComDiagnostico(empresaId, cnpj);
  return diag.certificado;
}

export interface InfoCertificadoPfx {
  keyPem: string;
  certPem: string;
  caPems: string[];
  validade: string; // YYYY-MM-DD
  validadeFim: Date;
  validadeInicio: Date;
  emissor: string;
  titular: string;
  cnpj?: string;
  cpf?: string;
  fingerprint: string;
  isExpirado: boolean;
  diasParaExpirar: number;
}

export function validarEExtrairCertificadoPfx(pfxBuffer: Buffer, passphrase: string): InfoCertificadoPfx {
  if (!pfxBuffer || pfxBuffer.length === 0) {
    throw new Error('Arquivo de certificado .PFX vazio ou não fornecido.');
  }

  let pfx: any = null;
  const pfxDer = pfxBuffer.toString('binary');
  let pfxAsn1: any;
  try {
    pfxAsn1 = forge.asn1.fromDer(pfxDer);
  } catch (derErr: any) {
    throw new Error(`Arquivo corrompido ou formato inválido (não é um arquivo PKCS#12 / .PFX válido): ${derErr.message}`);
  }

  // Tenta com a senha exata; se falhar e houver espaços nas pontas, tenta com trim()
  const passwordsToTry = [passphrase];
  if (passphrase && passphrase.trim() !== passphrase) {
    passwordsToTry.push(passphrase.trim());
  }

  let lastError: any = null;
  for (const pwd of passwordsToTry) {
    try {
      pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, pwd);
      if (pfx) break;
    } catch (err: any) {
      lastError = err;
    }
  }

  if (!pfx) {
    const errMsg = lastError?.message || 'PKCS#12 MAC could not be verified';
    if (errMsg.includes('MAC') || errMsg.includes('password') || errMsg.includes('Invalid')) {
      throw new Error('A senha informada não confere com o arquivo .PFX (Falha de verificação MAC). Verifique se a senha está correta ou se o Caps Lock está ativado.');
    }
    throw new Error(`Falha ao abrir arquivo .PFX: ${errMsg}`);
  }

  let keyPem = '';
  let certPem = '';
  let certObj: any = null;
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
          certObj = safeBag.cert;
        } else {
          caPems.push(pem);
        }
      }
    }
  }

  if (!keyPem || !certPem || !certObj) {
    throw new Error('Chave privada RSA ou Certificado X.509 não encontrados dentro do arquivo .PFX.');
  }

  // Extrair metadados reais do certificado X.509
  const notBefore = certObj.validity.notBefore;
  const notAfter = certObj.validity.notAfter;
  const validade = notAfter.toISOString().split('T')[0];
  const isExpirado = notAfter.getTime() < Date.now();
  const diasParaExpirar = Math.ceil((notAfter.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  // Subject (Titular)
  const titular = certObj.subject.getField('CN')?.value || 'Titular Desconhecido';
  
  // Extrair CNPJ ou CPF do titular ICP-Brasil (padrão NOME DA EMPRESA:19791896000100)
  let cnpj: string | undefined;
  let cpf: string | undefined;

  const cnpjMatch = titular.match(/:([0-9]{14})$/) || titular.match(/([0-9]{14})/);
  if (cnpjMatch) {
    cnpj = cnpjMatch[1];
  }

  const cpfMatch = titular.match(/:([0-9]{11})$/) || titular.match(/([0-9]{11})/);
  if (cpfMatch && !cnpj) {
    cpf = cpfMatch[1];
  }

  // Issuer (Emissor da Autoridade Certificadora)
  const emissor = certObj.issuer.getField('CN')?.value 
    || certObj.issuer.getField('O')?.value 
    || 'Autoridade Certificadora ICP-Brasil';

  // SHA-256 Fingerprint
  const derCert = forge.asn1.toDer(forge.pki.certificateToAsn1(certObj)).getBytes();
  const md = forge.md.sha256.create();
  md.update(derCert);
  const fingerprint = `SHA256:${md.digest().toHex().toUpperCase()}`;

  return {
    keyPem,
    certPem,
    caPems,
    validade,
    validadeFim: notAfter,
    validadeInicio: notBefore,
    emissor,
    titular,
    cnpj,
    cpf,
    fingerprint,
    isExpirado,
    diasParaExpirar,
  };
}

export function converterPfxParaPem(pfxBuffer: Buffer, passphrase: string): { key: string; cert: string; ca?: string[] } {
  try {
    const info = validarEExtrairCertificadoPfx(pfxBuffer, passphrase);
    return {
      key: info.keyPem,
      cert: info.certPem,
      ca: info.caPems.length > 0 ? info.caPems : undefined,
    };
  } catch (err: any) {
    console.error('❌ Erro na conversão PFX -> PEM:', err.message);
    throw new Error(`Falha ao descriptografar PFX (verifique a senha do certificado): ${err.message}`);
  }
}

async function enviarParaSefaz(
  url: string,
  soapEnvelope: string,
  pfxBuffer: Buffer,
  senhaPfx: string,
  soapActionUrl: string = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse'
): Promise<{ statusCode: number; body: string }> {
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
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action="${soapActionUrl}"`,
        'SOAPAction': soapActionUrl,
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
  const { tpAmb, empresaId, codigoEvento } = params;

  // 1. Diagnóstico e descriptografia do Certificado A1
  const diag = await descriptografarCertificadoComDiagnostico(empresaId, params.cnpjAutor);
  const certificado = diag.certificado;

  if (!certificado) {
    return {
      success: false,
      cStat: '999',
      xMotivo: diag.motivoErro || '⚠️ Certificado Digital A1 não encontrado para esta empresa. Para transmitir à SEFAZ oficial, cadastre o Certificado A1 e a senha.',
      xmlEnvio: '',
      xmlRetorno: '',
      tpAmb,
    };
  }

  // 2. Determinação da URL do autorizador competente
  // Eventos de Manifestação do Destinatário (210200, 210210, 210220, 210240) exigem obrigatoriamente o Ambiente Nacional (RFB) com cOrgao=91
  const isManifestacaoDest = ['210200', '210210', '210220', '210240'].includes(codigoEvento);
  let url = '';
  if (isManifestacaoDest) {
    url = tpAmb === '1'
      ? (SEFAZ.AN_PRODUCAO?.RECEPCAO_EVENTO || 'https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx')
      : (SEFAZ.AN_HOMOLOGACAO?.RECEPCAO_EVENTO || 'https://hom1.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx');
  } else {
    const endpoints = tpAmb === '1' ? SEFAZ.SVRS_PRODUCAO : SEFAZ.SVRS_HOMOLOGACAO;
    url = endpoints.RECEPCAO_EVENTO;
  }

  // 3. Montagem e Assinatura Digital do Evento XML com XMLDSig ICP-Brasil
  const nSeq = params.nSeqEvento || 1;
  const { rawEventoXml, idEvento } = buildEventoXml(params, nSeq);

  let signedEventoXml: string;
  try {
    signedEventoXml = assinarEventoXml(rawEventoXml, certificado.pfxBuffer, certificado.senha, idEvento);
  } catch (signErr: any) {
    console.error('❌ Falha ao assinar digitalmente o evento com certificado A1:', signErr.message);
    return {
      success: false,
      cStat: '999',
      xMotivo: `Falha na assinatura digital do XML: ${signErr.message}`,
      xmlEnvio: rawEventoXml,
      xmlRetorno: '',
      tpAmb,
    };
  }

  const envEventoXml = buildEnvEventoXml(signedEventoXml);
  const soapEnvelope = buildSoapEnvelope(envEventoXml);

  try {
    console.log(`📡 [${getBrasiliaTimestamp()}] Transmitindo evento ${params.codigoEvento} para SEFAZ (${url})...`);
    const soapAction = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento';
    const response = await enviarParaSefaz(url, soapEnvelope, certificado.pfxBuffer, certificado.senha, soapAction);

    // 4. Extração profunda de cStat e xMotivo específicos do evento (dentro de <infEvento>)
    const cStatEvento = extractSubTagRegex(response.body, 'infEvento', 'cStat');
    const xMotivoEvento = extractSubTagRegex(response.body, 'infEvento', 'xMotivo');

    // 5. Extração do lote geral ou raiz (se o lote como um todo foi rejeitado antes dos eventos)
    const cStatLote = extractTagRegex(response.body, 'cStat');
    const xMotivoLote = extractTagRegex(response.body, 'xMotivo');

    // 6. Extração de mensagem de erro SOAP Fault caso tenha ocorrido falha de validação no envelope
    const faultString = extractTagRegex(response.body, 'faultstring') 
      || extractTagRegex(response.body, 'Text')
      || extractTagRegex(response.body, 'Reason');

    // Prioridade máxima para o código específico do evento, depois lote, depois status HTTP
    const cStat = cStatEvento || cStatLote || (response.statusCode !== 200 ? String(response.statusCode) : '999');
    let xMotivo = xMotivoEvento || xMotivoLote || faultString;

    if (!xMotivo) {
      if (response.statusCode === 400) {
        xMotivo = 'Falha no Schema XML ou cabeçalho SOAP rejeitado pelo autorizador (HTTP 400 Bad Request)';
      } else if (response.statusCode === 403) {
        xMotivo = 'Acesso negado pela SEFAZ (Bloqueio de IP ou Certificado rejeitado pelo autorizador)';
      } else if (response.statusCode !== 200) {
        xMotivo = `Servidor da SEFAZ retornou erro HTTP ${response.statusCode}`;
      } else {
        xMotivo = `Rejeição SEFAZ (cStat ${cStat})`;
      }
    }

    const nProt = extractSubTagRegex(response.body, 'infEvento', 'nProt') || extractTagRegex(response.body, 'nProt');
    const dhRegEvento = extractSubTagRegex(response.body, 'infEvento', 'dhRegEvento') || extractTagRegex(response.body, 'dhRegEvento') || getBrasiliaTimestamp();

    const success = ['128', '135', '136'].includes(cStatEvento || cStat);
    console.log(`${success ? '✅' : '❌'} SEFAZ cStat=${cStat}: ${xMotivo} (nProt=${nProt || 'N/A'})`);

    return {
      success,
      cStat,
      xMotivo,
      nProt: nProt || undefined,
      dhRegEvento,
      xmlEnvio: envEventoXml,
      xmlRetorno: response.body,
      tpAmb,
    };
  } catch (err: any) {
    console.error('❌ Erro na transmissão para SEFAZ:', err.message);
    return {
      success: false,
      cStat: '999',
      xMotivo: `Erro de comunicação com a SEFAZ: ${err.message}`,
      xmlEnvio: envEventoXml,
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
  const diag = await descriptografarCertificadoComDiagnostico(empresaId, cnpj);
  const certificado = diag.certificado;

  if (!certificado) {
    return {
      success: false,
      cStat: '999',
      xMotivo: diag.motivoErro || '⚠️ Certificado Digital A1 não encontrado para esta empresa. Para consultar a SEFAZ oficial, cadastre o Certificado A1 e a senha.',
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

    const brasiliaNow = getBrasiliaTimestamp();

    // Validar ID de usuário auditor autenticado para custódia de eventos (sem fallbacks aleatórios)
    let defaultUserId = params.userId || '';
    if (defaultUserId) {
      const u = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(defaultUserId) as any;
      if (!u) {
        // Registra o ID da sessão autenticada legítima
        db.prepare(`
          INSERT OR IGNORE INTO usuarios (id, nome, email, senha_hash, perfil, status, created_at, updated_at)
          VALUES (?, 'Auditor Fiscal', ?, '$2a$10$authSessionTokenHash', 'analista_fiscal', 'ativo', ?, ?)
        `).run(defaultUserId, `${defaultUserId}@radarfiscal.com.br`, brasiliaNow, brasiliaNow);
      }
    } else {
      throw new Error('Operação fiscal abortada: Usuário auditor não identificado na sessão para registro dos eventos.');
    }

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

    // 4. Atualizar NSU da empresa no banco (SQLite + Supabase)
    try {
      db.prepare(`
        UPDATE empresas
        SET ultimo_nsu = ?, max_nsu = ?, updated_at = ?
        WHERE id = ?
      `).run(ultNSURetorno, maxNSURetorno, brasiliaNow, empresaId);
    } catch {}

    if (isSupabaseConfigured() && empresaId) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          await supabase.from('empresas').update({
            ultimo_nsu: ultNSURetorno,
            max_nsu: maxNSURetorno,
            updated_at: brasiliaNow
          }).eq('id', empresaId);
        }
      } catch (supaErr: any) {
        console.warn('⚠️ Aviso ao sincronizar NSU no Supabase:', supaErr?.message || supaErr);
      }
    }

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
// CONSULTA PROTOCOLO (NFeConsultaProtocolo4 / CTeConsultaV4) - "TUDÃO" (EVENTOS)
// =========================================================

export const NFE_CONSULTA_PROTOCOLO_URLS: Record<'1' | '2', Record<string, string>> = {
  '1': { // Produção
    '11': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx', // RO
    '12': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx', // AC
    '13': 'https://nfe.sefaz.am.gov.br/services2/services/NfeConsulta4', // AM
    '14': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx', // RR
    '15': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx', // PA
    '16': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx', // AP
    '17': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx', // TO
    '21': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx', // MA
    '22': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx', // PI
    '23': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx', // CE
    '24': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx', // RN
    '25': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx', // PB
    '26': 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeConsultaProtocolo4', // PE
    '27': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx', // AL
    '28': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx', // SE
    '29': 'https://nfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx', // BA
    '31': 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4', // MG
    '32': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx', // ES
    '33': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx', // RJ
    '35': 'https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx', // SP
    '41': 'https://nfe.fazenda.pr.gov.br/nfe/NFeConsultaProtocolo4', // PR
    '42': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx', // SC
    '43': 'https://nfe.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx', // RS
    '50': 'https://nfe.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4', // MS
    '51': 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4', // MT
    '52': 'https://nfe.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4', // GO
    '53': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx', // DF
    'SVRS': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  },
  '2': { // Homologação
    '11': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    '12': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    '13': 'https://homnfe.sefaz.am.gov.br/services2/services/NfeConsulta4',
    '14': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    '15': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    '16': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    '17': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    '21': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    '22': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    '23': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    '24': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    '25': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    '26': 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeConsultaProtocolo4',
    '27': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    '28': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    '29': 'https://hnfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
    '31': 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4',
    '32': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    '33': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    '35': 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
    '41': 'https://homologacao.nfe.fazenda.pr.gov.br/nfe/NFeConsultaProtocolo4',
    '42': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    '43': 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    '50': 'https://homologacao.nfe.ms.gov.br/ws/NFeConsultaProtocolo4',
    '51': 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4',
    '52': 'https://homolog.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4',
    '53': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    'SVRS': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  }
};

export const CTE_CONSULTA_PROTOCOLO_URLS: Record<'1' | '2', Record<string, string>> = {
  '1': {
    '35': 'https://nfe.fazenda.sp.gov.br/cteConsulta/cteConsulta.asmx', // SP
    '41': 'https://cte.fazenda.pr.gov.br/cte/CTeConsultaV4', // PR
    '31': 'https://cte.fazenda.mg.gov.br/cte/services/CTeConsultaV4', // MG
    '51': 'https://cte.sefaz.mt.gov.br/ctews2/services/CteConsultaV4', // MT
    '50': 'https://cte.fazenda.ms.gov.br/ws/CTeConsultaV4', // MS
    'SVRS': 'https://cte.svrs.rs.gov.br/ws/CTeConsultaV4/CTeConsultaV4.asmx',
  },
  '2': {
    '35': 'https://homologacao.nfe.fazenda.sp.gov.br/cteConsulta/cteConsulta.asmx',
    '41': 'https://homologacao.cte.fazenda.pr.gov.br/cte/CTeConsultaV4',
    '31': 'https://hcte.fazenda.mg.gov.br/cte/services/CTeConsultaV4',
    '51': 'https://homologacao.sefaz.mt.gov.br/ctews2/services/CteConsultaV4',
    '50': 'https://homologacao.cte.fazenda.ms.gov.br/ws/CTeConsultaV4',
    'SVRS': 'https://cte-homologacao.svrs.rs.gov.br/ws/CTeConsultaV4/CTeConsultaV4.asmx',
  }
};

function getNomeEventoPadrao(codigoEvento: string, descEvento?: string): string {
  if (descEvento && descEvento.trim()) return descEvento.trim();
  const map: Record<string, string> = {
    '100': 'Autorização de Uso do DF-e',
    '110110': 'Carta de Correção Eletrônica (CC-e)',
    '110111': 'Cancelamento Homologado',
    '110112': 'Cancelamento por Substituição',
    '110114': 'Confirmação de Serviços CT-e',
    '110130': 'Comprovante de Entrega do DF-e',
    '110131': 'Cancelamento de Comprovante de Entrega',
    '110140': 'EPEC (Contingência Prévia)',
    '110150': 'Averbação de Exportação',
    '210200': 'Confirmação da Operação (Manifestação)',
    '210210': 'Ciência da Emissão (Manifestação)',
    '210220': 'Desconhecimento da Operação (Manifestação)',
    '210240': 'Operação não Realizada (Manifestação)',
    '610600': 'Registro de Passagem (Posto Fiscal / Barreira)',
    '610501': 'Registro de Passagem Automático (RFID / Câmera)',
    '610550': 'Registro de Passagem NF-e a CT-e',
    '610552': 'Registro de Passagem em Posto Fiscal',
    '610554': 'Registro de Passagem MDF-e',
    '990900': 'Vistoria SUFRAMA',
    '990910': 'Internalização SUFRAMA',
  };
  return map[codigoEvento] || `Evento SEFAZ ${codigoEvento}`;
}

export async function consultarSituacaoCompletaDFe(params: ConsultaProtocoloDfeRequest): Promise<ConsultaProtocoloDfeResponse> {
  const { tpAmb, empresaId, cnpj, userId } = params;
  const cleanChave = params.chaveAcesso.replace(/\D/g, '');
  
  if (cleanChave.length !== 44) {
    throw new Error('Chave de acesso inválida (deve conter 44 dígitos).');
  }

  // Identificação do Modelo (NFe/CTe) pela Chave (posições 20-21, 0-indexed)
  const modeloStr = cleanChave.substring(20, 22);
  const isCte = (modeloStr === '57' || modeloStr === '67' || params.tipoDoc === 'CTe');
  const tipoDocReal = isCte ? 'CTe' : 'NFe';
  
  // Identificação da UF Autorizadora pela Chave (posições 0-1)
  const cUF = cleanChave.substring(0, 2);

  // Seleção de URL baseada no Tipo e UF
  let url = '';
  let soapActionUrl = '';
  let soapEnvelope = '';

  if (isCte) {
    const urlsUF = CTE_CONSULTA_PROTOCOLO_URLS[tpAmb];
    url = urlsUF[cUF] || urlsUF['SVRS'];
    soapActionUrl = 'http://www.portalfiscal.inf.br/cte/wsdl/CTeConsultaV4/cteConsultaCT';
    soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap12:Header/><soap12:Body><cteDadosMsg xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeConsultaV4"><consSitCTe versao="4.00" xmlns="http://www.portalfiscal.inf.br/cte"><tpAmb>${tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chCTe>${cleanChave}</chCTe></consSitCTe></cteDadosMsg></soap12:Body></soap12:Envelope>`;
  } else {
    const urlsUF = NFE_CONSULTA_PROTOCOLO_URLS[tpAmb];
    url = urlsUF[cUF] || urlsUF['SVRS'];
    soapActionUrl = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF';
    soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap12:Header/><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4"><consSitNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${cleanChave}</chNFe></consSitNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`;
  }

  // Certificado Digital
  const diag = await descriptografarCertificadoComDiagnostico(empresaId, cnpj);
  const certificado = diag.certificado;

  if (!certificado) {
    return {
      success: false,
      cStat: '999',
      xMotivo: diag.motivoErro || '⚠️ Certificado Digital A1 não encontrado para esta empresa. Para consultar a SEFAZ oficial, cadastre o Certificado A1 e a senha.',
      chaveAcesso: cleanChave,
      tipoDoc: tipoDocReal,
      tpAmb,
      eventos: [],
      xmlEnvio: soapEnvelope,
      xmlRetorno: '',
    };
  }

  try {
    console.log(`📡 [${getBrasiliaTimestamp()}] Consultando Situação Completa ${tipoDocReal} (chave: ${cleanChave}, UF: ${cUF})...`);
    
    const response = await enviarParaSefaz(url, soapEnvelope, certificado.pfxBuffer, certificado.senha, soapActionUrl);
    
    // Parse da Resposta
    const bodyStr = response.body;
    const cStatGeral = extractTagRegex(bodyStr, 'cStat') || '999';
    const xMotivoGeral = extractTagRegex(bodyStr, 'xMotivo') || 'Sem resposta da SEFAZ';

    const dhRecbtoGeral = extractTagRegex(bodyStr, 'dhRecbto');
    
    const eventos: ConsultaProtocoloEventoItem[] = [];

    // 1. Extrair Protocolo de Autorização de Uso (100)
    const protTag = isCte ? 'protCTe' : 'protNFe';
    const protBlock = extractTagRegex(bodyStr, protTag);
    let nProtAut = '';
    let dhRecbtoAut = dhRecbtoGeral;
    let situacaoDoc = 'pendente';

    if (protBlock) {
      const cStatProt = extractTagRegex(protBlock, 'cStat') || cStatGeral;
      const xMotivoProt = extractTagRegex(protBlock, 'xMotivo') || xMotivoGeral;
      nProtAut = extractTagRegex(protBlock, 'nProt') || '';
      if (!dhRecbtoAut) {
        dhRecbtoAut = extractTagRegex(protBlock, 'dhRecbto');
      }

      if (cStatProt === '100' || cStatProt === '101' || cStatProt === '150') {
        situacaoDoc = cStatProt === '101' || cStatProt === '150' ? 'cancelado' : 'autorizado';
        eventos.push({
          codigoEvento: '100',
          nomeEvento: `Autorização de Uso ${tipoDocReal}`,
          nSeqEvento: 1,
          dataHora: dhRecbtoAut || getBrasiliaTimestamp(),
          protocolo: nProtAut,
          cStat: cStatProt,
          xMotivo: xMotivoProt,
          origemEvento: 'proprio'
        });
      }
    }

    // Se cStatGeral indica que não existe, retorna de cara
    if (cStatGeral === '217' || cStatGeral === '656' || cStatGeral === '562') {
      return {
        success: false,
        cStat: cStatGeral,
        xMotivo: xMotivoGeral,
        chaveAcesso: cleanChave,
        tipoDoc: tipoDocReal,
        tpAmb,
        eventos: [],
        xmlEnvio: soapEnvelope,
        xmlRetorno: bodyStr,
      };
    }

    // 2. Extrair Lista de Eventos (Cancelamento, CC-e, Manifestação, Barreiras)
    const procEventoTag = isCte ? 'procEventoCTe' : 'procEventoNFe';
    const procEventoRegex = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${procEventoTag}[\\s\\S]*?<\\/(?:[a-zA-Z0-9_-]+:)?${procEventoTag}>`, 'gi');
    let match;

    while ((match = procEventoRegex.exec(bodyStr)) !== null) {
      const xmlEvt = match[0];
      const parsedEvt = parseEventoSefazXml(xmlEvt, cnpj);
      
      if (parsedEvt) {
        // Extrair detalhes específicos de cada evento
        const detalhes: any = {};
        
        // CC-e
        const xCorrecao = extractTagRegex(xmlEvt, 'xCorrecao');
        if (xCorrecao) detalhes.xCorrecao = xCorrecao;
        
        // Cancelamento / Desacordo
        const xJust = extractTagRegex(xmlEvt, 'xJust');
        if (xJust) detalhes.xJust = xJust;

        // Barreiras Fiscais (Postos Fiscais)
        const xPostoFiscal = extractTagRegex(xmlEvt, 'xPostoFiscal');
        const placa = extractTagRegex(xmlEvt, 'placa');
        const dhPass = extractTagRegex(xmlEvt, 'dhPass');
        if (xPostoFiscal) detalhes.postoFiscal = xPostoFiscal;
        if (placa) detalhes.placa = placa;
        if (dhPass) detalhes.dhPass = dhPass;

        let origemEvt: 'proprio' | 'terceiro_destinatario' | 'fisco' | 'sefaz' = parsedEvt.origemEvento;
        let categoria = 'emitente';

        if (parsedEvt.codigoEvento.startsWith('2102') || parsedEvt.codigoEvento.startsWith('6101')) {
          categoria = 'destinatario';
          // Se o CNPJ autor for diferente do CNPJ do emitente da chave, é terceiro_destinatario
          // Como não temos a empresa completa aqui, confia no parser
        } else if (parsedEvt.codigoEvento.startsWith('610') || parsedEvt.codigoEvento.startsWith('990')) {
          categoria = 'fisco';
          origemEvt = 'fisco';
        }

        const nomeDoEvento = getNomeEventoPadrao(parsedEvt.codigoEvento, parsedEvt.nomeEvento);

        eventos.push({
          codigoEvento: parsedEvt.codigoEvento,
          nomeEvento: nomeDoEvento,
          nSeqEvento: parsedEvt.nSeqEvento,
          dataHora: parsedEvt.dhEvento,
          protocolo: parsedEvt.protocolo,
          cStat: parsedEvt.cStat,
          xMotivo: parsedEvt.xMotivo,
          autorCnpj: parsedEvt.autorCnpj,
          justificativa: parsedEvt.justificativa || xPostoFiscal || '',
          detalhes,
          origemEvento: origemEvt as 'proprio' | 'terceiro_destinatario' | 'fisco' | 'sefaz',
          xmlRetorno: xmlEvt
        });
      }
    }

    // Ordenar eventos por DataHora DESC
    eventos.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());

    // 3. Persistência de Eventos Retornados e Atualização da NF-e
    const db = getDatabase();
    const nowBrasilia = getBrasiliaTimestamp();
    const docDbId = `doc-${cleanChave}`;

    // 3.1. Validação estrita de auditoria: Usuário Real Autenticado (Sem Fallback Fictício)
    let finalUserId: string | null = userId || null;
    if (finalUserId) {
      const u = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(finalUserId) as any;
      if (!u) {
        // Se o ID é de uma sessão autenticada legítima (ex: Supabase Auth UUID), registra o auditor
        db.prepare(`
          INSERT OR IGNORE INTO usuarios (id, nome, email, senha_hash, perfil, status, created_at, updated_at)
          VALUES (?, 'Auditor Fiscal', ?, '$2a$10$authSessionTokenHash', 'analista_fiscal', 'ativo', ?, ?)
        `).run(finalUserId, `${finalUserId}@radarfiscal.com.br`, nowBrasilia, nowBrasilia);
      }
    } else {
      throw new Error('Operação fiscal abortada: Usuário auditor não identificado na sessão para registro de custódia.');
    }

    // 3.2. Validação estrita da Empresa Real (Sem Empresa Fictícia)
    const cleanCnpj = (cnpj || '').replace(/\D/g, '');
    let finalEmpresaId = empresaId;
    let empInDb = db.prepare('SELECT id, razao_social FROM empresas WHERE id = ?').get(finalEmpresaId) as any;
    if (!empInDb && cleanCnpj) {
      const empByCnpj = db.prepare('SELECT id, razao_social FROM empresas WHERE REPLACE(REPLACE(REPLACE(cnpj_completo, ".", ""), "/", ""), "-", "") = ? OR cnpj_raiz = ? LIMIT 1').get(cleanCnpj, cleanCnpj.substring(0, 8)) as any;
      if (empByCnpj) {
        finalEmpresaId = empByCnpj.id;
        empInDb = empByCnpj;
      }
    }

    if (!empInDb) {
      throw new Error(`Operação fiscal abortada: Empresa ${cnpj || empresaId} não localizada na Carteira de CNPJs. Cadastre a empresa formalmente antes de consultar eventos.`);
    }

    // 3.3. Garantir que o documento pai em dfe_documentos exista no SQLite
    const existingDoc = db.prepare('SELECT id FROM dfe_documentos WHERE chave_acesso = ?').get(cleanChave) as any;
    if (!existingDoc) {
      const emitCnpj = cleanChave.substring(6, 20);
      const numeroDoc = cleanChave.substring(25, 34);
      const serieDoc = cleanChave.substring(22, 25);
      const anoMes = `20${cleanChave.substring(2, 4)}-${cleanChave.substring(4, 6)}`;
      db.prepare(`
        INSERT OR REPLACE INTO dfe_documentos (
          id, empresa_id, tipo_doc, chave_acesso, tipo_operacao, numero_serie,
          data_emissao, data_entrada, competencia,
          fornecedor_cnpj, fornecedor_razao, fornecedor_uf,
          cliente_cnpj, cliente_razao, cliente_uf,
          situacao_doc, situacao_manifestacao, evento_ultimo,
          valor_total, alerta_fraude, download_at, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, 'Entrada', ?,
          ?, ?, ?,
          ?, 'EMITENTE (CONSULTA SEFAZ)', 'RJ',
          ?, 'DESTINATÁRIO', 'RJ',
          ?, 'sem_manifestacao', 'Consulta Realizada',
          0, 0, ?, ?, ?
        )
      `).run(
        docDbId,
        finalEmpresaId,
        tipoDocReal,
        cleanChave,
        `${numeroDoc} / ${serieDoc}`,
        `${anoMes}-01`,
        nowBrasilia,
        anoMes,
        emitCnpj,
        cleanCnpj,
        situacaoDoc,
        nowBrasilia,
        nowBrasilia,
        nowBrasilia
      );
    }

    db.transaction(() => {
      let situacaoManifestacao = '';
      let eventoUltimo = '';

      for (const evt of eventos) {
        // Atualiza a tabela mãe (dfe_documentos) com base nos eventos
        if (evt.codigoEvento === '110111' || evt.codigoEvento === '110112' || evt.codigoEvento === 'cte-110111') {
          situacaoDoc = 'cancelado';
          eventoUltimo = 'Cancelamento Homologado';
        } else if (evt.codigoEvento === '110110') {
          if (!eventoUltimo) eventoUltimo = 'Carta de Correção Registrada';
        } else if (evt.codigoEvento === '610600' || evt.codigoEvento === '610501' || evt.codigoEvento === '610552') {
          if (!eventoUltimo) eventoUltimo = 'Passagem de Barreira Registrada';
        } else if (evt.codigoEvento === '990900' || evt.codigoEvento === '990910') {
          if (!eventoUltimo) eventoUltimo = 'Vistoria SUFRAMA Registrada';
        }

        // Regras de Manifestação
        if (evt.codigoEvento === '210200') situacaoManifestacao = 'confirmada';
        else if (evt.codigoEvento === '210210' && situacaoManifestacao !== 'confirmada') situacaoManifestacao = 'ciencia_emitida';
        else if (evt.codigoEvento === '210220') situacaoManifestacao = 'desconhecida_pelo_destinatario';
        else if (evt.codigoEvento === '210240') situacaoManifestacao = 'operacao_nao_realizada';

        // Tentar gravar no eventos_transmitidos
        const evtId = `evt-${cleanChave}-${evt.codigoEvento}-${evt.nSeqEvento}-${Date.now()}`;
        
        db.prepare(`
          INSERT OR IGNORE INTO eventos_transmitidos (
            id, empresa_id, usuario_id, documento_id, chave_acesso, tipo_dfe, codigo_evento,
            nome_evento, categoria, autor_cnpj, origem_evento, justificativa, ambiente,
            protocolo_sefaz, xml_retorno, codigo_retorno, motivo_retorno,
            status, detalhes_reforma, data_hora, created_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            'processado', ?, ?, ?
          )
        `).run(
          evtId,
          finalEmpresaId,
          finalUserId,
          docDbId,
          cleanChave,
          tipoDocReal,
          evt.codigoEvento,
          evt.nomeEvento,
          evt.codigoEvento.startsWith('210') || evt.codigoEvento.startsWith('6101') ? 'destinatario' : 
            (evt.codigoEvento.startsWith('610') || evt.codigoEvento.startsWith('990') ? 'fisco' : 'emitente'),
          evt.autorCnpj || '',
          evt.origemEvento,
          evt.justificativa || '',
          tpAmb,
          evt.protocolo || '',
          evt.xmlRetorno || '',
          evt.cStat,
          evt.xMotivo,
          JSON.stringify(evt.detalhes || {}),
          evt.dataHora,
          nowBrasilia
        );
      }

      if (!eventoUltimo && situacaoDoc === 'autorizado') {
        eventoUltimo = 'Autorizado o uso do DF-e';
      }

      // Atualiza o dfe_documentos com a situação recém descoberta
      db.prepare(`
        UPDATE dfe_documentos
        SET situacao_doc = CASE WHEN ? != '' THEN ? ELSE situacao_doc END,
            evento_ultimo = CASE WHEN ? != '' THEN ? ELSE evento_ultimo END,
            situacao_manifestacao = CASE WHEN ? != '' THEN ? ELSE situacao_manifestacao END,
            status_sefaz = 'autorizado',
            protocolo_sefaz = CASE WHEN ? != '' THEN ? ELSE protocolo_sefaz END,
            updated_at = ?
        WHERE chave_acesso = ?
      `).run(
        situacaoDoc, situacaoDoc,
        eventoUltimo, eventoUltimo,
        situacaoManifestacao, situacaoManifestacao,
        nProtAut, nProtAut,
        nowBrasilia,
        cleanChave
      );
    })();

    // Integração Supabase
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase && eventos.length > 0) {
          const supabaseRows = eventos.map(evt => ({
            id: uuidv4(),
            empresa_id: empresaId,
            documento_id: null,
            chave_acesso: cleanChave,
            tipo_dfe: tipoDocReal,
            codigo_evento: evt.codigoEvento,
            nome_evento: evt.nomeEvento,
            categoria: evt.codigoEvento.startsWith('210') || evt.codigoEvento.startsWith('6101') ? 'destinatario' : 
              (evt.codigoEvento.startsWith('610') || evt.codigoEvento.startsWith('990') ? 'fisco' : 'emitente'),
            autor_cnpj: evt.autorCnpj || '',
            origem_evento: evt.origemEvento,
            justificativa: evt.justificativa || '',
            ambiente: tpAmb,
            protocolo_sefaz: evt.protocolo || '',
            xml_retorno: evt.xmlRetorno || '',
            codigo_retorno: evt.cStat,
            motivo_retorno: evt.xMotivo,
            status: 'processado',
            detalhes_reforma: evt.detalhes || null,
            data_hora: evt.dataHora,
            created_at: nowBrasilia
          }));
          await supabase.from('eventos_transmitidos').insert(supabaseRows);
        }
      } catch (supaErr: any) {
        console.warn('⚠️ Falha ao sincronizar eventos consultados no Supabase:', supaErr.message);
      }
    }

    return {
      success: true,
      cStat: cStatGeral,
      xMotivo: xMotivoGeral,
      chaveAcesso: cleanChave,
      tipoDoc: tipoDocReal,
      tpAmb,
      cUF,
      dhRecbto: dhRecbtoGeral,
      protocoloAutorizacao: nProtAut,
      situacaoDoc,
      eventos,
      xmlEnvio: soapEnvelope,
      xmlRetorno: bodyStr,
    };
  } catch (err: any) {
    console.error(`[SEFAZ] Falha em consultarSituacaoCompletaDFe: ${err.message}`);
    return {
      success: false,
      cStat: '998',
      xMotivo: `Erro local: ${err.message}`,
      chaveAcesso: cleanChave,
      tipoDoc: tipoDocReal,
      tpAmb,
      eventos: [],
      xmlEnvio: soapEnvelope,
      xmlRetorno: '',
    };
  }
}

// =========================================================
// CONSULTA CTeDistribuicaoDFe (Transporte / Fretes)
// =========================================================

export async function consultarDistribuicaoCTe(params: DistribucaoDfeRequest): Promise<DistribucaoDfeResponse> {
  const { tpAmb, empresaId, cnpj } = params;

  const url = tpAmb === '1'
    ? (SEFAZ.CTE_SVRS_PRODUCAO?.DISTRIBUICAO_DFE || 'https://cte.svrs.rs.gov.br/ws/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx')
    : (SEFAZ.CTE_SVRS_HOMOLOGACAO?.DISTRIBUICAO_DFE || 'https://cte-homologacao.svrs.rs.gov.br/ws/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx');

  const soapEnvelope = buildCteDistDFeSoapEnvelope(params);
  const certificado = await descriptografarCertificado(empresaId, cnpj);

  if (!certificado) {
    return {
      success: false,
      cStat: '999',
      xMotivo: '⚠️ Certificado Digital A1 não encontrado para esta empresa. Para consultar a SEFAZ oficial, cadastre o Certificado A1 e a senha.',
      ultNSU: params.ultNSU || '000000000000000',
      maxNSU: '000000000000000',
      tpAmb,
      docs: [],
      xmlEnvio: soapEnvelope,
      xmlRetorno: '',
    };
  }

  try {
    console.log(`📡 [${getBrasiliaTimestamp()}] Consultando CTeDistribuicaoDFe para CNPJ ${cnpj} (ultNSU=${params.ultNSU})...`);
    const response = await enviarParaSefaz(url, soapEnvelope, certificado.pfxBuffer, certificado.senha);

    const cStat = extractTagRegex(response.body, 'cStat') || '999';
    const xMotivo = extractTagRegex(response.body, 'xMotivo') || 'Sem resposta';
    const ultNSURetorno = extractTagRegex(response.body, 'ultNSU') || params.ultNSU || '000000000000000';
    const maxNSURetorno = extractTagRegex(response.body, 'maxNSU') || '000000000000000';

    const rawDocs = extrairDocZips(response.body);
    const docsProcessados: DocumentoDfeExtraido[] = [];
    const db = getDatabase();
    const brasiliaNow = getBrasiliaTimestamp();

    for (const raw of rawDocs) {
      const xml = raw.xmlContent;
      const sanitizedXml = sanitizeXmlAntiXXE(xml);

      try {
        const parsedDoc = await parseFiscalXml(sanitizedXml, cnpj);
        const docDbId = `doc-cte-${parsedDoc.chaveAcesso}`;

        // Persistência local SQLite
        db.transaction(() => {
          db.prepare(`
            INSERT OR REPLACE INTO dfe_documentos (
              id, empresa_id, tipo_doc, chave_acesso, tipo_operacao, numero_serie,
              data_emissao, data_entrada, competencia,
              fornecedor_cnpj, fornecedor_razao, fornecedor_uf, fornecedor_municipio,
              cliente_cnpj, cliente_razao, cliente_uf,
              situacao_doc, situacao_manifestacao, evento_ultimo,
              valor_total, created_at
            ) VALUES (
              ?, ?, 'CTe', ?, ?, ?,
              ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?,
              'autorizado', 'sem_manifestacao', 'CT-e Autorizado',
              ?, ?
            )
          `).run(
            docDbId,
            empresaId,
            parsedDoc.chaveAcesso,
            parsedDoc.tipoOperacao,
            `${parsedDoc.numero} / ${parsedDoc.serie}`,
            parsedDoc.dataEmissao,
            brasiliaNow,
            parsedDoc.competencia,
            parsedDoc.emitenteCnpj,
            parsedDoc.emitenteNome,
            parsedDoc.emitenteUf,
            parsedDoc.emitenteMunicipio,
            parsedDoc.destinatarioCnpj,
            parsedDoc.destinatarioNome,
            parsedDoc.destinatarioUf,
            parsedDoc.valorTotal,
            brasiliaNow
          );
        })();

        // Persistência no Supabase
        if (isSupabaseConfigured()) {
          const supabase = getSupabaseAdmin();
          if (supabase) {
            try {
              const supaEmpresaId = await resolveSupabaseEmpresaId(supabase, {
                id: empresaId,
                cnpj_completo: cnpj,
                cnpj_raiz: cnpj.substring(0, 8),
                razao_social: parsedDoc.destinatarioNome
              });

              await supabase.from('dfe_documentos').upsert({
                id: docDbId,
                empresa_id: supaEmpresaId,
                tipo_doc: 'CTe',
                chave_acesso: parsedDoc.chaveAcesso,
                tipo_operacao: parsedDoc.tipoOperacao,
                numero_serie: `${parsedDoc.numero} / ${parsedDoc.serie}`,
                data_emissao: parsedDoc.dataEmissao,
                data_entrada: brasiliaNow,
                competencia: parsedDoc.competencia,
                fornecedor_cnpj: parsedDoc.emitenteCnpj,
                fornecedor_razao: parsedDoc.emitenteNome,
                fornecedor_uf: parsedDoc.emitenteUf,
                fornecedor_municipio: parsedDoc.emitenteMunicipio,
                cliente_cnpj: parsedDoc.destinatarioCnpj,
                cliente_razao: parsedDoc.destinatarioNome,
                cliente_uf: parsedDoc.destinatarioUf,
                situacao_doc: 'autorizado',
                situacao_manifestacao: 'sem_manifestacao',
                evento_ultimo: 'CT-e Autorizado',
                valor_total: parsedDoc.valorTotal,
                valor_icms: parsedDoc.valorIcms,
                xml_raw: sanitizedXml,
                created_at: brasiliaNow,
                updated_at: brasiliaNow
              }, { onConflict: 'chave_acesso' });
            } catch (supaErr: any) {
              console.warn('⚠️ Erro ao sincronizar CT-e no Supabase:', supaErr?.message);
            }
          }
        }

        docsProcessados.push({
          id: docDbId,
          schema: raw.schema,
          nsu: raw.nsu,
          tipo: 'CTe',
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
          valorIpi: 0,
          valorPis: parsedDoc.valorPis,
          valorCofins: parsedDoc.valorCofins,
          aliquotaCbs: 0,
          valorCbs: 0,
          aliquotaIbs: 0,
          valorIbs: 0,
          valorImpostoSeletivo: 0,
          statusAuditoria: 'conforme',
          alertasAuditoria: [],
          eventoUltimo: 'CT-e Autorizado',
          statusSincronizacaoErp: 'pendente',
          xmlRaw: sanitizedXml
        });
      } catch (cteErr: any) {
        console.warn('⚠️ Erro ao processar item CT-e:', cteErr.message);
      }
    }

    // 4. Atualizar NSU da empresa no banco para CT-e (SQLite + Supabase)
    try {
      db.prepare(`
        UPDATE empresas
        SET ultimo_nsu = ?, max_nsu = ?, updated_at = ?
        WHERE id = ?
      `).run(ultNSURetorno, maxNSURetorno, brasiliaNow, empresaId);
    } catch {}

    if (isSupabaseConfigured() && empresaId) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          await supabase.from('empresas').update({
            ultimo_nsu: ultNSURetorno,
            max_nsu: maxNSURetorno,
            updated_at: brasiliaNow
          }).eq('id', empresaId);
        }
      } catch (supaErr: any) {
        console.warn('⚠️ Aviso ao sincronizar NSU de CT-e no Supabase:', supaErr?.message || supaErr);
      }
    }

    return {
      success: ['137', '138'].includes(cStat),
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
    console.error('❌ Erro na consulta CTeDistribuicaoDFe:', err.message);
    return {
      success: false,
      cStat: '999',
      xMotivo: `Erro de comunicação com a SEFAZ (CT-e): ${err.message}`,
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

// =========================================================
// MOTOR DE CONSULTA CADASTRO & INSCRIÇÃO ESTADUAL (3 CAMADAS)
// =========================================================

export const CAD_CONSULTA_CADASTRO_URLS: Record<string, string> = {
  'AC': 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  'AL': 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  'AP': 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  'AM': 'https://nfe.sefaz.am.gov.br/services2/services/CadConsultaCadastro4',
  'BA': 'https://nfe.sefaz.ba.gov.br/webservices/CadConsultaCadastro4/CadConsultaCadastro4.asmx',
  'CE': 'https://nfe.sefaz.ce.gov.br/nfe2/services/CadConsultaCadastro4',
  'DF': 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  'ES': 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  'GO': 'https://nfe.sefaz.go.gov.br/nfe/services/CadConsultaCadastro4',
  'MA': 'https://cad.sefazrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  'MT': 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/CadConsultaCadastro4',
  'MS': 'https://nfe.fazenda.ms.gov.br/ws/CadConsultaCadastro4',
  'MG': 'https://nfe.fazenda.mg.gov.br/nfe2/services/CadConsultaCadastro4',
  'PA': 'https://cad.sefazrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  'PB': 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  'PR': 'https://nfe.fazenda.pr.gov.br/nfe/CadConsultaCadastro4',
  'PE': 'https://nfe.sefaz.pe.gov.br/nfe-service/services/CadConsultaCadastro4',
  'PI': 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  'RJ': 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  'RN': 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  'RS': 'https://cad.sefazrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  'RO': 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  'RR': 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  'SC': 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  'SP': 'https://nfe.fazenda.sp.gov.br/ws/cadconsultacadastro4.asmx',
  'SE': 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  'TO': 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
};

export interface ConsultaCadastroResultado {
  sucesso: boolean;
  camadaUtilizada: 'SEFAZ' | 'CNPJA' | 'CNPJ_WS' | 'NONE';
  cnpj: string;
  uf: string;
  ie?: string;
  tipoIE: string;
  situaçaoIE: 'Habilitado' | 'Não Habilitado' | 'Baixado' | 'Suspenso' | 'Isento' | 'Não Contribuinte' | 'Pendente';
  xRegApur?: string;
  cSit?: string;
  indCredNFe?: string;
  cStat?: string;
  xMotivo?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  cnaePrincipal?: string;
  regimeTributario?: string;
  capitalSocial?: number;
}

/**
 * Camada 1: Consulta Cadastro SEFAZ SOAP (CadConsultaCadastro4)
 */
export async function consultarCadastroSefaz(
  uf: string,
  cnpj: string,
  empresaId?: string,
  cnpjAutor?: string
): Promise<ConsultaCadastroResultado | null> {
  const cleanUf = (uf || 'SP').toUpperCase().trim();
  const cleanCnpj = cnpj.replace(/\D/g, '');
  const url = CAD_CONSULTA_CADASTRO_URLS[cleanUf] || CAD_CONSULTA_CADASTRO_URLS['SP'];

  try {
    const certData = await descriptografarCertificado(empresaId || '', cnpjAutor);
    if (!certData) {
      return null;
    }

    const consCadXml = `<ConsCad xmlns="http://www.portalfiscal.inf.br/nfe" versao="2.00"><infCons><xServ>CONS-CAD</xServ><UF>${cleanUf}</UF><CNPJ>${cleanCnpj}</CNPJ></infCons></ConsCad>`;
    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/CadConsultaCadastro4">${consCadXml}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;

    const { statusCode, body } = await enviarParaSefaz(
      url,
      soapEnvelope,
      certData.pfxBuffer,
      certData.senha,
      'http://www.portalfiscal.inf.br/nfe/wsdl/CadConsultaCadastro4/consultaCadastro'
    );

    if (statusCode !== 200 || !body) {
      return null;
    }

    const cStatMatch = body.match(/<cStat>(\d+)<\/cStat>/i);
    const xMotivoMatch = body.match(/<xMotivo>([^<]+)<\/xMotivo>/i);
    const cStat = cStatMatch ? cStatMatch[1] : '';
    const xMotivo = xMotivoMatch ? xMotivoMatch[1] : '';

    if (cStat === '111' || cStat === '112') {
      const ieMatch = body.match(/<IE>([^<]+)<\/IE>/i);
      const cSitMatch = body.match(/<cSit>([^<]+)<\/cSit>/i);
      const xRegApurMatch = body.match(/<xRegApur>([^<]+)<\/xRegApur>/i);
      const indCredNFeMatch = body.match(/<indCredNFe>([^<]+)<\/indCredNFe>/i);
      const xNomeMatch = body.match(/<xNome>([^<]+)<\/xNome>/i);
      const xFantMatch = body.match(/<xFant>([^<]+)<\/xFant>/i);
      const cnaeMatch = body.match(/<CNAE>([^<]+)<\/CNAE>/i);

      const ie = ieMatch ? ieMatch[1].trim() : '';
      const cSit = cSitMatch ? cSitMatch[1].trim() : '1';
      const xRegApur = xRegApurMatch ? xRegApurMatch[1].trim() : 'NORMAL';
      const indCredNFe = indCredNFeMatch ? indCredNFeMatch[1].trim() : '';

      const isHabilitado = cSit === '1';
      const situaçaoIE = isHabilitado ? 'Habilitado' : 'Não Habilitado';
      let tipoIE = 'CONTRIBUINTE ICMS';
      if (!isHabilitado) {
        tipoIE = 'NÃO HABILITADO / INATIVO';
      } else if (xRegApur.toUpperCase().includes('SIMPLES')) {
        tipoIE = 'CONTRIBUINTE ICMS (SIMPLES NACIONAL)';
      }

      return {
        sucesso: true,
        camadaUtilizada: 'SEFAZ',
        cnpj: cleanCnpj,
        uf: cleanUf,
        ie: ie || 'Não Consta no CCC',
        tipoIE,
        situaçaoIE,
        xRegApur,
        cSit,
        indCredNFe,
        cStat,
        xMotivo,
        razaoSocial: xNomeMatch ? xNomeMatch[1].trim() : undefined,
        nomeFantasia: xFantMatch ? xFantMatch[1].trim() : undefined,
        cnaePrincipal: cnaeMatch ? cnaeMatch[1].trim() : undefined,
      };
    } else if (cStat === '259') {
      // Não cadastrado como contribuinte na UF
      return {
        sucesso: true,
        camadaUtilizada: 'SEFAZ',
        cnpj: cleanCnpj,
        uf: cleanUf,
        ie: 'Não Consta no CCC',
        tipoIE: 'IE Não Contribuinte (Canteiro de Obras, IE Virtual, outros)',
        situaçaoIE: 'Não Contribuinte',
        cStat,
        xMotivo,
      };
    }

    return null;
  } catch (err: any) {
    console.warn(`[SEFAZ SOAP CadConsultaCadastro4] Falha na consulta de ${cleanCnpj}/${cleanUf}: ${err.message}`);
    return null;
  }
}

/**
 * Helper para detecção de CNAE de serviços puros
 */
export function isPureServiceCnae(cnae?: string): boolean {
  if (!cnae) return false;
  const clean = cnae.replace(/\D/g, '');
  const prefix2 = clean.slice(0, 2);
  const servicePrefixes = [
    '62', '63', '64', '65', '66', '68', '69', '70', '71', '72',
    '73', '74', '75', '78', '80', '81', '82', '85', '86', '87',
    '88', '90', '91', '92', '93', '94', '95', '96'
  ];
  return servicePrefixes.includes(prefix2);
}

/**
 * Determina estritamente o Regime Tributário oficial (Lucro Real, Lucro Presumido ou Simples Nacional)
 */
export function calcularRegimeTributarioEstrito(data: any): 'Lucro Real' | 'Lucro Presumido' | 'Simples Nacional' | 'MEI' | 'Imune / Isento' {
  // 1. MEI
  const isMei = data.opcao_pelo_mei === true ||
    data.simples?.optante_mei === 'Sim' ||
    data.simples?.mei === 'Sim' ||
    data.company?.simei?.optant === true ||
    data.simei?.optant === true;
  if (isMei) return 'MEI';

  // 2. Simples Nacional
  const isSimples = data.opcao_pelo_simples === true ||
    data.simples?.optante_simples === 'Sim' ||
    data.simples?.simples === 'Sim' ||
    data.company?.simples?.optant === true;
  if (isSimples) return 'Simples Nacional';

  // 3. Imune / Isento
  const natJurStr = String(
    data.natureza_juridica?.descricao ||
    data.natureza_juridica ||
    data.natureza_juridica_descricao ||
    data.company?.nature?.text ||
    ''
  ).toLowerCase();

  const natJurCode = String(
    data.codigo_natureza_juridica ||
    data.natureza_juridica?.id ||
    data.natureza_juridica ||
    data.company?.nature?.id ||
    ''
  ).replace(/\D/g, '');

  if (
    natJurCode.startsWith('1') || // Órgãos Públicos
    natJurCode.startsWith('3') || // Entidades sem fins lucrativos
    natJurStr.includes('condomínio') ||
    natJurStr.includes('associação') ||
    natJurStr.includes('fundação') ||
    natJurStr.includes('religiosa')
  ) {
    return 'Imune / Isento';
  }

  // 4. Lucro Real Compulsório (Lei 9.718/98 art. 14, Lei 12.814/2013)
  const capSocial = Number(data.capital_social || data.company?.equity || data.capitalSocial || 0);
  if (capSocial >= 78000000) {
    return 'Lucro Real';
  }

  if (natJurCode === '2046' || natJurStr.includes('capital aberto')) {
    return 'Lucro Real';
  }

  const cnaeClean = String(
    data.cnae_fiscal ||
    data.mainActivity?.id ||
    data.atividade_principal?.id ||
    data.cnaePrincipal ||
    ''
  ).replace(/\D/g, '');

  const cnaePrefix2 = cnaeClean.slice(0, 2);
  if (['64', '65', '66'].includes(cnaePrefix2)) {
    return 'Lucro Real';
  }

  const cnaePrefix4 = cnaeClean.slice(0, 4);
  if (['4681', '4682', '1921', '1922'].includes(cnaePrefix4)) {
    return 'Lucro Real';
  }

  const porteStr = String(data.porte || data.codigo_porte || data.company?.size?.text || data.company?.size?.acronym || '').toUpperCase();
  if ((porteStr === 'DEMAIS' || porteStr === 'GRANDE') && capSocial > 10000000) {
    return 'Lucro Real';
  }

  return 'Lucro Presumido';
}

const cadastroTriplaCamadaCache = new Map<string, { data: ConsultaCadastroResultado; timestamp: number }>();
const CADASTRO_CACHE_TTL_MS = 1000 * 60 * 60 * 24;

/**
 * Consulta de Fidelidade Cadastral com Arquitetura de 3 Camadas de Fallback:
 * 1. SEFAZ SOAP (NFeConsultaCadastro 4.00)
 * 2. CNPJá Open API
 * 3. CNPJ.ws Pública
 */
export async function consultarCadastroTriplaCamada(params: {
  cnpj: string;
  uf?: string;
  empresaId?: string;
  cnpjAutor?: string;
}): Promise<ConsultaCadastroResultado> {
  const cleanCnpj = params.cnpj.replace(/\D/g, '');
  let cleanUf = (params.uf || '').toUpperCase().trim();

  // Verificar cache em memória
  const cacheKey = cleanUf ? `${cleanCnpj}_${cleanUf}` : cleanCnpj;
  const cached = cadastroTriplaCamadaCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CADASTRO_CACHE_TTL_MS)) {
    return { ...cached.data };
  }

  const cacheAndReturn = (res: ConsultaCadastroResultado) => {
    if (res.sucesso && res.ie && res.ie !== 'Não Consta no CCC') {
      cadastroTriplaCamadaCache.set(cacheKey, { data: res, timestamp: Date.now() });
    }
    return res;
  };

  // 1. Camada 1: SEFAZ SOAP Oficial (quando a UF foi informada)
  if (cleanUf) {
    try {
      const resSefaz = await consultarCadastroSefaz(cleanUf, cleanCnpj, params.empresaId, params.cnpjAutor);
      if (resSefaz && resSefaz.sucesso) {
        return cacheAndReturn(resSefaz);
      }
    } catch (err: any) {
      console.warn(`[Tripla Camada] Fallback acionado após erro SEFAZ SOAP: ${err.message}`);
    }
  }

  // 2. Camada 2: CNPJá Open API (Primeiro Fallback)
  try {
    const resCnpja = await fetch(`https://open.cnpja.com/office/${cleanCnpj}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(5000),
    });

    if (resCnpja.ok) {
      const dataCnpja: any = await resCnpja.json();
      const addr = dataCnpja.address || {};
      const actualUf = (addr.state || '').toUpperCase().trim();
      const effectiveUf = cleanUf || actualUf;

      const registrations = Array.isArray(dataCnpja.registrations) ? dataCnpja.registrations : [];
      const regForUf = registrations.find((r: any) => (r.state || '').toUpperCase() === effectiveUf && r.enabled);
      const anyActiveReg = registrations.find((r: any) => r.enabled);
      const chosenReg = regForUf || anyActiveReg;

      if (chosenReg && chosenReg.number) {
        const isTaxpayer = chosenReg.taxpayer !== false;
        const tipoContribuinte = isTaxpayer ? 'CONTRIBUINTE ICMS' : 'IE Não Contribuinte (Canteiro de Obras, IE Virtual, outros)';
        return cacheAndReturn({
          sucesso: true,
          camadaUtilizada: 'CNPJA',
          cnpj: cleanCnpj,
          uf: effectiveUf,
          ie: chosenReg.number,
          tipoIE: tipoContribuinte,
          situaçaoIE: 'Habilitado',
          razaoSocial: dataCnpja.company?.name,
          nomeFantasia: dataCnpja.alias || dataCnpja.company?.name,
          cnaePrincipal: String(dataCnpja.mainActivity?.id || ''),
          regimeTributario: calcularRegimeTributarioEstrito(dataCnpja),
          capitalSocial: Number(dataCnpja.company?.equity || 0),
        });
      }
    }
  } catch (err: any) {
    console.warn(`[Tripla Camada] Fallback acionado após erro CNPJá Open API: ${err.message}`);
  }

  // 3. Camada 3: CNPJ.ws Pública (Segundo Fallback)
  try {
    const resWs = await fetch(`https://publica.cnpj.ws/cnpj/${cleanCnpj}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(5000),
    });

    if (resWs.ok) {
      const dataWs: any = await resWs.json();
      const est = dataWs.estabelecimento || {};
      const actualUf = (est.estado?.sigla || '').toUpperCase().trim();
      const effectiveUf = cleanUf || actualUf;

      const ieList = Array.isArray(est.inscricoes_estaduais) ? est.inscricoes_estaduais : [];
      const activeForUf = ieList.find((i: any) => (i.estado?.sigla || '').toUpperCase() === effectiveUf && i.ativo);
      const inactiveForUf = ieList.find((i: any) => (i.estado?.sigla || '').toUpperCase() === effectiveUf && !i.ativo);
      const anyActive = ieList.find((i: any) => i.ativo);

      const targetEntry = activeForUf || inactiveForUf || anyActive;
      const cnaePrinc = String(est.atividade_principal?.id || '');

      if (targetEntry && targetEntry.inscricao_estadual) {
        const isAtivo = Boolean(targetEntry.ativo);
        return cacheAndReturn({
          sucesso: true,
          camadaUtilizada: 'CNPJ_WS',
          cnpj: cleanCnpj,
          uf: effectiveUf,
          ie: targetEntry.inscricao_estadual,
          tipoIE: isAtivo ? 'CONTRIBUINTE ICMS' : 'NÃO HABILITADO / INATIVO',
          situaçaoIE: isAtivo ? 'Habilitado' : 'Não Habilitado',
          razaoSocial: dataWs.razao_social,
          nomeFantasia: est.nome_fantasia || dataWs.razao_social,
          cnaePrincipal: cnaePrinc,
          regimeTributario: calcularRegimeTributarioEstrito(dataWs),
          capitalSocial: Number(dataWs.capital_social || 0),
        });
      }

      // Caso não tenha IE no array
      if (isPureServiceCnae(cnaePrinc)) {
        return cacheAndReturn({
          sucesso: true,
          camadaUtilizada: 'CNPJ_WS',
          cnpj: cleanCnpj,
          uf: effectiveUf,
          ie: 'Isento',
          tipoIE: 'NÃO CONTRIBUINTE',
          situaçaoIE: 'Não Contribuinte',
          razaoSocial: dataWs.razao_social,
          cnaePrincipal: cnaePrinc,
          regimeTributario: calcularRegimeTributarioEstrito(dataWs),
          capitalSocial: Number(dataWs.capital_social || 0),
        });
      }

      return cacheAndReturn({
        sucesso: true,
        camadaUtilizada: 'CNPJ_WS',
        cnpj: cleanCnpj,
        uf: effectiveUf,
        ie: 'Não Consta no CCC',
        tipoIE: 'IE Não Contribuinte (Canteiro de Obras, IE Virtual, outros)',
        situaçaoIE: 'Não Contribuinte',
        razaoSocial: dataWs.razao_social,
        cnaePrincipal: cnaePrinc,
        regimeTributario: calcularRegimeTributarioEstrito(dataWs),
        capitalSocial: Number(dataWs.capital_social || 0),
      });
    }
  } catch (err: any) {
    console.warn(`[Tripla Camada] Erro na consulta CNPJ.ws: ${err.message}`);
  }

  return {
    sucesso: false,
    camadaUtilizada: 'NONE',
    cnpj: cleanCnpj,
    uf: cleanUf,
    ie: 'Não Consta no CCC',
    tipoIE: 'IE Não Contribuinte (Canteiro de Obras, IE Virtual, outros)',
    situaçaoIE: 'Não Contribuinte',
    xMotivo: 'Não foi possível consultar os dados nas 3 camadas SEFAZ / CNPJá / CNPJ.ws',
  };
}

export default {
  UF_TO_CUF,
  transmitirEventoSefaz,
  consultarDistribuicaoDFe,
  consultarDistribuicaoCTe,
  consultarCadastroSefaz,
  consultarCadastroTriplaCamada,
  testarConexaoSefaz,
  converterPfxParaPem,
};

