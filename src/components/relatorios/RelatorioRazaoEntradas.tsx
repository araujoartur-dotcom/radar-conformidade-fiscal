import React from 'react';
import { XmlItemDetailReport } from '../../types';
import { CheckCircle2, AlertTriangle, ShieldAlert, FileText, ArrowRight, Tag, Lock, Building2 } from 'lucide-react';

interface RelatorioRazaoEntradasProps {
  items: XmlItemDetailReport[];
  onOpenDetail?: (item: XmlItemDetailReport) => void;
}

export const RelatorioRazaoEntradas: React.FC<RelatorioRazaoEntradasProps> = ({ items, onOpenDetail }) => {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            1) Relatório “Razão de Entradas (Item a Item)” — Relatório-Mãe
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Base única em nível de item contendo o cabeçalho do documento, detalhamento fiscal e impostos projetados da Reforma Tributária (IBS / CBS).
          </p>
        </div>
        <div className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950 px-3 py-1 rounded-lg border border-cyan-800">
          Total de Itens: {items.length}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
        <table className="w-full text-left text-xs border-collapse min-w-[1700px]">
          <thead>
            <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider font-mono">
              <th className="p-3">Doc / Chave / Data</th>
              <th className="p-3">Fornecedor (CNPJ / Razão / UF)</th>
              <th className="p-3">Item # / Descrição / NCM</th>
              <th className="p-3">CFOP / cClassTrib / CST</th>
              <th className="p-3 text-right">Qtd / Val. Líquido</th>
              <th className="p-3 text-right">IBS / CBS Doc</th>
              <th className="p-3 text-right">Crédito IBS / CBS Esperado</th>
              <th className="p-3 text-right">Crédito Apropriado ERP</th>
              <th className="p-3 text-center">Onerosidade</th>
              <th className="p-3 text-center">Status / Regra</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {items.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-500 italic text-xs">
                  Nenhum item localizado com os filtros selecionados.
                </td>
              </tr>
            ) : (
              items.map((it) => {
                const totalCreditoEsperado = it.creditoEsperadoIbs + it.creditoEsperadoCbs;
                const totalCreditoApropriado = it.creditoApropriadoIbs + it.creditoApropriadoCbs;
                const dif = totalCreditoEsperado - totalCreditoApropriado;

                return (
                  <tr key={it.id} className="hover:bg-slate-900/50 transition-colors">
                    
                    {/* Doc / Chave */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px]">
                          {it.tipoDoc}
                        </span>
                        <span>{it.numeroSerie}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[180px]" title={it.chaveAcesso}>
                        {it.chaveAcesso}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Emissão: {it.dataEmissao} | Entr: {it.dataEntrada}
                      </div>
                    </td>

                    {/* Fornecedor */}
                    <td className="p-3">
                      <div className="font-bold text-slate-200 truncate max-w-[200px]" title={it.fornecedorRazao}>
                        {it.fornecedorRazao}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        CNPJ: {it.fornecedorCnpj} ({it.fornecedorUf})
                      </div>
                      <div className="text-[10px] text-indigo-400 font-sans mt-0.5">
                        Empresa Receptora: {it.empresaNome.substring(0, 22)}...
                      </div>
                    </td>

                    {/* Item */}
                    <td className="p-3">
                      <div className="font-bold text-cyan-300 text-xs">
                        Item {it.itemNro}: <span className="font-sans font-semibold text-slate-100">{it.descricaoItem}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        NCM: <span className="text-amber-300 font-bold">{it.ncm}</span> | NatOp: {it.naturezaOperacao}
                      </div>
                    </td>

                    {/* CFOP & cClassTrib */}
                    <td className="p-3">
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="px-1.5 py-0.5 bg-slate-900 text-cyan-300 rounded font-bold border border-slate-700">
                          CFOP {it.cfop}
                        </span>
                        <span className="px-1.5 py-0.5 bg-slate-900 text-amber-300 rounded font-bold border border-slate-700">
                          cClass {it.cClassTrib}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        CST: {it.cstCsosn}
                      </div>
                    </td>

                    {/* Qtd & Val Liquido */}
                    <td className="p-3 text-right">
                      <div className="text-xs font-bold text-slate-100">
                        {it.valorLiquidoItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {it.quantidade} {it.unidade} (Bruto: R$ {it.valorBrutoItem.toFixed(2)})
                      </div>
                    </td>

                    {/* IBS / CBS Doc */}
                    <td className="p-3 text-right">
                      <div className="text-xs font-semibold text-cyan-300">
                        IBS ({it.aliquotaIbs}%): R$ {it.valorIbs.toFixed(2)}
                      </div>
                      <div className="text-xs font-semibold text-indigo-300">
                        CBS ({it.aliquotaCbs}%): R$ {it.valorCbs.toFixed(2)}
                      </div>
                    </td>

                    {/* Crédito Esperado */}
                    <td className="p-3 text-right">
                      <div className="text-xs font-bold text-emerald-400">
                        R$ {totalCreditoEsperado.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        IBS R$ {it.creditoEsperadoIbs.toFixed(2)} | CBS R$ {it.creditoEsperadoCbs.toFixed(2)}
                      </div>
                    </td>

                    {/* Crédito Apropriado ERP */}
                    <td className="p-3 text-right">
                      <div className={`text-xs font-bold ${Math.abs(dif) > 0.01 ? 'text-amber-400' : 'text-slate-200'}`}>
                        R$ {totalCreditoApropriado.toFixed(2)}
                      </div>
                      {Math.abs(dif) > 0.01 && (
                        <div className="text-[10px] text-rose-400 font-bold">
                          Dif: R$ {dif.toFixed(2)}
                        </div>
                      )}
                    </td>

                    {/* Onerosidade */}
                    <td className="p-3 text-center font-sans">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        it.indicadorOnerosidade === 'Oneroso'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : it.indicadorOnerosidade === 'Não Oneroso'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {it.indicadorOnerosidade}
                      </span>
                    </td>

                    {/* Status Regra */}
                    <td className="p-3 text-center font-sans">
                      {it.isExcecao ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          Exceção
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Regular
                        </span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="p-3 text-center font-sans">
                      {onOpenDetail && (
                        <button
                          onClick={() => onOpenDetail(it)}
                          className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-[11px] font-bold cursor-pointer transition-all"
                        >
                          Detalhes
                        </button>
                      )}
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
