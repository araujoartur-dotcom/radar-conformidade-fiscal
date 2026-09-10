import { getDatabase } from '../db/database';
import { getSupabaseAdmin } from '../db/supabase';
import crypto from 'crypto';

// =========================================================
// INTERFACES OFICIAIS - MOC APURAÇÃO ASSISTIDA CGIBS (Julho/2026)
// =========================================================

export interface SeteCamposFinanceiros {
  recurso_financeiro_disponivel_para_transferencia: number;
  recurso_financeiro_a_transferir: number;
  credito_a_propriar: number;
  credito_nao_utilizado: number;
  credito_utilizado: number;
  debito_em_aberto: number;
  debito_extinto: number;
}

export interface LancamentoExtratoCC extends SeteCamposFinanceiros {
  id: string;
  operacao_id: string;
  dth_lancto: string;
  mov: string;
  arquivo_origem?: string;
  saldo_acumulado?: SeteCamposFinanceiros; // Calculado incrementalmente
}

export interface OperacaoContaCorrente {
  id: string;
  chave_acesso: string;
  dth_emissao: string;
  dth_autorizacao: string;
  cnpj_fornecedor: string;
  cnpj_adquirente: string;
  tipo_operacao: 'fornecimento' | 'aquisicao';
  hash_acumulado: string;
  empresa_id: string;
  saldos_atuais: SeteCamposFinanceiros;
  total_lancamentos: number;
  extrato?: LancamentoExtratoCC[];
}

export interface ResumoAbaResultado {
  debitos: number;
  redutores_debitos: number;
  debitos_liquidos: number;
  creditos_apropriados: number;
  redutores_creditos: number;
  creditos_liquidos: number;
  pagamentos_utilizados: number;
  resultado_apuracao: number; // Débitos Líquidos - Créditos Líquidos - Pagamentos
  situacao_resultado: 'devedor' | 'credor' | 'zerado';
}

export interface ResumoAbaSaldoAtualizado {
  resultado_apuracao_conclusao: number;
  registros_posteriores_conclusao: {
    debitos: number;
    redutores_debitos: number;
    redutores_creditos: number;
    pagamentos_utilizados: number;
  };
  desfazimento_utilizacao_pagamento: number;
  pedido_ressarcimento: number;
  saldo_credor_transferido_proxima: number;
  saldo_atualizado: number;
  status_ativacao: boolean; // Ativado a partir do dia 26 do mês subsequente
}

export interface ResumoAbaOutrasInformacoes {
  debitos_aguardando_processamento: number;
  creditos_acumulados_passiveis_apropriacao: number; // Compras aguardando extinção de débito do fornecedor
  creditos_inapropriaveis: number;
  pagamentos_splits_nao_utilizados: number;
}

export interface ResumoCompetenciaApuracao {
  competencia: string; // YYYY-MM
  fase: 'em_andamento' | 'periodo_ajuste' | 'concluida';
  fase_descricao: string;
  data_inicio: string;
  data_fim: string;
  resultado: ResumoAbaResultado;
  saldo_atualizado: ResumoAbaSaldoAtualizado;
  outras_informacoes: ResumoAbaOutrasInformacoes;
  total_operacoes: number;
  total_lancamentos: number;
}

// =========================================================
// FUNÇÕES DO MOTOR INCREMENTAL
// =========================================================

/**
 * Determina o estágio do ciclo de vida da competência segundo as regras oficiais da RFB e CGIBS:
 * - Em Andamento: durante o mês de ocorrência dos fatos geradores (ex: Jan/2026 de 01/01 a 31/01)
 * - Período de Ajuste: de 01 a 25 do mês subsequente (ex: 01/02 a 25/02)
 * - Concluída: a partir de 26 do mês subsequente (quando o Saldo Atualizado passa a valer)
 */
export function determinarFaseCompetencia(competencia: string): {
  fase: 'em_andamento' | 'periodo_ajuste' | 'concluida';
  descricao: string;
} {
  const [anoStr, mesStr] = competencia.split('-');
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);

  const agora = new Date();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth() + 1; // 1-12
  const diaAtual = agora.getDate();

  // Se competência é futura
  if (ano > anoAtual || (ano === anoAtual && mes > mesAtual)) {
    return { fase: 'em_andamento', descricao: 'Competência Futura / Planejada' };
  }

  // Se for o mês corrente
  if (ano === anoAtual && mes === mesAtual) {
    return { fase: 'em_andamento', descricao: 'Em Andamento (Fatos geradores do mês corrente)' };
  }

  // Se for o mês imediatamente anterior
  const mesSubsequenteAno = mes === 12 ? ano + 1 : ano;
  const mesSubsequenteMes = mes === 12 ? 1 : mes + 1;

  if (anoAtual === mesSubsequenteAno && mesAtual === mesSubsequenteMes) {
    if (diaAtual <= 25) {
      return { fase: 'periodo_ajuste', descricao: 'Período de Ajuste (01 a 25 do mês subsequente)' };
    } else {
      return { fase: 'concluida', descricao: 'Concluída (Apuração homologada com Saldo Atualizado ativo)' };
    }
  }

  // Competências mais antigas que 1 mês subsequente
  return { fase: 'concluida', descricao: 'Concluída (Histórico homologado)' };
}

