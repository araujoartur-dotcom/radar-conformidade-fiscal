import React, { useState } from 'react';
import {
  X, DownloadCloud, FileArchive, CheckCircle2, AlertTriangle,
  Layers, FileSpreadsheet, ShieldCheck, Sparkles, Clock, Calendar,
  Building2, ArrowRight, Zap, Loader2, Info
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getApiBaseUrl } from '../utils/apiConfig';

interface ExportacaoFiscalModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalDocsAvailable?: number;
}

export const ExportacaoFiscalModal: React.FC<ExportacaoFiscalModalProps> = ({
  isOpen,
  onClose,
  totalDocsAvailable = 21482
}) => {
  const { token, empresaAtiva } = useAuth();
  
  const [periodo, setPeriodo] = useState<'60days' | 'ano_atual' | 'completo' | 'custom'>('60days');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  
  const [tipos, setTipos] = useState<{ nfe: boolean; cte: boolean; nfse: boolean; nfce: boolean }>({
    nfe: true,
    cte: true,
    nfse: true,
    nfce: true
  });
  
  const [incluirPlanilha, setIncluirPlanilha] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);
  const [downloadedInfo, setDownloadedInfo] = useState<{ fileName: string; sizeMb: string; totalDocs: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const handleToggleTipo = (key: keyof typeof tipos) => {
    setTipos(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleStartExport = async () => {
    setIsExporting(true);
    setExportProgress(15);
    setExportSuccess(false);
    setErrorMsg('');
    setDownloadedInfo(null);

    const selectedTipos: string[] = [];
    if (tipos.nfe) selectedTipos.push('NFe');
    if (tipos.cte) selectedTipos.push('CTe');
    if (tipos.nfse) selectedTipos.push('NFSe');
    if (tipos.nfce) selectedTipos.push('NFCe');

    if (selectedTipos.length === 0) {
      setErrorMsg('Selecione ao menos um modelo de documento fiscal para exportar.');
      setIsExporting(false);
      return;
    }

    try {
      setExportProgress(35);
      
      const response = await fetch(`${getApiBaseUrl()}/export/fiscal-zip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          periodo,
          dataInicio: periodo === 'custom' ? dataInicio : undefined,
          dataFim: periodo === 'custom' ? dataFim : undefined,
          tipos: selectedTipos,
          incluirPlanilha,
          empresaId: empresaAtiva?.id
        })
      });

      setExportProgress(75);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: 'Falha na exportação' }));
        throw new Error(errJson.error || `Erro ${response.status} ao gerar pacote fiscal.`);
      }

      const totalDocsHeader = response.headers.get('X-Total-Docs');
      const totalDocsCount = totalDocsHeader ? parseInt(totalDocsHeader, 10) : totalDocsAvailable;

      const blob = await response.blob();
      setExportProgress(95);

      const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);
      const safeCnpj = (empresaAtiva?.cnpjCompleto || 'GERAL').replace(/\D/g, '');
      const defaultFileName = `Auditoria_Fiscal_${safeCnpj}_${periodo}_${new Date().toISOString().split('T')[0]}.zip`;

      // Trigger browser download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setExportProgress(100);
      setExportSuccess(true);
      setDownloadedInfo({
        fileName: defaultFileName,
        sizeMb: `${sizeMb} MB`,
        totalDocs: totalDocsCount
      });
    } catch (err: any) {
      console.error('Erro na exportação:', err);
      setErrorMsg(err.message || 'Erro inesperado ao gerar arquivo ZIP.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-md">
              <FileArchive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-tight">
                  Exportador Fiscal Turbo (.ZIP)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Pronto para SEFAZ / Receita
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Empacotamento em streaming concorrente para auditoria e intimações fiscais.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          
          {/* Info Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3 text-xs text-slate-300">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white block mb-0.5">
                Estrutura Fiscal Padronizada:
              </span>
              Os XMLs são organizados automaticamente em pastas por modelo e competência (`/NFe/`, `/CTe/`, `/NFSe/`) com manifesto consolidado em Excel pronto para entrega.
            </div>
          </div>

          {/* 1. Seleção do Período */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              1. Selecione o Período de Extração
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              
              <button
                type="button"
                onClick={() => setPeriodo('60days')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  periodo === '60days'
                    ? 'bg-blue-950/70 border-cyan-500 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-white">Últimos 60 Dias</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5" /> Hot Cache
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block">
                  Conferência mensal e fechamento corrente (&lt; 5ms)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPeriodo('ano_atual')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  periodo === 'ano_atual'
                    ? 'bg-blue-950/70 border-cyan-500 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-white">Ano Atual (2026)</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                    Ano Fiscal
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block">
                  Todos os XMLs emitidos no exercício fiscal de 2026
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPeriodo('completo')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  periodo === 'completo'
                    ? 'bg-blue-950/70 border-cyan-500 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-white">Base Completa</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                    {totalDocsAvailable.toLocaleString('pt-BR')} Docs
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block">
                  Todos os 21k+ documentos armazenados no banco
                </span>
              </button>

            </div>
          </div>

          {/* 2. Modelos de Documento Fiscal */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              2. Modelos de DF-e Inclusos no Pacote
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              
              <div
                onClick={() => handleToggleTipo('nfe')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center gap-2.5 ${
                  tipos.nfe ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-200' : 'bg-slate-950 border-slate-800 text-slate-500 opacity-60'
                }`}
              >
                <input type="checkbox" checked={tipos.nfe} onChange={() => {}} className="rounded accent-cyan-500" />
                <div>
                  <strong className="text-xs block text-white font-bold">NF-e (Mod 55)</strong>
                  <span className="text-[10px] text-slate-400">Mercadorias</span>
                </div>
              </div>

              <div
                onClick={() => handleToggleTipo('cte')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center gap-2.5 ${
                  tipos.cte ? 'bg-indigo-950/40 border-indigo-500/60 text-indigo-200' : 'bg-slate-950 border-slate-800 text-slate-500 opacity-60'
                }`}
              >
                <input type="checkbox" checked={tipos.cte} onChange={() => {}} className="rounded accent-indigo-500" />
                <div>
                  <strong className="text-xs block text-white font-bold">CT-e (Mod 57)</strong>
                  <span className="text-[10px] text-slate-400">Transportes</span>
                </div>
              </div>

              <div
                onClick={() => handleToggleTipo('nfse')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center gap-2.5 ${
                  tipos.nfse ? 'bg-purple-950/40 border-purple-500/60 text-purple-200' : 'bg-slate-950 border-slate-800 text-slate-500 opacity-60'
                }`}
              >
                <input type="checkbox" checked={tipos.nfse} onChange={() => {}} className="rounded accent-purple-500" />
                <div>
                  <strong className="text-xs block text-white font-bold">NFS-e</strong>
                  <span className="text-[10px] text-slate-400">Serviços / Retenções</span>
                </div>
              </div>

              <div
                onClick={() => handleToggleTipo('nfce')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center gap-2.5 ${
                  tipos.nfce ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200' : 'bg-slate-950 border-slate-800 text-slate-500 opacity-60'
                }`}
              >
                <input type="checkbox" checked={tipos.nfce} onChange={() => {}} className="rounded accent-emerald-500" />
                <div>
                  <strong className="text-xs block text-white font-bold">NFC-e (Mod 65)</strong>
                  <span className="text-[10px] text-slate-400">Varejo</span>
                </div>
              </div>

            </div>
          </div>

          {/* 3. Opções Adicionais */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <strong className="text-xs text-white font-bold block">
                  Incluir Manifesto e Sumário Analítico em Excel (.XLSX)
                </strong>
                <span className="text-[11px] text-slate-400">
                  Gera a planilha com totais tributários da Reforma (CBS/IBS/IS) e relação de todas as notas.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={incluirPlanilha}
              onChange={(e) => setIncluirPlanilha(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Progress / Status Feedback */}
          {isExporting && (
            <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-800 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs text-cyan-300 font-bold">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  Gerando pacote ZIP em fluxo contínuo...
                </span>
                <span className="font-mono">{exportProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}

          {exportSuccess && downloadedInfo && (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800 flex items-start gap-3 text-xs text-emerald-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-bold">Pacote Fiscal Baixado com Sucesso!</strong>
                <span>
                  Arquivo <strong>{downloadedInfo.fileName}</strong> ({downloadedInfo.sizeMb}) contendo {downloadedInfo.totalDocs.toLocaleString('pt-BR')} documentos fiscais.
                </span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800 flex items-start gap-3 text-xs text-rose-200">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-bold">Falha na Exportação:</strong>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            Fechar
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleStartExport}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-extrabold shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Compactando e Baixando...</span>
              </>
            ) : (
              <>
                <DownloadCloud className="w-4 h-4" />
                <span>Gerar e Baixar Pacote (.ZIP)</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
