import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, FileText, CheckCircle2,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Layers, PieChart,
  BarChart3, RefreshCw, Filter, Calendar, Building2, Percent,
  Download, Sparkles, ShieldAlert, Check, HelpCircle, Info, Calculator, Scale
} from 'lucide-react';
import { DfeXmlItem, RegraTransicaoAno, AliquotaTabelaItem } from '../types';
import { exportToExcel } from '../utils/excel';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { getRegraTransicaoAno, ANOS_TRANSICAO, buildCronogramaFromTabelas } from '../utils/reformaTransicao';

interface CentralKpisPanelProps {
  dfeList?: DfeXmlItem[];
  selectedTenantCnpj?: string;
  empresaAtiva?: any;
}

interface DfeTypeStat {
  label: string;
  qtd: number;
  valor: number;
  color: string;
  bg: string;
  border: string;
}

export const CentralKpisPanel: React.FC<CentralKpisPanelProps> = ({ dfeList = [], selectedTenantCnpj, empresaAtiva }) => {
  const { get } = useApi();
  const [periodoFilter, setPeriodoFilter] = useState<'mes' | 'trimestre' | 'ano'>('ano');
  const [operacaoFilter, setOperacaoFilter] = useState<'todas' | 'entradas' | 'saidas'>('todas');
  const [anoSimulado, setAnoSimulado] = useState<number>(2026);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tabelasAliquotas, setTabelasAliquotas] = useState<AliquotaTabelaItem[]>([]);

  // Estado de KPIs Agregados Reais Direto do Banco de Dados (sem LIMIT de 1000)
  const [dbKpis, setDbKpis] = useState<{
    totalGeral: any;
    totalFiltrado: any;
    source?: string;
  } | null>(null);
  const [loadingKpis, setLoadingKpis] = useState(false);

  const loadKpis = async () => {
    try {
      setLoadingKpis(true);
      const res = await get<{ success: boolean; totalGeral: any; totalFiltrado: any; source: string }>(
        `/upload/kpis?empresaId=${empresaAtiva?.id || ''}&tipoOperacao=${operacaoFilter}`
      );
      const payload = (res as any)?.data || res;
      if (payload?.success && payload.totalGeral) {
        setDbKpis({
          totalGeral: payload.totalGeral,
          totalFiltrado: payload.totalFiltrado || payload.totalGeral,
          source: payload.source
        });
      }
    } catch (err) {
      console.warn('⚠️ Falha ao buscar KPIs agregados do banco:', err);
    } finally {
      setLoadingKpis(false);
    }
  };

  useEffect(() => {
    loadKpis();
  }, [empresaAtiva?.id, empresaAtiva?.cnpjCompleto, operacaoFilter, periodoFilter]);

  // Buscar alíquotas cadastradas no banco para cálculo 100% dinâmico
  useEffect(() => {
    get<{ success: boolean; data: AliquotaTabelaItem[] }>('/tables/aliquotas/ad-valorem')
      .then(res => {
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          setTabelasAliquotas(res.data);
        }
      })
      .catch(() => {});
  }, [get]);

  const customCronograma = useMemo(() => {
    return buildCronogramaFromTabelas(tabelasAliquotas);
  }, [tabelasAliquotas]);

  // Regra de transição oficial por ano baseada 100% na tabela de alíquotas
  const regraAno = useMemo(() => getRegraTransicaoAno(anoSimulado, customCronograma), [anoSimulado, customCronograma]);


  // Documentos Reais
  const baseItems: DfeXmlItem[] = useMemo(() => {
    return dfeList || [];
  }, [dfeList]);

  // Filtragem por Operação
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

  // ── AGREGAÇÕES FISCAIS DESACOPLADAS (BANCO DE DADOS AGREGADO SUM/COUNT) ──
  // Prioriza o cálculo real do banco de dados (que engloba todos os 21.000+ XMLs)
  const totalValor = dbKpis?.totalFiltrado?.totalValor ?? filteredItems.reduce((acc, i) => acc + (i.valorTotal || 0), 0);
  const totalValorGeral = dbKpis?.totalGeral?.totalValor ?? totalValor;
  const totalQtd = dbKpis?.totalFiltrado?.totalDocs ?? filteredItems.length;
  const totalQtdGeral = dbKpis?.totalGeral?.totalDocs ?? totalQtd;

  // Base de Cálculo IBS / CBS (<vBC> estritamente constante nos Grupos IBS/CBS do XML)
  const totalBaseCbsFiltrada = dbKpis?.totalFiltrado?.totalBaseCbs ?? filteredItems.reduce((acc, i) => acc + (i.baseCbs || 0), 0);
  const totalBaseCbsGeral = dbKpis?.totalGeral?.totalBaseCbs ?? totalBaseCbsFiltrada;
  const totalBaseIbsFiltrada = dbKpis?.totalFiltrado?.totalBaseIbs ?? filteredItems.reduce((acc, i) => acc + (i.baseIbs || 0), 0);
  const totalBaseIbsGeral = dbKpis?.totalGeral?.totalBaseIbs ?? totalBaseIbsFiltrada;

  // CBS e IBS estritamente do XML (ou aplicados sobre a Base Real do XML)
  const totalCbsRealXml = dbKpis?.totalFiltrado?.totalCbs ?? filteredItems.reduce((acc, i) => acc + (i.valorCbs || 0), 0);
  const totalIbsRealXml = dbKpis?.totalFiltrado?.totalIbs ?? filteredItems.reduce((acc, i) => acc + (i.valorIbs || 0), 0);

  const totalCbs = totalCbsRealXml > 0 ? totalCbsRealXml : ((totalBaseCbsFiltrada * regraAno.aliquotaCbs) / 100);

  // Rateio do IBS entre Estadual e Municipal (se não vier discriminado na tag vIBSUF/Mun, divide 50/50 o IBS do XML)
  const totalIbsUf = (dbKpis?.totalFiltrado?.totalIbsUf && dbKpis.totalFiltrado.totalIbsUf > 0)
    ? dbKpis.totalFiltrado.totalIbsUf
    : (totalIbsRealXml > 0 ? (totalIbsRealXml / 2) : ((totalBaseIbsFiltrada * regraAno.aliquotaIbsEstadual) / 100));

  const totalIbsMun = (dbKpis?.totalFiltrado?.totalIbsMun && dbKpis.totalFiltrado.totalIbsMun > 0)
    ? dbKpis.totalFiltrado.totalIbsMun
    : (totalIbsRealXml > 0 ? (totalIbsRealXml / 2) : ((totalBaseIbsFiltrada * regraAno.aliquotaIbsMunicipal) / 100));

  const totalIbsTotal = totalIbsRealXml > 0 ? totalIbsRealXml : (totalIbsUf + totalIbsMun);
  const totalIvaDual = totalCbs + totalIbsTotal;

  // Tributos do Regime Atual Destacados nos XMLs
  const totalIcmsReal = dbKpis?.totalFiltrado?.totalIcms ?? filteredItems.reduce((acc, i) => acc + (i.valorIcms || 0), 0);
  const totalPisReal = dbKpis?.totalFiltrado?.totalPis ?? filteredItems.reduce((acc, i) => acc + (i.valorPis || 0), 0);
  const totalCofinsReal = dbKpis?.totalFiltrado?.totalCofins ?? filteredItems.reduce((acc, i) => acc + (i.valorCofins || 0), 0);
  const totalIpiReal = dbKpis?.totalFiltrado?.totalIpi ?? filteredItems.reduce((acc, i) => acc + (i.valorIpi || 0), 0);
  const totalIssReal = dbKpis?.totalFiltrado?.totalIss ?? filteredItems.reduce((acc, i) => acc + (i.valorIss || 0), 0);

  // ── SIMULADOR COMPARATIVO DE TRANSIÇÃO (Reforma vs Atual) ──
  // Base Líquida = vNF - todos os tributos atuais informados ou inferidos
  const baseLiquidaSimulada = dbKpis?.totalFiltrado?.totalBaseLiquida ?? Math.max(0, totalValor - (totalIcmsReal + totalPisReal + totalCofinsReal + totalIpiReal + totalIssReal));
  
  // Alíquotas do ano simulado cadastradas nos Parâmetros Fiscais (via getRegraTransicaoAno)
  const cbsSimuladaAno = (baseLiquidaSimulada * regraAno.aliquotaCbs) / 100;
  const ibsEstSimuladaAno = (baseLiquidaSimulada * regraAno.aliquotaIbsEstadual) / 100;
  const ibsMunSimuladaAno = (baseLiquidaSimulada * regraAno.aliquotaIbsMunicipal) / 100;
  const ibsTotalSimuladoAno = ibsEstSimuladaAno + ibsMunSimuladaAno;
  const totalReformaSimulada = cbsSimuladaAno + ibsTotalSimuladoAno;

  // Custo tributário total do Regime Atual (incluindo inferências de SN e CT-e)
  const totalRegimeAtualSimulado = dbKpis?.totalFiltrado?.totalRegimeAtual ?? (totalIcmsReal + totalPisReal + totalCofinsReal + totalIpiReal + totalIssReal);
  const deltaTransicao = totalReformaSimulada - totalRegimeAtualSimulado;
  const percentualDelta = totalRegimeAtualSimulado > 0 ? ((deltaTransicao / totalRegimeAtualSimulado) * 100) : 0;

  // Agregações por Modelo de DF-e
  const dfeTypeCounts = useMemo<Record<string, DfeTypeStat>>(() => {
    const counts: Record<string, DfeTypeStat> = {
      'NFe': { label: 'NF-e (Mod 55) Mercadorias', qtd: 0, valor: 0, color: 'text-cyan-400', bg: 'bg-cyan-500', border: 'border-cyan-500/30' },
      'NFCe': { label: 'NFC-e (Mod 65) Varejo', qtd: 0, valor: 0, color: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-500/30' },
      'CTe': { label: 'CT-e (Mod 57) Transportes', qtd: 0, valor: 0, color: 'text-indigo-400', bg: 'bg-indigo-500', border: 'border-indigo-500/30' },
      'NFSe': { label: 'NFS-e Serviços', qtd: 0, valor: 0, color: 'text-purple-400', bg: 'bg-purple-500', border: 'border-purple-500/30' }
    };

    if (dbKpis?.totalFiltrado) {
      counts['NFe'].qtd = dbKpis.totalFiltrado.nfeCount || 0;
      counts['NFCe'].qtd = dbKpis.totalFiltrado.nfceCount || 0;
      counts['CTe'].qtd = dbKpis.totalFiltrado.cteCount || 0;
      counts['NFSe'].qtd = dbKpis.totalFiltrado.nfseCount || 0;
      counts['NFe'].valor = totalValor;
      return counts;
    }

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
  }, [filteredItems, dbKpis, totalValor]);

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
      'CBS Real (R$)': item.valorCbs || 0,
      'IBS Real (R$)': item.valorIbs || 0,
      'ICMS Real (R$)': item.valorIcms || 0,
      'PIS Real (R$)': item.valorPis || 0,
      'COFINS Real (R$)': item.valorCofins || 0
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
            <h2 className="text-lg font-extrabold text-white">
              Central de KPIs & Dashboards Fiscais
            </h2>
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
            <option value="mes">Mês Atual</option>
            <option value="trimestre">Último Trimestre</option>
            <option value="ano">Ano Fiscal Completo</option>
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
              O sistema está operando em modo de conformidade com dados 100% reais. Para visualizar métricas de CBS/IBS e gráficos por tipo de DF-e, realize a sincronização via WebService SEFAZ ou upload de XMLs.
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

        {/* Botões de Anos da Transição */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {ANOS_TRANSICAO.map((ano) => {
            const isSelected = anoSimulado === ano;
            const r = getRegraTransicaoAno(ano, customCronograma);
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
                <div className={`text-[9.5px] font-mono mt-0.5 ${isSelected ? 'text-cyan-100 font-bold' : 'text-slate-500'}`}>
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

      {/* ── PAINEL DO SIMULADOR COMPARATIVO DE CARGA TRIBUTÁRIA (EC 132/23 & LC 214/25) ── */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-indigo-500/30 shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">Simulador Comparativo de Custo Tributário</h3>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Ano Simulado: {anoSimulado}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cálculo com aplicação das alíquotas cadastradas nos Parâmetros sobre o Valor Total subtraído dos tributos atuais (Base Líquida)
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Base Líquida Tributável</span>
            <strong className="text-lg font-black text-teal-300 font-mono">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(baseLiquidaSimulada)}
            </strong>
          </div>
        </div>

        {/* Grade Comparativa: Regime Atual vs Reforma Tributária */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Coluna 1: Regime Atual */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Regime Tributário Atual (Vigente)
              </span>
              <span className="text-[10px] text-slate-500">XMLs + Inferências Médias</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-900">
                <span className="text-slate-400">ICMS ({dbKpis?.totalFiltrado?.simplesNacDocsCount ? 'Destacado + SN Inferido' : 'Destacado'}):</span>
                <span className="font-mono text-slate-200 font-semibold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIcmsReal + (dbKpis?.totalFiltrado?.icmsInferido || 0))}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900">
                <span className="text-slate-400">PIS ({dbKpis?.totalFiltrado?.cteInferidosCount ? 'Destacado + CT-e Inferido' : 'Destacado'}):</span>
                <span className="font-mono text-slate-200 font-semibold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPisReal + (dbKpis?.totalFiltrado?.pisInferido || 0))}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900">
                <span className="text-slate-400">COFINS ({dbKpis?.totalFiltrado?.cteInferidosCount ? 'Destacado + CT-e Inferido' : 'Destacado'}):</span>
                <span className="font-mono text-slate-200 font-semibold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCofinsReal + (dbKpis?.totalFiltrado?.cofinsInferido || 0))}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900">
                <span className="text-slate-400">IPI Destacado:</span>
                <span className="font-mono text-slate-200 font-semibold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIpiReal)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900">
                <span className="text-slate-400">ISS Destacado:</span>
                <span className="font-mono text-slate-200 font-semibold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIssReal + (dbKpis?.totalFiltrado?.issInferido || 0))}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
              <span className="text-xs font-extrabold text-slate-300">Custo Atual Consolidado:</span>
              <strong className="text-base font-black text-amber-300 font-mono">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRegimeAtualSimulado)}
              </strong>
            </div>
          </div>

          {/* Coluna 2: Regime Reforma */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                Regime Reforma (IVA Dual {anoSimulado})
              </span>
              <span className="text-[10px] text-cyan-500 font-semibold">Alíquotas dos Parâmetros</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-900">
                <span className="text-slate-400">CBS Federal ({regraAno.aliquotaCbs.toFixed(2)}%):</span>
                <span className="font-mono text-cyan-300 font-semibold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cbsSimuladaAno)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900">
                <span className="text-slate-400">IBS Estadual ({regraAno.aliquotaIbsEstadual.toFixed(2)}%):</span>
                <span className="font-mono text-indigo-300 font-semibold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ibsEstSimuladaAno)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900">
                <span className="text-slate-400">IBS Municipal ({regraAno.aliquotaIbsMunicipal.toFixed(2)}%):</span>
                <span className="font-mono text-purple-300 font-semibold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ibsMunSimuladaAno)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900">
                <span className="text-slate-400">Total IBS ({regraAno.aliquotaIbsTotal.toFixed(2)}%):</span>
                <span className="font-mono text-indigo-200 font-semibold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ibsTotalSimuladoAno)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900">
                <span className="text-slate-400">Alíquota Efetiva IVA Total:</span>
                <span className="font-mono text-cyan-400 font-bold">
                  {regraAno.aliquotaIvaTotal.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
              <span className="text-xs font-extrabold text-cyan-200">Custo Reforma Simulado:</span>
              <strong className="text-base font-black text-cyan-300 font-mono">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReformaSimulada)}
              </strong>
            </div>
          </div>
        </div>

        {/* Banner de Impacto / Delta Tributário */}
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          deltaTransicao <= 0 
            ? 'bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border-emerald-500/40' 
            : 'bg-gradient-to-r from-rose-950/60 via-slate-900 to-amber-950/60 border-rose-500/40'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-white">Impacto da Reforma ({anoSimulado}):</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                deltaTransicao <= 0 ? 'bg-emerald-900/80 text-emerald-300' : 'bg-rose-900/80 text-rose-300'
              }`}>
                {deltaTransicao <= 0 ? 'ECONOMIA PROJETADA' : 'ACRÉSCIMO DE CARGA'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Diferença entre a Carga da Reforma ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReformaSimulada)}) e a Carga Vigente ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRegimeAtualSimulado)})
            </p>
          </div>

          <div className="text-right shrink-0">
            <strong className={`text-xl sm:text-2xl font-black font-mono block ${
              deltaTransicao <= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {deltaTransicao <= 0 ? '-' : '+'}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(deltaTransicao))}
            </strong>
            <span className={`text-xs font-mono font-bold ${
              deltaTransicao <= 0 ? 'text-emerald-300' : 'text-rose-300'
            }`}>
              ({percentualDelta.toFixed(1)}% vs regime atual)
            </span>
          </div>
        </div>

        {/* Rodapé Informativo de Inferências Aplicadas */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/80 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 font-mono">
              📦 {dbKpis?.totalFiltrado?.cteInferidosCount || 0} CT-e com PIS/COFINS Médio Inferido
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 font-mono">
              🏢 {dbKpis?.totalFiltrado?.simplesNacDocsCount || 0} Docs Simples Nacional (CRT 1/4) Inferidos
            </span>
          </div>
          <span className="italic text-[10px]">
            * Alíquotas médias configuradas na tela de Parâmetros & Tabelas Fiscais
          </span>
        </div>
      </div>

      {/* ── TOP KPI METRIC CARDS (5 CARDS ESTRATÉGICOS) ────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        
        {/* Card 1: Valor Total dos DF-e */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 shadow-xl space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Valor Total dos DF-e
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-white truncate" title={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValor)}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValor)}
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold truncate">
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>{totalQtd.toLocaleString('pt-BR')} Docs no Período</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-1" title="Base Total Acumulada da Empresa sem corte de filtro">
              Base: {totalQtdGeral.toLocaleString('pt-BR')} docs
            </span>
          </div>
        </div>

        {/* Card 2: Base de Cálculo IBS / CBS (<vBC>) */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-teal-500/30 hover:border-teal-400/60 shadow-xl space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
              Base de Cálculo IBS / CBS
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-950 border border-teal-800 flex items-center justify-center text-teal-300">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-teal-300 truncate" title={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalBaseCbsFiltrada)}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalBaseCbsFiltrada)}
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60 font-medium">
            <span className="text-teal-400/90 font-bold truncate">&lt;vBC&gt; Consolidado no Período</span>
            <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-1" title="Base de Cálculo Acumulada de toda a base">
              Total: {new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' }).format(totalBaseCbsGeral)}
            </span>
          </div>
        </div>

        {/* Card 3: CBS Federal */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 shadow-xl space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              CBS Federal ({regraAno.aliquotaCbs.toFixed(2)}%)
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-950 border border-blue-800 flex items-center justify-center text-blue-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-cyan-300 truncate" title={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCbs)}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCbs)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium truncate pt-1 border-t border-slate-800/60">
            União • {anoSimulado === 2026 ? 'Alíquota Teste (0,9%)' : 'Contribuição s/ Bens & Serviços'}
          </div>
        </div>

        {/* Card 4: IBS Estadual (UF) */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 shadow-xl space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              IBS Estadual ({regraAno.aliquotaIbsEstadual.toFixed(2)}%)
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-indigo-300 truncate" title={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIbsUf)}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIbsUf)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium truncate pt-1 border-t border-slate-800/60">
            Estados • {anoSimulado < 2029 ? (anoSimulado === 2026 ? 'Alíquota Teste (0,05%)' : 'Alíquota Zero') : 'Transição Gradativa'}
          </div>
        </div>

        {/* Card 5: IBS Municipal (MUN) */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 shadow-xl space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              IBS Municipal ({regraAno.aliquotaIbsMunicipal.toFixed(2)}%)
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-purple-300 truncate" title={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIbsMun)}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIbsMun)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium truncate pt-1 border-t border-slate-800/60">
            Municípios • {anoSimulado < 2029 ? (anoSimulado === 2026 ? 'Alíquota Teste (0,05%)' : 'Alíquota Zero') : 'Transição Gradativa'}
          </div>
        </div>

      </div>

      {/* ── SEGUNDA LINHA DE CARDS: TRIBUTOS DO REGIME ATUAL (SE HOUVER) ── */}
      {(totalIcmsReal > 0 || totalPisReal > 0 || totalCofinsReal > 0 || totalIpiReal > 0) && (
        <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
              Tributos do Regime Atual Destacados nos XMLs:
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              ICMS + PIS + COFINS + IPI: <strong className="text-emerald-400 font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIcmsReal + totalPisReal + totalCofinsReal + totalIpiReal)}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px]">ICMS Destacado:</span>
              <strong className="text-slate-200 font-mono font-bold text-sm">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIcmsReal)}
              </strong>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px]">PIS Destacado:</span>
              <strong className="text-slate-200 font-mono font-bold text-sm">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPisReal)}
              </strong>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px]">COFINS Destacado:</span>
              <strong className="text-slate-200 font-mono font-bold text-sm">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCofinsReal)}
              </strong>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px]">IPI Destacado:</span>
              <strong className="text-slate-200 font-mono font-bold text-sm">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIpiReal)}
              </strong>
            </div>
          </div>
        </div>
      )}

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
              Distribuição quantitativa por modelo fiscal (NF-e, NFC-e, CT-e e NFS-e).
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
            <span>💡 Dados sincronizados diretamente da SEFAZ</span>
            <span className="font-mono text-cyan-300 font-bold">100% Real</span>
          </div>
        </div>

        {/* CHART 2: Decomposição da Reforma Tributária (CBS / IBS) */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Decomposição Tributária (CBS / IBS)
                </h3>
              </div>
              <span className="text-xs font-mono font-extrabold text-emerald-400">
                IVA DUAL
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Segregação por ente federativo conforme apuração e parâmetros vigentes.
            </p>
          </div>

          {/* Value Bars Comparison */}
          <div className="space-y-4 pt-2">
            
            {/* Valor Bruto Total */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200">1. Base de Cálculo Total</span>
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
                <span className="font-bold text-cyan-300">2. CBS Federal ({regraAno.aliquotaCbs.toFixed(2)}% União)</span>
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
                <span className="font-bold text-indigo-300">3. IBS Estadual ({regraAno.aliquotaIbsEstadual.toFixed(2)}% Estados)</span>
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
                <span className="font-bold text-purple-300">4. IBS Municipal ({regraAno.aliquotaIbsMunicipal.toFixed(2)}% Municípios)</span>
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
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Total CBS + IBS ({regraAno.aliquotaIvaTotal.toFixed(2)}% Transição):</span>
              <span className="font-mono font-extrabold text-cyan-300 text-sm">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCbs + totalIbsTotal)}
              </span>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
              Não Cumulativo
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
              Top 5 Parceiros Comerciais & Movimentação Fiscal
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Classificados por volume financeiro total
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
                <th className="py-3 px-3 text-right">CBS ({regraAno.aliquotaCbs.toFixed(1)}%)</th>
                <th className="py-3 px-3 text-right">IBS Total ({regraAno.aliquotaIbsTotal.toFixed(1)}%)</th>
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
                  const cbsVal = (p.total * regraAno.aliquotaCbs) / 100;
                  const ibsVal = (p.total * regraAno.aliquotaIbsTotal) / 100;
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
