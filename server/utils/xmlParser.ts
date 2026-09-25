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
  indOper: string;
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
  valorIbsUf: number;
  aliquotaIbsUf: number;
  valorIbsMun: number;
  aliquotaIbsMun: number;
  valorIs: number;
}

export interface ParsedDfeDoc {
  tipoDoc: 'NFe' | 'NFCe' | 'CTe' | 'NFSe' | 'MDFe';
  chaveAcesso: string;
  numero: string;
  serie: string;
  tipoOperacao: 'Entrada' | 'Saída';
  direcaoMovimento: 'ENTRADA' | 'SAIDA';
  tomadorCnpj?: string;
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
  emitenteCodigoMunicipio?: string;
  emitenteIe: string;

  // Destinatário
  destinatarioCnpj: string;
  destinatarioNome: string;
  destinatarioUf: string;
  destinatarioMunicipio: string;
  destinatarioCodigoMunicipio?: string;
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
  valorIbsUf: number;
  valorIbsMun: number;
  aliquotaIbsUf?: number;
  aliquotaIbsMun?: number;
  baseCbs: number;
  baseIbs: number;
  valorIs: number;
  valorIrrf: number;
  valorInss: number;
  valorIss: number;
  valorCsll: number;
  regimeTributario?: string;

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
 * Utilitário de extração de tag via Regex tolerante a namespaces e fechamento seguro
 */
export function extractTagRegex(xml: string, tag: string): string {
  if (!xml) return '';
  const match = xml.match(new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tag}(?=[\\s>])[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

export function extractSubTagRegex(xml: string, parentTag: string, childTag: string): string {
  const parent = extractTagRegex(xml, parentTag);
  if (!parent) return '';
  return extractTagRegex(parent, childTag);
}

/**
 * Converte strings monetárias e numéricas (com vírgulas ou pontos, ou tags aninhadas) para float seguro
 */
export function parseValor(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val || typeof val !== 'string') return 0;
  // Remove tags XML acidentais que possam ter vindo juntas
  const clean = val.replace(/<[^>]+>/g, '').trim();
  if (!clean) return 0;
  if (clean.includes(',') && clean.includes('.')) {
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      // Padrão brasileiro: 1.234,56
      const normalized = clean.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(normalized);
      return isNaN(num) ? 0 : num;
    }
  } else if (clean.includes(',')) {
    // Padrão com vírgula: 1234,56
    const num = parseFloat(clean.replace(',', '.'));
    return isNaN(num) ? 0 : num;
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
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
  } else if (
    sanitized.includes('<infNfse') || 
    sanitized.includes('<NFSe') || 
    sanitized.includes('<Nfse') ||
    sanitized.includes('<CompNfse') || 
    sanitized.includes('<DPS') ||
    sanitized.includes('<infDPS') ||
    sanitized.includes('<ConsultarNfseResposta') ||
    sanitized.includes('<GerarNfseResposta') ||
    sanitized.includes('<EnviarLoteRpsResposta') ||
    sanitized.includes('<ChaveRPS') ||
    sanitized.includes('<ValorServicos') ||
    sanitized.includes('<ItemListaServico')
  ) {
    tipoDoc = 'NFSe';
  } else if (
    sanitized.includes('<mod>65</mod>') || 
    sanitized.match(/<mod>\s*65\s*<\/mod>/i) || 
    sanitized.includes('mod=65') ||
    extractTagRegex(sanitized, 'mod') === '65'
  ) {
    tipoDoc = 'NFCe';
  }

  // 2. Chave de Acesso
  let chaveAcesso = extractTagRegex(sanitized, 'chNFe') 
    || extractTagRegex(sanitized, 'chCTe') 
    || extractTagRegex(sanitized, 'chMDFe')
    || extractTagRegex(sanitized, 'chNFSe')
    || (sanitized.match(/Id="[a-zA-Z]*([0-9]{44,50})"/i)?.[1])
    || (sanitized.match(/<infNFe[^>]*Id="NFe([0-9]{44})"/i)?.[1])
    || (sanitized.match(/<infNFSe[^>]*Id="([a-zA-Z0-9_-]+)"/i)?.[1])
    || (sanitized.match(/<InfNfse[^>]*Id="([a-zA-Z0-9_-]+)"/i)?.[1])
    || '';

  // 2.1 Refinamento de Modelo pela Chave de Acesso Oficial (Dígitos 21 e 22 = Modelo 55/65/57)
  if (chaveAcesso && chaveAcesso.length === 44 && tipoDoc !== 'NFSe') {
    const modChave = chaveAcesso.substring(20, 22);
    if (modChave === '65') {
      tipoDoc = 'NFCe';
    } else if (modChave === '57' || modChave === '67') {
      tipoDoc = 'CTe';
    } else if (modChave === '55') {
      tipoDoc = 'NFe';
    }
  }

  // 3. Emitente (Prestador / Fornecedor / Transportador)
  const emitCnpj = extractSubTagRegex(sanitized, 'emit', 'CNPJ') 
    || extractSubTagRegex(sanitized, 'prest', 'CNPJ') 
    || extractSubTagRegex(sanitized, 'prestador', 'Cnpj') 
    || extractSubTagRegex(sanitized, 'PrestadorServico', 'Cnpj')
    || extractSubTagRegex(sanitized, 'IdentificacaoPrestador', 'Cnpj')
    || extractSubTagRegex(sanitized, 'CPFCNPJPrestador', 'CNPJ')
    || extractSubTagRegex(sanitized, 'CPFCNPJPrestador', 'Cnpj')
    || extractTagRegex(sanitized, 'CPFCNPJPrestador')
    || extractSubTagRegex(sanitized, 'rem', 'CNPJ') 
    || extractSubTagRegex(sanitized, 'emit', 'CPF')
    || extractTagRegex(sanitized, 'CNPJ');
  
  const emitNome = extractSubTagRegex(sanitized, 'emit', 'xNome') 
    || extractSubTagRegex(sanitized, 'prest', 'xNome') 
    || extractSubTagRegex(sanitized, 'prestador', 'RazaoSocial') 
    || extractSubTagRegex(sanitized, 'PrestadorServico', 'RazaoSocial')
    || extractSubTagRegex(sanitized, 'IdentificacaoPrestador', 'RazaoSocial')
    || extractTagRegex(sanitized, 'RazaoSocialPrestador')
    || extractSubTagRegex(sanitized, 'rem', 'xNome') 
    || '';

  const emitFant = extractSubTagRegex(sanitized, 'emit', 'xFant') 
    || extractSubTagRegex(sanitized, 'PrestadorServico', 'NomeFantasia')
    || emitNome;
  const emitUf = extractSubTagRegex(sanitized, 'enderEmit', 'UF') 
    || extractSubTagRegex(sanitized, 'enderReme', 'UF') 
    || extractSubTagRegex(sanitized, 'Endereco', 'Uf')
    || extractSubTagRegex(sanitized, 'prest', 'UF')
    || '';
  const emitMun = extractSubTagRegex(sanitized, 'enderEmit', 'xMun') 
    || extractSubTagRegex(sanitized, 'enderReme', 'xMun') 
    || extractSubTagRegex(sanitized, 'Endereco', 'CodigoMunicipio')
    || '';
  const emitCodigoMunicipio = extractSubTagRegex(sanitized, 'enderEmit', 'cMun')
    || extractTagRegex(sanitized, 'cMunFG')
    || '';
  const emitIe = extractSubTagRegex(sanitized, 'emit', 'IE') || extractSubTagRegex(sanitized, 'rem', 'IE') || '';

  // 3b. Código de Regime Tributário (CRT) do Emitente
  // NF-e/CT-e: 1 = Simples Nacional, 2 = SN Sublimite, 3 = Regime Normal, 4 = MEI
  let regimeTributario = extractSubTagRegex(sanitized, 'emit', 'CRT') || extractTagRegex(sanitized, 'CRT') || '';

  // Tratamento específico para NFS-e Padrão Nacional (opSimpNac) e ABRASF (OptanteSimplesNacional)
  if (tipoDoc === 'NFSe') {
    const opSimpNac = extractSubTagRegex(sanitized, 'regTrib', 'opSimpNac') || extractTagRegex(sanitized, 'opSimpNac');
    const optanteSimplesNacional = extractTagRegex(sanitized, 'OptanteSimplesNacional');
    
    if (opSimpNac) {
      if (opSimpNac === '2') regimeTributario = '4'; // MEI
      else if (opSimpNac === '3' || opSimpNac === '4') regimeTributario = '1'; // Simples Nacional
      else if (opSimpNac === '1') regimeTributario = '3'; // Normal
    } else if (optanteSimplesNacional) {
      if (optanteSimplesNacional === '1' || optanteSimplesNacional.toLowerCase() === 'sim' || optanteSimplesNacional.toLowerCase() === 'true') {
        regimeTributario = '1';
      } else if (optanteSimplesNacional === '2' || optanteSimplesNacional.toLowerCase() === 'nao' || optanteSimplesNacional.toLowerCase() === 'false') {
        regimeTributario = '3';
      }
    }
  }
  // 4. Destinatário (Tomador / Cliente)
  const destCnpj = extractSubTagRegex(sanitized, 'dest', 'CNPJ') 
    || extractSubTagRegex(sanitized, 'toma', 'CNPJ') 
    || extractSubTagRegex(sanitized, 'tomador', 'Cnpj') 
    || extractSubTagRegex(sanitized, 'TomadorServico', 'Cnpj') 
    || extractSubTagRegex(sanitized, 'IdentificacaoTomador', 'Cnpj')
    || extractSubTagRegex(sanitized, 'CPFCNPJTomador', 'CNPJ')
    || extractSubTagRegex(sanitized, 'CPFCNPJTomador', 'Cnpj')
    || extractTagRegex(sanitized, 'CPFCNPJTomador')
    || extractSubTagRegex(sanitized, 'dest', 'CPF') 
    || '';

  const destNome = extractSubTagRegex(sanitized, 'dest', 'xNome') 
    || extractSubTagRegex(sanitized, 'toma', 'xNome') 
    || extractSubTagRegex(sanitized, 'tomador', 'RazaoSocial') 
    || extractSubTagRegex(sanitized, 'TomadorServico', 'RazaoSocial')
    || extractTagRegex(sanitized, 'RazaoSocialTomador')
    || '';

  const destUf = extractSubTagRegex(sanitized, 'enderDest', 'UF') 
    || extractSubTagRegex(sanitized, 'endNac', 'UF') 
    || extractSubTagRegex(sanitized, 'TomadorServico', 'Uf')
    || '';
  const destMun = extractSubTagRegex(sanitized, 'enderDest', 'xMun') || '';
  const destCodigoMunicipio = extractSubTagRegex(sanitized, 'enderDest', 'cMun') || '';
  const destIe = extractSubTagRegex(sanitized, 'dest', 'IE') || '';

  // 5. Número e Série
  const numero = extractTagRegex(sanitized, 'nNF') 
    || extractTagRegex(sanitized, 'nCT') 
    || extractTagRegex(sanitized, 'nNFSe') 
    || extractTagRegex(sanitized, 'nDPS') 
    || extractTagRegex(sanitized, 'Numero') 
    || extractTagRegex(sanitized, 'NumeroNfse')
    || (chaveAcesso.length >= 34 ? chaveAcesso.substring(25, 34) : '1');

  const serie = extractTagRegex(sanitized, 'serie') 
    || extractTagRegex(sanitized, 'Serie')
    || extractTagRegex(sanitized, 'SerieDPS')
    || extractTagRegex(sanitized, 'SerieRPS')
    || (chaveAcesso.length >= 25 ? chaveAcesso.substring(22, 25) : '1');

  // 5b. Código de Verificação e Chave Canônica para NFS-e Municipal (ABRASF, PMSP, DSF, etc.)
  const codigoVerificacao = extractTagRegex(sanitized, 'CodigoVerificacao')
    || extractTagRegex(sanitized, 'CodigoAutenticidade')
    || extractTagRegex(sanitized, 'CodVerificacao')
    || extractTagRegex(sanitized, 'CodVerif')
    || '';

  if (!chaveAcesso && tipoDoc === 'NFSe') {
    const cleanEmit = emitCnpj.replace(/\D/g, '') || '00000000000000';
    const cleanMun = (emitMun || '0000000').replace(/\D/g, '').padStart(7, '0').substring(0, 7);
    const cleanNum = numero.replace(/\D/g, '').padStart(9, '0');
    const cleanVerif = codigoVerificacao.replace(/[^a-zA-Z0-9]/g, '');
    if (cleanVerif || (cleanNum && cleanNum !== '000000001')) {
      chaveAcesso = `NFSE${cleanMun}${cleanEmit}${cleanNum}${cleanVerif}`.substring(0, 44);
    }
  }

  // 6. Datas e Horários no Fuso de Brasília
  const rawDhEmi = extractTagRegex(sanitized, 'dhEmi') 
    || extractTagRegex(sanitized, 'dhProc') 
    || extractTagRegex(sanitized, 'dEmi') 
    || extractTagRegex(sanitized, 'DataEmissao') 
    || extractTagRegex(sanitized, 'DataEmissaoRPS')
    || '';

  const dataEmissao = rawDhEmi ? getBrasiliaDate(rawDhEmi) : getBrasiliaDate();
  const dataEmissaoCompleta = rawDhEmi ? getBrasiliaTimestamp(rawDhEmi) : getBrasiliaTimestamp();
  const dataEntrada = getBrasiliaTimestamp();
  const competencia = extractTagRegex(sanitized, 'Competencia')?.substring(0, 7) || dataEmissao.substring(0, 7);

  // 7. Tomador e Tipo de Operação em relação ao Tenant / DF-e
  // 7.1 Identificação Canônica do Tomador (CT-e / NFS-e / NF-e)
  let tomadorCnpj = '';
  if (tipoDoc === 'CTe') {
    // No CT-e: toma3 (0=rem, 1=exped, 2=receb, 3=dest) ou toma4 (outros com CNPJ próprio)
    const toma4Cnpj = extractSubTagRegex(sanitized, 'toma4', 'CNPJ') || extractSubTagRegex(sanitized, 'toma4', 'CPF');
    const toma3Tipo = extractSubTagRegex(sanitized, 'toma3', 'toma') || extractTagRegex(sanitized, 'toma');
    if (toma4Cnpj) {
      tomadorCnpj = toma4Cnpj;
    } else if (toma3Tipo === '0') {
      tomadorCnpj = extractSubTagRegex(sanitized, 'rem', 'CNPJ') || extractSubTagRegex(sanitized, 'rem', 'CPF') || emitCnpj;
    } else if (toma3Tipo === '1') {
      tomadorCnpj = extractSubTagRegex(sanitized, 'exped', 'CNPJ') || extractSubTagRegex(sanitized, 'exped', 'CPF') || '';
    } else if (toma3Tipo === '2') {
      tomadorCnpj = extractSubTagRegex(sanitized, 'receb', 'CNPJ') || extractSubTagRegex(sanitized, 'receb', 'CPF') || '';
    } else if (toma3Tipo === '3') {
      tomadorCnpj = destCnpj;
    } else {
      tomadorCnpj = destCnpj;
    }
  } else {
    tomadorCnpj = destCnpj;
  }

  // 7.2 Direção Canônica do Movimento (ENTRADA | SAIDA)
  const tpNf = extractTagRegex(sanitized, 'tpNF') || '1'; // 0=Entrada, 1=Saída
  let direcaoMovimento: 'ENTRADA' | 'SAIDA' = 'ENTRADA';

  const cleanTenant = cnpjTenant ? cnpjTenant.replace(/\D/g, '') : '';
  const cleanTenantRaiz = cleanTenant.substring(0, 8);
  const cleanEmit = emitCnpj.replace(/\D/g, '');
  const cleanEmitRaiz = cleanEmit.substring(0, 8);
  const cleanDest = destCnpj.replace(/\D/g, '');
  const cleanDestRaiz = cleanDest.substring(0, 8);
  const cleanToma = tomadorCnpj.replace(/\D/g, '');
  const cleanTomaRaiz = cleanToma.substring(0, 8);

  if (tipoDoc === 'CTe') {
    if (cleanTenantRaiz && cleanTenantRaiz === cleanEmitRaiz) {
      direcaoMovimento = 'SAIDA'; // Empresa é a transportadora emitente
    } else if (cleanTenantRaiz && (cleanTenantRaiz === cleanTomaRaiz || cleanTenantRaiz === cleanDestRaiz)) {
      direcaoMovimento = 'ENTRADA'; // Empresa tomou o serviço de frete
    } else {
      direcaoMovimento = 'ENTRADA';
    }
  } else if (tipoDoc === 'NFSe') {
    if (cleanTenantRaiz && cleanTenantRaiz === cleanEmitRaiz) {
      direcaoMovimento = 'SAIDA'; // Prestador do serviço
    } else {
      direcaoMovimento = 'ENTRADA'; // Tomador do serviço
    }
  } else {
    // NF-e e NFC-e
    if (cleanTenantRaiz) {
      if (cleanTenantRaiz === cleanEmitRaiz) {
        // Empresa emitiu o documento
        // tpNF == '0' -> Entrada emitida pela própria empresa (devolução recebida, entrada produtor rural)
        direcaoMovimento = tpNf === '0' ? 'ENTRADA' : 'SAIDA';
      } else if (cleanTenantRaiz === cleanDestRaiz) {
        // Empresa é a destinatária
        // tpNF == '0' -> Fornecedor emitiu nota de entrada (devolução), logo saída do tenant
        direcaoMovimento = tpNf === '0' ? 'SAIDA' : 'ENTRADA';
      } else {
        direcaoMovimento = tpNf === '0' ? 'ENTRADA' : 'SAIDA';
      }
    } else {
      direcaoMovimento = tpNf === '0' ? 'ENTRADA' : 'SAIDA';
    }
  }

  const tipoOperacao: 'Entrada' | 'Saída' = direcaoMovimento === 'SAIDA' ? 'Saída' : 'Entrada';

  // 8. Totais e Impostos
  const valorTotal = parseValor(
    extractSubTagRegex(sanitized, 'ICMSTot', 'vNF')
    || extractSubTagRegex(sanitized, 'vServPrest', 'vServ')
    || extractSubTagRegex(sanitized, 'valores', 'vServ')
    || extractSubTagRegex(sanitized, 'valores', 'vLiq')
    || extractSubTagRegex(sanitized, 'valoresServico', 'vServ')
    || extractTagRegex(sanitized, 'vServ')
    || extractTagRegex(sanitized, 'vNF')
    || extractTagRegex(sanitized, 'ValorServicos')
    || extractTagRegex(sanitized, 'vTPrest')
    || extractTagRegex(sanitized, 'ValorTotal')
    || extractTagRegex(sanitized, 'vLiquido')
    || extractTagRegex(sanitized, 'vLiq')
    || extractTagRegex(sanitized, 'vTotTrib')
    || '0'
  );

  let valorIcms = parseValor(extractSubTagRegex(sanitized, 'ICMSTot', 'vICMS') || extractTagRegex(sanitized, 'vICMS') || '0');
  let valorIpi = parseValor(extractSubTagRegex(sanitized, 'ICMSTot', 'vIPI') || extractTagRegex(sanitized, 'vIPI') || '0');
  let valorPis = parseValor(
    extractSubTagRegex(sanitized, 'ICMSTot', 'vPIS') 
    || extractSubTagRegex(sanitized, 'piscofins', 'vPIS')
    || extractTagRegex(sanitized, 'vPIS') 
    || extractTagRegex(sanitized, 'ValorPis') 
    || extractTagRegex(sanitized, 'vPis') 
    || extractTagRegex(sanitized, 'vRetPIS')
    || '0'
  );

  let valorCofins = parseValor(
    extractSubTagRegex(sanitized, 'ICMSTot', 'vCOFINS') 
    || extractSubTagRegex(sanitized, 'piscofins', 'vCOFINS')
    || extractTagRegex(sanitized, 'vCOFINS') 
    || extractTagRegex(sanitized, 'ValorCofins') 
    || extractTagRegex(sanitized, 'vCofins') 
    || extractTagRegex(sanitized, 'vRetCOFINS')
    || '0'
  );

  let valorCbs = parseValor(extractSubTagRegex(sanitized, 'IBSCBSTot', 'vCBS') || extractSubTagRegex(sanitized, 'gCBS', 'vCBS') || extractTagRegex(sanitized, 'vCBS') || '0');
  let valorIbs = parseValor(extractSubTagRegex(sanitized, 'IBSCBSTot', 'vIBS') || extractSubTagRegex(sanitized, 'gIBS', 'vIBS') || extractTagRegex(sanitized, 'vIBSUF') || extractTagRegex(sanitized, 'vIBS') || '0');
  let valorIbsUf = parseValor(extractSubTagRegex(sanitized, 'gIBSUF', 'vIBSUF') || extractTagRegex(sanitized, 'vIBSUF') || '0');
  let aliquotaIbsUf = parseValor(extractSubTagRegex(sanitized, 'gIBSUF', 'pIBSUF') || extractTagRegex(sanitized, 'pIBSUF') || '0');
  let valorIbsMun = parseValor(extractSubTagRegex(sanitized, 'gIBSMun', 'vIBSMun') || extractTagRegex(sanitized, 'vIBSMun') || '0');
  let aliquotaIbsMun = parseValor(extractSubTagRegex(sanitized, 'gIBSMun', 'pIBSMun') || extractTagRegex(sanitized, 'pIBSMun') || '0');
  let aliquotaCbsGlobal = parseValor(extractSubTagRegex(sanitized, 'gCBS', 'pCBS') || extractTagRegex(sanitized, 'pCBS') || '0');
  let aliquotaIbsGlobal = parseValor(extractSubTagRegex(sanitized, 'gIBS', 'pIBS') || extractTagRegex(sanitized, 'pIBS') || (aliquotaIbsUf + aliquotaIbsMun > 0 ? String(aliquotaIbsUf + aliquotaIbsMun) : '0'));
  const valorIs = parseValor(extractSubTagRegex(sanitized, 'ISTot', 'vIS') || extractTagRegex(sanitized, 'vIS') || '0');

  // Base de Cálculo IBS e CBS (<vBC> estritamente constante nos grupos de IBS/CBS do XML)
  let baseCbs = parseValor(
    extractSubTagRegex(sanitized, 'IBSCBSTot', 'vBCCBS')
    || extractSubTagRegex(sanitized, 'gIBSCBS', 'vBC')
    || extractSubTagRegex(sanitized, 'IBSCBS', 'vBC')
    || extractSubTagRegex(sanitized, 'gCBS', 'vBC')
    || extractSubTagRegex(sanitized, 'CBS', 'vBC')
    || extractTagRegex(sanitized, 'vBCCBS')
    || '0'
  );

  let baseIbs = parseValor(
    extractSubTagRegex(sanitized, 'IBSCBSTot', 'vBCIBS')
    || extractSubTagRegex(sanitized, 'gIBSCBS', 'vBC')
    || extractSubTagRegex(sanitized, 'IBSCBS', 'vBC')
    || extractSubTagRegex(sanitized, 'gIBS', 'vBC')
    || extractSubTagRegex(sanitized, 'IBS', 'vBC')
    || extractTagRegex(sanitized, 'vBCIBS')
    || '0'
  );

  // Retenções na Fonte (NFS-e & Padrões Municipais / ABRASF / Nacional)
  const valorIrrf = parseValor(
    extractSubTagRegex(sanitized, 'tribFed', 'vRetIRRF')
    || extractSubTagRegex(sanitized, 'tribFed', 'vIR')
    || extractTagRegex(sanitized, 'vRetIRRF') 
    || extractTagRegex(sanitized, 'vIR') 
    || extractTagRegex(sanitized, 'ValorIr') 
    || extractTagRegex(sanitized, 'ValorIRRF')
    || extractTagRegex(sanitized, 'ValorIR')
    || '0'
  );

  const valorInss = parseValor(
    extractSubTagRegex(sanitized, 'tribFed', 'vRetCP')
    || extractSubTagRegex(sanitized, 'tribFed', 'vINSS')
    || extractTagRegex(sanitized, 'vRetCP') 
    || extractTagRegex(sanitized, 'vINSS') 
    || extractTagRegex(sanitized, 'ValorInss') 
    || extractTagRegex(sanitized, 'ValorINSS')
    || extractTagRegex(sanitized, 'vCP')
    || '0'
  );

  const valorIss = parseValor(
    extractSubTagRegex(sanitized, 'ISSQNTot', 'vISS')
    || extractSubTagRegex(sanitized, 'tribMun', 'vISSQN')
    || extractSubTagRegex(sanitized, 'trib', 'vISSQN')
    || extractTagRegex(sanitized, 'vISSQN') 
    || extractTagRegex(sanitized, 'ValorIssRetido') 
    || extractTagRegex(sanitized, 'vISS') 
    || extractTagRegex(sanitized, 'ValorIss') 
    || extractTagRegex(sanitized, 'ValorISS')
    || '0'
  );

  const valorCsll = parseValor(
    extractSubTagRegex(sanitized, 'tribFed', 'vRetCSLL')
    || extractSubTagRegex(sanitized, 'tribFed', 'vCSLL')
    || extractTagRegex(sanitized, 'vRetCSLL') 
    || extractTagRegex(sanitized, 'vCSLL') 
    || extractTagRegex(sanitized, 'ValorCsll') 
    || extractTagRegex(sanitized, 'ValorCSLL')
    || '0'
  );

  // Dados Específicos de Serviço
  const itemListaServico = extractTagRegex(sanitized, 'ItemListaServico') 
    || extractTagRegex(sanitized, 'cTribNac') 
    || extractTagRegex(sanitized, 'cServ') 
    || extractTagRegex(sanitized, 'CodigoServico') 
    || extractTagRegex(sanitized, 'CodigoTributacaoMunicipio')
    || extractTagRegex(sanitized, 'CodigoCnae')
    || '170501';

  const discriminacaoServico = extractTagRegex(sanitized, 'Discriminacao') 
    || extractTagRegex(sanitized, 'xDescServ') 
    || extractTagRegex(sanitized, 'xTribNac') 
    || extractTagRegex(sanitized, 'xDisc') 
    || extractTagRegex(sanitized, 'discriminacao')
    || (tipoDoc === 'NFSe' ? 'Prestação de Serviços Profissionais / Técnicos' : 'Mercadoria / Operação Fiscal');

  // Protocolo SEFAZ
  const protocoloSefaz = extractTagRegex(sanitized, 'nProt') || extractTagRegex(sanitized, 'CodigoVerificacao') || '';
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
    const cfop = extractTagRegex(prodXml, 'CFOP') || (tipoDoc === 'CTe' ? '5353' : (tipoDoc === 'NFSe' ? '1933' : '5102'));
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
    const itemIbsUf = parseFloat(extractSubTagRegex(detXml, 'gIBSUF', 'vIBSUF') || extractTagRegex(detXml, 'vIBSUF') || '0') || 0;
    const itemAliqIbsUf = parseFloat(extractSubTagRegex(detXml, 'gIBSUF', 'pIBSUF') || extractTagRegex(detXml, 'pIBSUF') || '0') || 0;
    const itemIbsMun = parseFloat(extractSubTagRegex(detXml, 'gIBSMun', 'vIBSMun') || extractTagRegex(detXml, 'vIBSMun') || '0') || 0;
    const itemAliqIbsMun = parseFloat(extractSubTagRegex(detXml, 'gIBSMun', 'pIBSMun') || extractTagRegex(detXml, 'pIBSMun') || '0') || 0;
    const itemAliqCbs = parseFloat(extractSubTagRegex(detXml, 'IBSCBS', 'pCBS') || extractSubTagRegex(detXml, 'gCBS', 'pCBS') || extractTagRegex(detXml, 'pCBS') || '0') || 0;
    const itemAliqIbs = parseFloat(extractSubTagRegex(detXml, 'IBSCBS', 'pIBS') || extractSubTagRegex(detXml, 'gIBS', 'pIBS') || extractTagRegex(detXml, 'pIBS') || `${itemAliqIbsUf + itemAliqIbsMun}`) || 0;
    
    // NUNCA defaultar cClassTrib para '000001'! Se não constar no XML, é vazio.
    const itemClassTrib = extractSubTagRegex(detXml, 'IBSCBS', 'cClassTrib') || extractTagRegex(detXml, 'cClassTrib') || '';
    const itemCst = extractSubTagRegex(detXml, 'IBSCBS', 'CST') || extractTagRegex(detXml, 'CST') || '';
    const itemIndOper = extractSubTagRegex(detXml, 'IBSCBS', 'indOper') || extractTagRegex(detXml, 'indOper') || extractTagRegex(sanitized, 'indOper') || extractTagRegex(sanitized, 'indPres') || '';
    const natOpDoc = extractTagRegex(sanitized, 'natOp') || '';

    itens.push({
      numeroItem: numItem,
      codigo: cProd,
      descricao: xProd,
      ncm,
      cest,
      cfop,
      cClassTrib: itemClassTrib,
      cstCsosn: itemCst,
      naturezaOperacao: natOpDoc,
      indOper: itemIndOper,
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
      baseCbs: parseFloat(
        extractSubTagRegex(detXml, 'gIBSCBS', 'vBC')
        || extractSubTagRegex(detXml, 'IBSCBS', 'vBC')
        || extractSubTagRegex(detXml, 'gCBS', 'vBC')
        || extractSubTagRegex(detXml, 'CBS', 'vBC')
        || '0'
      ) || 0,
      aliquotaCbs: itemAliqCbs,
      valorCbs: itemCbs,
      baseIbs: parseFloat(
        extractSubTagRegex(detXml, 'gIBSCBS', 'vBC')
        || extractSubTagRegex(detXml, 'IBSCBS', 'vBC')
        || extractSubTagRegex(detXml, 'gIBS', 'vBC')
        || extractSubTagRegex(detXml, 'IBS', 'vBC')
        || '0'
      ) || 0,
      aliquotaIbs: itemAliqIbs,
      valorIbs: itemIbs,
      valorIbsUf: itemIbsUf,
      aliquotaIbsUf: itemAliqIbsUf,
      valorIbsMun: itemIbsMun,
      aliquotaIbsMun: itemAliqIbsMun,
      valorIs: 0,
    });
  });

  // 10. Se for NFS-e ou não tiver itens <det>, gerar o item analítico do serviço
  if (itens.length === 0 && valorTotal > 0) {
    const totalRetencoes = valorIrrf + valorInss + valorIss + valorCsll + valorPis + valorCofins;
    const valorLiquido = valorTotal - totalRetencoes;

    itens.push({
      numeroItem: 1,
      codigo: itemListaServico,
      descricao: discriminacaoServico,
      ncm: '',
      cest: '',
      cfop: '',
      cClassTrib: extractTagRegex(sanitized, 'cClassTrib') || '',
      cstCsosn: extractTagRegex(sanitized, 'CST') || '',
      naturezaOperacao: extractTagRegex(sanitized, 'natOp') || '',
      indOper: extractTagRegex(sanitized, 'indOper') || '',
      quantidade: 1,
      unidade: 'UN',
      valorUnitario: valorTotal,
      valorBruto: valorTotal,
      desconto: 0,
      freteSeguro: 0,
      valorLiquido: valorLiquido > 0 ? valorLiquido : valorTotal,
      baseIcms: 0,
      aliquotaIcms: 0,
      valorIcms: 0,
      baseIpi: 0,
      aliquotaIpi: 0,
      valorIpi: 0,
      basePis: parseValor(extractSubTagRegex(sanitized, 'PIS', 'vBC') || extractTagRegex(sanitized, 'vBCPIS') || '0'),
      aliquotaPis: parseValor(extractSubTagRegex(sanitized, 'PIS', 'pPIS') || extractTagRegex(sanitized, 'pPIS') || '0'),
      valorPis,
      baseCofins: parseValor(extractSubTagRegex(sanitized, 'COFINS', 'vBC') || extractTagRegex(sanitized, 'vBCCOFINS') || '0'),
      aliquotaCofins: parseValor(extractSubTagRegex(sanitized, 'COFINS', 'pCOFINS') || extractTagRegex(sanitized, 'pCOFINS') || '0'),
      valorCofins,
      baseCbs,
      aliquotaCbs: aliquotaCbsGlobal,
      valorCbs,
      baseIbs,
      aliquotaIbs: aliquotaIbsGlobal,
      valorIbs,
      valorIbsUf,
      aliquotaIbsUf,
      valorIbsMun,
      aliquotaIbsMun,
      valorIs: 0,
    });
  }

  // Se os totalizadores de CBS/IBS globais vieram 0, soma dos itens
  if (valorCbs === 0 && itens.length > 0) {
    const somaCbs = itens.reduce((acc, it) => acc + (it.valorCbs || 0), 0);
    if (somaCbs > 0) valorCbs = Number(somaCbs.toFixed(2));
  }
  if (valorIbs === 0 && itens.length > 0) {
    const somaIbs = itens.reduce((acc, it) => acc + (it.valorIbs || 0), 0);
    if (somaIbs > 0) valorIbs = Number(somaIbs.toFixed(2));
  }

  // Se o totalizador de IPI veio 0 mas os itens possuem IPI destacado, totaliza a partir dos itens
  if (valorIpi === 0 && itens.length > 0) {
    const somaIpi = itens.reduce((acc, it) => acc + (it.valorIpi || 0), 0);
    if (somaIpi > 0) valorIpi = Number(somaIpi.toFixed(2));
  }
  // Se o totalizador de ICMS veio 0 mas os itens possuem ICMS, totaliza a partir dos itens
  if (valorIcms === 0 && itens.length > 0) {
    const somaIcms = itens.reduce((acc, it) => acc + (it.valorIcms || 0), 0);
    if (somaIcms > 0) valorIcms = Number(somaIcms.toFixed(2));
  }
  // Se o totalizador de PIS veio 0 mas os itens possuem PIS, totaliza a partir dos itens
  if (valorPis === 0 && itens.length > 0) {
    const somaPis = itens.reduce((acc, it) => acc + (it.valorPis || 0), 0);
    if (somaPis > 0) valorPis = Number(somaPis.toFixed(2));
  }
  // Se o totalizador de COFINS veio 0 mas os itens possuem COFINS, totaliza a partir dos itens
  if (valorCofins === 0 && itens.length > 0) {
    const somaCofins = itens.reduce((acc, it) => acc + (it.valorCofins || 0), 0);
    if (somaCofins > 0) valorCofins = Number(somaCofins.toFixed(2));
  }

  // Se as bases de cálculo de CBS/IBS globais vieram 0, soma dos itens
  if (baseCbs === 0 && itens.length > 0) {
    const somaBaseCbs = itens.reduce((acc, it) => acc + (it.baseCbs || 0), 0);
    if (somaBaseCbs > 0) baseCbs = Number(somaBaseCbs.toFixed(2));
  }
  if (baseIbs === 0 && itens.length > 0) {
    const somaBaseIbs = itens.reduce((acc, it) => acc + (it.baseIbs || 0), 0);
    if (somaBaseIbs > 0) baseIbs = Number(somaBaseIbs.toFixed(2));
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
    direcaoMovimento,
    tomadorCnpj,
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
    valorIbsUf,
    aliquotaIbsUf,
    valorIbsMun,
    aliquotaIbsMun,
    baseCbs,
    baseIbs,
    valorIs,
    valorIrrf,
    valorInss,
    valorIss,
    valorCsll,
    regimeTributario,
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

  const isEvento = sanitized.includes('procEventoNFe') 
    || sanitized.includes('procEventoCTe')
    || sanitized.includes('resEvento')
    || sanitized.includes('retEvento')
    || sanitized.includes('infEvento')
    || sanitized.includes('evento');

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
