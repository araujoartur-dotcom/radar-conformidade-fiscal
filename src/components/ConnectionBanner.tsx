import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff, CloudLightning } from 'lucide-react';

interface ConnectionBannerProps {
  error: string | null;
  onRetry: () => void;
  isRetrying?: boolean;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({
  error,
  onRetry,
  isRetrying = false,
}) => {
  if (!error) return null;

  const isColdStart = error.toLowerCase().includes('demorou') || 
                      error.toLowerCase().includes('timeout') || 
                      error.toLowerCase().includes('conexão') || 
                      error.toLowerCase().includes('failed to fetch');

  return (
    <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 border-b border-amber-600/40 px-4 py-2.5 text-amber-200 text-xs shadow-lg transition-all animate-fadeIn sticky top-0 z-50 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
          {isColdStart ? <CloudLightning className="w-4 h-4 animate-bounce" /> : <WifiOff className="w-4 h-4" />}
        </div>
        <div className="truncate">
          <span className="font-bold text-amber-300 mr-1.5">Aviso de Conectividade:</span>
          <span className="text-amber-200/90">
            {isColdStart 
              ? 'O servidor em nuvem pode estar iniciando (Cold Start). Os dados serão restaurados assim que a conexão restabelecer.'
              : error}
          </span>
        </div>
      </div>

      <button
        onClick={onRetry}
        disabled={isRetrying}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-100 font-semibold text-xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
        <span>{isRetrying ? 'Reconectando...' : 'Reconectar'}</span>
      </button>
    </div>
  );
};

export default ConnectionBanner;