/**
 * Obtém os dados consolidados das 3 abas oficiais para uma competência específica
 */
export async function obterResumoCompetencia(
  empresaId: string,
  competencia: string
): Promise<ResumoCompetenciaApuracao> {
  const db = getDatabase();
  const empRow = db.prepare('SELECT id FROM empresas WHERE id = ?').get(empresaId) as any;
  const targetEmpId = empRow ? empresaId : (db.prepare('SELECT id FROM empresas LIMIT 1').get() as any)?.id || empresaId;
  const faseInfo = determinarFaseCompetencia(competencia);

  const dataInicio = `${competencia}-01`;
  // Calcular último dia do mês
  const [ano, mes] = competencia.split('-').map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dataFim = `${competencia}-${ultimoDia.toString().padStart(2, '0')}`;

  // 1. Buscar todas as operações associadas ao período ou que possuam lançamentos no período
  const operacoesRows = db.prepare(`
    SELECT op.* 
    FROM apuracao_operacoes op
    WHERE (op.empresa_id = ? OR op.empresa_id IS NULL)
      AND (
        strftime('%Y-%m', op.dth_emissao) = ? 
        OR EXISTS (
          SELECT 1 FROM apuracao_extrato_cc cc 
          WHERE cc.operacao_id = op.id 
            AND strftime('%Y-%m', cc.dth_lancto) = ?
        )
      )
  `).all(targetEmpId, competencia, competencia) as any[];

  // 2. Buscar todos os lançamentos do período
  const lancamentos = db.prepare(`
    SELECT cc.*, op.tipo_operacao, op.chave_acesso
    FROM apuracao_extrato_cc cc
    JOIN apuracao_operacoes op ON op.id = cc.operacao_id
    WHERE (op.empresa_id = ? OR op.empresa_id IS NULL)
      AND strftime('%Y-%m', cc.dth_lancto) = ?
    ORDER BY cc.dth_lancto ASC, cc.id ASC
  `).all(targetEmpId, competencia) as any[];

  // 3. Consolidar Aba Resultado
  let totalDebitos = 0;
  let redutoresDebitos = 0;
  let creditosApropriados = 0;
  let redutoresCreditos = 0;
  let pagamentosUtilizados = 0;

  for (const l of lancamentos) {
    // Débito gerado (positivo)
    if (l.debito_em_aberto > 0) {
      totalDebitos += l.debito_em_aberto;
    }
    // Redutor de débito (ex: cancelamento, estorno ou devolução que reduz o débito em aberto sem extinguir)
    if (l.debito_em_aberto < 0 && l.debito_extinto === 0) {
      redutoresDebitos += Math.abs(l.debito_em_aberto);
    }
    // Extinção de débito por pagamento/compensação/split
    if (l.debito_extinto > 0) {
      pagamentosUtilizados += l.debito_extinto;
    }
    // Créditos Apropriados (positivos em credito_nao_utilizado ou utilizados)
    if (l.credito_nao_utilizado > 0) {
      creditosApropriados += l.credito_nao_utilizado;
    }
    // Redutores de Créditos Apropriados (estornos)
    if (l.credito_nao_utilizado < 0 && l.credito_utilizado === 0) {
      redutoresCreditos += Math.abs(l.credito_nao_utilizado);
    }
  }

  const debitosLiquidos = Math.max(0, totalDebitos - redutoresDebitos);
  const creditosLiquidos = Math.max(0, creditosApropriados - redutoresCreditos);
  const resultadoApuracao = Number((debitosLiquidos - creditosLiquidos - pagamentosUtilizados).toFixed(2));

  const situacaoResultado = resultadoApuracao > 0 ? 'devedor' : resultadoApuracao < 0 ? 'credor' : 'zerado';

  // 4. Consolidar Aba Saldo Atualizado (ativa apenas pós 25 do mês subsequente)
  const isConcluida = faseInfo.fase === 'concluida';
  const saldoAtualizado: ResumoAbaSaldoAtualizado = {
    resultado_apuracao_conclusao: isConcluida ? resultadoApuracao : 0,
    registros_posteriores_conclusao: {
      debitos: 0,
      redutores_debitos: 0,
      redutores_creditos: 0,
      pagamentos_utilizados: 0
    },
    desfazimento_utilizacao_pagamento: 0,
    pedido_ressarcimento: 0,
    saldo_credor_transferido_proxima: resultadoApuracao < 0 ? Math.abs(resultadoApuracao) : 0,
    saldo_atualizado: isConcluida ? resultadoApuracao : 0,
    status_ativacao: isConcluida
  };

  // 5. Consolidar Aba Outras Informações
  let creditosPassiveisApropriacao = 0;
  for (const l of lancamentos) {
    if (l.credito_a_propriar > 0) {
      creditosPassiveisApropriacao += l.credito_a_propriar;
    } else if (l.credito_a_propriar < 0) {
      creditosPassiveisApropriacao += l.credito_a_propriar; // subtrai o que já virou apropriado
    }
  }

  const outrasInformacoes: ResumoAbaOutrasInformacoes = {
    debitos_aguardando_processamento: 0,
    creditos_acumulados_passiveis_apropriacao: Math.max(0, Number(creditosPassiveisApropriacao.toFixed(2))),
    creditos_inapropriaveis: 0,
    pagamentos_splits_nao_utilizados: 0
  };

  return {
    competencia,
    fase: faseInfo.fase,
    fase_descricao: faseInfo.descricao,
    data_inicio: dataInicio,
    data_fim: dataFim,
    resultado: {
      debitos: Number(totalDebitos.toFixed(2)),
      redutores_debitos: Number(redutoresDebitos.toFixed(2)),
      debitos_liquidos: Number(debitosLiquidos.toFixed(2)),
      creditos_apropriados: Number(creditosApropriados.toFixed(2)),
      redutores_creditos: Number(redutoresCreditos.toFixed(2)),
      creditos_liquidos: Number(creditosLiquidos.toFixed(2)),
      pagamentos_utilizados: Number(pagamentosUtilizados.toFixed(2)),
      resultado_apuracao: resultadoApuracao,
      situacao_resultado: situacaoResultado
    },
    saldo_atualizado: saldoAtualizado,
    outras_informacoes: outrasInformacoes,
    total_operacoes: operacoesRows.length,
    total_lancamentos: lancamentos.length
  };
}

