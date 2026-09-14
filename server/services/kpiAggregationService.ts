/**
 * ============================================================
 * SERVIÇO DE AGREGAÇÃO ESTATÍSTICA & KPIS FISCAIS
 * ============================================================
 * Executa somatórios agregados reais (SUM/COUNT) sem LIMIT,
 * desacoplando 100% os totalizadores da listagem visual.
 * 
 * Fornece:
 *  1. totalGeral: soma de 100% da base acumulada (sem corte de data)
 *  2. totalFiltrado: soma do intervalo de datas e filtros selecionados
 *  3. Base de Cálculo IBS/CBS (<vBC>) de acordo com a EC 132/23
 * ============================================================
 */

import { getDatabase } from '../db/database';
import { isSupabaseConfigured, getSupabaseAdmin } from '../db/supabase';
import { hotCache } from './hotCacheService';

export interface KpiTotals {
  totalDocs: number;
  totalValor: number;
  totalBaseCbs: number;
  totalBaseIbs: number;
  totalCbs: number;
  totalIbs: number;
  totalIbsUf: number;
  totalIbsMun: number;
  totalIvaDual: number;
  nfeCount: number;
  nfceCount: number;
  cteCount: number;
  nfseCount: number;
  nfeValor: number;
  nfceValor: number;
  cteValor: number;
  nfseValor: number;
  totalIcms: number;
  totalPis: number;
  totalCofins: number;
  totalIpi: number;
  totalIrrf: number;
  totalInss: number;
  totalIss: number;

  // ── SIMULADOR DE TRANSIÇÃO (Reforma vs Atual) ──
  totalBaseLiquida: number;      // Base Líquida (vNF - todos tributos atuais reais/inferidos)
  totalRegimeAtual: number;      // Soma de todos os tributos atuais (ICMS + IPI + ISS + PIS + COFINS reais + inferidos)
  totalRegimeReforma: number;    // Total CBS + IBS simulados
  deltaTransicao: number;        // Reforma - Atual
  simplesNacDocsCount: number;   // Docs de emitentes CRT 1 ou 4 (Simples) com tributos inferidos
  cteInferidosCount: number;     // CT-e com PIS/COFINS inferidos
  icmsInferido: number;
  pisInferido: number;
  cofinsInferido: number;
  issInferido: number;
}

export interface KpiAggregateResult {
  totalGeral: KpiTotals;
  totalFiltrado: KpiTotals;
  source: 'hot-cache' | 'sqlite' | 'supabase';
  executionTimeMs: number;
}

export interface KpiFilterOptions {
  empresaId?: string;
  tenantCnpj?: string;
  dataInicio?: string;
  dataFim?: string;
  tipoDoc?: string;
  tipoOperacao?: string;
  isSuperadmin?: boolean;
}

interface ParamInferenciaItem {
  icms: number;
  pis: number;
  cofins: number;
  ipi: number;
  iss: number;
}

interface ParametrosInferenciaConfig {
  sn: ParamInferenciaItem;
  cte: ParamInferenciaItem;
  nfse: ParamInferenciaItem;
  aliqTesteCbs: number;
  aliqTesteIbs: number;
  configuradoSn: boolean;
  configuradoCte: boolean;
  configuradoReforma2026: boolean;
}

