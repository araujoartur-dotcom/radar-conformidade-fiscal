import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Layers, Filter, Play, Save, FolderOpen, Trash2,
  RefreshCw, CheckCircle2, AlertTriangle, Lock, Globe, Building2, User,
  Search, ChevronDown, ChevronUp, ArrowUp, ArrowDown,
  Table, BarChart2, Calendar, FileSpreadsheet, FileCode, Clock,
  Copy, X, Sparkles, Info, Pencil
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import {
  CockpitModelo, CockpitDataSource, CockpitField, CockpitQueryConfig,
  CockpitMetrica, CockpitFiltro, CockpitOrdenacao, CockpitScope,
  CockpitAggregationType, CockpitFilterOperator
} from '../types';

// ============================================================
// FONTES DE DADOS CANÔNICAS (Tags Oficiais XML SEFAZ/RTC)
// ============================================================
const DEFAULT_COCKPIT_DATA_SOURCES: CockpitDataSource[] = [
  {
    id: 'dfe_itens_documentos',
    nome: 'Itens de Documentos Fiscais (Tags Oficiais XML)',
    descricao: 'Itens de NF-e, CT-e e NFS-e extraídos diretamente das tags canônicas dos XMLs (NT 2025.002 RTC / SEFAZ).',
    campos: [
      // 1. Tags Oficiais da Reforma Tributária (RTC)
      { key: 'cClassTrib', label: 'cClassTrib (Classificação Tributária RTC)', type: 'string', group: 'Reforma Tributária (RTC)' },
      { key: 'indOper', label: 'indOper (Indicador da Operação RTC)', type: 'string', group: 'Reforma Tributária (RTC)' },
      { key: 'vBC', label: 'vBC (Base de Cálculo IBS/CBS)', type: 'number', group: 'Reforma Tributária (RTC)', aggregatable: true },
      { key: 'pIBSUF', label: 'pIBSUF (Alíquota IBS Estadual %)', type: 'number', group: 'Reforma Tributária (RTC)', aggregatable: true },
      { key: 'vIBSUF', label: 'vIBSUF (Valor IBS Estadual R$)', type: 'number', group: 'Reforma Tributária (RTC)', aggregatable: true },
      { key: 'pIBSMun', label: 'pIBSMun (Alíquota IBS Municipal %)', type: 'number', group: 'Reforma Tributária (RTC)', aggregatable: true },
      { key: 'vIBSMun', label: 'vIBSMun (Valor IBS Municipal R$)', type: 'number', group: 'Reforma Tributária (RTC)', aggregatable: true },
      { key: 'pIBS', label: 'pIBS (Alíquota IBS Global %)', type: 'number', group: 'Reforma Tributária (RTC)', aggregatable: true },
      { key: 'vIBS', label: 'vIBS (Valor IBS Global R$)', type: 'number', group: 'Reforma Tributária (RTC)', aggregatable: true },
      { key: 'pCBS', label: 'pCBS (Alíquota CBS %)', type: 'number', group: 'Reforma Tributária (RTC)', aggregatable: true },
      { key: 'vCBS', label: 'vCBS (Valor CBS Global R$)', type: 'number', group: 'Reforma Tributária (RTC)', aggregatable: true },
      { key: 'vIS', label: 'vIS (Imposto Seletivo R$)', type: 'number', group: 'Reforma Tributária (RTC)', aggregatable: true },

      // 2. Classificação & Dados dos Produtos / Itens
      { key: 'NCM', label: 'NCM (Classificação Fiscal)', type: 'string', group: 'Classificação Fiscal' },
      { key: 'CFOP', label: 'CFOP (Natureza da Operação)', type: 'string', group: 'Classificação Fiscal' },
      { key: 'CST', label: 'CST / CSOSN', type: 'string', group: 'Classificação Fiscal' },
      { key: 'descricao_item', label: 'Descrição do Item / Produto', type: 'string', group: 'Produto / Serviço' },
      { key: 'qCom', label: 'qCom (Quantidade Comercial)', type: 'number', group: 'Quantidades', aggregatable: true },
      { key: 'uCom', label: 'uCom (Unidade de Medida)', type: 'string', group: 'Quantidades' },
      { key: 'vProd', label: 'vProd (Valor Bruto dos Produtos R$)', type: 'number', group: 'Valores Comerciais', aggregatable: true },
      { key: 'vItem', label: 'vItem (Valor Líquido do Item R$)', type: 'number', group: 'Valores Comerciais', aggregatable: true },
      { key: 'vDesc', label: 'vDesc (Desconto Incondicional R$)', type: 'number', group: 'Valores Comerciais', aggregatable: true },
      { key: 'vFrete', label: 'vFrete (Frete Rateado R$)', type: 'number', group: 'Valores Comerciais', aggregatable: true },

      // 3. Destino & Localização
      { key: 'cMun', label: 'cMun (Cód. IBGE Município Destino)', type: 'string', group: 'Localização & Destino' },
      { key: 'xMun', label: 'xMun (Nome Município Destino)', type: 'string', group: 'Localização & Destino' },
      { key: 'UF', label: 'UF (Estado de Destino)', type: 'string', group: 'Localização & Destino' },

      // 4. Tributos Tradicionais
      { key: 'vICMS', label: 'vICMS (ICMS Destacado R$)', type: 'number', group: 'Tributos Tradicionais', aggregatable: true },
      { key: 'vPIS', label: 'vPIS (PIS R$)', type: 'number', group: 'Tributos Tradicionais', aggregatable: true },
      { key: 'vCOFINS', label: 'vCOFINS (COFINS R$)', type: 'number', group: 'Tributos Tradicionais', aggregatable: true },
      { key: 'vIPI', label: 'vIPI (IPI R$)', type: 'number', group: 'Tributos Tradicionais', aggregatable: true },
      { key: 'vNF', label: 'vNF (Valor Total da Nota R$)', type: 'number', group: 'Valores Comerciais', aggregatable: true },

      // 5. Participantes da Operação
      { key: 'fornecedor_cnpj', label: 'CNPJ Emitente / Fornecedor', type: 'string', group: 'Participantes' },
      { key: 'fornecedor_razao', label: 'Razão Social Emitente', type: 'string', group: 'Participantes' },
      { key: 'fornecedor_uf', label: 'UF Emitente', type: 'string', group: 'Participantes' },
      { key: 'fornecedor_municipio', label: 'Município Emitente', type: 'string', group: 'Participantes' },
      { key: 'cliente_cnpj', label: 'CNPJ Destinatário / Cliente', type: 'string', group: 'Participantes' },
      { key: 'cliente_razao', label: 'Razão Social Destinatário', type: 'string', group: 'Participantes' },
      { key: 'cliente_uf', label: 'UF Destinatário', type: 'string', group: 'Participantes' },

      // 6. Dados do Documento Fiscal
      { key: 'chNFe', label: 'chNFe (Chave de Acesso)', type: 'string', group: 'Documento' },
      { key: 'dhEmi', label: 'dhEmi (Data de Emissão)', type: 'date', group: 'Documento' },
      { key: 'tipo_doc', label: 'Tipo Doc (NF-e/CT-e/NFS-e)', type: 'badge', group: 'Documento' },
      { key: 'tipo_operacao', label: 'Operação (Entrada/Saída)', type: 'badge', group: 'Documento' },
      { key: 'numero_serie', label: 'Número / Série', type: 'string', group: 'Documento' },
      { key: 'competencia', label: 'Competência (AAAA-MM)', type: 'string', group: 'Documento' },
      { key: 'situacao_doc', label: 'Situação Documento', type: 'badge', group: 'Documento' },

      // 7. Compatibilidade Legada
      { key: 'cclasstrib', label: 'cclasstrib (legado)', type: 'string', group: 'Compatibilidade' },
      { key: 'natureza_operacao', label: 'natureza_operacao (legado)', type: 'string', group: 'Compatibilidade' },
      { key: 'base_ibs', label: 'base_ibs (legado)', type: 'number', group: 'Compatibilidade', aggregatable: true },
      { key: 'valor_ibs', label: 'valor_ibs (legado)', type: 'number', group: 'Compatibilidade', aggregatable: true },
      { key: 'base_cbs', label: 'base_cbs (legado)', type: 'number', group: 'Compatibilidade', aggregatable: true },
      { key: 'valor_cbs', label: 'valor_cbs (legado)', type: 'number', group: 'Compatibilidade', aggregatable: true }
    ]
  },
  {
    id: 'dfe_documentos',
    nome: 'Documentos Fiscais (Cabeçalho Consolidado)',
    descricao: 'Consolidação de valores, impostos e participantes por Documento Fiscal Eletrônico.',
    campos: [
      { key: 'id', label: 'ID Documento', type: 'string', group: 'Identificação' },
      { key: 'chave_acesso', label: 'Chave de Acesso', type: 'string', group: 'Documento' },
      { key: 'tipo_doc', label: 'Tipo Doc', type: 'badge', group: 'Documento' },
      { key: 'tipo_operacao', label: 'Operação (Entrada/Saída)', type: 'badge', group: 'Documento' },
      { key: 'numero_serie', label: 'Número / Série', type: 'string', group: 'Documento' },
      { key: 'data_emissao', label: 'Data de Emissão', type: 'date', group: 'Documento' },
      { key: 'competencia', label: 'Competência', type: 'string', group: 'Documento' },
      { key: 'valor_total', label: 'Valor Total (R$)', type: 'number', group: 'Valores Totais', aggregatable: true },
      { key: 'base_ibs', label: 'Base Total IBS (R$)', type: 'number', group: 'Tributação RTC', aggregatable: true },
      { key: 'valor_ibs', label: 'Valor Total IBS (R$)', type: 'number', group: 'Tributação RTC', aggregatable: true },
      { key: 'base_cbs', label: 'Base Total CBS (R$)', type: 'number', group: 'Tributação RTC', aggregatable: true },
      { key: 'valor_cbs', label: 'Valor Total CBS (R$)', type: 'number', group: 'Tributação RTC', aggregatable: true },
      { key: 'valor_icms', label: 'ICMS (R$)', type: 'number', group: 'Tributos Tradicionais', aggregatable: true },
      { key: 'valor_ipi', label: 'IPI (R$)', type: 'number', group: 'Tributos Tradicionais', aggregatable: true },
      { key: 'valor_pis', label: 'PIS (R$)', type: 'number', group: 'Tributos Tradicionais', aggregatable: true },
      { key: 'valor_cofins', label: 'COFINS (R$)', type: 'number', group: 'Tributos Tradicionais', aggregatable: true },
      { key: 'valor_iss', label: 'ISS (R$)', type: 'number', group: 'Retenções', aggregatable: true },
      { key: 'valor_irrf', label: 'IRRF (R$)', type: 'number', group: 'Retenções', aggregatable: true },
      { key: 'fornecedor_cnpj', label: 'CNPJ Emitente', type: 'string', group: 'Emitente / Fornecedor' },
      { key: 'fornecedor_razao', label: 'Razão Social Emitente', type: 'string', group: 'Emitente / Fornecedor' },
      { key: 'fornecedor_uf', label: 'UF Emitente', type: 'string', group: 'Emitente / Fornecedor' },
      { key: 'cliente_cnpj', label: 'CNPJ Destinatário', type: 'string', group: 'Destinatário / Cliente' },
      { key: 'cliente_razao', label: 'Razão Social Destinatário', type: 'string', group: 'Destinatário / Cliente' },
      { key: 'cliente_uf', label: 'UF Destinatário', type: 'string', group: 'Destinatário / Cliente' },
      { key: 'situacao_doc', label: 'Situação SEFAZ', type: 'badge', group: 'Documento' }
    ]
  },
  {
    id: 'eventos_transmitidos',
    nome: 'Central de Eventos Fiscais & Manifestações',
    descricao: 'Histórico de eventos transmitidos para a SEFAZ (ciência da emissão, confirmação, cancelamento).',
    campos: [
      { key: 'id', label: 'ID Evento', type: 'string', group: 'Identificação' },
      { key: 'chave_acesso', label: 'Chave de Acesso', type: 'string', group: 'Documento' },
      { key: 'tipo_dfe', label: 'Tipo DF-e', type: 'badge', group: 'Evento' },
      { key: 'codigo_evento', label: 'Código do Evento', type: 'string', group: 'Evento' },
      { key: 'nome_evento', label: 'Nome do Evento', type: 'string', group: 'Evento' },
      { key: 'categoria', label: 'Categoria', type: 'badge', group: 'Evento' },
      { key: 'status', label: 'Status', type: 'badge', group: 'Evento' },
      { key: 'protocolo_sefaz', label: 'Protocolo SEFAZ', type: 'string', group: 'SEFAZ' },
      { key: 'codigo_retorno', label: 'Cód Retorno SEFAZ', type: 'string', group: 'SEFAZ' },
      { key: 'motivo_retorno', label: 'Motivo Retorno', type: 'string', group: 'SEFAZ' },
      { key: 'data_hora', label: 'Data e Hora', type: 'date', group: 'Data/Hora' }
    ]
  },
  {
    id: 'apuracao_extrato_cc',
    nome: 'Apuração Assistida (Conta Corrente Fiscal RTC)',
    descricao: 'Lançamentos detalhados do Conta Corrente Fiscal CGIBS/RTC (débitos, créditos e saldos de apuração).',
    campos: [
      { key: 'id', label: 'ID Lançamento', type: 'string', group: 'Identificação' },
      { key: 'operacao_id', label: 'ID Operação', type: 'string', group: 'Identificação' },
      { key: 'chave_acesso', label: 'Chave da Operação (DF-e)', type: 'string', group: 'Operação' },
      { key: 'tipo_operacao', label: 'Tipo de Operação', type: 'badge', group: 'Operação' },
      { key: 'mov', label: 'Movimentação / Evento', type: 'badge', group: 'Operação' },
      { key: 'dth_lancto', label: 'Data/Hora do Lançamento', type: 'date', group: 'Data/Hora' },
      { key: 'dth_emissao', label: 'Data de Emissão', type: 'date', group: 'Data/Hora' },
      { key: 'cnpj_fornecedor', label: 'CNPJ Fornecedor', type: 'string', group: 'Participantes' },
      { key: 'cnpj_adquirente', label: 'CNPJ Adquirente', type: 'string', group: 'Participantes' },
      { key: 'debito_em_aberto', label: 'Débito em Aberto (R$)', type: 'number', group: 'Valores CGIBS', aggregatable: true },
      { key: 'debito_extinto', label: 'Débito Extinto (R$)', type: 'number', group: 'Valores CGIBS', aggregatable: true },
      { key: 'credito_a_propriar', label: 'Crédito a Propriar (R$)', type: 'number', group: 'Valores CGIBS', aggregatable: true },
      { key: 'credito_nao_utilizado', label: 'Crédito Não Utilizado (R$)', type: 'number', group: 'Valores CGIBS', aggregatable: true },
      { key: 'credito_utilizado', label: 'Crédito Utilizado (R$)', type: 'number', group: 'Valores CGIBS', aggregatable: true },
      { key: 'recurso_financeiro_disponivel_para_transferencia', label: 'Recurso Disponível p/ Transf. (R$)', type: 'number', group: 'Valores CGIBS', aggregatable: true },
      { key: 'recurso_financeiro_a_transferir', label: 'Recurso a Transferir (R$)', type: 'number', group: 'Valores CGIBS', aggregatable: true },
      { key: 'arquivo_origem', label: 'Arquivo de Origem', type: 'string', group: 'Metadados' }
    ]
  }
];

