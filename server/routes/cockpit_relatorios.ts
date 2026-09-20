/**
 * ============================================================
 * COCKPIT DE MONTAGEM DINÂMICA DE RELATÓRIOS FISCAIS
 * ============================================================
 * Rotas e motor de execução para relatórios customizados,
 * pivot tables, agregação de dados e gestão de modelos salvos.
 *
 * GOVERNANÇA DE ESCOPO:
 * - 'pessoal': apenas o usuário criador tem visibilidade e edição.
 * - 'empresa': compartilhado com os usuários da empresa ativa.
 * - 'global': EXCLUSIVO PARA O ADMIN MASTER. Usuários sem perfil
 *             admin_master têm a gravação com escopo global bloqueada
 *             com HTTP 403 Forbidden.
 * ============================================================
 */

import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import * as XLSX from 'xlsx';
import { requireAuth, AuthenticatedRequest, logAuditAction } from '../middleware/auth';
import { getDatabase } from '../db/database';
import { getBrasiliaTimestamp } from '../utils/timezone';

const router = Router();

// ============================================================
// DICIONÁRIO CANÔNICO DE CAMPOS E FONTES DE DADOS (ALLOWLIST)
// ============================================================

export interface FieldDef {
  key: string;
  label: string;
  sqlExpr: string;
  type: 'string' | 'number' | 'date' | 'badge';
  group: string;
  aggregatable?: boolean;
}

export interface DataSourceDef {
  id: string;
  nome: string;
  descricao: string;
  tabelaBase: string;
  colunaTenant: string;
  joinClausula?: string;
  campos: Record<string, FieldDef>;
}

