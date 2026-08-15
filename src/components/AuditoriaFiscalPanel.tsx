import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, Search, FileCheck, RefreshCw, Layers, Calculator, Building2, Eye } from 'lucide-react';
import { DfeXmlItem, CnpjLookupItem } from '../types';
import { DanfeModal } from './DanfeModal';

interface AuditoriaFiscalPanelProps {
  dfeList: DfeXmlItem[];
  lookupItems: CnpjLookupItem[];
}

export const AuditoriaFiscalPanel: React.FC<AuditoriaFiscalPanelProps> = ({ dfeList, lookupItems }) => {
  const [selectedDanfe, setSelectedDanfe] = useState<DfeXmlItem | null>(null);

  // Count stats
  const totalAuditados = dfeList.length;
  const conformes = dfeList.filter(d => d.statusAuditoria === 'conforme').length;
  const inconsistentes = dfeList.filter(d => d.statusAuditoria === 'inconsistente').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950 to-blue-950 border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-700/60 text-emerald-300 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            Motor Inteligente de Cruzamento Cadastral SEFAZ CCC
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Painel de Auditoria Fiscal & Conformidade
          </h2>
          <p className="text-sm text-slate-300 max-w-2xl mt-1">
            Validação automatizada de Inscrição Estadual (Habilitada vs Não Contribuinte/Isento) cruzando XMLs de NFe/NFSe com a base de dados do Cadastro Centralizado de Contribuintes.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-center min-w-[320px]">
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-400">Auditados</div>
            <div className="text-lg font-bold text-white font-mono">{totalAuditados}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-400">100% Conforme</div>
            <div className="text-lg font-bold text-emerald-400 font-mono">{conformes}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-400">Apontamentos</div>
            <div className="text-lg font-bold text-amber-400 font-mono">{inconsistentes}</div>
          </div>
        </div>
      </div>

      {/* Audit Rules Overview */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-lg">
        <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <FileCheck className="w-5 h-5 text-cyan-400" />
          Resultado dos Cruzamentos e Análise de Risco
        </h3>

        <div className="space-y-3">
          {dfeList.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition-all ${
                item.statusAuditoria === 'conforme'
                  ? 'bg-slate-950/80 border-slate-800'
                  : 'bg-amber-950/20 border-amber-800/60'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white px-2 py-0.5 rounded bg-blue-900/80 border border-blue-700">
                      {item.tipo} {item.numero}
                    </span>
                    <span className="text-xs text-slate-300 font-bold">
                      {item.emitenteNome}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 font-mono">
                    CNPJ: {item.emitenteCnpj} | IE no XML: <strong className="text-cyan-300">{item.emitenteIe || 'Não Consta'}</strong> ({item.emitenteUf})
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs font-bold text-emerald-400 font-mono">
                      {item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      IBS/CBS Est: {(item.valorCbs + item.valorIbs).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedDanfe(item)}
                    className="px-2.5 py-1 rounded-lg bg-cyan-950 text-cyan-300 hover:bg-cyan-900 border border-cyan-800 text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                    title="Visualizar DANFE da NF-e"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    DANFE
                  </button>

                  {item.statusAuditoria === 'conforme' ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Conforme
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-xs font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      Apontamento
                    </span>
                  )}
                </div>
              </div>

              {item.alertasAuditoria.length > 0 && (
                <div className="mt-3 pt-2 border-t border-amber-800/40 text-xs text-amber-300 bg-amber-950/40 p-2.5 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-amber-200">Alertas Detectados:</strong>
                    {item.alertasAuditoria.map((a, i) => (
                      <span key={i} className="block mt-0.5">• {a}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <DanfeModal
        item={selectedDanfe}
        onClose={() => setSelectedDanfe(null)}
      />
    </div>
  );
};
