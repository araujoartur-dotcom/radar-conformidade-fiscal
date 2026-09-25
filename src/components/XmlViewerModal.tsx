import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  Code,
  FileText,
  Search,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Building2,
  Package,
  Receipt,
  ShieldCheck,
  Sparkles,
  Layers,
  Printer,
  Truck,
  CreditCard,
  Info,
  Maximize2,
  Minimize2,
  Flame,
  Scale,
  Users,
  Boxes,
  FileCheck,
  Tag,
  ArrowUpRight,
  ArrowDownLeft,
  Coins
} from 'lucide-react';
import { DfeXmlItem } from '../types';
import { generateDfeXmlContent } from '../utils/xmlParser';
import { generateCode128C_SVG, formatChaveAcesso44 } from '../utils/danfeCode128';

interface XmlViewerModalProps {
  item: DfeXmlItem | null;
  onClose: () => void;
}

/* ─────────────────────────────────────────────────────────────────────────
   Utilitários de Extração Segura do DOM XML (Compliance Estrito / Zero Fallback)
   ───────────────────────────────────────────────────────────────────────── */
function getTag(node: Element | Document | null, tag: string): string {
  if (!node) return '';
  const el = node.getElementsByTagName(tag)[0];
  return el ? el.textContent?.trim() || '' : '';
}

function getSubTag(node: Element | Document | null, parentTag: string, childTag: string): string {
  if (!node) return '';
  const parent = node.getElementsByTagName(parentTag)[0];
  if (!parent) return '';
  const child = parent.getElementsByTagName(childTag)[0];
  return child ? child.textContent?.trim() || '' : '';
}

function parseNum(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val || typeof val !== 'string') return 0;
  const clean = val.replace(/<[^>]+>/g, '').trim().replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

const fmtBrl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtBrl2 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum4 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/* ─────────────────────────────────────────────────────────────────────────
   Tabelas de Domínio Canônicas da SEFAZ & RTC
   ───────────────────────────────────────────────────────────────────────── */
const MOD_FRETE_MAP: Record<string, string> = {
  '0': '0 - Contratação do Frete por conta do Remetente (CIF)',
  '1': '1 - Contratação do Frete por conta do Destinatário (FOB)',
  '2': '2 - Contratação do Frete por conta de Terceiros',
  '3': '3 - Transporte Próprio por conta do Remetente',
  '4': '4 - Transporte Próprio por conta do Destinatário',
  '9': '9 - Sem Ocorrência de Transporte'
};

const FORMA_PAGTO_MAP: Record<string, string> = {
  '01': 'Dinheiro',
  '02': 'Cheque',
  '03': 'Cartão de Crédito',
  '04': 'Cartão de Débito',
  '05': 'Crédito Loja',
  '10': 'Vale Alimentação',
  '11': 'Vale Refeição',
  '12': 'Vale Presente',
  '13': 'Vale Combustível',
  '14': 'Duplicata Mercantil',
  '15': 'Boleto Bancário',
  '16': 'Depósito Bancário',
  '17': 'PIX (Pagamento Instantâneo)',
  '18': 'Transferência Bancária / Carteira Digital',
  '19': 'Programa de Fidelidade / Cashback',
  '90': 'Sem Pagamento',
  '99': 'Outros'
};

const CRT_MAP: Record<string, string> = {
  '1': '1 - Simples Nacional',
  '2': '2 - Simples Nacional (Excesso de Sublimite)',
  '3': '3 - Regime Normal (Lucro Presumido / Lucro Real)',
  '4': '4 - MEI (Microempreendedor Individual)'
};

const ORIGEM_MERCADORIA_MAP: Record<string, string> = {
  '0': '0 - Nacional',
  '1': '1 - Estrangeira (Importação direta)',
  '2': '2 - Estrangeira (Adquirida no mercado interno)',
  '3': '3 - Nacional (Conteúdo Importação > 40%)',
  '4': '4 - Nacional (Produção conforme processo produtivo básico)',
  '5': '5 - Nacional (Conteúdo Importação <= 40%)',
  '6': '6 - Estrangeira (Importação direta sem similar)',
  '7': '7 - Estrangeira (Mercado interno sem similar)',
  '8': '8 - Nacional (Conteúdo Importação > 70%)'
};

const FIN_NFE_MAP: Record<string, string> = {
  '1': '1 - NF-e Normal',
  '2': '2 - NF-e Complementar',
  '3': '3 - NF-e de Ajuste',
  '4': '4 - Devolução de Mercadoria'
};

const IND_PRES_MAP: Record<string, string> = {
  '0': '0 - Não se aplica',
  '1': '1 - Operação presencial',
  '2': '2 - Operação não presencial (Internet)',
  '3': '3 - Operação não presencial (Teleatendimento)',
  '4': '4 - NFC-e com entrega a domicílio',
  '5': '5 - Operação presencial, fora do estabelecimento',
  '9': '9 - Operação não presencial (Outros)'
};

const IND_IEDEST_MAP: Record<string, string> = {
  '1': '1 - Contribuinte ICMS',
  '2': '2 - Contribuinte Isento de Inscrição',
  '9': '9 - Não Contribuinte (Pode ou não possuir IE)'
};

/**
 * Utilitário de formatação inteligente (Pretty-Print) para XMLs da SEFAZ
 */
function formatXmlPretty(xml: string, collapseBase64: boolean = true): string[] {
  if (!xml) return [];
  let clean = xml.trim().replace(/>\s*</g, '><');

  if (collapseBase64) {
    clean = clean.replace(/<X509Certificate>([A-Za-z0-9+/=\s]{40,})<\/X509Certificate>/g, (_, b64) => {
      const short = b64.trim().substring(0, 28);
      return `<X509Certificate>${short}... [Certificado Digital ICP-Brasil: ${b64.trim().length} bytes]</X509Certificate>`;
    });
    clean = clean.replace(/<SignatureValue>([A-Za-z0-9+/=\s]{40,})<\/SignatureValue>/g, (_, b64) => {
      const short = b64.trim().substring(0, 24);
      return `<SignatureValue>${short}... [Assinatura Digital RSA/SHA-256]</SignatureValue>`;
    });
  }

  const tokens = clean
    .replace(/(<[^\/>]+>)/g, '\n$1')
    .replace(/(<\/[^>]+>)/g, '$1\n')
    .replace(/(<[^\/>]+\/>)/g, '\n$1\n');

  const rawLines = tokens.split('\n').map(l => l.trim()).filter(Boolean);
  const formatted: string[] = [];
  let indent = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (line.startsWith('</')) {
      indent = Math.max(0, indent - 1);
    }
    const pad = '  '.repeat(indent);

    if (
      i + 2 < rawLines.length &&
      line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>') &&
      !rawLines[i + 1].startsWith('<') &&
      rawLines[i + 2].startsWith('</')
    ) {
      const openTagMatch = line.match(/^<([a-zA-Z0-9_:-]+)(?:\s+[^>]*)?>$/);
      const closeTagMatch = rawLines[i + 2].match(/^<\/([a-zA-Z0-9_:-]+)>$/);

      if (openTagMatch && closeTagMatch && openTagMatch[1] === closeTagMatch[1]) {
        formatted.push(`${pad}${line}${rawLines[i + 1]}${rawLines[i + 2]}`);
        i += 2;
        continue;
      }
    }

    if (/<([a-zA-Z0-9_:-]+)[^>]*>.*<\/\1>/.test(line) || line.endsWith('/>') || line.startsWith('<?') || line.startsWith('<!')) {
      formatted.push(`${pad}${line}`);
      continue;
    }

    formatted.push(`${pad}${line}`);

    if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>') && !line.startsWith('<?') && !line.startsWith('<!')) {
      indent++;
    }
  }

  return formatted;
}

