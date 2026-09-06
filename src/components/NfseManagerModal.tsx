import React, { useState, useEffect } from 'react';
import {
  X,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Database,
  ArrowRight,
  Server,
  Zap,
  Info,
  DollarSign,
  Scale,
  FileCheck,
  Sparkles,
  Layers
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { AmbienteSefaz } from '../types';

interface NfseManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  ambienteSefaz: AmbienteSefaz;
  onSuccessSync?: () => void;
}

export const NfseManagerModal: React.FC<NfseManagerModalProps> = ({
  isOpen,
  onClose,
  ambienteSefaz,
  onSuccessSync
}) => {
  const { empresaAtiva, token } = useAuth();
  const { post, get } = useApi();

  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [statusData, setStatusData] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedAmbiente, setSelectedAmbiente] = useState<'1' | '2'>(ambienteSefaz === 'producao' ? '1' : '2');
  const [selectedConector, setSelectedConector] = useState<'unificado' | 'adn' | 'pmsp'>('unificado');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [ultNSUInput, setUltNSUInput] = useState<string>('0');

  const logsEndRef = React.useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('pt-BR');
    setLogs(prev => [...prev, `[${time}] ${msg}`]);
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const loadStatus = async () => {
    if (!empresaAtiva?.id) return;
    setIsLoadingStatus(true);
    try {
      const res = await get<any>(`/nfse/status?empresaId=${empresaAtiva.id}`);
      if (res.ok && res.data) {
        setStatusData(res.data);
      }
    } catch (err: any) {
      console.error('Erro ao carregar status de NFS-e:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSyncResult(null);
      setLogs([]);
      loadStatus();
    }
  }, [isOpen, empresaAtiva?.id]);

  const handleSyncNfse = async () => {
    if (!empresaAtiva?.id) return;
    setIsSyncing(true);
    setSyncResult(null);
    addLog(`Iniciando varredura de NFS-e para ${empresaAtiva.razaoSocial} (${empresaAtiva.cnpjCompleto})...`);
    addLog(`Ambiente selecionado: ${selectedAmbiente === '1' ? 'Produção Oficial (tpAmb=1)' : 'Homologação/Testes (tpAmb=2)'}`);
    
    if (selectedConector === 'unificado') {
      addLog(`⚡ Disparando Varredura Fiscal Completa (Ambiente Nacional ADN + Filiais + Prefeituras)...`);
    } else if (selectedConector === 'pmsp') {
      addLog(`Consultando Prefeitura de São Paulo (Nota do Milhão)...`);
    } else {
      addLog(`Consultando Ambiente de Dados Nacional (ADN) a partir do NSU ${ultNSUInput}...`);
    }

    try {
      const res = await post<any>('/nfse/sincronizar', {
        empresaId: empresaAtiva.id,
        tpAmb: selectedAmbiente,
        ultNSU: ultNSUInput,
        conector: selectedConector
      });

      if (res.ok && res.data) {
        setSyncResult(res.data);
        const time = new Date().toLocaleTimeString('pt-BR');
        if (res.data.mensagens && Array.isArray(res.data.mensagens)) {
          setLogs(prev => [
            ...prev,
            ...res.data.mensagens.map((m: string) => `[${time}] ${m}`),
            `[${time}] Sincronização concluída: ${res.data.documentosNovos || 0} novas NFS-e capturadas.`
          ]);
        } else {
          addLog(`Sincronização concluída: ${res.data.documentosNovos || 0} novas NFS-e capturadas.`);
        }
        loadStatus();
        if (onSuccessSync) {
          onSuccessSync();
        }
      } else {
        addLog(`❌ Erro na sincronização: ${res.error || 'Falha na comunicação com o webservice.'}`);
      }
    } catch (err: any) {
      addLog(`❌ Falha inesperada: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Central de Captura & Gestão de <span className="text-teal-400">NFS-e</span>
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800 font-bold">
                  Nacional ADN + Prefeituras
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Empresa Ativa: <span className="font-bold text-slate-200">{empresaAtiva?.razaoSocial}</span> ({empresaAtiva?.cnpjCompleto})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Conectores & Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Card 1: ADN Nacional */}
            <div className="p-4 rounded-xl bg-slate-950 border border-teal-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-teal-400 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> ADN Nacional (RFB)
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="text-sm font-bold text-white">Ambiente de Dados Nacional</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Distribuição DF-e via mTLS com Certificado A1. Captura serviços tomados e prestados de municípios conveniados e MEIs.
              </p>
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>Protocolo: REST / Serpro</span>
                <span className="text-emerald-400 font-bold">Conector Operacional</span>
              </div>
            </div>

            {/* Card 2: PMSP São Paulo */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> PMSP (São Paulo)
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <div className="text-sm font-bold text-white">Nota do Milhão (TBFWeb)</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Webservice SOAP dedicado da Capital de SP. Consulta notas de serviços tomados por prestadores paulistanos.
              </p>
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>IBGE: 3550308</span>
                <span className="text-cyan-400 font-bold">Conector Ativo</span>
              </div>
            </div>

            {/* Card 3: Padrão ABRASF */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5" /> Rede ABRASF
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <div className="text-sm font-bold text-white">Nota Carioca & Capitais</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Suporte ao padrão ABRASF (Rio de Janeiro, Belo Horizonte, Curitiba, Ginfes, Betha e rede conveniada).
              </p>
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>Versões: 1.0, 2.0 e 2.04</span>
                <span className="text-indigo-400 font-bold">Conector Ativo</span>
              </div>
            </div>

          </div>

          {/* Action Bar — Varredura Fiscal Inteligente (Modo Topo de Linha) */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950/40 border border-teal-500/30 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1 text-left w-full md:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white flex items-center gap-2 tracking-tight">
                  <Sparkles className="w-4 h-4 text-teal-400" />
                  Varredura Fiscal Autônoma Unificada
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30 font-bold uppercase tracking-wider">
                  Tudo em 1 Clique
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Varre automaticamente o <b>Ambiente Nacional (ADN)</b> para a matriz e filiais sob o CNPJ Base, integrando <b>São Paulo e Prefeituras ativas</b>.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer py-2 px-2 whitespace-nowrap"
              >
                {showAdvanced ? 'Ocultar Opções' : 'Opções Avançadas'}
              </button>

              <button
                onClick={handleSyncNfse}
                disabled={isSyncing}
                className={`px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2.5 shadow-xl transition-all cursor-pointer ${
                  isSyncing
                    ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                    : 'bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black shadow-teal-500/20 hover:shadow-teal-500/40 hover:scale-[1.02]'
                }`}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
                    <span>Varrendo Webservices e Filiais...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-slate-950" />
                    <span>Executar Varredura Inteligente</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Opções Avançadas de Auditoria (Recolhidas por padrão) */}
          {showAdvanced && (
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center gap-4 text-xs animate-in fade-in duration-150">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Modo Diagnóstico:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Escopo:</span>
                <select
                  value={selectedConector}
                  onChange={(e) => setSelectedConector(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 text-teal-400 font-bold rounded-lg px-2.5 py-1 text-xs focus:outline-none"
                >
                  <option value="unificado">Unificado (Nacional ADN + Filiais + Prefeituras)</option>
                  <option value="adn">Apenas ADN Nacional (RFB)</option>
                  <option value="pmsp">Apenas PMSP (São Paulo)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Ambiente:</span>
                <select
                  value={selectedAmbiente}
                  onChange={(e) => setSelectedAmbiente(e.target.value as '1' | '2')}
                  className="bg-slate-900 border border-slate-700 text-white font-bold rounded-lg px-2.5 py-1 text-xs focus:outline-none"
                >
                  <option value="1">Produção (tpAmb = 1)</option>
                  <option value="2">Homologação (tpAmb = 2)</option>
                </select>
              </div>

              {selectedConector === 'adn' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">NSU Inicial:</span>
                  <input
                    type="text"
                    value={ultNSUInput}
                    onChange={(e) => setUltNSUInput(e.target.value)}
                    className="w-20 bg-slate-900 border border-slate-700 text-white font-mono rounded-lg px-2 py-1 text-xs text-center"
                    placeholder="0"
                  />
                </div>
              )}
            </div>
          )}

          {/* Sync Result Summary */}
          {syncResult && (
            <div className="p-4 rounded-xl bg-teal-950/30 border border-teal-800/60 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-300">
                  <CheckCircle2 className="w-4 h-4 text-teal-400" />
                  <span>Resultado da Varredura ({syncResult.provedor})</span>
                </div>
                <span className="text-[10px] font-mono text-teal-400">
                  NSU Processado: {syncResult.ultNSU}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Novas NFS-e</div>
                  <div className="text-base font-black text-white font-mono">{syncResult.documentosNovos}</div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Já Existentes</div>
                  <div className="text-base font-black text-slate-400 font-mono">{syncResult.documentosExistentes}</div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Total Serviços (R$)</div>
                  <div className="text-base font-black text-emerald-400 font-mono">
                    {(syncResult.totalValorServicos || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Retenções na Fonte</div>
                  <div className="text-base font-black text-cyan-400 font-mono">
                    {((syncResult.totalRetencoes?.irrf || 0) + (syncResult.totalRetencoes?.inss || 0) + (syncResult.totalRetencoes?.iss || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Execution Logs */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Log de Execução em Tempo Real</span>
              {logs.length > 0 && (
                <button
                  onClick={() => setLogs([])}
                  className="text-[10px] text-slate-500 hover:text-slate-300 underline cursor-pointer"
                >
                  Limpar Logs
                </button>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <p className="text-slate-600 italic">
                  Aguardando acionamento da sincronização... Clique em "Sincronizar NFS-e Agora" para buscar notas no ADN e prefeituras.
                </p>
              ) : (
                <>
                  {logs.map((log, index) => (
                    <p key={index} className="leading-tight">
                      {log}
                    </p>
                  ))}
                  <div ref={logsEndRef} />
                </>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400" />
            <span>As NFS-e capturadas são salvas no Supabase e integradas automaticamente aos Relatórios (#9 Retenções) e ao .ZIP oficial.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
