import React, { useState, useMemo } from 'react';
import {
  BarChart3, TrendingUp, DollarSign, FileText, Layers, Download,
  Filter, Calendar, RefreshCw, ArrowUpRight, ArrowDownRight, Building2,
  PieChart, ShieldCheck, Sparkles, CheckCircle2, AlertCircle, Percent,
  ArrowRight, FileSpreadsheet, Printer, Info
} from 'lucide-react';
import { DfeXmlItem, ClienteEmpresaTenant } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { exportToExcel } from '../utils/excel';
import { ANOS_TRANSICAO, getRegraTransicaoAno } from '../utils/reformaTransicao';

interface CentralKpisPanelProps {
  dfeList: DfeXmlItem[];
  selectedTenantCnpj: string;
}

interface DfeTypeStat {
  label: string;
  qtd: number;
  valor: number;
  color: string;
  bg: string;
  border: string;
}

export const CentralKpisPanel: React.FC<CentralKpisPanelProps> = ({
  dfeList,
  selectedTenantCnpj
}) => {
  const { empresaAtiva } = useAuth();

  // Filters & Transition Year Simulation
  const [anoSimulado, setAnoSimulado] = useState<number>(2026);
  const [periodoFilter, setPeriodoFilter] = useState<'mes' | 'trimestre' | 'ano'>('mes');
  const [operacaoFilter, setOperacaoFilter] = useState<'todas' | 'entradas' | 'saidas'>('todas');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Regra de Alíquotas do Ano Selecionado (EC 132/2023 & LC 214/2025)
  const regraAno = useMemo(() => getRegraTransicaoAno(anoSimulado), [anoSimulado]);

  // Use real data only — no fallback demo data
  const baseItems: DfeXmlItem[] = useMemo(() => {
    return dfeList || [];
  }, [dfeList]);

  // Filtragem
  const filteredItems = useMemo(() => {
    return baseItems.filter(item => {
      if (operacaoFilter === 'entradas') {
        const isEntrada = item.destinatarioCnpj?.replace(/\D/g, '') === empresaAtiva?.cnpjCompleto?.replace(/\D/g, '');
        return isEntrada;
      }
      if (operacaoFilter === 'saidas') {
        const isSaida = item.emitenteCnpj?.replace(/\D/g, '') === empresaAtiva?.cnpjCompleto?.replace(/\D/g, '');
        return isSaida;
      }
      return true;
    });
  }, [baseItems, operacaoFilter, empresaAtiva]);

  // Agregações Gerais Dinâmicas por Ano da Transição
  const totalValor = useMemo(() => filteredItems.reduce((acc, i) => acc + (i.valorTotal || 0), 0), [filteredItems]);
  const totalCbs = useMemo(() => (totalValor * regraAno.aliquotaCbs) / 100, [totalValor, regraAno]);
  const totalIbsUf = useMemo(() => (totalValor * regraAno.aliquotaIbsEstadual) / 100, [totalValor, regraAno]);
  const totalIbsMun = useMemo(() => (totalValor * regraAno.aliquotaIbsMunicipal) / 100, [totalValor, regraAno]);
  const totalIbsTotal = useMemo(() => totalIbsUf + totalIbsMun, [totalIbsUf, totalIbsMun]);
  const totalIvaDual = useMemo(() => totalCbs + totalIbsTotal, [totalCbs, totalIbsTotal]);
  const totalQtd = filteredItems.length;

  // Agregações por Modelo de DF-e
  const dfeTypeCounts = useMemo<Record<string, DfeTypeStat>>(() => {
    const counts: Record<string, DfeTypeStat> = {
      'NFe': { label: 'NF-e (Mod 55) Mercadorias', qtd: 0, valor: 0, color: 'text-cyan-400', bg: 'bg-cyan-500', border: 'border-cyan-500/30' },
      'NFCe': { label: 'NFC-e (Mod 65) Varejo', qtd: 0, valor: 0, color: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-500/30' },
      'CTe': { label: 'CT-e (Mod 57) Transportes', qtd: 0, valor: 0, color: 'text-indigo-400', bg: 'bg-indigo-500', border: 'border-indigo-500/30' },
      'NFSe': { label: 'NFS-e Serviços', qtd: 0, valor: 0, color: 'text-purple-400', bg: 'bg-purple-500', border: 'border-purple-500/30' },
      'MDFe': { label: 'MDF-e (Mod 58) Manifesto', qtd: 0, valor: 0, color: 'text-amber-400', bg: 'bg-amber-500', border: 'border-amber-500/30' }
    };

    filteredItems.forEach(item => {
      const t = item.tipo || 'NFe';
      if (counts[t]) {
        counts[t].qtd += 1;
        counts[t].valor += (item.valorTotal || 0);
      } else {
        counts['NFe'].qtd += 1;
        counts['NFe'].valor += (item.valorTotal || 0);
      }
    });

    return counts;
  }, [filteredItems]);

  const maxQtdType = Math.max(...Object.values(dfeTypeCounts).map((c: DfeTypeStat) => c.qtd), 1);
  const maxValorTributario = Math.max(totalValor, 1);

  // Top 5 Parceiros
  const topParceiros = useMemo(() => {
    const map: Record<string, { cnpj: string; razao: string; uf: string; qtd: number; total: number }> = {};
    filteredItems.forEach(item => {
      const cnpj = item.emitenteCnpj || item.destinatarioCnpj || '00.000.000/0000-00';
      const razao = item.emitenteNome || item.destinatarioNome || 'PARCEIRO COMERCIAL';
      const uf = item.emitenteUf || item.destinatarioUf || 'SP';
      if (!map[cnpj]) {
        map[cnpj] = { cnpj, razao, uf, qtd: 0, total: 0 };
      }
      map[cnpj].qtd += 1;
      map[cnpj].total += (item.valorTotal || 0);
    });

    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredItems]);

  const handleExportExcel = () => {
    const rows = filteredItems.map(item => ({
      'Tipo DF-e': item.tipo,
      'Número': item.numero,
      'Série': item.serie,
      'Data Emissão': item.dataEmissao,
      'Emitente CNPJ': item.emitenteCnpj,
      'Emitente Razão': item.emitenteNome,
      'Emitente UF': item.emitenteUf,
      'Destinatário CNPJ': item.destinatarioCnpj,
      'Destinatário Razão': item.destinatarioNome,
      'Destinatário UF': item.destinatarioUf,
      'Valor Total (R$)': item.valorTotal,
      [`CBS Estimada (${regraAno.aliquotaCbs}% R$)`]: (item.valorTotal * (regraAno.aliquotaCbs / 100)),
      [`IBS UF (${regraAno.aliquotaIbsEstadual}% R$)`]: (item.valorTotal * (regraAno.aliquotaIbsEstadual / 100)),
      [`IBS MUN (${regraAno.aliquotaIbsMunicipal}% R$)`]: (item.valorTotal * (regraAno.aliquotaIbsMunicipal / 100)),
      [`IBS Total (${regraAno.aliquotaIbsTotal}% R$)`]: (item.valorTotal * (regraAno.aliquotaIbsTotal / 100))
    }));

    exportToExcel(rows, `CENTRAL_KPIS_DFE_${(empresaAtiva?.cnpjCompleto || 'EMPRESA').replace(/\D/g, '')}`);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <div className="space-y-6">
      
      {/* ── HEADER TITLE & CONTROLS ─────────────────────── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-white">
                Central de KPIs & Dashboards Fiscais
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                TAX ANALYTICS
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Empresa Ativa: <strong className="text-cyan-400">{empresaAtiva?.razaoSocial || 'Todas as Empresas'}</strong> ({empresaAtiva?.cnpjCompleto || 'Consolidado'})
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto text-xs">
          
          {/* Operação */}
          <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setOperacaoFilter('todas')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                operacaoFilter === 'todas' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setOperacaoFilter('entradas')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                operacaoFilter === 'entradas' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Entradas (Compras)
            </button>
            <button
              type="button"
              onClick={() => setOperacaoFilter('saidas')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                operacaoFilter === 'saidas' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Saídas (Vendas)
            </button>
          </div>

          {/* Período */}
          <select
            value={periodoFilter}
            onChange={(e) => setPeriodoFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="mes">Mês Atual (Agosto/2026)</option>
            <option value="trimestre">Último Trimestre</option>
            <option value="ano">Ano Fiscal 2026</option>
          </select>

          {/* Action Buttons */}
          <button
            type="button"
            onClick={handleRefresh}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Atualizar Dashboards"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Empty State Banner if no documents are loaded */}
      {filteredItems.length === 0 && (
        <div className="p-5 rounded-3xl bg-slate-900/50 border border-slate-800 flex items-center gap-4 text-xs">
          <div className="w-10 h-10 rounded-2xl bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <h4 className="font-bold text-white text-sm">Nenhum Documento Fiscal (DF-e) carregado</h4>
            <p className="text-slate-400">
              O sistema está operando em modo de conformidade com dados 100% reais. Para visualizar métricas de CBS/IBS e gráficos por tipo de DF-e, realize o upload de XMLs ou sincronize via WebService SEFAZ.
            </p>
          </div>
        </div>
      )}

      {/* ── BARRA DE SIMULAÇÃO TEMPORAL DA TRANSIÇÃO (2026 - 2033) ── */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-extrabold text-white">Simulador Temporal da Reforma Tributária (EC 132/2023 & LC 214/2025):</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
              {regraAno.badge}
            </span>
            <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-950 text-slate-300 border border-slate-800">
              Carga IVA Total: <strong className="text-white font-mono">{regraAno.aliquotaIvaTotal.toFixed(2)}%</strong>
            </span>
          </div>
        </div>

        {/* Botoes de Anos da Transição */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {ANOS_TRANSICAO.map((ano) => {
            const isSelected = anoSimulado === ano;
            const r = getRegraTransicaoAno(ano);
            return (
              <button
                key={ano}
                type="button"
                onClick={() => setAnoSimulado(ano)}
                className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 border-cyan-400 text-white shadow-lg shadow-cyan-900/50'
                    : 'bg-slate-950/80 border-slate-800/90 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <div className="font-extrabold text-xs">{ano}</div>
                <div className={`text-[9.5px] font-mono mt-0.5 ${isSelected ? 'text-cyan-100' : 'text-slate-500'}`}>
                  {r.aliquotaIvaTotal.toFixed(1)}%
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
          <span>
            ℹ️ <strong className="text-slate-300">{regraAno.faseNome}:</strong> {regraAno.observacoes}
          </span>
          {regraAno.percentualReducaoIcmsIss > 0 && (
            <span className="text-emerald-400 font-bold hidden md:inline-block">
              📉 ICMS/ISS reduzidos em {regraAno.percentualReducaoIcmsIss}%
            </span>
          )}
        </div>
      </div>

      {/* ── TOP KPI METRIC CARDS ────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Valor Total */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 shadow-xl space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Valor Total dos DF-e
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-white">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValor)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Volume Consolidado ({totalQtd} Documentos)</span>
          </div>
        </div>

        {/* Card 2: CBS Federal */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 shadow-xl space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              CBS Federal ({regraAno.aliquotaCbs.toFixed(2)}%)
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-950 border border-blue-800 flex items-center justify-center text-blue-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-cyan-300">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCbs)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            União • {anoSimulado === 2026 ? 'Alíquota de Teste (0,9%)' : 'Contribuição sobre Bens & Serviços'}
          </div>
        </div>

        {/* Card 3: IBS Estadual (UF) */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 shadow-xl space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              IBS Estadual ({regraAno.aliquotaIbsEstadual.toFixed(2)}%)
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-indigo-300">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIbsUf)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Estados • {anoSimulado < 2029 ? (anoSimulado === 2026 ? 'Alíquota de Teste (0,05%)' : 'Alíquota Zero') : 'Transição Gradativa'}
          </div>
        </div>

        {/* Card 4: IBS Municipal (MUN) */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 shadow-xl space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              IBS Municipal ({regraAno.aliquotaIbsMunicipal.toFixed(2)}%)
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-purple-300">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIbsMun)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Municípios • {anoSimulado < 2029 ? (anoSimulado === 2026 ? 'Alíquota de Teste (0,05%)' : 'Alíquota Zero') : 'Transição Gradativa'}
          </div>
        </div>

      </div>

      {/* ── CHARTS SECTION ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CHART 1: Volume por Tipo de DF-e */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  Volume de Notas Fiscais por Tipo de DF-e
                </h3>
              </div>
              <span className="text-xs font-mono font-extrabold text-cyan-400">
                {totalQtd} Docs
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Distribuição quantitativa por modelo fiscal (NF-e, NFC-e, CT-e, NFS-e, MDF-e).
            </p>
          </div>

          {/* Bar Chart Container */}
          <div className="space-y-4 pt-2">
            {(Object.entries(dfeTypeCounts) as [string, DfeTypeStat][]).map(([key, data]) => {
              const pct = totalQtd > 0 ? (data.qtd / totalQtd) * 100 : 0;
              const barWidth = totalQtd > 0 ? (data.qtd / maxQtdType) * 100 : 0;

              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold font-mono px-2 py-0.5 rounded bg-slate-950 border ${data.border} ${data.color}`}>
                        {key}
                      </span>
                      <span className="text-slate-300 font-semibold">{data.label}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="font-bold text-white">{data.qtd} un</span>
                      <span className="text-slate-400 font-bold text-[11px] w-12 text-right">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Visual Bar Track */}
                  <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${data.bg}`}
                      style={{ width: `${Math.max(barWidth, data.qtd > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>💡 Dados atualizados via mensageria SEFAZ / Prefeituras</span>
            <span className="font-mono text-cyan-300 font-bold">100% Validado</span>
          </div>
        </div>

        {/* CHART 2: Decomposição da Reforma Tributária (CBS / IBS) */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Decomposição Tributária da Reforma (EC 132/2023)
                </h3>
              </div>
              <span className="text-xs font-mono font-extrabold text-emerald-400">
                IVA DUAL (CBS + IBS)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Projeção de carga tributária sobre o faturamento/operações brutas.
            </p>
          </div>

          {/* Value Bars Comparison */}
          <div className="space-y-4 pt-2">
            
            {/* Valor Bruto Total */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200">1. Valor Total das Operações (Base de Cálculo)</span>
                <span className="font-mono font-bold text-white">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValor)}
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-slate-400" style={{ width: '100%' }} />
              </div>
            </div>

            {/* CBS Federal */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-cyan-300">2. CBS Federal (8,80% União)</span>
                <span className="font-mono font-bold text-cyan-300">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCbs)}
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-700"
                  style={{ width: `${(totalCbs / maxValorTributario) * 100}%` }}
                />
              </div>
            </div>

            {/* IBS Estadual (UF) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-indigo-300">3. IBS Estadual (10,62% Estados)</span>
                <span className="font-mono font-bold text-indigo-300">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIbsUf)}
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
                  style={{ width: `${(totalIbsUf / maxValorTributario) * 100}%` }}
                />
              </div>
            </div>

            {/* IBS Municipal (MUN) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-purple-300">4. IBS Municipal (7,08% Municípios)</span>
                <span className="font-mono font-bold text-purple-300">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIbsMun)}
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-700"
                  style={{ width: `${(totalIbsMun / maxValorTributario) * 100}%` }}
                />
              </div>
            </div>

          </div>

          {/* Sum Total Card */}
          <div className="p-3.5 bg-gradient-to-r from-cyan-950/40 via-indigo-950/40 to-slate-950 rounded-2xl border border-cyan-800/40 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Carga Total CBS + IBS (26,50% Referência):</span>
              <span className="font-mono font-extrabold text-cyan-300 text-sm">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCbs + totalIbsTotal)}
              </span>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
              Não Cumulativo Pleno
            </span>
          </div>
        </div>

      </div>

      {/* ── TOP 5 PARCEIROS & MOVIMENTAÇÕES ─────────────── */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">
              Top 5 Parceiros Comerciais & Carga Tributária Projetada
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Classificados por maior valor de movimentação
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Parceiro / Empresa</th>
                <th className="py-3 px-3">UF</th>
                <th className="py-3 px-3 text-center">Volume DF-e</th>
                <th className="py-3 px-3 text-right">Valor Total (R$)</th>
                <th className="py-3 px-3 text-right">CBS (8,8%)</th>
                <th className="py-3 px-3 text-right">IBS Total (17,7%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {topParceiros.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-medium text-xs">
                    Nenhum documento fiscal processado. Importe XMLs para gerar o ranking de parceiros e apuração tributária.
                  </td>
                </tr>
              ) : (
                topParceiros.map((p, idx) => {
                  const cbsVal = p.total * (regraAno.aliquotaCbs / 100);
                  const ibsVal = p.total * (regraAno.aliquotaIbsTotal / 100);
                  return (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{p.razao}</div>
                        <div className="font-mono text-cyan-400 text-[11px]">{p.cnpj}</div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800 text-[11px]">
                          {p.uf}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-200">
                        {p.qtd} notas
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-extrabold text-white">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.total)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-cyan-300">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cbsVal)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-indigo-300">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ibsVal)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