export const XmlViewerModal: React.FC<XmlViewerModalProps> = ({ item, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [copiedChave, setCopiedChave] = useState(false);
  const [copiedRefKey, setCopiedRefKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'danfe' | 'formatted'>('tree');
  const [collapseBase64, setCollapseBase64] = useState<boolean>(true);
  const [activeHighlightTag, setActiveHighlightTag] = useState<string | null>(null);
  const [itemsPageSize, setItemsPageSize] = useState<number>(30);

  // Controle de Seções Expandidas na Árvore
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    ide: true,
    emit: true,
    dest: true,
    det: true,
    total: true,
    IBSCBS: true,
    transp: true,
    cobr: true,
    infAdic: true,
    Signature: false
  });

  const codeContainerRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const rawXmlContent = useMemo(() => {
    if (!item) return '';
    return item.xmlRaw || generateDfeXmlContent(item);
  }, [item]);

  // Parser DOM profundo para extrair 100% dos nós oficiais do XML
  const xmlData = useMemo(() => {
    if (!rawXmlContent) return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawXmlContent, 'text/xml');

      const isCte = doc.getElementsByTagName('infCte').length > 0 || doc.getElementsByTagName('cteProc').length > 0 || item?.tipo === 'CTe';
      const isNfse = doc.getElementsByTagName('CompNfse').length > 0 || doc.getElementsByTagName('tcDeclaracaoPrestacaoServico').length > 0 || doc.getElementsByTagName('Nfse').length > 0 || item?.tipo === 'NFSe';

      // 1. Identificação (<ide>)
      const tpNF = getSubTag(doc, 'ide', 'tpNF') || getTag(doc, 'tpNF') || (item?.tipo === 'NFe' ? '1' : '');
      const natOp = getSubTag(doc, 'ide', 'natOp') || getTag(doc, 'natOp') || 'Operação Fiscal';
      const mod = getSubTag(doc, 'ide', 'mod') || getTag(doc, 'mod') || (item?.tipo === 'CTe' ? '57' : item?.tipo === 'NFCe' ? '65' : item?.tipo === 'NFSe' ? 'NFS-e' : '55');
      const serie = item?.serie || getSubTag(doc, 'ide', 'serie') || getTag(doc, 'serie') || '1';
      const nNF = item?.numero || getSubTag(doc, 'ide', 'nNF') || getSubTag(doc, 'ide', 'nCT') || getTag(doc, 'nNF') || getTag(doc, 'Numero');
      const cNF = getSubTag(doc, 'ide', 'cNF') || getTag(doc, 'cNF');
      const cDV = getSubTag(doc, 'ide', 'cDV') || getTag(doc, 'cDV');
      const cUF = getSubTag(doc, 'ide', 'cUF') || getTag(doc, 'cUF');
      const cMunFG = getSubTag(doc, 'ide', 'cMunFG') || getTag(doc, 'cMunFG');
      const tpAmb = getSubTag(doc, 'ide', 'tpAmb') || getTag(doc, 'tpAmb') || '1';
      const finNFe = getSubTag(doc, 'ide', 'finNFe') || getTag(doc, 'finNFe') || '1';
      const indFinal = getSubTag(doc, 'ide', 'indFinal') || getTag(doc, 'indFinal') || '0';
      const indPres = getSubTag(doc, 'ide', 'indPres') || getTag(doc, 'indPres') || '';
      const tpImp = getSubTag(doc, 'ide', 'tpImp') || getTag(doc, 'tpImp') || '1';
      const tpEmis = getSubTag(doc, 'ide', 'tpEmis') || getTag(doc, 'tpEmis') || '1';
      const procEmi = getSubTag(doc, 'ide', 'procEmi') || getTag(doc, 'procEmi') || '0';
      const verProc = getSubTag(doc, 'ide', 'verProc') || getTag(doc, 'verProc') || '';
      const dhEmi = item?.dataEmissao || getSubTag(doc, 'ide', 'dhEmi') || getTag(doc, 'dhEmi') || getTag(doc, 'DataEmissao') || '';
      const dhSaiEnt = getSubTag(doc, 'ide', 'dhSaiEnt') || getTag(doc, 'dhSaiEnt') || getTag(doc, 'dSaiEnt');

      // Protocolo SEFAZ (<protNFe> ou <protCTe>)
      const nProt = getTag(doc, 'nProt');
      const dhRecbto = getTag(doc, 'dhRecbto') || item?.dataEmissao || '';
      const cStat = getTag(doc, 'cStat') || '100';
      const xMotivo = getTag(doc, 'xMotivo') || 'Autorizado o uso do DF-e';
      const digVal = getTag(doc, 'digVal');

      // 2. Emitente (<emit> ou <PrestadorServico>)
      const emitCnpj = getSubTag(doc, 'emit', 'CNPJ') || getSubTag(doc, 'emit', 'CPF') || getSubTag(doc, 'PrestadorServico', 'Cnpj') || item?.emitenteCnpj || '';
      const emitNome = getSubTag(doc, 'emit', 'xNome') || getSubTag(doc, 'PrestadorServico', 'RazaoSocial') || item?.emitenteNome || '';
      const emitFant = getSubTag(doc, 'emit', 'xFant') || getSubTag(doc, 'PrestadorServico', 'NomeFantasia') || '';
      const emitIe = getSubTag(doc, 'emit', 'IE') || item?.emitenteIe || '';
      const emitIest = getSubTag(doc, 'emit', 'IEST') || '';
      const emitIm = getSubTag(doc, 'emit', 'IM') || getSubTag(doc, 'PrestadorServico', 'InscricaoMunicipal') || '';
      const emitCnae = getSubTag(doc, 'emit', 'CNAE') || '';
      const emitCrt = getSubTag(doc, 'emit', 'CRT') || '';
      const emitLgr = getSubTag(doc, 'enderEmit', 'xLgr') || getSubTag(doc, 'Endereco', 'Endereco');
      const emitNro = getSubTag(doc, 'enderEmit', 'nro') || getSubTag(doc, 'Endereco', 'Numero');
      const emitCpl = getSubTag(doc, 'enderEmit', 'xCpl') || getSubTag(doc, 'Endereco', 'Complemento');
      const emitBairro = getSubTag(doc, 'enderEmit', 'xBairro') || getSubTag(doc, 'Endereco', 'Bairro');
      const emitMun = getSubTag(doc, 'enderEmit', 'xMun') || getSubTag(doc, 'Endereco', 'Municipio');
      const emitUf = getSubTag(doc, 'enderEmit', 'UF') || getSubTag(doc, 'Endereco', 'Uf') || item?.emitenteUf || '';
      const emitCep = getSubTag(doc, 'enderEmit', 'CEP') || getSubTag(doc, 'Endereco', 'Cep');
      const emitFone = getSubTag(doc, 'enderEmit', 'fone') || getSubTag(doc, 'Contato', 'Telefone');

      // 3. Destinatário / Tomador (<dest>, <rem>, <toma3>, <toma4>, <TomadorServico>)
      const destCnpj = getSubTag(doc, 'dest', 'CNPJ') || getSubTag(doc, 'dest', 'CPF') || getSubTag(doc, 'dest', 'idEstrangeiro') || getSubTag(doc, 'TomadorServico', 'Cnpj') || getSubTag(doc, 'TomadorServico', 'Cpf') || item?.destinatarioCnpj || '';
      const destNome = getSubTag(doc, 'dest', 'xNome') || getSubTag(doc, 'TomadorServico', 'RazaoSocial') || item?.destinatarioNome || '';
      const destIe = getSubTag(doc, 'dest', 'IE') || item?.destinatarioIe || '';
      const destIndIEDest = getSubTag(doc, 'dest', 'indIEDest') || '';
      const destIsuf = getSubTag(doc, 'dest', 'ISUF') || '';
      const destEmail = getSubTag(doc, 'dest', 'email');
      const destLgr = getSubTag(doc, 'enderDest', 'xLgr');
      const destNro = getSubTag(doc, 'enderDest', 'nro');
      const destCpl = getSubTag(doc, 'enderDest', 'xCpl');
      const destBairro = getSubTag(doc, 'enderDest', 'xBairro');
      const destMun = getSubTag(doc, 'enderDest', 'xMun');
      const destUf = getSubTag(doc, 'enderDest', 'UF') || item?.destinatarioUf || '';
      const destCep = getSubTag(doc, 'enderDest', 'CEP');
      const destFone = getSubTag(doc, 'enderDest', 'fone');

      // CT-e Remetente e Tomador
      const remNome = getSubTag(doc, 'rem', 'xNome');
      const remCnpj = getSubTag(doc, 'rem', 'CNPJ') || getSubTag(doc, 'rem', 'CPF');
      const remUf = getSubTag(doc, 'enderReme', 'UF') || getSubTag(doc, 'rem', 'UF');
      const tomaCod = getSubTag(doc, 'toma3', 'toma') || getSubTag(doc, 'toma4', 'toma');
      const tomaCnpj = getSubTag(doc, 'toma4', 'CNPJ') || getSubTag(doc, 'toma4', 'CPF') || (item as any)?.tomadorCnpj || '';
      const tomaNome = getSubTag(doc, 'toma4', 'xNome') || (tomaCod === '0' ? 'Remetente' : tomaCod === '3' ? 'Destinatário' : tomaCod ? `Código ${tomaCod}` : '');

      // 4. Itens (<det>) com Grade Tributária Detalhada por Item
      const detNodes = doc.getElementsByTagName('det');
      const itensDet: any[] = [];

      for (let i = 0; i < detNodes.length; i++) {
        const det = detNodes[i];
        const numItem = parseInt(det.getAttribute('nItem') || `${i + 1}`, 10);
        const prod = det.getElementsByTagName('prod')[0];

        const cProd = prod ? getTag(prod, 'cProd') : '';
        const cEAN = prod ? getTag(prod, 'cEAN') : '';
        const xProd = prod ? getTag(prod, 'xProd') : '';
        const ncm = prod ? getTag(prod, 'NCM') : '';
        const cest = prod ? getTag(prod, 'CEST') : '';
        const cfop = prod ? getTag(prod, 'CFOP') : '';
        const uCom = prod ? getTag(prod, 'uCom') : '';
        const qCom = prod ? parseNum(getTag(prod, 'qCom')) : 0;
        const vUnCom = prod ? parseNum(getTag(prod, 'vUnCom')) : 0;
        const vProdItem = prod ? parseNum(getTag(prod, 'vProd')) : 0;
        const cEANTrib = prod ? getTag(prod, 'cEANTrib') : '';
        const uTrib = prod ? getTag(prod, 'uTrib') : '';
        const qTrib = prod ? parseNum(getTag(prod, 'qTrib')) : 0;
        const vUnTrib = prod ? parseNum(getTag(prod, 'vUnTrib')) : 0;
        const vDescItem = prod ? parseNum(getTag(prod, 'vDesc')) : 0;
        const vFreteItem = prod ? parseNum(getTag(prod, 'vFrete')) : 0;
        const vSegItem = prod ? parseNum(getTag(prod, 'vSeg')) : 0;
        const vOutroItem = prod ? parseNum(getTag(prod, 'vOutro')) : 0;
        const indTot = prod ? getTag(prod, 'indTot') : '1';
        const xPed = prod ? getTag(prod, 'xPed') : '';
        const nItemPed = prod ? getTag(prod, 'nItemPed') : '';
        const infAdProd = getTag(det, 'infAdProd');

        // Combustíveis (<comb>)
        const comb = det.getElementsByTagName('comb')[0];
        const cProdANP = comb ? getTag(comb, 'cProdANP') : '';
        const descANP = comb ? getTag(comb, 'descANP') : '';
        const qBCMono = comb ? parseNum(getTag(comb, 'qBCMono')) : 0;
        const adRemICMS = comb ? parseNum(getTag(comb, 'adRemICMS')) : 0;
        const vICMSMono = comb ? parseNum(getTag(comb, 'vICMSMono')) : 0;
        const qBCMonoRet = comb ? parseNum(getTag(comb, 'qBCMonoRet')) : 0;
        const adRemICMSRet = comb ? parseNum(getTag(comb, 'adRemICMSRet')) : 0;
        const vICMSMonoRet = comb ? parseNum(getTag(comb, 'vICMSMonoRet')) : 0;

        // Rastreabilidade de Lote (<rastro>)
        const rastro = det.getElementsByTagName('rastro')[0];
        const nLote = rastro ? getTag(rastro, 'nLote') : '';
        const qLote = rastro ? parseNum(getTag(rastro, 'qLote')) : 0;
        const dFab = rastro ? getTag(rastro, 'dFab') : '';
        const dVal = rastro ? getTag(rastro, 'dVal') : '';

        // ICMS
        const icms = det.getElementsByTagName('ICMS')[0];
        const cstIcms = icms ? (getTag(icms, 'CST') || getTag(icms, 'CSOSN') || '') : '';
        const origIcms = icms ? getTag(icms, 'orig') : '';
        const modBC = icms ? getTag(icms, 'modBC') : '';
        const vBCIcms = icms ? parseNum(getTag(icms, 'vBC')) : 0;
        const pIcms = icms ? parseNum(getTag(icms, 'pICMS')) : 0;
        const vIcms = icms ? parseNum(getTag(icms, 'vICMS')) : 0;
        const pRedBC = icms ? parseNum(getTag(icms, 'pRedBC')) : 0;
        const vBCST = icms ? parseNum(getTag(icms, 'vBCST')) : 0;
        const pMVAST = icms ? parseNum(getTag(icms, 'pMVAST')) : 0;
        const pRedBCST = icms ? parseNum(getTag(icms, 'pRedBCST')) : 0;
        const pICMSST = icms ? parseNum(getTag(icms, 'pICMSST')) : 0;
        const vICMSST = icms ? parseNum(getTag(icms, 'vICMSST')) : 0;
        const vBCFCP = icms ? parseNum(getTag(icms, 'vBCFCP')) : 0;
        const pFCP = icms ? parseNum(getTag(icms, 'pFCP')) : 0;
        const vFCP = icms ? parseNum(getTag(icms, 'vFCP')) : 0;
        const vICMSDeson = icms ? parseNum(getTag(icms, 'vICMSDeson')) : 0;
        const motDesICMS = icms ? getTag(icms, 'motDesICMS') : '';

        // IPI
        const ipi = det.getElementsByTagName('IPI')[0];
        const cstIpi = ipi ? getTag(ipi, 'CST') : '';
        const cEnq = ipi ? getTag(ipi, 'cEnq') : '';
        const vBCIpi = ipi ? parseNum(getTag(ipi, 'vBC')) : 0;
        const pIpi = ipi ? parseNum(getTag(ipi, 'pIPI')) : 0;
        const vIpi = ipi ? parseNum(getTag(ipi, 'vIPI')) : 0;

        // PIS
        const pis = det.getElementsByTagName('PIS')[0];
        const cstPis = pis ? getTag(pis, 'CST') : '';
        const vBCPis = pis ? parseNum(getTag(pis, 'vBC')) : 0;
        const pPis = pis ? parseNum(getTag(pis, 'pPIS')) : 0;
        const vPis = pis ? parseNum(getTag(pis, 'vPIS')) : 0;

        // COFINS
        const cofins = det.getElementsByTagName('COFINS')[0];
        const cstCofins = cofins ? getTag(cofins, 'CST') : '';
        const vBCCofins = cofins ? parseNum(getTag(cofins, 'vBC')) : 0;
        const pCofins = cofins ? parseNum(getTag(cofins, 'pCOFINS')) : 0;
        const vCofins = cofins ? parseNum(getTag(cofins, 'vCOFINS')) : 0;

        // RTC — CBS e IBS (Reforma Tributária LC 214 / NT 2025.002)
        const ibsCbs = det.getElementsByTagName('IBSCBS')[0] || det.getElementsByTagName('gIBSCBS')[0];
        const cClassTrib = ibsCbs ? getTag(ibsCbs, 'cClassTrib') : '';
        const vBCCbs = ibsCbs ? parseNum(getTag(ibsCbs, 'vBC') || getTag(ibsCbs, 'vBCCBS')) : 0;
        const pCbs = ibsCbs ? parseNum(getTag(ibsCbs, 'pCBS')) : 0;
        const vCbs = ibsCbs ? parseNum(getTag(ibsCbs, 'vCBS')) : 0;
        const vBCIbs = ibsCbs ? parseNum(getTag(ibsCbs, 'vBC') || getTag(ibsCbs, 'vBCIBS')) : 0;
        const pIbs = ibsCbs ? parseNum(getTag(ibsCbs, 'pIBS')) : 0;
        const vIbs = ibsCbs ? parseNum(getTag(ibsCbs, 'vIBS')) : 0;
        const pIbsUF = ibsCbs ? parseNum(getTag(ibsCbs, 'pIBSUF')) : 0;
        const vIbsUF = ibsCbs ? parseNum(getTag(ibsCbs, 'vIBSUF')) : 0;
        const pIbsMun = ibsCbs ? parseNum(getTag(ibsCbs, 'pIBSMun')) : 0;
        const vIbsMun = ibsCbs ? parseNum(getTag(ibsCbs, 'vIBSMun')) : 0;
        const indOper = ibsCbs ? getTag(ibsCbs, 'indOper') : '';
        const pIS = ibsCbs ? parseNum(getTag(ibsCbs, 'pIS')) : 0;
        const vIS = ibsCbs ? parseNum(getTag(ibsCbs, 'vIS')) : 0;

        itensDet.push({
          numeroItem: numItem,
          codigo: cProd,
          cEAN,
          cEANTrib,
          descricao: xProd,
          infAdProd,
          ncm,
          cest,
          cfop,
          unidade: uCom,
          quantidade: qCom,
          valorUnitario: vUnCom,
          valorTotal: vProdItem,
          uTrib,
          qTrib,
          vUnTrib,
          valorDesconto: vDescItem,
          valorFrete: vFreteItem,
          valorSeguro: vSegItem,
          valorOutro: vOutroItem,
          indTot,
          xPed,
          nItemPed,
          nLote,
          qLote,
          dFab,
          dVal,
          cProdANP,
          descANP,
          qBCMono,
          adRemICMS,
          vICMSMono,
          qBCMonoRet,
          adRemICMSRet,
          vICMSMonoRet,
          cstIcms,
          origIcms,
          modBC,
          vBCIcms,
          pIcms,
          vIcms,
          pRedBC,
          vBCST,
          pMVAST,
          pRedBCST,
          pICMSST,
          vICMSST,
          vBCFCP,
          pFCP,
          vFCP,
          vICMSDeson,
          motDesICMS,
          cstIpi,
          cEnq,
          vBCIpi,
          pIpi,
          vIpi,
          cstPis,
          vBCPis,
          pPis,
          vPis,
          cstCofins,
          vBCCofins,
          pCofins,
          vCofins,
          cClassTrib,
          vBCCbs,
          pCbs,
          vCbs,
          vBCIbs,
          pIbs,
          vIbs,
          pIbsUF,
          vIbsUF,
          pIbsMun,
          vIbsMun,
          indOper,
          pIS,
          vIS
        });
      }

      // Se for NFS-e sem tag <det>, extrair dados de serviço
      if (itensDet.length === 0 && isNfse) {
        const xServico = getTag(doc, 'Discriminacao') || item?.naturezaOperacao || 'Prestação de Serviços';
        const vServicos = parseNum(getTag(doc, 'ValorServicos')) || item?.valorTotal || 0;
        const vIss = parseNum(getTag(doc, 'ValorIss')) || 0;
        const pIss = parseNum(getTag(doc, 'Aliquota')) || 0;
        const itemLista = getTag(doc, 'ItemListaServico');
        const cTribMun = getTag(doc, 'CodigoTributacaoMunicipio');

        itensDet.push({
          numeroItem: 1,
          codigo: itemLista || 'SERV-01',
          cEAN: '',
          cEANTrib: '',
          descricao: xServico,
          infAdProd: cTribMun ? `Código Tributação Municipal: ${cTribMun}` : '',
          ncm: '',
          cest: '',
          cfop: '0000',
          unidade: 'UN',
          quantidade: 1,
          valorUnitario: vServicos,
          valorTotal: vServicos,
          valorDesconto: parseNum(getTag(doc, 'DescontoIncondicionado')),
          valorFrete: 0,
          valorSeguro: 0,
          valorOutro: 0,
          cstIcms: 'ISSQN',
          vIcms: vIss,
          pIcms: pIss,
          vBCIcms: vServicos,
          cstPis: '01',
          vPis: parseNum(getTag(doc, 'ValorPis')),
          cstCofins: '01',
          vCofins: parseNum(getTag(doc, 'ValorCofins')),
          cClassTrib: '',
          vBCCbs: 0,
          pCbs: 0,
          vCbs: 0,
          vBCIbs: 0,
          pIbs: 0,
          vIbs: 0
        });
      }

      // 5. Totais (<total> / <ICMSTot>)
      const vBC = parseNum(getSubTag(doc, 'ICMSTot', 'vBC'));
      const vICMS = parseNum(getSubTag(doc, 'ICMSTot', 'vICMS')) || (item?.valorIcms || 0);
      const vICMSDeson = parseNum(getSubTag(doc, 'ICMSTot', 'vICMSDeson'));
      const vBCST = parseNum(getSubTag(doc, 'ICMSTot', 'vBCST'));
      const vST = parseNum(getSubTag(doc, 'ICMSTot', 'vST'));
      const vProd = parseNum(getSubTag(doc, 'ICMSTot', 'vProd')) || (item?.valorTotal || 0);
      const vFrete = parseNum(getSubTag(doc, 'ICMSTot', 'vFrete'));
      const vSeg = parseNum(getSubTag(doc, 'ICMSTot', 'vSeg'));
      const vDesc = parseNum(getSubTag(doc, 'ICMSTot', 'vDesc'));
      const vII = parseNum(getSubTag(doc, 'ICMSTot', 'vII'));
      const vIPI = parseNum(getSubTag(doc, 'ICMSTot', 'vIPI')) || (item?.valorIpi || 0);
      const vIPIDevol = parseNum(getSubTag(doc, 'ICMSTot', 'vIPIDevol'));
      const vPIS = parseNum(getSubTag(doc, 'ICMSTot', 'vPIS')) || (item?.valorPis || 0);
      const vCOFINS = parseNum(getSubTag(doc, 'ICMSTot', 'vCOFINS')) || (item?.valorCofins || 0);
      const vOutro = parseNum(getSubTag(doc, 'ICMSTot', 'vOutro'));
      const vNF = parseNum(getSubTag(doc, 'ICMSTot', 'vNF')) || (item?.valorTotal || 0);
      const vTotTrib = parseNum(getSubTag(doc, 'ICMSTot', 'vTotTrib'));
      const vICMSUFRemet = parseNum(getSubTag(doc, 'ICMSTot', 'vICMSUFRemet'));
      const vICMSUFDest = parseNum(getSubTag(doc, 'ICMSTot', 'vICMSUFDest'));
      const vFCPUFDest = parseNum(getSubTag(doc, 'ICMSTot', 'vFCPUFDest'));

      // Totais RTC
      const vCBS = parseNum(getSubTag(doc, 'IBSCBSTot', 'vCBS') || getSubTag(doc, 'ICMSTot', 'vCBS')) || (item?.valorCbs || 0);
      const vIBS = parseNum(getSubTag(doc, 'IBSCBSTot', 'vIBS') || getSubTag(doc, 'ICMSTot', 'vIBS')) || (item?.valorIbs || 0);
      const vIS = parseNum(getSubTag(doc, 'IBSCBSTot', 'vIS') || getSubTag(doc, 'ISTot', 'vIS')) || (item?.valorImpostoSeletivo || 0);
      const vBCCBS = parseNum(getSubTag(doc, 'IBSCBSTot', 'vBCCBS') || getSubTag(doc, 'IBSCBSTot', 'vBC'));
      const vBCIBS = parseNum(getSubTag(doc, 'IBSCBSTot', 'vBCIBS') || getSubTag(doc, 'IBSCBSTot', 'vBC'));

      // 6. Transporte (<transp>)
      const modFrete = getSubTag(doc, 'transp', 'modFrete') || getTag(doc, 'modFrete');
      const transpNome = getSubTag(doc, 'transporta', 'xNome');
      const transpCnpj = getSubTag(doc, 'transporta', 'CNPJ') || getSubTag(doc, 'transporta', 'CPF');
      const transpIe = getSubTag(doc, 'transporta', 'IE');
      const transpEnder = getSubTag(doc, 'transporta', 'xEnder');
      const transpMun = getSubTag(doc, 'transporta', 'xMun');
      const transpUf = getSubTag(doc, 'transporta', 'UF');
      const veicPlaca = getSubTag(doc, 'veicTransp', 'placa') || getTag(doc, 'placa');
      const veicUf = getSubTag(doc, 'veicTransp', 'UF');
      const veicRntc = getSubTag(doc, 'veicTransp', 'RNTC');
      const qVol = getTag(doc, 'qVol');
      const esp = getTag(doc, 'esp');
      const marca = getTag(doc, 'marca');
      const nVol = getTag(doc, 'nVol');
      const pesoB = parseNum(getTag(doc, 'pesoB'));
      const pesoL = parseNum(getTag(doc, 'pesoL'));

      // 7. Cobrança e Pagamento (<cobr> e <pag>)
      const nFat = getSubTag(doc, 'fat', 'nFat');
      const vOrigFat = parseNum(getSubTag(doc, 'fat', 'vOrig'));
      const vDescFat = parseNum(getSubTag(doc, 'fat', 'vDesc'));
      const vLiqFat = parseNum(getSubTag(doc, 'fat', 'vLiq'));

      const dupNodes = doc.getElementsByTagName('dup');
      const duplicatas: any[] = [];
      for (let i = 0; i < dupNodes.length; i++) {
        duplicatas.push({
          nDup: getTag(dupNodes[i], 'nDup'),
          dVenc: getTag(dupNodes[i], 'dVenc'),
          vDup: parseNum(getTag(dupNodes[i], 'vDup'))
        });
      }

      const tPag = getSubTag(doc, 'detPag', 'tPag') || getSubTag(doc, 'pag', 'tPag');
      const vPag = parseNum(getSubTag(doc, 'detPag', 'vPag') || getSubTag(doc, 'pag', 'vPag'));

      // 8. Informações Adicionais (<infAdic>)
      const infCpl = getTag(doc, 'infCpl');
      const infAdFisco = getTag(doc, 'infAdFisco');

      // Chaves Referenciadas
      const chavesRef: string[] = [];
      const refNFeNodes = doc.getElementsByTagName('refNFe');
      for (let i = 0; i < refNFeNodes.length; i++) {
        const val = refNFeNodes[i].textContent?.trim();
        if (val) chavesRef.push(val);
      }
      const refCTeNodes = doc.getElementsByTagName('refCTe');
      for (let i = 0; i < refCTeNodes.length; i++) {
        const val = refCTeNodes[i].textContent?.trim();
        if (val) chavesRef.push(val);
      }

      // Código de Barras SVG
      const barcodeSvg = generateCode128C_SVG(item?.chaveAcesso || '', 48, 1.1);

      return {
        isCte,
        isNfse,
        ide: {
          tpNF,
          natOp,
          mod,
          serie,
          numero: nNF,
          cNF,
          cDV,
          cUF,
          cMunFG,
          tpAmb,
          finNFe,
          indFinal,
          indPres,
          tpImp,
          tpEmis,
          procEmi,
          verProc,
          dhEmi,
          dhSaiEnt,
          nProt,
          dhRecbto,
          cStat,
          xMotivo,
          digVal
        },
        emit: {
          cnpj: emitCnpj,
          nome: emitNome,
          fant: emitFant,
          ie: emitIe,
          iest: emitIest,
          im: emitIm,
          cnae: emitCnae,
          crt: emitCrt,
          lgr: emitLgr,
          nro: emitNro,
          cpl: emitCpl,
          bairro: emitBairro,
          mun: emitMun,
          uf: emitUf,
          cep: emitCep,
          fone: emitFone
        },
        dest: {
          cnpj: destCnpj,
          nome: destNome,
          ie: destIe,
          indIEDest: destIndIEDest,
          isuf: destIsuf,
          email: destEmail,
          lgr: destLgr,
          nro: destNro,
          cpl: destCpl,
          bairro: destBairro,
          mun: destMun,
          uf: destUf,
          cep: destCep,
          fone: destFone
        },
        cte: {
          remNome,
          remCnpj,
          remUf,
          tomaCod,
          tomaCnpj,
          tomaNome
        },
        itens: itensDet,
        totais: {
          vBC,
          vICMS,
          vICMSDeson,
          vBCST,
          vST,
          vProd,
          vFrete,
          vSeg,
          vDesc,
          vII,
          vIPI,
          vIPIDevol,
          vPIS,
          vCOFINS,
          vOutro,
          vNF,
          vTotTrib,
          vICMSUFRemet,
          vICMSUFDest,
          vFCPUFDest
        },
        rtc: {
          vCBS,
          vIBS,
          vIS,
          vBCCBS,
          vBCIBS
        },
        transp: {
          modFrete,
          nome: transpNome,
          cnpj: transpCnpj,
          ie: transpIe,
          ender: transpEnder,
          mun: transpMun,
          uf: transpUf,
          placa: veicPlaca,
          veicUf,
          rntc: veicRntc,
          qVol,
          esp,
          marca,
          nVol,
          pesoB,
          pesoL
        },
        cobr: {
          nFat,
          vOrigFat,
          vDescFat,
          vLiqFat,
          duplicatas,
          tPag,
          vPag
        },
        infAdic: {
          infCpl,
          infAdFisco,
          chavesRef
        },
        barcodeSvg
      };
    } catch (err) {
      console.warn('Erro ao parsear XML para árvore detalhada:', err);
      return null;
    }
  }, [rawXmlContent, item]);

  // Linhas formatadas para o modo código puro
  const formattedLines = useMemo(() => {
    if (!rawXmlContent) return [];
    return formatXmlPretty(rawXmlContent, collapseBase64);
  }, [rawXmlContent, collapseBase64]);

  // Filtro de itens em tempo real com busca otimizada
  const filteredItens = useMemo(() => {
    if (!xmlData?.itens) return [];
    if (!searchTerm.trim()) return xmlData.itens;
    const term = searchTerm.toLowerCase();
    return xmlData.itens.filter((it: any) =>
      it.descricao?.toLowerCase().includes(term) ||
      it.codigo?.toLowerCase().includes(term) ||
      it.ncm?.toLowerCase().includes(term) ||
      it.cfop?.toLowerCase().includes(term) ||
      it.cstIcms?.toLowerCase().includes(term) ||
      it.cClassTrib?.toLowerCase().includes(term) ||
      it.numeroItem?.toString() === term ||
      it.valorTotal?.toString().includes(term)
    );
  }, [xmlData?.itens, searchTerm]);

  // Itens paginados para garantir performance 60 FPS
  const displayedItens = useMemo(() => {
    return filteredItens.slice(0, itemsPageSize);
  }, [filteredItens, itemsPageSize]);

  if (!item) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(rawXmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyChave = () => {
    navigator.clipboard.writeText(item.chaveAcesso);
    setCopiedChave(true);
    setTimeout(() => setCopiedChave(false), 2000);
  };

  const handleCopyRefKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedRefKey(key);
    setTimeout(() => setCopiedRefKey(null), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([rawXmlContent], { type: 'text/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${item.tipo}_${item.numero || 'doc'}_${item.chaveAcesso}.xml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleSection = (sec: string) => {
    setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const expandAll = () => {
    setExpandedSections({
      ide: true,
      emit: true,
      dest: true,
      det: true,
      total: true,
      IBSCBS: true,
      transp: true,
      cobr: true,
      infAdic: true,
      Signature: true
    });
  };

  const collapseAll = () => {
    setExpandedSections({
      ide: false,
      emit: false,
      dest: false,
      det: false,
      total: false,
      IBSCBS: false,
      transp: false,
      cobr: false,
      infAdic: false,
      Signature: false
    });
  };

  const scrollToTag = (sectionKey: string) => {
    setExpandedSections(prev => ({ ...prev, [sectionKey]: true }));
    setActiveHighlightTag(sectionKey);
    setTimeout(() => setActiveHighlightTag(null), 2500);

    setTimeout(() => {
      const el = document.getElementById(`tree-section-${sectionKey}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handlePrint = () => {
    window.print();
  };

  // Highlighting de Sintaxe do XML
  const renderHighlightedLine = (line: string) => {
    if (line.trim().startsWith('<?xml')) {
      return <span className="text-slate-500 italic">{line}</span>;
    }

    const leafMatch = line.match(/^(\s*)<([a-zA-Z0-9_:-]+)(\s+[^>]*)?>(.*?)<\/([a-zA-Z0-9_:-]+)>$/);
    if (leafMatch) {
      const [, pad, openTag, attrs, content, closeTag] = leafMatch;
      return (
        <span>
          <span className="select-none text-slate-600">{pad}</span>
          <span className="text-cyan-500">&lt;</span>
          <span className="text-indigo-400 font-bold">{openTag}</span>
          {attrs && <span className="text-amber-300">{attrs}</span>}
          <span className="text-cyan-500">&gt;</span>
          <span className={content.includes('[Certificado') || content.includes('[Assinatura') ? 'text-amber-400/90 italic font-mono text-[11px]' : 'text-slate-100 font-semibold'}>
            {content}
          </span>
          <span className="text-cyan-500">&lt;/</span>
          <span className="text-indigo-400 font-bold">{closeTag}</span>
          <span className="text-cyan-500">&gt;</span>
        </span>
      );
    }

    const tagMatch = line.match(/^(\s*)(<\/?)([a-zA-Z0-9_:-]+)([^>]*?)(\/?>)$/);
    if (tagMatch) {
      const [, pad, openBracket, tagName, attrs, closeBracket] = tagMatch;
      return (
        <span>
          <span className="select-none text-slate-600">{pad}</span>
          <span className="text-cyan-500">{openBracket}</span>
          <span className="text-indigo-400 font-bold">{tagName}</span>
          {attrs && <span className="text-amber-300">{attrs}</span>}
          <span className="text-cyan-500">{closeBracket}</span>
        </span>
      );
    }

    return <span>{line}</span>;
  };

  const isOperacaoSaida = xmlData?.ide?.tpNF === '1' || item.tipoOperacao === 'Saída' || (item as any).direcaoMovimento === 'SAIDA';
  const hasRTC = Boolean(xmlData?.rtc && (xmlData.rtc.vCBS > 0 || xmlData.rtc.vIBS > 0 || xmlData.rtc.vIS > 0));

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-[1240px] max-h-[95vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in duration-200">
        
        {/* ── CABEÇALHO DO MODAL ── */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-cyan-600 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0">
              <FolderTree className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <span>Visualizador Fiscal 360° — {item.tipo} Nº {xmlData?.ide?.numero || item.numero}</span>
                </h3>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border shadow-sm ${
                  isOperacaoSaida 
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' 
                    : 'bg-blue-950/80 text-cyan-300 border-blue-800'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOperacaoSaida ? 'bg-emerald-400' : 'bg-blue-400'}`}></span>
                  {isOperacaoSaida ? '🟢 SAÍDA' : '🔵 ENTRADA'}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Série {xmlData?.ide?.serie || item.serie}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Mod. {xmlData?.ide?.mod || (item.tipo === 'CTe' ? '57' : '55')}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap text-xs font-mono">
                <span className="text-slate-400">Chave de Acesso:</span>
                <span className="text-cyan-400 font-bold tracking-wider">{formatChaveAcesso44(item.chaveAcesso)}</span>
                <button
                  type="button"
                  onClick={handleCopyChave}
                  className="p-1 hover:text-white transition-colors cursor-pointer rounded hover:bg-cyan-900/50 flex items-center gap-1 text-[11px] text-cyan-300"
                  title="Copiar Chave Completa (44 dígitos)"
                >
                  {copiedChave ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copiada!
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-400 hover:text-cyan-300">
                      <Copy className="w-3.5 h-3.5" /> Copiar
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              title="Copiar XML bruto na íntegra para a área de transferência"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4 text-cyan-400" />}
              <span>{copied ? 'Copiado!' : 'Copiar XML'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/30 transition-all cursor-pointer"
              title="Baixar arquivo XML assinado"
            >
              <Download className="w-4 h-4" />
              <span>Baixar .XML</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Fechar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── BARRA DE MODOS DE VISUALIZAÇÃO & BUSCA ── */}
        <div className="px-6 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* Seletor de Modos Principal */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-2 transition-all cursor-pointer ${
                viewMode === 'tree'
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderTree className="w-4 h-4 text-cyan-300" />
              <span>🌳 Árvore Estruturada Fiscal 360°</span>
            </button>

            <button
              onClick={() => setViewMode('danfe')}
              className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-2 transition-all cursor-pointer ${
                viewMode === 'danfe'
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4 text-amber-300" />
              <span>📄 DANFE Clássico (MOC 7.0)</span>
            </button>

            <button
              onClick={() => setViewMode('formatted')}
              className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-2 transition-all cursor-pointer ${
                viewMode === 'formatted'
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code className="w-4 h-4 text-purple-300" />
              <span>&lt;/&gt; Código XML Formatado</span>
            </button>
          </div>

          {/* Campo de Busca Rápida e Ações */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-3 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar produto, NCM, CFOP, CST..."
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-64 font-mono"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {viewMode === 'tree' && (
              <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
                <button
                  onClick={expandAll}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Expandir todas as seções"
                >
                  <Maximize2 className="w-3 h-3" /> Expandir
                </button>
                <button
                  onClick={collapseAll}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Recolher todas as seções"
                >
                  <Minimize2 className="w-3 h-3" /> Recolher
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── BARRA DE ATALHOS FLUIDOS, ABERTOS E TOTALMENTE NAVEGÁVEIS ── */}
        {viewMode === 'tree' && (
          <div className="px-6 py-2.5 bg-slate-950/95 border-b border-slate-800 flex flex-wrap items-center gap-2 text-xs sticky top-0 z-20 backdrop-blur-md shadow-sm">
            <span className="text-slate-500 font-bold flex items-center gap-1 mr-1 text-[11px] uppercase tracking-wider select-none">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Atalhos:
            </span>

            <button
              type="button"
              onClick={() => scrollToTag('ide')}
              className={`px-3 py-1.5 rounded-xl border font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeHighlightTag === 'ide'
                  ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/30'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-cyan-300 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>&lt;ide&gt; Identificação</span>
            </button>

            <button
              type="button"
              onClick={() => scrollToTag('emit')}
              className={`px-3 py-1.5 rounded-xl border font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeHighlightTag === 'emit'
                  ? 'bg-purple-500 text-white border-purple-400 shadow-md shadow-purple-500/30'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-purple-300 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-purple-400" />
              <span>&lt;emit&gt; Emitente</span>
            </button>

            <button
              type="button"
              onClick={() => scrollToTag('dest')}
              className={`px-3 py-1.5 rounded-xl border font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeHighlightTag === 'dest'
                  ? 'bg-blue-500 text-white border-blue-400 shadow-md shadow-blue-500/30'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-blue-300 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>&lt;dest&gt; Destinatário</span>
            </button>

            <button
              type="button"
              onClick={() => scrollToTag('det')}
              className={`px-3 py-1.5 rounded-xl border font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeHighlightTag === 'det'
                  ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/30'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-amber-300 hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-amber-400" />
              <span>&lt;det&gt; Itens</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-300 text-[10px] border border-amber-700/60">
                {xmlData?.itens?.length || 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => scrollToTag('total')}
              className={`px-3 py-1.5 rounded-xl border font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeHighlightTag === 'total'
                  ? 'bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/30'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-emerald-300 hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-400" />
              <span>&lt;total&gt; Totais</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 text-[10px] border border-emerald-700/60">
                {fmtBrl(xmlData?.totais?.vNF || 0)}
              </span>
            </button>

            {hasRTC && (
              <button
                type="button"
                onClick={() => scrollToTag('IBSCBS')}
                className={`px-3 py-1.5 rounded-xl border font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeHighlightTag === 'IBSCBS'
                    ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/30'
                    : 'bg-cyan-950/80 hover:bg-cyan-900 border-cyan-700 text-cyan-300 hover:text-white shadow-sm'
                }`}
              >
                <Scale className="w-3.5 h-3.5 text-cyan-400" />
                <span>&lt;IBSCBS&gt; Reforma RTC</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => scrollToTag('transp')}
              className={`px-3 py-1.5 rounded-xl border font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeHighlightTag === 'transp'
                  ? 'bg-orange-500 text-white border-orange-400 shadow-md shadow-orange-500/30'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-orange-400" />
              <span>&lt;transp&gt; Frete</span>
            </button>

            <button
              type="button"
              onClick={() => scrollToTag('cobr')}
              className={`px-3 py-1.5 rounded-xl border font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeHighlightTag === 'cobr'
                  ? 'bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/30'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-emerald-300 hover:text-white'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              <span>&lt;cobr&gt; Pagto</span>
            </button>

            <button
              type="button"
              onClick={() => scrollToTag('infAdic')}
              className={`px-3 py-1.5 rounded-xl border font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeHighlightTag === 'infAdic'
                  ? 'bg-sky-500 text-black border-sky-400 shadow-md shadow-sky-500/30'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-sky-300 hover:text-white'
              }`}
            >
              <Info className="w-3.5 h-3.5 text-sky-400" />
              <span>&lt;infAdic&gt; Complementares</span>
            </button>

            <button
              type="button"
              onClick={() => scrollToTag('Signature')}
              className={`px-3 py-1.5 rounded-xl border font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeHighlightTag === 'Signature'
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/30'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>&lt;Signature&gt;</span>
            </button>
          </div>
        )}

        {/* ── CORPO PRINCIPAL DO VISUALIZADOR ── */}
        <div ref={codeContainerRef} className="p-4 sm:p-6 bg-slate-950 overflow-y-auto flex-1 select-text">
          
          {/* ════════════════════════════════════════════════════════════════
              MODO 1: ÁRVORE ESTRUTURADA FISCAL 360° (NATIVO, ULTRA-RICO)
              ════════════════════════════════════════════════════════════════ */}
          {viewMode === 'tree' && xmlData && (
            <div className="space-y-4 max-w-5xl mx-auto">
              
              {/* 1. Identificação (<ide>) */}
              <div
                id="tree-section-ide"
                className={`rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden transition-all duration-300 ${
                  activeHighlightTag === 'ide' ? 'ring-2 ring-cyan-400 shadow-xl shadow-cyan-500/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('ide')}
                  className="w-full p-4 flex items-center justify-between bg-slate-900 hover:bg-slate-800/80 transition-colors text-left cursor-pointer border-b border-slate-800/60"
                >
                  <div className="flex items-center gap-3 font-bold text-white text-sm">
                    {expandedSections.ide ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span>&lt;ide&gt; Identificação do Documento Fiscal Eletrônico</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-cyan-300 font-bold">{item.tipo} Nº {xmlData.ide.numero}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">Série {xmlData.ide.serie}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">Emissão: {xmlData.ide.dhEmi}</span>
                  </div>
                </button>

                {expandedSections.ide && (
                  <div className="p-4 bg-slate-950/60 space-y-3 font-mono text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;nNF&gt; Número:</span>
                        <strong className="text-white text-sm">{xmlData.ide.numero}</strong>
                      </div>
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;serie&gt; Série:</span>
                        <strong className="text-white text-sm">{xmlData.ide.serie}</strong>
                      </div>
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;dhEmi&gt; Data de Emissão:</span>
                        <strong className="text-cyan-300 text-sm">{xmlData.ide.dhEmi}</strong>
                      </div>
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;tpNF&gt; Direção da Operação:</span>
                        <strong className={`text-sm ${isOperacaoSaida ? 'text-emerald-400' : 'text-cyan-400'}`}>
                          {isOperacaoSaida ? '1 - Saída (Vendas/Faturamento)' : '0 - Entrada (Aquisições/Compras)'}
                        </strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;mod&gt; Modelo:</span>
                        <strong className="text-slate-200">{xmlData.ide.mod}</strong>
                      </div>
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;finNFe&gt; Finalidade:</span>
                        <strong className="text-slate-200">{FIN_NFE_MAP[xmlData.ide.finNFe] || `Código ${xmlData.ide.finNFe}`}</strong>
                      </div>
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;tpAmb&gt; Ambiente:</span>
                        <strong className={xmlData.ide.tpAmb === '1' ? 'text-emerald-400' : 'text-amber-400'}>
                          {xmlData.ide.tpAmb === '1' ? '1 - Produção' : '2 - Homologação'}
                        </strong>
                      </div>
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;indPres&gt; Presença do Comprador:</span>
                        <strong className="text-slate-200">{IND_PRES_MAP[xmlData.ide.indPres] || (xmlData.ide.indPres ? `Código ${xmlData.ide.indPres}` : '0 - Não se aplica')}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 sm:col-span-2">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;natOp&gt; Natureza da Operação:</span>
                        <strong className="text-slate-200 font-sans text-xs">{xmlData.ide.natOp}</strong>
                      </div>
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;nProt&gt; Protocolo SEFAZ:</span>
                        <strong className="text-emerald-400 text-xs">{xmlData.ide.nProt || '100 - Autorizado o uso do DF-e'}</strong>
                        {xmlData.ide.dhRecbto && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">{xmlData.ide.dhRecbto}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Emitente (<emit>) */}
              <div
                id="tree-section-emit"
                className={`rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden transition-all duration-300 ${
                  activeHighlightTag === 'emit' ? 'ring-2 ring-purple-400 shadow-xl shadow-purple-500/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('emit')}
                  className="w-full p-4 flex items-center justify-between bg-slate-900 hover:bg-slate-800/80 transition-colors text-left cursor-pointer border-b border-slate-800/60"
                >
                  <div className="flex items-center gap-3 font-bold text-white text-sm">
                    {expandedSections.emit ? <ChevronDown className="w-4 h-4 text-purple-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <Building2 className="w-4 h-4 text-purple-400" />
                    <span>&lt;emit&gt; Emitente / Prestador do Serviço</span>
                  </div>
                  <span className="text-xs font-mono text-purple-300 font-bold truncate max-w-md">
                    {xmlData.emit.nome} ({xmlData.emit.cnpj})
                  </span>
                </button>

                {expandedSections.emit && (
                  <div className="p-4 bg-slate-950/60 space-y-3 font-mono text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 sm:col-span-2">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;xNome&gt; Razão Social:</span>
                        <strong className="text-white font-sans text-sm">{xmlData.emit.nome}</strong>
                        {xmlData.emit.fant && (
                          <span className="text-slate-400 text-xs block mt-0.5 font-sans">&lt;xFant&gt; {xmlData.emit.fant}</span>
                        )}
                      </div>
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;CNPJ&gt; CNPJ:</span>
                        <strong className="text-purple-300 text-sm">{xmlData.emit.cnpj}</strong>
                        {xmlData.emit.crt && (
                          <span className="text-[10px] text-slate-400 block mt-1">
                            CRT: {CRT_MAP[xmlData.emit.crt] || xmlData.emit.crt}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;IE&gt; Inscrição Estadual:</span>
                        <strong className="text-slate-200">{xmlData.emit.ie || 'ISENTO'}</strong>
                      </div>
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;xMun&gt; Município / UF:</span>
                        <strong className="text-slate-200">{xmlData.emit.mun} / {xmlData.emit.uf}</strong>
                      </div>
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;CEP&gt; CEP:</span>
                        <strong className="text-slate-200">{xmlData.emit.cep || '—'}</strong>
                      </div>
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;fone&gt; Telefone / Contato:</span>
                        <strong className="text-slate-200">{xmlData.emit.fone || '—'}</strong>
                      </div>
                    </div>

                    {xmlData.emit.lgr && (
                      <div className="p-2.5 bg-slate-900/70 rounded-xl border border-slate-800 text-slate-400 text-xs">
                        <span className="text-slate-500 font-bold block text-[10px]">&lt;enderEmit&gt; Endereço Completo:</span>
                        {xmlData.emit.lgr}, {xmlData.emit.nro} {xmlData.emit.cpl && `— ${xmlData.emit.cpl}`}, {xmlData.emit.bairro}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Destinatário / Tomador (<dest>) */}
              <div
                id="tree-section-dest"
                className={`rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden transition-all duration-300 ${
                  activeHighlightTag === 'dest' ? 'ring-2 ring-blue-400 shadow-xl shadow-blue-500/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('dest')}
                  className="w-full p-4 flex items-center justify-between bg-slate-900 hover:bg-slate-800/80 transition-colors text-left cursor-pointer border-b border-slate-800/60"
                >
                  <div className="flex items-center gap-3 font-bold text-white text-sm">
                    {expandedSections.dest ? <ChevronDown className="w-4 h-4 text-blue-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <Users className="w-4 h-4 text-blue-400" />
                    <span>&lt;dest&gt; Destinatário / Tomador dos Serviços</span>
                  </div>
                  <span className="text-xs font-mono text-blue-300 font-bold truncate max-w-md">
                    {xmlData.dest.nome} ({xmlData.dest.cnpj})
                  </span>
                </button>

                {expandedSections.dest && (
                  <div className="p-4 bg-slate-950/60 space-y-3 font-mono text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 sm:col-span-2">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;xNome&gt; Razão Social / Nome:</span>
                        <strong className="text-white font-sans text-sm">{xmlData.dest.nome}</strong>
                        {xmlData.dest.email && (
                          <span className="text-slate-400 text-xs block mt-0.5">&lt;email&gt; {xmlData.dest.email}</span>
                        )}
                      </div>
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;CNPJ&gt; / &lt;CPF&gt;:</span>
                        <strong className="text-blue-300 text-sm">{xmlData.dest.cnpj}</strong>
                        {xmlData.dest.indIEDest && (
                          <span className="text-[10px] text-slate-400 block mt-1">
                            {IND_IEDEST_MAP[xmlData.dest.indIEDest] || `indIEDest: ${xmlData.dest.indIEDest}`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;IE&gt; Inscrição Estadual:</span>
                        <strong className="text-slate-200">{xmlData.dest.ie || 'ISENTO / NÃO CONTRIBUINTE'}</strong>
                      </div>
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;xMun&gt; Município / UF:</span>
                        <strong className="text-slate-200">{xmlData.dest.mun} / {xmlData.dest.uf}</strong>
                      </div>
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;CEP&gt; CEP:</span>
                        <strong className="text-slate-200">{xmlData.dest.cep || '—'}</strong>
                      </div>
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;fone&gt; Telefone / Fax:</span>
                        <strong className="text-slate-200">{xmlData.dest.fone || '—'}</strong>
                      </div>
                    </div>

                    {xmlData.dest.lgr && (
                      <div className="p-2.5 bg-slate-900/70 rounded-xl border border-slate-800 text-slate-400 text-xs">
                        <span className="text-slate-500 font-bold block text-[10px]">&lt;enderDest&gt; Endereço Completo:</span>
                        {xmlData.dest.lgr}, {xmlData.dest.nro} {xmlData.dest.cpl && `— ${xmlData.dest.cpl}`}, {xmlData.dest.bairro}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 4. Produtos e Serviços (<det>) A NÍVEL DE ITEM */}
              <div
                id="tree-section-det"
                className={`rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden transition-all duration-300 ${
                  activeHighlightTag === 'det' ? 'ring-2 ring-amber-400 shadow-xl shadow-amber-500/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('det')}
                  className="w-full p-4 flex items-center justify-between bg-slate-900 hover:bg-slate-800/80 transition-colors text-left cursor-pointer border-b border-slate-800/60"
                >
                  <div className="flex items-center gap-3 font-bold text-white text-sm">
                    {expandedSections.det ? <ChevronDown className="w-4 h-4 text-amber-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <Package className="w-4 h-4 text-amber-400" />
                    <span>&lt;det&gt; Produtos / Serviços & Tributação por Item ({xmlData.itens.length} itens)</span>
                  </div>
                  <span className="text-sm font-mono text-emerald-400 font-bold">
                    Subtotal Produtos: {fmtBrl(xmlData.totais.vProd)}
                  </span>
                </button>

                {expandedSections.det && (
                  <div className="p-4 bg-slate-950/60 space-y-4">
                    {filteredItens.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 font-sans">
                        Nenhum item localizado com o termo de busca: &quot;{searchTerm}&quot;
                      </div>
                    ) : (
                      displayedItens.map((it: any) => {
                        const hasMonofasico = it.vICMSMono > 0 || it.vICMSMonoRet > 0 || it.cstIcms === '061' || it.cstIcms === '61';
                        const hasItemRTC = (it.vCbs > 0 || it.vIbs > 0 || Boolean(it.cClassTrib));
                        const isCfopSaida = (it.cfop || '').startsWith('5') || (it.cfop || '').startsWith('6') || (it.cfop || '').startsWith('7');

                        return (
                          <div
                            key={it.numeroItem}
                            className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 font-mono text-xs hover:border-slate-700 transition-colors shadow-sm"
                          >
                            {/* Cabeçalho do Item */}
                            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
                              <div className="space-y-1 max-w-3xl">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 text-xs">
                                    Item #{it.numeroItem}
                                  </span>
                                  <span className="text-slate-400 font-mono text-xs">Cód: <strong className="text-slate-200">{it.codigo}</strong></span>
                                  {it.cEAN && it.cEAN !== 'SEM GTIN' && (
                                    <span className="text-slate-500 text-[11px]">EAN: {it.cEAN}</span>
                                  )}
                                  <strong className="text-white font-sans text-sm font-bold ml-1">{it.descricao}</strong>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-slate-400 text-xs pt-1">
                                  <span>NCM/SH: <strong className="text-cyan-300">{it.ncm || '—'}</strong></span>
                                  {it.cest && <span>CEST: <strong className="text-slate-300">{it.cest}</strong></span>}
                                  <span className="flex items-center gap-1">
                                    CFOP:
                                    <span className={`px-1.5 py-0.2 rounded font-bold text-[11px] border ${
                                      isCfopSaida
                                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                        : 'bg-blue-950 text-blue-300 border-blue-800'
                                    }`}>
                                      {it.cfop}
                                    </span>
                                  </span>
                                  <span>UN: <strong className="text-slate-300">{it.unidade}</strong></span>
                                  <span>Qtd: <strong className="text-white">{fmtNum4(it.quantidade)}</strong></span>
                                  <span>Valor Unit: <strong className="text-white">{fmtBrl(it.valorUnitario)}</strong></span>
                                  {it.valorDesconto > 0 && <span className="text-red-400 font-bold">Desc: -{fmtBrl(it.valorDesconto)}</span>}
                                  {it.valorFrete > 0 && <span className="text-slate-400">Frete: {fmtBrl(it.valorFrete)}</span>}
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Valor Total do Item</span>
                                <strong className="text-emerald-400 text-base font-black tracking-tight font-mono">
                                  {fmtBrl(it.valorTotal)}
                                </strong>
                              </div>
                            </div>

                            {/* ICMS Monofásico de Combustíveis (se houver) */}
                            {hasMonofasico && (
                              <div className="p-3 rounded-xl bg-orange-950/30 border border-orange-800/50 flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2">
                                  <Flame className="w-4 h-4 text-orange-400" />
                                  <div>
                                    <span className="font-bold text-orange-300">Tributação Monofásica de Combustíveis (Convênio ICMS 199/2022)</span>
                                    {it.descANP && <p className="text-[11px] text-slate-400">ANP: {it.cProdANP} - {it.descANP}</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-mono">
                                  <div>
                                    <span className="text-slate-500 block text-[10px]">Base Litros:</span>
                                    <strong className="text-white">{it.qBCMono ? fmtNum4(it.qBCMono) : fmtNum4(it.quantidade)} L</strong>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block text-[10px]">Alíquota ad rem:</span>
                                    <strong className="text-orange-300">R$ {it.adRemICMS || it.adRemICMSRet || 1.22}</strong>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block text-[10px]">ICMS Mono Retido:</span>
                                    <strong className="text-orange-400 font-bold">{fmtBrl(it.vICMSMonoRet || it.vICMSMono || 0)}</strong>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Grade Tributária Detalhada (ICMS, IPI, PIS, COFINS) */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                              {/* ICMS */}
                              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-blue-400 text-xs">ICMS</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-300">
                                    CST: {it.cstIcms || '00'}
                                  </span>
                                </div>
                                <div className="space-y-0.5 text-[11px]">
                                  <div className="flex justify-between text-slate-400">
                                    <span>Base:</span>
                                    <span className="text-white">{fmtBrl(it.vBCIcms)}</span>
                                  </div>
                                  <div className="flex justify-between text-slate-400">
                                    <span>Alíq:</span>
                                    <span className="text-blue-300">{it.pIcms}%</span>
                                  </div>
                                  <div className="flex justify-between text-slate-400 font-bold border-t border-slate-800 pt-0.5">
                                    <span>Valor:</span>
                                    <span className="text-blue-400">{fmtBrl(it.vIcms)}</span>
                                  </div>
                                  {it.vICMSST > 0 && (
                                    <div className="flex justify-between text-amber-400 pt-0.5 border-t border-slate-800">
                                      <span>ICMS ST:</span>
                                      <span>{fmtBrl(it.vICMSST)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* IPI */}
                              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-amber-400 text-xs">IPI</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300">
                                    CST: {it.cstIpi || '99'}
                                  </span>
                                </div>
                                <div className="space-y-0.5 text-[11px]">
                                  <div className="flex justify-between text-slate-400">
                                    <span>Base:</span>
                                    <span className="text-white">{fmtBrl(it.vBCIpi)}</span>
                                  </div>
                                  <div className="flex justify-between text-slate-400">
                                    <span>Alíq:</span>
                                    <span className="text-amber-300">{it.pIpi}%</span>
                                  </div>
                                  <div className="flex justify-between text-slate-400 font-bold border-t border-slate-800 pt-0.5">
                                    <span>Valor:</span>
                                    <span className="text-amber-400">{fmtBrl(it.vIpi)}</span>
                                  </div>
                                  {it.cEnq && (
                                    <div className="text-[10px] text-slate-500 pt-0.5">
                                      cEnq: {it.cEnq}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* PIS */}
                              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-purple-400 text-xs">PIS</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300">
                                    CST: {it.cstPis || '01'}
                                  </span>
                                </div>
                                <div className="space-y-0.5 text-[11px]">
                                  <div className="flex justify-between text-slate-400">
                                    <span>Base:</span>
                                    <span className="text-white">{fmtBrl(it.vBCPis)}</span>
                                  </div>
                                  <div className="flex justify-between text-slate-400">
                                    <span>Alíq:</span>
                                    <span className="text-purple-300">{it.pPis}%</span>
                                  </div>
                                  <div className="flex justify-between text-slate-400 font-bold border-t border-slate-800 pt-0.5">
                                    <span>Valor:</span>
                                    <span className="text-purple-400">{fmtBrl(it.vPis)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* COFINS */}
                              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-indigo-400 text-xs">COFINS</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300">
                                    CST: {it.cstCofins || '01'}
                                  </span>
                                </div>
                                <div className="space-y-0.5 text-[11px]">
                                  <div className="flex justify-between text-slate-400">
                                    <span>Base:</span>
                                    <span className="text-white">{fmtBrl(it.vBCCofins)}</span>
                                  </div>
                                  <div className="flex justify-between text-slate-400">
                                    <span>Alíq:</span>
                                    <span className="text-indigo-300">{it.pCofins}%</span>
                                  </div>
                                  <div className="flex justify-between text-slate-400 font-bold border-t border-slate-800 pt-0.5">
                                    <span>Valor:</span>
                                    <span className="text-indigo-400">{fmtBrl(it.vCofins)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Reforma Tributária RTC no Item (se houver) */}
                            {hasItemRTC && (
                              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2">
                                  <Scale className="w-4 h-4 text-cyan-400" />
                                  <div>
                                    <span className="font-bold text-cyan-300">Reforma Tributária RTC (CBS e IBS no Item)</span>
                                    {it.cClassTrib && (
                                      <span className="text-[11px] text-cyan-200 block font-mono">cClassTrib: {it.cClassTrib}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-mono">
                                  <div>
                                    <span className="text-slate-500 block text-[10px]">CBS Federal:</span>
                                    <strong className="text-cyan-400">{fmtBrl(it.vCbs)} ({it.pCbs}%)</strong>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block text-[10px]">IBS Estadual/Mun:</span>
                                    <strong className="text-indigo-400">{fmtBrl(it.vIbs)} ({it.pIbs}%)</strong>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Informações Adicionais do Produto */}
                            {it.infAdProd && (
                              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 leading-relaxed font-sans">
                                <strong className="text-slate-300 font-mono text-[10px] block">&lt;infAdProd&gt; Detalhes do Produto:</strong>
                                {it.infAdProd}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}

                    {/* Paginação / Ver Mais Itens se houver muitos */}
                    {filteredItens.length > itemsPageSize && (
                      <div className="pt-2 text-center">
                        <button
                          type="button"
                          onClick={() => setItemsPageSize(prev => prev + 50)}
                          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 text-xs font-bold cursor-pointer transition-colors shadow-sm"
                        >
                          Carregar mais 50 itens (Exibindo {displayedItens.length} de {filteredItens.length})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 5. Totais Globais (<total> / <ICMSTot>) */}
              <div
                id="tree-section-total"
                className={`rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden transition-all duration-300 ${
                  activeHighlightTag === 'total' ? 'ring-2 ring-emerald-400 shadow-xl shadow-emerald-500/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('total')}
                  className="w-full p-4 flex items-center justify-between bg-slate-900 hover:bg-slate-800/80 transition-colors text-left cursor-pointer border-b border-slate-800/60"
                >
                  <div className="flex items-center gap-3 font-bold text-white text-sm">
                    {expandedSections.total ? <ChevronDown className="w-4 h-4 text-emerald-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    <span>&lt;total&gt; Totais da Operação & Tributos Consolidados</span>
                  </div>
                  <span className="text-sm font-mono font-black text-emerald-400">
                    Total DF-e: {fmtBrl(xmlData.totais.vNF)}
                  </span>
                </button>

                {expandedSections.total && (
                  <div className="p-4 bg-slate-950/60 space-y-3 font-mono text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;vProd&gt; Total dos Produtos:</span>
                        <strong className="text-white text-sm">{fmtBrl(xmlData.totais.vProd)}</strong>
                      </div>
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;vFrete&gt; Frete:</span>
                        <strong className="text-slate-300 text-sm">{fmtBrl(xmlData.totais.vFrete)}</strong>
                      </div>
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;vDesc&gt; Descontos:</span>
                        <strong className="text-red-400 text-sm">{fmtBrl(xmlData.totais.vDesc)}</strong>
                      </div>
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;vNF&gt; Valor Total da NF-e:</span>
                        <strong className="text-emerald-400 text-base font-black">{fmtBrl(xmlData.totais.vNF)}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border-t border-slate-800/80 pt-3">
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;vICMS&gt; Total ICMS:</span>
                        <strong className="text-blue-400 text-sm">{fmtBrl(xmlData.totais.vICMS)}</strong>
                      </div>
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;vIPI&gt; Total IPI:</span>
                        <strong className="text-amber-400 text-sm">{fmtBrl(xmlData.totais.vIPI)}</strong>
                      </div>
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;vPIS&gt; Total PIS:</span>
                        <strong className="text-purple-400 text-sm">{fmtBrl(xmlData.totais.vPIS)}</strong>
                      </div>
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;vCOFINS&gt; Total COFINS:</span>
                        <strong className="text-indigo-400 text-sm">{fmtBrl(xmlData.totais.vCOFINS)}</strong>
                      </div>
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;vTotTrib&gt; Tributos Aprox:</span>
                        <strong className="text-slate-200 text-sm">{fmtBrl(xmlData.totais.vTotTrib)}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Reforma Tributária: CBS / IBS (<IBSCBSTot>) */}
              {hasRTC && (
                <div
                  id="tree-section-IBSCBS"
                  className={`rounded-2xl bg-gradient-to-br from-cyan-950/40 via-blue-950/30 to-slate-900 border border-cyan-800/60 overflow-hidden transition-all duration-300 ${
                    activeHighlightTag === 'IBSCBS' ? 'ring-2 ring-cyan-400 shadow-xl shadow-cyan-500/20' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection('IBSCBS')}
                    className="w-full p-4 flex items-center justify-between bg-cyan-950/60 hover:bg-cyan-900/60 transition-colors text-left cursor-pointer border-b border-cyan-800/60"
                  >
                    <div className="flex items-center gap-3 font-bold text-cyan-300 text-sm">
                      {expandedSections.IBSCBS ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4 text-cyan-400" />}
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span>&lt;IBSCBSTot&gt; Reforma Tributária do Consumo (CBS & IBS — NT 2025.002)</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      Total IVA Dual: {fmtBrl(xmlData.rtc.vCBS + xmlData.rtc.vIBS)}
                    </span>
                  </button>

                  {expandedSections.IBSCBS && (
                    <div className="p-4 bg-slate-950/70 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-cyan-900/60">
                        <span className="text-slate-400 block text-[10px] font-bold">&lt;vCBS&gt; CBS Federal:</span>
                        <strong className="text-cyan-400 text-base font-black">{fmtBrl(xmlData.rtc.vCBS)}</strong>
                      </div>
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-indigo-900/60">
                        <span className="text-slate-400 block text-[10px] font-bold">&lt;vIBS&gt; IBS Estadual/Municipal:</span>
                        <strong className="text-indigo-400 text-base font-black">{fmtBrl(xmlData.rtc.vIBS)}</strong>
                      </div>
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px] font-bold">&lt;vIS&gt; Imposto Seletivo:</span>
                        <strong className="text-amber-400 text-base font-black">{fmtBrl(xmlData.rtc.vIS)}</strong>
                      </div>
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px] font-bold">Base de Cálculo RTC:</span>
                        <strong className="text-white text-base font-black">{fmtBrl(xmlData.rtc.vBCCBS || xmlData.totais.vNF)}</strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 7. Transporte & Volumes (<transp>) */}
              <div
                id="tree-section-transp"
                className={`rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden transition-all duration-300 ${
                  activeHighlightTag === 'transp' ? 'ring-2 ring-slate-400 shadow-xl shadow-slate-500/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('transp')}
                  className="w-full p-4 flex items-center justify-between bg-slate-900 hover:bg-slate-800/80 transition-colors text-left cursor-pointer border-b border-slate-800/60"
                >
                  <div className="flex items-center gap-3 font-bold text-white text-sm">
                    {expandedSections.transp ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <Truck className="w-4 h-4 text-slate-400" />
                    <span>&lt;transp&gt; Transporte & Volumes Transportados</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400 truncate max-w-xs">
                    {MOD_FRETE_MAP[xmlData.transp.modFrete] || 'Frete'}
                  </span>
                </button>

                {expandedSections.transp && (
                  <div className="p-4 bg-slate-950/60 space-y-3 font-mono text-xs">
                    <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                      <span className="text-slate-500 block text-[10px] font-bold">&lt;modFrete&gt; Modalidade do Frete:</span>
                      <strong className="text-white text-xs">{MOD_FRETE_MAP[xmlData.transp.modFrete] || `Código ${xmlData.transp.modFrete}`}</strong>
                    </div>

                    {xmlData.transp.nome && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 sm:col-span-2">
                          <span className="text-slate-500 block text-[10px] font-bold">&lt;transporta&gt; Transportadora:</span>
                          <strong className="text-white font-sans">{xmlData.transp.nome}</strong>
                        </div>
                        <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                          <span className="text-slate-500 block text-[10px] font-bold">CNPJ:</span>
                          <strong className="text-cyan-300">{xmlData.transp.cnpj}</strong>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">Placa / UF:</span>
                        <strong className="text-slate-200">{xmlData.transp.placa || '—'} {xmlData.transp.veicUf && `(${xmlData.transp.veicUf})`}</strong>
                      </div>
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">Quantidade de Volumes:</span>
                        <strong className="text-slate-200">{xmlData.transp.qVol || '—'} {xmlData.transp.esp}</strong>
                      </div>
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">Peso Bruto:</span>
                        <strong className="text-slate-200">{xmlData.transp.pesoB ? `${fmtNum4(xmlData.transp.pesoB)} kg` : '—'}</strong>
                      </div>
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] font-bold">Peso Líquido:</span>
                        <strong className="text-slate-200">{xmlData.transp.pesoL ? `${fmtNum4(xmlData.transp.pesoL)} kg` : '—'}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 8. Cobrança e Pagamento (<cobr> & <pag>) */}
              <div
                id="tree-section-cobr"
                className={`rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden transition-all duration-300 ${
                  activeHighlightTag === 'cobr' ? 'ring-2 ring-emerald-400 shadow-xl shadow-emerald-500/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('cobr')}
                  className="w-full p-4 flex items-center justify-between bg-slate-900 hover:bg-slate-800/80 transition-colors text-left cursor-pointer border-b border-slate-800/60"
                >
                  <div className="flex items-center gap-3 font-bold text-white text-sm">
                    {expandedSections.cobr ? <ChevronDown className="w-4 h-4 text-emerald-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <span>&lt;cobr&gt; & &lt;pag&gt; Fatura, Duplicatas & Meio de Pagamento</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-300 font-bold">
                    {FORMA_PAGTO_MAP[xmlData.cobr.tPag] || 'Pagamento'} • {fmtBrl(xmlData.cobr.vPag || xmlData.totais.vNF)}
                  </span>
                </button>

                {expandedSections.cobr && (
                  <div className="p-4 bg-slate-950/60 space-y-3 font-mono text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-slate-500 block text-[10px] font-bold">&lt;tPag&gt; Meio de Pagamento:</span>
                          <strong className="text-white text-sm">{FORMA_PAGTO_MAP[xmlData.cobr.tPag] || `Código ${xmlData.cobr.tPag || '01'}`}</strong>
                        </div>
                        <strong className="text-emerald-400 text-sm font-bold">{fmtBrl(xmlData.cobr.vPag || xmlData.totais.vNF)}</strong>
                      </div>

                      {xmlData.cobr.nFat && (
                        <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-between">
                          <div>
                            <span className="text-slate-500 block text-[10px] font-bold">&lt;nFat&gt; Número da Fatura:</span>
                            <strong className="text-white text-sm">{xmlData.cobr.nFat}</strong>
                          </div>
                          <span className="text-slate-400 text-xs">Líq: {fmtBrl(xmlData.cobr.vLiqFat)}</span>
                        </div>
                      )}
                    </div>

                    {/* Relação de Duplicatas */}
                    {xmlData.cobr.duplicatas.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-slate-500 block text-[10px] font-bold uppercase">&lt;dup&gt; Parcelas / Duplicatas:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {xmlData.cobr.duplicatas.map((dup: any, idx: number) => (
                            <div key={idx} className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                              <div>
                                <strong className="text-white">Parc. {dup.nDup}</strong>
                                <span className="text-[11px] text-slate-400 block">Venc: {dup.dVenc}</span>
                              </div>
                              <strong className="text-emerald-400 font-bold">{fmtBrl(dup.vDup)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 9. Informações Complementares & Fisco (<infAdic>) */}
              <div
                id="tree-section-infAdic"
                className={`rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden transition-all duration-300 ${
                  activeHighlightTag === 'infAdic' ? 'ring-2 ring-cyan-400 shadow-xl shadow-cyan-500/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('infAdic')}
                  className="w-full p-4 flex items-center justify-between bg-slate-900 hover:bg-slate-800/80 transition-colors text-left cursor-pointer border-b border-slate-800/60"
                >
                  <div className="flex items-center gap-3 font-bold text-white text-sm">
                    {expandedSections.infAdic ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <Info className="w-4 h-4 text-cyan-400" />
                    <span>&lt;infAdic&gt; Informações Complementares & Reservado ao Fisco</span>
                  </div>
                  <span className="text-xs text-slate-400">Observações e referências</span>
                </button>

                {expandedSections.infAdic && (
                  <div className="p-4 bg-slate-950/60 space-y-3 font-sans text-xs">
                    {xmlData.infAdic.chavesRef.length > 0 && (
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2 font-mono">
                        <span className="text-slate-500 block text-[10px] font-bold">&lt;refNFe&gt; DF-e Referenciados na Operação ({xmlData.infAdic.chavesRef.length}):</span>
                        <div className="space-y-1.5">
                          {xmlData.infAdic.chavesRef.map((ch: string, idx: number) => (
                            <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
                              <span className="text-cyan-400 text-xs font-bold">{formatChaveAcesso44(ch)}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyRefKey(ch)}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-[11px]"
                                title="Copiar Chave Referenciada"
                              >
                                {copiedRefKey === ch ? (
                                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                                    <Check className="w-3 h-3" /> Copiado!
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-cyan-300">
                                    <Copy className="w-3 h-3" /> Copiar
                                  </span>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-500 block text-[10px] font-bold font-mono">&lt;infCpl&gt; Informações Complementares de Interesse do Contribuinte:</span>
                      <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {xmlData.infAdic.infCpl || 'Nenhuma informação complementar adicional constante no XML.'}
                      </p>
                    </div>

                    {xmlData.infAdic.infAdFisco && (
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                        <span className="text-slate-500 block text-[10px] font-bold font-mono">&lt;infAdFisco&gt; Informações Adicionais de Interesse do Fisco:</span>
                        <p className="text-amber-300/90 whitespace-pre-wrap leading-relaxed">
                          {xmlData.infAdic.infAdFisco}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 10. Assinatura Digital X.509 (<Signature>) */}
              <div
                id="tree-section-Signature"
                className={`rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden transition-all duration-300 ${
                  activeHighlightTag === 'Signature' ? 'ring-2 ring-emerald-400 shadow-xl shadow-emerald-500/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('Signature')}
                  className="w-full p-4 flex items-center justify-between bg-slate-900 hover:bg-slate-800/80 transition-colors text-left cursor-pointer border-b border-slate-800/60"
                >
                  <div className="flex items-center gap-3 font-bold text-white text-sm">
                    {expandedSections.Signature ? <ChevronDown className="w-4 h-4 text-emerald-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>&lt;Signature&gt; Assinatura Digital ICP-Brasil (XML-DSig) & Protocolo SEFAZ</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    ✅ Assinado e Homologado pela SEFAZ
                  </span>
                </button>

                {expandedSections.Signature && (
                  <div className="p-4 bg-slate-950/60 space-y-2 font-mono text-xs">
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-400 block text-[10px]">&lt;DigestValue&gt; Hash Criptográfico da Nota:</span>
                      <code className="text-cyan-300 text-[11px] break-all">{xmlData.ide.digVal || item.sha256 || 'Assinatura íntegra validada no padrão SEFAZ'}</code>
                    </div>
                    {xmlData.ide.nProt && (
                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                        <span className="text-slate-400 block text-[10px]">Protocolo de Autorização SEFAZ:</span>
                        <strong className="text-emerald-400">{xmlData.ide.nProt}</strong>
                        <span className="text-slate-400 block text-[10px] mt-0.5">Processado em: {xmlData.ide.dhRecbto}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              MODO 2: DANFE CLÁSSICO MOC 7.0 (GRADE DE CAIXAS DE 1PX / FSIST)
              ════════════════════════════════════════════════════════════════ */}
          {viewMode === 'danfe' && xmlData && (
            <div className="flex flex-col items-center">
              
              {/* Botão de Impressão Direta */}
              <div className="w-full max-w-[210mm] flex justify-end mb-3">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir em Folha A4 Retrato</span>
                </button>
              </div>

              {/* Folha A4 Retrato em Branco e Preto com Box Grid de 1px */}
              <div
                ref={printRef}
                className="danfe-sheet danfe-print-area w-full max-w-[210mm] bg-white text-black p-[5mm] shadow-2xl border border-gray-400"
                style={{
                  fontFamily: "'Times New Roman', Times, serif",
                  fontSize: '8px',
                  lineHeight: '1.15',
                  color: '#000000',
                  backgroundColor: '#ffffff',
                  colorScheme: 'light',
                  forcedColorAdjust: 'none',
                }}
              >
                {/* ── CANHOTO SUPERIOR ── */}
                <div style={{ border: '1px solid #000', marginBottom: '2px', display: 'grid', gridTemplateColumns: '82% 18%' }}>
                  <div style={{ padding: '3px 4px', borderRight: '1px solid #000' }}>
                    <div style={{ fontSize: '7px', lineHeight: 1.15, textTransform: 'uppercase' }}>
                      RECEBEMOS DE <strong>{xmlData.emit.nome}</strong> OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO. EMISSÃO: <strong>{xmlData.ide.dhEmi}</strong> VALOR TOTAL: <strong>{fmtBrl(xmlData.totais.vNF)}</strong> DESTINATÁRIO: <strong>{xmlData.dest.nome}</strong> — {xmlData.dest.lgr}, {xmlData.dest.mun}-{xmlData.dest.uf}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '25% 75%', marginTop: '8px', gap: '8px' }}>
                      <div style={{ borderTop: '1px solid #000', paddingTop: '1px', fontSize: '6.5px', fontWeight: 'bold' }}>
                        DATA DE RECEBIMENTO
                      </div>
                      <div style={{ borderTop: '1px solid #000', paddingTop: '1px', fontSize: '6.5px', fontWeight: 'bold' }}>
                        IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '3px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <strong style={{ fontSize: '13px', display: 'block' }}>NF-e</strong>
                    <strong style={{ fontSize: '9px', display: 'block' }}>Nº. {xmlData.ide.numero}</strong>
                    <span style={{ fontSize: '8px' }}>Série {xmlData.ide.serie}</span>
                  </div>
                </div>

                {/* Picote */}
                <div style={{ borderBottom: '1px dashed #666', margin: '3px 0 4px 0' }} />

                {/* ── CABEÇALHO TRIPARTIDO ── */}
                <div style={{ border: '1px solid #000', display: 'grid', gridTemplateColumns: '43% 18% 39%', marginBottom: '1px' }}>
                  {/* Emitente */}
                  <div style={{ borderRight: '1px solid #000', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
                    <span style={{ fontSize: '6.5px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px', display: 'block' }}>IDENTIFICAÇÃO DO EMITENTE</span>
                    <strong style={{ fontSize: '11px', display: 'block', lineHeight: 1.1 }}>{xmlData.emit.nome}</strong>
                    {xmlData.emit.fant && <span style={{ fontSize: '8.5px', display: 'block', color: '#333' }}>{xmlData.emit.fant}</span>}
                    <div style={{ fontSize: '7.5px', marginTop: '3px', lineHeight: 1.2 }}>
                      {xmlData.emit.lgr}, {xmlData.emit.nro} {xmlData.emit.cpl && `— ${xmlData.emit.cpl}`}<br />
                      {xmlData.emit.bairro} — {xmlData.emit.cep}<br />
                      {xmlData.emit.mun} — {xmlData.emit.uf} — Fone: {xmlData.emit.fone || '—'}
                    </div>
                  </div>

                  {/* Quadro DANFE Central */}
                  <div style={{ borderRight: '1px solid #000', padding: '3px 2px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                    <strong style={{ fontSize: '14px', letterSpacing: '0.5px' }}>DANFE</strong>
                    <span style={{ fontSize: '6.5px', lineHeight: 1.1 }}>DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA</span>
                    <div style={{ border: '1px solid #000', padding: '1px 3px', margin: '3px 0', fontSize: '7px', fontWeight: 'bold' }}>
                      <span>0 - ENTRADA</span><br />
                      <span>1 - SAÍDA</span>
                      <strong style={{ border: '1px solid #000', padding: '0 3px', marginLeft: '3px' }}>
                        {isOperacaoSaida ? '1' : '0'}
                      </strong>
                    </div>
                    <strong style={{ fontSize: '9px' }}>Nº. {xmlData.ide.numero}</strong>
                    <strong style={{ fontSize: '8px' }}>SÉRIE {xmlData.ide.serie}</strong>
                    <span style={{ fontSize: '6.5px' }}>FOLHA 1 / 1</span>
                  </div>

                  {/* Código de Barras e Chave de Acesso */}
                  <div style={{ padding: '3px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    {/* SVG Código de Barras 128C */}
                    <div
                      style={{ width: '100%', display: 'flex', justifyContent: 'center', overflow: 'hidden', padding: '1px 0' }}
                      dangerouslySetInnerHTML={{ __html: xmlData.barcodeSvg }}
                    />
                    <div style={{ borderTop: '1px solid #000', paddingTop: '2px', textAlign: 'center' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>CHAVE DE ACESSO</span>
                      <strong style={{ fontSize: '7.5px', letterSpacing: '0.5px', fontFamily: 'monospace' }}>
                        {formatChaveAcesso44(item.chaveAcesso)}
                      </strong>
                    </div>
                    <div style={{ borderTop: '1px solid #000', paddingTop: '2px', textAlign: 'center', fontSize: '6.5px' }}>
                      Consulta de autenticidade no portal nacional da NF-e<br />
                      <strong>www.nfe.fazenda.gov.br/portal</strong> ou no site da Sefaz Autorizadora
                    </div>
                  </div>
                </div>

                {/* ── NATUREZA DA OPERAÇÃO E PROTOCOLO ── */}
                <div style={{ border: '1px solid #000', marginBottom: '1px', display: 'grid', gridTemplateColumns: '62% 38%' }}>
                  <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                    <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>NATUREZA DA OPERAÇÃO</span>
                    <strong style={{ fontSize: '8px' }}>{xmlData.ide.natOp}</strong>
                  </div>
                  <div style={{ padding: '2px 3px' }}>
                    <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>PROTOCOLO DE AUTORIZAÇÃO DE USO</span>
                    <strong style={{ fontSize: '8px' }}>{xmlData.ide.nProt || '100 - Autorizado o uso do DF-e'} {xmlData.ide.dhRecbto}</strong>
                  </div>
                </div>

                {/* ── INSCRIÇÃO ESTADUAL DO EMITENTE ── */}
                <div style={{ border: '1px solid #000', marginBottom: '2px', display: 'grid', gridTemplateColumns: '34% 33% 33%' }}>
                  <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                    <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>INSCRIÇÃO ESTADUAL</span>
                    <strong style={{ fontSize: '8px' }}>{xmlData.emit.ie || 'ISENTO'}</strong>
                  </div>
                  <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                    <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>INSC. ESTADUAL DO SUBST. TRIB.</span>
                    <strong style={{ fontSize: '8px' }}>{xmlData.emit.iest || '—'}</strong>
                  </div>
                  <div style={{ padding: '2px 3px' }}>
                    <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>CNPJ</span>
                    <strong style={{ fontSize: '8px' }}>{xmlData.emit.cnpj}</strong>
                  </div>
                </div>

                {/* ── DESTINATÁRIO / REMETENTE ── */}
                <div style={{ fontSize: '7px', fontWeight: 'bold', margin: '2px 0 1px 0' }}>DESTINATÁRIO / REMETENTE</div>
                <div style={{ border: '1px solid #000', marginBottom: '2px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '62% 23% 15%', borderBottom: '1px solid #000' }}>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>NOME / RAZÃO SOCIAL</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.dest.nome}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>CNPJ / CPF</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.dest.cnpj}</strong>
                    </div>
                    <div style={{ padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>DATA DA EMISSÃO</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.ide.dhEmi ? xmlData.ide.dhEmi.substring(0, 10) : '—'}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '48% 27% 12% 13%', borderBottom: '1px solid #000' }}>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>ENDEREÇO</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.dest.lgr}, {xmlData.dest.nro} {xmlData.dest.cpl}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>BAIRRO / DISTRITO</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.dest.bairro || '—'}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>CEP</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.dest.cep || '—'}</strong>
                    </div>
                    <div style={{ padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>DATA SAÍDA/ENTRADA</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.ide.dhSaiEnt ? xmlData.ide.dhSaiEnt.substring(0, 10) : (xmlData.ide.dhEmi ? xmlData.ide.dhEmi.substring(0, 10) : '—')}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '40% 12% 23% 12% 13%' }}>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>MUNICÍPIO</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.dest.mun}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>FONE / FAX</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.dest.fone || '—'}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>UF</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.dest.uf}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>INSCRIÇÃO ESTADUAL</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.dest.ie || 'ISENTO'}</strong>
                    </div>
                    <div style={{ padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>HORA DE SAÍDA</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.ide.dhSaiEnt && xmlData.ide.dhSaiEnt.length > 11 ? xmlData.ide.dhSaiEnt.substring(11, 19) : '—'}</strong>
                    </div>
                  </div>
                </div>

                {/* ── CÁLCULO DO IMPOSTO ── */}
                <div style={{ fontSize: '7px', fontWeight: 'bold', margin: '2px 0 1px 0' }}>CÁLCULO DO IMPOSTO</div>
                <div style={{ border: '1px solid #000', marginBottom: '2px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', borderBottom: '1px solid #000' }}>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block', textAlign: 'left' }}>BASE DE CÁLCULO DO ICMS</span>
                      <strong style={{ fontSize: '8px' }}>{fmtBrl2(xmlData.totais.vBC)}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block', textAlign: 'left' }}>VALOR DO ICMS</span>
                      <strong style={{ fontSize: '8px' }}>{fmtBrl2(xmlData.totais.vICMS)}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block', textAlign: 'left' }}>BASE DE CÁLC. ICMS S.T.</span>
                      <strong style={{ fontSize: '8px' }}>{fmtBrl2(xmlData.totais.vBCST)}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block', textAlign: 'left' }}>VALOR DO ICMS SUBST.</span>
                      <strong style={{ fontSize: '8px' }}>{fmtBrl2(xmlData.totais.vST)}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block', textAlign: 'left' }}>V. TOTAL TRIB. APROX.</span>
                      <strong style={{ fontSize: '8px' }}>{fmtBrl2(xmlData.totais.vTotTrib)}</strong>
                    </div>
                    <div style={{ padding: '2px 3px', textAlign: 'right' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block', textAlign: 'left' }}>VALOR TOTAL DOS PRODUTOS</span>
                      <strong style={{ fontSize: '8px' }}>{fmtBrl2(xmlData.totais.vProd)}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)' }}>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block', textAlign: 'left' }}>VALOR DO FRETE</span>
                      <strong style={{ fontSize: '8px' }}>{fmtBrl2(xmlData.totais.vFrete)}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block', textAlign: 'left' }}>VALOR DO SEGURO</span>
                      <strong style={{ fontSize: '8px' }}>{fmtBrl2(xmlData.totais.vSeg)}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block', textAlign: 'left' }}>DESCONTO</span>
                      <strong style={{ fontSize: '8px' }}>{fmtBrl2(xmlData.totais.vDesc)}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block', textAlign: 'left' }}>OUTRAS DESPESAS ACESS.</span>
                      <strong style={{ fontSize: '8px' }}>{fmtBrl2(xmlData.totais.vOutro)}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block', textAlign: 'left' }}>VALOR TOTAL DO IPI</span>
                      <strong style={{ fontSize: '8px' }}>{fmtBrl2(xmlData.totais.vIPI)}</strong>
                    </div>
                    <div style={{ padding: '2px 3px', textAlign: 'right', backgroundColor: '#f0f0f0' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block', textAlign: 'left' }}>VALOR TOTAL DA NOTA</span>
                      <strong style={{ fontSize: '9px' }}>{fmtBrl2(xmlData.totais.vNF)}</strong>
                    </div>
                  </div>
                </div>

                {/* ── TRANSPORTADOR / VOLUMES TRANSPORTADOS ── */}
                <div style={{ fontSize: '7px', fontWeight: 'bold', margin: '2px 0 1px 0' }}>TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>
                <div style={{ border: '1px solid #000', marginBottom: '2px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '40% 18% 12% 16% 14%', borderBottom: '1px solid #000' }}>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>NOME / RAZÃO SOCIAL</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.transp.nome || 'O MESMO'}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>FRETE POR CONTA</span>
                      <strong style={{ fontSize: '7px' }}>{xmlData.transp.modFrete ? MOD_FRETE_MAP[xmlData.transp.modFrete]?.substring(0, 24) : '9 - Sem Transporte'}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>CÓDIGO ANTT</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.transp.rntc || '—'}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>PLACA DO VEÍCULO</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.transp.placa || '—'} {xmlData.transp.veicUf}</strong>
                    </div>
                    <div style={{ padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>CNPJ / CPF</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.transp.cnpj || '—'}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '50% 30% 6% 14%' }}>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>ENDEREÇO</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.transp.ender || '—'}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>MUNICÍPIO</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.transp.mun || '—'}</strong>
                    </div>
                    <div style={{ borderRight: '1px solid #000', padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>UF</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.transp.uf || '—'}</strong>
                    </div>
                    <div style={{ padding: '2px 3px' }}>
                      <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>INSCRIÇÃO ESTADUAL</span>
                      <strong style={{ fontSize: '8px' }}>{xmlData.transp.ie || '—'}</strong>
                    </div>
                  </div>
                </div>

                {/* ── DADOS DO PRODUTO / SERVIÇO ── */}
                <div style={{ fontSize: '7px', fontWeight: 'bold', margin: '2px 0 1px 0' }}>DADOS DOS PRODUTOS / SERVIÇOS</div>
                <div style={{ border: '1px solid #000', marginBottom: '2px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '6.5px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>
                        <th style={{ borderRight: '1px solid #000', padding: '1px 2px', width: '38px' }}>CÓDIGO</th>
                        <th style={{ borderRight: '1px solid #000', padding: '1px 3px', textAlign: 'left' }}>DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                        <th style={{ borderRight: '1px solid #000', padding: '1px 2px', width: '32px' }}>NCM/SH</th>
                        <th style={{ borderRight: '1px solid #000', padding: '1px 2px', width: '22px' }}>O/CST</th>
                        <th style={{ borderRight: '1px solid #000', padding: '1px 2px', width: '24px' }}>CFOP</th>
                        <th style={{ borderRight: '1px solid #000', padding: '1px 2px', width: '16px' }}>UN</th>
                        <th style={{ borderRight: '1px solid #000', padding: '1px 2px', width: '32px' }}>QUANT</th>
                        <th style={{ borderRight: '1px solid #000', padding: '1px 2px', width: '36px' }}>VALOR UNIT</th>
                        <th style={{ borderRight: '1px solid #000', padding: '1px 2px', width: '38px' }}>VALOR TOTAL</th>
                        <th style={{ borderRight: '1px solid #000', padding: '1px 2px', width: '28px' }}>VALOR DESC</th>
                        <th style={{ borderRight: '1px solid #000', padding: '1px 2px', width: '34px' }}>B.CÁLC ICMS</th>
                        <th style={{ borderRight: '1px solid #000', padding: '1px 2px', width: '30px' }}>VALOR ICMS</th>
                        <th style={{ borderRight: '1px solid #000', padding: '1px 2px', width: '26px' }}>VALOR IPI</th>
                        <th style={{ borderRight: '1px solid #000', padding: '1px 2px', width: '20px' }}>ALÍQ. ICMS</th>
                        <th style={{ padding: '1px 2px', width: '20px' }}>ALÍQ. IPI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {xmlData.itens.map((it: any) => (
                        <tr key={it.numeroItem} style={{ borderBottom: '1px solid #ccc', textAlign: 'center' }}>
                          <td style={{ borderRight: '1px solid #000', padding: '1px 2px' }}>{it.codigo}</td>
                          <td style={{ borderRight: '1px solid #000', padding: '1px 3px', textAlign: 'left', lineHeight: 1.15 }}>
                            <strong>{it.descricao}</strong>
                            {(it.vICMSMono > 0 || it.vICMSMonoRet > 0) && (
                              <div style={{ fontSize: '5.5px', color: '#333', marginTop: '1px' }}>
                                ICMS monofasico sobre combustiveis cobrado anteriormente conf. Conv. ICMS 199/22<br />
                                BC {fmtNum4(it.qBCMono || it.quantidade)} (em litros) | Aliq: R$ {it.adRemICMS || 1.22} | Vlr.ICMS mono ret: {fmtBrl(it.vICMSMonoRet || it.vICMSMono || 0)}
                              </div>
                            )}
                            {it.infAdProd && (
                              <div style={{ fontSize: '5.5px', color: '#444' }}>{it.infAdProd}</div>
                            )}
                          </td>
                          <td style={{ borderRight: '1px solid #000', padding: '1px 2px' }}>{it.ncm}</td>
                          <td style={{ borderRight: '1px solid #000', padding: '1px 2px' }}>{it.cstIcms || '00'}</td>
                          <td style={{ borderRight: '1px solid #000', padding: '1px 2px' }}>{it.cfop}</td>
                          <td style={{ borderRight: '1px solid #000', padding: '1px 2px' }}>{it.unidade}</td>
                          <td style={{ borderRight: '1px solid #000', padding: '1px 2px', textAlign: 'right' }}>{fmtNum4(it.quantidade)}</td>
                          <td style={{ borderRight: '1px solid #000', padding: '1px 2px', textAlign: 'right' }}>{fmtNum4(it.valorUnitario)}</td>
                          <td style={{ borderRight: '1px solid #000', padding: '1px 2px', textAlign: 'right', fontWeight: 'bold' }}>{fmtBrl2(it.valorTotal)}</td>
                          <td style={{ borderRight: '1px solid #000', padding: '1px 2px', textAlign: 'right' }}>{fmtBrl2(it.valorDesconto)}</td>
                          <td style={{ borderRight: '1px solid #000', padding: '1px 2px', textAlign: 'right' }}>{fmtBrl2(it.vBCIcms)}</td>
                          <td style={{ borderRight: '1px solid #000', padding: '1px 2px', textAlign: 'right' }}>{fmtBrl2(it.vIcms)}</td>
                          <td style={{ borderRight: '1px solid #000', padding: '1px 2px', textAlign: 'right' }}>{fmtBrl2(it.vIpi)}</td>
                          <td style={{ borderRight: '1px solid #000', padding: '1px 2px', textAlign: 'right' }}>{it.pIcms ? `${it.pIcms}%` : '0,00'}</td>
                          <td style={{ padding: '1px 2px', textAlign: 'right' }}>{it.pIpi ? `${it.pIpi}%` : '0,00'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── DADOS ADICIONAIS ── */}
                <div style={{ border: '1px solid #000', marginBottom: '1px', display: 'grid', gridTemplateColumns: '75% 25%' }}>
                  <div style={{ borderRight: '1px solid #000', padding: '3px 4px', minHeight: '40px' }}>
                    <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>INFORMAÇÕES COMPLEMENTARES</span>
                    <div style={{ fontSize: '6.5px', whiteSpace: 'pre-wrap', lineHeight: 1.25 }}>
                      {xmlData.infAdic.infCpl}
                      {xmlData.infAdic.infAdFisco && <><br />{xmlData.infAdic.infAdFisco}</>}
                    </div>
                  </div>
                  <div style={{ padding: '3px 4px', minHeight: '40px' }}>
                    <span style={{ fontSize: '6px', fontWeight: 'bold', display: 'block' }}>RESERVADO AO FISCO</span>
                  </div>
                </div>

                {/* Rodapé do DANFE */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '6px', color: '#666', marginTop: '2px' }}>
                  <span>Impresso em {new Date().toLocaleString('pt-BR')}</span>
                  <span>Gerado pelo Radar de Conformidade Fiscal</span>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              MODO 3: CÓDIGO XML FORMATADO (PRETTY-PRINT SYNTAX HIGHLIGHTED)
              ════════════════════════════════════════════════════════════════ */}
          {viewMode === 'formatted' && (
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 py-3 overflow-x-auto shadow-inner text-xs leading-relaxed max-w-5xl mx-auto">
              <div className="px-4 pb-2 border-b border-slate-800/60 flex items-center justify-between">
                <span className="text-slate-400 font-mono text-[11px]">Código XML Puro ({formattedLines.length} linhas)</span>
                <label className="flex items-center gap-2 text-slate-400 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={collapseBase64}
                    onChange={(e) => setCollapseBase64(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700"
                  />
                  <span>Encurtar Certificado/Assinatura Base64</span>
                </label>
              </div>
              <div className="pt-2">
                {formattedLines.map((line, idx) => {
                  const isMatch = searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase());
                  return (
                    <div
                      key={idx}
                      className={`flex items-start transition-colors px-2 py-0.5 hover:bg-slate-800/60 ${
                        isMatch ? 'bg-amber-500/25 text-amber-200 font-bold' : ''
                      }`}
                    >
                      <span className="w-12 shrink-0 select-none text-right pr-4 text-slate-600 font-mono text-[11px] py-0.5 border-r border-slate-800">
                        {idx + 1}
                      </span>
                      <pre className="pl-4 font-mono text-xs overflow-x-auto whitespace-pre">
                        {renderHighlightedLine(line)}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── FOOTER BAR ── */}
        <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Documento Fiscal Assinado e Homologado pela SEFAZ</span>
          </div>
          <div>
            Total da Nota: <strong className="text-emerald-400 font-mono text-sm">{fmtBrl(xmlData?.totais?.vNF || item.valorTotal)}</strong>
          </div>
        </div>

      </div>
    </div>
  );
};
