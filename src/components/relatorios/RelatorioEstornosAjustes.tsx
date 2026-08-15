import React from 'react';
import { XmlItemDetailReport } from '../../types';
import { RefreshCw, RotateCcw, AlertTriangle, CheckCircle2, ShieldAlert, ArrowLeftRight } from 'lucide-react';

interface RelatorioEstornosAjustesProps {
  items: XmlItemDetailReport[];
  onOpenDetail?: (item: XmlItemDetailReport) => void;
}

export const RelatorioEstornosAjustes: React.FC<RelatorioEstornosAjustesProps> = ({ items, onOpenDetail }) => {
  // Filter items that have event affecting credit
  const eventosCredito = items.filter(it => it.temEventoAfetaCredito || it.situacaoDoc === 'cancelado' || it.situacaoDoc === 'substituido');

  const totalOriginal = eventosCredito.reduce((acc, it) => acc + it.creditoOriginalTotal, 0);
  const totalEstornado = eventosCredito.reduce((acc, it) => acc + it.creditoEstornadoTotal, 0);
  const pendenteEstorno = totalOriginal - totalEstornado;

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-cyan-400" />
            5) Relatório “Estornos / Ajustes / Eventos que Afetam Crédito”
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Controle do ciclo de vida dos créditos apropriados: monitora eventos pós-emissão (cancelamento, devolução, carta de correção, NF substituta e ajustes manuais).
          </p>
        </div>

        {/* Header KPI Stats */}
        <div className="flex items-center gap-3 font-mono text-xs bg-slate-950 p-2 rounded-xl border border-slate-800">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Crédito Original</span>
            <span className="font-bold text-slate-200">R$ {totalOriginal.toFixed(2)}</span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Crédito Estornado</span>
            <span className="font-bold text-emerald-400">R$ {totalEstornado.toFixed(2)}</span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Pendente de Estorno</span>
            <span className={`font-bold ${pendenteEstorno > 0.01 ? 'text-rose-400' : 'text-slate-400'}`}>
              R$ {pendenteEstorno.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
        <table className="w-full text-left text-xs border-collapse min-w-[1500px]">
          <thead>
            <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider font-mono">
              <th className="p-3">Evento Gerador</th>
              <th className="p-3">Chave Origem x Chave Evento</th>
              <th className="p-3">Doc / Item #</th>
              <th className="p-3 text-right">Crédito Original (IBS+CBS)</th>
              <th className="p-3 text-right">Crédito Estornado ERP</th>
              <th className="p-3 text-center">Status do Estorno</th>
              <th className="p-3">Data Evento / Competência</th>
              <th className="p-3">Motivo / Justificativa</th>
              <th className="p-3">Usuário / Workflow</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {eventosCredito.map((it) => {
              const pend = it.creditoOriginalTotal - it.creditoEstornadoTotal;
              const estaSaneado = pend <= 0.01;

              return (
                <tr key={it.id} className={`hover:bg-slate-900/50 transition-colors ${!estaSaneado ? 'bg-rose-950/20' : ''}`}>
                  
                  {/* Evento Gerador */}
                  <td className="p-3 font-sans">
                    <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold border ${
                      it.tipoEventoAfetaCredito === 'Cancelamento' || it.situacaoDoc === 'cancelado'
                        ? 'bg-rose-950 text-rose-300 border-rose-800'
                        : it.tipoEventoAfetaCredito === 'Devolução'
                        ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                        : 'bg-amber-950 text-amber-300 border-amber-800'
                    }`}>
                      {it.tipoEventoAfetaCredito || (it.situacaoDoc === 'cancelado' ? 'Cancelamento' : 'Ajuste Manual')}
                    </span>
                  </td>

                  {/* Chave Origem vs Evento */}
                  <td className="p-3">
                    <div className="text-[10px] text-slate-400">
                      Origem: <span className="font-mono text-cyan-300 truncate inline-block max-w-[140px]" title={it.chaveDocOriginal || it.chaveAcesso}>{it.chaveDocOriginal || it.chaveAcesso}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Evento: <span className="font-mono text-amber-300 truncate inline-block max-w-[140px]" title={it.chaveDocEvento || 'S/N'}>{it.chaveDocEvento || 'S/N (Ajuste Direto)'}</span>
                    </div>
                  </td>

                  {/* Doc / Item */}
                  <td className="p-3 font-bold text-slate-200">
                    {it.tipoDoc} {it.numeroSerie} (Item {it.itemNro})
                  </td>

                  {/* Crédito Original */}
                  <td className="p-3 text-right font-bold text-slate-300">
                    R$ {it.creditoOriginalTotal.toFixed(2)}
                  </td>

                  {/* Crédito Estornado */}
                  <td className="p-3 text-right font-bold text-emerald-400">
                    R$ {it.creditoEstornadoTotal.toFixed(2)}
                  </td>

                  {/* Status */}
                  <td className="p-3 text-center font-sans">
                    {estaSaneado ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Estornado / Conforme
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Estorno Pendente!
                      </span>
                    )}
                  </td>

                  {/* Data / Comp */}
                  <td className="p-3 text-slate-300">
                    {it.dataEventoAfetaCredito || it.dataEmissao} ({it.competencia})
                  </td>

                  {/* Motivo */}
                  <td className="p-3 font-sans text-xs text-slate-300 max-w-[220px]">
                    {it.motivoDiferenca || it.motivoPadronizado}
                  </td>

                  {/* Usuario / Workflow */}
                  <td className="p-3 font-sans text-xs text-slate-400">
                    <div>{it.usuarioAprovacaoEvento || it.usuarioCaptura}</div>
                    <div className="text-[10px] text-slate-500">{it.rotinaCaptura}</div>
                  </td>

                  {/* Ações */}
                  <td className="p-3 text-center font-sans">
                    {onOpenDetail && (
                      <button
                        onClick={() => onOpenDetail(it)}
                        className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-[11px] font-bold cursor-pointer transition-all"
                      >
                        Ajustar
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