export const DATA_SOURCES: Record<string, DataSourceDef> = {
  dfe_itens_documentos: {
    id: 'dfe_itens_documentos',
    nome: 'Itens de Documentos Fiscais (Detalhado)',
    descricao: 'Linhas de produtos/serviços de NF-e, CT-e e NFS-e cruzadas com dados de cabeçalho e tributação RTC.',
    tabelaBase: 'dfe_itens i',
    colunaTenant: 'd.empresa_id',
    joinClausula: 'JOIN dfe_documentos d ON i.documento_id = d.id',
    campos: {
      id: { key: 'id', label: 'ID Item', sqlExpr: 'i.id', type: 'string', group: 'Identificação' },
      documento_id: { key: 'documento_id', label: 'ID Documento', sqlExpr: 'i.documento_id', type: 'string', group: 'Identificação' },
      item_nro: { key: 'item_nro', label: 'Nº Item', sqlExpr: 'i.item_nro', type: 'number', group: 'Identificação' },
      ncm: { key: 'ncm', label: 'NCM', sqlExpr: 'i.ncm', type: 'string', group: 'Classificação Fiscal' },
      cclasstrib: { key: 'cclasstrib', label: 'cClassTrib (RTC)', sqlExpr: 'i.cclasstrib', type: 'string', group: 'Classificação Fiscal' },
      cst_csosn: { key: 'cst_csosn', label: 'CST / CSOSN', sqlExpr: 'i.cst_csosn', type: 'string', group: 'Classificação Fiscal' },
      cfop: { key: 'cfop', label: 'CFOP', sqlExpr: 'i.cfop', type: 'string', group: 'Classificação Fiscal' },
      descricao_item: { key: 'descricao_item', label: 'Descrição do Item', sqlExpr: 'i.descricao_item', type: 'string', group: 'Produto / Serviço' },
      natureza_operacao: { key: 'natureza_operacao', label: 'Natureza da Operação', sqlExpr: 'i.natureza_operacao', type: 'string', group: 'Classificação Fiscal' },
      quantidade: { key: 'quantidade', label: 'Quantidade', sqlExpr: 'i.quantidade', type: 'number', group: 'Quantidades', aggregatable: true },
      unidade: { key: 'unidade', label: 'Unidade', sqlExpr: 'i.unidade', type: 'string', group: 'Quantidades' },
      valor_bruto_item: { key: 'valor_bruto_item', label: 'Valor Bruto (R$)', sqlExpr: 'i.valor_bruto_item', type: 'number', group: 'Valores', aggregatable: true },
      desconto_incondicional: { key: 'desconto_incondicional', label: 'Desconto (R$)', sqlExpr: 'i.desconto_incondicional', type: 'number', group: 'Valores', aggregatable: true },
      frete_seguro_rateado: { key: 'frete_seguro_rateado', label: 'Frete/Seguro (R$)', sqlExpr: 'i.frete_seguro_rateado', type: 'number', group: 'Valores', aggregatable: true },
      valor_liquido_item: { key: 'valor_liquido_item', label: 'Valor Líquido (R$)', sqlExpr: 'i.valor_liquido_item', type: 'number', group: 'Valores', aggregatable: true },
      base_ibs: { key: 'base_ibs', label: 'Base de Cálculo IBS', sqlExpr: 'i.base_ibs', type: 'number', group: 'Tributação RTC', aggregatable: true },
      aliquota_ibs: { key: 'aliquota_ibs', label: 'Alíquota IBS (%)', sqlExpr: 'i.aliquota_ibs', type: 'number', group: 'Tributação RTC', aggregatable: true },
      valor_ibs: { key: 'valor_ibs', label: 'Valor IBS (R$)', sqlExpr: 'i.valor_ibs', type: 'number', group: 'Tributação RTC', aggregatable: true },
      base_cbs: { key: 'base_cbs', label: 'Base de Cálculo CBS', sqlExpr: 'i.base_cbs', type: 'number', group: 'Tributação RTC', aggregatable: true },
      aliquota_cbs: { key: 'aliquota_cbs', label: 'Alíquota CBS (%)', sqlExpr: 'i.aliquota_cbs', type: 'number', group: 'Tributação RTC', aggregatable: true },
      valor_cbs: { key: 'valor_cbs', label: 'Valor CBS (R$)', sqlExpr: 'i.valor_cbs', type: 'number', group: 'Tributação RTC', aggregatable: true },
      chave_acesso: { key: 'chave_acesso', label: 'Chave de Acesso', sqlExpr: 'd.chave_acesso', type: 'string', group: 'Documento' },
      tipo_doc: { key: 'tipo_doc', label: 'Tipo Doc (NF-e/CT-e/NFS-e)', sqlExpr: 'd.tipo_doc', type: 'badge', group: 'Documento' },
      tipo_operacao: { key: 'tipo_operacao', label: 'Operação (Entrada/Saída)', sqlExpr: 'd.tipo_operacao', type: 'badge', group: 'Documento' },
      numero_serie: { key: 'numero_serie', label: 'Número / Série', sqlExpr: 'd.numero_serie', type: 'string', group: 'Documento' },
      data_emissao: { key: 'data_emissao', label: 'Data de Emissão', sqlExpr: 'd.data_emissao', type: 'date', group: 'Documento' },
      competencia: { key: 'competencia', label: 'Competência', sqlExpr: 'd.competencia', type: 'string', group: 'Documento' },
      fornecedor_cnpj: { key: 'fornecedor_cnpj', label: 'CNPJ Emitente/Fornecedor', sqlExpr: 'd.fornecedor_cnpj', type: 'string', group: 'Emitente / Fornecedor' },
      fornecedor_razao: { key: 'fornecedor_razao', label: 'Razão Social Emitente', sqlExpr: 'd.fornecedor_razao', type: 'string', group: 'Emitente / Fornecedor' },
      fornecedor_uf: { key: 'fornecedor_uf', label: 'UF Emitente', sqlExpr: 'd.fornecedor_uf', type: 'string', group: 'Emitente / Fornecedor' },
      fornecedor_municipio: { key: 'fornecedor_municipio', label: 'Município Emitente', sqlExpr: 'd.fornecedor_municipio', type: 'string', group: 'Emitente / Fornecedor' },
      cliente_cnpj: { key: 'cliente_cnpj', label: 'CNPJ Destinatário/Cliente', sqlExpr: 'd.cliente_cnpj', type: 'string', group: 'Destinatário / Cliente' },
      cliente_razao: { key: 'cliente_razao', label: 'Razão Social Destinatário', sqlExpr: 'd.cliente_razao', type: 'string', group: 'Destinatário / Cliente' },
      cliente_uf: { key: 'cliente_uf', label: 'UF Destinatário', sqlExpr: 'd.cliente_uf', type: 'string', group: 'Destinatário / Cliente' },
      situacao_doc: { key: 'situacao_doc', label: 'Situação Documento', sqlExpr: 'd.situacao_doc', type: 'badge', group: 'Documento' }
    }
  },
  dfe_documentos: {
    id: 'dfe_documentos',
    nome: 'Documentos Fiscais (Cabeçalho Consolidado)',
    descricao: 'Consolidação de valores, impostos e participantes por Documento Fiscal Eletrônico.',
    tabelaBase: 'dfe_documentos d',
    colunaTenant: 'd.empresa_id',
    campos: {
      id: { key: 'id', label: 'ID Documento', sqlExpr: 'd.id', type: 'string', group: 'Identificação' },
      chave_acesso: { key: 'chave_acesso', label: 'Chave de Acesso', sqlExpr: 'd.chave_acesso', type: 'string', group: 'Documento' },
      tipo_doc: { key: 'tipo_doc', label: 'Tipo Doc', sqlExpr: 'd.tipo_doc', type: 'badge', group: 'Documento' },
      tipo_operacao: { key: 'tipo_operacao', label: 'Operação (Entrada/Saída)', sqlExpr: 'd.tipo_operacao', type: 'badge', group: 'Documento' },
      numero_serie: { key: 'numero_serie', label: 'Número / Série', sqlExpr: 'd.numero_serie', type: 'string', group: 'Documento' },
      data_emissao: { key: 'data_emissao', label: 'Data de Emissão', sqlExpr: 'd.data_emissao', type: 'date', group: 'Documento' },
      competencia: { key: 'competencia', label: 'Competência', sqlExpr: 'd.competencia', type: 'string', group: 'Documento' },
      valor_total: { key: 'valor_total', label: 'Valor Total (R$)', sqlExpr: 'd.valor_total', type: 'number', group: 'Valores Totais', aggregatable: true },
      base_ibs: { key: 'base_ibs', label: 'Base Total IBS (R$)', sqlExpr: 'd.base_ibs', type: 'number', group: 'Tributação RTC', aggregatable: true },
      valor_ibs: { key: 'valor_ibs', label: 'Valor Total IBS (R$)', sqlExpr: 'd.valor_ibs', type: 'number', group: 'Tributação RTC', aggregatable: true },
      base_cbs: { key: 'base_cbs', label: 'Base Total CBS (R$)', sqlExpr: 'd.base_cbs', type: 'number', group: 'Tributação RTC', aggregatable: true },
      valor_cbs: { key: 'valor_cbs', label: 'Valor Total CBS (R$)', sqlExpr: 'd.valor_cbs', type: 'number', group: 'Tributação RTC', aggregatable: true },
      valor_icms: { key: 'valor_icms', label: 'ICMS (R$)', sqlExpr: 'd.valor_icms', type: 'number', group: 'Tributos Tradicionais', aggregatable: true },
      valor_ipi: { key: 'valor_ipi', label: 'IPI (R$)', sqlExpr: 'd.valor_ipi', type: 'number', group: 'Tributos Tradicionais', aggregatable: true },
      valor_pis: { key: 'valor_pis', label: 'PIS (R$)', sqlExpr: 'd.valor_pis', type: 'number', group: 'Tributos Tradicionais', aggregatable: true },
      valor_cofins: { key: 'valor_cofins', label: 'COFINS (R$)', sqlExpr: 'd.valor_cofins', type: 'number', group: 'Tributos Tradicionais', aggregatable: true },
      valor_iss: { key: 'valor_iss', label: 'ISS (R$)', sqlExpr: 'd.valor_iss', type: 'number', group: 'Retenções', aggregatable: true },
      valor_irrf: { key: 'valor_irrf', label: 'IRRF (R$)', sqlExpr: 'd.valor_irrf', type: 'number', group: 'Retenções', aggregatable: true },
      fornecedor_cnpj: { key: 'fornecedor_cnpj', label: 'CNPJ Emitente', sqlExpr: 'd.fornecedor_cnpj', type: 'string', group: 'Emitente / Fornecedor' },
      fornecedor_razao: { key: 'fornecedor_razao', label: 'Razão Social Emitente', sqlExpr: 'd.fornecedor_razao', type: 'string', group: 'Emitente / Fornecedor' },
      fornecedor_uf: { key: 'fornecedor_uf', label: 'UF Emitente', sqlExpr: 'd.fornecedor_uf', type: 'string', group: 'Emitente / Fornecedor' },
      cliente_cnpj: { key: 'cliente_cnpj', label: 'CNPJ Destinatário', sqlExpr: 'd.cliente_cnpj', type: 'string', group: 'Destinatário / Cliente' },
      cliente_razao: { key: 'cliente_razao', label: 'Razão Social Destinatário', sqlExpr: 'd.cliente_razao', type: 'string', group: 'Destinatário / Cliente' },
      cliente_uf: { key: 'cliente_uf', label: 'UF Destinatário', sqlExpr: 'd.cliente_uf', type: 'string', group: 'Destinatário / Cliente' },
      situacao_doc: { key: 'situacao_doc', label: 'Situação SEFAZ', sqlExpr: 'd.situacao_doc', type: 'badge', group: 'Documento' }
    }
  },
  eventos_transmitidos: {
    id: 'eventos_transmitidos',
    nome: 'Central de Eventos Fiscais & Manifestações',
    descricao: 'Histórico de eventos transmitidos para a SEFAZ (ciência da emissão, confirmação, cancelamento).',
    tabelaBase: 'eventos_transmitidos e',
    colunaTenant: 'e.empresa_id',
    campos: {
      id: { key: 'id', label: 'ID Evento', sqlExpr: 'e.id', type: 'string', group: 'Identificação' },
      chave_acesso: { key: 'chave_acesso', label: 'Chave de Acesso', sqlExpr: 'e.chave_acesso', type: 'string', group: 'Documento' },
      tipo_dfe: { key: 'tipo_dfe', label: 'Tipo DF-e', sqlExpr: 'e.tipo_dfe', type: 'badge', group: 'Evento' },
      codigo_evento: { key: 'codigo_evento', label: 'Código do Evento', sqlExpr: 'e.codigo_evento', type: 'string', group: 'Evento' },
      nome_evento: { key: 'nome_evento', label: 'Nome do Evento', sqlExpr: 'e.nome_evento', type: 'string', group: 'Evento' },
      categoria: { key: 'categoria', label: 'Categoria', sqlExpr: 'e.categoria', type: 'badge', group: 'Evento' },
      status: { key: 'status', label: 'Status', sqlExpr: 'e.status', type: 'badge', group: 'Evento' },
      protocolo_sefaz: { key: 'protocolo_sefaz', label: 'Protocolo SEFAZ', sqlExpr: 'e.protocolo_sefaz', type: 'string', group: 'SEFAZ' },
      codigo_retorno: { key: 'codigo_retorno', label: 'Cód Retorno SEFAZ', sqlExpr: 'e.codigo_retorno', type: 'string', group: 'SEFAZ' },
      motivo_retorno: { key: 'motivo_retorno', label: 'Motivo Retorno', sqlExpr: 'e.motivo_retorno', type: 'string', group: 'SEFAZ' },
      data_hora: { key: 'data_hora', label: 'Data e Hora', sqlExpr: 'e.data_hora', type: 'date', group: 'Data/Hora' }
    }
  },
  apuracao_extrato_cc: {
    id: 'apuracao_extrato_cc',
    nome: 'Apuração Assistida (Conta Corrente Fiscal RTC)',
    descricao: 'Lançamentos detalhados do Conta Corrente Fiscal CGIBS/RTC (débitos, créditos e saldos de apuração).',
    tabelaBase: 'apuracao_extrato_cc c',
    colunaTenant: 'o.empresa_id',
    joinClausula: 'JOIN apuracao_operacoes o ON c.operacao_id = o.id',
    campos: {
      id: { key: 'id', label: 'ID Lançamento', sqlExpr: 'c.id', type: 'string', group: 'Identificação' },
      operacao_id: { key: 'operacao_id', label: 'ID Operação', sqlExpr: 'c.operacao_id', type: 'string', group: 'Identificação' },
      chave_acesso: { key: 'chave_acesso', label: 'Chave da Operação (DF-e)', sqlExpr: 'o.chave_acesso', type: 'string', group: 'Operação' },
      tipo_operacao: { key: 'tipo_operacao', label: 'Tipo de Operação', sqlExpr: 'o.tipo_operacao', type: 'badge', group: 'Operação' },
      mov: { key: 'mov', label: 'Movimentação / Evento', sqlExpr: 'c.mov', type: 'badge', group: 'Operação' },
      dth_lancto: { key: 'dth_lancto', label: 'Data/Hora do Lançamento', sqlExpr: 'c.dth_lancto', type: 'date', group: 'Data/Hora' },
      dth_emissao: { key: 'dth_emissao', label: 'Data de Emissão', sqlExpr: 'o.dth_emissao', type: 'date', group: 'Data/Hora' },
      cnpj_fornecedor: { key: 'cnpj_fornecedor', label: 'CNPJ Fornecedor', sqlExpr: 'o.cnpj_fornecedor', type: 'string', group: 'Participantes' },
      cnpj_adquirente: { key: 'cnpj_adquirente', label: 'CNPJ Adquirente', sqlExpr: 'o.cnpj_adquirente', type: 'string', group: 'Participantes' },
      debito_em_aberto: { key: 'debito_em_aberto', label: 'Débito em Aberto (R$)', sqlExpr: 'c.debito_em_aberto', type: 'number', group: 'Valores CGIBS', aggregatable: true },
      debito_extinto: { key: 'debito_extinto', label: 'Débito Extinto (R$)', sqlExpr: 'c.debito_extinto', type: 'number', group: 'Valores CGIBS', aggregatable: true },
      credito_a_propriar: { key: 'credito_a_propriar', label: 'Crédito a Propriar (R$)', sqlExpr: 'c.credito_a_propriar', type: 'number', group: 'Valores CGIBS', aggregatable: true },
      credito_nao_utilizado: { key: 'credito_nao_utilizado', label: 'Crédito Não Utilizado (R$)', sqlExpr: 'c.credito_nao_utilizado', type: 'number', group: 'Valores CGIBS', aggregatable: true },
      credito_utilizado: { key: 'credito_utilizado', label: 'Crédito Utilizado (R$)', sqlExpr: 'c.credito_utilizado', type: 'number', group: 'Valores CGIBS', aggregatable: true },
      recurso_financeiro_disponivel_para_transferencia: { key: 'recurso_financeiro_disponivel_para_transferencia', label: 'Recurso Disponível p/ Transf. (R$)', sqlExpr: 'c.recurso_financeiro_disponivel_para_transferencia', type: 'number', group: 'Valores CGIBS', aggregatable: true },
      recurso_financeiro_a_transferir: { key: 'recurso_financeiro_a_transferir', label: 'Recurso a Transferir (R$)', sqlExpr: 'c.recurso_financeiro_a_transferir', type: 'number', group: 'Valores CGIBS', aggregatable: true },
      arquivo_origem: { key: 'arquivo_origem', label: 'Arquivo de Origem', sqlExpr: 'c.arquivo_origem', type: 'string', group: 'Metadados' }
    }
  }
};

