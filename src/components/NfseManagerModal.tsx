import React, { useState, useEffect } from 'react';
import {
  X,
  Receipt,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  Zap,
  Info,
  Building2,
  Target
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
  const [listaConectores, setListaConectores] = useState<any[]>([]);
  const [selectedConectorIbge, setSelectedConectorIbge] = useState<string>('');
  const [isSyncingIndividual, setIsSyncingIndividual] = useState<boolean>(false);

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

  const carregarConectores = async () => {
    try {
      const res = await get<any>('/nfse/conectores');
      if (res.ok && res.data?.conectores && Array.isArray(res.data.conectores)) {
        setListaConectores(res.data.conectores);
        if (res.data.conectores.length > 0) {
          setSelectedConectorIbge(prev => {
            const exists = res.data.conectores.some((c: any) => (c.ibge || c.id) === prev);
            if (exists) return prev;
            return res.data.conectores[0].ibge || res.data.conectores[0].id;
          });
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar lista dinâmica de conectores:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSyncResult(null);
      setLogs([]);
      loadStatus();
      carregarConectores();
    }
  }, [isOpen, empresaAtiva?.id]);

  const handleSyncNfse = async () => {
    if (!empresaAtiva?.id) return;
    setIsSyncing(true);
    setSyncResult(null);
    addLog(`Iniciando varredura unificada de NFS-e para ${empresaAtiva.razaoSocial} (${empresaAtiva.cnpjCompleto})...`);
    addLog(`Ambiente: ${selectedAmbiente === '1' ? 'Produção Oficial (tpAmb=1)' : 'Homologação/Testes (tpAmb=2)'}`);
    addLog(`Executando varredura unificada (ADN Nacional + Filiais + Prefeituras)...`);

    try {
      const res = await post<any>('/nfse/sincronizar', {
        empresaId: empresaAtiva.id,
        tpAmb: selectedAmbiente,
        conector: 'unificado'
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

  const handleSyncIndividual = async () => {
    if (!empresaAtiva?.id || !selectedConectorIbge) return;
    
    const conectorObj = listaConectores.find(c => c.ibge === selectedConectorIbge || c.id === selectedConectorIbge);
    const nomePrefeitura = conectorObj ? `${conectorObj.municipio} - ${conectorObj.uf} (${conectorObj.provedor})` : selectedConectorIbge;

    setIsSyncingIndividual(true);
    setSyncResult(null);
    addLog(`🎯 Iniciando Consulta Individualizada para [${nomePrefeitura}]...`);
    addLog(`Ambiente: ${selectedAmbiente === '1' ? 'Produção Oficial (tpAmb=1)' : 'Homologação/Testes (tpAmb=2)'}`);
    addLog(`⚡ Consulta cirúrgica no webservice municipal (sem acionar o ADN da Receita Federal)...`);

    try {
      const res = await post<any>('/nfse/sincronizar', {
        empresaId: empresaAtiva.id,
        tpAmb: selectedAmbiente,
        conector: 'individual',
        municipioIbge: selectedConectorIbge
      });

      if (res.ok && res.data) {
        setSyncResult(res.data);
        const time = new Date().toLocaleTimeString('pt-BR');
        if (res.data.mensagens && Array.isArray(res.data.mensagens)) {
          setLogs(prev => [
            ...prev,
            ...res.data.mensagens.map((m: string) => `[${time}] ${m}`),
            `[${time}] Consulta em ${nomePrefeitura} finalizada: ${res.data.documentosNovos || 0} nova(s) NFS-e.`
          ]);
        } else {
          addLog(`Consulta em ${nomePrefeitura} finalizada: ${res.data.documentosNovos || 0} nova(s) NFS-e.`);
        }
        loadStatus();
        if (onSuccessSync) {
          onSuccessSync();
        }
      } else {
        addLog(`❌ Erro na consulta de ${nomePrefeitura}: ${res.error || 'Falha na comunicação com o webservice municipal.'}`);
      }
    } catch (err: any) {
      addLog(`❌ Falha inesperada: ${err.message}`);
    } finally {
      setIsSyncingIndividual(false);
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
        <div className="p-6 overflow-y-auto space-y-5">
          
          {/* MODO 1: Varredura Unificada Completa (ADN Nacional Matriz + Filiais + Prefeituras) */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Ambiente:</span>
              <select
                value={selectedAmbiente}
                onChange={(e) => setSelectedAmbiente(e.target.value as '1' | '2')}
                disabled={isSyncing || isSyncingIndividual}
                className="bg-slate-900 border border-slate-700 text-white font-medium rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="1">Produção Oficial (tpAmb = 1)</option>
                <option value="2">Homologação / Testes (tpAmb = 2)</option>
              </select>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 ml-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Certificado A1 Autenticado</span>
              </div>
            </div>

            <button
              onClick={handleSyncNfse}
              disabled={isSyncing || isSyncingIndividual}
              className={`px-5 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                isSyncing
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                  : 'bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-md shadow-teal-500/20'
              }`}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                  <span>Executando Varredura Geral...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Executar Varredura Geral (Completa)</span>
                </>
              )}
            </button>
          </div>

          {/* MODO 2: Consulta Cirúrgica Individualizada por Prefeitura (Sem tocar no ADN da Receita Federal) */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-teal-800/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-teal-400 font-semibold whitespace-nowrap">
                <Building2 className="w-4 h-4 text-teal-400" />
                <span>Prefeitura Específica ({listaConectores.length}):</span>
              </div>
              <select
                value={selectedConectorIbge}
                onChange={(e) => setSelectedConectorIbge(e.target.value)}
                disabled={isSyncing || isSyncingIndividual}
                className="bg-slate-900 border border-slate-700 text-white font-medium rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-teal-500 cursor-pointer flex-1 min-w-0 truncate"
              >
                {listaConectores.length === 0 ? (
                  <option value="">Carregando prefeituras cadastradas...</option>
                ) : (
                  listaConectores.map((c) => {
                    const statusTag = c.status === 'inativo' ? ' [Inativo]' : c.status === 'configuracao_pendente' ? ' [Pendente]' : '';
                    return (
                      <option key={c.id || c.ibge} value={c.ibge || c.id}>
                        [{c.uf}] {c.municipio} — {c.provedor} ({c.tecnologia || 'SOAP'}){statusTag}
                      </option>
                    );
                  })
                )}
              </select>
              <button
                type="button"
                onClick={carregarConectores}
                disabled={isSyncing || isSyncingIndividual}
                title="Atualizar lista de prefeituras cadastradas no banco"
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-teal-300 hover:border-teal-500 transition-all cursor-pointer flex-shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={handleSyncIndividual}
              disabled={isSyncing || isSyncingIndividual || !selectedConectorIbge}
              className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                isSyncingIndividual
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 hover:border-emerald-500 shadow-sm'
              }`}
            >
              {isSyncingIndividual ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Consultando Prefeitura...</span>
                </>
              ) : (
                <>
                  <Target className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Consultar Prefeitura Específica</span>
                </>
              )}
            </button>
          </div>

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
