import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Receipt,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  Zap,
  Info,
  Building2,
  Target,
  AlertTriangle,
  Globe,
  Clock,
  FileCode,
  KeyRound,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Search
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { AmbienteSefaz } from '../types';

export interface OcorrenciaPrefeitura {
  ibge?: string;
  municipio: string;
  uf: string;
  provedor: string;
  tecnologia?: string;
  status: 'sem_notas' | 'erro_500' | 'erro_rede_dns' | 'timeout' | 'erro_envelope' | 'autenticacao' | 'redirecionamento' | 'outro';
  statusCode?: number;
  mensagem: string;
  detalheTecnico?: string;
  acaoSugerida: string;
  url?: string;
}

export const parseOcorrenciasFromLogs = (logList: string[], conectores: any[]): OcorrenciaPrefeitura[] => {
  const ocorrencias: OcorrenciaPrefeitura[] = [];
  let currentCity: { municipio: string; uf: string; provedor: string; lines: string[] } | null = null;
  const groups: { municipio: string; uf: string; provedor: string; lines: string[] }[] = [];

  for (const line of logList) {
    const headerMatch = line.match(/▶\s*\[([^\]-]+?)\s*-\s*([A-Z]{2})\s*\(([^)]+?)\)\]:\s*Consultando/i);
    if (headerMatch) {
      if (currentCity) groups.push(currentCity);
      currentCity = {
        municipio: headerMatch[1].trim(),
        uf: headerMatch[2].trim().toUpperCase(),
        provedor: headerMatch[3].trim(),
        lines: []
      };
    } else if (currentCity) {
      currentCity.lines.push(line);
    }
  }
  if (currentCity) groups.push(currentCity);

  for (const grp of groups) {
    const rawAll = grp.lines.join(' ');
    if (rawAll.includes('NFS-e processada:') || rawAll.includes('novas gravadas') || rawAll.includes('novas NFS-e capturadas')) {
      continue;
    }

    const conectorCadastrado = conectores.find(
      c => c.municipio?.toLowerCase() === grp.municipio.toLowerCase() && c.uf?.toUpperCase() === grp.uf
    );

    const urlMatch = rawAll.match(/https?:\/\/[^\s\)...]+/i);
    const urlEncontrada = urlMatch ? urlMatch[0] : '';

    let statusTipo: OcorrenciaPrefeitura['status'] = 'outro';
    let msgResumida = 'Nenhum XML retornado';
    let acao = 'Testar individualmente ou validar endpoint';

    if (rawAll.includes('HTTP 200 (sem notas') || (rawAll.includes('HTTP 200') && !rawAll.includes('inválida') && !rawAll.includes('LoteDFe'))) {
      statusTipo = 'sem_notas';
      msgResumida = 'HTTP 200: Nenhuma NFS-e emitida no período';
      acao = 'Comunicação normal. Nenhuma NFS-e tomada no período de 30 dias.';
    } else if (rawAll.includes('nfseCabecMsg') || rawAll.includes('nfseDadosMsg') || rawAll.includes('inválida') || rawAll.includes('não conseguiu capturar')) {
      statusTipo = 'erro_envelope';
      msgResumida = 'Parâmetro SOAP ausente ou rejeitado (nfseCabecMsg/nfseDadosMsg)';
      acao = 'Ajustar layout do envelope SOAP específico para o provedor';
    } else if (rawAll.includes('ENOTFOUND') || rawAll.includes('getaddrinfo')) {
      statusTipo = 'erro_rede_dns';
      msgResumida = 'Host/Domínio não encontrado no DNS (ENOTFOUND)';
      acao = 'Atualizar URL do endpoint no módulo de Conectores Municipais';
    } else if (rawAll.includes('Timeout de 25s') || rawAll.includes('ETIMEDOUT') || rawAll.includes('ESOCKETTIMEDOUT')) {
      statusTipo = 'timeout';
      msgResumida = 'Timeout de conexão excedido (> 25s)';
      acao = 'Servidor municipal sobrecarregado ou porta bloqueada. Testar individualmente.';
    } else if (rawAll.includes('HTTP 500') || rawAll.includes('HTTP 502') || rawAll.includes('HTTP 503')) {
      statusTipo = 'erro_500';
      msgResumida = 'Instabilidade ou rejeição no servidor da prefeitura (HTTP 50x)';
      acao = 'Erro interno do servidor municipal. Tentar novamente ou ajustar tags SOAP.';
    } else if (rawAll.includes('HTTP 401') || rawAll.includes('HTTP 403') || rawAll.includes('HTTP 405') || rawAll.includes('HTTP 406')) {
      statusTipo = 'autenticacao';
      msgResumida = 'Acesso não autorizado / Método HTTP rejeitado (HTTP 40x)';
      acao = 'Verificar se exige autenticação adicional, usuário/senha ou método REST.';
    } else if (rawAll.includes('HTTP 301') || rawAll.includes('HTTP 302')) {
      statusTipo = 'redirecionamento';
      msgResumida = 'Redirecionamento HTTP (301/302)';
      acao = 'Ajustar URL para o endpoint direto do WebService (remover redirecionamento).';
    }

    const detalheLinha = grp.lines.find(l => l.includes('⚠️') || l.includes('ℹ️') || l.includes('Retorno')) || grp.lines[grp.lines.length - 1] || '';
    const detalheLimpo = detalheLinha.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*(?:└\s*)?/, '').trim();

    ocorrencias.push({
      ibge: conectorCadastrado?.ibge || conectorCadastrado?.id,
      municipio: grp.municipio,
      uf: grp.uf,
      provedor: grp.provedor,
      tecnologia: conectorCadastrado?.tecnologia || (rawAll.includes('REST') ? 'REST' : 'SOAP'),
      status: statusTipo,
      mensagem: msgResumida,
      detalheTecnico: detalheLimpo,
      acaoSugerida: acao,
      url: urlEncontrada
    });
  }

  return ocorrencias;
};