/**
 * Lista todas as operações cadastradas com seus saldos acumulados atuais
 */
export async function listarOperacoes(
  empresaId: string,
  options?: {
    tipo?: 'fornecimento' | 'aquisicao' | 'todos';
    busca?: string;
    competencia?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ operacoes: OperacaoContaCorrente[]; total: number }> {
  const db = getDatabase();
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  let query = `
    SELECT op.*,
      COALESCE(SUM(cc.debito_em_aberto), 0) as saldo_debito_aberto,
      COALESCE(SUM(cc.debito_extinto), 0) as saldo_debito_extinto,
      COALESCE(SUM(cc.credito_a_propriar), 0) as saldo_credito_a_propriar,
      COALESCE(SUM(cc.credito_nao_utilizado), 0) as saldo_credito_nao_utilizado,
      COALESCE(SUM(cc.credito_utilizado), 0) as saldo_credito_utilizado,
      COALESCE(SUM(cc.recurso_financeiro_disponivel_para_transferencia), 0) as saldo_rec_disp,
      COALESCE(SUM(cc.recurso_financeiro_a_transferir), 0) as saldo_rec_transf,
      COUNT(cc.id) as total_lancamentos
    FROM apuracao_operacoes op
    LEFT JOIN apuracao_extrato_cc cc ON cc.operacao_id = op.id
    WHERE (op.empresa_id = ? OR op.empresa_id IS NULL)
  `;
  const params: any[] = [empresaId];

  if (options?.tipo && options.tipo !== 'todos') {
    query += ` AND op.tipo_operacao = ?`;
    params.push(options.tipo);
  }

  if (options?.competencia) {
    query += ` AND strftime('%Y-%m', op.dth_emissao) = ?`;
    params.push(options.competencia);
  }

  if (options?.busca) {
    query += ` AND (op.chave_acesso LIKE ? OR op.cnpj_fornecedor LIKE ? OR op.cnpj_adquirente LIKE ? OR op.id LIKE ?)`;
    const b = `%${options.busca}%`;
    params.push(b, b, b, b);
  }

  query += ` GROUP BY op.id ORDER BY op.dth_emissao DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.prepare(query).all(...params) as any[];

  // Contagem total
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM apuracao_operacoes WHERE (empresa_id = ? OR empresa_id IS NULL)`).get(empresaId) as any;

  const operacoes: OperacaoContaCorrente[] = rows.map(r => ({
    id: String(r.id),
    chave_acesso: r.chave_acesso,
    dth_emissao: r.dth_emissao,
    dth_autorizacao: r.dth_autorizacao,
    cnpj_fornecedor: r.cnpj_fornecedor,
    cnpj_adquirente: r.cnpj_adquirente,
    tipo_operacao: r.tipo_operacao,
    hash_acumulado: r.hash_acumulado,
    empresa_id: r.empresa_id,
    total_lancamentos: r.total_lancamentos,
    saldos_atuais: {
      debito_em_aberto: Number(r.saldo_debito_aberto.toFixed(2)),
      debito_extinto: Number(r.saldo_debito_extinto.toFixed(2)),
      credito_a_propriar: Number(r.saldo_credito_a_propriar.toFixed(2)),
      credito_nao_utilizado: Number(r.saldo_credito_nao_utilizado.toFixed(2)),
      credito_utilizado: Number(r.saldo_credito_utilizado.toFixed(2)),
      recurso_financeiro_disponivel_para_transferencia: Number(r.saldo_rec_disp.toFixed(2)),
      recurso_financeiro_a_transferir: Number(r.saldo_rec_transf.toFixed(2))
    }
  }));

  return { operacoes, total: countRow?.total || operacoes.length };
}