// ============================================================
// HELPERS DE CONSULTA DINÂMICA SEGURA
// ============================================================

interface QueryMetrica {
  campo: string;
  agregacao: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'count_distinct';
  apelido?: string;
}

interface QueryFiltro {
  campo: string;
  operador: 'eq' | 'neq' | 'contains' | 'starts_with' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in' | 'is_null' | 'is_not_null';
  valor?: any;
  valorFim?: any;
}

interface QueryOrdenacao {
  campo: string;
  direcao: 'asc' | 'desc';
}

interface BuildQueryArgs {
  fonte_dados: string;
  modo?: 'agrupado' | 'detalhado';
  dimensoes?: string[];
  metricas?: QueryMetrica[];
  filtros?: QueryFiltro[];
  ordenacao?: QueryOrdenacao[];
  limite?: number;
  offset?: number;
  activeEmpresaId: string;
}

function buildSafeQuery(args: BuildQueryArgs): {
  dataSql: string;
  params: any[];
  selectColumns: { key: string; label: string; type: string }[];
  numericColumns: string[];
} {
  const source = DATA_SOURCES[args.fonte_dados];
  if (!source) {
    throw new Error(`Fonte de dados '${args.fonte_dados}' inválida ou não suportada.`);
  }

  const modo = args.modo || 'detalhado';
  const dimensoes = (args.dimensoes || []).filter(d => !!source.campos[d]);
  const metricas = (args.metricas || []).filter(m => !!source.campos[m.campo]);
  const filtros = (args.filtros || []).filter(f => !!source.campos[f.campo]);
  const ordenacao = (args.ordenacao || []).filter(o => !!source.campos[o.campo]);

  const selectParts: string[] = [];
  const groupByParts: string[] = [];
  const selectColumns: { key: string; label: string; type: string }[] = [];
  const numericColumns: string[] = [];

  if (modo === 'agrupado' && dimensoes.length > 0) {
    // Modo agrupado: Dimensões + Métricas Agregadas
    for (const d of dimensoes) {
      const field = source.campos[d];
      selectParts.push(`${field.sqlExpr} AS [${d}]`);
      groupByParts.push(field.sqlExpr);
      selectColumns.push({ key: d, label: field.label, type: field.type });
    }

    for (const m of metricas) {
      const field = source.campos[m.campo];
      const alias = m.apelido ? m.apelido.trim() : `${m.agregacao}_${m.campo}`;
      let aggExpr = '';

      switch (m.agregacao) {
        case 'sum':
          aggExpr = `COALESCE(SUM(CAST(${field.sqlExpr} AS REAL)), 0)`;
          break;
        case 'avg':
          aggExpr = `COALESCE(AVG(CAST(${field.sqlExpr} AS REAL)), 0)`;
          break;
        case 'min':
          aggExpr = `MIN(${field.sqlExpr})`;
          break;
        case 'max':
          aggExpr = `MAX(${field.sqlExpr})`;
          break;
        case 'count_distinct':
          aggExpr = `COUNT(DISTINCT ${field.sqlExpr})`;
          break;
        case 'count':
        default:
          aggExpr = `COUNT(${field.sqlExpr})`;
          break;
      }

      selectParts.push(`${aggExpr} AS [${alias}]`);
      selectColumns.push({ key: alias, label: m.apelido || field.label, type: 'number' });
      numericColumns.push(alias);
    }
  } else {
    // Modo detalhado: se dimensões foram informadas, seleciona elas; senão seleciona todos os campos da fonte
    const selectedFieldKeys = dimensoes.length > 0 ? dimensoes : Object.keys(source.campos);

    for (const k of selectedFieldKeys) {
      const field = source.campos[k];
      if (field) {
        selectParts.push(`${field.sqlExpr} AS [${k}]`);
        selectColumns.push({ key: k, label: field.label, type: field.type });
        if (field.type === 'number') {
          numericColumns.push(k);
        }
      }
    }
  }

  // Cláusula WHERE com Isolamento Mandatório por Empresa / Tenant
  const whereClauses: string[] = [`${source.colunaTenant} = ?`];
  const params: any[] = [args.activeEmpresaId];

  // Adiciona filtros validados via Prepared Statement
  for (const f of filtros) {
    const field = source.campos[f.campo];
    if (!field) continue;

    if (f.operador === 'is_null') {
      whereClauses.push(`(${field.sqlExpr} IS NULL OR ${field.sqlExpr} = '')`);
    } else if (f.operador === 'is_not_null') {
      whereClauses.push(`(${field.sqlExpr} IS NOT NULL AND ${field.sqlExpr} != '')`);
    } else if (f.operador === 'between' && f.valor !== undefined && f.valorFim !== undefined) {
      whereClauses.push(`${field.sqlExpr} BETWEEN ? AND ?`);
      params.push(f.valor, f.valorFim);
    } else if (f.operador === 'contains' && f.valor !== undefined && f.valor !== '') {
      whereClauses.push(`${field.sqlExpr} LIKE ?`);
      params.push(`%${f.valor}%`);
    } else if (f.operador === 'starts_with' && f.valor !== undefined && f.valor !== '') {
      whereClauses.push(`${field.sqlExpr} LIKE ?`);
      params.push(`${f.valor}%`);
    } else if (f.operador === 'in' && Array.isArray(f.valor) && f.valor.length > 0) {
      const placeholders = f.valor.map(() => '?').join(', ');
      whereClauses.push(`${field.sqlExpr} IN (${placeholders})`);
      params.push(...f.valor);
    } else if (f.valor !== undefined && f.valor !== '') {
      const opMap: Record<string, string> = {
        eq: '=',
        neq: '!=',
        gt: '>',
        gte: '>=',
        lt: '<',
        lte: '<='
      };
      const op = opMap[f.operador] || '=';
      whereClauses.push(`${field.sqlExpr} ${op} ?`);
      params.push(f.valor);
    }
  }

  // Montagem da instrução SQL
  let sql = `SELECT ${selectParts.join(', ')} FROM ${source.tabelaBase}`;
  if (source.joinClausula) {
    sql += ` ${source.joinClausula}`;
  }
  sql += ` WHERE ${whereClauses.join(' AND ')}`;

  if (groupByParts.length > 0) {
    sql += ` GROUP BY ${groupByParts.join(', ')}`;
  }

  // Ordenação segura
  if (ordenacao.length > 0) {
    const orderClauses = ordenacao.map(o => {
      const dir = o.direcao === 'asc' ? 'ASC' : 'DESC';
      return `[${o.campo}] ${dir}`;
    });
    sql += ` ORDER BY ${orderClauses.join(', ')}`;
  } else if (selectColumns.length > 0) {
    // Ordem padrão: primeira coluna
    sql += ` ORDER BY [${selectColumns[0].key}] ASC`;
  }

  // Limite com proteção contra sobrecarga (Circuit Breaker)
  const maxSafeLimit = Math.min(Number(args.limite) || 1000, 5000);
  sql += ` LIMIT ${maxSafeLimit}`;

  if (args.offset && Number(args.offset) > 0) {
    sql += ` OFFSET ${Number(args.offset)}`;
  }

  return {
    dataSql: sql,
    params,
    selectColumns,
    numericColumns
  };
}

