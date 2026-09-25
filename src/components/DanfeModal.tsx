import React, { useRef, useMemo } from 'react';
import {
  X,
  Printer,
  FileCode,
  Truck,
  Building2,
  CheckCircle2,
  Package,
  Sparkles,
  Info
} from 'lucide-react';
import { DfeXmlItem, ItemDfeDetail } from '../types';
import { generateCode128C_SVG, formatChaveAcesso44 } from '../utils/danfeCode128';

/* ─────────────────────────────────────────────────────────────────────────
   ESTILO INLINE PARA IMPRESSÃO A4 — Injetado uma única vez no <head>.
   Garante @page A4 retrato com margem de 5mm conforme MOC 7.00.
   ───────────────────────────────────────────────────────────────────────── */
const PRINT_STYLE_ID = 'danfe-print-style';
function ensurePrintStyle() {
  if (typeof document === 'undefined') return;
  let style = document.getElementById(PRINT_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = PRINT_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `
    .danfe-sheet, .danfe-sheet *, .danfe-print-area, .danfe-print-area * {
      color-scheme: light !important;
      forced-color-adjust: none !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .danfe-sheet, .danfe-print-area {
      background-color: #ffffff !important;
      color: #000000 !important;
    }
    .danfe-sheet .danfe-cell, .danfe-print-area .danfe-cell,
    .danfe-sheet .danfe-box, .danfe-print-area .danfe-box,
    .danfe-sheet table, .danfe-print-area table,
    .danfe-sheet tbody, .danfe-print-area tbody,
    .danfe-sheet tr, .danfe-print-area tr,
    .danfe-sheet td, .danfe-print-area td {
      background-color: #ffffff !important;
      color: #000000 !important;
    }
    .danfe-sheet .danfe-header-bar, .danfe-print-area .danfe-header-bar {
      background-color: #e5e7eb !important;
      color: #000000 !important;
    }
    .danfe-sheet th, .danfe-print-area th {
      background-color: #f3f4f6 !important;
      color: #000000 !important;
    }
    @media print {
      @page { size: A4 portrait; margin: 5mm; }
      body * { visibility: hidden !important; }
      .danfe-print-area, .danfe-print-area * { visibility: visible !important; }
      .danfe-print-area {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: 'Times New Roman', 'Courier New', serif !important;
      }
      .danfe-no-print { display: none !important; }
    }
  `;
}

interface DanfeModalProps {
  item: DfeXmlItem | null;
  onClose: () => void;
}

/* ─────── Utilitários de extração DOM do XML ─────── */
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

/* ─────── Formatação de moeda BRL ─────── */
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl2 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ─────── Caixa de campo individual (quadro DANFE) ─────── */
function DanfeField({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`danfe-cell px-1 py-0.5 ${className}`}
      style={{
        backgroundColor: '#ffffff',
        color: '#000000',
        forcedColorAdjust: 'none',
        colorScheme: 'light',
      }}
    >
      <div className="danfe-field-label text-[6.5px] font-bold uppercase leading-none mb-px" style={{ color: '#4b5563' }}>{label}</div>
      <div className="danfe-field-val text-[9px] font-semibold leading-tight" style={{ color: '#000000' }}>{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
export const DanfeModal: React.FC<DanfeModalProps> = ({ item, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  // Injetar estilo de impressão
  React.useEffect(() => { ensurePrintStyle(); }, []);

  /* ───── Extração completa e autêntica dos dados do XML via DOMParser ───── */
  const parsed = useMemo(() => {
    if (!item) return null;

    let xmlDoc: Document | null = null;
    if (item.xmlRaw) {
      try {
        const parser = new DOMParser();
        xmlDoc = parser.parseFromString(item.xmlRaw, 'text/xml');
      } catch (e) {
        console.warn('Falha no parse do XML bruto:', e);
      }
    }

    // 1. Identificação / Natureza
    const natOp = xmlDoc ? getTag(xmlDoc, 'natOp') : '';
    const tpNF = xmlDoc ? getTag(xmlDoc, 'tpNF') : '';
    const nProt = xmlDoc ? getTag(xmlDoc, 'nProt') : '';
    const dhRecbto = xmlDoc ? (getTag(xmlDoc, 'dhRecbto') || item.dataEmissao) : item.dataEmissao;
    const serie = xmlDoc ? (getTag(xmlDoc, 'serie') || item.serie || '') : (item.serie || '');
    const nNF = xmlDoc ? (getTag(xmlDoc, 'nNF') || getTag(xmlDoc, 'nCT') || item.numero) : item.numero;
    const dhEmi = xmlDoc ? (getTag(xmlDoc, 'dhEmi') || getTag(xmlDoc, 'dEmi') || item.dataEmissao) : item.dataEmissao;
    const dhSaiEnt = xmlDoc ? (getTag(xmlDoc, 'dhSaiEnt') || getTag(xmlDoc, 'dSaiEnt') || '') : '';

    // 2. Emitente
    const emitNome = xmlDoc ? (getSubTag(xmlDoc, 'emit', 'xNome') || item.emitenteNome) : item.emitenteNome;
    const emitFant = xmlDoc ? getSubTag(xmlDoc, 'emit', 'xFant') : '';
    const emitCnpj = xmlDoc ? (getSubTag(xmlDoc, 'emit', 'CNPJ') || getSubTag(xmlDoc, 'emit', 'CPF') || item.emitenteCnpj) : item.emitenteCnpj;
    const emitIe = xmlDoc ? (getSubTag(xmlDoc, 'emit', 'IE') || item.emitenteIe || '') : (item.emitenteIe || '');
    const emitIeST = xmlDoc ? getSubTag(xmlDoc, 'emit', 'IEST') : '';
    const emitLgr = xmlDoc ? getSubTag(xmlDoc, 'enderEmit', 'xLgr') : '';
    const emitNro = xmlDoc ? getSubTag(xmlDoc, 'enderEmit', 'nro') : '';
    const emitCpl = xmlDoc ? getSubTag(xmlDoc, 'enderEmit', 'xCpl') : '';
    const emitBairro = xmlDoc ? getSubTag(xmlDoc, 'enderEmit', 'xBairro') : '';
    const emitMun = xmlDoc ? getSubTag(xmlDoc, 'enderEmit', 'xMun') : '';
    const emitUf = xmlDoc ? (getSubTag(xmlDoc, 'enderEmit', 'UF') || item.emitenteUf) : item.emitenteUf;
    const emitCep = xmlDoc ? getSubTag(xmlDoc, 'enderEmit', 'CEP') : '';
    const emitFone = xmlDoc ? getSubTag(xmlDoc, 'enderEmit', 'fone') : '';

    // 3. Destinatário
    const destNome = xmlDoc ? (getSubTag(xmlDoc, 'dest', 'xNome') || item.destinatarioNome) : item.destinatarioNome;
    const destCnpj = xmlDoc ? (getSubTag(xmlDoc, 'dest', 'CNPJ') || getSubTag(xmlDoc, 'dest', 'CPF') || item.destinatarioCnpj) : item.destinatarioCnpj;
    const destIe = xmlDoc ? (getSubTag(xmlDoc, 'dest', 'IE') || item.destinatarioIe || '') : (item.destinatarioIe || '');
    const destLgr = xmlDoc ? getSubTag(xmlDoc, 'enderDest', 'xLgr') : '';
    const destNro = xmlDoc ? getSubTag(xmlDoc, 'enderDest', 'nro') : '';
    const destCpl = xmlDoc ? getSubTag(xmlDoc, 'enderDest', 'xCpl') : '';
    const destBairro = xmlDoc ? getSubTag(xmlDoc, 'enderDest', 'xBairro') : '';
    const destMun = xmlDoc ? getSubTag(xmlDoc, 'enderDest', 'xMun') : '';
    const destUf = xmlDoc ? (getSubTag(xmlDoc, 'enderDest', 'UF') || item.destinatarioUf) : item.destinatarioUf;
    const destCep = xmlDoc ? getSubTag(xmlDoc, 'enderDest', 'CEP') : '';
    const destFone = xmlDoc ? getSubTag(xmlDoc, 'enderDest', 'fone') : '';

    // 4. Totais ICMSTot
    const vBC = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ICMSTot', 'vBC') || '0') : 0;
    const vICMS = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ICMSTot', 'vICMS') || '0') : item.valorIcms;
    const vBCST = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ICMSTot', 'vBCST') || '0') : 0;
    const vST = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ICMSTot', 'vST') || '0') : 0;
    const vProd = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ICMSTot', 'vProd') || '0') : item.valorTotal;
    const vFrete = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ICMSTot', 'vFrete') || '0') : 0;
    const vSeg = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ICMSTot', 'vSeg') || '0') : 0;
    const vDesc = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ICMSTot', 'vDesc') || '0') : 0;
    const vII = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ICMSTot', 'vII') || '0') : 0;
    const vIPI = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ICMSTot', 'vIPI') || '0') : item.valorIpi;
    const vPIS = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ICMSTot', 'vPIS') || '0') : item.valorPis;
    const vCOFINS = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ICMSTot', 'vCOFINS') || '0') : item.valorCofins;
    const vOutro = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ICMSTot', 'vOutro') || '0') : 0;
    const vNF = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ICMSTot', 'vNF') || '0') : item.valorTotal;

    // 5. Itens Reais do XML (<det>)
    const itensExtraidos: ItemDfeDetail[] = [];
    if (xmlDoc) {
      const detNodes = xmlDoc.getElementsByTagName('det');
      for (let i = 0; i < detNodes.length; i++) {
        const det = detNodes[i];
        const numItem = parseInt(det.getAttribute('nItem') || `${i + 1}`, 10);
        const prod = det.getElementsByTagName('prod')[0];

        const cProd = prod ? getTag(prod, 'cProd') : '';
        const xProd = prod ? getTag(prod, 'xProd') : '';
        const ncm = prod ? getTag(prod, 'NCM') : '';
        const cest = prod ? getTag(prod, 'CEST') : '';
        const cfop = prod ? getTag(prod, 'CFOP') : '';
        const uCom = prod ? getTag(prod, 'uCom') : '';
        const qCom = prod ? parseFloat(getTag(prod, 'qCom') || '0') : 0;
        const vUnCom = prod ? parseFloat(getTag(prod, 'vUnCom') || '0') : 0;
        const vProdItem = prod ? parseFloat(getTag(prod, 'vProd') || '0') : 0;

        // Informações adicionais do produto
        const infAdProd = prod ? getTag(det, 'infAdProd') : '';

        // Impostos do item
        const icmsNode = det.getElementsByTagName('ICMS')[0];
        const ipiNode = det.getElementsByTagName('IPI')[0];
        const cstIcms = icmsNode ? (getTag(icmsNode, 'CST') || getTag(icmsNode, 'CSOSN') || '') : '';
        const origIcms = icmsNode ? getTag(icmsNode, 'orig') : '';
        const vBCIcms = icmsNode ? parseFloat(getTag(icmsNode, 'vBC') || '0') : 0;
        const pIcms = icmsNode ? parseFloat(getTag(icmsNode, 'pICMS') || '0') : 0;
        const vIcmsItem = icmsNode ? parseFloat(getTag(icmsNode, 'vICMS') || '0') : 0;

        const vIpiItem = ipiNode ? parseFloat(getTag(ipiNode, 'vIPI') || '0') : 0;
        const pIpi = ipiNode ? parseFloat(getTag(ipiNode, 'pIPI') || '0') : 0;

        // RTC — CBS/IBS (extrair se existir, senão zero)
        const ibsCbsNode = det.getElementsByTagName('IBSCBS')[0] || det.getElementsByTagName('gIBSCBS')[0];
        const vCbsItem = ibsCbsNode ? parseFloat(getTag(ibsCbsNode, 'vCBS') || '0') : 0;
        const vIbsItem = ibsCbsNode ? parseFloat(getTag(ibsCbsNode, 'vIBS') || getTag(ibsCbsNode, 'vIBSUF') || '0') : 0;
        const pCbsItem = ibsCbsNode ? parseFloat(getTag(ibsCbsNode, 'pCBS') || '0') : 0;
        const pIbsItem = ibsCbsNode ? parseFloat(getTag(ibsCbsNode, 'pIBS') || getTag(ibsCbsNode, 'pIBSUF') || '0') : 0;
        const cClassTrib = ibsCbsNode ? getTag(ibsCbsNode, 'cClassTrib') : '';

        itensExtraidos.push({
          numeroItem: numItem,
          codigo: cProd,
          descricao: xProd + (infAdProd ? `\n${infAdProd}` : ''),
          ncmCts: ncm,
          cfop,
          cClassTrib: cClassTrib || cest || '',
          unidade: uCom,
          quantidade: qCom,
          valorUnitario: vUnCom,
          valorTotal: vProdItem,
          valorIcms: vIcmsItem,
          valorIpi: vIpiItem,
          valorPis: 0,
          valorCofins: 0,
          valorCbs: vCbsItem,
          valorIbs: vIbsItem,
          aliquotaCbs: pCbsItem,
          aliquotaIbs: pIbsItem,
          aliquotaIcms: pIcms,
          aliquotaIpi: pIpi,
        });
      }
    }
    const finalItens = itensExtraidos.length > 0
      ? itensExtraidos
      : (item.itens && item.itens.length > 0 ? item.itens : []);

    // 6. Duplicatas (<cobr> → <dup>)
    const duplicatas: { nDup: string; dVenc: string; vDup: string }[] = [];
    if (xmlDoc) {
      const dupNodes = xmlDoc.getElementsByTagName('dup');
      for (let i = 0; i < dupNodes.length; i++) {
        duplicatas.push({
          nDup: getTag(dupNodes[i], 'nDup'),
          dVenc: getTag(dupNodes[i], 'dVenc'),
          vDup: getTag(dupNodes[i], 'vDup'),
        });
      }
    }

    // 7. Informações Complementares
    const infCpl = xmlDoc ? (getTag(xmlDoc, 'infCpl') || '') : '';
    const infAdFisco = xmlDoc ? (getTag(xmlDoc, 'infAdFisco') || '') : '';

    // 8. Transporte
    const modFrete = xmlDoc ? (getTag(xmlDoc, 'modFrete') || '') : '';
    const transpNome = xmlDoc ? getSubTag(xmlDoc, 'transporta', 'xNome') : '';
    const transpCnpj = xmlDoc ? (getSubTag(xmlDoc, 'transporta', 'CNPJ') || getSubTag(xmlDoc, 'transporta', 'CPF') || '') : '';
    const transpIe = xmlDoc ? getSubTag(xmlDoc, 'transporta', 'IE') : '';
    const transpMun = xmlDoc ? getSubTag(xmlDoc, 'transporta', 'xMun') : '';
    const transpUf = xmlDoc ? getSubTag(xmlDoc, 'transporta', 'UF') : '';
    const transpEnder = xmlDoc ? getSubTag(xmlDoc, 'transporta', 'xEnder') : '';
    // Veículo
    const veicPlaca = xmlDoc ? (getSubTag(xmlDoc, 'veicTransp', 'placa') || getTag(xmlDoc, 'placa') || '') : '';
    const veicUf = xmlDoc ? (getSubTag(xmlDoc, 'veicTransp', 'UF') || '') : '';
    const veicAntt = xmlDoc ? (getSubTag(xmlDoc, 'veicTransp', 'RNTC') || getTag(xmlDoc, 'RNTC') || '') : '';
    // Volumes
    const qVol = xmlDoc ? getTag(xmlDoc, 'qVol') : '';
    const esp = xmlDoc ? getTag(xmlDoc, 'esp') : '';
    const marca = xmlDoc ? getTag(xmlDoc, 'marca') : '';
    const nVol = xmlDoc ? getTag(xmlDoc, 'nVol') : '';
    const pesoB = xmlDoc ? getTag(xmlDoc, 'pesoB') : '';
    const pesoL = xmlDoc ? getTag(xmlDoc, 'pesoL') : '';

    // 9. ISSQN (quando aplicável)
    const vServISS = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ISSQNtot', 'vServ') || '0') : 0;
    const vBCISS = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ISSQNtot', 'vBC') || '0') : 0;
    const vISS = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ISSQNtot', 'vISS') || '0') : 0;
    const inscMun = xmlDoc ? getSubTag(xmlDoc, 'emit', 'IM') : '';

    // 10. Totais RTC (CBS/IBS totalizadores)
    const vCBSTot = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ICMSTot', 'vCBS') || getSubTag(xmlDoc, 'IBSCBSTot', 'vCBS') || '0') : item.valorCbs;
    const vIBSTot = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ICMSTot', 'vIBS') || getSubTag(xmlDoc, 'IBSCBSTot', 'vIBS') || '0') : item.valorIbs;
    const vISTot = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ICMSTot', 'vIS') || getSubTag(xmlDoc, 'IBSCBSTot', 'vIS') || '0') : item.valorImpostoSeletivo;

    // 11. Código de Barras SVG
    const barcodeSvg = generateCode128C_SVG(item.chaveAcesso, 48, 1.1);

    // 12. CT-e específico
    const cteProPred = xmlDoc ? getTag(xmlDoc, 'proPred') : '';
    const cteMunIni = xmlDoc ? getTag(xmlDoc, 'xMunIni') : '';
    const cteUfIni = xmlDoc ? (getTag(xmlDoc, 'UFIni') || item.emitenteUf) : item.emitenteUf;
    const cteMunFim = xmlDoc ? getTag(xmlDoc, 'xMunFim') : '';
    const cteUfFim = xmlDoc ? (getTag(xmlDoc, 'UFFim') || item.destinatarioUf) : item.destinatarioUf;
    const cteChaveNFe = xmlDoc ? getTag(xmlDoc, 'chave') : '';

    // 13. NFS-e
    const nfseCodServ = xmlDoc ? (getTag(xmlDoc, 'cTribNac') || getTag(xmlDoc, 'ItemListaServico') || '') : '';
    const nfseDisc = xmlDoc ? (getTag(xmlDoc, 'xTribNac') || getTag(xmlDoc, 'Discriminacao') || getTag(xmlDoc, 'xDescServ') || '') : '';
    const nfseLocPrest = xmlDoc ? (getTag(xmlDoc, 'xLocPrestacao') || getTag(xmlDoc, 'xLocIncid') || emitMun) : emitMun;
    const nfseInss = xmlDoc ? parseFloat(getTag(xmlDoc, 'vINSS') || getTag(xmlDoc, 'vRetINSS') || '0') : (item.valorInssRetido || 0);
    const nfseIrrf = xmlDoc ? parseFloat(getTag(xmlDoc, 'vIRRF') || getTag(xmlDoc, 'vRetIRRF') || '0') : (item.valorIrrf || 0);
    const nfseCsll = xmlDoc ? parseFloat(getTag(xmlDoc, 'vCSLL') || getTag(xmlDoc, 'vRetCSLL') || '0') : (item.valorCsllRetido || 0);
    const nfseIssRet = xmlDoc ? parseFloat(getTag(xmlDoc, 'vISSRet') || getTag(xmlDoc, 'vRetISS') || '0') : (item.valorIssRetido || 0);

    return {
      natOp, tpNF, nProt, dhRecbto, serie, nNF, dhEmi, dhSaiEnt,
      emit: { xNome: emitNome, xFant: emitFant, CNPJ: emitCnpj, IE: emitIe, IEST: emitIeST, xLgr: emitLgr, nro: emitNro, xCpl: emitCpl, xBairro: emitBairro, xMun: emitMun, UF: emitUf, CEP: emitCep, fone: emitFone, IM: inscMun },
      dest: { xNome: destNome, CNPJ: destCnpj, IE: destIe, xLgr: destLgr, nro: destNro, xCpl: destCpl, xBairro: destBairro, xMun: destMun, UF: destUf, CEP: destCep, fone: destFone },
      totais: { vBC, vICMS, vBCST, vST, vProd, vFrete, vSeg, vDesc, vII, vIPI, vPIS, vCOFINS, vOutro, vNF },
      itens: finalItens,
      duplicatas,
      infCpl, infAdFisco,
      transp: { modFrete, xNome: transpNome, CNPJ: transpCnpj, IE: transpIe, xMun: transpMun, UF: transpUf, xEnder: transpEnder, placa: veicPlaca, veicUf, RNTC: veicAntt, qVol, esp, marca, nVol, pesoB, pesoL },
      issqn: { vServ: vServISS, vBC: vBCISS, vISS, IM: inscMun },
      rtcTot: { vCBS: vCBSTot, vIBS: vIBSTot, vIS: vISTot },
      barcodeSvg,
      cte: { proPred: cteProPred, munIni: cteMunIni, ufIni: cteUfIni, munFim: cteMunFim, ufFim: cteUfFim, chaveNFe: cteChaveNFe },
      nfse: { codServ: nfseCodServ, discriminacao: nfseDisc, locPrest: nfseLocPrest, inss: nfseInss, irrf: nfseIrrf, csll: nfseCsll, issRet: nfseIssRet },
    };
  }, [item]);

  if (!item || !parsed) return null;

  const handlePrint = () => { window.print(); };

  const modFreteLabel = (mod: string) => {
    const map: Record<string, string> = {
      '0': '0-Emitente', '1': '1-Destinatário', '2': '2-Terceiros',
      '3': '3-Próprio Remetente', '4': '4-Próprio Destinatário', '9': '9-Sem Ocorrência'
    };
    return map[mod] || mod || '';
  };

  const isNFe = item.tipo === 'NFe' || item.tipo === 'NFCe';
  const isCTe = item.tipo === 'CTe';
  const isNFSe = item.tipo === 'NFSe';

  const docTitle = isCTe ? 'DACTE' : isNFSe ? 'DANFSe' : 'DANFE';
  const docSubtitle = isCTe
    ? 'Documento Auxiliar do Conhecimento de Transporte Eletrônico'
    : isNFSe
      ? 'Documento Auxiliar da Nota Fiscal de Serviço Eletrônica'
      : 'Documento Auxiliar da Nota Fiscal Eletrônica';

  const hasRTC = (parsed.rtcTot.vCBS > 0 || parsed.rtcTot.vIBS > 0 || parsed.rtcTot.vIS > 0);

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER — Layout A4 Retrato conforme MOC 7.00 Anexo III.02
     ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">

      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-[900px] max-h-[96vh] flex flex-col shadow-2xl overflow-hidden my-auto">

        {/* ── Barra de Controle (não imprime) ── */}
        <div className="danfe-no-print px-6 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              {isCTe ? <Truck className="w-5 h-5" /> : isNFSe ? <Building2 className="w-5 h-5" /> : <FileCode className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Visualizador {docTitle} — {item.tipo} Nº {parsed.nNF}
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Autorizado
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">{item.chaveAcesso}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-600/30 transition-all cursor-pointer">
              <Printer className="w-4 h-4" /> Imprimir {docTitle}
            </button>
            <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Canvas da Folha A4 ── */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-900/60 flex justify-center">
          <div
            ref={printRef}
            className="danfe-sheet danfe-print-area w-full max-w-[210mm] bg-white text-black rounded shadow-2xl border border-gray-400"
            style={{
              fontFamily: "'Times New Roman', 'Courier New', serif",
              fontSize: '9px',
              lineHeight: '1.2',
              padding: '5mm',
              color: '#000000',
              backgroundColor: '#ffffff',
              colorScheme: 'light',
              forcedColorAdjust: 'none',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            }}
          >

            {/* ══════════════════════════════════════════════════════════ */}
            {/* NF-e / NFC-e — DANFE MOC 7.00 Anexo III.02              */}
            {/* ══════════════════════════════════════════════════════════ */}
            {isNFe && (
              <>
                {/* ── CANHOTO DE RECEBIMENTO ── */}
                <div style={{ border: '1px solid #000', padding: '3px 5px', marginBottom: '2px', backgroundColor: '#ffffff', color: '#000000' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #666', paddingBottom: '2px', marginBottom: '3px' }}>
                    <div style={{ flex: 1, fontSize: '7.5px' }}>
                      RECEBEMOS DE <strong style={{ textTransform: 'uppercase' }}>{parsed.emit.xNome}</strong> OS PRODUTOS / SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO.
                    </div>
                    <div style={{ textAlign: 'right', paddingLeft: '10px', whiteSpace: 'nowrap' }}>
                      <strong style={{ fontSize: '10px', display: 'block' }}>NF-e</strong>
                      <span style={{ fontWeight: 'bold', fontSize: '9px' }}>Nº {parsed.nNF}</span><br />
                      <span style={{ fontSize: '8px' }}>Série {parsed.serie}</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '25% 50% 25%', gap: '4px', fontSize: '7px' }}>
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#555' }}>DATA DE RECEBIMENTO</span>
                      <div style={{ borderBottom: '1px solid #999', height: '12px', marginTop: '2px' }}></div>
                    </div>
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#555' }}>IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span>
                      <div style={{ borderBottom: '1px solid #999', height: '12px', marginTop: '2px' }}></div>
                    </div>
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#555' }}>NF-e Nº {parsed.nNF}</span>
                    </div>
                  </div>
                </div>

                {/* Picote */}
                <div style={{ borderBottom: '2px dashed #999', margin: '3px 0', textAlign: 'center', fontSize: '6.5px', color: '#888', fontWeight: 'bold', letterSpacing: '3px' }}>
                  CORTE AQUI
                </div>

                {/* ── CABEÇALHO PRINCIPAL (3 colunas) ── */}
                <div style={{ border: '2px solid #000', display: 'grid', gridTemplateColumns: '42% 16% 42%', marginBottom: '1px', backgroundColor: '#ffffff', color: '#000000' }}>
                  {/* Emitente */}
                  <div style={{ borderRight: '1px solid #000', padding: '4px 5px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#ffffff', color: '#000000' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.1 }}>
                        {parsed.emit.xNome}
                      </div>
                      {parsed.emit.xFant && <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#444' }}>{parsed.emit.xFant}</div>}
                      <div style={{ fontSize: '7.5px', color: '#333', marginTop: '3px', lineHeight: 1.3 }}>
                        {parsed.emit.xLgr}{parsed.emit.nro ? `, ${parsed.emit.nro}` : ''}{parsed.emit.xCpl ? ` — ${parsed.emit.xCpl}` : ''}<br />
                        {parsed.emit.xBairro}{parsed.emit.xBairro && parsed.emit.xMun ? ' — ' : ''}{parsed.emit.xMun}{parsed.emit.UF ? ` / ${parsed.emit.UF}` : ''}<br />
                        {parsed.emit.CEP ? `CEP: ${parsed.emit.CEP}` : ''}{parsed.emit.fone ? ` — Fone: ${parsed.emit.fone}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Título DANFE + Tipo Operação + Nº/Série/Folha */}
                  <div style={{ borderRight: '1px solid #000', padding: '4px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', color: '#000000' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 900, letterSpacing: '3px' }}>DANFE</div>
                      <div style={{ fontSize: '6.5px', fontWeight: 'bold', color: '#444', lineHeight: 1.2, marginTop: '1px' }}>
                        DOCUMENTO AUXILIAR<br />DA NOTA FISCAL<br />ELETRÔNICA
                      </div>
                    </div>
                    <div style={{ border: '1px solid #000', padding: '2px 4px', margin: '3px 0', fontSize: '7px', fontWeight: 'bold', textAlign: 'left', backgroundColor: '#ffffff' }}>
                      <div>0 - ENTRADA</div>
                      <div>1 - SAÍDA</div>
                      <div style={{ textAlign: 'center', marginTop: '2px', background: '#000', color: '#fff', padding: '1px 4px', fontWeight: 900, fontSize: '11px' }}>
                        {parsed.tpNF}
                      </div>
                    </div>
                    <div style={{ fontSize: '8px', lineHeight: 1.3 }}>
                      <strong style={{ fontSize: '10px' }}>Nº {parsed.nNF}</strong><br />
                      <span style={{ fontWeight: 'bold' }}>SÉRIE {parsed.serie}</span><br />
                      <span>FOLHA 1/1</span>
                    </div>
                  </div>

                  {/* Código de Barras + Chave + Protocolo */}
                  <div style={{ padding: '4px 5px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#ffffff', color: '#000000' }}>
                    {/* Código de Barras CODE-128C */}
                    <div style={{ textAlign: 'center', padding: '2px 0' }} dangerouslySetInnerHTML={{ __html: parsed.barcodeSvg }} />

                    {/* Chave de Acesso */}
                    <div style={{ border: '1px solid #000', padding: '2px 4px', marginTop: '2px', backgroundColor: '#ffffff' }}>
                      <div style={{ fontSize: '6.5px', fontWeight: 'bold', color: '#555' }}>CHAVE DE ACESSO</div>
                      <div style={{ fontSize: '8px', fontFamily: "'Courier New', monospace", fontWeight: 900, letterSpacing: '0.5px', wordBreak: 'break-all' }}>
                        {formatChaveAcesso44(item.chaveAcesso)}
                      </div>
                    </div>

                    {/* Consulta */}
                    <div style={{ fontSize: '6.5px', color: '#555', marginTop: '2px', lineHeight: 1.2 }}>
                      Consulta de autenticidade no portal nacional da NF-e<br />
                      <strong>www.nfe.fazenda.gov.br/portal</strong>
                    </div>

                    {/* Protocolo */}
                    <div style={{ borderTop: '1px solid #999', paddingTop: '2px', marginTop: '2px', fontSize: '7px' }}>
                      <span style={{ fontWeight: 'bold', color: '#555', fontSize: '6.5px' }}>PROTOCOLO DE AUTORIZAÇÃO DE USO</span><br />
                      <strong style={{ fontFamily: "'Courier New', monospace", fontSize: '8px' }}>{parsed.nProt}{parsed.nProt && parsed.dhRecbto ? ' — ' : ''}{parsed.dhRecbto}</strong>
                    </div>
                  </div>
                </div>

                {/* ── NATUREZA DA OPERAÇÃO / INSCRIÇÕES ── */}
                <div style={{ border: '1px solid #000', borderTop: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', marginBottom: '1px', backgroundColor: '#ffffff', color: '#000000' }}>
                  <DanfeField label="NATUREZA DA OPERAÇÃO" className="border-r border-black" >{parsed.natOp}</DanfeField>
                  <DanfeField label="INSCRIÇÃO ESTADUAL" className="border-r border-black">{parsed.emit.IE || ''}</DanfeField>
                  <DanfeField label="INSCRIÇÃO ESTADUAL DO SUBST. TRIBUT." className="border-r border-black">{parsed.emit.IEST || ''}</DanfeField>
                  <DanfeField label="CNPJ">{parsed.emit.CNPJ}</DanfeField>
                </div>

                {/* ── DESTINATÁRIO / REMETENTE ── */}
                <div style={{ border: '1px solid #000', marginBottom: '1px', backgroundColor: '#ffffff', color: '#000000' }}>
                  <div className="danfe-header-bar" style={{ backgroundColor: '#e5e7eb', color: '#000000', padding: '1px 5px', fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid #000' }}>
                    DESTINATÁRIO / REMETENTE
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '50% 30% 20%', backgroundColor: '#ffffff' }}>
                    <DanfeField label="NOME / RAZÃO SOCIAL" className="border-r border-b border-black">{parsed.dest.xNome}</DanfeField>
                    <DanfeField label="CNPJ / CPF" className="border-r border-b border-black"><span style={{ fontFamily: "'Courier New', monospace" }}>{parsed.dest.CNPJ}</span></DanfeField>
                    <DanfeField label="DATA DE EMISSÃO" className="border-b border-black"><span style={{ fontFamily: "'Courier New', monospace" }}>{parsed.dhEmi}</span></DanfeField>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '40% 20% 15% 25%', backgroundColor: '#ffffff' }}>
                    <DanfeField label="ENDEREÇO" className="border-r border-b border-black">
                      {parsed.dest.xLgr ? `${parsed.dest.xLgr}${parsed.dest.nro ? `, ${parsed.dest.nro}` : ''}${parsed.dest.xCpl ? ` — ${parsed.dest.xCpl}` : ''}` : ''}
                    </DanfeField>
                    <DanfeField label="BAIRRO / DISTRITO" className="border-r border-b border-black">{parsed.dest.xBairro}</DanfeField>
                    <DanfeField label="CEP" className="border-r border-b border-black"><span style={{ fontFamily: "'Courier New', monospace" }}>{parsed.dest.CEP}</span></DanfeField>
                    <DanfeField label="DATA SAÍDA / ENTRADA" className="border-b border-black"><span style={{ fontFamily: "'Courier New', monospace" }}>{parsed.dhSaiEnt}</span></DanfeField>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '35% 25% 10% 15% 15%', backgroundColor: '#ffffff' }}>
                    <DanfeField label="MUNICÍPIO" className="border-r border-black">{parsed.dest.xMun}</DanfeField>
                    <DanfeField label="FONE / FAX" className="border-r border-black">{parsed.dest.fone}</DanfeField>
                    <DanfeField label="UF" className="border-r border-black">{parsed.dest.UF}</DanfeField>
                    <DanfeField label="INSCRIÇÃO ESTADUAL" className="border-r border-black">{parsed.dest.IE}</DanfeField>
                    <DanfeField label="HORA DA SAÍDA">{parsed.dhSaiEnt ? parsed.dhSaiEnt.split('T')[1]?.substring(0, 8) || '' : ''}</DanfeField>
                  </div>
                </div>

                {/* ── FATURA / DUPLICATAS ── */}
                {parsed.duplicatas.length > 0 && (
                  <div style={{ border: '1px solid #000', marginBottom: '1px', backgroundColor: '#ffffff', color: '#000000' }}>
                    <div className="danfe-header-bar" style={{ backgroundColor: '#e5e7eb', color: '#000000', padding: '1px 5px', fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid #000' }}>
                      FATURA / DUPLICATAS
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', padding: '2px 4px', gap: '4px', fontSize: '7.5px', backgroundColor: '#ffffff' }}>
                      {parsed.duplicatas.map((dup, i) => (
                        <div key={i} style={{ border: '1px solid #ccc', padding: '1px 4px', fontSize: '7px', backgroundColor: '#ffffff', color: '#000000' }}>
                          <strong>{dup.nDup}</strong> — Venc: {dup.dVenc} — Valor: {brl(parseFloat(dup.vDup || '0'))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── CÁLCULO DO IMPOSTO ── */}
                <div style={{ border: '1px solid #000', marginBottom: '1px', backgroundColor: '#ffffff', color: '#000000' }}>
                  <div className="danfe-header-bar" style={{ backgroundColor: '#e5e7eb', color: '#000000', padding: '1px 5px', fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid #000' }}>
                    CÁLCULO DO IMPOSTO
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', textAlign: 'center', borderBottom: '1px solid #000', backgroundColor: '#ffffff' }}>
                    <DanfeField label="BASE DE CÁLC. DO ICMS" className="border-r border-black"><span style={{ fontFamily: "'Courier New', monospace" }}>{brl2(parsed.totais.vBC)}</span></DanfeField>
                    <DanfeField label="VALOR DO ICMS" className="border-r border-black"><span style={{ fontFamily: "'Courier New', monospace" }}>{brl2(parsed.totais.vICMS)}</span></DanfeField>
                    <DanfeField label="BASE DE CÁLC. ICMS ST" className="border-r border-black"><span style={{ fontFamily: "'Courier New', monospace" }}>{brl2(parsed.totais.vBCST)}</span></DanfeField>
                    <DanfeField label="VALOR DO ICMS ST" className="border-r border-black"><span style={{ fontFamily: "'Courier New', monospace" }}>{brl2(parsed.totais.vST)}</span></DanfeField>
                    <DanfeField label="VALOR TOTAL DOS PRODUTOS" className="border-r border-black"><span style={{ fontFamily: "'Courier New', monospace" }}>{brl2(parsed.totais.vProd)}</span></DanfeField>
                    <DanfeField label="VALOR TOTAL DA NOTA FISCAL"><strong style={{ fontFamily: "'Courier New', monospace", fontSize: '10px' }}>{brl2(parsed.totais.vNF)}</strong></DanfeField>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', backgroundColor: '#ffffff' }}>
                    <DanfeField label="VALOR DO FRETE" className="border-r border-black"><span style={{ fontFamily: "'Courier New', monospace" }}>{brl2(parsed.totais.vFrete)}</span></DanfeField>
                    <DanfeField label="VALOR DO SEGURO" className="border-r border-black"><span style={{ fontFamily: "'Courier New', monospace" }}>{brl2(parsed.totais.vSeg)}</span></DanfeField>
                    <DanfeField label="DESCONTO" className="border-r border-black"><span style={{ fontFamily: "'Courier New', monospace" }}>{brl2(parsed.totais.vDesc)}</span></DanfeField>
                    <DanfeField label="OUTRAS DESPESAS" className="border-r border-black"><span style={{ fontFamily: "'Courier New', monospace" }}>{brl2(parsed.totais.vOutro)}</span></DanfeField>
                    <DanfeField label="VALOR DO IPI" className="border-r border-black"><span style={{ fontFamily: "'Courier New', monospace" }}>{brl2(parsed.totais.vIPI)}</span></DanfeField>
                    <DanfeField label="VALOR APROX. TRIBUTOS" className="border-r border-black"><span style={{ fontFamily: "'Courier New', monospace" }}>{brl2(parsed.totais.vPIS + parsed.totais.vCOFINS)}</span></DanfeField>
                    <DanfeField label="IMPOSTO IMPORTAÇÃO"><span style={{ fontFamily: "'Courier New', monospace" }}>{brl2(parsed.totais.vII)}</span></DanfeField>
                  </div>
                </div>

                {/* ── TRANSPORTADOR / VOLUMES TRANSPORTADOS ── */}
                <div style={{ border: '1px solid #000', marginBottom: '1px', backgroundColor: '#ffffff', color: '#000000' }}>
                  <div className="danfe-header-bar" style={{ backgroundColor: '#e5e7eb', color: '#000000', padding: '1px 5px', fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid #000' }}>
                    TRANSPORTADOR / VOLUMES TRANSPORTADOS
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '30% 15% 15% 15% 10% 15%', borderBottom: '1px solid #000', backgroundColor: '#ffffff' }}>
                    <DanfeField label="RAZÃO SOCIAL" className="border-r border-black">{parsed.transp.xNome}</DanfeField>
                    <DanfeField label="FRETE POR CONTA" className="border-r border-black">{modFreteLabel(parsed.transp.modFrete)}</DanfeField>
                    <DanfeField label="CÓDIGO ANTT" className="border-r border-black">{parsed.transp.RNTC}</DanfeField>
                    <DanfeField label="PLACA DO VEÍC." className="border-r border-black">{parsed.transp.placa}</DanfeField>
                    <DanfeField label="UF" className="border-r border-black">{parsed.transp.veicUf}</DanfeField>
                    <DanfeField label="CNPJ / CPF"><span style={{ fontFamily: "'Courier New', monospace" }}>{parsed.transp.CNPJ}</span></DanfeField>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '30% 15% 15% 10% 15% 15%', backgroundColor: '#ffffff' }}>
                    <DanfeField label="ENDEREÇO" className="border-r border-black">{parsed.transp.xEnder}</DanfeField>
                    <DanfeField label="MUNICÍPIO" className="border-r border-black">{parsed.transp.xMun}</DanfeField>
                    <DanfeField label="UF" className="border-r border-black">{parsed.transp.UF}</DanfeField>
                    <DanfeField label="INSCRIÇÃO ESTADUAL" className="border-r border-black">{parsed.transp.IE}</DanfeField>
                    <DanfeField label="QUANTIDADE" className="border-r border-black">{parsed.transp.qVol}</DanfeField>
                    <DanfeField label="ESPÉCIE">{parsed.transp.esp}</DanfeField>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '20% 20% 20% 20% 20%', borderTop: '1px solid #000', backgroundColor: '#ffffff' }}>
                    <DanfeField label="MARCA" className="border-r border-black">{parsed.transp.marca}</DanfeField>
                    <DanfeField label="NUMERAÇÃO" className="border-r border-black">{parsed.transp.nVol}</DanfeField>
                    <DanfeField label="PESO BRUTO" className="border-r border-black">{parsed.transp.pesoB}</DanfeField>
                    <DanfeField label="PESO LÍQUIDO" className="border-r border-black">{parsed.transp.pesoL}</DanfeField>
                    <DanfeField label="VALOR DO SERVIÇO">{''}</DanfeField>
                  </div>
                </div>

                {/* ── DADOS DOS PRODUTOS / SERVIÇOS ── */}
                <div style={{ border: '1px solid #000', marginBottom: '1px', backgroundColor: '#ffffff', color: '#000000' }}>
                  <div className="danfe-header-bar" style={{ backgroundColor: '#e5e7eb', color: '#000000', padding: '1px 5px', fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid #000', display: 'flex', justifyContent: 'space-between' }}>
                    <span>DADOS DOS PRODUTOS / SERVIÇOS</span>
                    <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 'bold', fontSize: '6.5px' }}>{parsed.itens.length} ITEM(NS)</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7px', fontFamily: "'Courier New', monospace", backgroundColor: '#ffffff', color: '#000000' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f3f4f6', color: '#000000', borderBottom: '1px solid #000', fontSize: '6px', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center' }}>
                        <th style={{ padding: '1px 2px', borderRight: '1px solid #ccc', width: '35px', backgroundColor: '#f3f4f6', color: '#000000' }}>CÓD PROD</th>
                        <th style={{ padding: '1px 2px', borderRight: '1px solid #ccc', textAlign: 'left', backgroundColor: '#f3f4f6', color: '#000000' }}>DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                        <th style={{ padding: '1px 2px', borderRight: '1px solid #ccc', width: '45px', backgroundColor: '#f3f4f6', color: '#000000' }}>NCM/SH</th>
                        <th style={{ padding: '1px 2px', borderRight: '1px solid #ccc', width: '18px', backgroundColor: '#f3f4f6', color: '#000000' }}>CST</th>
                        <th style={{ padding: '1px 2px', borderRight: '1px solid #ccc', width: '25px', backgroundColor: '#f3f4f6', color: '#000000' }}>CFOP</th>
                        <th style={{ padding: '1px 2px', borderRight: '1px solid #ccc', width: '18px', backgroundColor: '#f3f4f6', color: '#000000' }}>UN</th>
                        <th style={{ padding: '1px 2px', borderRight: '1px solid #ccc', width: '35px', backgroundColor: '#f3f4f6', color: '#000000' }}>QUANT</th>
                        <th style={{ padding: '1px 2px', borderRight: '1px solid #ccc', width: '40px', backgroundColor: '#f3f4f6', color: '#000000' }}>VL UNIT</th>
                        <th style={{ padding: '1px 2px', borderRight: '1px solid #ccc', width: '40px', backgroundColor: '#f3f4f6', color: '#000000' }}>VL TOTAL</th>
                        <th style={{ padding: '1px 2px', borderRight: '1px solid #ccc', width: '40px', backgroundColor: '#f3f4f6', color: '#000000' }}>B.CÁLC ICMS</th>
                        <th style={{ padding: '1px 2px', borderRight: '1px solid #ccc', width: '35px', backgroundColor: '#f3f4f6', color: '#000000' }}>VL ICMS</th>
                        <th style={{ padding: '1px 2px', borderRight: '1px solid #ccc', width: '30px', backgroundColor: '#f3f4f6', color: '#000000' }}>VL IPI</th>
                        <th style={{ padding: '1px 2px', borderRight: '1px solid #ccc', width: '22px', backgroundColor: '#f3f4f6', color: '#000000' }}>ALÍQ ICMS</th>
                        <th style={{ padding: '1px 2px', width: '22px', backgroundColor: '#f3f4f6', color: '#000000' }}>ALÍQ IPI</th>
                      </tr>
                    </thead>
                    <tbody style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                      {parsed.itens.length === 0 ? (
                        <tr style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                          <td colSpan={14} style={{ padding: '8px', textAlign: 'center', fontStyle: 'italic', color: '#666666', fontFamily: "'Times New Roman', serif", backgroundColor: '#ffffff' }}>
                            Nenhum item individual discriminado no XML desta nota fiscal.
                          </td>
                        </tr>
                      ) : (
                        parsed.itens.map((it) => (
                          <tr key={it.numeroItem} style={{ borderBottom: '1px solid #e0e0e0', textAlign: 'center', backgroundColor: '#ffffff', color: '#000000' }}>
                            <td style={{ padding: '1px 2px', borderRight: '1px solid #e0e0e0', fontSize: '6.5px', backgroundColor: '#ffffff', color: '#000000' }}>{it.codigo}</td>
                            <td style={{ padding: '1px 3px', borderRight: '1px solid #e0e0e0', textAlign: 'left', fontSize: '7px', fontFamily: "'Times New Roman', serif", whiteSpace: 'pre-wrap', lineHeight: 1.2, backgroundColor: '#ffffff', color: '#000000' }}>{it.descricao}</td>
                            <td style={{ padding: '1px 2px', borderRight: '1px solid #e0e0e0', backgroundColor: '#ffffff', color: '#000000' }}>{it.ncmCts}</td>
                            <td style={{ padding: '1px 2px', borderRight: '1px solid #e0e0e0', backgroundColor: '#ffffff', color: '#000000' }}>{it.cClassTrib || ''}</td>
                            <td style={{ padding: '1px 2px', borderRight: '1px solid #e0e0e0', backgroundColor: '#ffffff', color: '#000000' }}>{it.cfop}</td>
                            <td style={{ padding: '1px 2px', borderRight: '1px solid #e0e0e0', backgroundColor: '#ffffff', color: '#000000' }}>{it.unidade}</td>
                            <td style={{ padding: '1px 2px', borderRight: '1px solid #e0e0e0', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>{brl2(it.quantidade)}</td>
                            <td style={{ padding: '1px 2px', borderRight: '1px solid #e0e0e0', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>{brl2(it.valorUnitario)}</td>
                            <td style={{ padding: '1px 2px', borderRight: '1px solid #e0e0e0', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#ffffff', color: '#000000' }}>{brl2(it.valorTotal)}</td>
                            <td style={{ padding: '1px 2px', borderRight: '1px solid #e0e0e0', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>{brl2(it.valorIcms ? (it.valorTotal) : 0)}</td>
                            <td style={{ padding: '1px 2px', borderRight: '1px solid #e0e0e0', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>{brl2(it.valorIcms || 0)}</td>
                            <td style={{ padding: '1px 2px', borderRight: '1px solid #e0e0e0', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>{brl2(it.valorIpi || 0)}</td>
                            <td style={{ padding: '1px 2px', borderRight: '1px solid #e0e0e0', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>{brl2(it.aliquotaIcms || 0)}</td>
                            <td style={{ padding: '1px 2px', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>{brl2(it.aliquotaIpi || 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ── CÁLCULO DO ISSQN (quando aplicável) ── */}
                {parsed.issqn.vISS > 0 && (
                  <div style={{ border: '1px solid #000', marginBottom: '1px', backgroundColor: '#ffffff', color: '#000000' }}>
                    <div className="danfe-header-bar" style={{ backgroundColor: '#e5e7eb', color: '#000000', padding: '1px 5px', fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid #000' }}>
                      CÁLCULO DO ISSQN
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', textAlign: 'center', backgroundColor: '#ffffff' }}>
                      <DanfeField label="INSCRIÇÃO MUNICIPAL" className="border-r border-black"><span style={{ fontFamily: "'Courier New', monospace" }}>{parsed.issqn.IM}</span></DanfeField>
                      <DanfeField label="VALOR TOTAL DOS SERVIÇOS" className="border-r border-black"><span style={{ fontFamily: "'Courier New', monospace" }}>{brl2(parsed.issqn.vServ)}</span></DanfeField>
                      <DanfeField label="BASE DE CÁLCULO DO ISSQN" className="border-r border-black"><span style={{ fontFamily: "'Courier New', monospace" }}>{brl2(parsed.issqn.vBC)}</span></DanfeField>
                      <DanfeField label="VALOR DO ISSQN"><span style={{ fontFamily: "'Courier New', monospace" }}>{brl2(parsed.issqn.vISS)}</span></DanfeField>
                    </div>
                  </div>
                )}

                {/* ── DADOS ADICIONAIS ── */}
                <div style={{ border: '1px solid #000', marginBottom: '1px', backgroundColor: '#ffffff', color: '#000000' }}>
                  <div className="danfe-header-bar" style={{ backgroundColor: '#e5e7eb', color: '#000000', padding: '1px 5px', fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid #000' }}>
                    DADOS ADICIONAIS
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '65% 35%', backgroundColor: '#ffffff', color: '#000000' }}>
                    <div style={{ padding: '3px 5px', borderRight: '1px solid #000', minHeight: '30px', backgroundColor: '#ffffff', color: '#000000' }}>
                      <div className="danfe-field-label" style={{ fontSize: '6.5px', fontWeight: 'bold', color: '#4b5563', marginBottom: '1px' }}>INFORMAÇÕES COMPLEMENTARES</div>
                      <div style={{ fontSize: '7px', whiteSpace: 'pre-wrap', lineHeight: 1.3, color: '#000000' }}>
                        {parsed.infCpl}
                        {parsed.infAdFisco && <><br />{parsed.infAdFisco}</>}
                      </div>
                    </div>
                    <div style={{ padding: '3px 5px', minHeight: '30px', backgroundColor: '#ffffff', color: '#000000' }}>
                      <div className="danfe-field-label" style={{ fontSize: '6.5px', fontWeight: 'bold', color: '#4b5563' }}>RESERVADO AO FISCO</div>
                    </div>
                  </div>
                </div>

                {/* ── BLOCO RTC — CBS/IBS (condicional: só se presente no XML) ── */}
                {hasRTC && (
                  <div style={{ border: '2px solid #0891b2', padding: '4px 6px', marginBottom: '1px', background: '#f0fdfa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #99e3e3', paddingBottom: '2px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '8px', fontWeight: 900, color: '#134e4a' }}>
                        DEMONSTRATIVO REFORMA TRIBUTÁRIA DO CONSUMO (PLP 68/2024 — DUAL TAX — NT 2025.002)
                      </span>
                      <span style={{ fontSize: '6.5px', fontWeight: 900, padding: '1px 6px', background: '#ccfbf1', border: '1px solid #99f6e4', color: '#115e59' }}>
                        Transição CBS/IBS
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', textAlign: 'center' }}>
                      <div style={{ border: '1px solid #99e3e3', padding: '2px 4px', background: '#fff' }}>
                        <div style={{ fontSize: '6.5px', fontWeight: 'bold', color: '#555' }}>CBS (Federal)</div>
                        <strong style={{ fontFamily: "'Courier New', monospace", fontSize: '9px', color: '#0c4a6e' }}>{brl(parsed.rtcTot.vCBS)}</strong>
                      </div>
                      <div style={{ border: '1px solid #99e3e3', padding: '2px 4px', background: '#fff' }}>
                        <div style={{ fontSize: '6.5px', fontWeight: 'bold', color: '#555' }}>IBS (Estadual/Municipal)</div>
                        <strong style={{ fontFamily: "'Courier New', monospace", fontSize: '9px', color: '#312e81' }}>{brl(parsed.rtcTot.vIBS)}</strong>
                      </div>
                      <div style={{ border: '1px solid #99e3e3', padding: '2px 4px', background: '#fff' }}>
                        <div style={{ fontSize: '6.5px', fontWeight: 'bold', color: '#555' }}>Imposto Seletivo (IS)</div>
                        <strong style={{ fontFamily: "'Courier New', monospace", fontSize: '9px', color: '#000' }}>{brl(parsed.rtcTot.vIS)}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Nota de Governança ── */}
                <div style={{ padding: '3px 5px', background: '#f8f8f8', border: '1px solid #ddd', fontSize: '6.5px', color: '#888', lineHeight: 1.3, marginTop: '2px' }}>
                  <strong>Nota de Governança Fiscal (Categoria C - Visualização Documental):</strong> As alíquotas e valores discriminados neste {docTitle} refletem a transcrição literal dos nós do arquivo XML original autorizado pela SEFAZ. O Radar Fiscal não assume alíquotas fictícias ou presunções tácitas nesta visualização documental.
                </div>
              </>
            )}

            {/* ══════════════════════════════════════════════════════════ */}
            {/* CT-e — DACTE                                             */}
            {/* ══════════════════════════════════════════════════════════ */}
            {isCTe && (
              <>
                {/* Canhoto DACTE */}
                <div style={{ border: '1px solid #000', padding: '3px 5px', marginBottom: '2px', backgroundColor: '#ffffff', color: '#000000' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #666', paddingBottom: '2px', marginBottom: '3px' }}>
                    <div style={{ flex: 1, fontSize: '7.5px' }}>
                      DECLARAMOS QUE RECEBEMOS OS SERVIÇOS DE TRANSPORTE CONSTANTES DESTE CONHECIMENTO DE TRANSPORTE ELETRÔNICO (CT-e).
                    </div>
                    <div style={{ textAlign: 'right', paddingLeft: '10px' }}>
                      <strong style={{ fontSize: '10px', display: 'block' }}>DACTE</strong>
                      <span style={{ fontWeight: 'bold', fontSize: '9px' }}>CT-e Nº {parsed.nNF} - Série {parsed.serie}</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '25% 75%', gap: '4px', fontSize: '7px' }}>
                    <div><span style={{ fontWeight: 'bold', color: '#555' }}>DATA DE RECEBIMENTO</span><div style={{ borderBottom: '1px solid #999', height: '12px', marginTop: '2px' }}></div></div>
                    <div><span style={{ fontWeight: 'bold', color: '#555' }}>NOME E ASSINATURA DO RECEBEDOR DA CARGA</span><div style={{ borderBottom: '1px solid #999', height: '12px', marginTop: '2px' }}></div></div>
                  </div>
                </div>

                <div style={{ borderBottom: '2px dashed #999', margin: '3px 0', textAlign: 'center', fontSize: '6.5px', color: '#888', fontWeight: 'bold', letterSpacing: '3px' }}>CORTE AQUI</div>

                {/* Cabeçalho DACTE */}
                <div style={{ border: '2px solid #000', display: 'grid', gridTemplateColumns: '42% 16% 42%', marginBottom: '1px', backgroundColor: '#ffffff', color: '#000000' }}>
                  <div style={{ borderRight: '1px solid #000', padding: '4px 5px', backgroundColor: '#ffffff', color: '#000000' }}>
                    <div style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}>{parsed.emit.xNome}</div>
                    <div style={{ fontSize: '7.5px', color: '#333', marginTop: '2px', lineHeight: 1.3 }}>
                      {parsed.emit.xLgr}{parsed.emit.nro ? `, ${parsed.emit.nro}` : ''}{parsed.emit.xCpl ? ` — ${parsed.emit.xCpl}` : ''}<br />
                      {parsed.emit.xBairro} — {parsed.emit.xMun} / {parsed.emit.UF}<br />
                      CNPJ: {parsed.emit.CNPJ} — IE: {parsed.emit.IE}
                    </div>
                  </div>
                  <div style={{ borderRight: '1px solid #000', padding: '4px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', color: '#000000' }}>
                    <div style={{ fontSize: '14px', fontWeight: 900, letterSpacing: '2px' }}>DACTE</div>
                    <div style={{ fontSize: '6px', fontWeight: 'bold', color: '#444' }}>DOC. AUXILIAR DO CT-E</div>
                    <div style={{ border: '1px solid #000', padding: '2px', background: '#000', color: '#fff', fontWeight: 900, fontSize: '10px' }}>RODOVIÁRIO</div>
                    <div style={{ fontSize: '8px', marginTop: '2px' }}>
                      <strong>Nº {parsed.nNF}</strong><br />SÉRIE {parsed.serie}<br />FOLHA 1/1
                    </div>
                  </div>
                  <div style={{ padding: '4px 5px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#ffffff', color: '#000000' }}>
                    <div style={{ textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: parsed.barcodeSvg }} />
                    <div style={{ border: '1px solid #000', padding: '2px 4px', marginTop: '2px', backgroundColor: '#ffffff' }}>
                      <div style={{ fontSize: '6.5px', fontWeight: 'bold', color: '#555' }}>CHAVE DE ACESSO DO CT-e</div>
                      <div style={{ fontSize: '8px', fontFamily: "'Courier New', monospace", fontWeight: 900, letterSpacing: '0.5px' }}>
                        {formatChaveAcesso44(item.chaveAcesso)}
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid #999', paddingTop: '2px', marginTop: '2px', fontSize: '7px' }}>
                      <strong style={{ fontSize: '6.5px', color: '#555' }}>PROTOCOLO DE AUTORIZAÇÃO DE USO</strong><br />
                      <strong style={{ fontFamily: "'Courier New', monospace", fontSize: '8px' }}>{parsed.nProt} — {parsed.dhRecbto}</strong>
                    </div>
                  </div>
                </div>

                {/* Prestação do Serviço */}
                <div style={{ border: '1px solid #000', marginBottom: '1px', backgroundColor: '#ffffff', color: '#000000' }}>
                  <div className="danfe-header-bar" style={{ backgroundColor: '#e5e7eb', color: '#000000', padding: '1px 5px', fontSize: '7px', fontWeight: 900, borderBottom: '1px solid #000' }}>
                    DADOS DA PRESTAÇÃO DO SERVIÇO DE TRANSPORTE
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '8px', padding: '3px 5px', backgroundColor: '#ffffff' }}>
                    <div style={{ borderRight: '1px solid #ccc', paddingRight: '5px' }}>
                      <span style={{ fontSize: '6.5px', color: '#555', fontWeight: 'bold' }}>INÍCIO DA PRESTAÇÃO (ORIGEM)</span><br />
                      <strong>{parsed.cte.munIni} / {parsed.cte.ufIni}</strong>
                    </div>
                    <div style={{ paddingLeft: '5px' }}>
                      <span style={{ fontSize: '6.5px', color: '#555', fontWeight: 'bold' }}>TÉRMINO DA PRESTAÇÃO (DESTINO)</span><br />
                      <strong>{parsed.cte.munFim} / {parsed.cte.ufFim}</strong>
                    </div>
                  </div>
                </div>

                {/* Remetente / Destinatário */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #000', marginBottom: '1px', backgroundColor: '#ffffff', color: '#000000' }}>
                  <div style={{ padding: '3px 5px', borderRight: '1px solid #000', backgroundColor: '#ffffff' }}>
                    <span style={{ fontSize: '6.5px', color: '#555', fontWeight: 'bold' }}>REMETENTE</span><br />
                    <strong style={{ fontSize: '9px' }}>{parsed.emit.xNome}</strong><br />
                    <span style={{ fontFamily: "'Courier New', monospace", fontSize: '7px' }}>CNPJ: {parsed.emit.CNPJ} — UF: {parsed.emit.UF}</span>
                  </div>
                  <div style={{ padding: '3px 5px', backgroundColor: '#ffffff' }}>
                    <span style={{ fontSize: '6.5px', color: '#555', fontWeight: 'bold' }}>DESTINATÁRIO / TOMADOR</span><br />
                    <strong style={{ fontSize: '9px' }}>{parsed.dest.xNome}</strong><br />
                    <span style={{ fontFamily: "'Courier New', monospace", fontSize: '7px' }}>CNPJ: {parsed.dest.CNPJ} — UF: {parsed.dest.UF}</span>
                  </div>
                </div>

                {/* Informações da Carga */}
                <div style={{ border: '1px solid #000', marginBottom: '1px', backgroundColor: '#ffffff', color: '#000000' }}>
                  <div className="danfe-header-bar" style={{ backgroundColor: '#e5e7eb', color: '#000000', padding: '1px 5px', fontSize: '7px', fontWeight: 900, borderBottom: '1px solid #000' }}>
                    INFORMAÇÕES DA CARGA & NF-E VINCULADA
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', padding: '3px 5px', fontSize: '8px', backgroundColor: '#ffffff' }}>
                    <div><span style={{ fontSize: '6.5px', color: '#555', fontWeight: 'bold' }}>PRODUTO PREDOMINANTE</span><br /><strong>{parsed.cte.proPred}</strong></div>
                    <div style={{ fontFamily: "'Courier New', monospace" }}><span style={{ fontSize: '6.5px', color: '#555', fontWeight: 'bold', fontFamily: "'Times New Roman', serif" }}>CHAVE DA NF-E VINCULADA</span><br /><strong>{parsed.cte.chaveNFe || item.chaveAcesso}</strong></div>
                  </div>
                </div>

                {/* Valores CT-e */}
                <div style={{ border: '1px solid #000', marginBottom: '1px', backgroundColor: '#ffffff', color: '#000000' }}>
                  <div className="danfe-header-bar" style={{ backgroundColor: '#e5e7eb', color: '#000000', padding: '1px 5px', fontSize: '7px', fontWeight: 900, borderBottom: '1px solid #000' }}>
                    VALORES DA PRESTAÇÃO E TRIBUTAÇÃO
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', textAlign: 'center', fontSize: '8px', padding: '3px 0', backgroundColor: '#ffffff' }}>
                    <div style={{ borderRight: '1px solid #ccc' }}><span style={{ fontSize: '6.5px', color: '#555' }}>VALOR TOTAL DO SERVIÇO</span><br /><strong style={{ fontSize: '10px', fontFamily: "'Courier New', monospace" }}>{brl(item.valorTotal)}</strong></div>
                    <div style={{ borderRight: '1px solid #ccc' }}><span style={{ fontSize: '6.5px', color: '#555' }}>VALOR A RECEBER</span><br /><strong style={{ fontSize: '10px', fontFamily: "'Courier New', monospace" }}>{brl(item.valorTotal)}</strong></div>
                    <div style={{ borderRight: '1px solid #ccc' }}><span style={{ fontSize: '6.5px', color: '#555' }}>ICMS TRANSPORTE</span><br /><strong style={{ fontFamily: "'Courier New', monospace" }}>{brl(item.valorIcms)}</strong></div>
                    <div><span style={{ fontSize: '6.5px', color: '#555' }}>CBS / IBS FRETE</span><br /><strong style={{ fontFamily: "'Courier New', monospace", color: '#0c4a6e' }}>{brl(item.valorCbs + item.valorIbs)}</strong></div>
                  </div>
                </div>

                {/* Nota de Governança */}
                <div style={{ padding: '3px 5px', background: '#f8f8f8', border: '1px solid #ddd', fontSize: '6.5px', color: '#888', lineHeight: 1.3, marginTop: '2px' }}>
                  <strong>Nota de Governança Fiscal:</strong> Os valores discriminados neste DACTE refletem a transcrição literal dos nós do arquivo XML original autorizado pela SEFAZ.
                </div>
              </>
            )}

            {/* ══════════════════════════════════════════════════════════ */}
            {/* NFS-e — DANFSe                                           */}
            {/* ══════════════════════════════════════════════════════════ */}
            {isNFSe && (
              <>
                {/* Cabeçalho */}
                <div style={{ border: '2px solid #000', padding: '6px', marginBottom: '1px', backgroundColor: '#ffffff', color: '#000000' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000', paddingBottom: '4px', marginBottom: '4px' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase' }}>{parsed.emit.xNome}</div>
                      <div style={{ fontSize: '7.5px', fontFamily: "'Courier New', monospace", color: '#333', marginTop: '2px' }}>
                        CNPJ: {parsed.emit.CNPJ} — {parsed.emit.xMun}/{parsed.emit.UF}<br />
                        {parsed.emit.xLgr} {parsed.emit.nro} {parsed.emit.xCpl} — CEP: {parsed.emit.CEP}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: '14px', fontWeight: 900, display: 'block' }}>DANFSe</strong>
                      <span style={{ fontSize: '8px', fontWeight: 'bold', fontFamily: "'Courier New', monospace" }}>NFS-e Nº {parsed.nNF}</span><br />
                      <span style={{ fontSize: '7px', color: '#555' }}>Emissão: {item.dataEmissao}</span>
                    </div>
                  </div>
                  {/* Chave */}
                  <div style={{ border: '1px solid #000', padding: '3px 5px', background: '#f8f8f8' }}>
                    <div style={{ fontSize: '6.5px', fontWeight: 'bold', color: '#555' }}>CHAVE DE ACESSO DA NFS-E (PADRÃO NACIONAL)</div>
                    <strong style={{ fontSize: '9px', fontFamily: "'Courier New', monospace", letterSpacing: '0.5px' }}>{item.chaveAcesso}</strong>
                  </div>
                </div>

                {/* Tomador */}
                <div style={{ border: '1px solid #000', marginBottom: '1px', backgroundColor: '#ffffff', color: '#000000' }}>
                  <div className="danfe-header-bar" style={{ backgroundColor: '#e5e7eb', color: '#000000', padding: '1px 5px', fontSize: '7px', fontWeight: 900, borderBottom: '1px solid #000', display: 'flex', justifyContent: 'space-between' }}>
                    <span>TOMADOR DOS SERVIÇOS</span>
                    <span style={{ fontFamily: "'Courier New', monospace" }}>CNPJ: {parsed.dest.CNPJ}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', padding: '3px 5px', fontSize: '8px', backgroundColor: '#ffffff' }}>
                    <div><span style={{ fontSize: '6.5px', color: '#555', fontWeight: 'bold' }}>RAZÃO SOCIAL</span><br /><strong>{parsed.dest.xNome}</strong></div>
                    <div><span style={{ fontSize: '6.5px', color: '#555', fontWeight: 'bold' }}>MUNICÍPIO / UF</span><br /><strong>{parsed.dest.xMun || parsed.dest.UF} / {parsed.dest.UF}</strong></div>
                  </div>
                </div>

                {/* Discriminação */}
                <div style={{ border: '1px solid #000', marginBottom: '1px', backgroundColor: '#ffffff', color: '#000000' }}>
                  <div className="danfe-header-bar" style={{ backgroundColor: '#e5e7eb', color: '#000000', padding: '1px 5px', fontSize: '7px', fontWeight: 900, borderBottom: '1px solid #000' }}>
                    DISCRIMINAÇÃO DOS SERVIÇOS PRESTADOS
                  </div>
                  <div style={{ padding: '5px', fontSize: '8px', fontFamily: "'Courier New', monospace", whiteSpace: 'pre-line', lineHeight: 1.4, backgroundColor: '#ffffff' }}>
                    {parsed.nfse.discriminacao || 'Discriminação não informada no XML.'}
                    <div style={{ borderTop: '1px solid #ccc', marginTop: '4px', paddingTop: '2px', fontSize: '7px', color: '#555', fontFamily: "'Times New Roman', serif" }}>
                      {parsed.nfse.codServ && <>Código de Tributação Nacional: <strong>{parsed.nfse.codServ}</strong> • </>}
                      Local da Prestação: <strong>{parsed.nfse.locPrest}</strong>
                    </div>
                  </div>
                </div>

                {/* Valores e Retenções */}
                <div style={{ border: '1px solid #000', marginBottom: '1px', backgroundColor: '#ffffff', color: '#000000' }}>
                  <div className="danfe-header-bar" style={{ backgroundColor: '#e5e7eb', color: '#000000', padding: '1px 5px', fontSize: '7px', fontWeight: 900, borderBottom: '1px solid #000' }}>
                    VALORES DOS SERVIÇOS E RETENÇÕES TRIBUTÁRIAS
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', textAlign: 'center', fontSize: '7px', padding: '3px', fontFamily: "'Courier New', monospace", backgroundColor: '#ffffff' }}>
                    <div><span style={{ fontSize: '6px', color: '#555', fontFamily: "'Times New Roman', serif" }}>VALOR BRUTO</span><br /><strong style={{ fontSize: '9px' }}>{brl(item.valorTotal)}</strong></div>
                    <div><span style={{ fontSize: '6px', color: '#555', fontFamily: "'Times New Roman', serif" }}>RET. INSS</span><br /><strong>{brl(parsed.nfse.inss)}</strong></div>
                    <div><span style={{ fontSize: '6px', color: '#555', fontFamily: "'Times New Roman', serif" }}>RET. IRRF</span><br /><strong>{brl(parsed.nfse.irrf)}</strong></div>
                    <div><span style={{ fontSize: '6px', color: '#555', fontFamily: "'Times New Roman', serif" }}>RET. CSLL</span><br /><strong>{brl(parsed.nfse.csll)}</strong></div>
                    <div><span style={{ fontSize: '6px', color: '#555', fontFamily: "'Times New Roman', serif" }}>ISS RETIDO</span><br /><strong>{brl(parsed.nfse.issRet)}</strong></div>
                    <div style={{ background: '#f0fdf4', padding: '2px' }}>
                      <span style={{ fontSize: '6px', color: '#166534', fontWeight: 900, fontFamily: "'Times New Roman', serif" }}>VALOR LÍQUIDO</span><br />
                      <strong style={{ fontSize: '9px', color: '#14532d' }}>{brl(item.valorTotal - parsed.nfse.inss - parsed.nfse.irrf - parsed.nfse.csll - parsed.nfse.issRet)}</strong>
                    </div>
                  </div>
                </div>

                {/* Nota de Governança */}
                <div style={{ padding: '3px 5px', background: '#f8f8f8', border: '1px solid #ddd', fontSize: '6.5px', color: '#888', lineHeight: 1.3, marginTop: '2px' }}>
                  <strong>Nota de Governança Fiscal:</strong> Os valores discriminados neste DANFSe refletem a transcrição literal dos nós do arquivo XML original.
                </div>
              </>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="danfe-no-print px-6 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Documento validado com Chave de 44 dígitos no portal oficial da SEFAZ</span>
          </div>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer">
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