function loadParametrosInferencia(): ParametrosInferenciaConfig {
  const result: ParametrosInferenciaConfig = {
    sn: { icms: 0.0, pis: 0.0, cofins: 0.0, ipi: 0.0, iss: 0.0 },
    cte: { icms: 0.0, pis: 0.0, cofins: 0.0, ipi: 0.0, iss: 0.0 },
    nfse: { icms: 0.0, pis: 0.0, cofins: 0.0, ipi: 0.0, iss: 0.0 },
    aliqTesteCbs: 0.0,
    aliqTesteIbs: 0.0,
    configuradoSn: false,
    configuradoCte: false,
    configuradoReforma2026: false
  };

  try {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM parametros_inferencia').all() as any[];
    for (const r of rows) {
      if (r.aplica_simples_nac) {
        result.sn.icms = Number(r.icms_medio) || 0;
        result.sn.pis = Number(r.pis_medio) || 0;
        result.sn.cofins = Number(r.cofins_medio) || 0;
        result.sn.iss = Number(r.iss_medio) || 0;
        result.configuradoSn = true;
      }
      if (r.aplica_cte) {
        result.cte.pis = Number(r.pis_medio) || 0;
        result.cte.cofins = Number(r.cofins_medio) || 0;
        result.configuradoCte = true;
      }
      if (r.aplica_nfse) {
        result.nfse.pis = Number(r.pis_medio) || 0;
        result.nfse.cofins = Number(r.cofins_medio) || 0;
        result.nfse.iss = Number(r.iss_medio) || 0;
      }
    }

    // Carregar alíquotas oficiais da Reforma 2026 da tabela de parâmetros (SEM FALLBACK)
    const tab2026 = db.prepare(`
      SELECT cbs_federal, ibs_estadual, ibs_municipal FROM aliquotas_tabelas
      WHERE inicio_vigencia <= '2026-12-31' AND final_vigencia >= '2026-01-01' AND modalidade = 'ad_valorem'
      LIMIT 1
    `).get() as any;

    if (tab2026) {
      result.aliqTesteCbs = Number(tab2026.cbs_federal) || 0;
      result.aliqTesteIbs = Number(tab2026.ibs_estadual || 0) + Number(tab2026.ibs_municipal || 0);
      result.configuradoReforma2026 = result.aliqTesteCbs > 0 || result.aliqTesteIbs > 0;
    }
  } catch (err: any) {
    console.warn('⚠️ Erro ao carregar parametros_inferencia e aliquotas_tabelas:', err.message);
  }

  return result;
}

function emptyTotals(): KpiTotals {
  return {
    totalDocs: 0,
    totalValor: 0,
    totalBaseCbs: 0,
    totalBaseIbs: 0,
    totalCbs: 0,
    totalIbs: 0,
    totalIbsUf: 0,
    totalIbsMun: 0,
    totalIvaDual: 0,
    nfeCount: 0,
    nfceCount: 0,
    cteCount: 0,
    nfseCount: 0,
    nfeValor: 0,
    nfceValor: 0,
    cteValor: 0,
    nfseValor: 0,
    totalIcms: 0,
    totalPis: 0,
    totalCofins: 0,
    totalIpi: 0,
    totalIrrf: 0,
    totalInss: 0,
    totalIss: 0,

    totalBaseLiquida: 0,
    totalRegimeAtual: 0,
    totalRegimeReforma: 0,
    deltaTransicao: 0,
    simplesNacDocsCount: 0,
    cteInferidosCount: 0,
    icmsInferido: 0,
    pisInferido: 0,
    cofinsInferido: 0,
    issInferido: 0,
  };
}

