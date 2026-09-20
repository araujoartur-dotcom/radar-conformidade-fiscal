import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Layers, Filter, Play, Download, Save, FolderOpen, Plus, Trash2,
  RefreshCw, CheckCircle2, AlertTriangle, Lock, Globe, Building2, User,
  Search, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
  Table, BarChart2, Calendar, FileSpreadsheet, FileCode, Clock, ShieldCheck,
  Copy, X, Sparkles, SlidersHorizontal, Info, Eye
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import {
  CockpitModelo, CockpitDataSource, CockpitField, CockpitQueryConfig,
  CockpitMetrica, CockpitFiltro, CockpitOrdenacao, CockpitScope,
  CockpitAggregationType, CockpitFilterOperator
} from '../types';

export const CockpitRelatoriosPanel: React.FC = () => {
  const { user, empresaAtiva } = useAuth();
  const { get, post, put, del } = useApi();

  // Estados de Metadados
  const [fontes, setFontes] = useState<CockpitDataSource[]>([]);
  const [modelos, setModelos] = useState<CockpitModelo[]>([]);
  const [modeloAtivo, setModeloAtivo] = useState<CockpitModelo | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(true);

  // Estados de Construção da Consulta
  const [fonteSelecionada, setFonteSelecionada] = useState<string>('dfe_itens_documentos');
  const [modo, setModo] = useState<'detalhado' | 'agrupado'>('agrupado');
  const [dimensoes, setDimensoes] = useState<string[]>(['ncm', 'cclasstrib', 'cst_csosn', 'fornecedor_razao']);
  const [metricas, setMetricas] = useState<CockpitMetrica[]>([
    { campo: 'valor_bruto_item', agregacao: 'sum', apelido: 'Valor Bruto Total' },
    { campo: 'valor_liquido_item', agregacao: 'sum', apelido: 'Valor Líquido' },
    { campo: 'base_ibs', agregacao: 'sum', apelido: 'Base IBS' },
    { campo: 'valor_ibs', agregacao: 'sum', apelido: 'IBS Apurado' },
    { campo: 'base_cbs', agregacao: 'sum', apelido: 'Base CBS' },
    { campo: 'valor_cbs', agregacao: 'sum', apelido: 'CBS Apurado' },
    { campo: 'id', agregacao: 'count', apelido: 'Qtd Itens' }
  ]);
  const [filtros, setFiltros] = useState<CockpitFiltro[]>([]);
  const [ordenacao, setOrdenacao] = useState<CockpitOrdenacao[]>([
    { campo: 'valor_liquido_item', direcao: 'desc' }
  ]);
  const [limite, setLimite] = useState<number>(1000);

  // Estados de Execução & Resultados
  const [isExecutando, setIsExecutando] = useState<boolean>(false);
  const [execErro, setExecErro] = useState<string | null>(null);
  const [sucessoFeedback, setSucessoFeedback] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    rows: any[];
    columns: { key: string; label: string; type: string }[];
    totals: Record<string, number>;
    totalCount: number;
    executionTimeMs: number;
  } | null>(null);

  // Estados de Paginação e Filtro Local de Busca
  const [termoBusca, setTermoBusca] = useState<string>('');
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const [itensPorPagina, setItensPorPagina] = useState<number>(25);

  // Estados de Modais
  const [isSalvarModalOpen, setIsSalvarModalOpen] = useState<boolean>(false);
  const [isGerenciarModelosOpen, setIsGerenciarModelosOpen] = useState<boolean>(false);
  const [filtroEscopoModelos, setFiltroEscopoModelos] = useState<'todos' | 'global' | 'empresa' | 'pessoal'>('todos');

  // Form de Salvamento de Modelo
  const [nomeNovoModelo, setNomeNovoModelo] = useState<string>('');
  const [descNovoModelo, setDescNovoModelo] = useState<string>('');
  const [categoriaNovoModelo, setCategoriaNovoModelo] = useState<string>('fiscal');
  const [escopoNovoModelo, setEscopoNovoModelo] = useState<CockpitScope>('pessoal');
  const [isSalvandoModelo, setIsSalvandoModelo] = useState<boolean>(false);

  const isAdminMaster = user?.perfil === 'admin_master';

  // Obter fonte de dados ativa
  const fonteAtivaObj = useMemo(() => {
    return fontes.find(f => f.id === fonteSelecionada) || fontes[0] || null;
  }, [fontes, fonteSelecionada]);

  // Carregar fontes de dados e modelos salvos
  const carregarMetadados = useCallback(async () => {
    setIsLoadingMeta(true);
    try {
      const [resFontes, resModelos] = await Promise.all([
        get('/cockpit/fontes-dados'),
        get('/cockpit/modelos')
      ]);

      if (resFontes.ok && resFontes.data?.fontes) {
        setFontes(resFontes.data.fontes);
      }

      if (resModelos.ok && resModelos.data?.modelos) {
        setModelos(resModelos.data.modelos);
      }
    } catch (err: any) {
      console.error('Erro ao carregar fontes e modelos do cockpit:', err);
    } finally {
      setIsLoadingMeta(false);
    }
  }, [get]);

  useEffect(() => {
    carregarMetadados();
  }, [carregarMetadados]);

  // Executar a consulta dinâmica
  const executarConsulta = useCallback(async () => {
    if (!empresaAtiva?.id) {
      setExecErro('Por favor, selecione uma empresa ativa para consultar os dados com isolamento multi-tenant.');
      return;
    }

    setIsExecutando(true);
    setExecErro(null);

    try {
      const payload = {
        fonte_dados: fonteSelecionada,
        modo,
        dimensoes,
        metricas: modo === 'agrupado' ? metricas : [],
        filtros,
        ordenacao,
        limite
      };

      const res = await post('/cockpit/executar', payload);

      if (res.ok && res.data) {
        setResultado({
          rows: res.data.rows || [],
          columns: res.data.columns || [],
          totals: res.data.totals || {},
          totalCount: res.data.totalCount || 0,
          executionTimeMs: res.data.executionTimeMs || 0
        });
        setPaginaAtual(1);
      } else {
        setExecErro(res.data?.error || res.error || 'Falha ao executar relatório.');
      }
    } catch (err: any) {
      setExecErro(err.message || 'Erro inesperado na execução da consulta.');
    } finally {
      setIsExecutando(false);
    }
  }, [empresaAtiva?.id, fonteSelecionada, modo, dimensoes, metricas, filtros, ordenacao, limite, post]);

  // Auto-executar consulta ao inicializar ou quando mudar modelo ativo
  useEffect(() => {
    if (empresaAtiva?.id && fontes.length > 0 && !resultado && !isExecutando) {
      executarConsulta();
    }
  }, [empresaAtiva?.id, fontes.length]);

  // Aplicar modelo selecionado
  const aplicarModelo = (mod: CockpitModelo) => {
    setModeloAtivo(mod);
    const cfg = mod.configuracao;

    if (cfg.fonte_dados) setFonteSelecionada(cfg.fonte_dados);
    if (cfg.modo) setModo(cfg.modo);
    if (cfg.dimensoes) setDimensoes(cfg.dimensoes);
    if (cfg.metricas) setMetricas(cfg.metricas);
    if (cfg.filtros) setFiltros(cfg.filtros);
    if (cfg.ordenacao) setOrdenacao(cfg.ordenacao);
    if (cfg.limite) setLimite(cfg.limite);

    setIsGerenciarModelosOpen(false);
    setSucessoFeedback(`Modelo '${mod.nome}' carregado com sucesso!`);
    setTimeout(() => setSucessoFeedback(null), 4000);
  };

  // Salvar modelo atual
  const handleSalvarModelo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeNovoModelo.trim()) return;

    // Proteção de Governança
    if (escopoNovoModelo === 'global' && !isAdminMaster) {
      alert('Apenas o Administrador Master tem autorização para criar modelos com escopo Global.');
      return;
    }

    setIsSalvandoModelo(true);
    setExecErro(null);

    try {
      const payload = {
        nome: nomeNovoModelo.trim(),
        descricao: descNovoModelo.trim(),
        categoria: categoriaNovoModelo,
        escopo: escopoNovoModelo,
        configuracao: {
          fonte_dados: fonteSelecionada,
          modo,
          dimensoes,
          metricas,
          filtros,
          ordenacao,
          limite
        }
      };

      const res = await post('/cockpit/modelos', payload);

      if (res.ok) {
        setIsSalvarModalOpen(false);
        setNomeNovoModelo('');
        setDescNovoModelo('');
        setSucessoFeedback('Modelo salvo com sucesso no escopo ' + escopoNovoModelo.toUpperCase());
        setTimeout(() => setSucessoFeedback(null), 4000);
        carregarMetadados();
      } else {
        alert(res.data?.error || res.error || 'Erro ao salvar modelo.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar modelo.');
    } finally {
      setIsSalvandoModelo(false);
    }
  };

  // Excluir modelo
  const handleExcluirModelo = async (id: string, nome: string) => {
    if (!confirm(`Deseja realmente excluir o modelo '${nome}'?`)) return;

    try {
      const res = await del(`/cockpit/modelos/${id}`);
      if (res.ok) {
        if (modeloAtivo?.id === id) setModeloAtivo(null);
        carregarMetadados();
        setSucessoFeedback(`Modelo '${nome}' excluído.`);
        setTimeout(() => setSucessoFeedback(null), 3000);
      } else {
        alert(res.data?.error || res.error || 'Erro ao excluir modelo.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir modelo.');
    }
  };

  // Exportar relatório direto pelo backend (.xlsx ou .json)
  const handleExportar = async (formato: 'xlsx' | 'json') => {
    if (!empresaAtiva?.id) {
      alert('Selecione uma empresa ativa.');
      return;
    }

    try {
      const payload = {
        formato,
        nomeRelatorio: modeloAtivo ? modeloAtivo.nome : `Relatorio_${fonteSelecionada}`,
        fonte_dados: fonteSelecionada,
        modo,
        dimensoes,
        metricas: modo === 'agrupado' ? metricas : [],
        filtros,
        ordenacao,
        limite: 20000
      };

      const token = localStorage.getItem('@RadarFiscal:token') || '';
      const baseUrl = '/api/cockpit/exportar';

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-empresa-ativa-id': empresaAtiva.id
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao exportar arquivo.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${modeloAtivo?.nome || 'relatorio_dinamico'}_${new Date().toISOString().slice(0, 10)}.${formato}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Erro na exportação.');
    }
  };

  // Helpers de Manipulação de Dimensões
  const toggleDimensao = (campoKey: string) => {
    setDimensoes(prev => {
      if (prev.includes(campoKey)) {
        return prev.filter(k => k !== campoKey);
      } else {
        return [...prev, campoKey];
      }
    });
  };

  // Helpers de Manipulação de Métricas
  const adicionarMetrica = (campoKey: string) => {
    const campoObj = fonteAtivaObj?.campos.find(c => c.key === campoKey);
    const apelido = campoObj ? `${campoObj.label}` : campoKey;
    setMetricas(prev => [
      ...prev,
      { campo: campoKey, agregacao: 'sum', apelido }
    ]);
  };

  const removerMetrica = (index: number) => {
    setMetricas(prev => prev.filter((_, idx) => idx !== index));
  };

  const atualizarMetrica = (index: number, patch: Partial<CockpitMetrica>) => {
    setMetricas(prev => prev.map((m, idx) => idx === index ? { ...m, ...patch } : m));
  };

  // Helpers de Filtros
  const adicionarFiltro = () => {
    const primeiroCampo = fonteAtivaObj?.campos[0]?.key || 'ncm';
    setFiltros(prev => [
      ...prev,
      { campo: primeiroCampo, operador: 'contains', valor: '' }
    ]);
  };

  const removerFiltro = (index: number) => {
    setFiltros(prev => prev.filter((_, idx) => idx !== index));
  };

  const atualizarFiltro = (index: number, patch: Partial<CockpitFiltro>) => {
    setFiltros(prev => prev.map((f, idx) => idx === index ? { ...f, ...patch } : f));
  };

  // Filtragem local de busca nos dados carregados
  const linhasFiltradas = useMemo(() => {
    if (!resultado?.rows) return [];
    if (!termoBusca.trim()) return resultado.rows;

    const termo = termoBusca.toLowerCase().trim();
    return resultado.rows.filter(row => {
      return Object.values(row).some(val => 
        String(val ?? '').toLowerCase().includes(termo)
      );
    });
  }, [resultado?.rows, termoBusca]);

  // Paginação
  const totalPaginas = Math.ceil(linhasFiltradas.length / itensPorPagina) || 1;
  const linhasPaginadas = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return linhasFiltradas.slice(inicio, inicio + itensPorPagina);
  }, [linhasFiltradas, paginaAtual, itensPorPagina]);

  // Formatação de valores
  const formatarValor = (valor: any, tipo?: string) => {
    if (valor === null || valor === undefined || valor === '') return '-';
    if (tipo === 'number' || typeof valor === 'number') {
      const num = Number(valor);
      if (isNaN(num)) return valor;
      // Se for número inteiro pequeno ou contagem
      if (Number.isInteger(num) && num < 1000) return num.toString();
      // Formata como moeda brasileira
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return String(valor);
  };

  // Modelos filtrados por escopo no modal de gerenciamento
  const modelosFiltrados = useMemo(() => {
    if (filtroEscopoModelos === 'todos') return modelos;
    return modelos.filter(m => m.escopo === filtroEscopoModelos);
  }, [modelos, filtroEscopoModelos]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* ============================================================ */}
      {/* TOPO: BANNER DE CONTROLE DO COCKPIT & AÇÕES RÁPIDAS           */}
      {/* ============================================================ */}
      <div className="glass-panel-glow p-5 rounded-2xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-500/10 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-400">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    Cockpit de Relatórios Dinâmicos
                  </h1>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300">
                    Studio Pivot
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Construa e customize relatórios fiscais com qualquer informação do banco de dados, matrizes de agrupamento e salvamento com controle de acesso.
                </p>
              </div>
            </div>
          </div>

          {/* Botões de Ação do Topo */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Seletor de Modelo Ativo */}
            <button
              onClick={() => setIsGerenciarModelosOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all cursor-pointer shadow-sm"
              title="Gerenciar e Carregar Modelos Salvos"
            >
              <FolderOpen className="w-4 h-4 text-cyan-400" />
              <span>{modeloAtivo ? modeloAtivo.nome : 'Selecionar Modelo'}</span>
              {modeloAtivo && (
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                  modeloAtivo.escopo === 'global' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                  modeloAtivo.escopo === 'empresa' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                  'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                }`}>
                  {modeloAtivo.escopo}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Salvar como Modelo */}
            <button
              onClick={() => setIsSalvarModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800/90 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 hover:border-indigo-400 transition-all cursor-pointer shadow-sm"
              title="Salvar a configuração atual como um novo modelo reutilizável"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Modelo</span>
            </button>

            {/* Exportar Excel */}
            <button
              onClick={() => handleExportar('xlsx')}
              disabled={isExecutando || !resultado || resultado.rows.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exportar dados para Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>.XLSX</span>
            </button>

            {/* Exportar JSON */}
            <button
              onClick={() => handleExportar('json')}
              disabled={isExecutando || !resultado || resultado.rows.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exportar dados para JSON (.json)"
            >
              <FileCode className="w-4 h-4" />
              <span>.JSON</span>
            </button>

            {/* Botão Executar Consulta */}
            <button
              onClick={executarConsulta}
              disabled={isExecutando}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-600/30 border border-cyan-400/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isExecutando ? 'animate-spin' : ''}`} />
              <span>{isExecutando ? 'Executando...' : 'Executar Relatório'}</span>
            </button>
          </div>
        </div>

        {/* Notificações de Sucesso / Feedback */}
        {sucessoFeedback && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{sucessoFeedback}</span>
          </div>
        )}

        {/* Mensagem de Erro */}
        {execErro && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{execErro}</span>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* CORPO: DIVISÃO EM SIDEBAR DE CONFIGURAÇÃO E ÁREA DE RESULTADOS */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ========================================== */}
        {/* COLUNA ESQUERDA: CONSTRUTOR DA CONSULTA    */}
        {/* ========================================== */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel-glow p-4 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Parâmetros da Consulta
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {empresaAtiva?.razaoSocial || 'Sem empresa'}
              </span>
            </div>

            {/* 1. Fonte de Dados */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-cyan-400" />
                <span>1. Fonte de Dados Canônica</span>
              </label>
              <select
                value={fonteSelecionada}
                onChange={e => {
                  setFonteSelecionada(e.target.value);
                  // Reseta dimensões para padrões da nova fonte
                  if (e.target.value === 'dfe_documentos') {
                    setDimensoes(['fornecedor_uf', 'cliente_uf', 'tipo_operacao']);
                  } else if (e.target.value === 'eventos_transmitidos') {
                    setDimensoes(['tipo_dfe', 'nome_evento', 'status']);
                  } else if (e.target.value === 'apuracao_extrato_cc') {
                    setDimensoes(['tipo_tributo', 'tipo_lancamento', 'natureza_operacao']);
                  } else {
                    setDimensoes(['ncm', 'cclasstrib', 'cst_csosn', 'fornecedor_razao']);
                  }
                }}
                className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {fontes.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
              {fonteAtivaObj && (
                <p className="text-[10px] text-slate-400 px-1">
                  {fonteAtivaObj.descricao}
                </p>
              )}
            </div>

            {/* 2. Modo de Visualização */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>2. Modo de Montagem</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModo('agrupado')}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    modo === 'agrupado'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md border border-cyan-400/40'
                      : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Pivot Agrupada</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModo('detalhado')}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    modo === 'detalhado'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md border border-cyan-400/40'
                      : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Tabela Analítica</span>
                </button>
              </div>
            </div>

            {/* 3. Dimensões (Agrupamento ou Colunas) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-300">
                  3. {modo === 'agrupado' ? 'Dimensões de Agrupamento (Linhas)' : 'Colunas Selecionadas'}
                </label>
                <span className="text-[10px] text-cyan-400 font-mono">
                  {dimensoes.length} selecionada(s)
                </span>
              </div>

              {/* Tag Picker com campos disponíveis */}
              <div className="max-h-40 overflow-y-auto p-2 bg-slate-900/70 border border-slate-800 rounded-xl space-y-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {fonteAtivaObj?.campos.map(campo => {
                    const isSelected = dimensoes.includes(campo.key);
                    return (
                      <button
                        key={campo.key}
                        type="button"
                        onClick={() => toggleDimensao(campo.key)}
                        className={`text-[10px] px-2 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                            : 'bg-slate-800/80 text-slate-400 border border-slate-700/60 hover:text-slate-200'
                        }`}
                      >
                        <span>{campo.label}</span>
                        {isSelected ? <X className="w-2.5 h-2.5 text-cyan-400" /> : <Plus className="w-2.5 h-2.5 text-slate-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4. Métricas / Medidas (Apenas no Modo Agrupado) */}
            {modo === 'agrupado' && (
              <div className="space-y-2 border-t border-slate-800/80 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>4. Métricas Agregadas (Valores)</span>
                  </label>
                  <span className="text-[10px] text-amber-400 font-mono">
                    {metricas.length} medida(s)
                  </span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {metricas.map((met, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2">
                      <select
                        value={met.agregacao}
                        onChange={e => atualizarMetrica(idx, { agregacao: e.target.value as CockpitAggregationType })}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-amber-300 font-mono focus:outline-none"
                      >
                        <option value="sum">Soma</option>
                        <option value="count">Contagem</option>
                        <option value="count_distinct">Qtd Única</option>
                        <option value="avg">Média</option>
                        <option value="min">Mínimo</option>
                        <option value="max">Máximo</option>
                      </select>

                      <select
                        value={met.campo}
                        onChange={e => atualizarMetrica(idx, { campo: e.target.value })}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none truncate"
                      >
                        {fonteAtivaObj?.campos.map(c => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={met.apelido || ''}
                        onChange={e => atualizarMetrica(idx, { apelido: e.target.value })}
                        placeholder="Rótulo"
                        className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none"
                      />

                      <button
                        type="button"
                        onClick={() => removerMetrica(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                        title="Remover Métrica"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Botão Adicionar Métrica */}
                <div className="flex items-center gap-2">
                  <select
                    id="select-add-metrica"
                    className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-300"
                    defaultValue=""
                    onChange={e => {
                      if (e.target.value) {
                        adicionarMetrica(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="" disabled>+ Adicionar Métrica de Valor...</option>
                    {fonteAtivaObj?.campos.filter(c => c.aggregatable || c.type === 'number').map(c => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* 5. Filtros Dinâmicos */}
            <div className="space-y-2 border-t border-slate-800/80 pt-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-cyan-400" />
                  <span>5. Filtros da Consulta</span>
                </label>
                <button
                  type="button"
                  onClick={adicionarFiltro}
                  className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Novo Filtro</span>
                </button>
              </div>

              {filtros.length === 0 ? (
                <p className="text-[10px] text-slate-500 italic px-1">
                  Nenhum filtro aplicado. Exibindo todos os registros da empresa ativa.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {filtros.map((fil, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={fil.campo}
                          onChange={e => atualizarFiltro(idx, { campo: e.target.value })}
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none"
                        >
                          {fonteAtivaObj?.campos.map(c => (
                            <option key={c.key} value={c.key}>
                              {c.label}
                            </option>
                          ))}
                        </select>

                        <select
                          value={fil.operador}
                          onChange={e => atualizarFiltro(idx, { operador: e.target.value as CockpitFilterOperator })}
                          className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-cyan-300 font-mono focus:outline-none"
                        >
                          <option value="contains">Contém</option>
                          <option value="starts_with">Começa com</option>
                          <option value="eq">Igual a</option>
                          <option value="neq">Diferente</option>
                          <option value="gt">Maior que (&gt;)</option>
                          <option value="gte">Maior ou igual (&gt;=)</option>
                          <option value="lt">Menor que (&lt;)</option>
                          <option value="lte">Menor ou igual (&lt;=)</option>
                          <option value="is_null">Vazio / Nulo</option>
                          <option value="is_not_null">Preenchido</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => removerFiltro(idx)}
                          className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                          title="Remover Filtro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {fil.operador !== 'is_null' && fil.operador !== 'is_not_null' && (
                        <input
                          type="text"
                          value={fil.valor ?? ''}
                          onChange={e => atualizarFiltro(idx, { valor: e.target.value })}
                          placeholder="Valor do filtro..."
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 6. Ordenação & Limite Seguro */}
            <div className="grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Limite Seguro de Linhas
                </label>
                <select
                  value={limite}
                  onChange={e => setLimite(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 font-mono"
                >
                  <option value={200}>200 linhas</option>
                  <option value={500}>500 linhas</option>
                  <option value={1000}>1.000 linhas</option>
                  <option value={2500}>2.500 linhas</option>
                  <option value={5000}>5.000 linhas (máx)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Direção da Ordenação
                </label>
                <select
                  value={ordenacao[0]?.direcao || 'desc'}
                  onChange={e => {
                    const dir = e.target.value as 'asc' | 'desc';
                    setOrdenacao(prev => [{ campo: prev[0]?.campo || dimensoes[0] || 'id', direcao: dir }]);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 font-mono"
                >
                  <option value="desc">Decrescente (Z-A / Maior)</option>
                  <option value="asc">Crescente (A-Z / Menor)</option>
                </select>
              </div>
            </div>

            {/* Botão Final de Execução */}
            <button
              type="button"
              onClick={executarConsulta}
              disabled={isExecutando}
              className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isExecutando ? 'animate-spin' : ''}`} />
              <span>{isExecutando ? 'Processando dados...' : 'Atualizar e Executar'}</span>
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* COLUNA DIREITA: RESULTADOS & TABELA DINÂMICA */}
        {/* ========================================== */}
        <div className="lg:col-span-8 space-y-4">
          <div className="glass-panel-glow p-4 rounded-2xl border border-slate-800 space-y-3">
            {/* Barra de Status e Pesquisa Local */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                  <span className="font-bold text-white">
                    {linhasFiltradas.length.toLocaleString('pt-BR')}
                  </span>
                  <span>registro(s) retornado(s)</span>
                </div>

                {resultado && (
                  <div className="flex items-center gap-1 text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    <Clock className="w-3 h-3" />
                    <span>{resultado.executionTimeMs} ms</span>
                  </div>
                )}
              </div>

              {/* Input de Busca Rápida Local */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={termoBusca}
                  onChange={e => {
                    setTermoBusca(e.target.value);
                    setPaginaAtual(1);
                  }}
                  placeholder="Pesquisar nos resultados..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Tabela de Resultados */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-[560px] relative">
              <table className="w-full text-left border-collapse text-xs">
                {/* Cabeçalho Fixo */}
                <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-md z-10 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="p-3 font-mono text-slate-500 w-12 text-center">#</th>
                    {resultado?.columns.map(col => {
                      const isSorted = ordenacao[0]?.campo === col.key;
                      const sortDir = ordenacao[0]?.direcao;

                      return (
                        <th
                          key={col.key}
                          onClick={() => {
                            setOrdenacao(prev => {
                              const currentDir = prev[0]?.campo === col.key ? prev[0].direcao : 'desc';
                              const nextDir = currentDir === 'asc' ? 'desc' : 'asc';
                              return [{ campo: col.key, direcao: nextDir }];
                            });
                          }}
                          className="p-3 font-semibold text-slate-300 hover:text-white cursor-pointer select-none transition-colors"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{col.label}</span>
                            {isSorted ? (
                              sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100" />
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* Corpo de Dados */}
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {linhasPaginadas.length === 0 ? (
                    <tr>
                      <td colSpan={(resultado?.columns.length || 1) + 1} className="p-8 text-center text-slate-500">
                        {isExecutando ? (
                          <div className="flex items-center justify-center gap-2 text-cyan-400 font-semibold">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Carregando dados fiscais...</span>
                          </div>
                        ) : (
                          <span>Nenhum registro encontrado para os parâmetros selecionados.</span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    linhasPaginadas.map((row, rIdx) => {
                      const rowNum = (paginaAtual - 1) * itensPorPagina + rIdx + 1;
                      return (
                        <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-mono text-slate-500 text-center text-[10px]">
                            {rowNum}
                          </td>
                          {resultado?.columns.map(col => {
                            const val = row[col.key];
                            const isNumeric = col.type === 'number';

                            return (
                              <td
                                key={col.key}
                                className={`p-3 text-slate-300 ${
                                  isNumeric ? 'text-right font-mono font-medium' : ''
                                }`}
                              >
                                {col.key === 'cclasstrib' || col.key === 'cst_csosn' || col.key === 'tipo_doc' ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                                    {val || '-'}
                                  </span>
                                ) : (
                                  formatarValor(val, col.type)
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Rodapé com Totais Automáticos */}
                {resultado?.totals && Object.keys(resultado.totals).length > 0 && linhasFiltradas.length > 0 && (
                  <tfoot className="sticky bottom-0 bg-slate-900/95 border-t-2 border-cyan-500/30 font-semibold text-white">
                    <tr>
                      <td className="p-3 text-center text-[10px] font-mono uppercase text-cyan-400">
                        TOTAL
                      </td>
                      {resultado.columns.map(col => {
                        const totalVal = resultado.totals[col.key];
                        return (
                          <td
                            key={col.key}
                            className={`p-3 text-xs ${
                              totalVal !== undefined ? 'text-right font-mono text-cyan-300 font-bold' : 'text-slate-500'
                            }`}
                          >
                            {totalVal !== undefined ? formatarValor(totalVal, 'number') : ''}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Barra de Paginação */}
            {linhasFiltradas.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Exibindo</span>
                  <select
                    value={itensPorPagina}
                    onChange={e => {
                      setItensPorPagina(Number(e.target.value));
                      setPaginaAtual(1);
                    }}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>de {linhasFiltradas.length} linhas</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPaginaAtual(1)}
                    disabled={paginaAtual === 1}
                    className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    &laquo;
                  </button>
                  <button
                    onClick={() => setPaginaAtual(prev => Math.max(prev - 1, 1))}
                    disabled={paginaAtual === 1}
                    className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    Anterior
                  </button>

                  <span className="text-xs px-2 font-mono text-slate-300">
                    {paginaAtual} / {totalPaginas}
                  </span>

                  <button
                    onClick={() => setPaginaAtual(prev => Math.min(prev + 1, totalPaginas))}
                    disabled={paginaAtual === totalPaginas}
                    className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    Próxima
                  </button>
                  <button
                    onClick={() => setPaginaAtual(totalPaginas)}
                    disabled={paginaAtual === totalPaginas}
                    className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    &raquo;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL: SALVAR COMO MODELO DE RELATÓRIO                       */}
      {/* ============================================================ */}
      {isSalvarModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel-glow w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
                  <Save className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Salvar Modelo de Relatório
                  </h3>
                  <p className="text-xs text-slate-400">
                    Grave a configuração atual para execução instantânea no futuro.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSalvarModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarModelo} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Nome do Modelo *
                </label>
                <input
                  type="text"
                  value={nomeNovoModelo}
                  onChange={e => setNomeNovoModelo(e.target.value)}
                  placeholder="Ex: Auditoria de Combustíveis por Fornecedor"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Descrição / Objetivo
                </label>
                <textarea
                  value={descNovoModelo}
                  onChange={e => setDescNovoModelo(e.target.value)}
                  placeholder="Explique a finalidade tributária deste relatório..."
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Categoria
                  </label>
                  <select
                    value={categoriaNovoModelo}
                    onChange={e => setCategoriaNovoModelo(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="fiscal">Fiscal Geral</option>
                    <option value="auditoria">Auditoria & Compliance</option>
                    <option value="rtc">Reforma Tributária (RTC)</option>
                    <option value="gerencial">Gerencial / Diretoria</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Escopo de Visibilidade *
                  </label>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="escopo"
                        value="pessoal"
                        checked={escopoNovoModelo === 'pessoal'}
                        onChange={() => setEscopoNovoModelo('pessoal')}
                      />
                      <User className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-slate-200">🔒 Pessoal (Apenas Você)</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="escopo"
                        value="empresa"
                        checked={escopoNovoModelo === 'empresa'}
                        onChange={() => setEscopoNovoModelo('empresa')}
                      />
                      <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-slate-200">🏢 Empresa (Equipe Desta Empresa)</span>
                    </label>

                    {/* Escopo Global Restrito */}
                    <label className={`flex items-center gap-2 p-2 rounded-xl border text-xs ${
                      isAdminMaster
                        ? 'bg-slate-900 border-amber-500/30 cursor-pointer'
                        : 'bg-slate-900/40 border-slate-800 opacity-60 cursor-not-allowed'
                    }`}>
                      <input
                        type="radio"
                        name="escopo"
                        value="global"
                        disabled={!isAdminMaster}
                        checked={escopoNovoModelo === 'global'}
                        onChange={() => setEscopoNovoModelo('global')}
                      />
                      <Globe className="w-3.5 h-3.5 text-amber-400" />
                      <div className="flex-1">
                        <span className="text-amber-300 font-semibold">🌐 Global (Plataforma)</span>
                        {!isAdminMaster && (
                          <span className="block text-[9px] text-amber-500/80 font-mono">
                            Exclusivo para o Admin Master do Sistema
                          </span>
                        )}
                      </div>
                      {!isAdminMaster && <Lock className="w-3 h-3 text-amber-400" />}
                    </label>
                  </div>
                </div>
              </div>

              {/* Aviso de Governança sobre Escopo Global */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Diretriz de Segurança:</strong> Modelos com escopo Global impactam todos os usuários e empresas da plataforma e só podem ser publicados pelo Administrador Master para evitar consultas desbalanceadas.
                </span>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSalvarModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/80 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSalvandoModelo}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSalvandoModelo ? 'Salvando...' : 'Confirmar e Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: GERENCIADOR DE MODELOS SALVOS                         */}
      {/* ============================================================ */}
      {isGerenciarModelosOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel-glow w-full max-w-3xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Meus Modelos e Modelos da Plataforma
                  </h3>
                  <p className="text-xs text-slate-400">
                    Selecione um modelo para carregar no Cockpit ou gerencie permissões.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGerenciarModelosOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filtro de Abas de Escopo */}
            <div className="p-3 bg-slate-900/60 border-b border-slate-800 flex items-center gap-2">
              <button
                onClick={() => setFiltroEscopoModelos('todos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  filtroEscopoModelos === 'todos' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos ({modelos.length})
              </button>
              <button
                onClick={() => setFiltroEscopoModelos('global')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  filtroEscopoModelos === 'global' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                🌐 Globais ({modelos.filter(m => m.escopo === 'global').length})
              </button>
              <button
                onClick={() => setFiltroEscopoModelos('empresa')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  filtroEscopoModelos === 'empresa' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                🏢 Empresa ({modelos.filter(m => m.escopo === 'empresa').length})
              </button>
              <button
                onClick={() => setFiltroEscopoModelos('pessoal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  filtroEscopoModelos === 'pessoal' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                🔒 Pessoais ({modelos.filter(m => m.escopo === 'pessoal').length})
              </button>
            </div>

            {/* Lista de Modelos */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {modelosFiltrados.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  Nenhum modelo cadastrado nesta categoria.
                </div>
              ) : (
                modelosFiltrados.map(mod => {
                  const isCurrent = modeloAtivo?.id === mod.id;

                  return (
                    <div
                      key={mod.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-blue-950/30 border-cyan-500/40 shadow-md'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white truncate">
                            {mod.nome}
                          </h4>

                          {/* Badge de Escopo */}
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            mod.escopo === 'global' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                            mod.escopo === 'empresa' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' :
                            'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          }`}>
                            {mod.escopo === 'global' ? '🌐 Global' : mod.escopo === 'empresa' ? '🏢 Empresa' : '🔒 Pessoal'}
                          </span>

                          {mod.is_padrao_sistema === 1 && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                              Padrão de Fábrica
                            </span>
                          )}
                        </div>

                        {mod.descricao && (
                          <p className="text-xs text-slate-400">
                            {mod.descricao}
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono pt-1">
                          <span>Criado por: {mod.criado_por_nome || 'Sistema'}</span>
                          {mod.categoria && <span>Categoria: {mod.categoria.toUpperCase()}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => aplicarModelo(mod)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 cursor-pointer shadow-sm flex items-center gap-1.5"
                        >
                          <Play className="w-3 h-3" />
                          <span>Carregar no Cockpit</span>
                        </button>

                        {/* Botão Excluir (Se autorizado) */}
                        {mod.podeEditar && mod.is_padrao_sistema !== 1 && (
                          <button
                            onClick={() => handleExcluirModelo(mod.id, mod.nome)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                            title="Excluir Modelo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