// ============================================================
// ENDPOINTS
// ============================================================

/**
 * GET /api/cockpit/fontes-dados
 * Retorna o catálogo canônico de fontes de dados e campos disponíveis.
 */
router.get('/fontes-dados', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const result = Object.values(DATA_SOURCES).map(ds => ({
    id: ds.id,
    nome: ds.nome,
    descricao: ds.descricao,
    campos: Object.values(ds.campos).map(c => ({
      key: c.key,
      label: c.label,
      type: c.type,
      group: c.group,
      aggregatable: !!c.aggregatable
    }))
  }));

  res.json({
    success: true,
    fontes: result,
    timestamp: getBrasiliaTimestamp()
  });
});

/**
 * GET /api/cockpit/modelos
 * Retorna os modelos visíveis ao usuário logado respeitando o RBAC:
 * - escopo 'pessoal' do próprio usuário
 * - escopo 'empresa' vinculado à empresa ativa
 * - escopo 'global' (visível para todos)
 */
router.get('/modelos', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const userId = req.user?.userId;
    const empresaId = req.user?.empresaAtivaId;

    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado.', code: 'AUTH_REQUIRED' });
    }

    const rows = db.prepare(`
      SELECT 
        id, nome, descricao, categoria, escopo, usuario_id, empresa_id,
        configuracao_json, criado_por_nome, criado_por_email, is_padrao_sistema,
        created_at, updated_at
      FROM relatorios_modelos_dinamicos
      WHERE 
        escopo = 'global'
        OR (escopo = 'empresa' AND empresa_id = ?)
        OR (escopo = 'pessoal' AND usuario_id = ?)
      ORDER BY is_padrao_sistema DESC, escopo ASC, nome ASC
    `).all(empresaId || '', userId) as any[];

    const modelos = rows.map(r => ({
      ...r,
      configuracao: JSON.parse(r.configuracao_json || '{}'),
      podeEditar: r.is_padrao_sistema ? req.user?.perfil === 'admin_master' : (
        r.escopo === 'global' ? req.user?.perfil === 'admin_master' :
        r.escopo === 'empresa' ? (r.usuario_id === userId || ['admin_master', 'contador_gestor'].includes(req.user?.perfil || '')) :
        r.usuario_id === userId || req.user?.perfil === 'admin_master'
      )
    }));

    res.json({
      success: true,
      modelos,
      timestamp: getBrasiliaTimestamp()
    });
  } catch (err: any) {
    console.error('❌ Erro ao listar modelos dinâmicos:', err);
    res.status(500).json({ error: err.message || 'Erro ao listar modelos.', code: 'DB_ERROR' });
  }
});