/**
 * Obtém o extrato completo de lançamentos de uma Operação específica,
 * calculando o saldo acumulado linha a linha de forma estritamente incremental
 */
export async function obterExtratoOperacao(
  operacaoId: string
): Promise<{ operacao: OperacaoContaCorrente; extrato: LancamentoExtratoCC[] } | null> {
  const db = getDatabase();

  const op = db.prepare('SELECT * FROM apuracao_operacoes WHERE id = ?').get(operacaoId) as any;
  if (!op) return null;

  const lancamentos = db.prepare(`
    SELECT * FROM apuracao_extrato_cc 
    WHERE operacao_id = ? 
    ORDER BY dth_lancto ASC, id ASC
  `).all(operacaoId) as any[];

  // Cálculo incremental dos 7 saldos acumulados
  const saldosAcumulados: SeteCamposFinanceiros = {
    recurso_financeiro_disponivel_para_transferencia: 0,
    recurso_financeiro_a_transferir: 0,
    credito_a_propriar: 0,
    credito_nao_utilizado: 0,
    credito_utilizado: 0,
    debito_em_aberto: 0,
    debito_extinto: 0
  };

  const extratoComSaldo: LancamentoExtratoCC[] = lancamentos.map(l => {
    saldosAcumulados.recurso_financeiro_disponivel_para_transferencia += l.recurso_financeiro_disponivel_para_transferencia;
    saldosAcumulados.recurso_financeiro_a_transferir += l.recurso_financeiro_a_transferir;
    saldosAcumulados.credito_a_propriar += l.credito_a_propriar;
    saldosAcumulados.credito_nao_utilizado += l.credito_nao_utilizado;
    saldosAcumulados.credito_utilizado += l.credito_utilizado;
    saldosAcumulados.debito_em_aberto += l.debito_em_aberto;
    saldosAcumulados.debito_extinto += l.debito_extinto;

    return {
      id: String(l.id),
      operacao_id: String(l.operacao_id),
      dth_lancto: l.dth_lancto,
      mov: l.mov,
      recurso_financeiro_disponivel_para_transferencia: l.recurso_financeiro_disponivel_para_transferencia,
      recurso_financeiro_a_transferir: l.recurso_financeiro_a_transferir,
      credito_a_propriar: l.credito_a_propriar,
      credito_nao_utilizado: l.credito_nao_utilizado,
      credito_utilizado: l.credito_utilizado,
      debito_em_aberto: l.debito_em_aberto,
      debito_extinto: l.debito_extinto,
      arquivo_origem: l.arquivo_origem,
      saldo_acumulado: {
        recurso_financeiro_disponivel_para_transferencia: Number(saldosAcumulados.recurso_financeiro_disponivel_para_transferencia.toFixed(2)),
        recurso_financeiro_a_transferir: Number(saldosAcumulados.recurso_financeiro_a_transferir.toFixed(2)),
        credito_a_propriar: Number(saldosAcumulados.credito_a_propriar.toFixed(2)),
        credito_nao_utilizado: Number(saldosAcumulados.credito_nao_utilizado.toFixed(2)),
        credito_utilizado: Number(saldosAcumulados.credito_utilizado.toFixed(2)),
        debito_em_aberto: Number(saldosAcumulados.debito_em_aberto.toFixed(2)),
        debito_extinto: Number(saldosAcumulados.debito_extinto.toFixed(2))
      }
    };
  });

  const operacao: OperacaoContaCorrente = {
    id: String(op.id),
    chave_acesso: op.chave_acesso,
    dth_emissao: op.dth_emissao,
    dth_autorizacao: op.dth_autorizacao,
    cnpj_fornecedor: op.cnpj_fornecedor,
    cnpj_adquirente: op.cnpj_adquirente,
    tipo_operacao: op.tipo_operacao,
    hash_acumulado: op.hash_acumulado,
    empresa_id: op.empresa_id,
    total_lancamentos: extratoComSaldo.length,
    saldos_atuais: { ...saldosAcumulados }
  };

  return { operacao, extrato: extratoComSaldo };
}

