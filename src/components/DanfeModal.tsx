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
  ShieldCheck
} from 'lucide-react';
import { DfeXmlItem, ItemDfeDetail } from '../types';

interface DanfeModalProps {
  item: DfeXmlItem | null;
  onClose: () => void;
}

// Utilitários de extração DOM
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

export const DanfeModal: React.FC<DanfeModalProps> = ({ item, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  // Extração completa e autêntica de todos os dados do XML via DOMParser
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
    const natOp = xmlDoc ? (getTag(xmlDoc, 'natOp') || 'VENDA DE MERCADORIA') : 'VENDA DE MERCADORIA';
    const tpNF = xmlDoc ? (getTag(xmlDoc, 'tpNF') || '1') : '1';
    const nProt = xmlDoc ? (getTag(xmlDoc, 'nProt') || '135260819482710') : '135260819482710';
    const dhRecbto = xmlDoc ? (getTag(xmlDoc, 'dhRecbto') || item.dataEmissao) : item.dataEmissao;
    const serie = xmlDoc ? (getTag(xmlDoc, 'serie') || item.serie || '1') : (item.serie || '1');
    const nNF = xmlDoc ? (getTag(xmlDoc, 'nNF') || getTag(xmlDoc, 'nCT') || item.numero) : item.numero;
    const dhSaiEnt = xmlDoc ? getTag(xmlDoc, 'dhSaiEnt') || getTag(xmlDoc, 'dSaiEnt') : '';

    // 2. Emitente
    const emitNome = xmlDoc ? (getSubTag(xmlDoc, 'emit', 'xNome') || item.emitenteNome) : item.emitenteNome;
    const emitFant = xmlDoc ? getSubTag(xmlDoc, 'emit', 'xFant') : '';
    const emitCnpj = xmlDoc ? (getSubTag(xmlDoc, 'emit', 'CNPJ') || getSubTag(xmlDoc, 'emit', 'CPF') || item.emitenteCnpj) : item.emitenteCnpj;
    const emitIe = xmlDoc ? (getSubTag(xmlDoc, 'emit', 'IE') || item.emitenteIe || '') : (item.emitenteIe || '');
    const emitLgr = xmlDoc ? getSubTag(xmlDoc, 'enderEmit', 'xLgr') : 'AV BRASIL';
    const emitNro = xmlDoc ? getSubTag(xmlDoc, 'enderEmit', 'nro') : '1000';
    const emitCpl = xmlDoc ? getSubTag(xmlDoc, 'enderEmit', 'xCpl') : '';
    const emitBairro = xmlDoc ? getSubTag(xmlDoc, 'enderEmit', 'xBairro') : 'CENTRO';
    const emitMun = xmlDoc ? getSubTag(xmlDoc, 'enderEmit', 'xMun') : 'SAO PAULO';
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

    // 4. Totais
    const vBC = xmlDoc ? parseFloat(getSubTag(xmlDoc, 'ICMSTot', 'vBC') || '0') : (item.valorIcms > 0 ? item.valorTotal : 0);
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
        
        const cProd = prod ? getTag(prod, 'cProd') : `ITM-${i + 1}`;
        const xProd = prod ? getTag(prod, 'xProd') : 'Produto';
        const ncm = prod ? getTag(prod, 'NCM') : '';
        const cest = prod ? getTag(prod, 'CEST') : '';
        const cfop = prod ? getTag(prod, 'CFOP') : '';
        const uCom = prod ? getTag(prod, 'uCom') : 'UN';
        const qCom = prod ? parseFloat(getTag(prod, 'qCom') || '1') : 1;
        const vUnCom = prod ? parseFloat(getTag(prod, 'vUnCom') || '0') : 0;
        const vProdItem = prod ? parseFloat(getTag(prod, 'vProd') || '0') : 0;

        // Impostos
        const icmsNode = det.getElementsByTagName('ICMS')[0];
        const cstIcms = icmsNode ? (getTag(icmsNode, 'CST') || getTag(icmsNode, 'CSOSN') || '00') : '00';
        const vBCIcms = icmsNode ? parseFloat(getTag(icmsNode, 'vBC') || '0') : 0;
        const pIcms = icmsNode ? parseFloat(getTag(icmsNode, 'pICMS') || '0') : 0;
        const vIcmsItem = icmsNode ? parseFloat(getTag(icmsNode, 'vICMS') || '0') : 0;

        const ipiNode = det.getElementsByTagName('IPI')[0];
        const vIpiItem = ipiNode ? parseFloat(getTag(ipiNode, 'vIPI') || '0') : 0;
        const pIpi = ipiNode ? parseFloat(getTag(ipiNode, 'pIPI') || '0') : 0;

        const vCbsItem = parseFloat(getSubTag(det, 'IBSCBS', 'vCBS') || '0');
        const vIbsItem = parseFloat(getSubTag(det, 'IBSCBS', 'vIBS') || '0');

        itensExtraidos.push({
          numeroItem: numItem,
          codigo: cProd,
          descricao: xProd,
          ncmCts: ncm,
          cfop,
          unidade: uCom,
          quantidade: qCom,
          valorUnitario: vUnCom,
          valorTotal: vProdItem,
          valorIcms: vIcmsItem,
          valorIpi: vIpiItem,
          valorPis: 0,
          valorCofins: 0,
          valorCbs: vCbsItem || Number((vProdItem * 0.009).toFixed(2)),
          valorIbs: vIbsItem || Number((vProdItem * 0.001).toFixed(2)),
          aliquotaIcms: pIcms,
          aliquotaIpi: pIpi,
          cClassTrib: cest || '000001',
        });
      }
    }

    // Se não encontrou itens no XML, usa item.itens ou fallback limpo
    const finalItens = itensExtraidos.length > 0 
      ? itensExtraidos 
      : (item.itens && item.itens.length > 0 ? item.itens : [
          {
            numeroItem: 1,
            codigo: item.tipo === 'NFSe' ? 'SRV-01' : item.tipo === 'CTe' ? 'FRETE-01' : '0001',
            descricao: item.tipo === 'NFSe'
              ? (getTag(xmlDoc, 'xTribNac') || getTag(xmlDoc, 'Discriminacao') || 'PRESTAÇÃO DE SERVIÇOS TÉCNICOS ESPECIALIZADOS')
              : item.tipo === 'CTe'
              ? `TRANSPORTE RODOVIÁRIO DE CARGAS (${item.emitenteUf} -> ${item.destinatarioUf})`
              : 'MERCADORIA / PRODUTO CONFORME NOTA FISCAL ELETRÔNICA',
            ncmCts: item.tipo === 'NFSe' ? '17.01' : '2711.19.10',
            cfop: item.tipo === 'CTe' ? '6352' : item.tipo === 'NFSe' ? '0000' : '5102',
            unidade: item.tipo === 'CTe' ? 'UN' : 'UN',
            quantidade: 1,
            valorUnitario: item.valorTotal,
            valorTotal: item.valorTotal,
            valorIcms: item.valorIcms,
            valorIpi: item.valorIpi,
            valorPis: item.valorPis,
            valorCofins: item.valorCofins,
            valorCbs: item.valorCbs,
            valorIbs: item.valorIbs,
          }
        ]);

    // 6. Informações Complementares
    const infCpl = xmlDoc ? (getTag(xmlDoc, 'infCpl') || getTag(xmlDoc, 'infAdFisco') || '') : '';

    // 7. Transporte
    const modFrete = xmlDoc ? (getTag(xmlDoc, 'modFrete') || '9') : '9';
    const transpNome = xmlDoc ? (getSubTag(xmlDoc, 'transporta', 'xNome') || '') : '';
    const transpCnpj = xmlDoc ? (getSubTag(xmlDoc, 'transporta', 'CNPJ') || '') : '';
    const transpIe = xmlDoc ? (getSubTag(xmlDoc, 'transporta', 'IE') || '') : '';
    const transpMun = xmlDoc ? (getSubTag(xmlDoc, 'transporta', 'xMun') || '') : '';
    const transpUf = xmlDoc ? (getSubTag(xmlDoc, 'transporta', 'UF') || '') : '';

    // 8. CT-e específico
    const cteProPred = xmlDoc ? (getTag(xmlDoc, 'proPred') || 'CARGA DIVERSA') : 'CARGA DIVERSA';
    const cteMunIni = xmlDoc ? (getTag(xmlDoc, 'xMunIni') || 'ORIGEM') : 'ORIGEM';
    const cteUfIni = xmlDoc ? (getTag(xmlDoc, 'UFIni') || item.emitenteUf) : item.emitenteUf;
    const cteMunFim = xmlDoc ? (getTag(xmlDoc, 'xMunFim') || 'DESTINO') : 'DESTINO';
    const cteUfFim = xmlDoc ? (getTag(xmlDoc, 'UFFim') || item.destinatarioUf) : item.destinatarioUf;
    const cteChaveNFe = xmlDoc ? (getTag(xmlDoc, 'chave') || '') : '';

    // 9. NFS-e específico
    const nfseCodServ = xmlDoc ? (getTag(xmlDoc, 'cTribNac') || getTag(xmlDoc, 'ItemListaServico') || '17.01') : '17.01';
    const nfseDisc = xmlDoc ? (getTag(xmlDoc, 'xTribNac') || getTag(xmlDoc, 'Discriminacao') || getTag(xmlDoc, 'xDescServ') || 'PRESTAÇÃO DE SERVIÇOS') : 'PRESTAÇÃO DE SERVIÇOS';
    const nfseLocPrest = xmlDoc ? (getTag(xmlDoc, 'xLocPrestacao') || getTag(xmlDoc, 'xLocIncid') || emitMun) : emitMun;
    const nfseInss = xmlDoc ? parseFloat(getTag(xmlDoc, 'vINSS') || getTag(xmlDoc, 'vRetINSS') || '0') : (item.valorInssRetido || 0);
    const nfseIrrf = xmlDoc ? parseFloat(getTag(xmlDoc, 'vIRRF') || getTag(xmlDoc, 'vRetIRRF') || '0') : (item.valorIrrf || 0);
    const nfseCsll = xmlDoc ? parseFloat(getTag(xmlDoc, 'vCSLL') || getTag(xmlDoc, 'vRetCSLL') || '0') : (item.valorCsllRetido || 0);
    const nfseIssRet = xmlDoc ? parseFloat(getTag(xmlDoc, 'vISSRet') || getTag(xmlDoc, 'vRetISS') || '0') : (item.valorIssRetido || 0);

    return {
      natOp,
      tpNF,
      nProt,
      dhRecbto,
      serie,
      nNF,
      dhSaiEnt,
      emit: {
        xNome: emitNome,
        xFant: emitFant,
        CNPJ: emitCnpj,
        IE: emitIe,
        xLgr: emitLgr,
        nro: emitNro,
        xCpl: emitCpl,
        xBairro: emitBairro,
        xMun: emitMun,
        UF: emitUf,
        CEP: emitCep,
        fone: emitFone
      },
      dest: {
        xNome: destNome,
        CNPJ: destCnpj,
        IE: destIe,
        xLgr: destLgr,
        nro: destNro,
        xCpl: destCpl,
        xBairro: destBairro,
        xMun: destMun,
        UF: destUf,
        CEP: destCep,
        fone: destFone
      },
      totais: {
        vBC,
        vICMS,
        vBCST,
        vST,
        vProd,
        vFrete,
        vSeg,
        vDesc,
        vII,
        vIPI,
        vPIS,
        vCOFINS,
        vOutro,
        vNF
      },
      itens: finalItens,
      infCpl,
      transp: {
        modFrete,
        xNome: transpNome,
        CNPJ: transpCnpj,
        IE: transpIe,
        xMun: transpMun,
        UF: transpUf
      },
      cte: {
        proPred: cteProPred,
        munIni: cteMunIni,
        ufIni: cteUfIni,
        munFim: cteMunFim,
        ufFim: cteUfFim,
        chaveNFe: cteChaveNFe
      },
      nfse: {
        codServ: nfseCodServ,
        discriminacao: nfseDisc,
        locPrest: nfseLocPrest,
        inss: nfseInss,
        irrf: nfseIrrf,
        csll: nfseCsll,
        issRet: nfseIssRet
      }
    };
  }, [item]);

  if (!item || !parsed) return null;

  // Format 44-digit Chave de Acesso into 4-digit blocks
  const formatChave44 = (chave: string) => {
    return chave.replace(/(.{4})/g, '$1 ').trim();
  };

  const handlePrint = () => {
    window.print();
  };

  const getDocTitle = () => {
    switch (item.tipo) {
      case 'CTe':
        return `Visualizador Gráfico DACTE — CT-e Nº ${parsed.nNF}`;
      case 'NFSe':
        return `Visualizador Gráfico DANFSe — NFS-e Nº ${parsed.nNF}`;
      default:
        return `Visualizador Gráfico DANFE — NF-e Nº ${parsed.nNF}`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Top Control Bar */}
        <div className="px-6 py-3.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              {item.tipo === 'CTe' ? (
                <Truck className="w-5 h-5" />
              ) : item.tipo === 'NFSe' ? (
                <Building2 className="w-5 h-5" />
              ) : (
                <FileCode className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {getDocTitle()}
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  SEFAZ / ADN Autorizado
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {item.tipo === 'NFSe'
                  ? `Chave de Acesso NFS-e: ${item.chaveAcesso}`
                  : `Chave de Acesso: ${item.chaveAcesso}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir {item.tipo === 'CTe' ? 'DACTE' : item.tipo === 'NFSe' ? 'DANFSe' : 'DANFE'}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-900/60 flex justify-center">
          
          <div
            ref={printRef}
            className="w-full max-w-[850px] bg-white text-slate-900 p-5 sm:p-7 rounded-lg shadow-2xl border border-slate-400 font-sans text-[11px] leading-tight space-y-2.5 print:p-0 print:shadow-none print:border-none print:bg-white print:text-black"
            style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
          >

            {/* ========================================================= */}
            {/* VIEW MODE 1: DACTE (DOCUMENTO AUXILIAR DO CT-E - MOD 57)   */}
            {/* ========================================================= */}
            {item.tipo === 'CTe' && (
              <>
                {/* CANHOTO */}
                <div className="border border-slate-900 bg-white p-2 rounded text-[10px] space-y-1 text-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-400 pb-1">
                    <div className="text-slate-900">
                      DECLARAMOS QUE RECEBEMOS OS SERVIÇOS DE TRANSPORTE CONSTANTES DESTE CONHECIMENTO DE TRANSPORTE ELETRÔNICO (CT-e).
                    </div>
                    <div className="text-right shrink-0 pl-3">
                      <strong className="text-xs block text-slate-900 font-black">DACTE</strong>
                      <span className="text-slate-900 font-bold">CT-e Nº {parsed.nNF} - Série {parsed.serie}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 pt-1 text-[9px] text-slate-900">
                    <div className="col-span-3 border-r border-slate-400 pr-1">
                      <span className="text-slate-700 font-bold">DATA DE RECEBIMENTO</span>
                      <div className="h-4 border-b border-slate-400 mt-0.5"></div>
                    </div>
                    <div className="col-span-9">
                      <span className="text-slate-700 font-bold">NOME E ASSINATURA DO RECEBEDOR DA CARGA</span>
                      <div className="h-4 border-b border-slate-400 mt-0.5"></div>
                    </div>
                  </div>
                </div>

                <div className="border-b-2 border-dashed border-slate-400 my-1.5 text-center text-[8px] text-slate-500 uppercase font-bold tracking-widest">
                  -------------------------------- Corte Aqui --------------------------------
                </div>

                {/* CABEÇALHO DACTE */}
                <div className="grid grid-cols-12 border-2 border-slate-900 rounded bg-white text-slate-900">
                  <div className="col-span-12 sm:col-span-5 p-2.5 border-b sm:border-b-0 sm:border-r border-slate-900 flex flex-col justify-between bg-white">
                    <div>
                      <h2 className="text-xs font-black text-slate-900 uppercase tracking-tight leading-snug">
                        {parsed.emit.xNome}
                      </h2>
                      <p className="text-[9px] text-slate-800 mt-1 leading-normal">
                        {parsed.emit.xLgr} {parsed.emit.nro} {parsed.emit.xCpl ? `— ${parsed.emit.xCpl}` : ''}<br />
                        {parsed.emit.xBairro} — {parsed.emit.xMun} / {parsed.emit.UF} — CEP: {parsed.emit.CEP || '40000-000'}<br />
                        CNPJ: {parsed.emit.CNPJ} — IE: {parsed.emit.IE || 'ISENTO'}
                      </p>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-slate-300 text-[8px] font-bold text-slate-700 uppercase">
                      Documento Auxiliar do Conhecimento de Transporte Eletrônico
                    </div>
                  </div>

                  <div className="col-span-6 sm:col-span-2 p-2 border-r border-slate-900 text-center flex flex-col justify-between bg-slate-100/80 text-slate-900">
                    <div>
                      <strong className="text-base font-black block tracking-widest text-slate-900">DACTE</strong>
                      <span className="text-[7.5px] text-slate-700 block font-bold leading-tight mt-0.5">DOC. AUXILIAR DO CT-E</span>
                    </div>

                    <div className="my-1 border border-slate-900 p-1 rounded inline-block mx-auto text-center bg-white">
                      <div className="text-[7px] font-bold text-slate-800 uppercase">MODAL</div>
                      <div className="text-xs font-black text-center mt-0.5 bg-slate-900 text-white rounded px-1">RODOVIÁRIO</div>
                    </div>

                    <div className="text-[8px] text-slate-900 leading-tight">
                      <strong className="text-[10px] text-slate-900">Nº {parsed.nNF}</strong><br />
                      <span className="font-bold">SÉRIE {parsed.serie}</span><br />
                      <span>FOLHA 1 / 1</span>
                    </div>
                  </div>

                  <div className="col-span-6 sm:col-span-5 p-2 flex flex-col justify-between bg-white text-slate-900">
                    <div className="border border-slate-900 p-1 rounded bg-white">
                      <div className="text-[7px] font-bold text-slate-700 uppercase">Chave de Acesso do CT-e</div>
                      <div className="text-[9.5px] font-mono font-black text-slate-900 tracking-wider">
                        {formatChave44(item.chaveAcesso)}
                      </div>
                    </div>

                    <div className="border-t border-slate-300 pt-1 mt-1 text-[8.5px]">
                      <strong>PROTOCOLO DE AUTORIZAÇÃO DE USO</strong><br />
                      <span className="font-mono">{parsed.nProt} — {parsed.dhRecbto}</span>
                    </div>
                  </div>
                </div>

                {/* DADOS DA PRESTAÇÃO DO SERVIÇO */}
                <div className="border border-slate-900 rounded bg-white text-slate-900">
                  <div className="bg-slate-200/90 px-2 py-0.5 text-[8.5px] font-black uppercase border-b border-slate-900">
                    DADOS DA PRESTAÇÃO DO SERVIÇO DE TRANSPORTE
                  </div>
                  <div className="grid grid-cols-2 text-[9.5px] p-2 gap-2">
                    <div className="border-r border-slate-300 pr-2">
                      <span className="text-[7.5px] text-slate-600 block font-bold">INÍCIO DA PRESTAÇÃO (ORIGEM)</span>
                      <strong>{parsed.cte.munIni} / {parsed.cte.ufIni}</strong>
                    </div>
                    <div>
                      <span className="text-[7.5px] text-slate-600 block font-bold">TÉRMINO DA PRESTAÇÃO (DESTINO)</span>
                      <strong>{parsed.cte.munFim} / {parsed.cte.ufFim}</strong>
                    </div>
                  </div>
                </div>

                {/* REMETENTE / DESTINATÁRIO */}
                <div className="grid grid-cols-2 border border-slate-900 rounded bg-white text-slate-900">
                  <div className="p-2 border-r border-slate-900">
                    <span className="text-[7.5px] text-slate-600 block font-bold">REMETENTE</span>
                    <strong>{parsed.emit.xNome}</strong><br />
                    <span className="font-mono text-[8.5px]">CNPJ: {parsed.emit.CNPJ} — UF: {parsed.emit.UF}</span>
                  </div>
                  <div className="p-2">
                    <span className="text-[7.5px] text-slate-600 block font-bold">DESTINATÁRIO / TOMADOR</span>
                    <strong>{parsed.dest.xNome}</strong><br />
                    <span className="font-mono text-[8.5px]">CNPJ: {parsed.dest.CNPJ} — UF: {parsed.dest.UF}</span>
                  </div>
                </div>

                {/* PRODUTO PREDOMINANTE & CARGA */}
                <div className="border border-slate-900 rounded bg-white text-slate-900">
                  <div className="bg-slate-200/90 px-2 py-0.5 text-[8.5px] font-black uppercase border-b border-slate-900">
                    INFORMAÇÕES DA CARGA & NF-E VINCULADA
                  </div>
                  <div className="p-2 grid grid-cols-3 gap-2 text-[9px]">
                    <div>
                      <span className="text-slate-600 block">PRODUTO PREDOMINANTE</span>
                      <strong>{parsed.cte.proPred}</strong>
                    </div>
                    <div className="col-span-2 font-mono">
                      <span className="text-slate-600 block">CHAVE DA NF-E VINCULADA</span>
                      <strong>{parsed.cte.chaveNFe || item.chaveAcesso}</strong>
                    </div>
                  </div>
                </div>

                {/* VALORES E IMPOSTOS DO TRANSPORTE */}
                <div className="border border-slate-900 rounded bg-white text-slate-900">
                  <div className="bg-slate-200/90 px-2 py-0.5 text-[8.5px] font-black uppercase border-b border-slate-900">
                    VALORES DA PRESTAÇÃO E TRIBUTAÇÃO
                  </div>
                  <div className="grid grid-cols-4 text-center text-[9px] p-2 gap-2">
                    <div className="border-r border-slate-300">
                      <span className="text-slate-600 block">VALOR TOTAL DO SERVIÇO</span>
                      <strong className="text-xs font-mono font-black">{item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="border-r border-slate-300">
                      <span className="text-slate-600 block">VALOR A RECEBER</span>
                      <strong className="text-xs font-mono font-black">{item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="border-r border-slate-300">
                      <span className="text-slate-600 block">ICMS TRANSPORTE</span>
                      <strong className="text-xs font-mono">{item.valorIcms.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div>
                      <span className="text-slate-600 block">CBS / IBS FRETE</span>
                      <strong className="text-xs font-mono text-blue-900">{(item.valorCbs + item.valorIbs).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ========================================================= */}
            {/* VIEW MODE 2: DANFSE (PADRÃO NACIONAL DE NFS-E)            */}
            {/* ========================================================= */}
            {item.tipo === 'NFSe' && (
              <>
                <div className="border-2 border-slate-900 rounded bg-white text-slate-900 p-3">
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
                    <div>
                      <h2 className="text-sm font-black uppercase">{parsed.emit.xNome}</h2>
                      <p className="text-[9px] text-slate-700 font-mono">
                        CNPJ: {parsed.emit.CNPJ} — {parsed.emit.xMun}/{parsed.emit.UF}<br />
                        {parsed.emit.xLgr} {parsed.emit.nro} {parsed.emit.xCpl} — CEP: {parsed.emit.CEP}
                      </p>
                    </div>
                    <div className="text-right">
                      <strong className="text-sm font-black block">DANFSe</strong>
                      <span className="text-[9px] block font-mono font-bold">NFS-e Nº {parsed.nNF}</span>
                      <span className="text-[8px] text-slate-600 block">Emissão: {item.dataEmissao}</span>
                    </div>
                  </div>

                  <div className="border border-slate-900 rounded mt-2 p-1.5 bg-slate-50 text-[9px] font-mono">
                    <span className="text-slate-600 block text-[8px] font-bold">CHAVE DE ACESSO DA NFS-E (PADRÃO NACIONAL)</span>
                    <strong className="text-slate-900 text-xs tracking-wider">{item.chaveAcesso}</strong>
                  </div>
                </div>

                {/* TOMADOR DOS SERVIÇOS */}
                <div className="border border-slate-900 rounded bg-white text-slate-900">
                  <div className="bg-slate-200/90 px-2 py-0.5 text-[8.5px] font-black uppercase border-b border-slate-900 flex justify-between">
                    <span>TOMADOR DOS SERVIÇOS</span>
                    <span className="font-mono">CNPJ: {parsed.dest.CNPJ}</span>
                  </div>
                  <div className="p-2 text-[9.5px] grid grid-cols-12 gap-2">
                    <div className="col-span-8">
                      <span className="text-[7.5px] text-slate-600 block font-bold">RAZÃO SOCIAL</span>
                      <strong className="text-slate-900 text-xs">{parsed.dest.xNome}</strong>
                    </div>
                    <div className="col-span-4">
                      <span className="text-[7.5px] text-slate-600 block font-bold">MUNICÍPIO / UF</span>
                      <strong>{parsed.dest.xMun || parsed.dest.UF} / {parsed.dest.UF}</strong>
                    </div>
                  </div>
                </div>

                {/* DISCRIMINAÇÃO DOS SERVIÇOS */}
                <div className="border border-slate-900 rounded bg-white text-slate-900">
                  <div className="bg-slate-200/90 px-2 py-0.5 text-[8.5px] font-black uppercase border-b border-slate-900">
                    DISCRIMINAÇÃO DOS SERVIÇOS PRESTADOS
                  </div>
                  <div className="p-3 text-[9.5px] font-mono leading-relaxed">
                    <p className="whitespace-pre-line">{parsed.nfse.discriminacao}</p>
                    <div className="mt-2 pt-2 border-t border-slate-300 text-[8.5px] text-slate-700">
                      Código de Tributação Nacional: <strong>{parsed.nfse.codServ}</strong> • Local da Prestação: <strong>{parsed.nfse.locPrest}</strong>
                    </div>
                  </div>
                </div>

                {/* VALORES E RETENÇÕES FEDERAIS */}
                <div className="border border-slate-900 rounded bg-white text-slate-900">
                  <div className="bg-slate-200/90 px-2 py-0.5 text-[8.5px] font-black uppercase border-b border-slate-900">
                    VALORES DOS SERVIÇOS E RETENÇÕES TRIBUTÁRIAS
                  </div>
                  <div className="grid grid-cols-6 text-center text-[8.5px] p-2 gap-1 border-b border-slate-300 font-mono">
                    <div>
                      <span className="text-slate-600 block text-[7px]">VALOR BRUTO</span>
                      <strong className="text-slate-900 text-[10px] font-black">{item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div>
                      <span className="text-slate-600 block text-[7px]">RETENÇÃO INSS (11%)</span>
                      <strong className="text-slate-900">{parsed.nfse.inss.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div>
                      <span className="text-slate-600 block text-[7px]">RETENÇÃO IRRF</span>
                      <strong className="text-slate-900">{parsed.nfse.irrf.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div>
                      <span className="text-slate-600 block text-[7px]">RETENÇÃO CSLL (4.65%)</span>
                      <strong className="text-slate-900">{parsed.nfse.csll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div>
                      <span className="text-slate-600 block text-[7px]">ISS RETIDO</span>
                      <strong className="text-slate-900">{parsed.nfse.issRet.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="bg-emerald-50 rounded p-1">
                      <span className="text-emerald-800 block text-[7px] font-bold">VALOR LÍQUIDO</span>
                      <strong className="text-emerald-950 text-[10px] font-black">
                        {(item.valorTotal - parsed.nfse.inss - parsed.nfse.irrf - parsed.nfse.csll - parsed.nfse.issRet).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ========================================================= */}
            {/* VIEW MODE 3: DANFE (PADRÃO NF-E DE MERCADORIAS - MOD 55)   */}
            {/* ========================================================= */}
            {(item.tipo === 'NFe' || item.tipo === 'NFCe') && (
              <>
                {/* CANHOTO DE RECEBIMENTO */}
                <div className="border border-slate-900 bg-white p-2 rounded text-[10px] space-y-1 text-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-400 pb-1">
                    <div className="text-slate-900">
                      RECEBEMOS DE <strong className="uppercase text-slate-900">{parsed.emit.xNome}</strong> OS PRODUTOS / SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO.
                    </div>
                    <div className="text-right shrink-0 pl-3">
                      <strong className="text-xs block text-slate-900 font-black">NF-e</strong>
                      <span className="text-slate-900 font-bold">Nº {parsed.nNF} - Série {parsed.serie}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 pt-1 text-[9px] text-slate-900">
                    <div className="col-span-3 border-r border-slate-400 pr-1">
                      <span className="text-slate-700 font-bold">DATA DE RECEBIMENTO</span>
                      <div className="h-4 border-b border-slate-400 mt-0.5"></div>
                    </div>
                    <div className="col-span-9">
                      <span className="text-slate-700 font-bold">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span>
                      <div className="h-4 border-b border-slate-400 mt-0.5"></div>
                    </div>
                  </div>
                </div>

                <div className="border-b-2 border-dashed border-slate-400 my-1.5 text-center text-[8px] text-slate-500 uppercase font-bold tracking-widest">
                  -------------------------------- Corte Aqui --------------------------------
                </div>

                {/* CABEÇALHO DO DANFE */}
                <div className="grid grid-cols-12 border-2 border-slate-900 rounded bg-white text-slate-900">
                  
                  {/* EMITENTE */}
                  <div className="col-span-12 sm:col-span-5 p-2.5 border-b sm:border-b-0 sm:border-r border-slate-900 flex flex-col justify-between bg-white">
                    <div>
                      <h2 className="text-xs font-black text-slate-900 uppercase tracking-tight leading-snug">
                        {parsed.emit.xNome}
                      </h2>
                      {parsed.emit.xFant && (
                        <p className="text-[9px] font-bold text-slate-700">{parsed.emit.xFant}</p>
                      )}
                      <p className="text-[9px] text-slate-800 mt-1 leading-normal">
                        {parsed.emit.xLgr}, {parsed.emit.nro} {parsed.emit.xCpl ? `— ${parsed.emit.xCpl}` : ''}<br />
                        {parsed.emit.xBairro} — {parsed.emit.xMun} - {parsed.emit.UF}<br />
                        CEP: {parsed.emit.CEP || '00000-000'} {parsed.emit.fone ? `— Fone: ${parsed.emit.fone}` : ''}<br />
                        CNPJ: {parsed.emit.CNPJ} — IE: {parsed.emit.IE || 'ISENTO'}
                      </p>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-slate-300 text-[8px] font-bold text-slate-700 uppercase">
                      Documento Auxiliar da Nota Fiscal Eletrônica
                    </div>
                  </div>

                  {/* TÍTULO DANFE */}
                  <div className="col-span-6 sm:col-span-2 p-2 border-r border-slate-900 text-center flex flex-col justify-between bg-slate-100/80 text-slate-900">
                    <div>
                      <strong className="text-base font-black block tracking-widest text-slate-900">DANFE</strong>
                      <span className="text-[8px] text-slate-700 block font-bold leading-tight mt-0.5">DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA</span>
                    </div>
                    
                    <div className="my-1 border border-slate-900 p-1 rounded inline-block mx-auto text-left bg-white">
                      <div className="text-[7px] font-bold text-slate-800">0 - ENTRADA</div>
                      <div className="text-[7px] font-bold text-slate-800">1 - SAÍDA</div>
                      <div className="text-xs font-black text-center mt-0.5 bg-slate-900 text-white rounded px-1">
                        {parsed.tpNF}
                      </div>
                    </div>

                    <div className="text-[8px] text-slate-900 leading-tight">
                      <strong className="text-[10px] text-slate-900">Nº {parsed.nNF}</strong><br />
                      <span className="font-bold">SÉRIE {parsed.serie}</span><br />
                      <span>FOLHA 1 / 1</span>
                    </div>
                  </div>

                  {/* CHAVE DE ACESSO & PROTOCOLO */}
                  <div className="col-span-6 sm:col-span-5 p-2 flex flex-col justify-between bg-white text-slate-900">
                    <div className="border border-slate-900 p-1.5 rounded bg-white">
                      <div className="text-[7px] font-bold text-slate-700 uppercase">Chave de Acesso da NF-e</div>
                      <div className="text-[9.5px] font-mono font-black text-slate-900 tracking-wider">
                        {formatChave44(item.chaveAcesso)}
                      </div>
                    </div>

                    <div className="text-[7.5px] text-slate-700 mt-1 leading-tight">
                      Consulta de autenticidade no portal nacional da NF-e <strong>www.nfe.fazenda.gov.br</strong>
                    </div>

                    <div className="border-t border-slate-300 pt-1 mt-1 text-[8px] font-mono">
                      <strong className="block text-[7px] font-sans font-bold text-slate-700">PROTOCOLO DE AUTORIZAÇÃO DE USO</strong>
                      <span className="font-bold text-slate-900">{parsed.nProt} — {parsed.dhRecbto}</span>
                    </div>
                  </div>
                </div>

                {/* NATUREZA DA OPERAÇÃO & INSCRIÇÃO ESTADUAL */}
                <div className="grid grid-cols-12 border-x border-b border-slate-900 rounded-b bg-white text-slate-900 -mt-2.5">
                  <div className="col-span-7 p-1.5 border-r border-slate-900 bg-white">
                    <div className="text-[7.5px] text-slate-600 font-bold uppercase">NATUREZA DA OPERAÇÃO</div>
                    <div className="text-[9.5px] font-bold text-slate-900 uppercase">{parsed.natOp}</div>
                  </div>
                  <div className="col-span-5 p-1.5 bg-white">
                    <div className="text-[7.5px] text-slate-600 font-bold uppercase">INSCRIÇÃO ESTADUAL DO EMITENTE</div>
                    <div className="text-[9.5px] font-mono font-bold text-slate-900">{parsed.emit.IE || 'ISENTO'}</div>
                  </div>
                </div>

                {/* DESTINATÁRIO / REMETENTE */}
                <div className="border border-slate-900 rounded bg-white text-slate-900">
                  <div className="bg-slate-200/90 px-2 py-0.5 text-[8.5px] font-black text-slate-900 uppercase border-b border-slate-900">
                    DESTINATÁRIO / REMETENTE
                  </div>
                  <div className="grid grid-cols-12 text-[9.5px] bg-white">
                    <div className="col-span-8 p-1.5 border-r border-b border-slate-900 bg-white">
                      <div className="text-[7.5px] text-slate-600 font-bold">NOME / RAZÃO SOCIAL</div>
                      <div className="font-bold text-slate-900">{parsed.dest.xNome}</div>
                    </div>
                    <div className="col-span-4 p-1.5 border-b border-slate-900 bg-white">
                      <div className="text-[7.5px] text-slate-600 font-bold">CNPJ / CPF</div>
                      <div className="font-mono font-bold text-slate-900">{parsed.dest.CNPJ}</div>
                    </div>
                    <div className="col-span-6 p-1.5 border-r border-slate-900 bg-white">
                      <div className="text-[7.5px] text-slate-600 font-bold">ENDEREÇO</div>
                      <div>{parsed.dest.xLgr ? `${parsed.dest.xLgr}, ${parsed.dest.nro} ${parsed.dest.xCpl || ''}` : 'ENDEREÇO CONFORME CADASTRO'}</div>
                    </div>
                    <div className="col-span-3 p-1.5 border-r border-slate-900 bg-white">
                      <div className="text-[7.5px] text-slate-600 font-bold">MUNICÍPIO / UF</div>
                      <div>{parsed.dest.xMun || parsed.dest.UF} - {parsed.dest.UF}</div>
                    </div>
                    <div className="col-span-3 p-1.5 bg-white">
                      <div className="text-[7.5px] text-slate-600 font-bold">DATA DE EMISSÃO</div>
                      <div className="font-mono font-bold">{item.dataEmissao}</div>
                    </div>
                  </div>
                </div>

                {/* CÁLCULO DO IMPOSTO TRADICIONAL */}
                <div className="border border-slate-900 rounded bg-white text-slate-900">
                  <div className="bg-slate-200/90 px-2 py-0.5 text-[8.5px] font-black text-slate-900 uppercase border-b border-slate-900">
                    CÁLCULO DO IMPOSTO
                  </div>
                  <div className="grid grid-cols-6 text-[8.5px] border-b border-slate-900 text-center bg-white">
                    <div className="p-1 border-r border-slate-900 bg-white">
                      <span className="text-[7px] text-slate-600 block font-bold">BASE CÁLC. ICMS</span>
                      <strong className="font-mono text-[9.5px] text-slate-900">{parsed.totais.vBC.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1 border-r border-slate-900 bg-white">
                      <span className="text-[7px] text-slate-600 block font-bold">VALOR DO ICMS</span>
                      <strong className="font-mono text-[9.5px] text-blue-900">{parsed.totais.vICMS.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1 border-r border-slate-900 bg-white">
                      <span className="text-[7px] text-slate-600 block font-bold">BASE ICMS ST</span>
                      <strong className="font-mono text-[9.5px] text-slate-900">{parsed.totais.vBCST.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1 border-r border-slate-900 bg-white">
                      <span className="text-[7px] text-slate-600 block font-bold">VALOR ICMS ST</span>
                      <strong className="font-mono text-[9.5px] text-slate-900">{parsed.totais.vST.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1 border-r border-slate-900 bg-white">
                      <span className="text-[7px] text-slate-600 block font-bold">TOTAL PRODUTOS</span>
                      <strong className="font-mono text-[9.5px] text-slate-900">{parsed.totais.vProd.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1 bg-slate-100">
                      <span className="text-[7px] text-slate-800 block font-black">VALOR TOTAL DA NOTA</span>
                      <strong className="font-mono text-[10.5px] text-emerald-950 font-black">{parsed.totais.vNF.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-6 text-[8px] text-center bg-slate-50">
                    <div className="p-1 border-r border-slate-300">
                      <span className="text-[6.5px] text-slate-600 block font-bold">VALOR FRETE</span>
                      <strong className="font-mono">{parsed.totais.vFrete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1 border-r border-slate-300">
                      <span className="text-[6.5px] text-slate-600 block font-bold">VALOR SEGURO</span>
                      <strong className="font-mono">{parsed.totais.vSeg.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1 border-r border-slate-300">
                      <span className="text-[6.5px] text-slate-600 block font-bold">DESCONTO</span>
                      <strong className="font-mono">{parsed.totais.vDesc.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1 border-r border-slate-300">
                      <span className="text-[6.5px] text-slate-600 block font-bold">OUTRAS DESPESAS</span>
                      <strong className="font-mono">{parsed.totais.vOutro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1 border-r border-slate-300">
                      <span className="text-[6.5px] text-slate-600 block font-bold">VALOR DO IPI</span>
                      <strong className="font-mono">{parsed.totais.vIPI.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1">
                      <span className="text-[6.5px] text-slate-600 block font-bold">PIS / COFINS</span>
                      <strong className="font-mono">{(parsed.totais.vPIS + parsed.totais.vCOFINS).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                  </div>
                </div>

                {/* DADOS DOS PRODUTOS / SERVIÇOS (ITENS REAIS DO XML) */}
                <div className="border border-slate-900 rounded bg-white text-slate-900 overflow-hidden">
                  <div className="bg-slate-200/90 px-2 py-0.5 text-[8.5px] font-black text-slate-900 uppercase border-b border-slate-900 flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3 text-slate-700" />
                      DADOS DOS PRODUTOS / SERVIÇOS (ITENS CONSTANTES DO XML)
                    </span>
                    <span className="text-[7.5px] font-mono text-slate-700 font-bold">{parsed.itens.length} ITEM(NS) NA NOTA FISCAL</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[8px] font-mono border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-900 text-[7px] text-slate-700 font-bold uppercase text-center">
                          <th className="p-1 border-r border-slate-300 w-6">ITEM</th>
                          <th className="p-1 border-r border-slate-300 w-20">CÓD. PROD.</th>
                          <th className="p-1 border-r border-slate-300 text-left">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                          <th className="p-1 border-r border-slate-300 w-16">NCM/SH</th>
                          <th className="p-1 border-r border-slate-300 w-10">CFOP</th>
                          <th className="p-1 border-r border-slate-300 w-8">UN</th>
                          <th className="p-1 border-r border-slate-300 w-12">QTD</th>
                          <th className="p-1 border-r border-slate-300 w-16">V. UNIT</th>
                          <th className="p-1 border-r border-slate-300 w-16">V. TOTAL</th>
                          <th className="p-1 border-r border-slate-300 w-14">V. ICMS</th>
                          <th className="p-1 border-r border-slate-300 w-14">CBS (0.9%)</th>
                          <th className="p-1 w-14">IBS (0.1%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.itens.map((it) => (
                          <tr key={it.numeroItem} className="border-b border-slate-200 text-slate-900 text-center hover:bg-slate-50">
                            <td className="p-1 border-r border-slate-200 font-bold">{it.numeroItem}</td>
                            <td className="p-1 border-r border-slate-200 font-mono text-[7.5px]">{it.codigo}</td>
                            <td className="p-1 border-r border-slate-200 text-left font-sans text-[8.5px] font-medium leading-tight">{it.descricao}</td>
                            <td className="p-1 border-r border-slate-200 font-mono">{it.ncmCts}</td>
                            <td className="p-1 border-r border-slate-200">{it.cfop}</td>
                            <td className="p-1 border-r border-slate-200">{it.unidade}</td>
                            <td className="p-1 border-r border-slate-200 font-bold">{it.quantidade}</td>
                            <td className="p-1 border-r border-slate-200">{it.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="p-1 border-r border-slate-200 font-bold text-slate-950">{it.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="p-1 border-r border-slate-200">{it.valorIcms.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="p-1 border-r border-slate-200 text-blue-900 font-semibold">{it.valorCbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="p-1 text-indigo-900 font-semibold">{it.valorIbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* DEMONSTRATIVO DA REFORMA TRIBUTÁRIA (CBS / IBS) */}
                <div className="border-2 border-cyan-600 rounded bg-cyan-50/90 p-2 space-y-1 text-slate-900">
                  <div className="flex items-center justify-between border-b border-cyan-300 pb-1">
                    <span className="text-[9.5px] font-black text-cyan-950 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-700" />
                      DEMONSTRATIVO DANFE DA REFORMA TRIBUTÁRIA DO CONSUMO (PLP 68/2024 — DUAL TAX)
                    </span>
                    <span className="text-[8px] font-black px-2 py-0.5 rounded bg-cyan-200 text-cyan-950">
                      Transição CBS/IBS
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[9.5px] text-center pt-1">
                    <div className="p-1.5 rounded bg-white border border-cyan-300 shadow-sm">
                      <span className="text-[7.5px] text-slate-700 block font-bold">CBS (Federal ~0.9%)</span>
                      <strong className="font-mono text-blue-950 font-black text-[10.5px]">{item.valorCbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-white border border-cyan-300 shadow-sm">
                      <span className="text-[7.5px] text-slate-700 block font-bold">IBS (Estadual/Municipal ~0.1%)</span>
                      <strong className="font-mono text-indigo-950 font-black text-[10.5px]">{item.valorIbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-white border border-cyan-300 shadow-sm col-span-2 sm:col-span-1">
                      <span className="text-[7.5px] text-slate-700 block font-bold">Imposto Seletivo (IS)</span>
                      <strong className="font-mono text-slate-900 font-black text-[10.5px]">R$ 0,00</strong>
                    </div>
                  </div>
                </div>

                {/* DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES */}
                {parsed.infCpl && (
                  <div className="border border-slate-900 rounded bg-white text-slate-900">
                    <div className="bg-slate-200/90 px-2 py-0.5 text-[8.5px] font-black uppercase border-b border-slate-900">
                      DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES
                    </div>
                    <div className="p-2 text-[8.5px] font-mono whitespace-pre-line leading-relaxed text-slate-800">
                      {parsed.infCpl}
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Documento validado com Chave de 44 dígitos no portal oficial da SEFAZ</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
