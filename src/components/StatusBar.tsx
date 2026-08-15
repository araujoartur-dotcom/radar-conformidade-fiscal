import React from 'react';
import { Timer, Zap, CheckCircle, AlertCircle, RefreshCw, BarChart2 } from 'lucide-react';
import { BatchStats } from '../types';

interface StatusBarProps {
  isProcessing: boolean;
  isPaused: boolean;
  stats: BatchStats;
  currentProcessingCnpj?: string;
  elapsedSeconds: number;
  rateLimit: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  isProcessing,
  isPaused,
  stats,
  currentProcessingCnpj,
  elapsedSeconds,
  rateLimit,
}) => {
  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const processedCount = stats.sucesso + stats.erro;
  const progressPercent = stats.total > 0 ? Math.round((processedCount / stats.total) * 100) : 0;

  // Calculate ETA in seconds
  const remainingItems = stats.pendente;
  const etaSeconds = rateLimit > 0 ? Math.ceil(remainingItems / rateLimit) : 0;

  return (
    <footer className="glass-panel-glow border-t border-slate-800/90 rounded-2xl p-3 mt-4 text-xs font-mono">
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Progress Bar & Status Text */}
        <div className="flex-1 w-full flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-[11px] font-semibold">
            <span className="text-slate-300 flex items-center gap-2">
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                  <span className="text-cyan-300 font-bold">
                    {isPaused ? 'Processamento Pausado' : `Processando: ${currentProcessingCnpj || 'Iniciando...'}`}
                  </span>
                </>
              ) : stats.total > 0 && stats.pendente === 0 ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Lote Finalizado com Sucesso ({stats.total} itens)</span>
                </>
              ) : (
                <span className="text-slate-400">Aguardando início de consulta em lote...</span>
              )}
            </span>

            <span className="text-cyan-400 font-extrabold">{progressPercent}%</span>
          </div>

          {/* Graphical Progress Track */}
          <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800 p-0.5 relative">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isPaused
                  ? 'bg-amber-400'
                  : progressPercent === 100
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                  : 'bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Stopwatch & ETA Metrics */}
        <div className="flex items-center gap-4 text-slate-300 flex-shrink-0 bg-slate-900/80 px-4 py-1.5 rounded-xl border border-slate-800 text-[11px]">
          <div className="flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Tempo:</span>
            <strong className="text-white font-mono">{formatTime(elapsedSeconds)}</strong>
          </div>

          <div className="h-3 w-px bg-slate-800" />

          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">ETA:</span>
            <strong className="text-amber-300 font-mono">
              {isProcessing && remainingItems > 0 ? formatTime(etaSeconds) : '--:--:--'}
            </strong>
          </div>
        </div>

      </div>
    </footer>
  );
};