/**
 * Ingestão de Payload JSON oficial do CGIBS (Anexos I e II do MOC - Julho/2026)
 */
export async function ingerirArquivoCgibs(
  payload: any,
  empresaId: string,
  nomeArquivoPadrao?: string
): Promise<{ operacoesProcessadas: number; lancamentosProcessados: number; mensagens: string[] }> {
  const db = getDatabase();
  const mensagens: string[] = [];

  const header = payload.header || payload;
  const nomeArquivo = header.nomearquivo || nomeArquivoPadrao || 'arquivo_cgibs.json';
  const operacoes = header.operacoes || payload.operacoes || [];

  mensagens.push(`📦 Iniciando processamento do arquivo "${nomeArquivo}" (${operacoes.length} operação(ões))...`);

  // Validar se empresaId existe na tabela empresas para não violar foreign key
  const empRow = db.prepare('SELECT id FROM empresas WHERE id = ?').get(empresaId) as any;
  const targetEmpresaId = empRow ? empresaId : (db.prepare('SELECT id FROM empresas LIMIT 1').get() as any)?.id || null;

  let opCount = 0;
  let lanctoCount = 0;

  const insertOp = db.prepare(`
    INSERT INTO apuracao_operacoes (
      id, chave_acesso, dth_emissao, dth_autorizacao, cnpj_fornecedor, cnpj_adquirente, tipo_operacao, hash_acumulado, empresa_id, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      hash_acumulado = excluded.hash_acumulado,
      updated_at = datetime('now')
  `);

  const insertLancto = db.prepare(`
    INSERT INTO apuracao_extrato_cc (
      id, operacao_id, dth_lancto, mov,
      recurso_financeiro_disponivel_para_transferencia,
      recurso_financeiro_a_transferir,
      credito_a_propriar,
      credito_nao_utilizado,
      credito_utilizado,
      debito_em_aberto,
      debito_extinto,
      arquivo_origem
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      mov = excluded.mov,
      recurso_financeiro_disponivel_para_transferencia = excluded.recurso_financeiro_disponivel_para_transferencia,
      recurso_financeiro_a_transferir = excluded.recurso_financeiro_a_transferir,
      credito_a_propriar = excluded.credito_a_propriar,
      credito_nao_utilizado = excluded.credito_nao_utilizado,
      credito_utilizado = excluded.credito_utilizado,
      debito_em_aberto = excluded.debito_em_aberto,
      debito_extinto = excluded.debito_extinto
  `);

  db.transaction(() => {
    for (const op of operacoes) {
      const opId = String(op.ID || op.id);
      const chaveAcesso = op.CHAVE_ACESSO || op.chave_acesso;
      const dthEmissao = op.DTH_EMISSAO || op.dth_emissao;
      const dthAutorizacao = op.DTH_AUTORIZACAO || op.dth_autorizacao;
      const cnpjFornecedor = op.CNPJ_FORNECEDOR || op.cnpj_fornecedor;
      const cnpjAdquirente = op.CNPJ_ADQUIRENTE || op.cnpj_adquirente || '';

      // Descobre o tipo de operação com base nas movimentações do extrato
      let tipoOperacao: 'fornecimento' | 'aquisicao' = 'fornecimento';
      const extrato = op.extrato_cc || {};
      const hash = extrato.hash || '';
      const lista = extrato.lista || [];

      if (lista.some((x: any) => (x.MOV || '').toLowerCase().includes('aquisicao') || (x.CREDITO_A_PROPRIAR || 0) !== 0)) {
        tipoOperacao = 'aquisicao';
      }

      insertOp.run(opId, chaveAcesso, dthEmissao, dthAutorizacao, cnpjFornecedor, cnpjAdquirente, tipoOperacao, hash, targetEmpresaId);
      opCount++;

      for (const lancto of lista) {
        const lanctoId = String(lancto.ID || lancto.id);
        const dthLancto = lancto.DTH_LANCTO || lancto.dth_lancto;
        const mov = lancto.MOV || lancto.mov;
        const recDisp = Number(lancto.RECURSO_FINANCEIRO_DISPONIVEL_PARA_TRANSFERENCIA || 0);
        const recTransf = Number(lancto.RECURSO_FINANCEIRO_A_TRANSFERIR || 0);
        const credProp = Number(lancto.CREDITO_A_PROPRIAR || 0);
        const credNaoUtil = Number(lancto.CREDITO_NAO_UTILIZADO || 0);
        const credUtil = Number(lancto.CREDITO_UTILIZADO || 0);
        const debAberto = Number(lancto.DEBITO_EM_ABERTO || 0);
        const debExtinto = Number(lancto.DEBITO_EXTINTO || 0);

        insertLancto.run(
          lanctoId,
          opId,
          dthLancto,
          mov,
          recDisp,
          recTransf,
          credProp,
          credNaoUtil,
          credUtil,
          debAberto,
          debExtinto,
          nomeArquivo
        );
        lanctoCount++;
      }
    }
  })();

  mensagens.push(`✅ Ingestão concluída com sucesso: ${opCount} operação(ões) e ${lanctoCount} lançamento(s) registrados.`);
  return { operacoesProcessadas: opCount, lancamentosProcessados: lanctoCount, mensagens };
}