const renderStatusBadge = (status: OcorrenciaPrefeitura['status']) => {
  switch (status) {
    case 'erro_500':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          Falha 50x Servidor
        </span>
      );
    case 'erro_rede_dns':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
          <Globe className="w-3 h-3 text-amber-400" />
          DNS Inacessível
        </span>
      );
    case 'erro_envelope':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
          <FileCode className="w-3 h-3 text-indigo-400" />
          Envelope SOAP
        </span>
      );
    case 'timeout':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 flex items-center gap-1">
          <Clock className="w-3 h-3 text-yellow-400" />
          Timeout 25s
        </span>
      );
    case 'autenticacao':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
          <KeyRound className="w-3 h-3 text-purple-400" />
          Auth / Método 40x
        </span>
      );
    case 'redirecionamento':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
          ↪️ Redirecionamento
        </span>
      );
    case 'sem_notas':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          Sem Notas no Período (200 OK)
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
          Ocorrência
        </span>
      );
  }
};

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

  // Estados da Janela de Ocorrências / Prefeituras sem Captura
  const [filtroTipoOcorrencia, setFiltroTipoOcorrencia] = useState<string>('todos');
  const [buscaOcorrencia, setBuscaOcorrencia] = useState<string>('');
  const [copiadoFeedback, setCopiadoFeedback] = useState<boolean>(false);
  const [isPainelOcorrenciasExpandido, setIsPainelOcorrenciasExpandido] = useState<boolean>(true);

  const logsEndRef = React.useRef<HTMLDivElement>(null);

  // Derivar prefeituras sem captura a partir do retorno estruturado do backend ou do parser de logs
  const todasOcorrencias = useMemo<OcorrenciaPrefeitura[]>(() => {
    if (syncResult?.prefeiturasSemCaptura && Array.isArray(syncResult.prefeiturasSemCaptura) && syncResult.prefeiturasSemCaptura.length > 0) {
      return syncResult.prefeiturasSemCaptura;
    }
    return parseOcorrenciasFromLogs(logs, listaConectores);
  }, [syncResult, logs, listaConectores]);

  // Contagens por categoria de ocorrência
  const contagens = useMemo(() => {
    const counts: Record<string, number> = {
      todos: todasOcorrencias.length,
      erro_500: 0,
      erro_rede_dns: 0,
      erro_envelope: 0,
      timeout: 0,
      autenticacao: 0,
      redirecionamento: 0,
      sem_notas: 0,
      outro: 0
    };
    for (const o of todasOcorrencias) {
      if (counts[o.status] !== undefined) {
        counts[o.status]++;
      } else {
        counts.outro++;
      }
    }
    return counts;
  }, [todasOcorrencias]);

  // Filtro ativo de ocorrências
  const ocorrenciasFiltradas = useMemo(() => {
    return todasOcorrencias.filter(o => {
      const matchTipo = filtroTipoOcorrencia === 'todos' || o.status === filtroTipoOcorrencia;
      if (!matchTipo) return false;
      if (!buscaOcorrencia.trim()) return true;
      const termo = buscaOcorrencia.toLowerCase();
      return (
        o.municipio.toLowerCase().includes(termo) ||
        o.uf.toLowerCase().includes(termo) ||
        o.provedor.toLowerCase().includes(termo) ||
        o.mensagem.toLowerCase().includes(termo) ||
        (o.detalheTecnico && o.detalheTecnico.toLowerCase().includes(termo))
      );
    });
  }, [todasOcorrencias, filtroTipoOcorrencia, buscaOcorrencia]);

  // Selecionar prefeitura para teste cirúrgico individual
  const handleSelecionarPrefeituraParaTeste = (item: OcorrenciaPrefeitura) => {
    const conector = listaConectores.find(
      c => (item.ibge && (c.ibge === item.ibge || c.id === item.ibge)) ||
           (c.municipio?.toLowerCase() === item.municipio.toLowerCase() && c.uf?.toUpperCase() === item.uf)
    );

    if (conector) {
      const targetId = conector.ibge || conector.id;
      setSelectedConectorIbge(targetId);
      addLog(`👉 Prefeitura [${conector.municipio} - ${conector.uf}] selecionada para Consulta Individualizada. Clique em "Consultar Prefeitura Específica" para testar.`);
      const individualSec = document.getElementById('secao-consulta-individual');
      if (individualSec) {
        individualSec.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      addLog(`⚠️ Prefeitura [${item.municipio} - ${item.uf}] não localizada na lista de conectores ativos.`);
    }
  };

  // Copiar relatório de ocorrências para a área de transferência
  const handleCopiarRelatorioOcorrencias = (listaParaCopiar: OcorrenciaPrefeitura[]) => {
    if (listaParaCopiar.length === 0) return;

    const cabecalho = `## RELATÓRIO DE OCORRÊNCIAS / PREFEITURAS SEM CAPTURA DE XML\n` +
      `Empresa: ${empresaAtiva?.razaoSocial || 'Empresa'} (${empresaAtiva?.cnpjCompleto || ''})\n` +
      `Total: ${listaParaCopiar.length} prefeituras sem captura de XML\n` +
      `Data/Hora da Emissão: ${new Date().toLocaleString('pt-BR')}\n\n` +
      `| Município | UF | Provedor | Tecnologia | Status / Falha | Detalhe do Retorno | Ação Recomendada |\n` +
      `|---|---|---|---|---|---|---|\n`;

    const linhas = listaParaCopiar.map(o => 
      `| ${o.municipio} | ${o.uf} | ${o.provedor} | ${o.tecnologia || 'SOAP'} | ${o.status.toUpperCase()} | ${o.detalheTecnico || o.mensagem} | ${o.acaoSugerida} |`
    ).join('\n');

    navigator.clipboard.writeText(cabecalho + linhas);
    setCopiadoFeedback(true);
    setTimeout(() => setCopiadoFeedback(false), 3000);
  };

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
          <div id="secao-consulta-individual" className="p-3.5 rounded-xl bg-slate-950/80 border border-teal-800/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
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

          {/* NOVA JANELA: DIAGNÓSTICO DE PREFEITURAS SEM CAPTURA DE XML */}
          {todasOcorrencias.length > 0 && (
            <div className="rounded-xl bg-slate-950/90 border border-slate-800 shadow-xl overflow-hidden transition-all">
              
              {/* Header da Janela de Ocorrências */}
              <div className="p-4 border-b border-slate-800/80 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                        Prefeituras sem Captura de XML
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {ocorrenciasFiltradas.length} de {todasOcorrencias.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Diagnóstico automático dos municípios consultados onde nenhum XML foi retornado, com causas prováveis e atalhos de correção.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Botão Copiar Diagnóstico */}
                  <button
                    onClick={() => handleCopiarRelatorioOcorrencias(ocorrenciasFiltradas)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer shadow-sm"
                    title="Copiar relatório estruturado em formato Markdown"
                  >
                    {copiadoFeedback ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiadoFeedback ? 'Copiado!' : 'Copiar Diagnóstico'}</span>
                  </button>

                  {/* Toggle expandir/recolher */}
                  <button
                    onClick={() => setIsPainelOcorrenciasExpandido(prev => !prev)}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={isPainelOcorrenciasExpandido ? 'Recolher janela' : 'Expandir janela'}
                  >
                    {isPainelOcorrenciasExpandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Corpo da Janela de Ocorrências */}
              {isPainelOcorrenciasExpandido && (
                <div className="p-4 space-y-3">
                  
                  {/* Barra de Filtros por Categoria & Busca */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    
                    {/* Pills de Categoria */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <button
                        onClick={() => setFiltroTipoOcorrencia('todos')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          filtroTipoOcorrencia === 'todos'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        Todas ({contagens.todos})
                      </button>

                      {contagens.erro_500 > 0 && (
                        <button
                          onClick={() => setFiltroTipoOcorrencia('erro_500')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                            filtroTipoOcorrencia === 'erro_500'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm'
                              : 'bg-slate-900 text-rose-400/80 hover:text-rose-300 border border-slate-800'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          <span>Falha 50x ({contagens.erro_500})</span>
                        </button>
                      )}

                      {contagens.erro_rede_dns > 0 && (
                        <button
                          onClick={() => setFiltroTipoOcorrencia('erro_rede_dns')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                            filtroTipoOcorrencia === 'erro_rede_dns'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                              : 'bg-slate-900 text-amber-400/80 hover:text-amber-300 border border-slate-800'
                          }`}
                        >
                          <Globe className="w-3 h-3 text-amber-400" />
                          <span>DNS / Host ({contagens.erro_rede_dns})</span>
                        </button>
                      )}

                      {contagens.erro_envelope > 0 && (
                        <button
                          onClick={() => setFiltroTipoOcorrencia('erro_envelope')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                            filtroTipoOcorrencia === 'erro_envelope'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 shadow-sm'
                              : 'bg-slate-900 text-indigo-400/80 hover:text-indigo-300 border border-slate-800'
                          }`}
                        >
                          <FileCode className="w-3 h-3 text-indigo-400" />
                          <span>Envelope SOAP ({contagens.erro_envelope})</span>
                        </button>
                      )}

                      {contagens.timeout > 0 && (
                        <button
                          onClick={() => setFiltroTipoOcorrencia('timeout')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                            filtroTipoOcorrencia === 'timeout'
                              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 shadow-sm'
                              : 'bg-slate-900 text-yellow-400/80 hover:text-yellow-300 border border-slate-800'
                          }`}
                        >
                          <Clock className="w-3 h-3 text-yellow-400" />
                          <span>Timeout ({contagens.timeout})</span>
                        </button>
                      )}

                      {contagens.autenticacao > 0 && (
                        <button
                          onClick={() => setFiltroTipoOcorrencia('autenticacao')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                            filtroTipoOcorrencia === 'autenticacao'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-sm'
                              : 'bg-slate-900 text-purple-400/80 hover:text-purple-300 border border-slate-800'
                          }`}
                        >
                          <KeyRound className="w-3 h-3 text-purple-400" />
                          <span>Auth / 40x ({contagens.autenticacao})</span>
                        </button>
                      )}

                      {contagens.redirecionamento > 0 && (
                        <button
                          onClick={() => setFiltroTipoOcorrencia('redirecionamento')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                            filtroTipoOcorrencia === 'redirecionamento'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50 shadow-sm'
                              : 'bg-slate-900 text-blue-400/80 hover:text-blue-300 border border-slate-800'
                          }`}
                        >
                          <span>↪️ Redirec ({contagens.redirecionamento})</span>
                        </button>
                      )}

                      {contagens.sem_notas > 0 && (
                        <button
                          onClick={() => setFiltroTipoOcorrencia('sem_notas')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                            filtroTipoOcorrencia === 'sem_notas'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                              : 'bg-slate-900 text-emerald-400/80 hover:text-emerald-300 border border-slate-800'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Sem Notas (200 OK) ({contagens.sem_notas})</span>
                        </button>
                      )}
                    </div>

                    {/* Input de Busca Rápida */}
                    <div className="relative min-w-[200px]">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={buscaOcorrencia}
                        onChange={(e) => setBuscaOcorrencia(e.target.value)}
                        placeholder="Filtrar município, UF..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                      />
                      {buscaOcorrencia && (
                        <button
                          onClick={() => setBuscaOcorrencia('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Lista de Ocorrências */}
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/60">
                    {ocorrenciasFiltradas.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-xs italic">
                        Nenhuma ocorrência encontrada com os filtros selecionados.
                      </div>
                    ) : (
                      ocorrenciasFiltradas.map((item, idx) => (
                        <div key={`${item.uf}-${item.municipio}-${idx}`} className="pt-2.5 pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/40 p-2 rounded-xl transition-colors">
                          
                          {/* Coluna 1: Cidade / UF / Provedor */}
                          <div className="flex flex-col gap-1 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-white">
                                [{item.uf}] {item.municipio}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                                {item.provedor}
                              </span>
                              {item.tecnologia && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 font-mono uppercase">
                                  {item.tecnologia}
                                </span>
                              )}
                              
                              {/* Badge de Status */}
                              {renderStatusBadge(item.status)}
                            </div>

                            {/* Detalhe do Erro / Retorno */}
                            <div className="text-[11px] text-slate-300 font-mono flex items-center gap-1.5 truncate">
                              <span className="text-slate-500 shrink-0">Retorno:</span>
                              <span className="truncate text-slate-200" title={item.detalheTecnico || item.mensagem}>
                                {item.detalheTecnico || item.mensagem}
                              </span>
                            </div>

                            {/* Causa e Ação Recomendada */}
                            <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                              <span className="text-cyan-400 font-semibold shrink-0">Ação recomendada:</span>
                              <span>{item.acaoSugerida}</span>
                            </div>
                          </div>

                          {/* Coluna 2: Ação Rápida */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleSelecionarPrefeituraParaTeste(item)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 hover:border-teal-500 text-[11px] font-bold transition-all cursor-pointer shadow-sm"
                              title={`Selecionar [${item.municipio} - ${item.uf}] no seletor individual acima`}
                            >
                              <Target className="w-3 h-3 text-teal-400" />
                              <span>Testar Individual</span>
                            </button>
                          </div>

                        </div>
                      ))
                    )}
                  </div>

                  {/* Rodapé da Janela de Ocorrências com Dicas */}
                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-500">
                    <span>
                      💡 Dica: Prefeituras com <strong>HTTP 200</strong> indicam integração perfeita e ausência de notas no mês. Casos com <strong>DNS</strong> exigem atualização da URL no cadastro.
                    </span>
                    <span className="font-mono text-slate-400">
                      Total listado: {ocorrenciasFiltradas.length}
                    </span>
                  </div>

                </div>
              )}

            </div>
          )}

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
