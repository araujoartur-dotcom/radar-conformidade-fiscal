import React from 'react';
import { XmlItemDetailReport } from '../../types';
import { ShieldCheck, AlertTriangle, HelpCircle, CheckCircle2, XCircle, Info } from 'lucide-react';

interface RelatorioMatrizElegibilidadeProps {
  items: XmlItemDetailReport[];
  onOpenDetail?: (item: XmlItemDetailReport) => void;
}

export const RelatorioMatrizElegibilidade: React.FC<RelatorioMatrizElegibilidadeProps> = ({ items, onOpenDetail }) => {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            2) Relatório “Matriz de Elegibilidade (CFOP + cClassTrib + Onerosidade)”
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Explicação auditável de porque cada item é ou não creditável, com indicação da regra corporativa aplicada (ID de Regra) e trilha de evidências.
          </p>
        </div>
      </div>

      {/* Practical Rules Reference Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="font-bold text-cyan-300 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> A. Checagem de CFOP
          </div>
          <p className="text-slate-400 text-[11px]">
            Devolução (retorno espelho), Transferência (não onerosa) e Remessa (conserto/comodato) bloqueiam crédito automático.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="font-bold text-amber-300 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> B. Coerência cClassTrib
          </div>
          <p className="text-slate-400 text-[11px]">
            Tributação indicada com imposto zerado gera alerta de divergência; isenção indicada com imposto destacado sinaliza erro de fornecedor.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="font-bold text-emerald-300 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> C. Regra de Onerosidade
          </div>
          <p className="text-slate-400 text-[11px]">
            Itens não onerosos (valor líquido R$ 0) não geram crédito regular de entrada salvo regras de contraprestação específica.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
        <table className="w-full text-left text-xs border-collapse min-w-[1600px]">
          <thead>
            <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider font-mono">
              <th className="p-3">Doc / Item</th>
              <th className="p-3">CFOP / cClassTrib</th>
              <th className="p-3">Indicador Onerosidade</th>
              <th className="p-3">Tipo Aquisição / Destinação</th>
              <th className="p-3">Regra Aplicada ID</th>
              <th className="p-3 text-center">Resultado Elegibilidade</th>
              <th className="p-3">Motivo Padronizado</th>
              <th className="p-3">Evidência Vinculada</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {items.map((it) => (
              <tr key={it.id} className="hover:bg-slate-900/50 transition-colors">
                
                {/* Doc / Item */}
                <td className="p-3">
                  <div className="font-bold text-white">
                    {it.tipoDoc} {it.numeroSerie} (Item {it.itemNro})
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]" title={it.chaveAcesso}>
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

                {/* Onerosidade */}
                <td className="p-3 font-sans">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                    it.indicadorOnerosidade === 'Oneroso'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : it.indicadorOnerosidade === 'Não Oneroso'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {it.indicadorOnerosidade}
                  </span>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {it.criterioOnerosidade}
                  </div>
                </td>

                {/* Tipo Aquisição / Destinação */}
                <td className="p-3 font-sans">
                  <div className="font-bold text-slate-200 capitalize">
                    {it.tipoAquisicao}
                  </div>
                  <div className="text-[10px] text-slate-400 capitalize">
                    Dest: {it.destinacao.replace('_', ' ')}
                  </div>
                </td>

                {/* Regra ID */}
                <td className="p-3 font-mono">
                  <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold text-[11px]">
                    {it.regraAplicadaId}
                  </span>
                </td>

                {/* Resultado Elegibilidade */}
                <td className="p-3 text-center font-sans">
                  {it.resultadoElegibilidade === 'Elegível' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Elegível
                    </span>
                  ) : it.resultadoElegibilidade === 'Não elegível' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-xs font-bold">
                      <XCircle className="w-3.5 h-3.5 text-rose-400" /> Não Elegível
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-xs font-bold">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-400" /> {it.resultadoElegibilidade}
                    </span>
                  )}
                </td>

                {/* Motivo Padronizado */}
                <td className="p-3 font-sans text-slate-300">
                  {it.motivoPadronizado}
                </td>

                {/* Evidência */}
                <td className="p-3 font-sans text-xs text-slate-400">
                  {it.evidencia}
                </td>

                {/* Ações */}
                <td className="p-3 text-center font-sans">
                  {onOpenDetail && (
                    <button
                      onClick={() => onOpenDetail(it)}
                      className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-[11px] font-bold cursor-pointer transition-all"
                    >
                      Audit
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
