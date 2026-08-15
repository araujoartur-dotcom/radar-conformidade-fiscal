import React, { useState } from 'react';
import { XmlItemDetailReport } from '../../types';
import { AlertTriangle, ShieldAlert, CheckCircle2, RefreshCw, FileQuestion, Ban, ArrowRight, UserCheck } from 'lucide-react';

interface RelatorioExcecoesPendenciasProps {
  items: XmlItemDetailReport[];
  onOpenDetail?: (item: XmlItemDetailReport) => void;
}

export const RelatorioExcecoesPendencias: React.FC<RelatorioExcecoesPendenciasProps> = ({ items, onOpenDetail }) => {
  // Filter only items that are exceptions
  const excecoes = items.filter(it => it.isExcecao);

  // Local state for interactive clearing actions (saneamento)
  const [saneamentoStates, setSaneamentoStates] = useState<Record<string, string>>({});

  const handleSaneamento = (id: string, action: string) => {
    setSaneamentoStates(prev => ({ ...prev, [id]: action }));
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            4) Relatório de “Exceções e Pendências de Crédito” (Fila Operacional de Saneamento)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Fila de trabalho diária de saneamento fiscal: bloqueia apropriação indevida e sinaliza inconformidades de XMLs, cancelamentos e cadastros antes do encerramento da apuração no ERP.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-rose-300 bg-rose-950 px-3 py-1 rounded-lg border border-rose-800 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            Pendências Críticas: {excecoes.length}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
        <table className="w-full text-left text-xs border-collapse min-w-[1500px]">
          <thead>
            <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider font-mono">
              <th className="p-3">Doc / Chave / Data</th>
              <th className="p-3">Fornecedor / Emitente</th>
              <th className="p-3">Item / NCM / CFOP</th>
              <th className="p-3">Motivo da Exceção / Impasse</th>
              <th className="p-3">Detalhamento Operacional do Bloqueio</th>
              <th className="p-3 text-right">Crédito em Risco</th>
              <th className="p-3 text-center">Status Saneamento</th>
              <th className="p-3 text-center">Ações de Saneamento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {excecoes.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-emerald-400 font-semibold italic text-xs">
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-400" />
                  Nenhuma exceção ou pendência de crédito localizada nos filtros ativos. Base 100% saneada!
                </td>
              </tr>
            ) : (
              excecoes.map((it) => {
                const acaoAtual = saneamentoStates[it.id] || it.statusSaneamento || 'pendente';
                const creditoRisco = it.creditoEsperadoIbs + it.creditoEsperadoCbs;

                return (
                  <tr key={it.id} className="hover:bg-slate-900/50 transition-colors bg-rose-950/10">
                    
                    {/* Doc / Chave */}
                    <td className="p-3">
                      <div className="font-bold text-white">
                        {it.tipoDoc} {it.numeroSerie} (Item {it.itemNro})
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate max-w-[170px]" title={it.chaveAcesso}>
                        {it.chaveAcesso}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Emissão: {it.dataEmissao}
                      </div>
                    </td>

                    {/* Fornecedor */}
                    <td className="p-3">
                      <div className="font-bold text-slate-200 truncate max-w-[190px]" title={it.fornecedorRazao}>
                        {it.fornecedorRazao}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        CNPJ: {it.fornecedorCnpj} ({it.fornecedorUf})
                      </div>
                    </td>

                    {/* Item */}
                    <td className="p-3">
                      <div className="font-bold text-cyan-300">
                        Item {it.itemNro}: {it.descricaoItem.substring(0, 25)}...
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        NCM: {it.ncm} | CFOP: {it.cfop} | cClass: {it.cClassTrib}
                      </div>
                    </td>

                    {/* Motivo Exceção */}
                    <td className="p-3 font-sans">
                      <span className="px-2 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold text-xs inline-block">
                        {it.tipoExcecao || 'Pendente de Classificação'}
                      </span>
                    </td>

                    {/* Detalhamento */}
                    <td className="p-3 font-sans text-xs text-slate-300 max-w-[300px]">
                      {it.detalheExcecao || it.motivoPadronizado}
                    </td>

                    {/* Crédito em Risco */}
                    <td className="p-3 text-right">
                      <div className="text-xs font-bold text-rose-400">
                        R$ {creditoRisco.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        IBS: R$ {it.creditoEsperadoIbs.toFixed(2)} | CBS: R$ {it.creditoEsperadoCbs.toFixed(2)}
                      </div>
                    </td>

                    {/* Status Saneamento */}
                    <td className="p-3 text-center font-sans">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        acaoAtual === 'saneado' || acaoAtual === 'liberado'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : acaoAtual === 'glosado'
                          ? 'bg-slate-900 text-slate-400 border border-slate-700'
                          : acaoAtual === 'em_analise'
                          ? 'bg-blue-950 text-blue-300 border border-blue-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                      }`}>
                        {acaoAtual === 'saneado' || acaoAtual === 'liberado' ? '✓ Saneado / Liberado' : acaoAtual === 'glosado' ? '✕ Glosado' : acaoAtual === 'em_analise' ? 'Em Análise' : '🚨 Pendente Saneamento'}
                      </span>
                    </td>

                    {/* Ações Saneamento */}
                    <td className="p-3 text-center font-sans">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => handleSaneamento(it.id, 'saneado')}
                          className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 text-[10px] font-bold cursor-pointer transition-all"
                          title="Liberar Crédito após verificação de laudo/evidência"
                        >
                          Liberar
                        </button>

                        <button
                          onClick={() => handleSaneamento(it.id, 'glosado')}
                          className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[10px] font-bold cursor-pointer transition-all"
                          title="Glosar crédito por ausência de idoneidade ou cancelamento"
                        >
                          Glosar
                        </button>

                        {onOpenDetail && (
                          <button
                            onClick={() => onOpenDetail(it)}
                            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-[10px] font-bold cursor-pointer transition-all"
                          >
                            Analisar
                          </button>
                        )}
                      </div>
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
