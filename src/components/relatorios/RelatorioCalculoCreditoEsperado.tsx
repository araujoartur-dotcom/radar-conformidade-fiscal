import React from 'react';
import { XmlItemDetailReport } from '../../types';
import { Calculator, AlertTriangle, CheckCircle2, TrendingUp, DollarSign } from 'lucide-react';

interface RelatorioCalculoCreditoEsperadoProps {
  items: XmlItemDetailReport[];
  onOpenDetail?: (item: XmlItemDetailReport) => void;
}

export const RelatorioCalculoCreditoEsperado: React.FC<RelatorioCalculoCreditoEsperadoProps> = ({ items, onOpenDetail }) => {
  const totalEsperado = items.reduce((acc, it) => acc + it.creditoEsperadoIbs + it.creditoEsperadoCbs, 0);
  const totalApropriado = items.reduce((acc, it) => acc + it.creditoApropriadoIbs + it.creditoApropriadoCbs, 0);
  const totalDiferenca = totalEsperado - totalApropriado;

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Calculator className="w-4 h-4 text-cyan-400" />
            3) Relatório “Cálculo do Crédito Esperado” (Recálculo Independente IBS / CBS)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Recálculo em motor fiscal independente dos créditos de IBS e CBS comparando diretamente com o valor apropriado nas contas do ERP (SAP / Totvs).
          </p>
        </div>

        {/* Totals Summary */}
        <div className="flex items-center gap-3 font-mono text-xs bg-slate-950 p-2 rounded-xl border border-slate-800">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Crédito Esperado</span>
            <span className="font-bold text-emerald-400">R$ {totalEsperado.toFixed(2)}</span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Crédito Apropriado</span>
            <span className="font-bold text-cyan-400">R$ {totalApropriado.toFixed(2)}</span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Divergência Total</span>
            <span className={`font-bold ${Math.abs(totalDiferenca) > 0.01 ? 'text-amber-400' : 'text-slate-400'}`}>
              R$ {totalDiferenca.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
        <table className="w-full text-left text-xs border-collapse min-w-[1500px]">
          <thead>
            <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider font-mono">
              <th className="p-3">Doc / Item / Chave</th>
              <th className="p-3 text-right">Base Calc. IBS</th>
              <th className="p-3 text-right">Base Calc. CBS</th>
              <th className="p-3 text-center">Alíq. IBS / CBS</th>
              <th className="p-3 text-right">Crédito Esperado IBS / CBS</th>
              <th className="p-3 text-right">Crédito Apropriado IBS / CBS</th>
              <th className="p-3 text-right">Diferença Glosa / Impasse</th>
              <th className="p-3">Fonte Alíquota</th>
              <th className="p-3">Motivo da Divergência</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {items.map((it) => {
              const exp = it.creditoEsperadoIbs + it.creditoEsperadoCbs;
              const apr = it.creditoApropriadoIbs + it.creditoApropriadoCbs;
              const dif = exp - apr;
              const temDiferenca = Math.abs(dif) > 0.01;

              return (
                <tr key={it.id} className={`hover:bg-slate-900/50 transition-colors ${temDiferenca ? 'bg-amber-950/10' : ''}`}>
                  
                  {/* Doc / Item */}
                  <td className="p-3">
                    <div className="font-bold text-white">
                      {it.tipoDoc} {it.numeroSerie} (Item {it.itemNro})
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]" title={it.chaveAcesso}>
                      {it.chaveAcesso}
                    </div>
                  </td>

                  {/* Base Calc IBS */}
                  <td className="p-3 text-right text-slate-200 font-bold">
                    R$ {it.baseIbs.toFixed(2)}
                  </td>

                  {/* Base Calc CBS */}
                  <td className="p-3 text-right text-slate-200 font-bold">
                    R$ {it.baseCbs.toFixed(2)}
                  </td>

                  {/* Aliquotas */}
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-cyan-300 font-bold border border-slate-700 text-[10px]">
                      IBS {it.aliquotaIbs}% / CBS {it.aliquotaCbs}%
                    </span>
                  </td>

                  {/* Crédito Esperado */}
                  <td className="p-3 text-right">
                    <div className="text-xs font-bold text-emerald-400">
                      R$ {exp.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      IBS: R$ {it.creditoEsperadoIbs.toFixed(2)} | CBS: R$ {it.creditoEsperadoCbs.toFixed(2)}
                    </div>
                  </td>

                  {/* Crédito Apropriado */}
                  <td className="p-3 text-right">
                    <div className="text-xs font-bold text-slate-200">
                      R$ {apr.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      IBS: R$ {it.creditoApropriadoIbs.toFixed(2)} | CBS: R$ {it.creditoApropriadoCbs.toFixed(2)}
                    </div>
                  </td>

                  {/* Diferença */}
                  <td className="p-3 text-right">
                    {temDiferenca ? (
                      <div className="px-2 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold text-xs inline-block">
                        R$ {dif.toFixed(2)}
                      </div>
                    ) : (
                      <span className="text-emerald-400 font-bold text-xs">
                        R$ 0,00 (Exato)
                      </span>
                    )}
                  </td>

                  {/* Fonte Aliquota */}
                  <td className="p-3 font-sans">
                    <span className="capitalize px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 text-[10px]">
                      {it.fonteAliquota.replace('_', ' ')}
                    </span>
                  </td>

                  {/* Motivo Diferença */}
                  <td className="p-3 font-sans text-xs text-slate-300">
                    {it.motivoDiferenca || (temDiferenca ? 'Aguardando justificativa de apuração' : 'Conforme regramento oficial')}
                  </td>

                  {/* Ações */}
                  <td className="p-3 text-center font-sans">
                    {onOpenDetail && (
                      <button
                        onClick={() => onOpenDetail(it)}
                        className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-[11px] font-bold cursor-pointer transition-all"
                      >
                        Recalcular
                      </button>
                    )}
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