// ============================================================
// MODELOS PADRÃO DE FÁBRICA (sem Hierarquia RTC removida)
// ============================================================
const DEFAULT_COCKPIT_MODELS: CockpitModelo[] = [
  {
    id: 'padrao-fornecedor-uf',
    nome: 'Ranking de Compras por Fornecedor & UF',
    descricao: 'Visão consolidada de valores totais de compras agrupadas por parceiro comercial e estado de origem.',
    categoria: 'gerencial',
    escopo: 'global',
    usuario_id: 'sistema',
    is_padrao_sistema: 1,
    podeEditar: false,
    configuracao: {
      fonte_dados: 'dfe_documentos',
      modo: 'agrupado',
      dimensoes: ['fornecedor_razao', 'fornecedor_uf', 'tipo_operacao'],
      metricas: [
        { campo: 'valor_total', agregacao: 'sum', apelido: 'Total Compras', exibicao: 'valor' },
        { campo: 'valor_icms', agregacao: 'sum', apelido: 'ICMS Destacado', exibicao: 'valor' },
        { campo: 'valor_ibs', agregacao: 'sum', apelido: 'IBS Total', exibicao: 'valor' },
        { campo: 'valor_cbs', agregacao: 'sum', apelido: 'CBS Total', exibicao: 'valor' },
        { campo: 'id', agregacao: 'count', apelido: 'Total de Notas', exibicao: 'valor' }
      ],
      ordenacao: [{ campo: 'valor_total', direcao: 'desc' }],
      limite: 0,
      periodo: { ano: '2026', mes: 'todos' }
    }
  },
  {
    id: 'padrao-manifestacao-status',
    nome: 'Histórico de Manifestação & Eventos SEFAZ',
    descricao: 'Auditoria de confirmação de operação, ciência da emissão e eventos transmitidos por status.',
    categoria: 'compliance',
    escopo: 'global',
    usuario_id: 'sistema',
    is_padrao_sistema: 1,
    podeEditar: false,
    configuracao: {
      fonte_dados: 'eventos_transmitidos',
      modo: 'agrupado',
      dimensoes: ['tipo_dfe', 'nome_evento', 'status'],
      metricas: [
        { campo: 'id', agregacao: 'count', apelido: 'Qtd Eventos', exibicao: 'valor' }
      ],
      ordenacao: [{ campo: 'id', direcao: 'desc' }],
      limite: 0,
      periodo: { ano: '2026', mes: 'todos' }
    }
  },
  {
    id: 'padrao-cc-cgibs',
    nome: 'Extrato de Débitos e Créditos Conta Corrente RTC',
    descricao: 'Consolidação de débitos extintos e créditos a apropriar no Ledger CGIBS.',
    categoria: 'rtc',
    escopo: 'global',
    usuario_id: 'sistema',
    is_padrao_sistema: 1,
    podeEditar: false,
    configuracao: {
      fonte_dados: 'apuracao_extrato_cc',
      modo: 'agrupado',
      dimensoes: ['tipo_operacao', 'mov'],
      metricas: [
        { campo: 'debito_em_aberto', agregacao: 'sum', apelido: 'Débito em Aberto', exibicao: 'valor' },
        { campo: 'debito_extinto', agregacao: 'sum', apelido: 'Débito Extinto', exibicao: 'valor' },
        { campo: 'credito_a_propriar', agregacao: 'sum', apelido: 'Crédito a Propriar', exibicao: 'valor' },
        { campo: 'credito_utilizado', agregacao: 'sum', apelido: 'Crédito Utilizado', exibicao: 'valor' },
        { campo: 'id', agregacao: 'count', apelido: 'Qtd Lançamentos', exibicao: 'valor' }
      ],
      ordenacao: [{ campo: 'debito_extinto', direcao: 'desc' }],
      limite: 0,
      periodo: { ano: '2026', mes: 'todos' }
    }
  }
];

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export const CockpitRelatoriosPanel: React.FC = () => {
  const { user, empresaAtiva } = useAuth();
  const { get, post, put, del } = useApi();

  // --- Metadados ---
  const [fontes, setFontes] = useState<CockpitDataSource[]>(DEFAULT_COCKPIT_DATA_SOURCES);
  const [modelos, setModelos] = useState<CockpitModelo[]>(DEFAULT_COCKPIT_MODELS);
  const [modeloAtivo, setModeloAtivo] = useState<CockpitModelo | null>(DEFAULT_COCKPIT_MODELS[0]);
  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(false);

  // --- Período por Date Range ---
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState<string>(`${hoje.getFullYear()}-01-01`);
  const [dataFim, setDataFim] = useState<string>(hoje.toISOString().slice(0, 10));

  // --- Construção da Consulta ---
  const [fonteSelecionada, setFonteSelecionada] = useState<string>('dfe_documentos');
  const [modo, setModo] = useState<'detalhado' | 'agrupado'>('agrupado');
  const [dimensoes, setDimensoes] = useState<string[]>(['fornecedor_razao', 'fornecedor_uf', 'tipo_operacao']);
  const [colunasPivot, setColunasPivot] = useState<string[]>([]);
  const [metricas, setMetricas] = useState<CockpitMetrica[]>([
    { campo: 'valor_total', agregacao: 'sum', apelido: 'Total Compras', exibicao: 'valor' },
    { campo: 'valor_icms', agregacao: 'sum', apelido: 'ICMS Destacado', exibicao: 'valor' },
    { campo: 'valor_ibs', agregacao: 'sum', apelido: 'IBS Total', exibicao: 'valor' },
    { campo: 'valor_cbs', agregacao: 'sum', apelido: 'CBS Total', exibicao: 'valor' },
    { campo: 'id', agregacao: 'count', apelido: 'Total de Notas', exibicao: 'valor' }
  ]);
  const [filtros, setFiltros] = useState<CockpitFiltro[]>([]);
  const [ordenacao, setOrdenacao] = useState<CockpitOrdenacao[]>([
    { campo: 'valor_total', direcao: 'desc' }
  ]);
  const [limite, setLimite] = useState<number>(0);
  const [buscaCampo, setBuscaCampo] = useState<string>('');

  // --- Execução & Resultados ---
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

  // --- Paginação & Busca Local ---
  const [termoBusca, setTermoBusca] = useState<string>('');
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const [itensPorPagina, setItensPorPagina] = useState<number>(25);

  // --- UI: Config colapsável ---
  const [isConfigAberta, setIsConfigAberta] = useState<boolean>(true);

  // --- Modais ---
  const [isSalvarModalOpen, setIsSalvarModalOpen] = useState<boolean>(false);
  const [isGerenciarModelosOpen, setIsGerenciarModelosOpen] = useState<boolean>(false);
  const [filtroEscopoModelos, setFiltroEscopoModelos] = useState<'todos' | 'global' | 'empresa' | 'pessoal'>('todos');

  // --- Form de Modelo (Create/Edit) ---
  const [editandoModeloId, setEditandoModeloId] = useState<string | null>(null);
  const [nomeNovoModelo, setNomeNovoModelo] = useState<string>('');
  const [descNovoModelo, setDescNovoModelo] = useState<string>('');
  const [categoriaNovoModelo, setCategoriaNovoModelo] = useState<string>('fiscal');
  const [escopoNovoModelo, setEscopoNovoModelo] = useState<CockpitScope>('pessoal');
  const [isSalvandoModelo, setIsSalvandoModelo] = useState<boolean>(false);

  const isAdminMaster = user?.perfil === 'admin_master';

  // ============================================================
  // VALORES DERIVADOS
  // ============================================================
  const fonteAtivaObj = useMemo(() => {
    return fontes.find(f => f.id === fonteSelecionada) || fontes[0] || null;
  }, [fontes, fonteSelecionada]);

  // Converter date range para formato { ano, mes } do backend
  const periodoDerivado = useMemo(() => {
    if (!dataInicio) return { ano: String(hoje.getFullYear()), mes: 'todos' };

    const inicio = new Date(dataInicio + 'T00:00:00');
    const fim = dataFim ? new Date(dataFim + 'T00:00:00') : inicio;

    const anoI = inicio.getFullYear();
    const anoF = fim.getFullYear();
    const mesI = inicio.getMonth() + 1;
    const mesF = fim.getMonth() + 1;

    if (anoI !== anoF) return { ano: 'todos', mes: 'todos' };
    if (mesI === mesF) return { ano: String(anoI), mes: String(mesI).padStart(2, '0') };
    return { ano: String(anoI), mes: 'todos' };
  }, [dataInicio, dataFim]);

  // Label legível do período
  const periodoLabel = useMemo(() => {
    const fmt = (d: string) => {
      if (!d) return '';
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}`;
    };
    return `${fmt(dataInicio)} a ${fmt(dataFim)}`;
  }, [dataInicio, dataFim]);

  // ============================================================
  // CALLBACKS: CARREGAR DADOS DO BACKEND
  // ============================================================
  const carregarMetadados = useCallback(async () => {
    setIsLoadingMeta(true);
    try {
      const [resFontes, resModelos] = await Promise.all([
        get('/cockpit/fontes-dados'),
        get('/cockpit/modelos')
      ]);

      if (resFontes.ok && resFontes.data?.fontes && resFontes.data.fontes.length > 0) {
        setFontes(resFontes.data.fontes);
      }

      if (resModelos.ok && resModelos.data?.modelos && resModelos.data.modelos.length > 0) {
        setModelos(prev => {
          const serverMods = resModelos.data.modelos;
          const serverIds = new Set(serverMods.map((m: any) => m.id));
          const uniqueDefaults = prev.filter(m => !serverIds.has(m.id));
          return [...serverMods, ...uniqueDefaults];
        });
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

  // ============================================================
  // CALLBACKS: EXECUTAR CONSULTA
  // ============================================================
  const executarConsulta = useCallback(async () => {
    if (!empresaAtiva?.id) {
      setExecErro('Por favor, selecione uma empresa ativa para consultar os dados com isolamento multi-tenant.');
      return;
    }

    setIsExecutando(true);
    setExecErro(null);

    try {
      const payload = {
        empresa_id: empresaAtiva.id,
        fonte_dados: fonteSelecionada,
        modo,
        dimensoes,
        metricas: modo === 'agrupado' ? metricas : [],
        filtros,
        ordenacao,
        limite,
        periodo: periodoDerivado
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
  }, [empresaAtiva?.id, fonteSelecionada, modo, dimensoes, metricas, filtros, ordenacao, limite, periodoDerivado, post]);

  // Auto-executar ao inicializar
  useEffect(() => {
    if (empresaAtiva?.id && fontes.length > 0 && !resultado && !isExecutando) {
      executarConsulta();
    }
  }, [empresaAtiva?.id, fontes.length]);

  // ============================================================
  // CALLBACKS: MODELO (APLICAR / SALVAR / EDITAR / EXCLUIR)
  // ============================================================
  const aplicarModelo = (mod: CockpitModelo) => {
    setModeloAtivo(mod);
    const cfg = mod.configuracao;

    if (cfg.fonte_dados) setFonteSelecionada(cfg.fonte_dados);
    if (cfg.modo) setModo(cfg.modo);
    if (cfg.dimensoes) setDimensoes(cfg.dimensoes);
    if (cfg.metricas) setMetricas(cfg.metricas);
    if (cfg.filtros) setFiltros(cfg.filtros);
    if (cfg.ordenacao) setOrdenacao(cfg.ordenacao);
    setLimite(cfg.limite !== undefined ? cfg.limite : 0);

    // Converter periodo do modelo para date range
    if (cfg.periodo) {
      const ano = cfg.periodo.ano || String(new Date().getFullYear());
      const mes = cfg.periodo.mes || 'todos';

      if (ano === 'todos') {
        setDataInicio('2022-01-01');
        setDataFim(new Date().toISOString().slice(0, 10));
      } else if (mes === 'todos') {
        setDataInicio(`${ano}-01-01`);
        setDataFim(`${ano}-12-31`);
      } else {
        const lastDay = new Date(Number(ano), Number(mes), 0).getDate();
        setDataInicio(`${ano}-${mes}-01`);
        setDataFim(`${ano}-${mes}-${String(lastDay).padStart(2, '0')}`);
      }
    }

    setIsGerenciarModelosOpen(false);
    setSucessoFeedback(`Modelo '${mod.nome}' carregado com sucesso!`);
    setTimeout(() => setSucessoFeedback(null), 4000);
  };

  const handleAbrirSalvarNovo = () => {
    setEditandoModeloId(null);
    setNomeNovoModelo('');
    setDescNovoModelo('');
    setCategoriaNovoModelo('fiscal');
    setEscopoNovoModelo('pessoal');
    setIsSalvarModalOpen(true);
  };

  const handleIniciarEdicao = (mod: CockpitModelo) => {
    setEditandoModeloId(mod.id);
    setNomeNovoModelo(mod.nome);
    setDescNovoModelo(mod.descricao || '');
    setCategoriaNovoModelo(mod.categoria || 'fiscal');
    setEscopoNovoModelo((mod.escopo || 'pessoal') as CockpitScope);
    setIsGerenciarModelosOpen(false);
    setIsSalvarModalOpen(true);
  };

  const handleSalvarModelo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeNovoModelo.trim()) return;

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
          limite,
          periodo: periodoDerivado
        }
      };

      const res = editandoModeloId
        ? await put(`/cockpit/modelos/${editandoModeloId}`, payload)
        : await post('/cockpit/modelos', payload);

      if (res.ok) {
        setIsSalvarModalOpen(false);
        setNomeNovoModelo('');
        setDescNovoModelo('');
        setEditandoModeloId(null);
        setSucessoFeedback(
          editandoModeloId
            ? `Modelo atualizado com sucesso!`
            : `Modelo salvo com sucesso no escopo ${escopoNovoModelo.toUpperCase()}`
        );
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

  // ============================================================
  // CALLBACKS: EXPORTAR
  // ============================================================
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
        limite: 0,
        periodo: periodoDerivado
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

  // ============================================================
  // CALLBACKS: MANIPULAÇÃO DE DIMENSÕES, MÉTRICAS, FILTROS
  // ============================================================
  const toggleDimensao = (campoKey: string) => {
    setDimensoes(prev => {
      if (prev.includes(campoKey)) {
        return prev.filter(k => k !== campoKey);
      } else {
        return [...prev, campoKey];
      }
    });
  };

  const reordenarDimensao = (index: number, direcao: 'up' | 'down') => {
    setDimensoes(prev => {
      const copy = [...prev];
      const targetIndex = direcao === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // TOGGLE de Métrica (V) — corrige duplicação
  const toggleMetrica = (campoKey: string) => {
    setMetricas(prev => {
      const hasExisting = prev.some(m => m.campo === campoKey);
      if (hasExisting) {
        return prev.filter(m => m.campo !== campoKey);
      }
      const campoObj = fonteAtivaObj?.campos.find(c => c.key === campoKey);
      return [...prev, {
        campo: campoKey,
        agregacao: 'sum' as CockpitAggregationType,
        apelido: campoObj?.label || campoKey,
        exibicao: 'valor' as const
      }];
    });
  };

  const duplicarMetricaComoPercentual = (index: number) => {
    const baseMet = metricas[index];
    if (!baseMet) return;
    setMetricas(prev => [
      ...prev,
      {
        campo: baseMet.campo,
        agregacao: baseMet.agregacao,
        apelido: `% Total (${baseMet.apelido || baseMet.campo})`,
        exibicao: 'percent_total'
      }
    ]);
  };

  const removerMetrica = (index: number) => {
    setMetricas(prev => prev.filter((_, idx) => idx !== index));
  };

  const atualizarMetrica = (index: number, patch: Partial<CockpitMetrica>) => {
    setMetricas(prev => prev.map((m, idx) => idx === index ? { ...m, ...patch } : m));
  };

  // TOGGLE de Filtro (F) — corrige duplicação
  const toggleFiltro = (campoKey: string) => {
    setFiltros(prev => {
      const hasExisting = prev.some(f => f.campo === campoKey);
      if (hasExisting) {
        return prev.filter(f => f.campo !== campoKey);
      }
      return [...prev, { campo: campoKey, operador: 'contains' as CockpitFilterOperator, valor: '' }];
    });
  };

  const adicionarFiltro = () => {
    const primeiroCampo = fonteAtivaObj?.campos[0]?.key || 'ncm';
    setFiltros(prev => [
      ...prev,
      { campo: primeiroCampo, operador: 'contains' as CockpitFilterOperator, valor: '' }
    ]);
  };

  const removerFiltro = (index: number) => {
    setFiltros(prev => prev.filter((_, idx) => idx !== index));
  };

  const atualizarFiltro = (index: number, patch: Partial<CockpitFiltro>) => {
    setFiltros(prev => prev.map((f, idx) => idx === index ? { ...f, ...patch } : f));
  };

  // ============================================================
  // DADOS DERIVADOS: FILTRO LOCAL, PAGINAÇÃO, FORMATAÇÃO
  // ============================================================
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

  const totalPaginas = Math.ceil(linhasFiltradas.length / itensPorPagina) || 1;
  const linhasPaginadas = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return linhasFiltradas.slice(inicio, inicio + itensPorPagina);
  }, [linhasFiltradas, paginaAtual, itensPorPagina]);

  const formatarValor = (valor: any, tipo?: string, labelOuChave?: string) => {
    if (valor === null || valor === undefined || valor === '') return '-';
    if (String(valor).includes('(Não informado') || String(valor).includes('Sem RTC')) {
      return String(valor);
    }
    const isPercent = labelOuChave?.includes('%') || labelOuChave?.toLowerCase().includes('percent');
    if (tipo === 'number' || typeof valor === 'number') {
      const num = Number(valor);
      if (isNaN(num)) return valor;
      if (isPercent) {
        return `${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
      }
      if (Number.isInteger(num) && num < 1000 && !labelOuChave?.toLowerCase().includes('valor') && !labelOuChave?.toLowerCase().includes('base')) {
        return num.toString();
      }
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return String(valor);
  };

  const modelosFiltrados = useMemo(() => {
    if (filtroEscopoModelos === 'todos') return modelos;
    return modelos.filter(m => m.escopo === filtroEscopoModelos);
  }, [modelos, filtroEscopoModelos]);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      {/* ========================================================== */}
      {/* FAIXA 1: TOOLBAR COMPACTA HORIZONTAL                       */}
      {/* ========================================================== */}
      <div className="glass-panel-glow p-3 rounded-xl border border-slate-800 relative overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Título */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-400">
              <Layers className="w-4 h-4" />
            </div>
            <h1 className="text-sm font-bold text-white tracking-tight">
              Relatórios Dinâmicos
            </h1>
          </div>

          <div className="h-5 w-px bg-slate-700 shrink-0 hidden sm:block" />

          {/* Date Range */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <label className="text-[11px] text-slate-400">De</label>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className="bg-slate-900/90 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-cyan-500 font-mono w-[120px]"
            />
            <label className="text-[11px] text-slate-400">Até</label>
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              className="bg-slate-900/90 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-cyan-500 font-mono w-[120px]"
            />
          </div>

          <div className="h-5 w-px bg-slate-700 shrink-0 hidden lg:block" />

          {/* Fonte de Dados */}
          <select
            value={fonteSelecionada}
            onChange={e => {
              setFonteSelecionada(e.target.value);
              if (e.target.value === 'dfe_documentos') {
                setDimensoes(['fornecedor_uf', 'cliente_uf', 'tipo_operacao']);
              } else if (e.target.value === 'eventos_transmitidos') {
                setDimensoes(['tipo_dfe', 'nome_evento', 'status']);
              } else if (e.target.value === 'apuracao_extrato_cc') {
                setDimensoes(['tipo_operacao', 'mov']);
              } else {
                setDimensoes(['cClassTrib', 'CFOP', 'UF']);
              }
            }}
            className="bg-slate-900/90 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-cyan-500 max-w-[220px]"
            title="Fonte de Dados"
          >
            {fontes.map(f => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>

          {/* Modo */}
          <div className="flex items-center rounded-lg border border-slate-700 overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setModo('agrupado')}
              className={`px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors ${
                modo === 'agrupado'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white'
              }`}
            >
              Pivot
            </button>
            <button
              type="button"
              onClick={() => setModo('detalhado')}
              className={`px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors ${
                modo === 'detalhado'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white'
              }`}
            >
              Analítico
            </button>
          </div>

          <div className="flex-1 min-w-0" />

          {/* Ações */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            <button
              onClick={() => setIsGerenciarModelosOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all cursor-pointer"
              title="Gerenciar Modelos"
            >
              <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span className="max-w-[140px] truncate">{modeloAtivo ? modeloAtivo.nome : 'Modelos'}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            <button
              onClick={handleAbrirSalvarNovo}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800/90 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 hover:border-indigo-400 transition-all cursor-pointer"
              title="Salvar Modelo"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salvar</span>
            </button>

            <button
              onClick={() => handleExportar('xlsx')}
              disabled={isExecutando || !resultado || resultado.rows.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exportar Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>.XLSX</span>
            </button>

            <button
              onClick={() => handleExportar('json')}
              disabled={isExecutando || !resultado || resultado.rows.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exportar JSON"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>.JSON</span>
            </button>

            <button
              onClick={() => executarConsulta()}
              disabled={isExecutando}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-lg text-[11px] font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-600/20 border border-cyan-400/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isExecutando ? 'animate-spin' : ''}`} />
              <span>{isExecutando ? 'Executando...' : 'Executar'}</span>
            </button>
          </div>
        </div>

        {/* Feedback */}
        {sucessoFeedback && (
          <div className="mt-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-[11px] text-emerald-300 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{sucessoFeedback}</span>
          </div>
        )}
        {execErro && (
          <div className="mt-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-[11px] text-rose-300 animate-in fade-in">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{execErro}</span>
          </div>
        )}
      </div>

      {/* ========================================================== */}
      {/* FAIXA 2: CONFIGURAÇÃO COLAPSÁVEL (4 QUADRANTES HORIZONTAIS)*/}
      {/* ========================================================== */}
      <div className="glass-panel-glow rounded-xl border border-slate-800 overflow-hidden">
        {/* Toggle de Colapso */}
        <button
          type="button"
          onClick={() => setIsConfigAberta(!isConfigAberta)}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/50 hover:bg-slate-800/60 transition-colors cursor-pointer border-b border-slate-800/60"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Configuração da Consulta
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {dimensoes.length} linhas · {metricas.length} valores · {filtros.length} filtros
            </span>
          </div>
          {isConfigAberta ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {isConfigAberta && (
          <div className="p-3 space-y-3">
            {/* Barra de Pesquisa de Tags XML (full width) */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={buscaCampo}
                onChange={e => setBuscaCampo(e.target.value)}
                placeholder="Pesquisar tag XML (cClassTrib, vBC, pIBS, vProd, CFOP, NCM...)"
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg pl-8 pr-7 py-1.5 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
              {buscaCampo && (
                <button
                  onClick={() => setBuscaCampo('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Tag Picker com botões L V F (toggle) */}
            <div className="max-h-28 overflow-y-auto p-2 bg-slate-900/70 border border-slate-800 rounded-lg">
              <div className="flex flex-wrap gap-1">
                {fonteAtivaObj?.campos
                  .filter(c => !buscaCampo.trim() || c.label.toLowerCase().includes(buscaCampo.toLowerCase()) || c.key.toLowerCase().includes(buscaCampo.toLowerCase()))
                  .map(campo => {
                    const isLinha = dimensoes.includes(campo.key);
                    const isMetrica = metricas.some(m => m.campo === campo.key);
                    const isFiltro = filtros.some(f => f.campo === campo.key);
                    const isNum = campo.aggregatable || campo.type === 'number';

                    return (
                      <div
                        key={campo.key}
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-mono transition-all flex items-center gap-0.5 ${
                          isLinha
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : isMetrica
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : isFiltro
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:border-slate-600'
                        }`}
                      >
                        <span className="truncate max-w-[120px]" title={`${campo.label} (${campo.key})`}>
                          {campo.key}
                        </span>

                        <div className="flex items-center gap-px border-l border-slate-700/60 pl-0.5 ml-0.5">
                          <button
                            type="button"
                            onClick={() => toggleDimensao(campo.key)}
                            title={isLinha ? 'Remover das Linhas' : 'Adicionar às Linhas'}
                            className={`px-0.5 rounded hover:bg-white/10 cursor-pointer ${isLinha ? 'text-amber-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                            L
                          </button>
                          {isNum && modo === 'agrupado' && (
                            <button
                              type="button"
                              onClick={() => toggleMetrica(campo.key)}
                              title={isMetrica ? 'Remover dos Valores' : 'Adicionar aos Valores'}
                              className={`px-0.5 rounded hover:bg-white/10 cursor-pointer ${isMetrica ? 'text-emerald-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                              V
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleFiltro(campo.key)}
                            title={isFiltro ? 'Remover dos Filtros' : 'Adicionar aos Filtros'}
                            className={`px-0.5 rounded hover:bg-white/10 cursor-pointer ${isFiltro ? 'text-cyan-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                            F
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* 4 QUADRANTES (Agora forçando layout horizontal com rolagem em telas pequenas) */}
            <div className="flex xl:grid xl:grid-cols-4 gap-2.5 overflow-x-auto pb-1 snap-x">
              {/* Q1: LINHAS */}
              <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5 min-w-[240px] xl:min-w-0 flex-1 snap-start">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300">
                    <Layers className="w-3 h-3 text-amber-400" />
                    <span>Linhas ({dimensoes.length})</span>
                  </div>
                  <span className="text-[9px] text-slate-500">Esq. → Dir.</span>
                </div>
                {dimensoes.length === 0 ? (
                  <p className="text-[9px] text-slate-500 italic py-1">Use "L" nos campos acima.</p>
                ) : (
                  <div className="space-y-0.5 max-h-36 overflow-y-auto pr-0.5 custom-scrollbar">
                    {dimensoes.map((dimKey, idx) => {
                      const cObj = fonteAtivaObj?.campos.find(c => c.key === dimKey);
                      return (
                        <div
                          key={dimKey}
                          className="p-1 rounded bg-slate-800/80 border border-amber-500/20 flex items-center justify-between text-[10px]"
                        >
                          <div className="flex items-center gap-1 truncate min-w-0">
                            <span className="w-3.5 h-3.5 rounded-full bg-amber-500/20 text-amber-300 text-[8px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-mono font-semibold text-white truncate" title={cObj?.label || dimKey}>
                              {dimKey}
                            </span>
                          </div>
                          <div className="flex items-center gap-px shrink-0">
                            <button type="button" disabled={idx === 0} onClick={() => reordenarDimensao(idx, 'up')} className="p-0.5 text-slate-400 hover:text-amber-300 disabled:opacity-30 cursor-pointer shrink-0">
                              <ArrowUp className="w-2.5 h-2.5" />
                            </button>
                            <button type="button" disabled={idx === dimensoes.length - 1} onClick={() => reordenarDimensao(idx, 'down')} className="p-0.5 text-slate-400 hover:text-amber-300 disabled:opacity-30 cursor-pointer shrink-0">
                              <ArrowDown className="w-2.5 h-2.5" />
                            </button>
                            <button type="button" onClick={() => toggleDimensao(dimKey)} className="p-0.5 text-slate-400 hover:text-rose-400 cursor-pointer shrink-0">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Q2: VALORES (Métricas) */}
              <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5 min-w-[240px] xl:min-w-0 flex-1 snap-start">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-300">
                    <BarChart2 className="w-3 h-3 text-emerald-400" />
                    <span>Valores ({metricas.length})</span>
                  </div>
                  <span className="text-[9px] text-slate-500">Cálculos</span>
                </div>
                {metricas.length === 0 ? (
                  <p className="text-[9px] text-slate-500 italic py-1">Use "V" nos campos numéricos.</p>
                ) : (
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5 custom-scrollbar">
                    {metricas.map((met, idx) => (
                      <div key={idx} className="p-1.5 rounded bg-slate-800/80 border border-emerald-500/20 text-[10px] space-y-0.5">
                        <div className="flex items-center gap-1">
                          <select
                            value={met.agregacao}
                            onChange={e => atualizarMetrica(idx, { agregacao: e.target.value as CockpitAggregationType })}
                            className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[9px] text-emerald-300 font-mono focus:outline-none w-14"
                          >
                            <option value="sum">Soma</option>
                            <option value="count">Qtd</option>
                            <option value="avg">Média</option>
                            <option value="min">Mín</option>
                            <option value="max">Máx</option>
                          </select>

                          <span className="flex-1 font-mono font-semibold text-white truncate" title={met.apelido || met.campo}>
                            {met.campo}
                          </span>

                          <button
                            type="button"
                            onClick={() => atualizarMetrica(idx, { exibicao: met.exibicao === 'percent_total' ? 'valor' : 'percent_total' })}
                            className={`px-1 py-px rounded text-[8px] font-bold cursor-pointer transition-all ${
                              met.exibicao === 'percent_total'
                                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                                : 'bg-slate-700 text-slate-300 hover:text-white'
                            }`}
                            title={met.exibicao === 'percent_total' ? '% do Total' : 'Valor R$'}
                          >
                            {met.exibicao === 'percent_total' ? '%' : 'R$'}
                          </button>

                          {met.exibicao !== 'percent_total' && (
                            <button type="button" onClick={() => duplicarMetricaComoPercentual(idx)} className="text-slate-400 hover:text-cyan-300 p-0.5 cursor-pointer shrink-0" title="Duplicar como %">
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          )}

                          <button type="button" onClick={() => removerMetrica(idx)} className="text-slate-400 hover:text-rose-400 p-0.5 cursor-pointer shrink-0">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={met.apelido || ''}
                          onChange={e => atualizarMetrica(idx, { apelido: e.target.value })}
                          placeholder="Rótulo..."
                          className="w-full bg-slate-900 border border-slate-700/80 rounded px-1.5 py-px text-[9px] text-slate-200"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Q3: FILTROS */}
              <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5 min-w-[240px] xl:min-w-0 flex-1 snap-start">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-cyan-300">
                    <Filter className="w-3 h-3 text-cyan-400" />
                    <span>Filtros ({filtros.length})</span>
                  </div>
                  <button type="button" onClick={adicionarFiltro} className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer">
                    + Novo
                  </button>
                </div>
                {filtros.length === 0 ? (
                  <p className="text-[9px] text-slate-500 italic py-1">Sem filtros. Use "F" ou "+ Novo".</p>
                ) : (
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5 custom-scrollbar">
                    {filtros.map((fil, idx) => (
                      <div key={idx} className="p-1.5 rounded bg-slate-800/80 border border-cyan-500/20 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <select
                            value={fil.campo}
                            onChange={e => atualizarFiltro(idx, { campo: e.target.value })}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-white focus:outline-none min-w-0"
                          >
                            {fonteAtivaObj?.campos.map(c => (
                              <option key={c.key} value={c.key}>{c.key}</option>
                            ))}
                          </select>
                          <select
                            value={fil.operador}
                            onChange={e => atualizarFiltro(idx, { operador: e.target.value as CockpitFilterOperator })}
                            className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-cyan-300 font-mono focus:outline-none w-20"
                          >
                            <option value="contains">Contém</option>
                            <option value="eq">=</option>
                            <option value="neq">!=</option>
                            <option value="gt">&gt;</option>
                            <option value="gte">&gt;=</option>
                            <option value="lt">&lt;</option>
                            <option value="lte">&lt;=</option>
                            <option value="is_null">Vazio</option>
                            <option value="is_not_null">Preenchido</option>
                          </select>
                          <button type="button" onClick={() => removerFiltro(idx)} className="text-slate-400 hover:text-rose-400 p-0.5 cursor-pointer shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        {fil.operador !== 'is_null' && fil.operador !== 'is_not_null' && (
                          <input
                            type="text"
                            value={fil.valor ?? ''}
                            onChange={e => atualizarFiltro(idx, { valor: e.target.value })}
                            placeholder="Valor do filtro..."
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-200"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Q4: OPÇÕES ADICIONAIS (Limite & Ordenação) */}
              <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2 min-w-[180px] xl:min-w-0 flex-1 snap-start">
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-300 pb-1 border-b border-slate-800">
                  <Table className="w-3 h-3 text-slate-400" />
                  <span>Opções</span>
                </div>

                <div className="space-y-1.5">
                  <div>
                    <label className="text-[9px] font-semibold text-slate-400 block mb-0.5 uppercase tracking-wider">Limite</label>
                    <select
                      value={limite}
                      onChange={e => setLimite(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-slate-300 font-mono"
                    >
                      <option value={0}>Sem Limite</option>
                      <option value={25000}>25.000</option>
                      <option value={10000}>10.000</option>
                      <option value={5000}>5.000</option>
                      <option value={1000}>1.000</option>
                      <option value={500}>500</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-semibold text-slate-400 block mb-0.5 uppercase tracking-wider">Ordenação</label>
                    <select
                      value={ordenacao[0]?.direcao || 'desc'}
                      onChange={e => {
                        const dir = e.target.value as 'asc' | 'desc';
                        setOrdenacao(prev => [{ campo: prev[0]?.campo || dimensoes[0] || 'id', direcao: dir }]);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-slate-300 font-mono"
                    >
                      <option value="desc">Decrescente (Z-A)</option>
                      <option value="asc">Crescente (A-Z)</option>
                    </select>
                  </div>

                  <div className="text-[9px] text-slate-500 font-mono pt-1 border-t border-slate-800/60">
                    Empresa: {empresaAtiva?.razaoSocial || 'Não selecionada'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================== */}
      {/* FAIXA 3: RESULTADOS & TABELA DINÂMICA (FULL WIDTH)         */}
      {/* ========================================================== */}
      <div className="glass-panel-glow p-3 rounded-xl border border-slate-800 space-y-2.5">
        {/* Status Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] text-slate-300">
              <span className="font-bold text-white">
                {linhasFiltradas.length.toLocaleString('pt-BR')}
              </span>
              <span>registro(s)</span>
            </div>

            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
              📅 {periodoLabel}
            </span>

            {limite === 0 ? (
              <span className="text-[9px] font-bold uppercase text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                Sem Limite
              </span>
            ) : (
              <span className="text-[9px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60">
                Máx {limite.toLocaleString('pt-BR')}
              </span>
            )}

            {resultado && (
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {resultado.executionTimeMs} ms
              </span>
            )}
          </div>

          {/* Busca Rápida nos Resultados */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-2" />
            <input
              type="text"
              value={termoBusca}
              onChange={e => {
                setTermoBusca(e.target.value);
                setPaginaAtual(1);
              }}
              placeholder="Pesquisar nos resultados..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-1 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Tabela de Resultados */}
        <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-[600px] relative">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-md z-10 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="p-2 font-mono text-slate-500 w-10 text-center">#</th>
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
                      className="p-2 font-semibold text-slate-300 hover:text-white cursor-pointer select-none transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>{col.label}</span>
                        {isSorted && (
                          sortDir === 'asc'
                            ? <ArrowUp className="w-2.5 h-2.5 text-cyan-400" />
                            : <ArrowDown className="w-2.5 h-2.5 text-cyan-400" />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-sans">
              {linhasPaginadas.length === 0 ? (
                <tr>
                  <td colSpan={(resultado?.columns.length || 1) + 1} className="p-6 text-center text-slate-500">
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
                      <td className="p-2 font-mono text-slate-500 text-center text-[9px]">
                        {rowNum}
                      </td>
                      {resultado?.columns.map(col => {
                        const val = row[col.key];
                        const isNumeric = col.type === 'number';

                        return (
                          <td
                            key={col.key}
                            className={`p-2 text-slate-300 ${
                              isNumeric ? 'text-right font-mono font-medium' : ''
                            }`}
                          >
                            {col.key === 'cClassTrib' || col.key === 'cclasstrib' || col.key === 'indOper' ? (
                              val && val !== '(Não informado / Sem RTC)' ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  {val}
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-500 italic">
                                  {val || '-'}
                                </span>
                              )
                            ) : col.key === 'cst_csosn' || col.key === 'tipo_doc' ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                                {val || '-'}
                              </span>
                            ) : (col.label.includes('%') || col.key.includes('%')) && typeof val === 'number' ? (
                              <div className="flex items-center justify-end gap-1">
                                <div className="w-10 h-1.5 bg-slate-800 rounded-full overflow-hidden shrink-0">
                                  <div
                                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                                    style={{ width: `${Math.min(Math.max(val, 0), 100)}%` }}
                                  />
                                </div>
                                <span>{formatarValor(val, col.type, col.label)}</span>
                              </div>
                            ) : (
                              formatarValor(val, col.type, col.label)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Rodapé com Totais */}
            {resultado?.totals && Object.keys(resultado.totals).length > 0 && linhasFiltradas.length > 0 && (
              <tfoot className="sticky bottom-0 bg-slate-900/95 border-t-2 border-cyan-500/30 font-semibold text-white">
                <tr>
                  <td className="p-2 text-center text-[9px] font-mono uppercase text-cyan-400">
                    TOTAL
                  </td>
                  {resultado.columns.map(col => {
                    const totalVal = resultado.totals[col.key];
                    return (
                      <td
                        key={col.key}
                        className={`p-2 text-[11px] ${
                          totalVal !== undefined ? 'text-right font-mono text-cyan-300 font-bold' : 'text-slate-500'
                        }`}
                      >
                        {totalVal !== undefined ? formatarValor(totalVal, 'number', col.label) : ''}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Paginação */}
        {linhasFiltradas.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>Exibindo</span>
              <select
                value={itensPorPagina}
                onChange={e => {
                  setItensPorPagina(Number(e.target.value));
                  setPaginaAtual(1);
                }}
                className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-white"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>de {linhasFiltradas.length} linhas</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPaginaAtual(1)}
                disabled={paginaAtual === 1}
                className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
              >
                &laquo;
              </button>
              <button
                onClick={() => setPaginaAtual(prev => Math.max(prev - 1, 1))}
                disabled={paginaAtual === 1}
                className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
              >
                Anterior
              </button>
              <span className="text-[11px] px-2 font-mono text-slate-300">
                {paginaAtual} / {totalPaginas}
              </span>
              <button
                onClick={() => setPaginaAtual(prev => Math.min(prev + 1, totalPaginas))}
                disabled={paginaAtual === totalPaginas}
                className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
              >
                Próxima
              </button>
              <button
                onClick={() => setPaginaAtual(totalPaginas)}
                disabled={paginaAtual === totalPaginas}
                className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
              >
                &raquo;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================== */}
      {/* MODAL: SALVAR / EDITAR MODELO                              */}
      {/* ========================================================== */}
      {isSalvarModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel-glow w-full max-w-lg rounded-xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
                  {editandoModeloId ? <Pencil className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editandoModeloId ? 'Editar Modelo' : 'Salvar Novo Modelo'}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {editandoModeloId ? 'Atualize as propriedades do modelo.' : 'Grave a configuração atual para uso futuro.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setIsSalvarModalOpen(false); setEditandoModeloId(null); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarModelo} className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Nome do Modelo *</label>
                <input
                  type="text"
                  value={nomeNovoModelo}
                  onChange={e => setNomeNovoModelo(e.target.value)}
                  placeholder="Ex: Auditoria de Combustíveis por Fornecedor"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Descrição</label>
                <textarea
                  value={descNovoModelo}
                  onChange={e => setDescNovoModelo(e.target.value)}
                  placeholder="Finalidade tributária deste relatório..."
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Categoria</label>
                  <select
                    value={categoriaNovoModelo}
                    onChange={e => setCategoriaNovoModelo(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  >
                    <option value="fiscal">Fiscal Geral</option>
                    <option value="auditoria">Auditoria & Compliance</option>
                    <option value="rtc">Reforma Tributária (RTC)</option>
                    <option value="gerencial">Gerencial / Diretoria</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Escopo *</label>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer text-[11px]">
                      <input type="radio" name="escopo" value="pessoal" checked={escopoNovoModelo === 'pessoal'} onChange={() => setEscopoNovoModelo('pessoal')} />
                      <User className="w-3 h-3 text-purple-400" />
                      <span className="text-slate-200">🔒 Pessoal</span>
                    </label>
                    <label className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer text-[11px]">
                      <input type="radio" name="escopo" value="empresa" checked={escopoNovoModelo === 'empresa'} onChange={() => setEscopoNovoModelo('empresa')} />
                      <Building2 className="w-3 h-3 text-cyan-400" />
                      <span className="text-slate-200">🏢 Empresa</span>
                    </label>
                    <label className={`flex items-center gap-2 p-1.5 rounded-lg border text-[11px] ${
                      isAdminMaster ? 'bg-slate-900 border-amber-500/30 cursor-pointer' : 'bg-slate-900/40 border-slate-800 opacity-60 cursor-not-allowed'
                    }`}>
                      <input type="radio" name="escopo" value="global" disabled={!isAdminMaster} checked={escopoNovoModelo === 'global'} onChange={() => setEscopoNovoModelo('global')} />
                      <Globe className="w-3 h-3 text-amber-400" />
                      <div className="flex-1">
                        <span className="text-amber-300 font-semibold">🌐 Global</span>
                        {!isAdminMaster && <span className="block text-[8px] text-amber-500/80 font-mono">Admin Master</span>}
                      </div>
                      {!isAdminMaster && <Lock className="w-2.5 h-2.5 text-amber-400" />}
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Governança:</strong> Modelos Globais impactam todos os usuários e só podem ser criados pelo Admin Master.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsSalvarModalOpen(false); setEditandoModeloId(null); }}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-white bg-slate-800/80 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSalvandoModelo}
                  className="px-4 py-1.5 rounded-lg text-[11px] font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSalvandoModelo ? 'Salvando...' : editandoModeloId ? 'Atualizar Modelo' : 'Confirmar e Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL: GERENCIADOR DE MODELOS (CRUD COMPLETO)              */}
      {/* ========================================================== */}
      {isGerenciarModelosOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel-glow w-full max-w-3xl rounded-xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
                  <FolderOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Modelos Salvos</h3>
                  <p className="text-[10px] text-slate-400">Carregar, editar ou excluir modelos.</p>
                </div>
              </div>
              <button onClick={() => setIsGerenciarModelosOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filtro por Escopo */}
            <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center gap-1.5 flex-wrap">
              {(['todos', 'global', 'empresa', 'pessoal'] as const).map(esc => {
                const count = esc === 'todos' ? modelos.length : modelos.filter(m => m.escopo === esc).length;
                const emoji = esc === 'global' ? '🌐' : esc === 'empresa' ? '🏢' : esc === 'pessoal' ? '🔒' : '';
                const isActive = filtroEscopoModelos === esc;
                const colors = esc === 'global' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : esc === 'empresa' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                  : esc === 'pessoal' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';

                return (
                  <button
                    key={esc}
                    onClick={() => setFiltroEscopoModelos(esc)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                      isActive ? `${colors} border` : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {emoji} {esc.charAt(0).toUpperCase() + esc.slice(1)} ({count})
                  </button>
                );
              })}
            </div>

            {/* Lista de Modelos */}
            <div className="p-3 overflow-y-auto space-y-2 flex-1">
              {modelosFiltrados.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  Nenhum modelo nesta categoria.
                </div>
              ) : (
                modelosFiltrados.map(mod => {
                  const isCurrent = modeloAtivo?.id === mod.id;

                  return (
                    <div
                      key={mod.id}
                      className={`p-3 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        isCurrent
                          ? 'bg-blue-950/30 border-cyan-500/40 shadow-md'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-white truncate">{mod.nome}</h4>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                            mod.escopo === 'global' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                            mod.escopo === 'empresa' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' :
                            'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          }`}>
                            {mod.escopo === 'global' ? '🌐 Global' : mod.escopo === 'empresa' ? '🏢 Empresa' : '🔒 Pessoal'}
                          </span>
                          {mod.is_padrao_sistema === 1 && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                              Fábrica
                            </span>
                          )}
                        </div>
                        {mod.descricao && (
                          <p className="text-[10px] text-slate-400 truncate">{mod.descricao}</p>
                        )}
                        <div className="flex items-center gap-3 text-[9px] text-slate-500 font-mono">
                          <span>Por: {mod.criado_por_nome || 'Sistema'}</span>
                          {mod.categoria && <span>{mod.categoria.toUpperCase()}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => aplicarModelo(mod)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 cursor-pointer shadow-sm flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          <span>Carregar</span>
                        </button>

                        {/* Botão Editar (CRUD: Update via PUT) */}
                        {mod.podeEditar && mod.is_padrao_sistema !== 1 && (
                          <button
                            onClick={() => handleIniciarEdicao(mod)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 cursor-pointer transition-colors"
                            title="Editar Modelo"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Botão Excluir */}
                        {mod.podeEditar && mod.is_padrao_sistema !== 1 && (
                          <button
                            onClick={() => handleExcluirModelo(mod.id, mod.nome)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                            title="Excluir Modelo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