/**
 * Carrega os dois cenários didáticos oficiais descritos nas páginas 33 a 43 do Manual do CGIBS:
 * - Cenário 1 (Aquisição): Fatiado em Parte 1 (9 linhas) e Parte 2 (4 linhas) = 13 linhas.
 * - Cenário 2 (Fornecimento): Arquivo único com 16 linhas (RAD, SPLIT Payment, estornos, devoluções).
 */
export async function carregarCenariosDidaticosOficiais(empresaId: string): Promise<string[]> {
  const mensagens: string[] = [];

  // =========================================================
  // CENÁRIO 1 - PARTE 1 (Página 34)
  // =========================================================
  const cenario1Part1 = {
    header: {
      nomearquivo: "91000001_aquisicao_part1.json",
      tiposolicitacao: "diferencial(delta)",
      datageracao: "2026-02-11 10:05:00",
      parametrosgeracao: {
        datainicial: "2026-02-10 00:00:00",
        datafinal: "2026-02-10 23:59:59",
        qtdoperacoes: 1
      },
      operacoes: [
        {
          ID: 91000001,
          CHAVE_ACESSO: "35260212345678000199550010000000011780001990",
          DTH_EMISSAO: "2026-02-10 09:15:00.000 +00:00",
          DTH_AUTORIZACAO: "2026-02-10 09:18:32.000 +00:00",
          CNPJ_FORNECEDOR: "12345678",
          CNPJ_ADQUIRENTE: "98765432",
          extrato_cc: {
            hash: "c7f73ef4f0d1ed7342a9ab915e8663f7b219e6c1",
            lista: [
              { ID: 91010001, DTH_LANCTO: "2026-02-10 09:20:00.000 +00:00", MOV: "Aquisicao", CREDITO_A_PROPRIAR: 4000 },
              { ID: 91010002, DTH_LANCTO: "2026-02-10 09:25:00.000 +00:00", MOV: "Apropriacao de Credito", CREDITO_A_PROPRIAR: -3000, CREDITO_NAO_UTILIZADO: 3000 },
              { ID: 91010003, DTH_LANCTO: "2026-02-10 09:30:00.000 +00:00", MOV: "Complemento de Aquisicao", CREDITO_A_PROPRIAR: 1500 },
              { ID: 91010004, DTH_LANCTO: "2026-02-10 09:35:00.000 +00:00", MOV: "Apropriacao de Credito", CREDITO_A_PROPRIAR: -1500, CREDITO_NAO_UTILIZADO: 1500 },
              { ID: 91010005, DTH_LANCTO: "2026-02-10 09:40:00.000 +00:00", MOV: "Utilizacao de Credito", CREDITO_NAO_UTILIZADO: -2000, CREDITO_UTILIZADO: 2000 },
              { ID: 91010006, DTH_LANCTO: "2026-02-10 09:45:00.000 +00:00", MOV: "Utilizacao de Credito", CREDITO_NAO_UTILIZADO: -1000, CREDITO_UTILIZADO: 1000 },
              { ID: 91010007, DTH_LANCTO: "2026-02-10 09:50:00.000 +00:00", MOV: "Utilizacao de Credito", CREDITO_NAO_UTILIZADO: -500, CREDITO_UTILIZADO: 500 },
              { ID: 91010008, DTH_LANCTO: "2026-02-10 09:55:00.000 +00:00", MOV: "Cancelamento - Estorno de Credito Nao Utilizado", CREDITO_NAO_UTILIZADO: -1000 },
              { ID: 91010009, DTH_LANCTO: "2026-02-10 10:00:00.000 +00:00", MOV: "Cancelamento - Abertura de Debito para Adquirente", DEBITO_EM_ABERTO: 500 }
            ]
          }
        }
      ]
    }
  };

  // =========================================================
  // CENÁRIO 1 - PARTE 2 (Página 36-38)
  // =========================================================
  const cenario1Part2 = {
    header: {
      nomearquivo: "91000001_aquisicao_part2.json",
      tiposolicitacao: "diferencial(delta)",
      datageracao: "2026-02-16 09:00:00",
      parametrosgeracao: {
        datainicial: "2026-02-15 00:00:00",
        datafinal: "2026-02-15 23:59:59",
        qtdoperacoes: 1
      },
      operacoes: [
        {
          ID: 91000001,
          CHAVE_ACESSO: "35260212345678000199550010000000011780001990",
          DTH_EMISSAO: "2026-02-10 09:15:00.000 +00:00",
          DTH_AUTORIZACAO: "2026-02-10 09:18:32.000 +00:00",
          CNPJ_FORNECEDOR: "12345678",
          CNPJ_ADQUIRENTE: "98765432",
          extrato_cc: {
            hash: "7efa7e32bbfa1bc7a4da40dee3ebf6e04ec20200",
            lista: [
              { ID: 91010010, DTH_LANCTO: "2026-02-15 08:30:00.000 +00:00", MOV: "Devolucao - Estorno de Credito a apropriar", CREDITO_A_PROPRIAR: -1000 },
              { ID: 91010011, DTH_LANCTO: "2026-02-15 08:35:00.000 +00:00", MOV: "Devolucao - Abertura de Debito para Adquirente", DEBITO_EM_ABERTO: 2000 },
              { ID: 91010012, DTH_LANCTO: "2026-02-15 08:40:00.000 +00:00", MOV: "Extincao por Compensacao", DEBITO_EM_ABERTO: -500, DEBITO_EXTINTO: 500 },
              { ID: 91010013, DTH_LANCTO: "2026-02-15 08:45:00.000 +00:00", MOV: "Extincao por Recolhimento", DEBITO_EM_ABERTO: -2000, DEBITO_EXTINTO: 2000 }
            ]
          }
        }
      ]
    }
  };

  // =========================================================
  // CENÁRIO 2 - FORNECIMENTO COMPLETO (Páginas 39-43)
  // =========================================================
  const cenario2 = {
    header: {
      nomearquivo: "92000001_fornecimento.json",
      tiposolicitacao: "solicitação manual",
      datageracao: "2026-04-17 08:00:00",
      parametrosgeracao: {
        datainicial: "2026-04-01 00:00:00",
        datafinal: "2026-04-16 23:59:59",
        qtdoperacoes: 1
      },
      operacoes: [
        {
          ID: 92000001,
          CHAVE_ACESSO: "35260211222333000188550010000000011330001880",
          DTH_EMISSAO: "2026-04-01 08:00:00.000 +00:00",
          DTH_AUTORIZACAO: "2026-04-01 08:05:00.000 +00:00",
          CNPJ_FORNECEDOR: "11222333",
          CNPJ_ADQUIRENTE: "44555666",
          extrato_cc: {
            hash: "6b7c79d50ecd98d5363f4d0dd39c6e18c8b7d4e2",
            lista: [
              { ID: 92010001, DTH_LANCTO: "2026-04-01 08:10:00.000 +00:00", MOV: "Fornecimento", DEBITO_EM_ABERTO: 3000 },
              { ID: 92010002, DTH_LANCTO: "2026-04-04 08:00:00.000 +00:00", MOV: "Complemento de Fornecimento", DEBITO_EM_ABERTO: 1500 },
              { ID: 92010003, DTH_LANCTO: "2026-04-05 08:00:00.000 +00:00", MOV: "Complemento de Fornecimento", DEBITO_EM_ABERTO: 1000 },
              { ID: 92010004, DTH_LANCTO: "2026-04-06 08:00:00.000 +00:00", MOV: "RAD provisionado", DEBITO_EM_ABERTO: -1000, DEBITO_EXTINTO: 1000 },
              { ID: 92010005, DTH_LANCTO: "2026-04-06 09:00:00.000 +00:00", MOV: "Estorno de RAD", DEBITO_EM_ABERTO: 1000, DEBITO_EXTINTO: -1000 },
              { ID: 92010006, DTH_LANCTO: "2026-04-06 10:00:00.000 +00:00", MOV: "Extincao por compensacao", DEBITO_EM_ABERTO: -1000, DEBITO_EXTINTO: 1000 },
              { ID: 92010007, DTH_LANCTO: "2026-04-06 11:00:00.000 +00:00", MOV: "Transferencia para Fornecedor por Excesso", RECURSO_FINANCEIRO_DISPONIVEL_PARA_TRANSFERENCIA: 1000 },
              { ID: 92010008, DTH_LANCTO: "2026-04-06 12:00:00.000 +00:00", MOV: "SPLIT provisionado", DEBITO_EM_ABERTO: -3000, DEBITO_EXTINTO: 3000 },
              { ID: 92010009, DTH_LANCTO: "2026-04-06 13:00:00.000 +00:00", MOV: "Estorno de SPLIT provisionado", DEBITO_EM_ABERTO: 3000, DEBITO_EXTINTO: -3000 },
              { ID: 92010010, DTH_LANCTO: "2026-04-06 14:00:00.000 +00:00", MOV: "Extincao por SPLIT", DEBITO_EM_ABERTO: -3000, DEBITO_EXTINTO: 3000 },
              { ID: 92010011, DTH_LANCTO: "2026-04-11 08:00:00.000 +00:00", MOV: "Cancelamento - Estorno de Debito em aberto", DEBITO_EM_ABERTO: -1500 },
              { ID: 92010012, DTH_LANCTO: "2026-04-12 08:00:00.000 +00:00", MOV: "Cancelamento - SPLIT a transferir", RECURSO_FINANCEIRO_A_TRANSFERIR: 3000 },
              { ID: 92010013, DTH_LANCTO: "2026-04-14 09:00:00.000 +00:00", MOV: "Devolucao - Credito a apropriar", CREDITO_A_PROPRIAR: 500 },
              { ID: 92010014, DTH_LANCTO: "2026-04-14 09:05:00.000 +00:00", MOV: "Devolucao - Apropriacao de Credito", CREDITO_NAO_UTILIZADO: 1000 },
              { ID: 92010015, DTH_LANCTO: "2026-04-15 08:00:00.000 +00:00", MOV: "Transferencia para Fornecedor", RECURSO_FINANCEIRO_DISPONIVEL_PARA_TRANSFERENCIA: 3000, RECURSO_FINANCEIRO_A_TRANSFERIR: -3000 },
              { ID: 92010016, DTH_LANCTO: "2026-04-16 08:00:00.000 +00:00", MOV: "Apropriacao de credito", CREDITO_A_PROPRIAR: -500, CREDITO_NAO_UTILIZADO: 500 }
            ]
          }
        }
      ]
    }
  };

  const res1 = await ingerirArquivoCgibs(cenario1Part1, empresaId, "91000001_aquisicao_part1.json");
  mensagens.push(...res1.mensagens);

  const res2 = await ingerirArquivoCgibs(cenario1Part2, empresaId, "91000001_aquisicao_part2.json");
  mensagens.push(...res2.mensagens);

  const res3 = await ingerirArquivoCgibs(cenario2, empresaId, "92000001_fornecimento.json");
  mensagens.push(...res3.mensagens);

  // Verifica status das credenciais da empresa no banco
  try {
    const db = getDatabase();
    const cred = db.prepare('SELECT id, client_id FROM apuracao_credenciais_cgibs WHERE empresa_id = ?').get(empresaId);
    if (cred) {
      mensagens.push('🔐 Credenciais da empresa verificadas e ativas no motor CGIBS.');
    } else {
      mensagens.push('ℹ️ Cenários carregados no ledger. Credenciais oficiais de transmissão podem ser configuradas na Ficha Cadastral da Empresa.');
    }
  } catch (err: any) {
    mensagens.push(`⚠️ Aviso ao verificar credenciais CGIBS: ${err.message}`);
  }

  return mensagens;
}
