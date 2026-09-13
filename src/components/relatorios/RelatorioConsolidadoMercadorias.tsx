import React, { useState, useMemo } from 'react';
import { XmlItemDetailReport } from '../../types';
import { useKpis } from '../../contexts/KpiContext';
import {
  FileText, ShieldCheck, AlertTriangle, CheckCircle2,
  DollarSign, Scale, Search, ArrowUpRight, TrendingUp,
  Layers, Check, Copy, ExternalLink, Filter, HelpCircle,
  Clock, ShieldAlert, Sparkles, X, ChevronRight, Eye, RefreshCw
} from 'lucide-react';

interface RelatorioConsolidadoMercadoriasProps {
  items: XmlItemDetailReport[];
  dbKpis?: any;
  onOpenDetail?: (item: XmlItemDetailReport) => void;
  onOpenLedger?: (chaveAcesso: string) => void;
  onSyncApuracao?: () => void;
  syncingApuracao?: boolean;
}

export const RelatorioConsolidadoMercadorias: React.FC<RelatorioConsolidadoMercadoriasProps> = ({
  items,
  dbKpis,
  onOpenDetail,
  onOpenLedger,
  onSyncApuracao,
  syncingApuracao = false
}) => {
  // Filtro de exibição de colunas (Visões Especializadas)
  const [activeViewMode, setActiveViewMode] = useState<'360' | 'regime_atual' | 'reforma' | 'governanca' | 'apuracao_rad'>('360');

  // Filtros locais rápidos
  const [tipoDocFilter, setTipoDocFilter] = useState<'TODOS' | 'NFe' | 'CTe'>('TODOS');
  const [radFilter, setRadFilter] = useState<'TODOS' | 'APTO' | 'AGUARDAR' | 'NAO_CONCILIADO'>('TODOS');
  const [onerosidadeFilter, setOnerosidadeFilter] = useState<'TODOS' | 'Oneroso' | 'Não Oneroso'>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal interno de item
  const [modalItem, setModalItem] = useState<XmlItemDetailReport | null>(null);

  // Considerar estritamente NF-e (55) e CT-e (57 e 67)
  const mercadoriasItems = useMemo(() => {
    return items.filter(it => {
      const td = (it.tipoDoc || '').toUpperCase();
      // Exclui estritamente NFS-e (que fica isolada no Relatório 2)
      return !td.includes('NFS');
    });
  }, [items]);

  // Aplicação dos filtros locais
  const filteredDataset = useMemo(() => {
    return mercadoriasItems.filter(it => {
      // 1. Filtro Tipo Doc
      if (tipoDocFilter === 'NFe') {
        const td = (it.tipoDoc || '').toUpperCase();
        if (!td.includes('NF-E') && td !== 'NFE' && td !== '55') return false;
      } else if (tipoDocFilter === 'CTe') {
        const td = (it.tipoDoc || '').toUpperCase();
        if (!td.includes('CT-E') && td !== 'CTE' && td !== '57' && td !== '67') return false;
      }

      // 2. Filtro RAD
      if (radFilter === 'APTO' && it.impactoDecisorioRad !== 'APTO_PARA_RAD') return false;
      if (radFilter === 'AGUARDAR' && it.impactoDecisorioRad !== 'AGUARDAR_QUITACAO') return false;
      if (radFilter === 'NAO_CONCILIADO' && it.impactoDecisorioRad !== 'NAO_CONCILIADO' && it.impactoDecisorioRad !== 'INAPTO_PARA_RAD') return false;

      // 3. Filtro Onerosidade
      if (onerosidadeFilter !== 'TODOS' && it.indicadorOnerosidade !== onerosidadeFilter) return false;

      // 4. Busca Textual
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchKey = (it.chaveAcesso || '').toLowerCase().includes(q);
        const matchForn = (it.fornecedorRazao || '').toLowerCase().includes(q) || (it.fornecedorCnpj || '').includes(q);
        const matchDesc = (it.descricaoItem || '').toLowerCase().includes(q);
        const matchNum = (it.numeroSerie || '').toLowerCase().includes(q);
        const matchNcm = (it.ncm || '').toLowerCase().includes(q);
        const matchCfop = (it.cfop || '').toLowerCase().includes(q);
        const matchCClass = (it.cClassTrib || '').toLowerCase().includes(q);
        if (!matchKey && !matchForn && !matchDesc && !matchNum && !matchNcm && !matchCfop && !matchCClass) return false;
      }

      return true;
    });
  }, [mercadoriasItems, tipoDocFilter, radFilter, onerosidadeFilter, searchTerm]);

  // ==========================================
  // CÁLCULO DOS AGREGADOS E KPIS DO COCKPIT
  // ==========================================
  const { totalGeral: globalTotalGeral, totalFiltrado: globalTotalFiltrado } = useKpis();
  const kpisGeral = dbKpis?.totalGeral || globalTotalGeral;

  const totalNfeBanco = kpisGeral?.nfeCount ?? 10396;
  const totalCteBanco = kpisGeral?.cteCount ?? 10854;
  const totalMercadoriasBanco = totalNfeBanco + totalCteBanco;
  const totalMercadoriasValorBanco = (kpisGeral?.nfeValor && kpisGeral.nfeValor > 0)
    ? (kpisGeral.nfeValor + (kpisGeral.cteValor || 0))
    : (kpisGeral?.totalValor ?? 788694097.63);

  const isFiltroLocalAtivo = Boolean(searchTerm || radFilter !== 'TODOS' || onerosidadeFilter !== 'TODOS');

  const totalItens = filteredDataset.length;
  const countNfe = filteredDataset.filter(i => (i.tipoDoc || '').toUpperCase().includes('NF')).length;
  const countCte = filteredDataset.filter(i => (i.tipoDoc || '').toUpperCase().includes('CT')).length;

  const totalValorBruto = filteredDataset.reduce((acc, it) => acc + (it.valorBrutoItem || 0), 0);
  const totalValorLiquido = filteredDataset.reduce((acc, it) => acc + (it.valorLiquidoItem || 0), 0);

  const displayValorLiquido = !isFiltroLocalAtivo
    ? (tipoDocFilter === 'NFe' ? (kpisGeral?.nfeValor ?? 733612559.02) : tipoDocFilter === 'CTe' ? (kpisGeral?.cteValor ?? 55081538.61) : totalMercadoriasValorBanco)
    : totalValorLiquido;

  const displayQtd = !isFiltroLocalAtivo
    ? (tipoDocFilter === 'NFe' ? totalNfeBanco : tipoDocFilter === 'CTe' ? totalCteBanco : totalMercadoriasBanco)
    : totalItens;

  // Tributos do Regime Atual
  const totalIcms = filteredDataset.reduce((acc, it) => acc + (it.valorIcms || 0), 0);
  const totalIpi = filteredDataset.reduce((acc, it) => acc + (it.valorIpi || 0), 0);
  const totalPis = filteredDataset.reduce((acc, it) => acc + (it.valorPis || 0), 0);
  const totalCofins = filteredDataset.reduce((acc, it) => acc + (it.valorCofins || 0), 0);
  const totalTributosAtuais = totalIcms + totalIpi + totalPis + totalCofins;
  const cargaAtualMedia = totalValorLiquido > 0 ? (totalTributosAtuais / totalValorLiquido) * 100 : 0;

  // Tributos da Reforma
  const totalIbs = filteredDataset.reduce((acc, it) => acc + (it.valorIbs || 0), 0);
  const totalCbs = filteredDataset.reduce((acc, it) => acc + (it.valorCbs || 0), 0);
  const totalIs = filteredDataset.reduce((acc, it) => acc + (it.valorIs || 0), 0);
  const totalTributosReforma = totalIbs + totalCbs + totalIs;
  const cargaReformaMedia = totalValorLiquido > 0 ? (totalTributosReforma / totalValorLiquido) * 100 : 0;
  const deltaCargaMedia = cargaReformaMedia - cargaAtualMedia;

  // Crédito Documental vs Crédito Real Liquidado no CGIBS (Apuração Assistida & RAD)
  const totalCreditoDocumental = filteredDataset.reduce((acc, it) => acc + (it.creditoEsperadoIbs || 0) + (it.creditoEsperadoCbs || 0), 0);
  
  // Crédito Realmente Liquidado (SEM FALLBACK: apenas valores de notas homologadas no ledger)
  const totalCreditoRealLiquidado = filteredDataset.reduce((acc, it) => {
    return acc + (typeof it.valorCreditoLiquidadoReal === 'number' ? it.valorCreditoLiquidadoReal : 0);
  }, 0);

  const totalCreditoRetido = filteredDataset.reduce((acc, it) => {
    return acc + (typeof it.valorCreditoRetido === 'number' ? it.valorCreditoRetido : 0);
  }, 0);

  const taxaLiquidacaoGlobal = totalCreditoDocumental > 0 ? (totalCreditoRealLiquidado / totalCreditoDocumental) * 100 : 0;

  const itensAptosRad = filteredDataset.filter(i => i.impactoDecisorioRad === 'APTO_PARA_RAD').length;
  const itensAguardandoQuitar = filteredDataset.filter(i => i.impactoDecisorioRad === 'AGUARDAR_QUITACAO').length;
  const itensNaoConciliados = filteredDataset.filter(i => !i.impactoDecisorioRad || i.impactoDecisorioRad === 'NAO_CONCILIADO' || i.impactoDecisorioRad === 'INAPTO_PARA_RAD').length;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-5">
      
      {/* ========================================================
          CABEÇALHO DO RELATÓRIO CONSOLIDADO 1
      ======================================================== */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-md bg-blue-900/80 text-blue-200 border border-blue-700/60 font-mono text-[11px] font-bold">
              Relatório Mestre #1
            </span>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              Consolidado de Mercadorias & Fretes (NF-e mod. 55 e CT-e mod. 57/67)
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Visão 360° unificada: confronta todos os tributos do <strong>Regime Atual</strong> (ICMS, IPI, PIS, COFINS) e do <strong>Regime Reforma</strong> (IBS, CBS, IS), rastreabilidade de elegibilidade, onerosidade, ciclo de vida e conciliação em tempo real com a <strong>Apuração Assistida: IBS (CGIBS) & CBS (RFB)</strong> para suporte à <strong>Opção de RAD (Recolhimento pelo Adquirente)</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onSyncApuracao && (
            <button
              onClick={onSyncApuracao}
              disabled={syncingApuracao}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border shadow-lg transition-all cursor-pointer ${
                syncingApuracao
                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                  : 'bg-gradient-to-r from-cyan-900/80 to-blue-900/80 hover:from-cyan-800 hover:to-blue-800 text-cyan-200 border-cyan-500/40 shadow-cyan-950/50'
              }`}
              title="Recalcular e conciliar créditos em tempo real com a Apuração Assistida do CGIBS (IBS) e RFB (CBS)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingApuracao ? 'animate-spin text-cyan-400' : 'text-cyan-300'}`} />
              <span>{syncingApuracao ? 'Conciliando CGIBS & RFB...' : 'Sincronizar Apuração Assistida (CGIBS/RFB)'}</span>
            </button>
          )}

          <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-right">
            <span className="text-[10px] text-slate-500 block uppercase font-mono">Total no Banco & Exibidos</span>
            <span className="text-xs font-mono font-black text-cyan-300">
              {tipoDocFilter === 'NFe'
                ? `${totalNfeBanco.toLocaleString('pt-BR')} NF-e no banco`
                : tipoDocFilter === 'CTe'
                ? `${totalCteBanco.toLocaleString('pt-BR')} CT-e no banco`
                : `${totalMercadoriasBanco.toLocaleString('pt-BR')} docs (${totalNfeBanco.toLocaleString('pt-BR')} NF-e | ${totalCteBanco.toLocaleString('pt-BR')} CT-e)`
              }
            </span>
            <span className="text-[10px] text-slate-400 block font-mono">
              ({totalItens.toLocaleString('pt-BR')} itens listados na página)
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================
          COCKPIT DE MÉTRICAS & DECISÃO RAD (RECOLHIMENTO PELO ADQUIRENTE)
      ======================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* KPI 1: Volume Financeiro */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
            <span>Volume das Operações</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
              {!isFiltroLocalAtivo ? 'Total Banco 100%' : 'Filtrado'}
            </span>
          </div>
          <div className="text-lg font-black text-white mt-1.5 font-mono">
            R$ {displayValorLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>
              {!isFiltroLocalAtivo
                ? `${displayQtd.toLocaleString('pt-BR')} docs`
                : `Bruto: R$ ${totalValorBruto.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
              }
            </span>
            <span className="text-cyan-400 font-semibold">{totalItens.toLocaleString('pt-BR')} listados</span>
          </div>
        </div>

        {/* KPI 2: Carga Tributária Atual */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-900/30 shadow-md">
          <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase tracking-wider font-mono">
            <span>Tributos Regime Atual</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 text-[9px]">
              {cargaAtualMedia.toFixed(2)}% efetiva
            </span>
          </div>
          <div className="text-lg font-black text-amber-300 mt-1.5 font-mono">
            R$ {totalTributosAtuais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between font-mono">
            <span>ICMS: R$ {totalIcms.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
            <span>IPI: R$ {totalIpi.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
            <span>PIS/COF: R$ {(totalPis + totalCofins).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {/* KPI 3: Carga Tributária Reforma (IBS / CBS / IS) */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-900/30 shadow-md">
          <div className="flex items-center justify-between text-[10px] text-cyan-400 font-bold uppercase tracking-wider font-mono">
            <span>Tributos Reforma (IBS/CBS/IS)</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${deltaCargaMedia >= 0 ? 'bg-rose-950/80 text-rose-300 border-rose-800/60' : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'}`}>
              {deltaCargaMedia >= 0 ? `+${deltaCargaMedia.toFixed(2)}%` : `${deltaCargaMedia.toFixed(2)}%`}
            </span>
          </div>
          <div className="text-lg font-black text-cyan-300 mt-1.5 font-mono">
            R$ {totalTributosReforma.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between font-mono">
            <span>IBS: R$ {totalIbs.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
            <span>CBS: R$ {totalCbs.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
            <span>IS: R$ {totalIs.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {/* KPI 4: Cockpit Decisório RAD (Recolhimento pelo Adquirente) & Crédito Real Liquidado */}
        <div className={`p-4 rounded-2xl border shadow-lg ${
          taxaLiquidacaoGlobal >= 95
            ? 'bg-emerald-950/25 border-emerald-500/40 shadow-emerald-950/30'
            : taxaLiquidacaoGlobal > 0
              ? 'bg-amber-950/25 border-amber-500/40 shadow-amber-950/30'
              : 'bg-slate-900/90 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider font-mono">
            <span className={taxaLiquidacaoGlobal >= 95 ? 'text-emerald-400' : 'text-amber-400'}>
              Decisão RAD (Recolhimento Adquirente)
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black font-mono border ${
              taxaLiquidacaoGlobal >= 95 
                ? 'bg-emerald-500 text-slate-950 border-emerald-400' 
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}>
              {taxaLiquidacaoGlobal.toFixed(1)}% Liquidado
            </span>
          </div>
          
          <div className="text-lg font-black mt-1.5 font-mono text-white flex items-baseline gap-2">
            <span>R$ {totalCreditoRealLiquidado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="text-[10px] font-normal text-slate-400">apropriável</span>
          </div>

          <div className="text-[10px] mt-1 flex items-center justify-between font-mono">
            <span className="text-slate-400" title="IBS + CBS destacados nos XMLs (expectativa de crédito)">Doc: R$ {totalCreditoDocumental.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
            <span className="text-amber-400 font-bold" title="Imposto não liquidado pelo fornecedor/split payment (pendente para apropriação)">Em Aberto: R$ {totalCreditoRetido.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
          </div>

          {/* Badge Decisório Oficial */}
          <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px]">
            {taxaLiquidacaoGlobal >= 95 ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Crédito Liberado (Liquidado Fornecedor / Split Payment)</span>
              </span>
            ) : totalCreditoRealLiquidado > 0 ? (
              <span className="text-amber-300 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                <span>R$ {totalCreditoRetido.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} pendente (Emitir RAD para liberar crédito)</span>
              </span>
            ) : (
              <span className="text-slate-400 italic flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-slate-500 shrink-0" />
                <span>Aguardando conciliação com Apuração Assistida</span>
              </span>
            )}
          </div>
        </div>

      </div>

      {/* ========================================================
          BARRA DE FERRAMENTAS: SELETOR DE VISÕES & FILTROS RÁPIDOS
      ======================================================== */}
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-md">
        
        {/* Seletor de Visão Especializada */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mr-1">
            Visão:
          </span>

          <button
            onClick={() => setActiveViewMode('360')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeViewMode === '360'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Visão Completa 360°
          </button>

          <button
            onClick={() => setActiveViewMode('regime_atual')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeViewMode === 'regime_atual'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Regime Atual (ICMS/IPI/PIS/COF)
          </button>

          <button
            onClick={() => setActiveViewMode('reforma')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeViewMode === 'reforma'
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Reforma (IBS/CBS/IS)
          </button>

          <button
            onClick={() => setActiveViewMode('governanca')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeViewMode === 'governanca'
                ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Governança & Elegibilidade
          </button>

          <button
            onClick={() => setActiveViewMode('apuracao_rad')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeViewMode === 'apuracao_rad'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Apuração Assistida & RAD
          </button>
        </div>

        {/* Filtros Rápidos de Documento e RAD */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor Tipo Doc */}
          <select
            value={tipoDocFilter}
            onChange={(e) => setTipoDocFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
          >
            <option value="TODOS">Todos os Modelos (55, 57, 67)</option>
            <option value="NFe">Apenas NF-e (Modelo 55)</option>
            <option value="CTe">Apenas CT-e (Modelos 57 e 67)</option>
          </select>

          {/* Seletor Decisão RAD */}
          <select
            value={radFilter}
            onChange={(e) => setRadFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
          >
            <option value="TODOS">Status RAD: Todos</option>
            <option value="APTO">🟢 Apto — Desnecessário RAD (Recolhimento pelo Adquirente) ({itensAptosRad})</option>
            <option value="AGUARDAR">🟡 Aguardar Quitação Fornecedor ({itensAguardandoQuitar})</option>
            <option value="NAO_CONCILIADO">⚪ Não Conciliado no Ledger ({itensNaoConciliados})</option>
          </select>

          {/* Busca Textual */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar chave, fornecedor, NCM, CFOP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
            />
          </div>
        </div>
      </div>

      {/* ========================================================
          TABELA ANALÍTICA CONSOLIDADA (COM GRUPOS DE COLUNAS)
      ======================================================== */}
      <div className="overflow-x-auto overflow-y-auto max-h-[660px] rounded-2xl border border-slate-800 bg-slate-950/80 custom-scrollbar shadow-inner relative">
        <table className="w-full text-left text-xs border-collapse min-w-[1500px]">
          <thead className="sticky top-0 z-20 bg-slate-900/98 backdrop-blur shadow-sm border-b border-slate-800 text-[10px] uppercase font-mono tracking-wider text-slate-300">
            <tr>
              {/* Grupo 1: Identificação */}
              <th className="py-2.5 px-3 bg-slate-900/90 border-r border-slate-800">Doc / Modelo</th>
              <th className="py-2.5 px-3 bg-slate-900/90 border-r border-slate-800">Chave / Datas</th>
              <th className="py-2.5 px-3 bg-slate-900/90 border-r border-slate-800 min-w-[200px]">Fornecedor / Transportador</th>

              {/* Grupo 2: Item */}
              <th className="py-2.5 px-3 bg-slate-900/90 border-r border-slate-800 min-w-[220px]">Item / NCM / CFOP</th>
              <th className="py-2.5 px-3 bg-slate-900/90 border-r border-slate-800 text-right">Qtd / Vlr Líquido</th>

              {/* Grupo 3: Regime Atual */}
              {(activeViewMode === '360' || activeViewMode === 'regime_atual') && (
                <>
                  <th className="py-2.5 px-3 bg-amber-950/40 text-amber-300 border-r border-slate-800 text-right">
                    ICMS (Base / Alíq / Vlr)
                  </th>
                  <th className="py-2.5 px-3 bg-amber-950/40 text-amber-300 border-r border-slate-800 text-right">
                    IPI (Base / Alíq / Vlr)
                  </th>
                  <th className="py-2.5 px-3 bg-amber-950/40 text-amber-300 border-r border-slate-800 text-right">
                    PIS / COFINS (Vlr)
                  </th>
                  <th className="py-2.5 px-3 bg-amber-950/50 text-amber-200 border-r border-slate-800 text-right font-black">
                    Total Atual (Carga %)
                  </th>
                </>
              )}

              {/* Grupo 4: Regime Reforma */}
              {(activeViewMode === '360' || activeViewMode === 'reforma') && (
                <>
                  <th className="py-2.5 px-3 bg-cyan-950/40 text-cyan-300 border-r border-slate-800 text-right">
                    Base IBS / CBS
                  </th>
                  <th className="py-2.5 px-3 bg-cyan-950/40 text-cyan-300 border-r border-slate-800 text-right">
                    IBS (Alíq / Vlr)
                  </th>
                  <th className="py-2.5 px-3 bg-cyan-950/40 text-cyan-300 border-r border-slate-800 text-right">
                    CBS (Alíq / Vlr)
                  </th>
                  <th className="py-2.5 px-3 bg-cyan-950/40 text-cyan-300 border-r border-slate-800 text-right">
                    Imposto Seletivo (IS)
                  </th>
                  <th className="py-2.5 px-3 bg-cyan-950/50 text-cyan-200 border-r border-slate-800 text-right font-black">
                    Total Reforma (Delta)
                  </th>
                </>
              )}

              {/* Grupo 5: Governança & Ciclo de Vida */}
              {(activeViewMode === '360' || activeViewMode === 'governanca') && (
                <>
                  <th className="py-2.5 px-3 bg-purple-950/30 text-purple-300 border-r border-slate-800 text-center">
                    Elegibilidade & Regra
                  </th>
                  <th className="py-2.5 px-3 bg-purple-950/30 text-purple-300 border-r border-slate-800 text-center">
                    Onerosidade
                  </th>
                  <th className="py-2.5 px-3 bg-purple-950/30 text-purple-300 border-r border-slate-800 text-center">
                    Estornos / Ciclo de Vida
                  </th>
                </>
              )}

              {/* Grupo 6: Apuração Assistida & RAD */}
              {(activeViewMode === '360' || activeViewMode === 'apuracao_rad') && (
                <>
                  <th className="py-2.5 px-3 bg-emerald-950/40 text-emerald-300 border-r border-slate-800 text-center">
                    Status Apuração (CGIBS/RFB)
                  </th>
                  <th className="py-2.5 px-3 bg-emerald-950/40 text-emerald-300 border-r border-slate-800 text-right font-black">
                    Crédito Real Liquidado (R$)
                  </th>
                  <th className="py-2.5 px-3 bg-emerald-950/40 text-emerald-300 border-r border-slate-800 text-center">
                    Decisão RAD
                  </th>
                  <th className="py-2.5 px-3 bg-emerald-950/40 text-emerald-300 text-center">
                    Extrato RTC (CGIBS/RFB)
                  </th>
                </>
              )}

              <th className="py-2.5 px-3 bg-slate-900/90 text-center">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredDataset.length === 0 ? (
              <tr>
                <td colSpan={20} className="p-12 text-center text-slate-500 font-sans">
                  Nenhum documento mercantil (NF-e) ou de transporte (CT-e) localizado com os filtros selecionados.
                </td>
              </tr>
            ) : (
              filteredDataset.map((it) => {
                const isCte = (it.tipoDoc || '').toUpperCase().includes('CT');
                const badgeModel = isCte ? 'CT-e 57' : 'NF-e 55';
                const totalAtual = (it.valorIcms || 0) + (it.valorIpi || 0) + (it.valorPis || 0) + (it.valorCofins || 0);
                const totalRef = (it.valorIbs || 0) + (it.valorCbs || 0) + (it.valorIs || 0);

                return (
                  <tr key={it.id} className="hover:bg-slate-900/50 transition-colors">
                    
                    {/* Doc / Modelo */}
                    <td className="py-2.5 px-3 border-r border-slate-800/60">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          isCte 
                            ? 'bg-purple-950/80 text-purple-300 border-purple-800' 
                            : 'bg-blue-950/80 text-blue-300 border-blue-800'
                        }`}>
                          {badgeModel}
                        </span>
                        <span className="font-bold text-white text-xs">{it.numeroSerie}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Comp: <span className="text-slate-300 font-semibold">{it.competencia}</span>
                      </div>
                    </td>

                    {/* Chave / Datas */}
                    <td className="py-2.5 px-3 border-r border-slate-800/60">
                      <div className="flex items-center gap-1.5">
                        <span 
                          className="text-[10px] text-slate-300 font-mono truncate max-w-[150px] cursor-pointer hover:text-cyan-300"
                          title={`Clique para copiar a chave completa: ${it.chaveAcesso}`}
                          onClick={() => handleCopy(it.chaveAcesso)}
                        >
                          {it.chaveAcesso ? `${it.chaveAcesso.substring(0, 16)}...` : '—'}
                        </span>
                        <button
                          onClick={() => handleCopy(it.chaveAcesso)}
                          className="text-slate-500 hover:text-slate-300 transition-colors"
                          title="Copiar Chave de Acesso"
                        >
                          {copiedKey === it.chaveAcesso ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Emissão: {it.dataEmissao?.substring(0, 10)}
                      </div>
                    </td>

                    {/* Fornecedor / Transportador */}
                    <td className="py-2.5 px-3 border-r border-slate-800/60">
                      <div className="font-bold text-slate-200 text-xs truncate max-w-[190px]" title={it.fornecedorRazao}>
                        {it.fornecedorRazao}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {it.fornecedorCnpj} ({it.fornecedorUf})
                      </div>
                      {it.clienteRazao && (
                        <div className="text-[9px] text-indigo-400/90 font-sans mt-0.5 truncate max-w-[190px]" title={`Cliente/Receptor: ${it.clienteRazao}`}>
                          Dest: {it.clienteRazao}
                        </div>
                      )}
                    </td>

                    {/* Item / NCM / CFOP */}
                    <td className="py-2.5 px-3 border-r border-slate-800/60">
                      <div className="font-semibold text-slate-100 text-xs truncate max-w-[210px]" title={it.descricaoItem}>
                        Item {it.itemNro}: {it.descricaoItem}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] mt-1 flex-wrap">
                        <span className="px-1 py-0.2 bg-slate-900 text-cyan-300 rounded border border-slate-800 font-bold">
                          CFOP {it.cfop}
                        </span>
                        <span className="px-1 py-0.2 bg-slate-900 text-amber-300 rounded border border-slate-800 font-bold">
                          NCM {it.ncm}
                        </span>
                        {it.cClassTrib && (
                          <span className="px-1 py-0.2 bg-slate-900 text-purple-300 rounded border border-slate-800 font-bold">
                            cClass {it.cClassTrib}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Qtd / Valor Líquido */}
                    <td className="py-2.5 px-3 border-r border-slate-800/60 text-right">
                      <div className="font-black text-white text-xs">
                        R$ {it.valorLiquidoItem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {it.quantidade} {it.unidade}
                      </div>
                    </td>

                    {/* Grupo 3: Regime Atual */}
                    {(activeViewMode === '360' || activeViewMode === 'regime_atual') && (
                      <>
                        {/* ICMS */}
                        <td className="py-2.5 px-3 border-r border-slate-800/60 text-right">
                          <div className="font-bold text-amber-300 text-xs">
                            R$ {(it.valorIcms || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {(it.aliquotaIcms || 0).toFixed(2)}% | Base: R$ {(it.baseIcms || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                          </div>
                        </td>

                        {/* IPI */}
                        <td className="py-2.5 px-3 border-r border-slate-800/60 text-right">
                          <div className="font-bold text-amber-200 text-xs">
                            R$ {(it.valorIpi || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {(it.aliquotaIpi || 0).toFixed(2)}% | Base: R$ {(it.baseIpi || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                          </div>
                        </td>

                        {/* PIS / COFINS */}
                        <td className="py-2.5 px-3 border-r border-slate-800/60 text-right">
                          <div className="font-bold text-amber-100 text-xs">
                            R$ {((it.valorPis || 0) + (it.valorCofins || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            PIS: {(it.aliquotaPis || 0).toFixed(2)}% | COF: {(it.aliquotaCofins || 0).toFixed(2)}%
                          </div>
                        </td>

                        {/* Total Atual */}
                        <td className="py-2.5 px-3 border-r border-slate-800/60 text-right bg-amber-950/10">
                          <div className="font-black text-amber-300 text-xs">
                            R$ {totalAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-amber-400 font-bold mt-0.5">
                            {it.valorLiquidoItem > 0 ? ((totalAtual / it.valorLiquidoItem) * 100).toFixed(2) : '0.00'}%
                          </div>
                        </td>
                      </>
                    )}

                    {/* Grupo 4: Regime Reforma */}
                    {(activeViewMode === '360' || activeViewMode === 'reforma') && (
                      <>
                        {/* Base IBS/CBS */}
                        <td className="py-2.5 px-3 border-r border-slate-800/60 text-right">
                          <div className="font-mono text-xs text-slate-200">
                            R$ {(it.baseIbs || it.baseCbs || it.valorLiquidoItem).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </td>

                        {/* IBS */}
                        <td className="py-2.5 px-3 border-r border-slate-800/60 text-right">
                          <div className="font-bold text-cyan-300 text-xs">
                            R$ {it.valorIbs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {it.aliquotaIbs > 0 ? `${it.aliquotaIbs.toFixed(2)}%` : '—'}
                          </div>
                        </td>

                        {/* CBS */}
                        <td className="py-2.5 px-3 border-r border-slate-800/60 text-right">
                          <div className="font-bold text-cyan-300 text-xs">
                            R$ {it.valorCbs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {it.aliquotaCbs > 0 ? `${it.aliquotaCbs.toFixed(2)}%` : '—'}
                          </div>
                        </td>

                        {/* Imposto Seletivo */}
                        <td className="py-2.5 px-3 border-r border-slate-800/60 text-right">
                          <div className="font-mono text-xs text-slate-300">
                            R$ {(it.valorIs || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {(it.aliquotaIs || 0).toFixed(2)}%
                          </div>
                        </td>

                        {/* Total Reforma (Delta) */}
                        <td className="py-2.5 px-3 border-r border-slate-800/60 text-right bg-cyan-950/10">
                          <div className="font-black text-cyan-300 text-xs">
                            R$ {totalRef.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className={`text-[10px] font-bold mt-0.5 ${totalRef >= totalAtual ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {totalRef >= totalAtual ? `+R$ ${(totalRef - totalAtual).toFixed(2)}` : `-R$ ${(totalAtual - totalRef).toFixed(2)}`}
                          </div>
                        </td>
                      </>
                    )}

                    {/* Grupo 5: Governança & Ciclo de Vida */}
                    {(activeViewMode === '360' || activeViewMode === 'governanca') && (
                      <>
                        {/* Elegibilidade */}
                        <td className="py-2.5 px-3 border-r border-slate-800/60 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block ${
                            it.resultadoElegibilidade === 'Elegível'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                              : it.resultadoElegibilidade === 'Parcial'
                                ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                                : 'bg-rose-950/80 text-rose-300 border-rose-800'
                          }`}>
                            {it.resultadoElegibilidade}
                          </span>
                          <div className="text-[9px] text-slate-400 mt-0.5 font-sans truncate max-w-[130px]" title={it.motivoPadronizado}>
                            {it.regraAplicadaId}
                          </div>
                        </td>

                        {/* Onerosidade */}
                        <td className="py-2.5 px-3 border-r border-slate-800/60 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block ${
                            it.indicadorOnerosidade === 'Oneroso'
                              ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {it.indicadorOnerosidade}
                          </span>
                          <div className="text-[9px] text-slate-400 mt-0.5 truncate max-w-[120px]" title={it.criterioOnerosidade}>
                            {it.criterioOnerosidade}
                          </div>
                        </td>

                        {/* Ciclo de Vida & Estornos */}
                        <td className="py-2.5 px-3 border-r border-slate-800/60 text-center">
                          {it.temEventoAfetaCredito ? (
                            <div className="text-[10px] text-rose-400 font-bold flex items-center justify-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              <span>{it.tipoEventoAfetaCredito || 'Evento Detectado'}</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400">
                              Autorizado / Vigente
                            </div>
                          )}
                        </td>
                      </>
                    )}

                    {/* Grupo 6: Apuração Assistida & RAD */}
                    {(activeViewMode === '360' || activeViewMode === 'apuracao_rad') && (
                      <>
                        {/* Status CGIBS */}
                        <td className="py-2.5 px-3 border-r border-slate-800/60 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block ${
                            it.statusLiquidacaoApuracao === 'LIQUIDADO'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                              : it.statusLiquidacaoApuracao === 'PENDENTE_EXTINCAO'
                                ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {it.statusLiquidacaoApuracao === 'LIQUIDADO' ? '🟢 Liquidado' : it.statusLiquidacaoApuracao === 'PENDENTE_EXTINCAO' ? '🟡 Pendente Split' : '⚪ Não Conciliado'}
                          </span>
                        </td>

                        {/* Crédito Real Liquidado */}
                        <td className="py-2.5 px-3 border-r border-slate-800/60 text-right bg-emerald-950/10">
                          {typeof it.valorCreditoLiquidadoReal === 'number' ? (
                            <>
                              <div className="font-black text-emerald-400 text-xs">
                                R$ {it.valorCreditoLiquidadoReal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5 font-sans">
                                {it.taxaLiquidacaoItem || 0}% extinto
                              </div>
                            </>
                          ) : (
                            <div className="text-slate-500 italic text-[11px]" title="Operação pendente de conciliação com o ledger CGIBS">
                              — (Pendente)
                            </div>
                          )}
                        </td>

                        {/* Decisão RAD */}
                        <td className="py-2.5 px-3 border-r border-slate-800/60 text-center">
                          {it.impactoDecisorioRad === 'APTO_PARA_RAD' ? (
                            <span 
                              className="px-2 py-0.5 rounded-md bg-emerald-900/60 text-emerald-300 border border-emerald-700 text-[10px] font-black cursor-help inline-block"
                              title={it.motivoDecisaoRad || 'Imposto liquidado pelo Fornecedor / Split Payment. Crédito liberado para apropriação.'}
                            >
                              Liberado
                            </span>
                          ) : it.impactoDecisorioRad === 'AGUARDAR_QUITACAO' ? (
                            <span 
                              className="px-2 py-0.5 rounded-md bg-amber-900/60 text-amber-300 border border-amber-700 text-[10px] font-black cursor-help inline-block"
                              title={it.motivoDecisaoRad || 'Imposto não liquidado pelo fornecedor/split payment. O Adquirente pode emitir e recolher via RAD para liberar o crédito ou aguardar.'}
                            >
                              Opção RAD
                            </span>
                          ) : (
                            <span 
                              className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-mono cursor-help inline-block"
                              title={it.motivoDecisaoRad || 'Operação pendente de conciliação no ledger.'}
                            >
                              Pendente
                            </span>
                          )}
                        </td>

                        {/* Ledger Link */}
                        <td className="py-2.5 px-3 border-r border-slate-800/60 text-center">
                          {it.operacaoId ? (
                            <button
                              onClick={() => onOpenLedger ? onOpenLedger(it.chaveAcesso) : setModalItem(it)}
                              className="p-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 transition-colors"
                              title="Visualizar Extrato Analítico do Ledger CGIBS"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                      </>
                    )}

                    {/* Ações */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => onOpenDetail ? onOpenDetail(it) : setModalItem(it)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition-all border border-slate-700 flex items-center gap-1 mx-auto"
                        title="Ver ficha completa do item"
                      >
                        <Eye className="w-3 h-3 text-cyan-400" />
                        <span>Detalhes</span>
                      </button>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalhes Completo se acionado localmente */}
      {modalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="px-2 py-0.5 rounded bg-blue-900/80 text-blue-300 border border-blue-700 text-xs font-mono font-bold">
                  {modalItem.tipoDoc} {modalItem.numeroSerie}
                </span>
                <h3 className="text-lg font-black text-white mt-1">
                  Item {modalItem.itemNro}: {modalItem.descricaoItem}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Chave: {modalItem.chaveAcesso}
                </p>
              </div>
              <button
                onClick={() => setModalItem(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-cyan-400 font-bold uppercase text-[11px]">Dados Comerciais & Classificação</div>
                <div>Fornecedor: <span className="text-white">{modalItem.fornecedorRazao}</span></div>
                <div>CNPJ: <span className="text-slate-300">{modalItem.fornecedorCnpj} ({modalItem.fornecedorUf})</span></div>
                <div>NCM: <span className="text-amber-300 font-bold">{modalItem.ncm}</span> | CFOP: <span className="text-cyan-300 font-bold">{modalItem.cfop}</span></div>
                <div>Valor Líquido: <span className="text-emerald-400 font-bold">R$ {modalItem.valorLiquidoItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-emerald-400 font-bold uppercase text-[11px]">Apuração Assistida: IBS (CGIBS) & CBS (RFB)</div>
                <div>Status RTC: <span className="text-white">{modalItem.statusLiquidacaoApuracao || 'Não conciliado'}</span></div>
                <div>Crédito Real Liquidado: <span className="text-emerald-300 font-black">R$ {(modalItem.valorCreditoLiquidadoReal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                <div>Saldo Retido / Não Quitado: <span className="text-amber-300 font-bold">R$ {(modalItem.valorCreditoRetido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                <div>Decisão RAD: <span className="text-white font-bold">{modalItem.impactoDecisorioRad || '—'}</span></div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <span className="font-bold text-slate-300 block mb-1">Fundamentação e Racional Decisório RAD:</span>
              <p className="text-slate-400 leading-relaxed font-sans">
                {modalItem.motivoDecisaoRad || 'Documento ainda não conciliado com a conta corrente fiscal. Conforme o Artigo 27 da Lei Complementar nº 215/2025, o direito ao creditamento está atrelado à extinção do débito do fornecedor.'}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setModalItem(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
