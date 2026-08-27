import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Lock, Mail, Loader2, AlertTriangle, CheckCircle2, CloudLightning } from 'lucide-react';
import { getApiBaseUrl } from '../utils/apiConfig';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverState, setServerState] = useState<'checking' | 'awake' | 'waking'>('checking');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  const { login } = useAuth();
  const elapsedTimerRef = useRef<any>(null);

  // 1. Pré-aquecimento automático do servidor na montagem do componente (Cold Start Prevention)
  useEffect(() => {
    let isMounted = true;
    const prewarmServer = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const res = await fetch(`${getApiBaseUrl()}/health`, {
          method: 'GET',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (res.ok && isMounted) {
          setServerState('awake');
        } else if (isMounted) {
          setServerState('waking');
        }
      } catch {
        if (isMounted) {
          setServerState('waking');
        }
      }
    };

    prewarmServer();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Cronômetro de tempo decorrido para feedback visual ao usuário
  useEffect(() => {
    if (loading) {
      setElapsedSeconds(0);
      elapsedTimerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
      }
      setElapsedSeconds(0);
    }

    return () => {
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
      }
    };
  }, [loading]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    const maxTimeoutMs = 90000; // 90 segundos para permitir Cold Start completo do Render
    const maxRetries = 2; // Até 2 tentativas automáticas em caso de queda transitória de conexão

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), maxTimeoutMs);

      try {
        const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), senha }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const text = await response.text();
        let data: any = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text || 'Erro inesperado na resposta do servidor' };
        }

        if (!response.ok) {
          throw new Error(data.error || 'Credenciais inválidas.');
        }

        setServerState('awake');
        login(data.accessToken, data.usuario, data.empresaAtiva, data.empresasDisponiveis);
        return; // Login bem-sucedido
      } catch (err: any) {
        clearTimeout(timeoutId);

        // Se for erro de credencial inválida (401), não repetir tentativa
        if (err.message && (err.message.includes('incorret') || err.message.includes('inválid') || err.message.includes('bloquead'))) {
          setError(err.message);
          break;
        }

        // Se for a última tentativa, registrar o erro final
        if (attempt === maxRetries) {
          if (err.name === 'AbortError') {
            setError('O servidor demorou mais de 90s para responder. O serviço na nuvem pode estar instável. Por favor, tente novamente.');
          } else {
            setError(err.message || 'Falha de conexão com o servidor.');
          }
        } else {
          // Aguardar 2s antes de retentar caso o servidor esteja terminando de subir
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0f18] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-600"></div>
        
        <div className="p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center border border-slate-800 mb-4 shadow-lg shadow-cyan-900/20">
              <ShieldCheck className="w-8 h-8 text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Radar Fiscal</h1>
            <p className="text-slate-400 text-sm text-center">
              Faça login para acessar o painel de conformidade e auditoria.
            </p>
          </div>

          {/* Status do Servidor em Nuvem */}
          {!loading && !error && (
            <div className="mb-5 flex items-center justify-center gap-2 text-xs py-1.5 px-3 rounded-full bg-slate-950/80 border border-slate-800 text-slate-400 w-fit mx-auto">
              {serverState === 'awake' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-emerald-400 font-medium">Servidor Online & Conectado</span>
                </>
              ) : serverState === 'waking' ? (
                <>
                  <CloudLightning className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                  <span className="text-amber-300">Aquecendo servidor em nuvem...</span>
                </>
              ) : (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                  <span>Verificando conectividade...</span>
                </>
              )}
            </div>
          )}

          {/* Banner de carregamento detalhado durante Cold Start */}
          {loading && elapsedSeconds >= 3 && (
            <div className="bg-cyan-950/50 border border-cyan-500/30 rounded-xl p-4 mb-6 flex flex-col gap-2 text-cyan-300 text-xs animate-pulse">
              <div className="flex items-center gap-2 font-semibold text-cyan-200">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                <span>Inicializando servidor em nuvem (Render)...</span>
                <span className="ml-auto font-mono text-cyan-400">{elapsedSeconds}s</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Servidores em planos gratuitos entram em modo de suspensão após inatividade e levam cerca de 30 a 50 segundos para despertar. Por favor, aguarde.
              </p>
              {/* Barra de progresso visual */}
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${Math.min(95, (elapsedSeconds / 45) * 100)}%` }}
                ></div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex gap-3 text-red-400 text-sm items-start">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-300">Falha ao autenticar</p>
                <p className="text-xs text-red-400/90 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">E-mail</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-xl bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm transition-colors"
                  placeholder="admin@radarfiscal.com.br"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-xl bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm transition-colors"
                  placeholder="••••••••••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{elapsedSeconds >= 3 ? `Conectando (${elapsedSeconds}s)...` : 'Autenticando...'}</span>
                </>
              ) : (
                'Entrar no Sistema'
              )}
            </button>
          </form>
        </div>
        
        <div className="px-8 py-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <span>Ambiente Seguro e Monitorado</span>
          <span>v2.5.0</span>
        </div>
      </div>
    </div>
  );
}