function accumulateDoc(totals: KpiTotals, doc: any, paramsInf: ParametrosInferenciaConfig) {
  const vTotal = Number(doc.valor_total) || 0;
  totals.totalDocs += 1;
  totals.totalValor += vTotal;

  // CBS Federal e IBS Estadual/Municipal (estritamente do XML)
  const vCbs = Number(doc.valor_cbs) || 0;
  const vIbs = Number(doc.valor_ibs) || 0;
  const vIbsUf = Number(doc.valor_ibs_uf) || 0;
  const vIbsMun = Number(doc.valor_ibs_mun) || 0;
  const totalIbsDoc = vIbs > 0 ? vIbs : (vIbsUf + vIbsMun);

  totals.totalCbs += vCbs;
  totals.totalIbsUf += vIbsUf;
  totals.totalIbsMun += vIbsMun;
  totals.totalIbs += totalIbsDoc;
  totals.totalIvaDual += (vCbs + totalIbsDoc);

  // Base de Cálculo IBS / CBS (<vBC> estritamente constante nos grupos IBS/CBS do XML)
  // Se o campo base_cbs/base_ibs estiver preenchido, usa ele.
  // Caso ausente, utiliza estritamente as alíquotas oficiais de teste cadastradas em Parâmetros (SEM FALLBACK)
  const divisorCbs = paramsInf.aliqTesteCbs > 0 ? (paramsInf.aliqTesteCbs / 100) : 0;
  const divisorIbs = paramsInf.aliqTesteIbs > 0 ? (paramsInf.aliqTesteIbs / 100) : 0;
  const baseCbs = Number(doc.base_cbs) > 0 ? Number(doc.base_cbs) : (vCbs > 0 && divisorCbs > 0 ? Number((vCbs / divisorCbs).toFixed(2)) : 0);
  const baseIbs = Number(doc.base_ibs) > 0 ? Number(doc.base_ibs) : (totalIbsDoc > 0 && divisorIbs > 0 ? Number((totalIbsDoc / divisorIbs).toFixed(2)) : 0);
  totals.totalBaseCbs += baseCbs;
  totals.totalBaseIbs += baseIbs;

  // Modelos de Documento e Valores Segregados
  const tipo = (doc.tipo_doc || '').toString().toUpperCase();
  if (tipo === 'NFE' || tipo === 'NF-E' || tipo === '55') {
    totals.nfeCount += 1;
    totals.nfeValor += vTotal;
  } else if (tipo === 'NFCE' || tipo === 'NFC-E' || tipo === '65') {
    totals.nfceCount += 1;
    totals.nfceValor += vTotal;
  } else if (tipo === 'CTE' || tipo === 'CT-E' || tipo === '57' || tipo === '67') {
    totals.cteCount += 1;
    totals.cteValor += vTotal;
  } else if (tipo === 'NFSE' || tipo === 'NFS-E' || tipo === 'NFS') {
    totals.nfseCount += 1;
    totals.nfseValor += vTotal;
  }

  // Tributos do Regime Atual Destacados no XML
  const icmsReal = Number(doc.valor_icms) || 0;
  const pisReal = Number(doc.valor_pis) || 0;
  const cofinsReal = Number(doc.valor_cofins) || 0;
  const ipiReal = Number(doc.valor_ipi) || 0;
  const irrfReal = Number(doc.valor_irrf) || 0;
  const inssReal = Number(doc.valor_inss) || 0;
  const issReal = Number(doc.valor_iss) || 0;

  totals.totalIcms += icmsReal;
  totals.totalPis += pisReal;
  totals.totalCofins += cofinsReal;
  totals.totalIpi += ipiReal;
  totals.totalIrrf += irrfReal;
  totals.totalInss += inssReal;
  totals.totalIss += issReal;

  // ── SIMULADOR DE TRANSIÇÃO (Reforma vs Atual) ──
  // Identificação de Simples Nacional (CRT 1 ou 4) e CT-e para aplicação de alíquotas médias
  const crt = String(doc.regime_tributario || doc.crt || '').trim();
  const isSimples = crt === '1' || crt === '4';
  const isCte = tipo === 'CTE' || tipo === '57';

  let icmsCalc = icmsReal;
  let pisCalc = pisReal;
  let cofinsCalc = cofinsReal;
  let ipiCalc = ipiReal;
  let issCalc = issReal;

  if (isSimples && icmsReal === 0 && pisReal === 0 && cofinsReal === 0) {
    // Simples Nacional: inferir alíquotas médias configuradas nos Parâmetros (SEM FALLBACK)
    totals.simplesNacDocsCount += 1;
    const icmsInf = paramsInf.configuradoSn ? (vTotal * paramsInf.sn.icms) / 100 : 0;
    const pisInf = paramsInf.configuradoSn ? (vTotal * paramsInf.sn.pis) / 100 : 0;
    const cofinsInf = paramsInf.configuradoSn ? (vTotal * paramsInf.sn.cofins) / 100 : 0;
    const issInf = (tipo === 'NFSE' && paramsInf.configuradoSn) ? (vTotal * paramsInf.sn.iss) / 100 : 0;

    totals.icmsInferido += icmsInf;
    totals.pisInferido += pisInf;
    totals.cofinsInferido += cofinsInf;
    totals.issInferido += issInf;

    icmsCalc = icmsInf;
    pisCalc = pisInf;
    cofinsCalc = cofinsInf;
    issCalc = issInf;
  } else if (isCte && pisReal === 0 && cofinsReal === 0) {
    // CT-e: Não destaca PIS/COFINS. Inferir alíquota média de frete configurada nos Parâmetros (SEM FALLBACK)
    totals.cteInferidosCount += 1;
    const pisInf = paramsInf.configuradoCte ? (vTotal * paramsInf.cte.pis) / 100 : 0;
    const cofinsInf = paramsInf.configuradoCte ? (vTotal * paramsInf.cte.cofins) / 100 : 0;

    totals.pisInferido += pisInf;
    totals.cofinsInferido += cofinsInf;

    pisCalc = pisInf;
    cofinsCalc = cofinsInf;
  }

  const tribTotal = icmsCalc + pisCalc + cofinsCalc + ipiCalc + issCalc;
  const baseLiquida = Math.max(0, vTotal - tribTotal);

  totals.totalBaseLiquida += baseLiquida;
  totals.totalRegimeAtual += tribTotal;

  // CBS e IBS simulados preliminarmente na alíquota oficial cadastrada na tabela de 2026 (SEM FALLBACK)
  const cbsSimulada = paramsInf.aliqTesteCbs > 0 ? (baseLiquida * paramsInf.aliqTesteCbs) / 100 : 0;
  const ibsSimulada = paramsInf.aliqTesteIbs > 0 ? (baseLiquida * paramsInf.aliqTesteIbs) / 100 : 0;
  totals.totalRegimeReforma += (cbsSimulada + ibsSimulada);
  totals.deltaTransicao = totals.totalRegimeReforma - totals.totalRegimeAtual;
}

