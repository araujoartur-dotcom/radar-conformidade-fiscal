import React, { useState, useEffect } from 'react';
import { FileCode, AlertTriangle, RefreshCw, Layers, DollarSign, Calculator, ChevronRight, Eye, ShieldAlert, ArrowRight, Send, Printer, Code, FolderArchive, FolderInput, FolderOutput, Settings, DownloadCloud, Server, CreditCard, Receipt, Zap, Search } from 'lucide-react';
import { DfeXmlItem, CertificadoA1, AmbienteSefaz } from '../types';
import { DanfeModal } from './DanfeModal';
import { XmlViewerModal } from './XmlViewerModal';
import { ConsultaNsuModal } from './ConsultaNsuModal';
import { SplitPaymentModal } from './SplitPaymentModal';
import { TurboIngestModal } from './TurboIngestModal';
import { NfseManagerModal } from './NfseManagerModal';
import { formatBrasiliaDate, formatBrasiliaDateTime } from '../utils/timezone';
import { useApi } from '../hooks/useApi';
import { useKpis } from '../contexts/KpiContext';

interface DfeManagerPanelProps {
  dfeList: DfeXmlItem[];
  setDfeList: React.Dispatch<React.SetStateAction<DfeXmlItem[]>>;
  onOpenEvents: (item: DfeXmlItem) => void;
  onSyncErp: (item: DfeXmlItem) => void;
  certificado: CertificadoA1;
  ambienteSefaz: AmbienteSefaz;
}

