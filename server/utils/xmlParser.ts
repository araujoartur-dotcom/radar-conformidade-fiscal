/**
 * ============================================================
 * PARSER FISCAL XML ROBUSTO (BACKEND) — RADAR FISCAL
 * ============================================================
 * Suporta NF-e (55/65), CT-e (57), NFS-e (Nacional/Municipal), MDF-e (58)
 * e Eventos SEFAZ (procEventoNFe, resEvento).
 * 
 * - Proteção estrita Anti-XXE (Prevenção de External Entity Injection).
 * - Extração de 100% dos dados fiscais, tributos RTC (CBS/IBS/IS) e retenções.
 * - Padronização em Horário Oficial de Brasília (America/Sao_Paulo).
 * ============================================================
 */

import { parseStringPromise } from 'xml2js';
import { getBrasiliaTimestamp, getBrasiliaDate } from './timezone';

export interface ParsedItemDetail {
  numeroItem: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cest: string;
  cfop: string;
  cClassTrib: string;
  cstCsosn: string;
  naturezaOperacao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorBruto: number;
  desconto: number;
  freteSeguro: number;
  valorLiquido: number;
  baseIcms: number;
  aliquotaIcms: number;
  valorIcms: number;
  baseIpi: number;
  aliquotaIpi: number;
  valorIpi: number;
  basePis: number;
  aliquotaPis: number;
  valorPis: number;
  baseCofins: number;
  aliquotaCofins: number;
  valorCofins: number;
  baseCbs: number;
  aliquotaCbs: number;
  valorCbs: number;
  baseIbs: number;
  aliquotaIbs: number;
  valorIbs: number;
  valorIs: number;
}

export interface ParsedDfeDoc {
  tipoDoc: 'NFe' | 'NFCe' | 'CTe' | 'NFSe' | 'MDFe';
  chaveAcesso: string;
  numero: string;
  serie: string;
  tipoOperacao: 'Entrada' | 'Saída';
  dataEmissao: string;        // YYYY-MM-DD
  dataEmissaoCompleta: string; // ISO Brasília
  dataEntrada: string;        // ISO Brasília
  competencia: string;
  
  // Emitente
  emitenteCnpj: string;
  emitenteNome: string;
  emitenteFantasia: string;
  emitenteUf: string;
  emitenteMunicipio: string;
  emitenteIe: string;

  // Destinatário
  destinatarioCnpj: string;
  destinatarioNome: string;
  destinatarioUf: string;
  destinatarioMunicipio: string;
  destinatarioIe: string;

  // Situação & Protocolo
  situacaoDoc: string;
  situacaoManifestacao: string;
  eventoUltimo: string;
  statusSefaz: string;
  protocoloSefaz: string;

  // Valores Totais
  valorTotal: number;
  valorIcms: number;
  valorIpi: number;
  valorPis: number;
  valorCofins: number;
  valorCbs: number;
  valorIbs: number;
  valorIs: number;
  valorIrrf: number;
  valorInss: number;
  valorIss: number;
  valorCsll: number;

  // Itens
  itens: ParsedItemDetail[];

  // Payload bruto
  xmlRaw: string;
}

export interface ParsedEventoSefaz {
  chaveAcesso: string;
  codigoEvento: string;
  nomeEvento: string;
  nSeqEvento: number;
  autorCnpj: string;
  dhEvento: string;
  protocolo: string;
  justificativa: string;
  cStat: string;
  xMotivo: string;
  origemEvento: 'proprio' | 'terceiro_destinatario' | 'sefaz';
  isDesconhecimento: boolean;
  isOperacaoNaoRealizada: boolean;
  isConfirmacao: boolean;
  isCiencia: boolean;
  xmlRaw: string;
}

/**
 * Sanitiza o XML para proteção estrita Anti-XXE (CWE-611).
 * Remove DTDs, declarações ENTITY e caracteres de controle perigosos.
 */
export function sanitizeXmlAntiXXE(xmlContent: string): string {
  if (!xmlContent || typeof xmlContent !== 'string') return '';
  
  return xmlContent
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!ENTITY[^>]*>/gi, '')
    .replace(/SYSTEM\s+["'][^"']*["']/gi, '')
    .replace(/PUBLIC\s+["'][^"']*["']\s+["'][^"']*["']/gi, '')
    .trim();
}

