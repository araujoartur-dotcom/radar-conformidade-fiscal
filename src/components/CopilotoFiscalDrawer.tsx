import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, X, Send, Trash2, Bot, User, CheckCircle, AlertTriangle,
  Building2, ShieldCheck, HelpCircle, ArrowRight, CornerDownLeft,
  ChevronDown, RefreshCw, Scale, BookOpen, KeyRound, Copy, Check
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';

interface ToolUsed {
  toolName: string;
  args: any;
  resultSummary: string;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  toolsUsed?: ToolUsed[];
}

interface CopilotoFiscalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHIPS_SUGESTOES = [
  {
    titulo: 'Alíquota Teste 2026',
    prompt: 'Como a alíquota teste de 2026 (0,9% CBS + 0,1% IBS) compensável com PIS/COFINS afeta a minha empresa ativa?'
  },
  {
    titulo: 'Retenções na Fonte (CSRF/IRRF)',
    prompt: 'Quais as regras de retenção na fonte de CSRF (4,65%), IRRF e INSS para serviços tomados segundo a legislação vigente?'
  },
  {
    titulo: 'Fornecedor Simples Nacional',
    prompt: 'Na compra de um fornecedor optante pelo Simples Nacional, como fica a apropriação de créditos de IBS e CBS pela LC 214/25?'
  },
  {
    titulo: 'Auditar Notas da Empresa',
    prompt: 'Audite as notas fiscais da empresa ativa e identifique se há produtos com cClassTrib ausente ou alíquotas com risco.'
  },
  {
    titulo: 'Impacto do Split Payment',
    prompt: 'Explique didaticamente o mecanismo de Split Payment e seu impacto financeiro na liquidação bancária e no fluxo de caixa.'
  }
];