export const DfeManagerPanel: React.FC<DfeManagerPanelProps> = ({
  dfeList,
  setDfeList,
  onOpenEvents,
  onSyncErp,
  certificado,
  ambienteSefaz
}) => {
  const [selectedDfe, setSelectedDfe] = useState<DfeXmlItem | null>(dfeList[0] || null);
  const [danfeModalItem, setDanfeModalItem] = useState<DfeXmlItem | null>(null);
  const [xmlModalItem, setXmlModalItem] = useState<DfeXmlItem | null>(null);
  const [splitModalDoc, setSplitModalDoc] = useState<DfeXmlItem | null>(null);
  const [isConsultaNsuOpen, setIsConsultaNsuOpen] = useState<boolean>(false);
  const [isTurboModalOpen, setIsTurboModalOpen] = useState<boolean>(false);
  const [isNfseModalOpen, setIsNfseModalOpen] = useState<boolean>(false);
  const [tipoDocFiltro, setTipoDocFiltro] = useState<'TODOS' | 'NFE' | 'CTE' | 'NFSE'>('TODOS');
  const [modalFluxo, setModalFluxo] = useState<'entrada' | 'saida'>('entrada');
  const [listSearch, setListSearch] = useState<string>('');
  const [visibleLimit, setVisibleLimit] = useState<number>(50);

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 80) {
      setVisibleLimit(prev => Math.min(dfeList.length, prev + 50));
    }
  };

  const { get } = useApi();
  const { kpis, totalGeral } = useKpis();
  const currentKpis = totalGeral || kpis;

  const loadDocumentos = async () => {
    const res = await get<{ success: boolean; data: any[]; total?: number }>('/upload/documentos?limit=25000');
    if (res.ok && res.data?.data) {
      const mappedList: DfeXmlItem[] = res.data.data.map(doc => ({
        id: doc.id,
        chaveAcesso: doc.chave_acesso,
        tipo: (doc.tipo_doc as any) || 'NFe',
        numero: (doc.numero_serie || '').split(' / ')[0] || '',
        serie: (doc.numero_serie || '').split(' / ')[1] || '',
        dataEmissao: doc.data_emissao,
        emitenteCnpj: doc.fornecedor_cnpj,
        emitenteNome: doc.fornecedor_razao,
        emitenteUf: doc.fornecedor_uf,
        destinatarioCnpj: doc.cliente_cnpj,
        destinatarioNome: doc.cliente_razao,
        destinatarioUf: doc.cliente_uf,
        valorTotal: doc.valor_total || 0,
        valorIcms: doc.valor_icms || 0,
        valorIpi: doc.valor_ipi || 0,
        valorPis: doc.valor_pis || 0,
        valorCofins: doc.valor_cofins || 0,
        aliquotaCbs: doc.valor_total > 0 && doc.valor_cbs ? Number(((doc.valor_cbs / doc.valor_total) * 100).toFixed(2)) : 0,
        valorCbs: doc.valor_cbs || 0,
        aliquotaIbs: doc.valor_total > 0 && doc.valor_ibs ? Number(((doc.valor_ibs / doc.valor_total) * 100).toFixed(2)) : 0,
        valorIbs: doc.valor_ibs || 0,
        valorImpostoSeletivo: doc.valor_is || 0,
        eventoUltimo: doc.evento_ultimo || 'Autorizado o uso do DF-e',
        situacaoManifestacao: doc.situacao_manifestacao || 'sem_manifestacao',
        alertaFraude: Boolean(doc.alerta_fraude),
        statusAuditoria: doc.alerta_fraude ? 'inconsistente' : 'conforme',
        alertasAuditoria: doc.alerta_fraude ? ['🚨 ALERTA CRÍTICO: Cliente manifestou Desconhecimento da Operação (210220)'] : [],
        statusSincronizacaoErp: 'pendente',
        xmlRaw: doc.xml_raw || '',
        downloadAt: doc.download_at || '',
      }));
      setDfeList(mappedList);
      if (mappedList.length > 0 && !selectedDfe) {
        setSelectedDfe(mappedList[0]);
      }
    }
  };

  useEffect(() => {
    loadDocumentos();
  }, []);

  // Total Metrics Reais da Base (Consolidados via KpiContext - 100% da base 21.000+ XMLs)
  const totalValor = currentKpis?.totalValor ?? 0;
  const totalCbs = currentKpis?.totalCbs ?? 0;
  const totalIbs = currentKpis?.totalIbs ?? 0;
  const totalDocsCount = currentKpis?.totalDocs ?? dfeList.length;

  return (
    <div className="space-y-6">
      {/* Top Controls & Metrics Card */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        {/* Row 1: Actions / Buttons Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/60 border border-blue-700/60 text-blue-300 text-xs font-semibold">
            <Calculator className="w-3.5 h-3.5 text-cyan-400" />
            <span>Captura de XML (NF-e, NFS-e e CT-e)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsTurboModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-orange-500/25 transition-all cursor-pointer border border-amber-300/40 animate-pulse hover:animate-none"
              title="Carga ultrarrápida de pastas inteiras com 20k+ XMLs ou pacotes ZIP"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>🚀 Motor Turbo V12 (Carga 20k+)</span>
            </button>

            <button
              onClick={() => {
                setModalFluxo('entrada');
                setIsConsultaNsuOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-600/30 transition-all cursor-pointer border border-blue-400/30"
            >
              <FolderInput className="w-4 h-4 text-cyan-200" />
              <span>XML Entradas</span>
            </button>

            <button
              onClick={() => {
                setModalFluxo('saida');
                setIsConsultaNsuOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/30 transition-all cursor-pointer border border-emerald-400/30"
            >
              <FolderOutput className="w-4 h-4 text-emerald-200" />
              <span>XML Saídas</span>
            </button>

            <button
              onClick={() => setIsNfseModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-teal-600/25 transition-all cursor-pointer border border-teal-400/30"
              title="Buscar e sincronizar NFS-e no Ambiente de Dados Nacional (ADN / Receita Federal) e Prefeituras"
            >
              <Receipt className="w-4 h-4 text-teal-200" />
              <span>NFS-e (Nacional & Prefeituras)</span>
            </button>
          </div>
        </div>

        {/* Row 2: Metrics / Indicators (Expanded fields, removed 'PROJ.') */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-center">
            <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1">Total DF-e (R$)</div>
            <div className="text-xl lg:text-2xl font-black text-emerald-400 font-mono tracking-tight">
              {totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-center">
            <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1">CBS (Federal)</div>
            <div className="text-xl lg:text-2xl font-black text-cyan-400 font-mono tracking-tight">
              {totalCbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-center">
            <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1">IBS (Est/Mun)</div>
            <div className="text-xl lg:text-2xl font-black text-indigo-400 font-mono tracking-tight">
              {totalIbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: DFe List + Detailed Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: DFe Item List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <FileCode className="w-4 h-4 text-cyan-400" />
              Documentos Importados ({totalDocsCount.toLocaleString('pt-BR')})
            </h3>
            {totalDocsCount > 0 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                Mostrando {Math.min(visibleLimit, dfeList.length).toLocaleString('pt-BR')} de {totalDocsCount.toLocaleString('pt-BR')}
              </span>
            )}
          </div>

          {/* Document Type Filter Pills */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl text-[11px]">
            <button
              onClick={() => setTipoDocFiltro('TODOS')}
              className={`py-1 px-1.5 rounded-lg font-bold transition-all text-center cursor-pointer truncate ${
                tipoDocFiltro === 'TODOS'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos ({dfeList.length})
            </button>

            <button
              onClick={() => setTipoDocFiltro('NFE')}
              className={`py-1 px-1.5 rounded-lg font-bold transition-all text-center cursor-pointer truncate ${
                tipoDocFiltro === 'NFE'
                  ? 'bg-blue-900/60 text-blue-300 border border-blue-700/60 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              NF-e ({dfeList.filter(d => d.tipo === 'NFe' || d.tipo === 'NFCe').length})
            </button>

            <button
              onClick={() => setTipoDocFiltro('CTE')}
              className={`py-1 px-1.5 rounded-lg font-bold transition-all text-center cursor-pointer truncate ${
                tipoDocFiltro === 'CTE'
                  ? 'bg-amber-900/60 text-amber-300 border border-amber-700/60 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              CT-e ({dfeList.filter(d => d.tipo === 'CTe').length})
            </button>

            <button
              onClick={() => setTipoDocFiltro('NFSE')}
              className={`py-1 px-1.5 rounded-lg font-bold transition-all text-center cursor-pointer truncate ${
                tipoDocFiltro === 'NFSE'
                  ? 'bg-teal-900/60 text-teal-300 border border-teal-700/60 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              NFS-e ({dfeList.filter(d => d.tipo === 'NFSe').length})
            </button>
          </div>

          {/* Quick Filter */}
          {dfeList.length > 5 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar por número, prestador, CNPJ, chave..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
              />
            </div>
          )}

          <div 
            onScroll={handleListScroll}
            className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1 select-none"
          >
            {dfeList
              .filter(item => {
                if (tipoDocFiltro === 'NFE' && item.tipo !== 'NFe' && item.tipo !== 'NFCe') return false;
                if (tipoDocFiltro === 'CTE' && item.tipo !== 'CTe') return false;
                if (tipoDocFiltro === 'NFSE' && item.tipo !== 'NFSe') return false;
                if (!listSearch) return true;
                const q = listSearch.toLowerCase();
                return (
                  (item.numero || '').toLowerCase().includes(q) ||
                  (item.chaveAcesso || '').toLowerCase().includes(q) ||
                  (item.emitenteNome || '').toLowerCase().includes(q) ||
                  (item.emitenteCnpj || '').includes(q) ||
                  (item.tipo || '').toLowerCase().includes(q)
                );
              })
              .slice(0, visibleLimit)
              .map((item) => {
                const isSelected = selectedDfe?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedDfe(item)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-950/60 border-blue-500 shadow-md shadow-blue-500/10'
                        : item.alertaFraude
                        ? 'bg-red-950/30 border-red-800/80 hover:bg-red-950/50'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white px-2 py-0.5 rounded bg-blue-900/80 border border-blue-700">
                            {item.tipo} {item.numero}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            Série {item.serie}
                          </span>
                          {item.alertaFraude && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-red-600 text-white shadow-sm animate-pulse flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" />
                              DESCONHECIDA
                            </span>
                          )}
                          {item.situacaoManifestacao === 'confirmada_pelo_destinatario' && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                              Confirmada
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-semibold text-slate-200 truncate max-w-[280px]">
                          {item.emitenteNome}
                        </div>

                        <div className="text-[11px] text-slate-400 font-mono">
                          CNPJ: {item.emitenteCnpj} ({item.emitenteUf})
                        </div>
                      </div>

                      <div className="text-right space-y-1 shrink-0">
                        <div className="text-sm font-bold text-emerald-400 font-mono">
                          {item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <div className="text-xs font-mono text-slate-400">
                          {formatBrasiliaDate(item.dataEmissao)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

            {/* Pagination / Batch Loader */}
            {dfeList.length > visibleLimit && (
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-400 font-mono text-[11px]">
                  Mais documentos disponíveis
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setVisibleLimit(prev => prev + 100)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs"
                  >
                    + 100
                  </button>
                  <button
                    onClick={() => setVisibleLimit(prev => prev + 500)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs"
                  >
                    + 500
                  </button>
                  <button
                    onClick={() => setVisibleLimit(dfeList.length)}
                    className="px-2.5 py-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 hover:bg-cyan-900 font-bold text-xs"
                  >
                    Ver Todos ({dfeList.length.toLocaleString('pt-BR')})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: DFe Detail & Reforma Tributaria Breakdown */}
        <div className="lg:col-span-7">
          {selectedDfe ? (
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6 shadow-lg">
              
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-white">
                      {selectedDfe.tipo} Nº {selectedDfe.numero} - Série {selectedDfe.serie}
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono border border-cyan-800" title={selectedDfe.chaveAcesso}>
                      Chave: {selectedDfe.chaveAcesso.length > 20 ? `${selectedDfe.chaveAcesso.slice(0, 18)}... (${selectedDfe.chaveAcesso.length} pos)` : selectedDfe.chaveAcesso}
                    </span>
                    {selectedDfe.alertaFraude && (
                      <span className="text-xs px-2 py-0.5 rounded bg-red-600 text-white font-bold animate-pulse">
                        🚨 DESCONHECIDA PELO CLIENTE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Emitida em {formatBrasiliaDateTime(selectedDfe.dataEmissao)} | Status SEFAZ: <strong className="text-emerald-400 uppercase">{selectedDfe.eventoUltimo || 'Autorizada'}</strong> | Status ERP: <strong className="text-cyan-400 uppercase">{selectedDfe.statusSincronizacaoErp}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setDanfeModalItem(selectedDfe)}
                    className="px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/30 transition-all cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Visualizar {selectedDfe.tipo === 'CTe' ? 'DACTE' : selectedDfe.tipo === 'NFSe' ? 'DANFSe' : 'DANFE'}
                  </button>
                  <button
                    onClick={() => onOpenEvents(selectedDfe)}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Eventos DF-e
                  </button>
                  <button
                    onClick={() => setXmlModalItem(selectedDfe)}
                    className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
                    title="Visualizar estrutura do XML na íntegra"
                  >
                    <Code className="w-3.5 h-3.5" />
                    XML
                  </button>
                  <button
                    onClick={() => onSyncErp(selectedDfe)}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Sincronizar SAP/ERP
                  </button>
                </div>
              </div>

              {/* Manifestation & Fraud Warning Banner */}
              {selectedDfe.alertaFraude && (
                <div className="p-3.5 rounded-xl bg-red-950/80 border-2 border-red-500 text-xs text-red-200 flex items-center justify-between gap-3 shadow-lg shadow-red-900/20">
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 animate-bounce" />
                    <div>
                      <span className="font-extrabold text-white text-xs block">
                        🚨 ALERTA CRÍTICO: CLIENTE MANIFESTOU DESCONHECIMENTO DA OPERAÇÃO (210220)
                      </span>
                      <span className="text-[11px] text-red-200">
                        O destinatário declarou expressamente na SEFAZ que não solicitou nem recebeu esta nota fiscal. Risco imediato de autuação e glosa de créditos na apuração assistida.
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-red-600 text-white font-mono text-[10px] font-bold shrink-0">
                    FRAUDE / BLOQUEIO
                  </span>
                </div>
              )}

              {/* Parties Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                    Emitente
                  </div>
                  <div className="text-sm font-bold text-white">
                    {selectedDfe.emitenteNome}
                  </div>
                  <div className="text-xs text-slate-300 font-mono">
                    CNPJ: {selectedDfe.emitenteCnpj}
                  </div>
                  <div className="text-xs text-slate-400">
                    UF: <strong>{selectedDfe.emitenteUf}</strong> | IE: <strong>{selectedDfe.emitenteIe || 'Não Informada'}</strong>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                    Destinatário
                  </div>
                  <div className="text-sm font-bold text-white">
                    {selectedDfe.destinatarioNome}
                  </div>
                  <div className="text-xs text-slate-300 font-mono">
                    CNPJ: {selectedDfe.destinatarioCnpj}
                  </div>
                  <div className="text-xs text-slate-400">
                    UF: <strong>{selectedDfe.destinatarioUf}</strong> | IE: <strong>{selectedDfe.destinatarioIe || 'ISENTO'}</strong>
                  </div>
                </div>
              </div>

              {/* Tax Matrix: Impostos Atuais vs Reforma Tributária */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-cyan-400" />
                  Demonstrativo Fiscal Dual (Sistema Atual x Reforma Tributária)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Current Tax Regime */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-1 flex justify-between">
                      <span>Impostos Atuais (ICMS/PIS/COFINS/IPI)</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-300">
                        <span>ICMS Destacado:</span>
                        <strong className="font-mono text-emerald-400">
                          {selectedDfe.valorIcms.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>IPI Destacado:</span>
                        <strong className="font-mono text-amber-400">
                          {selectedDfe.valorIpi.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>PIS / COFINS:</span>
                        <strong className="font-mono text-slate-300">
                          {(selectedDfe.valorPis + selectedDfe.valorCofins).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Reforma Tributaria (CBS / IBS) */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-950/60 to-indigo-950/60 border border-cyan-800/60 space-y-2">
                    <div className="text-xs font-bold text-cyan-300 border-b border-cyan-800/60 pb-1 flex justify-between">
                      <span>Novo Modelo (PLP 68/2024 - CBS / IBS)</span>
                      <span className="text-[10px] text-cyan-400 font-semibold">Dual Tax</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-200">
                        <span>CBS (Federal ~{selectedDfe.aliquotaCbs}%):</span>
                        <strong className="font-mono text-cyan-400">
                          {selectedDfe.valorCbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                      </div>
                      <div className="flex justify-between text-slate-200">
                        <span>IBS (Est/Mun ~{selectedDfe.aliquotaIbs}%):</span>
                        <strong className="font-mono text-indigo-400">
                          {selectedDfe.valorIbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                      </div>
                      <div className="flex justify-between text-slate-200">
                        <span>Imposto Seletivo (IS):</span>
                        <strong className="font-mono text-slate-300">
                          {selectedDfe.valorImpostoSeletivo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSplitModalDoc(selectedDfe)}
                      className="w-full mt-2 py-2 px-3 bg-gradient-to-r from-cyan-950/80 to-blue-950/80 hover:from-cyan-900 hover:to-blue-900 border border-cyan-700/60 rounded-xl text-cyan-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Simular Split Payment (LC 214/2025)</span>
                    </button>
                  </div>

                </div>
              </div>

              {/* Withholding Taxes (NFS-e Retenções na Fonte & Fundamentação Legal) */}
              {(selectedDfe.tipo === 'NFSe' || (selectedDfe.valorInssRetido || 0) > 0 || (selectedDfe.valorIrrf || 0) > 0 || (selectedDfe.valorCsllRetido || 0) > 0 || (selectedDfe.valorIssRetido || 0) > 0) && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-amber-300 border-b border-slate-800 pb-1.5 flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-amber-400" />
                      Retenções na Fonte de Serviços (NFS-e) & Fundamentações Legais
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Cód. Serviço: {selectedDfe.codigoServico || '17.05'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">INSS Retido (11%):</span>
                      <strong className="text-amber-400 font-mono text-sm block">
                        {(selectedDfe.valorInssRetido || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                      <span className="text-[9px] text-slate-500">Art. 31 Lei 8.212/91</span>
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">IRRF Retido:</span>
                      <strong className="text-blue-400 font-mono text-sm block">
                        {(selectedDfe.valorIrrf || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                      <span className="text-[9px] text-slate-500">Art. 714 RIR/2018</span>
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">CSLL / CRF Retida:</span>
                      <strong className="text-cyan-400 font-mono text-sm block">
                        {(selectedDfe.valorCsllRetido || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                      <span className="text-[9px] text-slate-500">Art. 30 Lei 10.833/03</span>
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">ISS Retido ({selectedDfe.aliquotaIss || 5}%):</span>
                      <strong className="text-emerald-400 font-mono text-sm block">
                        {(selectedDfe.valorIssRetido || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                      <span className="text-[9px] text-slate-500">Art. 3º LC 116/03</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Audit Alerts */}
              {selectedDfe.alertasAuditoria.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/60 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <ShieldAlert className="w-4 h-4" />
                    Apontamentos da Auditoria Fiscal Automatizada
                  </div>
                  <ul className="text-xs text-amber-200 space-y-1 list-disc list-inside">
                    {selectedDfe.alertasAuditoria.map((alerta, idx) => (
                      <li key={idx}>{alerta}</li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          ) : (
            <div className="p-12 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 space-y-2">
              <FileCode className="w-10 h-10 mx-auto text-slate-600" />
              <p>Selecione um documento fiscal da lista para visualizar os detalhes completos.</p>
            </div>
          )}
        </div>

      </div>

      {/* DANFE Graphic Viewer Modal */}
      <DanfeModal
        item={danfeModalItem}
        onClose={() => setDanfeModalItem(null)}
      />

      {/* XML Raw Viewer Modal */}
      <XmlViewerModal
        item={xmlModalItem}
        onClose={() => setXmlModalItem(null)}
      />

      {/* Split Payment Simulator Modal (LC 214/2025) */}
      <SplitPaymentModal
        isOpen={!!splitModalDoc}
        onClose={() => setSplitModalDoc(null)}
        documento={splitModalDoc}
      />

      {/* SEFAZ NSU Destination & Issued Search Modal */}
      <ConsultaNsuModal
        isOpen={isConsultaNsuOpen}
        onClose={() => setIsConsultaNsuOpen(false)}
        certificado={certificado}
        ambienteSefaz={ambienteSefaz}
        defaultFluxo={modalFluxo}
        onImportDfeItems={(newItems) => {
          setDfeList(prev => [...newItems, ...prev]);
          if (newItems.length > 0) {
            setSelectedDfe(newItems[0]);
          }
        }}
      />

      {/* Motor Turbo V12 Mass Ingestion Modal (20k+) */}
      <TurboIngestModal
        isOpen={isTurboModalOpen}
        onClose={() => setIsTurboModalOpen(false)}
        onSuccess={() => {
          loadDocumentos();
        }}
      />

      {/* NFS-e Manager Modal (ADN Nacional & Prefeituras) */}
      <NfseManagerModal
        isOpen={isNfseModalOpen}
        onClose={() => setIsNfseModalOpen(false)}
        ambienteSefaz={ambienteSefaz}
        onSuccessSync={() => {
          loadDocumentos();
        }}
      />
    </div>
  );
};
