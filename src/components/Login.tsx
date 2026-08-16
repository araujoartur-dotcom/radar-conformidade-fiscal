import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Lock, Mail, Loader2, AlertTriangle } from 'lucide-react';
import { getApiBaseUrl } from '../utils/apiConfig';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isWakingServer, setIsWakingServer] = useState(false);
  
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');
    setIsWakingServer(false);

    // Timeout alert for cold start (5s timer)
    const wakeTimer = setTimeout(() => {
      setIsWakingServer(true);
    }, 4000);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
        signal: controller.signal
      });

      clearTimeout(wakeTimer);
      clearTimeout(timeoutId);

      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text || 'Erro inesperado na resposta do servidor' };
      }

      if (!response.ok) {
        throw new Error(data.error || 'Erro de autenticação');
      }

      login(data.accessToken, data.usuario, data.empresaAtiva, data.empresasDisponiveis);
    } catch (err: any) {
      clearTimeout(wakeTimer);
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setError('O servidor demorou para responder (Cold Start da nuvem). Por favor, tente novamente em alguns segundos.');
      } else {
        setError(err.message || 'Falha de conexão com o servidor.');
      }
    } finally {
      setIsWakingServer(false);
      setLoading(false);
    }
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

          {isWakingServer && !error && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 mb-6 flex gap-3 text-amber-300 text-xs items-center animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin shrink-0 text-amber-400" />
              <p>Conectando e inicializando servidor em nuvem (Render)... aguarde alguns instantes.</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex gap-3 text-red-400 text-sm items-start">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
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
                  placeholder="Seu e-mail corporativo"
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
                  placeholder="Sua senha segura"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Autenticando...
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
