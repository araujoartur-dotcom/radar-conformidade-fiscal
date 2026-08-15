import React from 'react';
import { XmlItemDetailReport } from '../../types';
import { Scale, CheckCircle2, AlertTriangle, XCircle, FileCheck, HelpCircle } from 'lucide-react';

interface RelatorioOnerosidadeProps {
  items: XmlItemDetailReport[];
  onOpenDetail?: (item: XmlItemDetailReport) => void;
}

export const RelatorioOnerosidade: React.FC<RelatorioOnerosidadeProps> = ({ items, onOpenDetail }) => {
  const onerosos = items.filter(i => i.indicadorOnerosidade === 'Oneroso').length;
  const naoOnerosos = items.filter(i => i.indicadorOnerosidade === 'Não Oneroso').length;
  const mistosIndet = items.filter(i => i.indicadorOnerosidade === 'Misto' || i.indicadorOnerosidade === 'Indeterminado').length;

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Scale className="w-4 h-4 text-cyan-400" />
            8) Relatório “Onerosidade — Auditoria e Evidências”
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Evita o erro nº 1 na Reforma Tributária: apropriação indevida de crédito em aquisições sem contraprestação onerosa real ou documentação financeira vinculada.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
            Onerosos: {onerosos}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-rose-950 text-rose-300 border border-rose-800 font-bold">
            Não Onerosos: {naoOnerosos}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-950 text-amber-300 border border-amber-800 font-bold">
            Misto / Indet: {mistosIndet}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
        <table className="w-full text-left text-xs border-collapse min-w-[1500px]">
          <thead>
            <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider font-mono">
              <th className="p-3">Doc / Chave / Item</th>
              <th className="p-3">CFOP / cClassTrib</th>
              <th className="p-3 text-right">Valor Bruto</th>
              <th className="p-3 text-right">Desconto</th>
              <th className="p-3 text-right">Valor Líquido</th>
              <th className="p-3 text-center">Evidência de Cobrança (Fatura/Contrato)</th>
              <th className="p-3 text-center">Indicador Onerosidade</th>
              <th className="p-3">Critério da Onerosidade</th>
              <th className="p-3 text-center">Tratamento do Crédito</th>
              <th className="p-3">Justificativa / Documento Suporte</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {items.map((it) => (
              <tr key={it.id} className="hover:bg-slate-900/50 transition-colors">
                
                {/* Doc / Chave */}
                <td className="p-3">
                  <div className="font-bold text-white">
                    {it.tipoDoc} {it.numeroSerie} (Item {it.itemNro})
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate max-w-[160px]" title={it.chaveAcesso}>
                    {it.chaveAcesso}
                  </div>
                </td>

                {/* CFOP / cClassTrib */}
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 bg-slate-900 text-cyan-300 rounded font-bold border border-slate-700">
                      CFOP {it.cfop}
                    </span>
                    <span className="px-1.5 py-0.5 bg-slate-900 text-amber-300 rounded font-bold border border-slate-700">
                      cClass {it.cClassTrib}
                    </span>
                  </div>
                </td>

                {/* Valor Bruto */}
                <td className="p-3 text-right text-slate-300">
                  R$ {it.valorBrutoItem.toFixed(2)}
                </td>

                {/* Desconto */}
                <td className="p-3 text-right text-rose-300">
                  R$ {it.descontoIncondicional.toFixed(2)}
                </td>

                {/* Valor Liquido */}
                <td className="p-3 text-right text-emerald-400 font-bold">
                  R$ {it.valorLiquidoItem.toFixed(2)}
                </td>

                {/* Evidencia Cobrança */}
                <td className="p-3 text-center font-sans font-bold">
                  {it.evidenciaCobranca ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px]">
                      <FileCheck className="w-3.5 h-3.5 text-emerald-400" /> SIM (Fatura/Duplicata)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 text-[10px]">
                      NÃO / N/A
                    </span>
                  )}
                </td>

                {/* Indicador Onerosidade */}
                <td className="p-3 text-center font-sans">
                  <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${
                    it.indicadorOnerosidade === 'Oneroso'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : it.indicadorOnerosidade === 'Não Oneroso'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {it.indicadorOnerosidade}
                  </span>
                </td>

                {/* Criterio */}
                <td className="p-3 font-sans text-xs text-slate-300">
                  {it.criterioOnerosidade}
                </td>

                {/* Tratamento Credito */}
                <td className="p-3 text-center font-sans">
                  {it.indicadorOnerosidade === 'Oneroso' && it.resultadoElegibilidade === 'Elegível' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Permitido
                    </span>
                  ) : it.indicadorOnerosidade === 'Não Oneroso' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold">
                      <XCircle className="w-3.5 h-3.5 text-rose-400" /> Bloqueado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-400" /> Em Análise
                    </span>
                  )}
                </td>

                {/* Justificativa */}
                <td className="p-3 font-sans text-xs text-slate-400">
                  {it.evidencia || 'Auditado via webservice NFe'}
                </td>

                {/* Ações */}
                <td className="p-3 text-center font-sans">
                  {onOpenDetail && (
                    <button
                      onClick={() => onOpenDetail(it)}
                      className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-[11px] font-bold cursor-pointer transition-all"
                    >
                      Evidências
                    </button>
                  )}
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
