import React, { useState } from 'react';
import {
  BarChart3, Layers, Info, Check, ShieldCheck, DollarSign
} from 'lucide-react';

export interface FiscalVerticalBarChartProps {
  totalOperacoes: number;
  baseCalculo: number;
  tributosAtuais: {
    total: number;
    icms: number;
    iss: number;
    ipi: number;
    pis: number;
    cofins: number;
  };
  tributosReforma: {
    total: number;
    ibs: number;
    cbs: number;
    is: number;
  };
  creditoIbsCbs: number;
  totalDocs: number;
  totalItens: number;
}

export const FiscalVerticalBarChart: React.FC<FiscalVerticalBarChartProps> = ({
  totalOperacoes,
  baseCalculo,
  tributosAtuais,
  tributosReforma,
  creditoIbsCbs,
  totalDocs,
  totalItens,
}) => {
  // Modo de exibição: 'agrupada' (barras empilhadas por tributo) ou 'detalhada' (uma barra para cada tributo)
  const [viewMode, setViewMode] = useState<'agrupada' | 'detalhada'>('agrupada');
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  // Valor base para cálculo de percentuais (Volume Operações)
  const baseValue = Math.max(totalOperacoes, 1);

  // Totais agregados
  const totalPisCofins = (tributosAtuais.pis || 0) + (tributosAtuais.cofins || 0);
  const totalAtualCalculado = (tributosAtuais.icms || 0) + (tributosAtuais.iss || 0) + (tributosAtuais.ipi || 0) + totalPisCofins;
  const totalAtualReal = tributosAtuais.total > 0 ? tributosAtuais.total : totalAtualCalculado;

  const totalReformaCalculado = (tributosReforma.ibs || 0) + (tributosReforma.cbs || 0) + (tributosReforma.is || 0);
  const totalReformaReal = tributosReforma.total > 0 ? tributosReforma.total : totalReformaCalculado;

  const deltaCarga = totalReformaReal - totalAtualReal;
  const deltaPercent = totalOperacoes > 0 ? (deltaCarga / totalOperacoes) * 100 : 0;

  // Escala para as 5 barras agrupadas
  const maxAgrupado = Math.max(totalOperacoes, baseCalculo, totalAtualReal, totalReformaReal, creditoIbsCbs, 1);
  const calcAgrupadoHeight = (val: number): number => {
    if (val <= 0) return 4;
    const ratio = val / maxAgrupado;
    const scaled = Math.pow(ratio, 0.45) * 100;
    return Math.max(12, Math.min(100, Math.round(scaled)));
  };

  // Barras individuais para a Visão Detalhada
  const individualBars = [
    { id: 'operacoes', label: 'Volume Total', sublabel: 'Líquido Faturado', value: totalOperacoes, color: 'from-emerald-500 to-teal-600', border: 'border-emerald-400/60', text: 'text-emerald-400', group: 'Geral' },
    { id: 'base', label: 'Base IBS/CBS', sublabel: 'Base Tributável', value: baseCalculo, color: 'from-teal-500 to-cyan-600', border: 'border-teal-400/60', text: 'text-teal-300', group: 'Geral' },
    
    // Tributos do Regime Atual
    { id: 'icms', label: 'ICMS', sublabel: 'Estadual', value: tributosAtuais.icms || 0, color: 'from-amber-500 to-amber-600', border: 'border-amber-400/60', text: 'text-amber-300', group: 'Atual' },
    { id: 'iss', label: 'ISS', sublabel: 'Municipal (Serviços)', value: tributosAtuais.iss || 0, color: 'from-yellow-400 to-amber-400', border: 'border-yellow-300/60', text: 'text-yellow-300', group: 'Atual' },
    { id: 'ipi', label: 'IPI', sublabel: 'Federal', value: tributosAtuais.ipi || 0, color: 'from-purple-500 to-indigo-600', border: 'border-purple-400/60', text: 'text-purple-300', group: 'Atual' },
    { id: 'piscofins', label: 'PIS / COFINS', sublabel: 'Federal Cum./Não-Cum.', value: totalPisCofins, color: 'from-sky-400 to-blue-500', border: 'border-sky-400/60', text: 'text-sky-300', group: 'Atual' },

    // Tributos da Reforma
    { id: 'ibs', label: 'IBS', sublabel: 'CGIBS (Est./Mun.)', value: tributosReforma.ibs || 0, color: 'from-cyan-400 to-cyan-500', border: 'border-cyan-400/60', text: 'text-cyan-300', group: 'Reforma' },
    { id: 'cbs', label: 'CBS', sublabel: 'RFB (Federal)', value: tributosReforma.cbs || 0, color: 'from-blue-500 to-blue-600', border: 'border-blue-400/60', text: 'text-blue-300', group: 'Reforma' },
    { id: 'is', label: 'Imp. Seletivo', sublabel: 'IS Extra fiscal', value: tributosReforma.is || 0, color: 'from-rose-500 to-rose-600', border: 'border-rose-400/60', text: 'text-rose-300', group: 'Reforma' },

    // Créditos
    { id: 'credito', label: 'Crédito IBS/CBS', sublabel: 'Recuperável', value: creditoIbsCbs, color: 'from-emerald-400 to-teal-500', border: 'border-emerald-300/60', text: 'text-emerald-300', group: 'Crédito' },
  ];

  const maxIndividual = Math.max(...individualBars.map(b => b.value), 1);
  const calcIndividualHeight = (val: number): number => {
    if (val <= 0) return 4;
    const ratio = val / maxIndividual;
    const scaled = Math.pow(ratio, 0.45) * 100;
    return Math.max(10, Math.min(100, Math.round(scaled)));
  };

  // Cálculo de percentuais das fatias dos Tributos Atuais
  const safeTotalAtual = Math.max(totalAtualReal, 1);
  const pctIcms = ((tributosAtuais.icms || 0) / safeTotalAtual) * 100;
  const pctIss = ((tributosAtuais.iss || 0) / safeTotalAtual) * 100;
  const pctIpi = ((tributosAtuais.ipi || 0) / safeTotalAtual) * 100;
  const pctPisCofins = (totalPisCofins / safeTotalAtual) * 100;

  // Cálculo de percentuais das fatias da Reforma
  const safeTotalReforma = Math.max(totalReformaReal, 1);
  const pctIbs = ((tributosReforma.ibs || 0) / safeTotalReforma) * 100;
  const pctCbs = ((tributosReforma.cbs || 0) / safeTotalReforma) * 100;
  const pctIs = ((tributosReforma.is || 0) / safeTotalReforma) * 100;

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4 shadow-2xl bg-gradient-to-b from-slate-900/95 via-slate-900/80 to-slate-950">
      
      {/* Header com Título, Seletor Híbrido e Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span>Consolidação Fiscal — Indicadores Comparativos</span>
            </h3>
          </div>
          <p className="text-[11px] text-slate-400">
            Valores monetários consolidados e fidedignos à consulta filtrada atual.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Modo Híbrido (Opção C) */}
          <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800 shadow-inner">
            <button
              type="button"
              onClick={() => setViewMode('agrupada')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'agrupada'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Exibe 5 grandes barras sintéticas com fatias coloridas por tributo"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Visão Empilhada</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('detalhada')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'detalhada'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Exibe uma barra individual independente para cada imposto (ICMS, ISS, IPI, PIS, COFINS, IBS, CBS, IS)"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Visão por Tributo</span>
            </button>
          </div>

          {/* Resumo de Volumetria e Delta */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <div className="px-2.5 py-1 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-300 flex items-center gap-1.5 shadow-inner">
              <span className="text-slate-500 uppercase text-[10px]">Documentos:</span>
              <span className="font-bold text-cyan-300">{totalDocs.toLocaleString('pt-BR')}</span>
            </div>

            <div className="px-2.5 py-1 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-300 flex items-center gap-1.5 shadow-inner">
              <span className="text-slate-500 uppercase text-[10px]">Itens:</span>
              <span className="font-bold text-emerald-400">{totalItens.toLocaleString('pt-BR')}</span>
            </div>

            <div className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${
              deltaCarga <= 0
                ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                : 'bg-rose-950/60 border-rose-700/60 text-rose-300'
            }`}>
              <span className="uppercase text-[10px]">Delta Carga:</span>
              <span className="font-bold">
                {deltaPercent > 0 ? `+${deltaPercent.toFixed(2)}%` : `${deltaPercent.toFixed(2)}%`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          MODO 1: VISÃO AGRUPADA COM BARRAS EMPILHADAS COLORIDAS
      ======================================================== */}
      {viewMode === 'agrupada' && (
        <div className="space-y-4">
          <div className="relative pt-6 pb-2">
            {/* Linhas guias */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 pt-6 pb-12">
              <div className="border-b border-dashed border-slate-600 w-full" />
              <div className="border-b border-dashed border-slate-600 w-full" />
              <div className="border-b border-dashed border-slate-600 w-full" />
            </div>

            {/* 5 Colunas Agrupadas */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-5 h-64 sm:h-72 relative items-end">
              
              {/* Barra 1: Volume Operações */}
              <div className="flex flex-col items-center h-full justify-end group cursor-pointer relative">
                <div className="mb-2 text-center transition-transform group-hover:scale-105">
                  <span className="text-[11px] sm:text-xs font-black font-mono block truncate max-w-[150px] text-emerald-400">
                    {totalOperacoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border inline-block mt-0.5 bg-emerald-950/80 text-emerald-300 border-emerald-700/60">
                    100% Base
                  </span>
                </div>
                <div className="w-full max-w-[80px] sm:max-w-[95px] flex items-end justify-center h-44 sm:h-52 bg-slate-950/40 rounded-xl p-1 border border-slate-800/80 shadow-inner">
                  <div
                    style={{ height: `${calcAgrupadoHeight(totalOperacoes)}%` }}
                    className="w-full rounded-lg bg-gradient-to-t from-emerald-500 to-teal-600 border-t-2 border-emerald-400/60 shadow-lg transition-all duration-300 relative group-hover:brightness-125"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-white/40" />
                  </div>
                </div>
                <div className="mt-2.5 text-center w-full px-1">
                  <span className="text-[11px] font-bold text-slate-200 block truncate">Volume Operações</span>
                  <span className="text-[9px] text-slate-500 block truncate font-mono">Valor Líquido Total</span>
                </div>
              </div>

              {/* Barra 2: Base IBS / CBS */}
              <div className="flex flex-col items-center h-full justify-end group cursor-pointer relative">
                <div className="mb-2 text-center transition-transform group-hover:scale-105">
                  <span className="text-[11px] sm:text-xs font-black font-mono block truncate max-w-[150px] text-teal-300">
                    {baseCalculo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border inline-block mt-0.5 bg-teal-950/80 text-teal-300 border-teal-700/60">
                    {((baseCalculo / baseValue) * 100).toFixed(1)}% Base
                  </span>
                </div>
                <div className="w-full max-w-[80px] sm:max-w-[95px] flex items-end justify-center h-44 sm:h-52 bg-slate-950/40 rounded-xl p-1 border border-slate-800/80 shadow-inner">
                  <div
                    style={{ height: `${calcAgrupadoHeight(baseCalculo)}%` }}
                    className="w-full rounded-lg bg-gradient-to-t from-teal-500 to-cyan-600 border-t-2 border-teal-400/60 shadow-lg transition-all duration-300 relative group-hover:brightness-125"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-white/40" />
                  </div>
                </div>
                <div className="mt-2.5 text-center w-full px-1">
                  <span className="text-[11px] font-bold text-slate-200 block truncate">Base IBS / CBS</span>
                  <span className="text-[9px] text-slate-500 block truncate font-mono">Base Tributável</span>
                </div>
              </div>

              {/* Barra 3: Tributos Regime Atual (STACKED EMPILHADA COM ICMS + ISS + IPI + PIS/COFINS) */}
              <div
                onMouseEnter={() => setHoveredSegment('atual')}
                onMouseLeave={() => setHoveredSegment(null)}
                className="flex flex-col items-center h-full justify-end group cursor-pointer relative"
              >
                {/* Tooltip Detalhado no Hover */}
                {hoveredSegment === 'atual' && (
                  <div className="absolute -top-3 z-30 transform -translate-y-full w-64 p-3 rounded-xl bg-slate-950/98 border border-amber-500/60 shadow-2xl text-xs space-y-2 pointer-events-none backdrop-blur-md animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-amber-300 text-[11px]">Tributos Regime Atual</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full font-mono bg-amber-950 text-amber-200 border border-amber-800">
                        {((totalAtualReal / baseValue) * 100).toFixed(2)}% Carga
                      </span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-amber-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> ICMS (Estadual):
                        </span>
                        <span className="font-bold text-white">
                          R$ {(tributosAtuais.icms || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ({pctIcms.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-yellow-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> ISS (Municipal):
                        </span>
                        <span className="font-bold text-white">
                          R$ {(tributosAtuais.iss || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ({pctIss.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-purple-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> IPI (Federal):
                        </span>
                        <span className="font-bold text-white">
                          R$ {(tributosAtuais.ipi || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ({pctIpi.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sky-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> PIS / COFINS:
                        </span>
                        <span className="font-bold text-white">
                          R$ {totalPisCofins.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ({pctPisCofins.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-2 text-center transition-transform group-hover:scale-105">
                  <span className="text-[11px] sm:text-xs font-black font-mono block truncate max-w-[150px] text-amber-300">
                    {totalAtualReal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border inline-block mt-0.5 bg-amber-950/80 text-amber-300 border-amber-700/60">
                    {((totalAtualReal / baseValue) * 100).toFixed(1)}% Carga
                  </span>
                </div>

                {/* Coluna Empilhada (Stacked Vertical Bar) */}
                <div className="w-full max-w-[80px] sm:max-w-[95px] flex items-end justify-center h-44 sm:h-52 bg-slate-950/40 rounded-xl p-1 border border-slate-800/80 shadow-inner">
                  <div
                    style={{ height: `${calcAgrupadoHeight(totalAtualReal)}%` }}
                    className="w-full rounded-lg shadow-lg transition-all duration-300 relative flex flex-col-reverse overflow-hidden border border-amber-500/40 group-hover:brightness-110"
                  >
                    {/* Fatia 1: ICMS (Base Laranja) */}
                    {pctIcms > 0 && (
                      <div
                        style={{ height: `${pctIcms}%` }}
                        className="w-full bg-gradient-to-t from-amber-600 to-amber-500 relative border-t border-amber-400/40"
                        title={`ICMS: R$ ${(tributosAtuais.icms || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                      />
                    )}
                    {/* Fatia 2: ISS (Amarelo) */}
                    {pctIss > 0 && (
                      <div
                        style={{ height: `${pctIss}%` }}
                        className="w-full bg-gradient-to-t from-yellow-500 to-yellow-400 relative border-t border-yellow-300/40"
                        title={`ISS: R$ ${(tributosAtuais.iss || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                      />
                    )}
                    {/* Fatia 3: IPI (Roxo) */}
                    {pctIpi > 0 && (
                      <div
                        style={{ height: `${pctIpi}%` }}
                        className="w-full bg-gradient-to-t from-purple-600 to-purple-500 relative border-t border-purple-300/40"
                        title={`IPI: R$ ${(tributosAtuais.ipi || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                      />
                    )}
                    {/* Fatia 4: PIS / COFINS (Azul Claro) */}
                    {pctPisCofins > 0 && (
                      <div
                        style={{ height: `${pctPisCofins}%` }}
                        className="w-full bg-gradient-to-t from-sky-500 to-sky-400 relative"
                        title={`PIS/COFINS: R$ ${totalPisCofins.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                      />
                    )}
                    <div className="absolute inset-x-0 top-0 h-1 bg-white/40" />
                  </div>
                </div>

                <div className="mt-2.5 text-center w-full px-1">
                  <span className="text-[11px] font-bold text-amber-300 block truncate">Regime Atual</span>
                  <span className="text-[9px] text-slate-500 block truncate font-mono">ICMS + ISS + IPI + PIS/COF</span>
                </div>
              </div>

              {/* Barra 4: Tributos Reforma RTC (STACKED EMPILHADA COM IBS + CBS + IS) */}
              <div
                onMouseEnter={() => setHoveredSegment('reforma')}
                onMouseLeave={() => setHoveredSegment(null)}
                className="flex flex-col items-center h-full justify-end group cursor-pointer relative"
              >
                {/* Tooltip Detalhado no Hover */}
                {hoveredSegment === 'reforma' && (
                  <div className="absolute -top-3 z-30 transform -translate-y-full w-64 p-3 rounded-xl bg-slate-950/98 border border-cyan-500/60 shadow-2xl text-xs space-y-2 pointer-events-none backdrop-blur-md animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-cyan-300 text-[11px]">Reforma Tributária (RTC)</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full font-mono bg-cyan-950 text-cyan-200 border border-cyan-800">
                        {((totalReformaReal / baseValue) * 100).toFixed(2)}% Carga
                      </span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-cyan-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> IBS (Estadual/Municipal):
                        </span>
                        <span className="font-bold text-white">
                          R$ {(tributosReforma.ibs || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ({pctIbs.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-blue-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> CBS (Federal):
                        </span>
                        <span className="font-bold text-white">
                          R$ {(tributosReforma.cbs || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ({pctCbs.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-rose-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Imposto Seletivo (IS):
                        </span>
                        <span className="font-bold text-white">
                          R$ {(tributosReforma.is || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ({pctIs.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-2 text-center transition-transform group-hover:scale-105">
                  <span className="text-[11px] sm:text-xs font-black font-mono block truncate max-w-[150px] text-cyan-300">
                    {totalReformaReal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border inline-block mt-0.5 bg-cyan-950/80 text-cyan-300 border-cyan-700/60">
                    {((totalReformaReal / baseValue) * 100).toFixed(1)}% Carga
                  </span>
                </div>

                {/* Coluna Empilhada Reforma */}
                <div className="w-full max-w-[80px] sm:max-w-[95px] flex items-end justify-center h-44 sm:h-52 bg-slate-950/40 rounded-xl p-1 border border-slate-800/80 shadow-inner">
                  <div
                    style={{ height: `${calcAgrupadoHeight(totalReformaReal)}%` }}
                    className="w-full rounded-lg shadow-lg transition-all duration-300 relative flex flex-col-reverse overflow-hidden border border-cyan-500/40 group-hover:brightness-110"
                  >
                    {/* Fatia 1: IBS (Ciano) */}
                    {pctIbs > 0 && (
                      <div
                        style={{ height: `${pctIbs}%` }}
                        className="w-full bg-gradient-to-t from-cyan-500 to-cyan-400 relative border-t border-cyan-300/40"
                        title={`IBS: R$ ${(tributosReforma.ibs || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                      />
                    )}
                    {/* Fatia 2: CBS (Azul) */}
                    {pctCbs > 0 && (
                      <div
                        style={{ height: `${pctCbs}%` }}
                        className="w-full bg-gradient-to-t from-blue-600 to-blue-500 relative border-t border-blue-400/40"
                        title={`CBS: R$ ${(tributosReforma.cbs || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                      />
                    )}
                    {/* Fatia 3: IS (Rosa Seletivo) */}
                    {pctIs > 0 && (
                      <div
                        style={{ height: `${pctIs}%` }}
                        className="w-full bg-gradient-to-t from-rose-600 to-rose-500 relative"
                        title={`IS: R$ ${(tributosReforma.is || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                      />
                    )}
                    <div className="absolute inset-x-0 top-0 h-1 bg-white/40" />
                  </div>
                </div>

                <div className="mt-2.5 text-center w-full px-1">
                  <span className="text-[11px] font-bold text-cyan-300 block truncate">Reforma (RTC)</span>
                  <span className="text-[9px] text-slate-500 block truncate font-mono">IBS + CBS + Seletivo</span>
                </div>
              </div>

              {/* Barra 5: Crédito Estimado IBS / CBS */}
              <div className="flex flex-col items-center h-full justify-end group cursor-pointer relative">
                <div className="mb-2 text-center transition-transform group-hover:scale-105">
                  <span className="text-[11px] sm:text-xs font-black font-mono block truncate max-w-[150px] text-purple-300">
                    {creditoIbsCbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border inline-block mt-0.5 bg-purple-950/80 text-purple-300 border-purple-700/60">
                    {((creditoIbsCbs / baseValue) * 100).toFixed(1)}% Base
                  </span>
                </div>
                <div className="w-full max-w-[80px] sm:max-w-[95px] flex items-end justify-center h-44 sm:h-52 bg-slate-950/40 rounded-xl p-1 border border-slate-800/80 shadow-inner">
                  <div
                    style={{ height: `${calcAgrupadoHeight(creditoIbsCbs)}%` }}
                    className="w-full rounded-lg bg-gradient-to-t from-indigo-500 to-purple-600 border-t-2 border-purple-400/60 shadow-lg transition-all duration-300 relative group-hover:brightness-125"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-white/40" />
                  </div>
                </div>
                <div className="mt-2.5 text-center w-full px-1">
                  <span className="text-[11px] font-bold text-slate-200 block truncate">Crédito Estimado</span>
                  <span className="text-[9px] text-slate-500 block truncate font-mono">IBS + CBS Apropriável</span>
                </div>
              </div>

            </div>
          </div>

          {/* Legenda Colorida Explicativa das Fatias Empilhadas */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5 text-[11px] font-mono">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Fatias do Regime Atual:</span>
              <span className="flex items-center gap-1 text-amber-300">
                <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block shadow-sm" /> ICMS: R$ {(tributosAtuais.icms || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </span>
              <span className="flex items-center gap-1 text-yellow-300">
                <span className="w-2.5 h-2.5 rounded bg-yellow-400 inline-block shadow-sm" /> ISS: R$ {(tributosAtuais.iss || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </span>
              <span className="flex items-center gap-1 text-purple-300">
                <span className="w-2.5 h-2.5 rounded bg-purple-500 inline-block shadow-sm" /> IPI: R$ {(tributosAtuais.ipi || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </span>
              <span className="flex items-center gap-1 text-sky-300">
                <span className="w-2.5 h-2.5 rounded bg-sky-400 inline-block shadow-sm" /> PIS/COF: R$ {totalPisCofins.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t sm:border-t-0 sm:border-l border-slate-800 pt-1.5 sm:pt-0 sm:pl-3">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Fatias da Reforma:</span>
              <span className="flex items-center gap-1 text-cyan-300">
                <span className="w-2.5 h-2.5 rounded bg-cyan-400 inline-block shadow-sm" /> IBS: R$ {(tributosReforma.ibs || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </span>
              <span className="flex items-center gap-1 text-blue-300">
                <span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block shadow-sm" /> CBS: R$ {(tributosReforma.cbs || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </span>
              <span className="flex items-center gap-1 text-rose-300">
                <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block shadow-sm" /> IS: R$ {(tributosReforma.is || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODO 2: VISÃO DETALHADA POR TRIBUTO INDIVIDUAL
      ======================================================== */}
      {viewMode === 'detalhada' && (
        <div className="space-y-4">
          <div className="relative pt-6 pb-2">
            {/* Linhas guias */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 pt-6 pb-12">
              <div className="border-b border-dashed border-slate-600 w-full" />
              <div className="border-b border-dashed border-slate-600 w-full" />
              <div className="border-b border-dashed border-slate-600 w-full" />
            </div>

            {/* 10 Colunas Individuais */}
            <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2 h-64 sm:h-72 relative items-end">
              {individualBars.map((bar) => {
                const heightPercent = calcIndividualHeight(bar.value);
                const isHovered = hoveredSegment === bar.id;

                return (
                  <div
                    key={bar.id}
                    onMouseEnter={() => setHoveredSegment(bar.id)}
                    onMouseLeave={() => setHoveredSegment(null)}
                    className="flex flex-col items-center h-full justify-end group cursor-pointer relative"
                  >
                    {/* Tooltip no Hover */}
                    {isHovered && (
                      <div className="absolute -top-3 z-30 transform -translate-y-full w-48 p-2.5 rounded-xl bg-slate-950/98 border border-slate-700 shadow-2xl text-xs space-y-1.5 pointer-events-none backdrop-blur-md animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1 font-bold">
                          <span className="text-white text-[11px]">{bar.label}</span>
                          <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-300 font-mono">{bar.group}</span>
                        </div>
                        <div className="font-mono">
                          <div className="text-white font-bold text-xs">
                            R$ {bar.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {((bar.value / baseValue) * 100).toFixed(2)}% do Volume Líquido
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mb-1.5 text-center transition-transform group-hover:scale-105">
                      <span className={`text-[10px] font-black font-mono block truncate max-w-[90px] ${bar.text}`}>
                        {bar.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-[8px] font-mono text-slate-400 block">
                        {((bar.value / baseValue) * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div className="w-full max-w-[55px] flex items-end justify-center h-44 sm:h-52 bg-slate-950/40 rounded-xl p-0.5 border border-slate-800/80 shadow-inner">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-lg bg-gradient-to-t ${bar.color} border-t-2 ${bar.border} shadow-lg transition-all duration-300 relative group-hover:brightness-125`}
                      >
                        <div className="absolute inset-x-0 top-0 h-0.5 bg-white/40" />
                      </div>
                    </div>

                    <div className="mt-2 text-center w-full px-0.5">
                      <span className={`text-[10px] font-bold block truncate ${bar.text}`} title={bar.label}>
                        {bar.label}
                      </span>
                      <span className="text-[8px] text-slate-500 block truncate font-mono" title={bar.sublabel}>
                        {bar.sublabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Visão detalhada por tributo: análise comparativa direta entre cada componente de carga tributária.</span>
            <span className="text-cyan-400 font-bold">Total Tributos Atuais: R$ {totalAtualReal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} | Total Reforma: R$ {totalReformaReal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      )}

    </div>
  );
};
