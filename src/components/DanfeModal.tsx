import React, { useRef } from 'react';
import { X, Printer, FileCode, ShieldCheck, Sparkles, Truck, Building2, CheckCircle2, Package } from 'lucide-react';
import { DfeXmlItem, ItemDfeDetail } from '../types';

interface DanfeModalProps {
  item: DfeXmlItem | null;
  onClose: () => void;
}

export const DanfeModal: React.FC<DanfeModalProps> = ({ item, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!item) return null;

  // Format 44-digit Chave de Acesso into 4-digit blocks
  const formatChave44 = (chave: string) => {
    return chave.replace(/(.{4})/g, '$1 ').trim();
  };

  // Format 50-digit NFS-e Chave de Acesso (Padrão Nacional)
  const formatChave50Nfse = (chave: string) => {
    if (chave.length === 50) {
      return `${chave.slice(0, 7)} ${chave.slice(7, 11)} ${chave.slice(11, 25)} ${chave.slice(25, 26)} ${chave.slice(26, 41)} ${chave.slice(41, 50)}`;
    }
    return chave.replace(/(.{4})/g, '$1 ').trim();
  };

  const handlePrint = () => {
    window.print();
  };

  const getDocTitle = () => {
    switch (item.tipo) {
      case 'CTe':
        return `Visualizador Gráfico DACTE — CT-e Nº ${item.numero}`;
      case 'NFSe':
        return `Visualizador Gráfico DANFSe — NFS-e Nº ${item.numero}`;
      default:
        return `Visualizador Gráfico DANFE — NF-e Nº ${item.numero}`;
    }
  };

  // Fallback items if none attached to document
  const displayItens: ItemDfeDetail[] = (item.itens && item.itens.length > 0)
    ? item.itens
    : [
        {
          numeroItem: 1,
          codigo: item.tipo === 'NFSe' ? 'SRV-01' : item.tipo === 'CTe' ? 'FRETE-01' : 'PRD-001',
          descricao: item.tipo === 'NFSe'
            ? 'PRESTAÇÃO DE SERVIÇOS TÉCNICOS ESPECIALIZADOS EM CONSULTORIA TRIBUTÁRIA E ADEQUAÇÃO TRIBUTÁRIA'
            : item.tipo === 'CTe'
            ? `PRESTAÇÃO DE TRANSPORTE RODOVIÁRIO DE CARGA GERAL INTERESTADUAL (${item.emitenteUf} -> ${item.destinatarioUf})`
            : 'EQUIPAMENTO / MERCADORIA ADQUIRIDA CONFORME NOTA FISCAL ELETRÔNICA',
          ncmCts: item.tipo === 'NFSe' ? '17.01' : '8471.30.12',
          cfop: item.tipo === 'CTe' ? '6352' : item.tipo === 'NFSe' ? '0000' : '5102',
          unidade: item.tipo === 'CTe' ? 'VIAGEM' : 'UN',
          quantidade: 1,
          valorUnitario: item.valorTotal,
          valorTotal: item.valorTotal,
          valorIcms: item.valorIcms,
          valorIpi: item.valorIpi,
          valorCbs: item.valorCbs,
          valorIbs: item.valorIbs,
        }
      ];

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
                  ? `Chave de Acesso NFS-e (50 posições): ${item.chaveAcesso}`
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
                {/* CANHOTO DE RECEBIMENTO DO CTE */}
                <div className="border border-slate-900 bg-white p-2 rounded text-[10px] space-y-1 text-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-400 pb-1">
                    <div className="text-slate-900">
                      DECLARAMOS QUE RECEBEMOS OS SERVIÇOS DE TRANSPORTE CONSTANTES DESTE CONHECIMENTO DE TRANSPORTE ELETRÔNICO (CT-e).
                    </div>
                    <div className="text-right shrink-0 pl-3">
                      <strong className="text-xs block text-slate-900 font-black">DACTE</strong>
                      <span className="text-slate-900 font-bold">CT-e Nº {item.numero} - Série {item.serie}</span>
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
                  {/* EMITENTE / TRANSPORTADOR */}
                  <div className="col-span-12 sm:col-span-5 p-2.5 border-b sm:border-b-0 sm:border-r border-slate-900 flex flex-col justify-between bg-white">
                    <div>
                      <h2 className="text-xs font-black text-slate-900 uppercase tracking-tight leading-snug">
                        {item.emitenteNome}
                      </h2>
                      <p className="text-[9px] text-slate-800 mt-1 leading-normal">
                        TRANSPORTES RODOVIÁRIOS E LOGÍSTICA S.A.<br />
                        RNTRC: 04918239 — CNPJ: {item.emitenteCnpj}<br />
                        IE: {item.emitenteIe || '9012384712'} — UF: {item.emitenteUf}
                      </p>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-slate-300 text-[8px] font-bold text-slate-700 uppercase">
                      Documento Auxiliar do Conhecimento de Transporte Eletrônico
                    </div>
                  </div>

                  {/* TÍTULO DACTE & MODAL */}
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
                      <strong className="text-[10px] text-slate-900">Nº {item.numero}</strong><br />
                      <span className="font-bold">SÉRIE {item.serie}</span><br />
                      <span>FOLHA 1 / 1</span>
                    </div>
                  </div>

                  {/* CHAVE DE ACESSO & BARRAS */}
                  <div className="col-span-6 sm:col-span-5 p-2 flex flex-col justify-between bg-white text-slate-900">
                    <div className="bg-white h-9 w-full border border-slate-900 flex items-center justify-center p-0.5">
                      <svg className="w-full h-full" viewBox="0 0 300 36" preserveAspectRatio="none">
                        <rect x="0" y="0" width="300" height="36" fill="#ffffff" />
                        <path d="M4 0v36M7 0v36M10 0v36M15 0v36M18 0v36M22 0v36M27 0v36M30 0v36M34 0v36M39 0v36M43 0v36M47 0v36M52 0v36M57 0v36M61 0v36M65 0v36M70 0v36M74 0v36M78 0v36M83 0v36M87 0v36M91 0v36M95 0v36M100 0v36M104 0v36M108 0v36M113 0v36M118 0v36M122 0v36M126 0v36M131 0v36M135 0v36M139 0v36M144 0v36M148 0v36M152 0v36M157 0v36M162 0v36M166 0v36M170 0v36M175 0v36M179 0v36M183 0v36M188 0v36M192 0v36M196 0v36M201 0v36M205 0v36M209 0v36M214 0v36M218 0v36M222 0v36M227 0v36M231 0v36M235 0v36M240 0v36M244 0v36M248 0v36M253 0v36M258 0v36M262 0v36M266 0v36M271 0v36M275 0v36M279 0v36M284 0v36M288 0v36M292 0v36" stroke="#000000" strokeWidth="2" />
                      </svg>
                    </div>

                    <div className="border border-slate-900 p-1 rounded mt-1 bg-white">
                      <div className="text-[7px] font-bold text-slate-700 uppercase">Chave de Acesso do CT-e</div>
                      <div className="text-[9.5px] font-mono font-black text-slate-900 tracking-wider">
                        {formatChave44(item.chaveAcesso)}
                      </div>
                    </div>

                    <div className="text-[7.5px] text-slate-700 mt-1 leading-tight">
                      Consulta de autenticidade no portal nacional do CT-e www.cte.fazenda.gov.br
                    </div>
                  </div>
                </div>

                {/* NATUREZA DA OPERAÇÃO & PROTOCOLO */}
                <div className="grid grid-cols-12 border-x border-b border-slate-900 rounded-b bg-white text-slate-900 -mt-2.5">
                  <div className="col-span-7 p-1.5 border-r border-slate-900 bg-white">
                    <div className="text-[7.5px] text-slate-600 font-bold uppercase">NATUREZA DA OPERAÇÃO</div>
                    <div className="text-[9.5px] font-bold text-slate-900 uppercase">PRESTAÇÃO DE SERVIÇO DE TRANSPORTE INTERESTADUAL</div>
                  </div>
                  <div className="col-span-5 p-1.5 bg-white">
                    <div className="text-[7.5px] text-slate-600 font-bold uppercase">PROTOCOLO DE AUTORIZAÇÃO DE USO</div>
                    <div className="text-[9.5px] font-mono font-bold text-slate-900">141260819482710 - {item.dataEmissao}</div>
                  </div>
                </div>

                {/* ORIGEM X DESTINO DA PRESTAÇÃO */}
                <div className="grid grid-cols-12 border border-slate-900 rounded bg-white text-slate-900">
                  <div className="col-span-6 p-1.5 border-r border-slate-900 bg-white">
                    <div className="text-[7.5px] text-slate-600 font-bold">INÍCIO DA PRESTAÇÃO (MUNICÍPIO / UF)</div>
                    <div className="text-[9.5px] font-bold text-slate-900 uppercase">CURITIBA - {item.emitenteUf}</div>
                  </div>
                  <div className="col-span-6 p-1.5 bg-white">
                    <div className="text-[7.5px] text-slate-600 font-bold">TÉRMINO DA PRESTAÇÃO (MUNICÍPIO / UF)</div>
                    <div className="text-[9.5px] font-bold text-slate-900 uppercase">RIO DE JANEIRO - {item.destinatarioUf}</div>
                  </div>
                </div>

                {/* REMETENTE X DESTINATÁRIO DA CARGA */}
                <div className="border border-slate-900 rounded bg-white text-slate-900">
                  <div className="bg-slate-200/90 px-2 py-0.5 text-[8.5px] font-black text-slate-900 uppercase border-b border-slate-900">
                    PARTES ENVOLVIDAS NA PRESTAÇÃO (REMETENTE / DESTINATÁRIO / TOMADOR)
                  </div>
                  <div className="grid grid-cols-12 text-[9.5px] bg-white">
                    <div className="col-span-6 p-1.5 border-r border-b border-slate-900 bg-white">
                      <div className="text-[7.5px] text-slate-600 font-bold">REMETENTE</div>
                      <div className="font-bold text-slate-900">{item.emitenteNome}</div>
                      <div className="text-[8px] font-mono text-slate-700">CNPJ: {item.emitenteCnpj} | IE: {item.emitenteIe || 'ISENTO'}</div>
                    </div>
                    <div className="col-span-6 p-1.5 border-b border-slate-900 bg-white">
                      <div className="text-[7.5px] text-slate-600 font-bold">DESTINATÁRIO</div>
                      <div className="font-bold text-slate-900">{item.destinatarioNome}</div>
                      <div className="text-[8px] font-mono text-slate-700">CNPJ: {item.destinatarioCnpj} | IE: {item.destinatarioIe || 'ISENTO'}</div>
                    </div>
                  </div>
                </div>

                {/* DADOS DA CARGA & COMPONENTES DO FRETE */}
                <div className="border border-slate-900 rounded bg-white text-slate-900">
                  <div className="bg-slate-200/90 px-2 py-0.5 text-[8.5px] font-black text-slate-900 uppercase border-b border-slate-900">
                    INFORMAÇÕES DA CARGA E COMPONENTES DO VALOR DA PRESTAÇÃO
                  </div>
                  <div className="grid grid-cols-4 text-[8.5px] border-b border-slate-900 text-center bg-white">
                    <div className="p-1 border-r border-slate-900">
                      <span className="text-[7px] text-slate-600 block font-bold">PRODUTO PREDOMINANTE</span>
                      <strong className="text-[9px] text-slate-900">CARGA GERAL / EQUIPAMENTOS</strong>
                    </div>
                    <div className="p-1 border-r border-slate-900">
                      <span className="text-[7px] text-slate-600 block font-bold">VALOR TOTAL DA CARGA</span>
                      <strong className="font-mono text-[9px] text-slate-900">R$ 150.000,00</strong>
                    </div>
                    <div className="p-1 border-r border-slate-900">
                      <span className="text-[7px] text-slate-600 block font-bold">PESO BRUTO (KG)</span>
                      <strong className="font-mono text-[9px] text-slate-900">12.450,00 KG</strong>
                    </div>
                    <div className="p-1">
                      <span className="text-[7px] text-slate-600 block font-bold">VALOR TOTAL DO FRETE</span>
                      <strong className="font-mono text-[10px] text-emerald-950 font-black">
                        {item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* DADOS DOS ITENS DA CARGA E COMPONENTES DO FRETE */}
                <div className="border border-slate-900 rounded bg-white text-slate-900 overflow-hidden">
                  <div className="bg-slate-200/90 px-2 py-0.5 text-[8.5px] font-black text-slate-900 uppercase border-b border-slate-900 flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3 text-slate-700" />
                      ITENS E COMPONENTES DO SERVIÇO DE TRANSPORTE
                    </span>
                    <span className="text-[7.5px] font-mono text-slate-700 font-bold">{displayItens.length} ITEM(NS) REGISTRADO(S)</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[8px] font-mono border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-900 text-[7px] text-slate-700 font-bold uppercase text-center">
                          <th className="p-1 border-r border-slate-300 w-6">ITEM</th>
                          <th className="p-1 border-r border-slate-300 w-24">CÓDIGO</th>
                          <th className="p-1 border-r border-slate-300 text-left">DESCRIÇÃO DA CARGA / SERVIÇO</th>
                          <th className="p-1 border-r border-slate-300 w-12">CFOP</th>
                          <th className="p-1 border-r border-slate-300 w-12">QTD/UN</th>
                          <th className="p-1 border-r border-slate-300 w-20">VALOR FRETE</th>
                          <th className="p-1 border-r border-slate-300 w-16">CBS (~8.8%)</th>
                          <th className="p-1 w-16">IBS (~17.7%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayItens.map((it) => (
                          <tr key={it.numeroItem} className="border-b border-slate-200 text-slate-900 text-center hover:bg-slate-50">
                            <td className="p-1 border-r border-slate-200 font-bold">{it.numeroItem}</td>
                            <td className="p-1 border-r border-slate-200">{it.codigo}</td>
                            <td className="p-1 border-r border-slate-200 text-left font-sans text-[8.5px] font-medium">{it.descricao}</td>
                            <td className="p-1 border-r border-slate-200">{it.cfop || '6352'}</td>
                            <td className="p-1 border-r border-slate-200 font-bold">{it.quantidade} {it.unidade}</td>
                            <td className="p-1 border-r border-slate-200 font-bold text-slate-950">{it.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="p-1 border-r border-slate-200 text-blue-900 font-semibold">{(it.valorCbs || it.valorTotal * 0.088).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="p-1 text-indigo-900 font-semibold">{(it.valorIbs || it.valorTotal * 0.177).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* REFORMA TRIBUTÁRIA DUAL TAX (CBS / IBS) */}
                <div className="border-2 border-blue-600 rounded bg-blue-50/90 p-2 space-y-1 text-slate-900">
                  <div className="flex items-center justify-between border-b border-blue-300 pb-1">
                    <span className="text-[9.5px] font-black text-blue-950 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                      DEMONSTRATIVO DACTE DA REFORMA TRIBUTÁRIA (PLP 68/2024 — DUAL TAX)
                    </span>
                    <span className="text-[8px] font-black px-2 py-0.5 rounded bg-blue-200 text-blue-900">
                      Transição CBS/IBS Transporte
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[9.5px] text-center pt-1">
                    <div className="p-1.5 rounded bg-white border border-blue-300 shadow-sm">
                      <span className="text-[7.5px] text-slate-700 block font-bold">CBS (Federal {item.aliquotaCbs > 0 ? `~${item.aliquotaCbs}%` : ''})</span>
                      <strong className="font-mono text-blue-950 font-black text-[10.5px]">{item.valorCbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-white border border-blue-300 shadow-sm">
                      <span className="text-[7.5px] text-slate-700 block font-bold">IBS (Estadual {item.aliquotaIbs > 0 ? `~${item.aliquotaIbs}%` : ''})</span>
                      <strong className="font-mono text-indigo-950 font-black text-[10.5px]">{item.valorIbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-white border border-blue-300 shadow-sm">
                      <span className="text-[7.5px] text-slate-700 block font-bold">ICMS Destacado</span>
                      <strong className="font-mono text-emerald-950 font-black text-[10.5px]">{item.valorIcms.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ========================================================= */}
            {/* VIEW MODE 2: DANFSE (NOTA FISCAL DE SERVIÇO - 50 POSIÇÕES) */}
            {/* ========================================================= */}
            {item.tipo === 'NFSe' && (
              <>
                {/* CABEÇALHO DANFSE PADRÃO NACIONAL */}
                <div className="grid grid-cols-12 border-2 border-indigo-900 rounded bg-white text-slate-900">
                  {/* LOGO & BRASÃO PREFEITURA / PADRÃO NACIONAL */}
                  <div className="col-span-12 sm:col-span-4 p-3 border-b sm:border-b-0 sm:border-r border-indigo-900 flex flex-col justify-between bg-white">
                    <div>
                      <div className="inline-block px-2 py-0.5 bg-indigo-950 text-white text-[8px] font-black rounded uppercase tracking-wider mb-1">
                        SISTEMA NACIONAL NFS-E
                      </div>
                      <h2 className="text-xs font-black text-slate-900 uppercase tracking-tight leading-snug">
                        PREFEITURA MUNICIPAL DE SÃO PAULO
                      </h2>
                      <p className="text-[9px] text-slate-700 mt-0.5 font-bold">
                        SECRETARIA MUNICIPAL DA FAZENDA
                      </p>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-slate-300 text-[8px] font-black text-indigo-950 uppercase">
                      Documento Auxiliar da NFS-e (DANFSe Padrão Nacional)
                    </div>
                  </div>

                  {/* DANFSE TÍTULO & NÚMERO */}
                  <div className="col-span-6 sm:col-span-3 p-2.5 border-r border-indigo-900 text-center flex flex-col justify-between bg-indigo-50/60 text-slate-900">
                    <div>
                      <strong className="text-base font-black block tracking-widest text-indigo-950">DANFSe</strong>
                      <span className="text-[7.5px] text-slate-700 block font-bold leading-tight mt-0.5">NOTA FISCAL DE SERVIÇOS ELETRÔNICA</span>
                    </div>

                    <div className="text-[8.5px] text-slate-900 leading-tight my-1">
                      <span className="text-[7.5px] text-slate-600 block">NÚMERO DA NFS-E</span>
                      <strong className="text-sm font-black text-indigo-950 font-mono">{item.numero}</strong><br />
                      <span className="font-bold text-[8px] text-slate-700">SÉRIE: {item.serie}</span>
                    </div>

                    <div className="text-[8px] text-slate-700 font-mono">
                      Data Emissão: <strong>{item.dataEmissao}</strong>
                    </div>
                  </div>

                  {/* CHAVE DE ACESSO DA NFS-E (50 POSIÇÕES EXATAS) */}
                  <div className="col-span-6 sm:col-span-5 p-2 flex flex-col justify-between bg-white text-slate-900">
                    <div className="p-1.5 rounded bg-indigo-950 text-white border border-indigo-900 space-y-0.5">
                      <div className="flex items-center justify-between text-[7px] text-indigo-300 font-bold uppercase">
                        <span>Chave de Acesso NFS-e (Padrão Nacional)</span>
                        <span className="text-cyan-400 font-extrabold">50 Posições</span>
                      </div>
                      <div className="text-[9px] font-mono font-black text-cyan-300 tracking-tight leading-tight break-all">
                        {formatChave50Nfse(item.chaveAcesso)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[8px] text-slate-800 font-mono mt-1">
                      <div className="bg-slate-100 p-1 rounded border border-slate-300">
                        <span className="text-[6.5px] text-slate-600 block font-bold">CÓD. VERIFICAÇÃO</span>
                        <strong className="text-slate-900 font-black">8A9B-C12D-9988</strong>
                      </div>
                      <div className="bg-slate-100 p-1 rounded border border-slate-300">
                        <span className="text-[6.5px] text-slate-600 block font-bold">COMPETÊNCIA</span>
                        <strong className="text-slate-900 font-black">08/2026</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PRESTADOR DOS SERVIÇOS */}
                <div className="border border-slate-900 rounded bg-white text-slate-900">
                  <div className="bg-indigo-950 text-white px-2 py-0.5 text-[8.5px] font-black uppercase flex justify-between">
                    <span>PRESTADOR DOS SERVIÇOS</span>
                    <span className="text-cyan-300 font-mono">CNPJ: {item.emitenteCnpj}</span>
                  </div>
                  <div className="p-2 text-[9.5px] grid grid-cols-12 gap-2 bg-white">
                    <div className="col-span-8">
                      <span className="text-[7.5px] text-slate-600 block font-bold">RAZÃO SOCIAL</span>
                      <strong className="text-slate-900 text-xs block">{item.emitenteNome}</strong>
                    </div>
                    <div className="col-span-4 font-mono">
                      <span className="text-[7.5px] text-slate-600 block font-bold">INSCRIÇÃO MUNICIPAL</span>
                      <strong className="text-slate-900">3.481.902-1</strong>
                    </div>
                    <div className="col-span-12 text-slate-700 text-[9px]">
                      Endereço: Avenida Paulista, 1000 - Conj 14 — São Paulo / {item.emitenteUf} — CEP: 01310-100 — Tel: (11) 3300-1000
                    </div>
                  </div>
                </div>

                {/* TOMADOR DOS SERVIÇOS */}
                <div className="border border-slate-900 rounded bg-white text-slate-900">
                  <div className="bg-slate-200/90 text-slate-900 px-2 py-0.5 text-[8.5px] font-black uppercase border-b border-slate-900 flex justify-between">
                    <span>TOMADOR DOS SERVIÇOS</span>
                    <span className="font-mono font-bold">CNPJ: {item.destinatarioCnpj}</span>
                  </div>
                  <div className="p-2 text-[9.5px] grid grid-cols-12 gap-2 bg-white">
                    <div className="col-span-8">
                      <span className="text-[7.5px] text-slate-600 block font-bold">NOME / RAZÃO SOCIAL</span>
                      <strong className="text-slate-900 text-xs block">{item.destinatarioNome}</strong>
                    </div>
                    <div className="col-span-4 font-mono">
                      <span className="text-[7.5px] text-slate-600 block font-bold">INSCRIÇÃO MUNICIPAL / UF</span>
                      <strong className="text-slate-900">ISENTO / {item.destinatarioUf}</strong>
                    </div>
                  </div>
                </div>

                {/* DISCRIMINAÇÃO DOS SERVIÇOS PRESTADOS */}
                <div className="border border-slate-900 rounded bg-white text-slate-900">
                  <div className="bg-slate-200/90 px-2 py-0.5 text-[8.5px] font-black text-slate-900 uppercase border-b border-slate-900">
                    DISCRIMINAÇÃO DOS SERVIÇOS PRESTADOS
                  </div>
                  <div className="p-2.5 bg-white space-y-2">
                    <p className="text-[9.5px] text-slate-900 leading-relaxed font-mono">
                      PRESTAÇÃO DE SERVIÇOS TÉCNICOS ESPECIALIZADOS EM CONSULTORIA TRIBUTÁRIA, ANÁLISE DE CONFORMIDADE FISCAL SEFAZ E SUITE DE INTEGRAÇÃO DE ARQUIVOS XML CONFORME LEI COMPLEMENTAR 116/2003.<br />
                      — CÓDIGO DA ATIVIDADE MUNICIPAL: 17.01 / 01.07 (SUPORTE E CONSULTORIA TÉCNICA EM TI E IMPOSTOS)<br />
                      — LOCAL DA PRESTAÇÃO: SÃO PAULO - SP
                    </p>
                  </div>
                </div>

                {/* VALORES & DETALHAMENTO DO ISSQN */}
                <div className="border border-slate-900 rounded bg-white text-slate-900">
                  <div className="bg-slate-200/90 px-2 py-0.5 text-[8.5px] font-black text-slate-900 uppercase border-b border-slate-900">
                    CÁLCULO DO ISSQN E RETENÇÕES TRIBUTÁRIAS
                  </div>
                  <div className="grid grid-cols-5 text-[8.5px] text-center bg-white border-b border-slate-900">
                    <div className="p-1 border-r border-slate-900">
                      <span className="text-[7px] text-slate-600 block font-bold">VALOR DOS SERVIÇOS</span>
                      <strong className="font-mono text-[10px] text-slate-900">{item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1 border-r border-slate-900">
                      <span className="text-[7px] text-slate-600 block font-bold">BASE CÁLCULO ISSQN</span>
                      <strong className="font-mono text-[9.5px] text-slate-900">{item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1 border-r border-slate-900">
                      <span className="text-[7px] text-slate-600 block font-bold">ALÍQUOTA ISS</span>
                      <strong className="font-mono text-[9.5px] text-indigo-900">5,00%</strong>
                    </div>
                    <div className="p-1 border-r border-slate-900">
                      <span className="text-[7px] text-slate-600 block font-bold">VALOR DO ISSQN</span>
                      <strong className="font-mono text-[9.5px] text-indigo-950 font-black">
                        {(item.valorTotal * 0.05).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </div>
                    <div className="p-1">
                      <span className="text-[7px] text-slate-600 block font-bold">ISS RETIDO NA FONTE</span>
                      <strong className="text-[9.5px] text-slate-900">NÃO</strong>
                    </div>
                  </div>

                  {/* RETENÇÕES FEDERAIS */}
                  <div className="grid grid-cols-5 text-[8px] text-center bg-slate-50">
                    <div className="p-1 border-r border-slate-300">
                      <span className="text-[6.5px] text-slate-600 block font-bold">PIS (1.65%)</span>
                      <strong className="font-mono text-slate-900">{item.valorPis.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1 border-r border-slate-300">
                      <span className="text-[6.5px] text-slate-600 block font-bold">COFINS (7.60%)</span>
                      <strong className="font-mono text-slate-900">{item.valorCofins.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1 border-r border-slate-300">
                      <span className="text-[6.5px] text-slate-600 block font-bold">INSS</span>
                      <strong className="font-mono text-slate-900">R$ 0,00</strong>
                    </div>
                    <div className="p-1 border-r border-slate-300">
                      <span className="text-[6.5px] text-slate-600 block font-bold">IRRF</span>
                      <strong className="font-mono text-slate-900">R$ 0,00</strong>
                    </div>
                    <div className="p-1">
                      <span className="text-[6.5px] text-slate-600 block font-bold">VALOR LÍQUIDO NFS-E</span>
                      <strong className="font-mono text-emerald-950 font-black text-[9.5px]">{item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                  </div>
                </div>

                {/* DETALHAMENTO DOS ITENS DA PRESTAÇÃO DE SERVIÇOS */}
                <div className="border border-slate-900 rounded bg-white text-slate-900 overflow-hidden">
                  <div className="bg-indigo-950 text-white px-2 py-0.5 text-[8.5px] font-black uppercase flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3 text-cyan-400" />
                      ITENS E DETALHAMENTO DOS SERVIÇOS MUNICIPAIS
                    </span>
                    <span className="text-[7.5px] font-mono text-cyan-300 font-bold">{displayItens.length} ITEM(NS) DE SERVIÇO</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[8px] font-mono border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-900 text-[7px] text-slate-700 font-bold uppercase text-center">
                          <th className="p-1 border-r border-slate-300 w-6">ITEM</th>
                          <th className="p-1 border-r border-slate-300 w-24">CÓDIGO / ITEM LC116</th>
                          <th className="p-1 border-r border-slate-300 text-left">DISCRIMINAÇÃO DOS SERVIÇOS</th>
                          <th className="p-1 border-r border-slate-300 w-10">QTD</th>
                          <th className="p-1 border-r border-slate-300 w-20">V. UNITÁRIO</th>
                          <th className="p-1 border-r border-slate-300 w-20">V. SERVIÇOS</th>
                          <th className="p-1 border-r border-slate-300 w-16">CBS SERV (~8.8%)</th>
                          <th className="p-1 w-16">IBS SERV (~17.7%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayItens.map((it) => (
                          <tr key={it.numeroItem} className="border-b border-slate-200 text-slate-900 text-center hover:bg-slate-50">
                            <td className="p-1 border-r border-slate-200 font-bold">{it.numeroItem}</td>
                            <td className="p-1 border-r border-slate-200">{it.codigo}</td>
                            <td className="p-1 border-r border-slate-200 text-left font-sans text-[8.5px] font-medium">{it.descricao}</td>
                            <td className="p-1 border-r border-slate-200 font-bold">{it.quantidade}</td>
                            <td className="p-1 border-r border-slate-200">{it.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="p-1 border-r border-slate-200 font-bold text-slate-950">{it.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="p-1 border-r border-slate-200 text-blue-900 font-semibold">{(it.valorCbs || it.valorTotal * 0.088).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="p-1 text-indigo-900 font-semibold">{(it.valorIbs || it.valorTotal * 0.177).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* REFORMA TRIBUTÁRIA SERVIÇOS (PLP 68/2024 — CBS / IBS) */}
                <div className="border-2 border-indigo-600 rounded bg-indigo-50/90 p-2 space-y-1 text-slate-900">
                  <div className="flex items-center justify-between border-b border-indigo-300 pb-1">
                    <span className="text-[9.5px] font-black text-indigo-950 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-700" />
                      DEMONSTRATIVO DANFSE DA REFORMA TRIBUTÁRIA DO CONSUMO (PLP 68/2024 — CBS / IBS)
                    </span>
                    <span className="text-[8px] font-black px-2 py-0.5 rounded bg-indigo-200 text-indigo-950">
                      Substituição do ISSQN por IBS/CBS
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[9.5px] text-center pt-1">
                    <div className="p-1.5 rounded bg-white border border-indigo-300 shadow-sm">
                      <span className="text-[7.5px] text-slate-700 block font-bold">CBS Serv (Federal {item.aliquotaCbs > 0 ? `~${item.aliquotaCbs}%` : ''})</span>
                      <strong className="font-mono text-blue-950 font-black text-[10.5px]">{item.valorCbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-white border border-indigo-300 shadow-sm">
                      <span className="text-[7.5px] text-slate-700 block font-bold">IBS Serv (Estadual/Municipal {item.aliquotaIbs > 0 ? `~${item.aliquotaIbs}%` : ''})</span>
                      <strong className="font-mono text-indigo-950 font-black text-[10.5px]">{item.valorIbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
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
                      RECEBEMOS DE <strong className="uppercase text-slate-900">{item.emitenteNome}</strong> OS PRODUTOS / SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO.
                    </div>
                    <div className="text-right shrink-0 pl-3">
                      <strong className="text-xs block text-slate-900 font-black">NF-e</strong>
                      <span className="text-slate-900 font-bold">Nº {item.numero} - Série {item.serie}</span>
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
                  <div className="col-span-12 sm:col-span-5 p-2.5 border-b sm:border-b-0 sm:border-r border-slate-900 flex flex-col justify-between bg-white">
                    <div>
                      <h2 className="text-xs font-black text-slate-900 uppercase tracking-tight leading-snug">
                        {item.emitenteNome}
                      </h2>
                      <p className="text-[9px] text-slate-800 mt-1 leading-normal">
                        RUA DAS INDÚSTRIAS, 1000 — DISTRITO INDUSTRIAL<br />
                        CEP: 01000-000 — SÃO PAULO - {item.emitenteUf}<br />
                        FONE: (11) 3456-7890
                      </p>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-slate-300 text-[8px] font-bold text-slate-700 uppercase">
                      Documento Auxiliar da Nota Fiscal Eletrônica
                    </div>
                  </div>

                  <div className="col-span-6 sm:col-span-2 p-2 border-r border-slate-900 text-center flex flex-col justify-between bg-slate-100/80 text-slate-900">
                    <div>
                      <strong className="text-base font-black block tracking-widest text-slate-900">DANFE</strong>
                      <span className="text-[8px] text-slate-700 block font-bold leading-tight mt-0.5">DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA</span>
                    </div>
                    
                    <div className="my-1 border border-slate-900 p-1 rounded inline-block mx-auto text-left bg-white">
                      <div className="text-[7px] font-bold text-slate-800">0 - ENTRADA</div>
                      <div className="text-[7px] font-bold text-slate-800">1 - SAÍDA</div>
                      <div className="text-xs font-black text-center mt-0.5 bg-slate-900 text-white rounded px-1">1</div>
                    </div>

                    <div className="text-[8px] text-slate-900 leading-tight">
                      <strong className="text-[10px] text-slate-900">Nº {item.numero}</strong><br />
                      <span className="font-bold">SÉRIE {item.serie}</span><br />
                      <span>FOLHA 1 / 1</span>
                    </div>
                  </div>

                  <div className="col-span-6 sm:col-span-5 p-2 flex flex-col justify-between bg-white text-slate-900">
                    <div className="bg-white h-9 w-full border border-slate-900 flex items-center justify-center p-0.5">
                      <svg className="w-full h-full" viewBox="0 0 300 36" preserveAspectRatio="none">
                        <rect x="0" y="0" width="300" height="36" fill="#ffffff" />
                        <path d="M4 0v36M7 0v36M10 0v36M15 0v36M18 0v36M22 0v36M27 0v36M30 0v36M34 0v36M39 0v36M43 0v36M47 0v36M52 0v36M57 0v36M61 0v36M65 0v36M70 0v36M74 0v36M78 0v36M83 0v36M87 0v36M91 0v36M95 0v36M100 0v36M104 0v36M108 0v36M113 0v36M118 0v36M122 0v36M126 0v36M131 0v36M135 0v36M139 0v36M144 0v36M148 0v36M152 0v36M157 0v36M162 0v36M166 0v36M170 0v36M175 0v36M179 0v36M183 0v36M188 0v36M192 0v36M196 0v36M201 0v36M205 0v36M209 0v36M214 0v36M218 0v36M222 0v36M227 0v36M231 0v36M235 0v36M240 0v36M244 0v36M248 0v36M253 0v36M258 0v36M262 0v36M266 0v36M271 0v36M275 0v36M279 0v36M284 0v36M288 0v36M292 0v36" stroke="#000000" strokeWidth="2" />
                      </svg>
                    </div>

                    <div className="border border-slate-900 p-1 rounded mt-1 bg-white">
                      <div className="text-[7px] font-bold text-slate-700 uppercase">Chave de Acesso da NF-e</div>
                      <div className="text-[9.5px] font-mono font-black text-slate-900 tracking-wider">
                        {formatChave44(item.chaveAcesso)}
                      </div>
                    </div>

                    <div className="text-[7.5px] text-slate-700 mt-1 leading-tight">
                      Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br
                    </div>
                  </div>
                </div>

                {/* NATUREZA DA OPERAÇÃO & PROTOCOLO */}
                <div className="grid grid-cols-12 border-x border-b border-slate-900 rounded-b bg-white text-slate-900 -mt-2.5">
                  <div className="col-span-7 p-1.5 border-r border-slate-900 bg-white">
                    <div className="text-[7.5px] text-slate-600 font-bold uppercase">NATUREZA DA OPERAÇÃO</div>
                    <div className="text-[9.5px] font-bold text-slate-900 uppercase">VENDA DE MERCADORIA ADQUIRIDA DE TERCEIROS</div>
                  </div>
                  <div className="col-span-5 p-1.5 bg-white">
                    <div className="text-[7.5px] text-slate-600 font-bold uppercase">PROTOCOLO DE AUTORIZAÇÃO DE USO</div>
                    <div className="text-[9.5px] font-mono font-bold text-slate-900">135260819482710 - {item.dataEmissao}</div>
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
                      <div className="font-bold text-slate-900">{item.destinatarioNome}</div>
                    </div>
                    <div className="col-span-4 p-1.5 border-b border-slate-900 bg-white">
                      <div className="text-[7.5px] text-slate-600 font-bold">CNPJ / CPF</div>
                      <div className="font-mono font-bold text-slate-900">{item.destinatarioCnpj}</div>
                    </div>
                  </div>
                </div>

                {/* CÁLCULO DO IMPOSTO TRADICIONAL */}
                <div className="border border-slate-900 rounded bg-white text-slate-900">
                  <div className="bg-slate-200/90 px-2 py-0.5 text-[8.5px] font-black text-slate-900 uppercase border-b border-slate-900">
                    CÁLCULO DO IMPOSTO (SISTEMA ATUAL)
                  </div>
                  <div className="grid grid-cols-5 text-[8.5px] border-b border-slate-900 text-center bg-white">
                    <div className="p-1 border-r border-slate-900 bg-white">
                      <span className="text-[7px] text-slate-600 block font-bold">BASE DE CÁLCULO DO ICMS</span>
                      <strong className="font-mono text-[9.5px] text-slate-900">{item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1 border-r border-slate-900 bg-white">
                      <span className="text-[7px] text-slate-600 block font-bold">VALOR DO ICMS</span>
                      <strong className="font-mono text-[9.5px] text-blue-900">{item.valorIcms.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1 border-r border-slate-900 bg-white">
                      <span className="text-[7px] text-slate-600 block font-bold">VALOR DO IPI</span>
                      <strong className="font-mono text-[9.5px] text-slate-900">{item.valorIpi.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1 border-r border-slate-900 bg-white">
                      <span className="text-[7px] text-slate-600 block font-bold">PIS / COFINS</span>
                      <strong className="font-mono text-[9.5px] text-slate-900">{(item.valorPis + item.valorCofins).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1 bg-slate-100">
                      <span className="text-[7px] text-slate-800 block font-black">VALOR TOTAL DA NOTA</span>
                      <strong className="font-mono text-[10.5px] text-emerald-950 font-black">{item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                  </div>
                </div>

                {/* DADOS DOS PRODUTOS / SERVIÇOS */}
                <div className="border border-slate-900 rounded bg-white text-slate-900 overflow-hidden">
                  <div className="bg-slate-200/90 px-2 py-0.5 text-[8.5px] font-black text-slate-900 uppercase border-b border-slate-900 flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3 text-slate-700" />
                      DADOS DOS PRODUTOS / SERVIÇOS
                    </span>
                    <span className="text-[7.5px] font-mono text-slate-700 font-bold">{displayItens.length} ITEM(NS) NA NOTA FISCAL</span>
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
                          <th className="p-1 border-r border-slate-300 w-10">QTD</th>
                          <th className="p-1 border-r border-slate-300 w-16">V. UNIT</th>
                          <th className="p-1 border-r border-slate-300 w-16">V. TOTAL</th>
                          <th className="p-1 border-r border-slate-300 w-14">V. ICMS</th>
                          <th className="p-1 border-r border-slate-300 w-14">CBS (~8.8%)</th>
                          <th className="p-1 w-14">IBS (~17.7%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayItens.map((it) => (
                          <tr key={it.numeroItem} className="border-b border-slate-200 text-slate-900 text-center hover:bg-slate-50">
                            <td className="p-1 border-r border-slate-200 font-bold">{it.numeroItem}</td>
                            <td className="p-1 border-r border-slate-200">{it.codigo}</td>
                            <td className="p-1 border-r border-slate-200 text-left font-sans text-[8.5px] font-medium">{it.descricao}</td>
                            <td className="p-1 border-r border-slate-200">{it.ncmCts || '8471.30.12'}</td>
                            <td className="p-1 border-r border-slate-200">{it.cfop || '5102'}</td>
                            <td className="p-1 border-r border-slate-200 font-bold">{it.unidade}</td>
                            <td className="p-1 border-r border-slate-200">{it.quantidade}</td>
                            <td className="p-1 border-r border-slate-200">{it.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="p-1 border-r border-slate-200 font-bold text-slate-950">{it.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="p-1 border-r border-slate-200">{it.valorIcms ? it.valorIcms.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '0,00'}</td>
                            <td className="p-1 border-r border-slate-200 text-blue-900 font-semibold">{(it.valorCbs || it.valorTotal * 0.088).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="p-1 text-indigo-900 font-semibold">{(it.valorIbs || it.valorTotal * 0.177).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* DESTAQUE REFORMA TRIBUTÁRIA (PLP 68/2024 - CBS / IBS) */}
                <div className="border-2 border-blue-600 rounded bg-blue-50/90 p-2 space-y-1 text-slate-900">
                  <div className="flex items-center justify-between border-b border-blue-300 pb-1">
                    <span className="text-[9.5px] font-black text-blue-950 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                      DEMONSTRATIVO DANFE DA REFORMA TRIBUTÁRIA DO CONSUMO (PLP 68/2024 — DUAL TAX)
                    </span>
                    <span className="text-[8px] font-black px-2 py-0.5 rounded bg-blue-200 text-blue-900">
                      Transição CBS/IBS
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[9.5px] text-center pt-1">
                    <div className="p-1.5 rounded bg-white border border-blue-300 shadow-sm">
                      <span className="text-[7.5px] text-slate-700 block font-bold">CBS (Federal {item.aliquotaCbs > 0 ? `~${item.aliquotaCbs}%` : ''})</span>
                      <strong className="font-mono text-blue-950 font-black text-[10.5px]">{item.valorCbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-white border border-blue-300 shadow-sm">
                      <span className="text-[7.5px] text-slate-700 block font-bold">IBS (Estadual/Municipal {item.aliquotaIbs > 0 ? `~${item.aliquotaIbs}%` : ''})</span>
                      <strong className="font-mono text-indigo-950 font-black text-[10.5px]">{item.valorIbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-white border border-blue-300 shadow-sm">
                      <span className="text-[7.5px] text-slate-700 block font-bold">Imposto Seletivo (IS)</span>
                      <strong className="font-mono text-slate-900 font-black text-[10.5px]">{item.valorImpostoSeletivo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              {item.tipo === 'NFSe'
                ? 'Documento validado com Chave NFS-e de 50 posições no Ambiente Dados Nacional (ADN)'
                : 'Documento validado com Chave de 44 dígitos no portal oficial da SEFAZ'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>

    </div>
  );
};
