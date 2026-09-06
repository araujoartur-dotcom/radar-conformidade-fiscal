import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  FileText,
  Building2,
  ShieldCheck,
  RefreshCw,
  Search,
  ExternalLink,
  Layers,
  Sparkles,
  Info,
  DollarSign,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  FileCheck2,
  Check,
  Zap,
  HelpCircle,
  Hash,
  Filter,
  Settings,
  X
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import {
  ResumoCompetenciaApuracao,
  OperacaoContaCorrente,
  LancamentoExtratoCC,
  SeteCamposFinanceiros
} from '../../server/services/apuracaoAssistidaService';

interface ApuracaoAssistidaPanelProps {
  empresaAtiva?: any;
}

export const ApuracaoAssistidaPanel: React.FC<ApuracaoAssistidaPanelProps> = ({ empresaAtiva }) => {
  const { get, post } = useApi();

  // Estados principais
  const [competencia, setCompetencia] = useState<string>('2026-02');
  const [resumo, setResumo] = useState<ResumoCompetenciaApuracao | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'resultado' | 'saldo_atualizado' | 'outras_info' | 'operacoes' | 'calculadora'>('resultado');

  // Operações
  const [operacoes, setOperacoes] = useState<OperacaoContaCorrente[]>([]);
  const [totalOperacoes, setTotalOperacoes] = useState<number>(0);
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'fornecimento' | 'aquisicao'>('todos');
  const [buscaOperacao, setBuscaOperacao] = useState<string>('');

  // Modal de Extrato de Operação
  const [selectedOperacaoId, setSelectedOperacaoId] = useState<string | null>(null);
  const [extratoData, setExtratoData] = useState<{ operacao: OperacaoContaCorrente; extrato: LancamentoExtratoCC[] } | null>(null);
  const [loadingExtrato, setLoadingExtrato] = useState<boolean>(false);

  // Modal / Aba da Calculadora RFB
  const [calcParams, setCalcParams] = useState({
    dataFatoGerador: '2026-02-10',
    tipoOperacao: 'fornecimento' as 'fornecimento' | 'aquisicao',
    ufOrigem: 'SP',
    ufDestino: 'RS',
    municipioDestino: 'Porto Alegre',
    ncm: '8425.31.10',
    cClassTrib: '200031',
    cst: '200',
    baseCalculo: 10000.0
  });
  const [calcResult, setCalcResult] = useState<any>(null);
  const [calcLoading, setCalcLoading] = useState<boolean>(false);

  // Status de Ações
  const [acaoStatus, setAcaoStatus] = useState<{ msg: string; tipo: 'sucesso' | 'erro' } | null>(null);
  const [carregandoCenarios, setCarregandoCenarios] = useState<boolean>(false);

  // Flags e Canais de Ingestão CGIBS (Webhook vs Demanda GET)
  const [flagWebhook, setFlagWebhook] = useState<boolean>(true);
  const [flagConsultaDemanda, setFlagConsultaDemanda] = useState<boolean>(true);
  const [consultandoDemanda, setConsultandoDemanda] = useState<boolean>(false);

  // Isolamento Multi-Tenant de Credenciais (Supergasbras vs Outros CNPJs)
  const [credencialInfo, setCredencialInfo] = useState<any>(null);
  const [isModalCredenciaisOpen, setIsModalCredenciaisOpen] = useState<boolean>(false);
  const [formClientId, setFormClientId] = useState<string>('');
  const [formClientSecret, setFormClientSecret] = useState<string>('');
  const [formWebhookUrl, setFormWebhookUrl] = useState<string>('');
  const [salvandoCreds, setSalvandoCreds] = useState<boolean>(false);

  const cnpjClean = (empresaAtiva?.cnpjCompleto || '').replace(/\D/g, '');
  const cnpjRaizAtivo = empresaAtiva?.cnpjRaiz || cnpjClean.substring(0, 8);
  const isSupergasbras = cnpjRaizAtivo === '19791896' || (empresaAtiva?.razaoSocial || '').toUpperCase().includes('SUPERGASBRAS');

  // Carregar dados da competência
  const carregarDados = async () => {
    try {
      setLoading(true);
      const empId = empresaAtiva?.id || 'default-empresa';
      
      const res = await get<ResumoCompetenciaApuracao>(`/apuracao/competencia/${competencia}?empresaId=${empId}`);
      if (res.ok && res.data) {
        setResumo(res.data);
      }

      const opRes = await get<{ operacoes: OperacaoContaCorrente[]; total: number }>(
        `/apuracao/operacoes?empresaId=${empId}&competencia=${competencia}&tipo=${tipoFiltro}&busca=${buscaOperacao}`
      );
      if (opRes.ok && opRes.data) {
        setOperacoes(opRes.data.operacoes);
        setTotalOperacoes(opRes.data.total);
      }

      // Carregar preferências e credenciais isoladas por empresa
      const credRes = await get<any>(`/apuracao/credenciais?empresaId=${empId}`);
      if (credRes.ok && credRes.data) {
        setCredencialInfo(credRes.data);
        if (credRes.data.flagWebhook !== undefined) setFlagWebhook(credRes.data.flagWebhook);
        if (credRes.data.flagConsultaDemanda !== undefined) setFlagConsultaDemanda(credRes.data.flagConsultaDemanda);
        if (credRes.data.clientId) setFormClientId(credRes.data.clientId);
        if (credRes.data.webhookUrl) setFormWebhookUrl(credRes.data.webhookUrl);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados da apuração:', err);
    } finally {
      setLoading(false);
    }
  };

  // Alternar flags de Webhook ou Consulta por Demanda
  const handleToggleFlag = async (tipo: 'webhook' | 'demanda', novoValor: boolean) => {
    try {
      const empId = empresaAtiva?.id || 'default-empresa';
      const novoWebhook = tipo === 'webhook' ? novoValor : flagWebhook;
      const novaDemanda = tipo === 'demanda' ? novoValor : flagConsultaDemanda;
      
      if (tipo === 'webhook') setFlagWebhook(novoValor);
      if (tipo === 'demanda') setFlagConsultaDemanda(novoValor);

      await post('/apuracao/credenciais/flags', {
        empresaId: empId,
        flagWebhook: novoWebhook,
        flagConsultaDemanda: novaDemanda
      });

      setAcaoStatus({
        msg: `Canal CGIBS [${tipo === 'webhook' ? 'Webhook Push' : 'Consulta por Demanda'}] ${novoValor ? 'ATIVADO' : 'DESATIVADO'} com sucesso.`,
        tipo: 'sucesso'
      });
    } catch (err: any) {
      console.error('Erro ao atualizar flags:', err);
      setAcaoStatus({ msg: `Erro ao alterar preferências: ${err.message}`, tipo: 'erro' });
    }
  };

  // Disparar consulta manual por demanda GET /v1/aassist/solicitacao/...
  const handleDispararConsultaDemanda = async () => {
    try {
      setConsultandoDemanda(true);
      setAcaoStatus(null);
      const empId = empresaAtiva?.id || 'default-empresa';
      const res = await post<any>('/apuracao/consultar-demanda', {
        empresaId: empId,
        competencia
      });

      if (res.ok && res.data?.success) {
        setAcaoStatus({
          msg: `${res.data.mensagem} Protocolo: ${res.data.protocoloSolicitacao}`,
          tipo: 'sucesso'
        });
      } else {
        setAcaoStatus({
          msg: res.data?.error || 'Falha ao comunicar com a SEFIN Nacional.',
          tipo: 'erro'
        });
      }
    } catch (err: any) {
      setAcaoStatus({
        msg: `Erro na consulta por demanda: ${err.message}`,
        tipo: 'erro'
      });
    } finally {
      setConsultandoDemanda(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [competencia, tipoFiltro, empresaAtiva?.id]);

  // Carregar extrato detalhado
  const abrirExtrato = async (opId: string) => {
    try {
      setSelectedOperacaoId(opId);
      setLoadingExtrato(true);
      const res = await get<{ operacao: OperacaoContaCorrente; extrato: LancamentoExtratoCC[] }>(`/apuracao/operacao/${opId}`);
      if (res.ok && res.data) {
        setExtratoData(res.data);
      }
    } catch (err) {
      console.error('Erro ao carregar extrato:', err);
    } finally {
      setLoadingExtrato(false);
    }
  };

  // Carregar Cenários Oficiais do CGIBS (Didáticos 1 e 2)
  const handleCarregarCenarios = async () => {
    try {
      setCarregandoCenarios(true);
      setAcaoStatus(null);
      const empId = empresaAtiva?.id || 'default-empresa';
      const res = await post<{ success: boolean; mensagens: string[] }>('/apuracao/simular-cenarios', {
        empresaId: empId
      });

      if (res.ok && res.data?.success) {
        setAcaoStatus({
          msg: 'Cenários Oficiais 1 e 2 (CGIBS Julho/2026) carregados com sucesso!',
          tipo: 'sucesso'
        });
        carregarDados();
      }
    } catch (err: any) {
      setAcaoStatus({
        msg: `Falha ao carregar cenários: ${err.message}`,
        tipo: 'erro'
      });
    } finally {
      setCarregandoCenarios(false);
    }
  };

  // Executar simulação na Calculadora RFB
  const handleCalcularRtc = async () => {
    try {
      setCalcLoading(true);
      const res = await post<any>('/apuracao/calcular-tributos', {
        params: calcParams
      });
      if (res.ok && res.data) {
        setCalcResult(res.data);
      }
    } catch (err) {
      console.error('Erro no cálculo:', err);
    } finally {
      setCalcLoading(false);
    }
  };

  // Salvar credenciais próprias para empresa multi-tenant
  const handleSalvarCredenciaisEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSalvandoCreds(true);
      const empId = empresaAtiva?.id || 'default-empresa';
      const res = await post<any>('/apuracao/credenciais', {
        empresaId: empId,
        clientId: formClientId,
        clientSecret: formClientSecret,
        webhookUrl: formWebhookUrl,
        flagWebhook,
        flagConsultaDemanda
      });

      if (res.ok && res.data?.success) {
        setAcaoStatus({ msg: res.data.mensagem || 'Credenciais registradas com sucesso para a empresa!', tipo: 'sucesso' });
        setIsModalCredenciaisOpen(false);
        carregarDados();
      } else {
        setAcaoStatus({ msg: res.data?.error || 'Erro ao registrar credenciais.', tipo: 'erro' });
      }
    } catch (err: any) {
      setAcaoStatus({ msg: `Falha: ${err.message}`, tipo: 'erro' });
    } finally {
      setSalvandoCreds(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-12">
      
      {/* Top Banner de Identidade & Status Oficial */}
      <div className="bg-gradient-to-r from-[#0d1b2e] via-[#0e2238] to-[#0a1828] border border-cyan-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white shrink-0">
              <Calculator className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Apuração Assistida <span className="text-cyan-400">IBS / CBS</span>
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  CGIBS MOC v1.00 & RFB RTC v1
                </span>
                {isSupergasbras ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm shadow-emerald-950">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Piloto Oficial CGIBS: Supergasbras (CNPJ8 19791896)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-sm shadow-amber-950">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Multi-Tenant: {empresaAtiva?.razaoSocial || 'Empresa'} (CNPJ8: {cnpjRaizAtivo}) — {credencialInfo?.configurado ? 'Credenciais Próprias' : 'Configuração Pendente'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Operacionalização da não-cumulatividade, controle do Conta Corrente Fiscal em 7 campos oficiais e ledger incremental com cálculo em tempo real.
              </p>
            </div>
          </div>

          {/* Controles de Topo: Competência + Botão Cenários */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Competência */}
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-400 font-medium">Competência:</span>
              <select
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
                className="bg-transparent text-white font-bold cursor-pointer focus:outline-none"
              >
                <option value="2026-01" className="bg-slate-900 text-white">01/2026 (Jan/2026)</option>
                <option value="2026-02" className="bg-slate-900 text-white">02/2026 (Fev/2026 — Cenário 1)</option>
                <option value="2026-03" className="bg-slate-900 text-white">03/2026 (Mar/2026)</option>
                <option value="2026-04" className="bg-slate-900 text-white">04/2026 (Abr/2026 — Cenário 2)</option>
                <option value="2026-09" className="bg-slate-900 text-white">09/2026 (Set/2026 — Vigente)</option>
              </select>
            </div>

            {/* Botão Configurar Credenciais */}
            <button
              onClick={() => {
                setFormClientId(credencialInfo?.clientId || '');
                setFormClientSecret('');
                setFormWebhookUrl(credencialInfo?.webhookUrl || '');
                setIsModalCredenciaisOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
              title="Configurar Credenciais do CGIBS / SEFIN Nacional"
            >
              <Settings className="w-3.5 h-3.5 text-cyan-400" />
              <span>Credenciais</span>
            </button>

            {/* Botão Carregar Cenários Didáticos Oficiais */}
            <button
              onClick={handleCarregarCenarios}
              disabled={carregandoCenarios}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all cursor-pointer border border-cyan-400/30"
              title="Carregar Cenários 1 e 2 das páginas 33 a 43 do Manual do CGIBS"
            >
              <Sparkles className={`w-4 h-4 ${carregandoCenarios ? 'animate-spin' : ''}`} />
              <span>{carregandoCenarios ? 'Importando...' : 'Carregar Cenários Didáticos CGIBS'}</span>
            </button>

            {/* Botão Refresh */}
            <button
              onClick={carregarDados}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Atualizar Dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Indicador do Ciclo de Vida da Competência */}
        {resumo && (
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-400">Estágio da Competência:</span>
              <div className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 ${
                resumo.fase === 'concluida'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : resumo.fase === 'periodo_ajuste'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{resumo.fase_descricao}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-slate-400">
              <span>Período: <strong className="text-slate-200">{resumo.data_inicio}</strong> a <strong className="text-slate-200">{resumo.data_fim}</strong></span>
              <span>Operações vinculadas: <strong className="text-cyan-400">{resumo.total_operacoes}</strong></span>
              <span>Lançamentos no Conta Corrente: <strong className="text-cyan-400">{resumo.total_lancamentos}</strong></span>
            </div>
          </div>
        )}

        {/* Alerta de Feedback */}
        {acaoStatus && (
          <div className={`mt-3 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            acaoStatus.tipo === 'sucesso'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
              : 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
          }`}>
            {acaoStatus.tipo === 'sucesso' ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{acaoStatus.msg}</span>
          </div>
        )}
      </div>

      {/* Cards de Métricas Principais (Executive Overview) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Resultado da Apuração */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Resultado da Apuração</span>
            <div className={`p-2 rounded-xl ${
              (resumo?.resultado.resultado_apuracao || 0) < 0
                ? 'bg-emerald-500/10 text-emerald-400'
                : (resumo?.resultado.resultado_apuracao || 0) > 0
                ? 'bg-rose-500/10 text-rose-400'
                : 'bg-slate-800 text-slate-400'
            }`}>
              {(resumo?.resultado.resultado_apuracao || 0) < 0 ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-bold font-mono ${
              (resumo?.resultado.resultado_apuracao || 0) < 0 ? 'text-emerald-400' : (resumo?.resultado.resultado_apuracao || 0) > 0 ? 'text-rose-400' : 'text-slate-200'
            }`}>
              R$ {Math.abs(resumo?.resultado.resultado_apuracao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-sm ml-1 font-semibold">
                {(resumo?.resultado.resultado_apuracao || 0) < 0 ? 'C (Credor)' : (resumo?.resultado.resultado_apuracao || 0) > 0 ? 'D (Devedor)' : ''}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Débitos Líquidos: R$ {(resumo?.resultado.debitos_liquidos || 0).toFixed(2)} | Créditos: R$ {(resumo?.resultado.creditos_liquidos || 0).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Card 2: Saldo Atualizado */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Saldo Atualizado</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-cyan-400">
              R$ {Math.abs(resumo?.saldo_atualizado.saldo_atualizado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-sm ml-1 font-semibold">
                {(resumo?.saldo_atualizado.saldo_atualizado || 0) < 0 ? 'C' : (resumo?.saldo_atualizado.saldo_atualizado || 0) > 0 ? 'D' : ''}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {resumo?.saldo_atualizado.status_ativacao ? 'Ativado pós-fechamento do dia 25' : 'Será ativado após 25 do mês subsequente'}
            </div>
          </div>
        </div>

        {/* Card 3: Créditos a Apropriar (Compras c/ débito pendente do fornecedor) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Créditos Passíveis Apropriação</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-amber-400">
              R$ {(resumo?.outras_informacoes.creditos_acumulados_passiveis_apropriacao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Aguardando extinção do débito pelo fornecedor
            </div>
          </div>
        </div>

        {/* Card 4: Pagamentos Utilizados (Split / Extinções) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Pagamentos Utilizados</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-indigo-400">
              R$ {(resumo?.resultado.pagamentos_utilizados || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Split Payment, DARF e Compensações
            </div>
          </div>
        </div>
      </div>

      {/* Banner de Canais de Ingestão CGIBS (Webhook vs Demanda GET) & Desacoplamento ERP */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex flex-col gap-1 max-w-xl">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Canais de Ingestão CGIBS / SEFIN Nacional
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700 font-mono">
              ERP Desacoplado
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Controle a recepção automática via Webhook ou sob demanda via requisição GET. O módulo opera de forma autônoma sem exigir conexão síncrona com o ERP.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Flag 1: Webhook Push */}
          <button
            onClick={() => handleToggleFlag('webhook', !flagWebhook)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              flagWebhook
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80 shadow-sm shadow-emerald-900/30'
                : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-400'
            }`}
            title="Ativar/Desativar recebimento de Deltas via Webhook"
          >
            <div className={`w-2 h-2 rounded-full ${flagWebhook ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span>Webhook Automático</span>
            <span className="text-[10px] opacity-80 font-mono">[{flagWebhook ? 'ATIVO' : 'DESLIGADO'}]</span>
          </button>

          {/* Flag 2: Consulta por Demanda */}
          <button
            onClick={() => handleToggleFlag('demanda', !flagConsultaDemanda)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              flagConsultaDemanda
                ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700/80 shadow-sm shadow-indigo-900/30'
                : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-400'
            }`}
            title="Ativar/Desativar consultas manuais por demanda à API CGIBS"
          >
            <div className={`w-2 h-2 rounded-full ${flagConsultaDemanda ? 'bg-indigo-400' : 'bg-slate-600'}`} />
            <span>Consultas por Demanda (GET)</span>
            <span className="text-[10px] opacity-80 font-mono">[{flagConsultaDemanda ? 'ATIVO' : 'DESLIGADO'}]</span>
          </button>

          {/* Botão de Disparo Manual de Consulta GET */}
          {flagConsultaDemanda && (
            <button
              onClick={handleDispararConsultaDemanda}
              disabled={consultandoDemanda}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all cursor-pointer shadow-sm shadow-cyan-600/30 disabled:opacity-50"
              title="Disparar consulta manual GET /v1/aassist/solicitacao/... à SEFIN Nacional"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${consultandoDemanda ? 'animate-spin' : ''}`} />
              <span>{consultandoDemanda ? 'Solicitando...' : 'Consultar Arquivos (GET)'}</span>
            </button>
          )}
        </div>

        {/* Aviso de Isolamento para Empresas Multi-Tenant (Não-Supergasbras) */}
        {!isSupergasbras && !credencialInfo?.configurado && (
          <div className="w-full mt-2 p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Esta empresa (CNPJ raiz <strong>{cnpjRaizAtivo}</strong>) ainda não possui credenciais do CGIBS registradas. As credenciais do piloto oficial pertencem exclusivamente à <strong>Supergasbras</strong>.
              </span>
            </div>
            <button
              onClick={() => {
                setFormClientId('');
                setFormClientSecret('');
                setFormWebhookUrl('');
                setIsModalCredenciaisOpen(true);
              }}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs shrink-0 cursor-pointer shadow-sm transition-all"
            >
              Cadastrar Credenciais Desta Empresa
            </button>
          </div>
        )}
      </div>

      {/* Navegação por Abas Oficiais */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('resultado')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'resultado'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Aba Resultado</span>
        </button>

        <button
          onClick={() => setActiveTab('saldo_atualizado')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'saldo_atualizado'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Aba Saldo Atualizado</span>
        </button>

        <button
          onClick={() => setActiveTab('outras_info')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'outras_info'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Info className="w-4 h-4" />
          <span>Aba Outras Informações</span>
        </button>

        <button
          onClick={() => setActiveTab('operacoes')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'operacoes'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Extrato das Operações ({totalOperacoes})</span>
        </button>

        <button
          onClick={() => setActiveTab('calculadora')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ml-auto ${
            activeTab === 'calculadora'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Calculator className="w-4 h-4 text-indigo-400" />
          <span>Calculadora Oficial RFB</span>
        </button>
      </div>

      {/* Conteúdo da Aba 1: Resultado da Apuração */}
      {activeTab === 'resultado' && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Demonstrativo da Apuração — Aba "Resultado"</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Consolidação dos débitos de fornecimento, redutores de estorno, créditos apropriados e pagamentos extintos conforme Art. 27 da LC 215/2025.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-cyan-400 px-3 py-1 rounded-lg bg-cyan-950/40 border border-cyan-800">
              Competência: {competencia}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Conta Fiscal</th>
                  <th className="py-3 px-4">Fundamento Normativo</th>
                  <th className="py-3 px-4 text-right">Valor CBS (R$)</th>
                  <th className="py-3 px-4 text-right">Valor IBS (R$)</th>
                  <th className="py-3 px-4 text-right">Total Consolidado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {/* Débitos */}
                <tr className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    Débitos (Fornecimentos de Bens e Serviços)
                  </td>
                  <td className="py-3 px-4 text-slate-400">Valores de CBS/IBS destacados nos DF-e emitidos</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-200">
                    R$ {((resumo?.resultado.debitos || 0) * 0.9).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-200">
                    R$ {((resumo?.resultado.debitos || 0) * 0.1).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-rose-400">
                    R$ {(resumo?.resultado.debitos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Redutores de Débitos */}
                <tr className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-bold text-slate-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    (-) Redutores de Débitos
                  </td>
                  <td className="py-3 px-4 text-slate-400">Cancelamentos e devoluções de operações próprias</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">
                    R$ {((resumo?.resultado.redutores_debitos || 0) * 0.9).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">
                    R$ {((resumo?.resultado.redutores_debitos || 0) * 0.1).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-300">
                    - R$ {(resumo?.resultado.redutores_debitos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Créditos de CBS/IBS apropriados */}
                <tr className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-bold text-emerald-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    (+) Créditos Apropriados (Aquisições)
                  </td>
                  <td className="py-3 px-4 text-slate-400">Aquisições com débitos extintos pelo fornecedor (Art. 27 LC 215/25)</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-400">
                    R$ {((resumo?.resultado.creditos_apropriados || 0) * 0.9).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-400">
                    R$ {((resumo?.resultado.creditos_apropriados || 0) * 0.1).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                    R$ {(resumo?.resultado.creditos_apropriados || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Redutores de Créditos */}
                <tr className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-bold text-slate-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    (-) Redutores de Créditos Apropriados
                  </td>
                  <td className="py-3 px-4 text-slate-400">Estornos de crédito por devolução ou perecimento</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">
                    R$ {((resumo?.resultado.redutores_creditos || 0) * 0.9).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">
                    R$ {((resumo?.resultado.redutores_creditos || 0) * 0.1).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-300">
                    - R$ {(resumo?.resultado.redutores_creditos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Pagamentos Utilizados */}
                <tr className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-bold text-indigo-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    (-) Pagamentos Utilizados
                  </td>
                  <td className="py-3 px-4 text-slate-400">Split Payment, recolhimento pelo adquirente e compensações</td>
                  <td className="py-3 px-4 text-right font-mono text-indigo-400">
                    R$ {((resumo?.resultado.pagamentos_utilizados || 0) * 0.9).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-indigo-400">
                    R$ {((resumo?.resultado.pagamentos_utilizados || 0) * 0.1).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-indigo-400">
                    - R$ {(resumo?.resultado.pagamentos_utilizados || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Linha Totalizadora de Resultado */}
                <tr className="bg-slate-950 font-bold border-t-2 border-slate-700 text-sm">
                  <td className="py-4 px-4 text-white">
                    RESULTADO DA APURAÇÃO
                  </td>
                  <td className="py-4 px-4 text-xs font-normal text-slate-400">
                    {(resumo?.resultado.resultado_apuracao || 0) < 0 ? 'Saldo Credor a Transferir para o Mês Seguinte' : 'Saldo a Recolher'}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-cyan-300">
                    R$ {((resumo?.resultado.resultado_apuracao || 0) * 0.9).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-cyan-300">
                    R$ {((resumo?.resultado.resultado_apuracao || 0) * 0.1).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`py-4 px-4 text-right font-mono text-base ${
                    (resumo?.resultado.resultado_apuracao || 0) < 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    R$ {Math.abs(resumo?.resultado.resultado_apuracao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    <span className="text-xs ml-1">
                      {(resumo?.resultado.resultado_apuracao || 0) < 0 ? 'C' : 'D'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 2: Saldo Atualizado */}
      {activeTab === 'saldo_atualizado' && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-base font-bold text-white">Demonstrativo de Saldo Atualizado — Pós-Fechamento</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Reflexo de alterações após o encerramento do período de ajuste (dia 25 do mês subsequente).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Status de Ativação do Saldo Atualizado:</div>
              <div className="text-sm font-bold text-white mt-0.5">
                {resumo?.saldo_atualizado.status_ativacao ? '✅ Ativado para a competência selecionada' : '⏳ Aguardando conclusão do período de ajuste (dia 25)'}
              </div>
            </div>
            <div className="text-right font-mono">
              <div className="text-xs text-slate-400">Saldo Conclusão:</div>
              <div className="text-lg font-bold text-cyan-400">
                R$ {(resumo?.saldo_atualizado.resultado_apuracao_conclusao || 0).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400">Saldo Credor p/ Apuração Subsequente</div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                R$ {(resumo?.saldo_atualizado.saldo_credor_transferido_proxima || 0).toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Art. 53 da LC 214/2025</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400">Pedidos de Ressarcimento</div>
              <div className="text-xl font-bold font-mono text-slate-200 mt-1">
                R$ {(resumo?.saldo_atualizado.pedido_ressarcimento || 0).toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Sem pedidos no período teste</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400">Desfazimento de Pagamentos</div>
              <div className="text-xl font-bold font-mono text-slate-200 mt-1">
                R$ {(resumo?.saldo_atualizado.desfazimento_utilizacao_pagamento || 0).toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Valores liberados para restituição</div>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 3: Outras Informações */}
      {activeTab === 'outras_info' && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-base font-bold text-white">Aba "Outras Informações" — Monitoramento em Tempo Real</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Controle de filas assíncronas do Comitê Gestor e créditos de aquisições com débitos ainda pendentes de quitação.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Clock className="w-4 h-4" />
                <span>Créditos Acumulados Passíveis de Apropriação</span>
              </div>
              <p className="text-xs text-slate-400">
                Registros de créditos originados em compras de fornecedores. Tornam-se automaticamente apropriáveis quando o débito da operação for extinto pelo fornecedor.
              </p>
              <div className="text-2xl font-bold font-mono text-amber-400">
                R$ {(resumo?.outras_informacoes.creditos_acumulados_passiveis_apropriacao || 0).toFixed(2)}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                <RefreshCw className="w-4 h-4" />
                <span>Débitos Aguardando Processamento (Fila 10 Min)</span>
              </div>
              <p className="text-xs text-slate-400">
                Débitos recepcionados pela RFB/CGIBS aguardando a ordenação cronológica por data de emissão do DF-e.
              </p>
              <div className="text-2xl font-bold font-mono text-blue-400">
                R$ {(resumo?.outras_informacoes.debitos_aguardando_processamento || 0).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 4: Extrato das Operações */}
      {activeTab === 'operacoes' && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white">Operações & Contas Correntes Fiscais</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cada fornecimento ou aquisição possui seu próprio ciclo de vida e extrato de lançamentos imutáveis.
              </p>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 mr-2" />
                <input
                  type="text"
                  placeholder="Buscar por Chave ou CNPJ..."
                  value={buscaOperacao}
                  onChange={(e) => setBuscaOperacao(e.target.value)}
                  className="bg-transparent text-white focus:outline-none w-48 text-xs"
                />
              </div>

              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-1.5 text-xs cursor-pointer focus:outline-none"
              >
                <option value="todos">Todos os Tipos</option>
                <option value="fornecimento">Fornecimento (Vendas)</option>
                <option value="aquisicao">Aquisição (Compras)</option>
              </select>
            </div>
          </div>

          {/* Tabela de Operações */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">ID Operação</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Chave de Acesso</th>
                  <th className="py-3 px-4">Fornecedor / Adquirente</th>
                  <th className="py-3 px-4 text-right">Débito Aberto</th>
                  <th className="py-3 px-4 text-right">Débito Extinto</th>
                  <th className="py-3 px-4 text-right">Crédito Utilizado</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {operacoes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      Nenhuma operação localizada para os filtros selecionados. Clique em "Carregar Cenários Didáticos" acima para testar!
                    </td>
                  </tr>
                ) : (
                  operacoes.map((op) => (
                    <tr key={op.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                        #{op.id}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          op.tipo_operacao === 'fornecimento'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {op.tipo_operacao === 'fornecimento' ? 'Fornecimento' : 'Aquisição'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {op.chave_acesso.substring(0, 4)}...{op.chave_acesso.slice(-8)}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <div>Forn: <strong className="font-mono text-white">{op.cnpj_fornecedor}</strong></div>
                        {op.cnpj_adquirente && <div className="text-[11px] text-slate-400">Adq: {op.cnpj_adquirente}</div>}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        R$ {op.saldos_atuais.debito_em_aberto.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400">
                        R$ {op.saldos_atuais.debito_extinto.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-indigo-400">
                        R$ {op.saldos_atuais.credito_utilizado.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => abrirExtrato(op.id)}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold transition-all cursor-pointer"
                        >
                          Ver Extrato CC
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 5: Calculadora Oficial da RFB */}
      {activeTab === 'calculadora' && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-indigo-400" />
                <span>Calculadora Oficial de Tributos RTC (Receita Federal)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Conectada ao motor oficial (localhost:8080) com fallback nativo para o banco de dados do Radar Fiscal conforme LC 214/2025.
              </p>
            </div>
            <span className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              API Local & Fallback Ativos
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950 p-5 rounded-2xl border border-slate-800 text-xs">
            <div>
              <label className="text-slate-400 font-semibold block mb-1">Data do Fato Gerador</label>
              <input
                type="date"
                value={calcParams.dataFatoGerador}
                onChange={(e) => setCalcParams({ ...calcParams, dataFatoGerador: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 font-semibold block mb-1">NCM / Mercadoria</label>
              <input
                type="text"
                value={calcParams.ncm}
                onChange={(e) => setCalcParams({ ...calcParams, ncm: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-mono"
                placeholder="Ex: 8425.31.10"
              />
            </div>

            <div>
              <label className="text-slate-400 font-semibold block mb-1">cClassTrib (6 Dígitos)</label>
              <input
                type="text"
                value={calcParams.cClassTrib}
                onChange={(e) => setCalcParams({ ...calcParams, cClassTrib: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-mono"
                placeholder="Ex: 200031"
              />
            </div>

            <div>
              <label className="text-slate-400 font-semibold block mb-1">Base de Cálculo (R$)</label>
              <input
                type="number"
                value={calcParams.baseCalculo}
                onChange={(e) => setCalcParams({ ...calcParams, baseCalculo: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-mono font-bold"
              />
            </div>
          </div>

          <button
            onClick={handleCalcularRtc}
            disabled={calcLoading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 hover:opacity-90 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Calculator className={`w-4 h-4 ${calcLoading ? 'animate-spin' : ''}`} />
            <span>{calcLoading ? 'Processando no Motor Oficial...' : 'Calcular Tributos RTC & Memória de Cálculo'}</span>
          </button>

          {calcResult && (
            <div className="p-5 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Resultado da Simulação</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  Origem: {calcResult.origem}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px]">CBS Federal (0.90%)</div>
                  <div className="text-base font-bold text-white mt-1">R$ {calcResult.valorCbs.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-500">Redução: {calcResult.percentualReducaoCbs}%</div>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px]">IBS Estadual (0.10%)</div>
                  <div className="text-base font-bold text-white mt-1">R$ {calcResult.valorIbsEstadual.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-500">Redução: {calcResult.percentualReducaoIbsEstadual}%</div>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px]">IBS Municipal (0.00%)</div>
                  <div className="text-base font-bold text-white mt-1">R$ {calcResult.valorIbsMunicipal.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-500">Redução: {calcResult.percentualReducaoIbsMunicipal}%</div>
                </div>

                <div className="p-3 bg-cyan-950/40 rounded-xl border border-cyan-800/60">
                  <div className="text-cyan-400 text-[10px] font-bold">TOTAL TRIBUTOS RTC</div>
                  <div className="text-lg font-bold text-cyan-300 mt-1">R$ {calcResult.valorTotalTributos.toFixed(2)}</div>
                  <div className="text-[10px] text-cyan-500">IBS + CBS</div>
                </div>
              </div>

              <div className="text-xs text-slate-400 pt-2 border-t border-slate-800">
                <strong>Memória de Cálculo:</strong> {calcResult.memoriaCalculo} | <strong>Base Legal:</strong> {calcResult.baseLegal}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: EXTRATO COMPLETO DO CONTA CORRENTE FISCAL (LEDGER INCREMENTAL) */}
      {selectedOperacaoId && extratoData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1320] border border-cyan-500/40 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Header do Modal */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                  <Hash className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Extrato do Conta Corrente Fiscal — Operação #{extratoData.operacao.id}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Chave: {extratoData.operacao.chave_acesso}
                  </p>
                </div>
              </div>

              <button
                onClick={() => { setSelectedOperacaoId(null); setExtratoData(null); }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Informações da Operação */}
            <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-4">
                <span>Tipo: <strong className="text-white uppercase">{extratoData.operacao.tipo_operacao}</strong></span>
                <span>Fornecedor: <strong className="font-mono text-cyan-300">{extratoData.operacao.cnpj_fornecedor}</strong></span>
                {extratoData.operacao.cnpj_adquirente && (
                  <span>Adquirente: <strong className="font-mono text-cyan-300">{extratoData.operacao.cnpj_adquirente}</strong></span>
                )}
              </div>
              <div className="text-slate-400 font-mono text-[11px]">
                Hash Integridade: <span className="text-cyan-400">{extratoData.operacao.hash_acumulado || 'N/A'}</span>
              </div>
            </div>

            {/* Tabela de Lançamentos Incrementais */}
            <div className="flex-1 overflow-y-auto p-6">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3"># ID</th>
                    <th className="py-2.5 px-3">Data / Hora</th>
                    <th className="py-2.5 px-3">Movimentação (MOV)</th>
                    <th className="py-2.5 px-3 text-right">Déb. Aberto</th>
                    <th className="py-2.5 px-3 text-right">Déb. Extinto</th>
                    <th className="py-2.5 px-3 text-right">Créd. Apropriar</th>
                    <th className="py-2.5 px-3 text-right">Créd. Disponível</th>
                    <th className="py-2.5 px-3 text-right">Créd. Utilizado</th>
                    <th className="py-2.5 px-3 text-right">Saldo Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {extratoData.extrato.map((linha, idx) => (
                    <tr key={linha.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-400">#{linha.id}</td>
                      <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">
                        {linha.dth_lancto.replace('.000 +00:00', '')}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white">
                        {linha.mov}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono ${linha.debito_em_aberto !== 0 ? 'text-rose-400 font-bold' : 'text-slate-600'}`}>
                        {linha.debito_em_aberto !== 0 ? linha.debito_em_aberto.toFixed(2) : '-'}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono ${linha.debito_extinto !== 0 ? 'text-emerald-400 font-bold' : 'text-slate-600'}`}>
                        {linha.debito_extinto !== 0 ? linha.debito_extinto.toFixed(2) : '-'}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono ${linha.credito_a_propriar !== 0 ? 'text-amber-400 font-bold' : 'text-slate-600'}`}>
                        {linha.credito_a_propriar !== 0 ? linha.credito_a_propriar.toFixed(2) : '-'}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono ${linha.credito_nao_utilizado !== 0 ? 'text-emerald-400 font-bold' : 'text-slate-600'}`}>
                        {linha.credito_nao_utilizado !== 0 ? linha.credito_nao_utilizado.toFixed(2) : '-'}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono ${linha.credito_utilizado !== 0 ? 'text-indigo-400 font-bold' : 'text-slate-600'}`}>
                        {linha.credito_utilizado !== 0 ? linha.credito_utilizado.toFixed(2) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-cyan-300 bg-slate-950/40">
                        {linha.saldo_acumulado
                          ? `Créd: ${linha.saldo_acumulado.credito_utilizado} | Déb: ${linha.saldo_acumulado.debito_extinto}`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer do Modal */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Sistemática Incremental: Cada linha é um evento imutável.</span>
              <span className="font-bold text-white">Total: {extratoData.extrato.length} lançamentos</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuração de Credenciais Multi-Tenant CGIBS */}
      {isModalCredenciaisOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Credenciais CGIBS / SEFIN Nacional</h3>
                  <p className="text-xs text-slate-400">
                    {empresaAtiva?.razaoSocial || 'Empresa'} — CNPJ raiz: <span className="font-mono text-cyan-400">{cnpjRaizAtivo}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalCredenciaisOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Aviso de Isolamento */}
            <div className="p-4 bg-slate-950/40 border-b border-slate-800/80 text-xs">
              {isSupergasbras ? (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
                  <p className="font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Piloto Oficial Autorizado (Supergasbras)
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-400/90 leading-relaxed">
                    As credenciais oficiais do piloto CGIBS (5c37db2e...) estão ativas e vinculadas exclusivamente a esta empresa.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Isolamento Multi-Tenant Garantido
                  </p>
                  <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                    Informe as credenciais OAuth 2.0 (Client ID e Client Secret) emitidas pelo Comitê Gestor para este CNPJ raiz ({cnpjRaizAtivo}). O sistema não permite o reuso das chaves do piloto Supergasbras por outros CNPJs.
                  </p>
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSalvarCredenciaisEmpresa} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Client ID (CGIBS / SEFIN)
                </label>
                <input
                  type="text"
                  required
                  disabled={isSupergasbras}
                  value={formClientId}
                  onChange={(e) => setFormClientId(e.target.value)}
                  placeholder="Ex: 5c37db2e924740449c621b2d95afeef2"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Client Secret (Chave Privada de Acesso)
                </label>
                <input
                  type="password"
                  required={!credencialInfo?.configurado}
                  disabled={isSupergasbras}
                  value={formClientSecret}
                  onChange={(e) => setFormClientSecret(e.target.value)}
                  placeholder={credencialInfo?.clientSecretMascarado ? `Atual: ${credencialInfo.clientSecretMascarado}` : 'Informe o Client Secret emitido'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                {isSupergasbras && (
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    As credenciais do piloto Supergasbras estão protegidas contra vazamento entre inquilinos.
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  URL de Retorno Webhook (Opcional)
                </label>
                <input
                  type="url"
                  value={formWebhookUrl}
                  onChange={(e) => setFormWebhookUrl(e.target.value)}
                  placeholder="https://seu-dominio.com/api/apuracao/webhook"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalCredenciaisOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Fechar
                </button>
                {!isSupergasbras && (
                  <button
                    type="submit"
                    disabled={salvandoCreds}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {salvandoCreds ? 'Salvando...' : 'Salvar Credenciais'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