/**
 * Executa agregação fiscal desacoplada com Total Geral e Total Filtrado
 */
export async function getDecoupledKpiAggregates(filters: KpiFilterOptions): Promise<KpiAggregateResult> {
  const startTime = Date.now();
  const cacheKey = `kpi_aggregates_${filters.empresaId || 'all'}_${filters.tenantCnpj || 'all'}_${filters.dataInicio || 'all'}_${filters.dataFim || 'all'}_${filters.tipoDoc || 'all'}_${filters.tipoOperacao || 'all'}`;

  // 1. Checa Hot Cache em Memória
  const cached = hotCache.getHotData(cacheKey);
  if (cached) {
    return {
      totalGeral: cached.data.totalGeral,
      totalFiltrado: cached.data.totalFiltrado,
      source: 'hot-cache',
      executionTimeMs: Date.now() - startTime,
    };
  }

  const paramsInf = loadParametrosInferencia();

  // 2. Estratégia Supabase (quando configurado)
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        // Primeiro, obtém a contagem exata da base para esta empresa
        let baseCountQuery = supabase.from('dfe_documentos').select('*', { count: 'exact', head: true });
        if (filters.empresaId) {
          baseCountQuery = baseCountQuery.eq('empresa_id', filters.empresaId);
        } else if (filters.tenantCnpj) {
          const cnpjRaiz = filters.tenantCnpj.length >= 8 ? filters.tenantCnpj.slice(0, 8) : filters.tenantCnpj;
          baseCountQuery = baseCountQuery.or(`cliente_cnpj.ilike.%${cnpjRaiz}%,fornecedor_cnpj.ilike.%${cnpjRaiz}%`);
        }
        const { count: totalDocsSupabase, error: countErr } = await baseCountQuery;

        if (!countErr) {
          if (!totalDocsSupabase || totalDocsSupabase === 0) {
            // Empresa ativa não possui documentos ainda cadastrados no Supabase
            const totalGeral = emptyTotals();
            const totalFiltrado = emptyTotals();
            const result: KpiAggregateResult = {
              totalGeral,
              totalFiltrado,
              source: 'supabase',
              executionTimeMs: Date.now() - startTime,
            };
            hotCache.setHotData(cacheKey, { totalGeral, totalFiltrado }, 0);
            return result;
          }

          const CHUNK_SIZE = 1000;
          const numChunks = Math.ceil(totalDocsSupabase / CHUNK_SIZE);
          const chunkPromises: Promise<any>[] = [];

          // Detecta se base_cbs já existe como coluna no Supabase
          let selectFields = 'id, empresa_id, tipo_doc, tipo_operacao, data_emissao, valor_total, valor_icms, valor_pis, valor_cofins, valor_cbs, valor_ibs, valor_is, valor_irrf, valor_inss, valor_iss, base_cbs, base_ibs, regime_tributario, cliente_cnpj, fornecedor_cnpj';
          const { error: testColErr } = await supabase.from('dfe_documentos').select('base_cbs').limit(0);
          if (testColErr) {
            selectFields = 'id, empresa_id, tipo_doc, tipo_operacao, data_emissao, valor_total, valor_icms, valor_pis, valor_cofins, valor_cbs, valor_ibs, valor_is, valor_irrf, valor_inss, valor_iss, cliente_cnpj, fornecedor_cnpj';
          }

          for (let i = 0; i < numChunks; i++) {
            const from = i * CHUNK_SIZE;
            const to = from + CHUNK_SIZE - 1;
            let chunkQuery = supabase
              .from('dfe_documentos')
              .select(selectFields);

            if (filters.empresaId) {
              chunkQuery = chunkQuery.eq('empresa_id', filters.empresaId);
            } else if (filters.tenantCnpj) {
              const cnpjRaiz = filters.tenantCnpj.length >= 8 ? filters.tenantCnpj.slice(0, 8) : filters.tenantCnpj;
              chunkQuery = chunkQuery.or(`cliente_cnpj.ilike.%${cnpjRaiz}%,fornecedor_cnpj.ilike.%${cnpjRaiz}%`);
            }

            chunkQuery = chunkQuery.range(from, to);
            chunkPromises.push(Promise.resolve(chunkQuery));
          }

          const results = await Promise.all(chunkPromises);
          const totalGeral = emptyTotals();
          const totalFiltrado = emptyTotals();

          const dataInicio = filters.dataInicio ? filters.dataInicio.substring(0, 10) : null;
          const dataFim = filters.dataFim ? filters.dataFim.substring(0, 10) : null;
          const tipoDoc = filters.tipoDoc && filters.tipoDoc !== 'TODOS' ? filters.tipoDoc.toUpperCase() : null;

          for (const res of results) {
            if (res.data) {
              for (const doc of res.data) {
                // Sempre acumula no Total Geral
                accumulateDoc(totalGeral, doc, paramsInf);

                // Aplica filtros para o Total Filtrado
                let pass = true;
                const docDate = (doc.data_emissao || '').substring(0, 10);
                if (dataInicio && docDate && docDate < dataInicio) pass = false;
                if (dataFim && docDate && docDate > dataFim) pass = false;
                if (tipoDoc) {
                  const dTipo = (doc.tipo_doc || '').toString().toUpperCase();
                  const isMercadorias = (tipoDoc === 'MERCADORIAS' || tipoDoc === 'CONSOLIDADO_MERCADORIAS') &&
                    (dTipo === 'NFE' || dTipo === 'NF-E' || dTipo === '55' || dTipo === 'CTE' || dTipo === 'CT-E' || dTipo === '57' || dTipo === '67' || dTipo === 'NFCE' || dTipo === 'NFC-E' || dTipo === '65');
                  const isServicos = (tipoDoc === 'SERVICOS' || tipoDoc === 'CONSOLIDADO_SERVICOS' || tipoDoc === 'RETENCOES_FONTE') &&
                    (dTipo === 'NFSE' || dTipo === 'NFS-E' || dTipo === 'NFS');
                  const isNfeMatch = (tipoDoc === 'NFE' || tipoDoc === 'NF-E') && (dTipo === 'NFE' || dTipo === 'NF-E' || dTipo === '55');
                  const isNfceMatch = (tipoDoc === 'NFCE' || tipoDoc === 'NFC-E') && (dTipo === 'NFCE' || dTipo === 'NFC-E' || dTipo === '65');
                  const isCteMatch = (tipoDoc === 'CTE' || tipoDoc === 'CT-E') && (dTipo === 'CTE' || dTipo === 'CT-E' || dTipo === '57' || dTipo === '67');
                  const isNfseMatch = (tipoDoc === 'NFSE' || tipoDoc === 'NFS-E' || tipoDoc === 'NFS') && (dTipo === 'NFSE' || dTipo === 'NFS-E' || dTipo === 'NFS');
                  if (!isMercadorias && !isServicos && !isNfeMatch && !isNfceMatch && !isCteMatch && !isNfseMatch && dTipo !== tipoDoc) {
                    pass = false;
                  }
                }
                if (filters.tipoOperacao && filters.tipoOperacao !== 'TODAS') {
                  const isEntrada = doc.tipo_operacao === 'Entrada';
                  if (filters.tipoOperacao === 'Entradas' && !isEntrada) pass = false;
                  if (filters.tipoOperacao === 'Saídas' && isEntrada) pass = false;
                }

                if (pass) {
                  accumulateDoc(totalFiltrado, doc, paramsInf);
                }
              }
            }
          }

          const result: KpiAggregateResult = {
            totalGeral,
            totalFiltrado,
            source: 'supabase',
            executionTimeMs: Date.now() - startTime,
          };

          // Grava no Hot Cache
          hotCache.setHotData(cacheKey, { totalGeral, totalFiltrado }, totalGeral.totalDocs);
          return result;
        }
      }
    } catch (supaErr: any) {
      console.warn('⚠️ Falha ao agregar via Supabase, usando SQLite:', supaErr?.message || supaErr);
    }
  }

  // 3. Fallback / Estratégia SQLite Local
  const db = getDatabase();
  const totalGeral = emptyTotals();
  const totalFiltrado = emptyTotals();

  try {
    let sql = `
      SELECT 
        id, empresa_id, tipo_doc, tipo_operacao, data_emissao,
        valor_total, valor_icms, valor_pis, valor_cofins, valor_ipi,
        valor_cbs, valor_ibs, valor_is, valor_irrf, valor_inss, valor_iss,
        base_cbs, base_ibs, regime_tributario, cliente_cnpj, fornecedor_cnpj
      FROM dfe_documentos
    `;
    const paramsSql: any[] = [];
    if (filters.empresaId) {
      sql += ' WHERE empresa_id = ?';
      paramsSql.push(filters.empresaId);
    } else if (filters.tenantCnpj) {
      sql += ' WHERE (cliente_cnpj LIKE ? OR fornecedor_cnpj LIKE ?)';
      paramsSql.push(`%${filters.tenantCnpj}%`, `%${filters.tenantCnpj}%`);
    } else if (!filters.isSuperadmin) {
      sql += ' WHERE 1=0';
    }

    const rows = db.prepare(sql).all(...paramsSql) as any[];

    const dataInicio = filters.dataInicio ? filters.dataInicio.substring(0, 10) : null;
    const dataFim = filters.dataFim ? filters.dataFim.substring(0, 10) : null;
    const tipoDoc = filters.tipoDoc && filters.tipoDoc !== 'TODOS' ? filters.tipoDoc.toUpperCase() : null;

    for (const doc of rows) {
      accumulateDoc(totalGeral, doc, paramsInf);

      let pass = true;
      const docDate = (doc.data_emissao || '').substring(0, 10);
      if (dataInicio && docDate && docDate < dataInicio) pass = false;
      if (dataFim && docDate && docDate > dataFim) pass = false;
      if (tipoDoc) {
        const dTipo = (doc.tipo_doc || '').toString().toUpperCase();
        const isMercadorias = (tipoDoc === 'MERCADORIAS' || tipoDoc === 'CONSOLIDADO_MERCADORIAS') &&
          (dTipo === 'NFE' || dTipo === 'NF-E' || dTipo === '55' || dTipo === 'CTE' || dTipo === 'CT-E' || dTipo === '57' || dTipo === '67' || dTipo === 'NFCE' || dTipo === 'NFC-E' || dTipo === '65');
        const isServicos = (tipoDoc === 'SERVICOS' || tipoDoc === 'CONSOLIDADO_SERVICOS' || tipoDoc === 'RETENCOES_FONTE') &&
          (dTipo === 'NFSE' || dTipo === 'NFS-E' || dTipo === 'NFS');
        const isNfeMatch = (tipoDoc === 'NFE' || tipoDoc === 'NF-E') && (dTipo === 'NFE' || dTipo === 'NF-E' || dTipo === '55');
        const isNfceMatch = (tipoDoc === 'NFCE' || tipoDoc === 'NFC-E') && (dTipo === 'NFCE' || dTipo === 'NFC-E' || dTipo === '65');
        const isCteMatch = (tipoDoc === 'CTE' || tipoDoc === 'CT-E') && (dTipo === 'CTE' || dTipo === 'CT-E' || dTipo === '57' || dTipo === '67');
        const isNfseMatch = (tipoDoc === 'NFSE' || tipoDoc === 'NFS-E' || tipoDoc === 'NFS') && (dTipo === 'NFSE' || dTipo === 'NFS-E' || dTipo === 'NFS');
        if (!isMercadorias && !isServicos && !isNfeMatch && !isNfceMatch && !isCteMatch && !isNfseMatch && dTipo !== tipoDoc) {
          pass = false;
        }
      }
      if (filters.tipoOperacao && filters.tipoOperacao !== 'TODAS') {
        const isEntrada = doc.tipo_operacao === 'Entrada';
        if (filters.tipoOperacao === 'Entradas' && !isEntrada) pass = false;
        if (filters.tipoOperacao === 'Saídas' && isEntrada) pass = false;
      }

      if (pass) {
        accumulateDoc(totalFiltrado, doc, paramsInf);
      }
    }
  } catch (sqlErr: any) {
    console.warn('⚠️ Erro ao agregar via SQLite:', sqlErr.message);
  }

  hotCache.setHotData(cacheKey, { totalGeral, totalFiltrado }, totalGeral.totalDocs);

  return {
    totalGeral,
    totalFiltrado,
    source: 'sqlite',
    executionTimeMs: Date.now() - startTime,
  };
}
