import React, { useRef } from 'react';
import { FileUp, Download, CheckCircle2, AlertTriangle, Clock, Layers, FileSpreadsheet, Sparkles, Sliders, Play, Pause, Square, Trash2 } from 'lucide-react';
import { BatchStats } from '../types';
import { downloadSampleExcel } from '../utils/excel';

interface ConsultaLotePanelProps {
  onFileUpload: (file: File) => void;
  fileName?: string;
  stats: BatchStats;
  rateLimit: number;
  setRateLimit: (limit: number) => void;
  isProcessing: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onCancel: () => void;
  onClear: () => void;
  onExport: () => void;
}

export const ConsultaLotePanel: React.FC<ConsultaLotePanelProps> = ({
  onFileUpload,
  fileName,
  stats,
  rateLimit,
  setRateLimit,
  isProcessing,
  isPaused,
  onStart,
  onPause,
  onCancel,
  onClear,
  onExport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.csv') || file.name.endsWith('.xls'))) {
      onFileUpload(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  return (
    <div 
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="glass-panel-glow rounded-2xl p-5 flex flex-col gap-4"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-400" />
            <span>Consulta em Lote (Excel / CSV)</span>
          </h2>
          <p className="text-xs text-slate-400">
            Importe sua planilha contendo colunas <span className="text-cyan-300 font-mono font-bold">CNPJ</span> e <span className="text-cyan-300 font-mono font-bold">UF</span>
          </p>
        </div>

        {/* Ações Compactas: Ícone + Selecionar .xlsx + Baixar Planilha Exemplo */}
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileChange}
          />

          {fileName && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 text-xs font-mono font-bold shadow-sm">
              <FileSpreadsheet className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="truncate max-w-[220px]" title={fileName}>{fileName}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all cursor-pointer shrink-0"
            title="Clique ou arraste um arquivo .xlsx/.csv para este painel"
          >
            <FileUp className="w-4 h-4 text-cyan-200" />
            <span>{fileName ? 'Trocar .xlsx' : 'Selecionar .xlsx'}</span>
          </button>

          <button
            onClick={downloadSampleExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700/80 transition-all cursor-pointer shrink-0"
            title="Baixar modelo .xlsx para teste"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Baixar Planilha Exemplo</span>
          </button>
        </div>
      </div>

      {/* Settings and Action Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Rate Limit / Speed Control */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Velocidade de Consulta</span>
            </div>
            <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded-md border border-cyan-800/60">
              {rateLimit} req/s
            </span>
          </div>

          <input
            type="range"
            min="1"
            max="25"
            value={rateLimit}
            onChange={(e) => setRateLimit(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />

          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>1 req/s (Seguro)</span>
            <span>10 req/s (Ultra)</span>
            <span>25 req/s (Máx)</span>
          </div>
        </div>

        {/* Action Buttons Panel */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-300 pb-1 border-b border-slate-800">
            Controle de Execução
          </div>

          {!isProcessing ? (
            <button
              onClick={onStart}
              disabled={stats.total === 0}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Iniciar Auditoria de Lote</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onPause}
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-md"
              >
                <Pause className="w-3.5 h-3.5 fill-slate-950" />
                <span>{isPaused ? 'Continuar' : 'Pausar'}</span>
              </button>

              <button
                onClick={onCancel}
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all cursor-pointer shadow-md"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>Cancelar</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={onClear}
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all cursor-pointer border border-slate-700/60"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Limpar</span>
            </button>

            <button
              onClick={onExport}
              disabled={stats.total === 0}
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 font-semibold text-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Exportar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Counters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Total</span>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono-num mt-1">
            {stats.total}
          </div>
        </div>

        {/* Sucesso */}
        <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-3 flex flex-col items-center justify-center">
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Sucesso</span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono-num mt-1">
            {stats.sucesso}
          </div>
        </div>

        {/* Erro */}
        <div className="bg-rose-950/30 border border-rose-900/50 rounded-xl p-3 flex flex-col items-center justify-center">
          <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Erro / Inapta</span>
          </div>
          <div className="text-2xl font-extrabold text-rose-400 font-mono-num mt-1">
            {stats.erro}
          </div>
        </div>

        {/* Pendente */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center">
          <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
            <Clock className="w-3.5 h-3.5" />
            <span>Pendente</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-300 font-mono-num mt-1">
            {stats.pendente}
          </div>
        </div>
      </div>
    </div>
  );
};