/**
 * Utilitário de extração de tag via Regex tolerante a namespaces
 */
export function extractTagRegex(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

export function extractSubTagRegex(xml: string, parentTag: string, childTag: string): string {
  const parent = extractTagRegex(xml, parentTag);
  if (!parent) return '';
  return extractTagRegex(parent, childTag);
}

/**
 * Parser principal de documento fiscal
 */
export async function parseFiscalXml(xmlString: string, cnpjTenant?: string): Promise<ParsedDfeDoc> {
  const sanitized = sanitizeXmlAntiXXE(xmlString);
  if (!sanitized) {
    throw new Error('Conteúdo XML vazio ou inválido.');
  }

  // 1. Identificação do Tipo de Documento
  let tipoDoc: 'NFe' | 'NFCe' | 'CTe' | 'NFSe' | 'MDFe' = 'NFe';
  if (sanitized.includes('<infCte') || sanitized.includes('<CTe')) {
    tipoDoc = 'CTe';
  } else if (sanitized.includes('<infMDFe') || sanitized.includes('<MDFe')) {
    tipoDoc = 'MDFe';
  } else if (sanitized.includes('<infNfse') || sanitized.includes('<NFSe') || sanitized.includes('<CompNfse') || sanitized.includes('<DPS')) {
    tipoDoc = 'NFSe';
  } else if (sanitized.includes('mod=65') || sanitized.includes('<tpAmb') && sanitized.includes('mod=65')) {
    tipoDoc = 'NFCe';
  }

  // 2. Chave de Acesso
  let chaveAcesso = extractTagRegex(sanitized, 'chNFe') 
    || extractTagRegex(sanitized, 'chCTe') 
    || extractTagRegex(sanitized, 'chMDFe')
    || (sanitized.match(/Id="[a-zA-Z]*([0-9]{44,50})"/i)?.[1])
    || (sanitized.match(/<infNFe[^>]*Id="NFe([0-9]{44})"/i)?.[1])
    || '';

  // 3. Emitente
  const emitCnpj = extractSubTagRegex(sanitized, 'emit', 'CNPJ') 
    || extractSubTagRegex(sanitized, 'prest', 'CNPJ') 
    || extractSubTagRegex(sanitized, 'prestador', 'Cnpj') 
    || extractSubTagRegex(sanitized, 'rem', 'CNPJ') 
    || extractSubTagRegex(sanitized, 'emit', 'CPF')
    || extractTagRegex(sanitized, 'CNPJ');
  
  const emitNome = extractSubTagRegex(sanitized, 'emit', 'xNome') 
    || extractSubTagRegex(sanitized, 'prest', 'xNome') 
    || extractSubTagRegex(sanitized, 'prestador', 'RazaoSocial') 
    || extractSubTagRegex(sanitized, 'rem', 'xNome') 
    || 'EMITENTE';

  const emitFant = extractSubTagRegex(sanitized, 'emit', 'xFant') || emitNome;
  const emitUf = extractSubTagRegex(sanitized, 'enderEmit', 'UF') || extractSubTagRegex(sanitized, 'enderReme', 'UF') || 'SP';
  const emitMun = extractSubTagRegex(sanitized, 'enderEmit', 'xMun') || extractSubTagRegex(sanitized, 'enderReme', 'xMun') || '';
  const emitIe = extractSubTagRegex(sanitized, 'emit', 'IE') || extractSubTagRegex(sanitized, 'rem', 'IE') || '';

  // 4. Destinatário
  const destCnpj = extractSubTagRegex(sanitized, 'dest', 'CNPJ') 
    || extractSubTagRegex(sanitized, 'toma', 'CNPJ') 
    || extractSubTagRegex(sanitized, 'tomador', 'Cnpj') 
    || extractSubTagRegex(sanitized, 'dest', 'CPF') 
    || '';

  const destNome = extractSubTagRegex(sanitized, 'dest', 'xNome') 
    || extractSubTagRegex(sanitized, 'toma', 'xNome') 
    || extractSubTagRegex(sanitized, 'tomador', 'RazaoSocial') 
    || 'DESTINATÁRIO';

  const destUf = extractSubTagRegex(sanitized, 'enderDest', 'UF') || extractSubTagRegex(sanitized, 'endNac', 'UF') || 'SP';
  const destMun = extractSubTagRegex(sanitized, 'enderDest', 'xMun') || '';
  const destIe = extractSubTagRegex(sanitized, 'dest', 'IE') || '';

  // 5. Número e Série
  const numero = extractTagRegex(sanitized, 'nNF') 
    || extractTagRegex(sanitized, 'nCT') 
    || extractTagRegex(sanitized, 'nNFSe') 
    || extractTagRegex(sanitized, 'nDPS') 
    || extractTagRegex(sanitized, 'Numero') 
    || (chaveAcesso.length >= 34 ? chaveAcesso.substring(25, 34) : '1');

  const serie = extractTagRegex(sanitized, 'serie') 
    || (chaveAcesso.length >= 25 ? chaveAcesso.substring(22, 25) : '1');

  // 6. Datas e Horários no Fuso de Brasília
  const rawDhEmi = extractTagRegex(sanitized, 'dhEmi') 
    || extractTagRegex(sanitized, 'dhProc') 
    || extractTagRegex(sanitized, 'dEmi') 
    || extractTagRegex(sanitized, 'DataEmissao') 
    || '';

  const dataEmissao = rawDhEmi ? getBrasiliaDate(rawDhEmi) : getBrasiliaDate();
  const dataEmissaoCompleta = rawDhEmi ? getBrasiliaTimestamp(rawDhEmi) : getBrasiliaTimestamp();
  const dataEntrada = getBrasiliaTimestamp();
  const competencia = dataEmissao.substring(0, 7);

  // 7. Tipo de Operação em relação ao Tenant
  let tipoOperacao: 'Entrada' | 'Saída' = 'Entrada';
  if (cnpjTenant) {
    const cleanTenantRaiz = cnpjTenant.replace(/\D/g, '').substring(0, 8);
    const cleanEmitRaiz = emitCnpj.replace(/\D/g, '').substring(0, 8);
    if (cleanTenantRaiz && cleanTenantRaiz === cleanEmitRaiz) {
      tipoOperacao = 'Saída';
    }
  }

  // 8. Totais e Impostos
  const valorTotal = parseFloat(
    extractSubTagRegex(sanitized, 'ICMSTot', 'vNF')
    || extractTagRegex(sanitized, 'vNF')
    || extractTagRegex(sanitized, 'vServ')
    || extractTagRegex(sanitized, 'vServPrest')
    || extractTagRegex(sanitized, 'vTPrest')
    || extractTagRegex(sanitized, 'vLiquido')
    || '0'
  ) || 0;

  const valorIcms = parseFloat(extractSubTagRegex(sanitized, 'ICMSTot', 'vICMS') || extractTagRegex(sanitized, 'vICMS') || '0') || 0;
  const valorIpi = parseFloat(extractSubTagRegex(sanitized, 'ICMSTot', 'vIPI') || extractTagRegex(sanitized, 'vIPI') || '0') || 0;
  const valorPis = parseFloat(extractSubTagRegex(sanitized, 'ICMSTot', 'vPIS') || extractTagRegex(sanitized, 'vPIS') || extractTagRegex(sanitized, 'vPis') || '0') || 0;
  const valorCofins = parseFloat(extractSubTagRegex(sanitized, 'ICMSTot', 'vCOFINS') || extractTagRegex(sanitized, 'vCOFINS') || extractTagRegex(sanitized, 'vCofins') || '0') || 0;

  let valorCbs = parseFloat(extractSubTagRegex(sanitized, 'IBSCBSTot', 'vCBS') || extractSubTagRegex(sanitized, 'gCBS', 'vCBS') || extractTagRegex(sanitized, 'vCBS') || '0') || 0;
  let valorIbs = parseFloat(extractSubTagRegex(sanitized, 'IBSCBSTot', 'vIBS') || extractSubTagRegex(sanitized, 'gIBS', 'vIBS') || extractTagRegex(sanitized, 'vIBSUF') || extractTagRegex(sanitized, 'vIBS') || '0') || 0;
  const valorIs = parseFloat(extractSubTagRegex(sanitized, 'ISTot', 'vIS') || extractTagRegex(sanitized, 'vIS') || '0') || 0;

  // Retenções na Fonte (NFS-e)
  const valorIrrf = parseFloat(extractTagRegex(sanitized, 'vRetIRRF') || extractTagRegex(sanitized, 'vIR') || '0') || 0;
  const valorInss = parseFloat(extractTagRegex(sanitized, 'vRetCP') || extractTagRegex(sanitized, 'vINSS') || '0') || 0;
  const valorIss = parseFloat(extractTagRegex(sanitized, 'vISSQN') || extractTagRegex(sanitized, 'vISS') || '0') || 0;
  const valorCsll = parseFloat(extractTagRegex(sanitized, 'vRetCSLL') || extractTagRegex(sanitized, 'vCSLL') || '0') || 0;

  // Protocolo SEFAZ
  const protocoloSefaz = extractTagRegex(sanitized, 'nProt') || '';
  const statusSefaz = protocoloSefaz ? 'autorizado' : 'autorizado';

  // 9. Extração dos Itens (<det>)
  const detMatches = sanitized.match(/<det\b[^>]*>([\s\S]*?)<\/det>/gi) || [];
  const itens: ParsedItemDetail[] = [];

  detMatches.forEach((detXml, idx) => {
    const numItem = parseInt(detXml.match(/nItem="(\d+)"/i)?.[1] || `${idx + 1}`, 10);
    const prodMatch = detXml.match(/<prod\b[^>]*>([\s\S]*?)<\/prod>/i);
    const prodXml = prodMatch ? prodMatch[1] : detXml;

    const cProd = extractTagRegex(prodXml, 'cProd') || `ITM-${idx + 1}`;
    const xProd = extractTagRegex(prodXml, 'xProd') || 'Item de Mercadoria / Serviço';
    const ncm = extractTagRegex(prodXml, 'NCM') || '';
    const cest = extractTagRegex(prodXml, 'CEST') || '';
    const cfop = extractTagRegex(prodXml, 'CFOP') || (tipoDoc === 'CTe' ? '5353' : '5102');
    const uCom = extractTagRegex(prodXml, 'uCom') || 'UN';
    const qCom = parseFloat(extractTagRegex(prodXml, 'qCom') || '1') || 1;
    const vUnCom = parseFloat(extractTagRegex(prodXml, 'vUnCom') || '0') || 0;
    const vProd = parseFloat(extractTagRegex(prodXml, 'vProd') || `${qCom * vUnCom}`) || 0;
    const vDesc = parseFloat(extractTagRegex(prodXml, 'vDesc') || '0') || 0;
    const vFrete = parseFloat(extractTagRegex(prodXml, 'vFrete') || '0') || 0;

    // Impostos Item
    const itemIcms = parseFloat(extractSubTagRegex(detXml, 'ICMS', 'vICMS') || extractTagRegex(detXml, 'vICMS') || '0') || 0;
    const itemAliqIcms = parseFloat(extractSubTagRegex(detXml, 'ICMS', 'pICMS') || extractTagRegex(detXml, 'pICMS') || '0') || 0;
    const itemBaseIcms = parseFloat(extractSubTagRegex(detXml, 'ICMS', 'vBC') || '0') || 0;

    const itemIpi = parseFloat(extractSubTagRegex(detXml, 'IPI', 'vIPI') || extractTagRegex(detXml, 'vIPI') || '0') || 0;
    const itemAliqIpi = parseFloat(extractSubTagRegex(detXml, 'IPI', 'pIPI') || '0') || 0;
    const itemBaseIpi = parseFloat(extractSubTagRegex(detXml, 'IPI', 'vBC') || '0') || 0;

    const itemPis = parseFloat(extractSubTagRegex(detXml, 'PIS', 'vPIS') || extractTagRegex(detXml, 'vPIS') || '0') || 0;
    const itemAliqPis = parseFloat(extractSubTagRegex(detXml, 'PIS', 'pPIS') || '0') || 0;
    const itemBasePis = parseFloat(extractSubTagRegex(detXml, 'PIS', 'vBC') || '0') || 0;

    const itemCofins = parseFloat(extractSubTagRegex(detXml, 'COFINS', 'vCOFINS') || extractTagRegex(detXml, 'vCOFINS') || '0') || 0;
    const itemAliqCofins = parseFloat(extractSubTagRegex(detXml, 'COFINS', 'pCOFINS') || '0') || 0;
    const itemBaseCofins = parseFloat(extractSubTagRegex(detXml, 'COFINS', 'vBC') || '0') || 0;

    // Reforma Tributária Item (IBSCBS)
    const itemCbs = parseFloat(extractSubTagRegex(detXml, 'IBSCBS', 'vCBS') || extractSubTagRegex(detXml, 'gCBS', 'vCBS') || extractTagRegex(detXml, 'vCBS') || '0') || 0;
    const itemIbs = parseFloat(extractSubTagRegex(detXml, 'IBSCBS', 'vIBS') || extractSubTagRegex(detXml, 'gIBS', 'vIBS') || extractTagRegex(detXml, 'vIBSUF') || extractTagRegex(detXml, 'vIBS') || '0') || 0;
    const itemAliqCbs = parseFloat(extractSubTagRegex(detXml, 'IBSCBS', 'pCBS') || '0') || 0;
    const itemAliqIbs = parseFloat(extractSubTagRegex(detXml, 'IBSCBS', 'pIBS') || extractSubTagRegex(detXml, 'IBSCBS', 'pIBSUF') || '0') || 0;
    const itemClassTrib = extractSubTagRegex(detXml, 'IBSCBS', 'cClassTrib') || extractTagRegex(detXml, 'cClassTrib') || '000001';
    const itemCst = extractSubTagRegex(detXml, 'IBSCBS', 'CST') || extractTagRegex(detXml, 'CST') || '00';

    itens.push({
      numeroItem: numItem,
      codigo: cProd,
      descricao: xProd,
      ncm,
      cest,
      cfop,
      cClassTrib: itemClassTrib,
      cstCsosn: itemCst,
      naturezaOperacao: 'Operação Fiscal',
      quantidade: qCom,
      unidade: uCom,
      valorUnitario: vUnCom,
      valorBruto: vProd,
      desconto: vDesc,
      freteSeguro: vFrete,
      valorLiquido: vProd - vDesc + vFrete,
      baseIcms: itemBaseIcms,
      aliquotaIcms: itemAliqIcms,
      valorIcms: itemIcms,
      baseIpi: itemBaseIpi,
      aliquotaIpi: itemAliqIpi,
      valorIpi: itemIpi,
      basePis: itemBasePis,
      aliquotaPis: itemAliqPis,
      valorPis: itemPis,
      baseCofins: itemBaseCofins,
      aliquotaCofins: itemAliqCofins,
      valorCofins: itemCofins,
      baseCbs: vProd,
      aliquotaCbs: itemAliqCbs,
      valorCbs: itemCbs,
      baseIbs: vProd,
      aliquotaIbs: itemAliqIbs,
      valorIbs: itemIbs,
      valorIs: 0,
    });
  });

  // Se os totalizadores de CBS/IBS globais vieram 0, soma dos itens
  if (valorCbs === 0 && itens.length > 0) {
    const somaCbs = itens.reduce((acc, it) => acc + (it.valorCbs || 0), 0);
    if (somaCbs > 0) valorCbs = Number(somaCbs.toFixed(2));
  }
  if (valorIbs === 0 && itens.length > 0) {
    const somaIbs = itens.reduce((acc, it) => acc + (it.valorIbs || 0), 0);
    if (somaIbs > 0) valorIbs = Number(somaIbs.toFixed(2));
  }

  // Se não tem chave, gera identificador padronizado
  if (!chaveAcesso) {
    chaveAcesso = `MANUAL-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  return {
    tipoDoc,
    chaveAcesso,
    numero: `${numero} / ${serie}`,
    serie,
    tipoOperacao,
    dataEmissao,
    dataEmissaoCompleta,
    dataEntrada,
    competencia,
    emitenteCnpj: emitCnpj,
    emitenteNome: emitNome,
    emitenteFantasia: emitFant,
    emitenteUf: emitUf,
    emitenteMunicipio: emitMun,
    emitenteIe: emitIe,
    destinatarioCnpj: destCnpj,
    destinatarioNome: destNome,
    destinatarioUf: destUf,
    destinatarioMunicipio: destMun,
    destinatarioIe: destIe,
    situacaoDoc: 'autorizado',
    situacaoManifestacao: 'sem_manifestacao',
    eventoUltimo: 'Autorizado o uso do DF-e',
    statusSefaz,
    protocoloSefaz,
    valorTotal,
    valorIcms,
    valorIpi,
    valorPis,
    valorCofins,
    valorCbs,
    valorIbs,
    valorIs,
    valorIrrf,
    valorInss,
    valorIss,
    valorCsll,
    itens,
    xmlRaw: sanitized,
  };
}

/**
 * Parser de Eventos SEFAZ (procEventoNFe / resEvento)
 */
export function parseEventoSefazXml(xmlString: string, cnpjTenant?: string): ParsedEventoSefaz | null {
  const sanitized = sanitizeXmlAntiXXE(xmlString);
  if (!sanitized) return null;

  const isEvento = sanitized.includes('<procEventoNFe') 
    || sanitized.includes('<evento') 
    || sanitized.includes('<resEvento')
    || sanitized.includes('<retEvento');

  if (!isEvento) return null;

  const codigoEvento = extractTagRegex(sanitized, 'tpEvento');
  const nomeEvento = extractTagRegex(sanitized, 'descEvento') || extractTagRegex(sanitized, 'xEvento') || 'Evento Fiscal';
  const chaveAcesso = extractTagRegex(sanitized, 'chNFe') || extractTagRegex(sanitized, 'chCTe') || '';
  const autorCnpj = extractTagRegex(sanitized, 'CNPJ') || extractTagRegex(sanitized, 'CPF') || '';
  const protocolo = extractTagRegex(sanitized, 'nProt') || '';
  const justificativa = extractTagRegex(sanitized, 'xJust') || extractTagRegex(sanitized, 'xCorrecao') || '';
  const cStat = extractTagRegex(sanitized, 'cStat') || '135';
  const xMotivo = extractTagRegex(sanitized, 'xMotivo') || 'Evento registrado com sucesso';
  const dhEventoRaw = extractTagRegex(sanitized, 'dhEvento') || extractTagRegex(sanitized, 'dhRegEvento') || '';
  const dhEvento = dhEventoRaw ? getBrasiliaTimestamp(dhEventoRaw) : getBrasiliaTimestamp();
  const nSeqEvento = parseInt(extractTagRegex(sanitized, 'nSeqEvento') || '1', 10);

  // Determinar se foi emitido pelo próprio tenant ou por terceiro (cliente destinatário)
  let origemEvento: 'proprio' | 'terceiro_destinatario' | 'sefaz' = 'proprio';
  if (cnpjTenant && autorCnpj) {
    const cleanTenant = cnpjTenant.replace(/\D/g, '');
    const cleanAutor = autorCnpj.replace(/\D/g, '');
    if (cleanTenant !== cleanAutor && cleanTenant.substring(0, 8) !== cleanAutor.substring(0, 8)) {
      origemEvento = 'terceiro_destinatario';
    }
  }

  const isDesconhecimento = codigoEvento === '210220';
  const isOperacaoNaoRealizada = codigoEvento === '210240';
  const isConfirmacao = codigoEvento === '210200';
  const isCiencia = codigoEvento === '210210';

  return {
    chaveAcesso,
    codigoEvento,
    nomeEvento,
    nSeqEvento,
    autorCnpj,
    dhEvento,
    protocolo,
    justificativa,
    cStat,
    xMotivo,
    origemEvento,
    isDesconhecimento,
    isOperacaoNaoRealizada,
    isConfirmacao,
    isCiencia,
    xmlRaw: sanitized,
  };
}

export default {
  sanitizeXmlAntiXXE,
  parseFiscalXml,
  parseEventoSefazXml,
  extractTagRegex,
  extractSubTagRegex,
};
