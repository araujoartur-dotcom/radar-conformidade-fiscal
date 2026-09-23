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

const ANOS_DISPONIVEIS = ['2026', '2025', '2024', '2023', '2022', 'todos'] as const;

const MESES = [
  { valor: 'todos', label: 'Ano Todo' },
  { valor: '01', label: 'Jan' },
  { valor: '02', label: 'Fev' },
  { valor: '03', label: 'Mar' },
  { valor: '04', label: 'Abr' },
  { valor: '05', label: 'Mai' },
  { valor: '06', label: 'Jun' },
  { valor: '07', label: 'Jul' },
  { valor: '08', label: 'Ago' },
  { valor: '09', label: 'Set' },
  { valor: '10', label: 'Out' },
  { valor: '11', label: 'Nov' },
  { valor: '12', label: 'Dez' }
];

const DEFAULT_COCKPIT_MODELS: CockpitModelo[] = [
  {
    id: 'padrao-hierarquia-rtc-sefaz',
    nome: 'Hierarquia Oficial RTC (cClassTrib → pIBS → indOper → cMun → UF)',
    descricao: 'Pivot da Reforma Tributária com agrupamento estrito da esquerda para a direita e valores reais extraídos diretamente das tags XML.',
    categoria: 'fiscal',
    escopo: 'global',
    usuario_id: 'sistema',
    is_padrao_sistema: 1,
    podeEditar: false,
    configuracao: {
      fonte_dados: 'dfe_itens_documentos',
      modo: 'agrupado',
      dimensoes: ['cClassTrib', 'pIBS', 'indOper', 'cMun', 'UF'],
      metricas: [
        { campo: 'vBC', agregacao: 'sum', apelido: 'vBC (Base IBS/CBS)', exibicao: 'valor' },
        { campo: 'vIBSUF', agregacao: 'sum', apelido: 'vIBSUF (IBS Estadual)', exibicao: 'valor' },
        { campo: 'vCBS', agregacao: 'sum', apelido: 'vCBS (CBS Federal)', exibicao: 'valor' },
        { campo: 'vProd', agregacao: 'sum', apelido: 'vProd (Valor Produtos)', exibicao: 'valor' },
        { campo: 'vProd', agregacao: 'sum', apelido: '% do Total', exibicao: 'percent_total' },
        { campo: 'id', agregacao: 'count', apelido: 'Qtd Itens', exibicao: 'valor' }
      ],
      ordenacao: [{ campo: 'vBC', direcao: 'desc' }],
      limite: 0,
      periodo: { ano: '2026', mes: 'todos' }
    }
  },
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
        { campo: 'valor_total', agregacao: 'sum', apelido: 'Total Compras' },
        { campo: 'valor_icms', agregacao: 'sum', apelido: 'ICMS Destacado' },
        { campo: 'valor_ibs', agregacao: 'sum', apelido: 'IBS Total' },
        { campo: 'valor_cbs', agregacao: 'sum', apelido: 'CBS Total' },
        { campo: 'id', agregacao: 'count', apelido: 'Total de Notas' }
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
        { campo: 'id', agregacao: 'count', apelido: 'Qtd Eventos' }
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
        { campo: 'debito_em_aberto', agregacao: 'sum', apelido: 'Débito em Aberto' },
        { campo: 'debito_extinto', agregacao: 'sum', apelido: 'Débito Extinto' },
        { campo: 'credito_a_propriar', agregacao: 'sum', apelido: 'Crédito a Propriar' },
        { campo: 'credito_utilizado', agregacao: 'sum', apelido: 'Crédito Utilizado' },
        { campo: 'id', agregacao: 'count', apelido: 'Qtd Lançamentos' }
      ],
      ordenacao: [{ campo: 'debito_extinto', direcao: 'desc' }],
      limite: 0,
      periodo: { ano: '2026', mes: 'todos' }
    }
  }
];