/**
 * POST /api/cockpit/modelos
 * Cria um novo modelo de relatório salvo.
 * REGRA MANDATÓRIA: Se escopo === 'global', exige req.user.perfil === 'admin_master'.
 */
router.post('/modelos', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const userId = req.user?.userId;
    const userEmail = req.user?.email || '';
    const userPerfil = req.user?.perfil || '';
    const activeEmpresaId = req.user?.empresaAtivaId;

    const {
      nome,
      descricao = '',
      categoria = 'fiscal',
      escopo = 'pessoal',
      configuracao
    } = req.body;

    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      return res.status(400).json({
        error: 'O nome do modelo é obrigatório.',
        code: 'VALIDATION_ERROR'
      });
    }

    if (!configuracao || typeof configuracao !== 'object') {
      return res.status(400).json({
        error: 'A configuração do relatório é obrigatória.',
        code: 'VALIDATION_ERROR'
      });
    }

    const validEscopos = ['pessoal', 'empresa', 'global'];
    if (!validEscopos.includes(escopo)) {
      return res.status(400).json({
        error: "Escopo inválido. Valores aceitos: 'pessoal', 'empresa', 'global'.",
        code: 'VALIDATION_ERROR'
      });
    }

    // ========================================================
    // GOVERNANÇA ESTRITA: ESCOPO GLOBAL EXCLUSIVO ADMIN MASTER
    // ========================================================
    if (escopo === 'global' && userPerfil !== 'admin_master') {
      logAuditAction(
        req,
        'TENTATIVA_CRIAR_MODELO_GLOBAL_NEGADA',
        `Tentativa não autorizada de criar modelo global: ${nome}`,
        'WARN',
        { nome, escopo, perfil: userPerfil }
      );
      return res.status(403).json({
        error: 'Apenas o Administrador Master do Sistema tem autorização para criar ou publicar modelos de relatório com escopo Global.',
        code: 'FORBIDDEN_GLOBAL_SCOPE'
      });
    }

    if (escopo === 'empresa' && !activeEmpresaId) {
      return res.status(400).json({
        error: 'Para salvar um modelo no escopo de Empresa, selecione uma empresa ativa válida.',
        code: 'EMPRESA_REQUIRED'
      });
    }

    const id = `mod-${uuid()}`;
    const criadoPorNome = (req.user as any)?.nome || userEmail.split('@')[0] || 'Usuário';

    db.prepare(`
      INSERT INTO relatorios_modelos_dinamicos (
        id, nome, descricao, categoria, escopo, usuario_id, empresa_id,
        configuracao_json, criado_por_nome, criado_por_email, is_padrao_sistema
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      id,
      nome.trim(),
      descricao.trim(),
      categoria,
      escopo,
      userId,
      escopo === 'empresa' ? activeEmpresaId : (escopo === 'pessoal' ? activeEmpresaId : null),
      JSON.stringify(configuracao),
      criadoPorNome,
      userEmail
    );

    logAuditAction(
      req,
      'CRIAR_MODELO_RELATORIO_DINAMICO',
      `Criação do modelo dinâmico '${nome}' no escopo ${escopo.toUpperCase()}`,
      'INFO',
      { modeloId: id, nome, escopo, categoria }
    );

    res.status(201).json({
      success: true,
      id,
      message: `Modelo '${nome}' salvo com sucesso no escopo ${escopo.toUpperCase()}.`,
      timestamp: getBrasiliaTimestamp()
    });
  } catch (err: any) {
    console.error('❌ Erro ao salvar modelo dinâmico:', err);
    res.status(500).json({ error: err.message || 'Erro ao salvar modelo.', code: 'DB_ERROR' });
  }
});

/**
 * PUT /api/cockpit/modelos/:id
 * Atualiza um modelo existente com checagem de permissões RBAC.
 */
router.put('/modelos/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const userId = req.user?.userId;
    const userPerfil = req.user?.perfil || '';

    const existing = db.prepare(`
      SELECT * FROM relatorios_modelos_dinamicos WHERE id = ?
    `).get(id) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Modelo de relatório não encontrado.', code: 'NOT_FOUND' });
    }

    // Modelos padrão de fábrica só podem ser editados pelo admin_master
    if (existing.is_padrao_sistema && userPerfil !== 'admin_master') {
      return res.status(403).json({
        error: 'Modelos de fábrica pré-configurados só podem ser alterados pelo Administrador Master.',
        code: 'FORBIDDEN_FACTORY_TEMPLATE'
      });
    }

    // Checagem de autoria / governança
    if (existing.escopo === 'global' && userPerfil !== 'admin_master') {
      return res.status(403).json({
        error: 'Apenas o Administrador Master pode editar modelos com escopo Global.',
        code: 'FORBIDDEN_GLOBAL_SCOPE'
      });
    }

    if (existing.escopo === 'pessoal' && existing.usuario_id !== userId && userPerfil !== 'admin_master') {
      return res.status(403).json({
        error: 'Você não tem permissão para alterar este modelo pessoal.',
        code: 'FORBIDDEN_PERSONAL_MODEL'
      });
    }

    const {
      nome,
      descricao,
      categoria,
      escopo,
      configuracao
    } = req.body;

    const novoEscopo = escopo || existing.escopo;
    if (novoEscopo === 'global' && userPerfil !== 'admin_master') {
      return res.status(403).json({
        error: 'Apenas o Administrador Master pode definir escopo Global.',
        code: 'FORBIDDEN_GLOBAL_SCOPE'
      });
    }

    db.prepare(`
      UPDATE relatorios_modelos_dinamicos
      SET 
        nome = COALESCE(?, nome),
        descricao = COALESCE(?, descricao),
        categoria = COALESCE(?, categoria),
        escopo = COALESCE(?, escopo),
        configuracao_json = COALESCE(?, configuracao_json),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      nome ? nome.trim() : null,
      descricao !== undefined ? descricao.trim() : null,
      categoria || null,
      novoEscopo,
      configuracao ? JSON.stringify(configuracao) : null,
      id
    );

    logAuditAction(
      req,
      'ATUALIZAR_MODELO_RELATORIO_DINAMICO',
      `Atualização do modelo dinâmico '${nome || existing.nome}'`,
      'INFO',
      { modeloId: id, nome: nome || existing.nome }
    );

    res.json({
      success: true,
      message: 'Modelo atualizado com sucesso.',
      timestamp: getBrasiliaTimestamp()
    });
  } catch (err: any) {
    console.error('❌ Erro ao atualizar modelo dinâmico:', err);
    res.status(500).json({ error: err.message || 'Erro ao atualizar modelo.', code: 'DB_ERROR' });
  }
});