export const CopilotoFiscalDrawer: React.FC<CopilotoFiscalDrawerProps> = ({
  isOpen,
  onClose
}) => {
  const { empresaAtiva, user } = useAuth();
  const { post, get } = useApi();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  const [copiedKey, setCopiedKey] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Inicializa com saudação institucional do Auditor AI
  useEffect(() => {
    if (messages.length === 0) {
      const saudacao = {
        id: 'msg-welcome',
        role: 'model' as const,
        content: `Olá, ${user?.nome ? user.nome.split(' ')[0] : 'colega'}! Sou o **Auditor AI**, seu Consultor & Auditor Tributário especializado na legislação fiscal brasileira.\n\nEstou conectado aos dados da empresa **${empresaAtiva?.razaoSocial || 'ativa na sua sessão'}** (${empresaAtiva?.cnpjCompleto || 'CNPJ'}).\n\nPosso orientar sobre:\n* **Reforma Tributária do Consumo:** Regras da **LC 214/2025**, **EC 132/2023**, IBS, CBS, Imposto Seletivo e Split Payment.\n* **Tributos Vigentes & Transição Convivente (2026-2032):** ICMS (LC 87/96, DIFAL), ISS (LC 116/03), IPI e Retenções Federais (CSRF 4,65%, IRRF, INSS).\n* **Auditoria de Notas & Parâmetros Fiscais:** Verificação de XMLs, alíquotas de referência e regras de elegibilidade.\n\nComo posso apoiar a sua estratégia fiscal hoje?`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([saudacao]);
    }
  }, [empresaAtiva?.id, user?.nome]);

  // Checa status de configuração no backend
  useEffect(() => {
    if (isOpen) {
      get<{ success: boolean; isConfigured: boolean }>('/ai/status')
        .then(res => {
          if (res.ok && res.data) {
            setIsConfigured(res.data.isConfigured);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Rola para a última mensagem
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Foco no textarea ao abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSendMessage = async (texto?: string) => {
    const promptToSend = (texto || inputText).trim();
    if (!promptToSend || isLoading) return;

    const userMessage: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: promptToSend,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Prepara histórico das últimas mensagens para manter coerência
      const historicoPayload = messages
        .filter(m => m.id !== 'msg-welcome')
        .slice(-6)
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const res = await post<{
        success: boolean;
        resposta: string;
        toolsUsed?: ToolUsed[];
        isConfigured?: boolean;
        error?: string;
      }>('/ai/chat', {
        mensagem: promptToSend,
        historico: historicoPayload,
        empresaId: empresaAtiva?.id
      });

      if (res.ok && res.data) {
        if (res.data.isConfigured !== undefined) {
          setIsConfigured(res.data.isConfigured);
        }

        const modelMessage: Message = {
          id: `model-${Date.now()}`,
          role: 'model',
          content: res.data.resposta || 'Parecer emitido.',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          toolsUsed: res.data.toolsUsed || []
        };
        setMessages(prev => [...prev, modelMessage]);
      } else {
        const errorMsg = res.error || (res.data as any)?.error || 'Não foi possível obter o parecer do Auditor AI.';
        const errorMessage: Message = {
          id: `err-${Date.now()}`,
          role: 'model',
          content: `⚠️ **Aviso de Comunicação:** ${errorMsg}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (err: any) {
      const errorMessage: Message = {
        id: `err-${Date.now()}`,
        role: 'model',
        content: `❌ **Falha de Conexão:** Não foi possível contactar o serviço fiscal: ${err.message || 'Erro de rede.'}`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Deseja limpar todo o histórico desta conversa com o Auditor AI?')) {
      const saudacao = {
        id: 'msg-welcome-clean',
        role: 'model' as const,
        content: `Histórico renovado! Em que mais posso orientar a empresa **${empresaAtiva?.razaoSocial || 'ativa'}** sobre a legislação tributária?`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([saudacao]);
    }
  };

  const handleCopyEnvSnippet = () => {
    navigator.clipboard.writeText('GEMINI_API_KEY=sua_chave_do_google_ai_studio_aqui');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 3000);
  };

  // Renderizador simples e elegante de Markdown
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-2 text-sm leading-relaxed text-slate-200 break-words">
        {lines.map((line, idx) => {
          const trimmed = line.trim();

          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-base font-bold text-cyan-300 mt-3 pt-2 border-t border-slate-800/80 flex items-center gap-1.5">
                {trimmed.replace('### ', '')}
              </h3>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h2 key={idx} className="text-lg font-extrabold text-white mt-4 border-b border-slate-700/60 pb-1">
                {trimmed.replace('## ', '')}
              </h2>
            );
          }
          if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            const itemText = trimmed.substring(2);
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-cyan-400 font-bold mt-1 text-xs">•</span>
                <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(itemText) }} />
              </div>
            );
          }
          if (trimmed.startsWith('> ')) {
            return (
              <blockquote key={idx} className="border-l-2 border-indigo-400 pl-3 py-1 my-1.5 bg-indigo-950/20 rounded-r-lg text-indigo-200 text-xs italic">
                <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed.replace('> ', '')) }} />
              </blockquote>
            );
          }
          if (trimmed === '') {
            return <div key={idx} className="h-1" />;
          }

          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }} />
          );
        })}
      </div>
    );
  };

  const formatInlineMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-cyan-200">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300 font-mono text-xs">$1</code>');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <aside 
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] lg:w-[580px] bg-[#0b121e]/95 backdrop-blur-2xl border-l border-slate-800 shadow-2xl flex flex-col justify-between overflow-hidden transition-all duration-300 ease-out"
        role="dialog"
        aria-label="Copiloto Fiscal IA"
      >
        {/* TOP BAR HEADER */}
        <header className="p-4 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full rounded-[14px] bg-[#0b121e] flex items-center justify-center">
                <Scale className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[#0b121e] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                  Auditor AI
                </h2>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate max-w-[260px] sm:max-w-[320px]">
                Especialista em RTC (LC 214/25, EC 132/23) & Tributos Vigentes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleClearHistory}
              title="Limpar conversa"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title="Fechar painel (Esc)"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ACTIVE ENTERPRISE CONTEXT BANNER */}
        <div className="px-4 py-2 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-800/80 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 truncate">
            <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">Empresa Ativa:</span>
            <strong className="text-slate-200 truncate font-semibold">
              {empresaAtiva ? empresaAtiva.razaoSocial : 'Nenhuma selecionada'}
            </strong>
          </div>
          {empresaAtiva && (
            <span className="text-[10px] font-mono text-cyan-400 shrink-0 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
              {empresaAtiva.regimeTributario || 'Regime Geral'}
            </span>
          )}
        </div>

        {/* MESSAGES LIST AREA */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          
          {/* Missing API Key Warning Box */}
          {!isConfigured && (
            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Chave do Google Gemini pendente no servidor</span>
              </div>
              <p className="text-amber-200/90 leading-relaxed text-[11px]">
                O Copiloto Fiscal está pronto para responder. Para conectá-lo ao modelo oficial do Google, adicione a sua chave no arquivo <code className="px-1 py-0.5 bg-black/40 rounded text-amber-300 font-mono">.env</code>:
              </p>
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/60 border border-amber-500/30 font-mono text-[11px]">
                <span className="text-amber-300 truncate">GEMINI_API_KEY=AIzaSy...</span>
                <button
                  onClick={handleCopyEnvSnippet}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-sans text-[10px] font-bold transition-all cursor-pointer shrink-0"
                >
                  {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedKey ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          )}

          {/* Chat Messages */}
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-1.5`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 px-1">
                {msg.role === 'user' ? (
                  <>
                    <span>Você</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </>
                ) : (
                  <>
                    <Scale className="w-3 h-3 text-cyan-400" />
                    <span className="font-semibold text-cyan-300">Auditor AI</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </>
                )}
              </div>

              {/* Tools Execution Pills */}
              {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                <div className="w-full max-w-[95%] space-y-1 mb-1">
                  {msg.toolsUsed.map((t, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-700/40 text-[11px] text-cyan-200"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{t.resultSummary}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`max-w-[92%] sm:max-w-[88%] p-3.5 rounded-2xl shadow-md ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none'
                    : 'bg-slate-900/90 border border-slate-800 text-slate-100 rounded-bl-none'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  renderFormattedContent(msg.content)
                )}
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-start gap-2 pt-2 animate-pulse">
              <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
              </div>
              <div className="p-3 rounded-2xl rounded-bl-none bg-slate-900/90 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                <span>Auditor AI consultando fundamentos da LC 214/25 e base fiscal...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* BOTTOM SECTION: CHIPS & INPUT FORM */}
        <div className="border-t border-slate-800 bg-slate-950/80 p-3 space-y-2.5 shrink-0">
          
          {/* Suggestion Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 text-xs">
            {CHIPS_SUGESTOES.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip.prompt)}
                disabled={isLoading}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-900 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-500/50 text-[11px] font-medium text-slate-300 hover:text-cyan-300 transition-all cursor-pointer shrink-0 disabled:opacity-50"
              >
                {chip.titulo}
              </button>
            ))}
          </div>

          {/* Input Textarea & Send Button */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            <div className="relative flex-1 bg-slate-900/90 border border-slate-700/80 focus-within:border-cyan-500/80 rounded-2xl transition-all shadow-inner">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte ao Auditor AI sobre LC 214, ICMS, retenções ou notas..."
                rows={2}
                disabled={isLoading}
                className="w-full px-3.5 py-2.5 text-xs text-white placeholder-slate-500 bg-transparent resize-none focus:outline-none custom-scrollbar"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="p-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold shadow-lg shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
              title="Enviar pergunta (Enter)"
            >
              {isLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>

          <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
            <span>Enter para enviar • Shift+Enter para nova linha</span>
            <span className="flex items-center gap-1 text-cyan-400/80">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              Auditoria em Conformidade Legal
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