export const CockpitRelatoriosPanel: React.FC = () => {
  const { user, empresaAtiva } = useAuth();
  const { get, post, put, del } = useApi();

  // Estados de Metadados
  const [fontes, setFontes] = useState<CockpitDataSource[]>(DEFAULT_COCKPIT_DATA_SOURCES);
  const [modelos, setModelos] = useState<CockpitModelo[]>(DEFAULT_COCKPIT_MODELS);
  const [modeloAtivo, setModeloAtivo] = useState<CockpitModelo | null>(DEFAULT_COCKPIT_MODELS[0]);
  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(false);

  // Estados de Período da Pesquisa (Competência)
  const [anoSelecionado, setAnoSelecionado] = useState<string>('2026');
  const [mesSelecionado, setMesSelecionado] = useState<string>('todos');

  // Estados de Construção da Consulta
  const [fonteSelecionada, setFonteSelecionada] = useState<string>('dfe_itens_documentos');
  const [modo, setModo] = useState<'detalhado' | 'agrupado'>('agrupado');
  const [dimensoes, setDimensoes] = useState<string[]>(['cClassTrib', 'pIBS', 'indOper', 'cMun', 'UF']);
  const [colunasPivot, setColunasPivot] = useState<string[]>([]);
  const [metricas, setMetricas] = useState<CockpitMetrica[]>([
    { campo: 'vBC', agregacao: 'sum', apelido: 'vBC (Base IBS/CBS)', exibicao: 'valor' },
    { campo: 'vIBSUF', agregacao: 'sum', apelido: 'vIBSUF (IBS Estadual)', exibicao: 'valor' },
    { campo: 'vCBS', agregacao: 'sum', apelido: 'vCBS (CBS Federal)', exibicao: 'valor' },
    { campo: 'vProd', agregacao: 'sum', apelido: 'vProd (Valor Produtos)', exibicao: 'valor' },
    { campo: 'vProd', agregacao: 'sum', apelido: '% do Total', exibicao: 'percent_total' },
    { campo: 'id', agregacao: 'count', apelido: 'Qtd Itens', exibicao: 'valor' }
  ]);
  const [filtros, setFiltros] = useState<CockpitFiltro[]>([]);
  const [ordenacao, setOrdenacao] = useState<CockpitOrdenacao[]>([
    { campo: 'vBC', direcao: 'desc' }
  ]);
  const [limite, setLimite] = useState<number>(0);
  const [buscaCampo, setBuscaCampo] = useState<string>('');

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

  // Executar a consulta dinâmica
  const executarConsulta = useCallback(async (anoOverride?: string, mesOverride?: string) => {
    if (!empresaAtiva?.id) {
      setExecErro('Por favor, selecione uma empresa ativa para consultar os dados com isolamento multi-tenant.');
      return;
    }

    const ano = anoOverride !== undefined ? anoOverride : anoSelecionado;
    const mes = mesOverride !== undefined ? mesOverride : mesSelecionado;

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
        periodo: {
          ano,
          mes
        }
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
  }, [empresaAtiva?.id, fonteSelecionada, modo, dimensoes, metricas, filtros, ordenacao, limite, anoSelecionado, mesSelecionado, post]);

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
    setLimite(cfg.limite !== undefined ? cfg.limite : 0);
    if (cfg.periodo?.ano) setAnoSelecionado(String(cfg.periodo.ano));
    if (cfg.periodo?.mes) setMesSelecionado(String(cfg.periodo.mes));

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
          limite,
          periodo: {
            ano: anoSelecionado,
            mes: mesSelecionado
          }
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
        limite: 0,
        periodo: {
          ano: anoSelecionado,
          mes: mesSelecionado
        }
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

  // Helpers de Manipulação de Dimensões (Linhas)
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

  const toggleColunaPivot = (campoKey: string) => {
    setColunasPivot(prev => {
      if (prev.includes(campoKey)) {
        return prev.filter(k => k !== campoKey);
      } else {
        return [...prev, campoKey];
      }
    });
  };

  const aplicarHierarquiaRtc = () => {
    setFonteSelecionada('dfe_itens_documentos');
    setModo('agrupado');
    setDimensoes(['cClassTrib', 'pIBS', 'indOper', 'cMun', 'UF']);
    setMetricas([
      { campo: 'vBC', agregacao: 'sum', apelido: 'vBC (Base IBS/CBS)', exibicao: 'valor' },
      { campo: 'vIBSUF', agregacao: 'sum', apelido: 'vIBSUF (IBS Estadual)', exibicao: 'valor' },
      { campo: 'vCBS', agregacao: 'sum', apelido: 'vCBS (CBS Federal)', exibicao: 'valor' },
      { campo: 'vProd', agregacao: 'sum', apelido: 'vProd (Valor Produtos)', exibicao: 'valor' },
      { campo: 'vProd', agregacao: 'sum', apelido: '% do Total', exibicao: 'percent_total' },
      { campo: 'id', agregacao: 'count', apelido: 'Qtd Itens', exibicao: 'valor' }
    ]);
    setOrdenacao([{ campo: 'vBC', direcao: 'desc' }]);
    setSucessoFeedback('Hierarquia Oficial RTC SEFAZ aplicada (cClassTrib → pIBS → indOper → cMun → UF)!');
    setTimeout(() => setSucessoFeedback(null), 4000);
  };

  // Helpers de Manipulação de Métricas
  const adicionarMetrica = (campoKey: string, tipoExibicao: 'valor' | 'percent_total' = 'valor') => {
    const campoObj = fonteAtivaObj?.campos.find(c => c.key === campoKey);
    const apelido = tipoExibicao === 'percent_total' 
      ? `% ${campoObj ? campoObj.label : campoKey}` 
      : (campoObj ? `${campoObj.label}` : campoKey);
    setMetricas(prev => [
      ...prev,
      { campo: campoKey, agregacao: 'sum', apelido, exibicao: tipoExibicao }
    ]);
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
      // Se for número inteiro pequeno ou contagem de itens
      if (Number.isInteger(num) && num < 1000 && !labelOuChave?.toLowerCase().includes('valor') && !labelOuChave?.toLowerCase().includes('base')) {
        return num.toString();
      }
      // Formata como moeda/decimal brasileiro
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
        <div className="lg:col-span-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] overflow-y-auto pr-1.5 custom-scrollbar space-y-4">
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

            {/* 0. Período de Pesquisa (Competência Ano/Mês) */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan-500/30 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Período da Pesquisa (Competência)</span>
                </label>
                <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                  {anoSelecionado === 'todos' ? 'Todos os Anos' : anoSelecionado}
                  {mesSelecionado !== 'todos' ? ` / ${MESES.find(m => m.valor === mesSelecionado)?.label || mesSelecionado}` : ' (Ano Todo)'}
                </span>
              </div>

              {/* Seletor de Ano */}
              <div>
                <span className="text-[10px] text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                  Ano Fiscal:
                </span>
                <div className="grid grid-cols-6 gap-1">
                  {ANOS_DISPONIVEIS.map(ano => (
                    <button
                      key={ano}
                      type="button"
                      onClick={() => {
                        setAnoSelecionado(ano);
                        executarConsulta(ano, mesSelecionado);
                      }}
                      className={`py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                        anoSelecionado === ano
                          ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30 font-extrabold'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                      }`}
                    >
                      {ano === 'todos' ? 'Todos' : ano}
                    </button>
                  ))}
                </div>
              </div>

              {/* Seletor de Mês */}
              <div>
                <span className="text-[10px] text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                  Mês / Competência:
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-4 gap-1">
                  {MESES.map(mes => (
                    <button
                      key={mes.valor}
                      type="button"
                      onClick={() => {
                        setMesSelecionado(mes.valor);
                        executarConsulta(anoSelecionado, mes.valor);
                      }}
                      className={`py-1 px-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer text-center ${
                        mesSelecionado === mes.valor
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md border border-cyan-400/40 font-bold'
                          : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/70 hover:text-slate-200 border border-slate-700/40'
                      }`}
                    >
                      {mes.label}
                    </button>
                  ))}
                </div>
              </div>
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

            {/* 3. Seleção de Campos / Tags XML & 4 Quadrantes Pivot (Excel Style) */}
            <div className="space-y-3 border-t border-slate-800/80 pt-3">
              {/* Cabeçalho da Seção com Atalho RTC */}
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5 text-cyan-400" />
                  <span>3. Matriz Pivot &amp; Tags XML (Estilo Excel)</span>
                </label>
                <button
                  type="button"
                  onClick={aplicarHierarquiaRtc}
                  className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 flex items-center gap-1 transition-all font-semibold cursor-pointer shadow-sm"
                  title="Aplicar agrupamento padrão RTC: cClassTrib → pIBS → indOper → cMun → UF"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Hierarquia RTC SEFAZ</span>
                </button>
              </div>

              {/* Barra de Pesquisa de Campos / Tags XML */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={buscaCampo}
                  onChange={e => setBuscaCampo(e.target.value)}
                  placeholder="Pesquisar tag XML (cClassTrib, vBC, pIBS, indOper...)"
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
                {buscaCampo && (
                  <button
                    onClick={() => setBuscaCampo('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Tag Picker dos Campos Disponíveis com Ações Rápidas */}
              <div className="max-h-36 overflow-y-auto p-2 bg-slate-900/70 border border-slate-800 rounded-xl space-y-1">
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
                          className={`text-[10px] px-2 py-0.5 rounded-lg border font-mono transition-all flex items-center gap-1 ${
                            isLinha
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : isMetrica
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : isFiltro
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:border-slate-600'
                          }`}
                        >
                          <span className="truncate max-w-[130px]" title={`${campo.label} (${campo.key})`}>
                            {campo.key}
                          </span>

                          <div className="flex items-center gap-0.5 border-l border-slate-700/60 pl-1 ml-0.5">
                            <button
                              type="button"
                              onClick={() => toggleDimensao(campo.key)}
                              title={isLinha ? "Remover das Linhas" : "Adicionar às Linhas (Agrupamento)"}
                              className={`p-0.5 rounded hover:bg-white/10 ${isLinha ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
                            >
                              L
                            </button>
                            {isNum && modo === 'agrupado' && (
                              <button
                                type="button"
                                onClick={() => adicionarMetrica(campo.key, 'valor')}
                                title="Adicionar aos Valores (Soma R$)"
                                className={`p-0.5 rounded hover:bg-white/10 ${isMetrica ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}
                              >
                                V
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setFiltros(prev => [...prev, { campo: campo.key, operador: 'contains', valor: '' }])}
                              title="Adicionar aos Filtros"
                              className={`p-0.5 rounded hover:bg-white/10 ${isFiltro ? 'text-cyan-400 font-bold' : 'text-slate-400'}`}
                            >
                              F
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* OS 4 QUADRANTES CLÁSSICOS DO EXCEL (Filtros, Colunas, Linhas, Valores) */}
              <div className="space-y-2.5 pt-1">
                {/* LINHA SUPERIOR: FILTROS & COLUNAS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {/* Quadrante 1: FILTROS */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-cyan-300">
                        <Filter className="w-3 h-3 text-cyan-400" />
                        <span>Filtros ({filtros.length})</span>
                      </div>
                      <button
                        type="button"
                        onClick={adicionarFiltro}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer"
                      >
                        + Novo
                      </button>
                    </div>
                    {filtros.length === 0 ? (
                      <p className="text-[9px] text-slate-500 italic py-1">Sem filtros (tudo).</p>
                    ) : (
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                        {filtros.map((fil, idx) => (
                          <div key={idx} className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 space-y-1">
                            <div className="flex items-center gap-1">
                              <select
                                value={fil.campo}
                                onChange={e => atualizarFiltro(idx, { campo: e.target.value })}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-white focus:outline-none"
                              >
                                {fonteAtivaObj?.campos.map(c => (
                                  <option key={c.key} value={c.key}>{c.key}</option>
                                ))}
                              </select>
                              <select
                                value={fil.operador}
                                onChange={e => atualizarFiltro(idx, { operador: e.target.value as CockpitFilterOperator })}
                                className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-cyan-300 font-mono focus:outline-none"
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
                              <button
                                type="button"
                                onClick={() => removerFiltro(idx)}
                                className="text-slate-500 hover:text-rose-400 p-0.5 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            {fil.operador !== 'is_null' && fil.operador !== 'is_not_null' && (
                              <input
                                type="text"
                                value={fil.valor ?? ''}
                                onChange={e => atualizarFiltro(idx, { valor: e.target.value })}
                                placeholder="Valor..."
                                className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-200"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quadrante 2: COLUNAS */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-300">
                        <Table className="w-3 h-3 text-indigo-400" />
                        <span>Colunas ({colunasPivot.length})</span>
                      </div>
                      <span className="text-[9px] text-slate-500">Horizontal</span>
                    </div>
                    {colunasPivot.length === 0 ? (
                      <p className="text-[9px] text-slate-500 italic py-1">Padrão: métricas em colunas.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                        {colunasPivot.map(colKey => (
                          <span
                            key={colKey}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1 font-mono"
                          >
                            <span>{colKey}</span>
                            <button onClick={() => toggleColunaPivot(colKey)} className="hover:text-rose-400">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* LINHA INFERIOR: LINHAS (HIERARQUIA ESQ->DIR) & VALORES (MÉTRICAS + PERCENTUAIS) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {/* Quadrante 3: LINHAS (Hierarquia Ordenada) */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300">
                        <Layers className="w-3 h-3 text-amber-400" />
                        <span>Linhas ({dimensoes.length})</span>
                      </div>
                      <span className="text-[9px] text-slate-500">Esq. → Dir.</span>
                    </div>
                    {dimensoes.length === 0 ? (
                      <p className="text-[9px] text-slate-500 italic py-1">Selecione campos para agrupar.</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                        {dimensoes.map((dimKey, idx) => {
                          const cObj = fonteAtivaObj?.campos.find(c => c.key === dimKey);
                          return (
                            <div
                              key={dimKey}
                              className="p-1.5 rounded-lg bg-slate-800/80 border border-amber-500/30 flex items-center justify-between text-[11px]"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-bold flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="font-mono font-bold text-white truncate" title={cObj?.label || dimKey}>
                                  {dimKey}
                                </span>
                              </div>

                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => reordenarDimensao(idx, 'up')}
                                  className="p-0.5 text-slate-400 hover:text-amber-300 disabled:opacity-30 cursor-pointer"
                                  title="Subir na hierarquia (mais à esquerda)"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === dimensoes.length - 1}
                                  onClick={() => reordenarDimensao(idx, 'down')}
                                  className="p-0.5 text-slate-400 hover:text-amber-300 disabled:opacity-30 cursor-pointer"
                                  title="Descer na hierarquia (mais à direita)"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleDimensao(dimKey)}
                                  className="p-0.5 text-slate-400 hover:text-rose-400 cursor-pointer"
                                  title="Remover da hierarquia"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Quadrante 4: VALORES (Métricas + % Total Geral) */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-300">
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        <span>Valores ({metricas.length})</span>
                      </div>
                      <span className="text-[9px] text-slate-500">Cálculos &amp; %</span>
                    </div>
                    {metricas.length === 0 ? (
                      <p className="text-[9px] text-slate-500 italic py-1">Nenhuma métrica selecionada.</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                        {metricas.map((met, idx) => (
                          <div
                            key={idx}
                            className="p-1.5 rounded-lg bg-slate-800/80 border border-emerald-500/30 space-y-1 text-[10px]"
                          >
                            <div className="flex items-center gap-1">
                              <select
                                value={met.agregacao}
                                onChange={e => atualizarMetrica(idx, { agregacao: e.target.value as CockpitAggregationType })}
                                className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-emerald-300 font-mono focus:outline-none"
                              >
                                <option value="sum">Soma</option>
                                <option value="count">Qtd</option>
                                <option value="avg">Média</option>
                                <option value="min">Mín</option>
                                <option value="max">Máx</option>
                              </select>

                              <span className="flex-1 font-mono font-bold text-white truncate" title={met.campo}>
                                {met.campo}
                              </span>

                              {/* Alternador R$ ou % Total */}
                              <button
                                type="button"
                                onClick={() => atualizarMetrica(idx, { exibicao: met.exibicao === 'percent_total' ? 'valor' : 'percent_total' })}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all ${
                                  met.exibicao === 'percent_total'
                                    ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                                    : 'bg-slate-700 text-slate-300 hover:text-white'
                                }`}
                                title={met.exibicao === 'percent_total' ? "Exibindo como % do Total Geral" : "Exibindo como Valor R$"}
                              >
                                {met.exibicao === 'percent_total' ? '% Total' : 'R$'}
                              </button>

                              {/* Botão Duplicar como Percentual */}
                              {met.exibicao !== 'percent_total' && (
                                <button
                                  type="button"
                                  onClick={() => duplicarMetricaComoPercentual(idx)}
                                  className="text-slate-400 hover:text-cyan-300 p-0.5 cursor-pointer"
                                  title="Duplicar esta métrica como % do Total Geral"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => removerMetrica(idx)}
                                className="text-slate-500 hover:text-rose-400 p-0.5 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>

                            <input
                              type="text"
                              value={met.apelido || ''}
                              onChange={e => atualizarMetrica(idx, { apelido: e.target.value })}
                              placeholder="Rótulo da coluna..."
                              className="w-full bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-[10px] text-slate-200"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Ordenação & Limite da Extração */}
            <div className="grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Limite da Extração
                </label>
                <select
                  value={limite}
                  onChange={e => setLimite(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 font-mono"
                >
                  <option value={0}>Sem Limite (Todo o Período)</option>
                  <option value={25000}>25.000 linhas</option>
                  <option value={10000}>10.000 linhas</option>
                  <option value={5000}>5.000 linhas</option>
                  <option value={1000}>1.000 linhas</option>
                  <option value={500}>500 linhas</option>
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
              onClick={() => executarConsulta()}
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
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                  <span className="font-bold text-white">
                    {linhasFiltradas.length.toLocaleString('pt-BR')}
                  </span>
                  <span>registro(s) retornado(s)</span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-300 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
                  <Calendar className="w-3 h-3 text-cyan-400" />
                  <span>
                    {anoSelecionado === 'todos' ? 'Todos os Anos' : anoSelecionado}
                    {mesSelecionado !== 'todos' ? ` / ${MESES.find(m => m.valor === mesSelecionado)?.label || mesSelecionado}` : ' (Ano Todo)'}
                  </span>
                </div>

                {limite === 0 ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Sem Limite
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/60">
                    Máx {limite.toLocaleString('pt-BR')}
                  </span>
                )}

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
                                {col.key === 'cClassTrib' || col.key === 'cclasstrib' || col.key === 'indOper' ? (
                                  val && val !== '(Não informado / Sem RTC)' ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                      {val}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500 italic">
                                      {val || '-'}
                                    </span>
                                  )
                                ) : col.key === 'cst_csosn' || col.key === 'tipo_doc' ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                                    {val || '-'}
                                  </span>
                                ) : (col.label.includes('%') || col.key.includes('%')) && typeof val === 'number' ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden shrink-0">
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
                            {totalVal !== undefined ? formatarValor(totalVal, 'number', col.label) : ''}
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