/**
 * DELETE /api/cockpit/modelos/:id
 * Exclui um modelo com checagem de permissões RBAC.
 */
router.delete('/modelos/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const userId = req.user?.userId;
    const userPerfil = req.user?.perfil || '';

    const existing = db.prepare(`
      SELECT * FROM relatorios_modelos_dinamicos WHERE id = ?
    `).get(id) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Modelo não encontrado.', code: 'NOT_FOUND' });
    }

    if (existing.is_padrao_sistema && userPerfil !== 'admin_master') {
      return res.status(403).json({
        error: 'Modelos de fábrica só podem ser excluídos pelo Administrador Master.',
        code: 'FORBIDDEN_FACTORY_TEMPLATE'
      });
    }

    if (existing.escopo === 'global' && userPerfil !== 'admin_master') {
      return res.status(403).json({
        error: 'Apenas o Administrador Master pode excluir modelos Globais.',
        code: 'FORBIDDEN_GLOBAL_SCOPE'
      });
    }

    if (existing.escopo === 'pessoal' && existing.usuario_id !== userId && userPerfil !== 'admin_master') {
      return res.status(403).json({
        error: 'Você não tem permissão para excluir este modelo pessoal.',
        code: 'FORBIDDEN_PERSONAL_MODEL'
      });
    }

    db.prepare(`DELETE FROM relatorios_modelos_dinamicos WHERE id = ?`).run(id);

    logAuditAction(
      req,
      'EXCLUIR_MODELO_RELATORIO_DINAMICO',
      `Exclusão do modelo dinâmico '${existing.nome}'`,
      'INFO',
      { modeloId: id, nome: existing.nome }
    );

    res.json({
      success: true,
      message: `Modelo '${existing.nome}' excluído com sucesso.`,
      timestamp: getBrasiliaTimestamp()
    });
  } catch (err: any) {
    console.error('❌ Erro ao excluir modelo dinâmico:', err);
    res.status(500).json({ error: err.message || 'Erro ao excluir modelo.', code: 'DB_ERROR' });
  }
});

/**
 * POST /api/cockpit/executar
 * Executa a consulta dinâmica sobre o banco SQLite com proteção de tenant,
 * prepared statements e limite máximo seguro.
 */
router.post('/executar', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const startTime = Date.now();

  try {
    const db = getDatabase();
    const activeEmpresaId = req.user?.empresaAtivaId;

    if (!activeEmpresaId) {
      return res.status(400).json({
        error: 'Nenhuma empresa ativa selecionada na sessão para isolamento multi-tenant.',
        code: 'EMPRESA_REQUIRED'
      });
    }

    const {
      fonte_dados = 'dfe_itens_documentos',
      modo = 'detalhado',
      dimensoes = [],
      metricas = [],
      filtros = [],
      ordenacao = [],
      limite = 1000,
      offset = 0
    } = req.body;

    const { dataSql, params, selectColumns, numericColumns } = buildSafeQuery({
      fonte_dados,
      modo,
      dimensoes,
      metricas,
      filtros,
      ordenacao,
      limite,
      offset,
      activeEmpresaId
    });

    const stmt = db.prepare(dataSql);
    const rows = stmt.all(...params) as any[];

    // Calcular somatório das colunas numéricas para a barra de totais
    const totals: Record<string, number> = {};
    for (const col of numericColumns) {
      totals[col] = rows.reduce((acc, row) => {
        const val = Number(row[col]);
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
    }

    const elapsedMs = Date.now() - startTime;

    res.json({
      success: true,
      rows,
      columns: selectColumns,
      totals,
      totalCount: rows.length,
      executionTimeMs: elapsedMs,
      timestamp: getBrasiliaTimestamp()
    });
  } catch (err: any) {
    console.error('❌ Erro ao executar consulta dinâmica:', err);
    res.status(500).json({
      error: err.message || 'Falha ao processar relatório dinâmico.',
      code: 'QUERY_EXECUTION_ERROR'
    });
  }
});

/**
 * POST /api/cockpit/exportar
 * Executa a consulta e gera arquivo para download (.xlsx ou .json)
 */
router.post('/exportar', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const activeEmpresaId = req.user?.empresaAtivaId;

    if (!activeEmpresaId) {
      return res.status(400).json({
        error: 'Empresa ativa não selecionada.',
        code: 'EMPRESA_REQUIRED'
      });
    }

    const {
      formato = 'xlsx', // 'xlsx' | 'json'
      nomeRelatorio = 'Relatorio_Dinamico_Fiscal',
      fonte_dados = 'dfe_itens_documentos',
      modo = 'detalhado',
      dimensoes = [],
      metricas = [],
      filtros = [],
      ordenacao = [],
      limite = 20000 // limite seguro expandido para exportação
    } = req.body;

    const { dataSql, params, selectColumns } = buildSafeQuery({
      fonte_dados,
      modo,
      dimensoes,
      metricas,
      filtros,
      ordenacao,
      limite: Math.min(Number(limite) || 20000, 20000),
      offset: 0,
      activeEmpresaId
    });

    const stmt = db.prepare(dataSql);
    const rows = stmt.all(...params) as any[];

    const sanitizedBaseName = (nomeRelatorio || 'Relatorio_Dinamico_Fiscal')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestampStr = new Date().toISOString().slice(0, 10);

    if (formato === 'json') {
      const jsonContent = JSON.stringify({
        relatorio: nomeRelatorio,
        fonte_dados,
        gerado_em: getBrasiliaTimestamp(),
        total_registros: rows.length,
        colunas: selectColumns,
        dados: rows
      }, null, 2);

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizedBaseName}_${timestampStr}.json"`);
      return res.send(jsonContent);
    }

    // Exportação em XLSX com mapeamento de rótulos amigáveis
    const mappedRows = rows.map(r => {
      const obj: Record<string, any> = {};
      for (const col of selectColumns) {
        obj[col.label] = r[col.key] ?? '';
      }
      return obj;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(mappedRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Dados Fiscais');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedBaseName}_${timestampStr}.xlsx"`);
    res.send(buffer);
  } catch (err: any) {
    console.error('❌ Erro na exportação do relatório dinâmico:', err);
    res.status(500).json({ error: err.message || 'Falha na exportação.', code: 'EXPORT_ERROR' });
  }
});

export default router;
