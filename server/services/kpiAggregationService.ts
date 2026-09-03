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
  totalIcms: number;
  totalPis: number;
  totalCofins: number;
  totalIpi: number;
  totalIrrf: number;
  totalInss: number;
  totalIss: number;
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
    totalIcms: 0,
    totalPis: 0,
    totalCofins: 0,
    totalIpi: 0,
    totalIrrf: 0,
    totalInss: 0,
    totalIss: 0,
  };
}

function accumulateDoc(totals: KpiTotals, doc: any) {
  const vTotal = Number(doc.valor_total) || 0;
  totals.totalDocs += 1;
  totals.totalValor += vTotal;

  // Base de Cálculo IBS / CBS (<vBC> estritamente constante nos grupos IBS/CBS do XML)
  const baseCbs = Number(doc.base_cbs) || 0;
  const baseIbs = Number(doc.base_ibs) || 0;
  totals.totalBaseCbs += baseCbs;
  totals.totalBaseIbs += baseIbs;

  // CBS Federal (estritamente o que consta no XML)
  const vCbs = Number(doc.valor_cbs) || 0;
  totals.totalCbs += vCbs;

  // IBS Estadual e Municipal (estritamente o que consta no XML)
  const vIbsUf = Number(doc.valor_ibs_uf) || 0;
  const vIbsMun = Number(doc.valor_ibs_mun) || 0;
  const vIbs = Number(doc.valor_ibs) > 0 ? Number(doc.valor_ibs) : (vIbsUf + vIbsMun);
  totals.totalIbsUf += vIbsUf;
  totals.totalIbsMun += vIbsMun;
  totals.totalIbs += vIbs;
  totals.totalIvaDual += (vCbs + vIbs);

  // Modelos de Documento
  const tipo = (doc.tipo_doc || '').toString().toUpperCase();
  if (tipo === 'NFE' || tipo === '55') totals.nfeCount += 1;
  else if (tipo === 'NFCE' || tipo === '65') totals.nfceCount += 1;
  else if (tipo === 'CTE' || tipo === '57') totals.cteCount += 1;
  else if (tipo === 'NFSE') totals.nfseCount += 1;

  // Tributos do Regime Atual
  totals.totalIcms += Number(doc.valor_icms) || 0;
  totals.totalPis += Number(doc.valor_pis) || 0;
  totals.totalCofins += Number(doc.valor_cofins) || 0;
  totals.totalIpi += Number(doc.valor_ipi) || 0;
  totals.totalIrrf += Number(doc.valor_irrf) || 0;
  totals.totalInss += Number(doc.valor_inss) || 0;
  totals.totalIss += Number(doc.valor_iss) || 0;
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

  // 2. Estratégia Supabase (quando configurado)
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        // Primeiro, obtém a contagem exata da base
        let baseCountQuery = supabase.from('dfe_documentos').select('*', { count: 'exact', head: true });
        if (filters.empresaId && !filters.isSuperadmin) {
          baseCountQuery = baseCountQuery.eq('empresa_id', filters.empresaId);
        }
        const { count: totalDocsSupabase, error: countErr } = await baseCountQuery;

        if (!countErr && totalDocsSupabase && totalDocsSupabase > 0) {
          const CHUNK_SIZE = 1000;
          const numChunks = Math.ceil(totalDocsSupabase / CHUNK_SIZE);
          const chunkPromises: Promise<any>[] = [];

          const selectFields = 'id, empresa_id, tipo_doc, tipo_operacao, data_emissao, valor_total, valor_icms, valor_pis, valor_cofins, valor_cbs, valor_ibs, valor_is, valor_irrf, valor_inss, valor_iss, cliente_cnpj, fornecedor_cnpj';

          for (let i = 0; i < numChunks; i++) {
            const from = i * CHUNK_SIZE;
            const to = from + CHUNK_SIZE - 1;
            let chunkQuery = supabase
              .from('dfe_documentos')
              .select(selectFields)
              .range(from, to);

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
                accumulateDoc(totalGeral, doc);

                // Aplica filtros para o Total Filtrado
                let pass = true;
                const docDate = (doc.data_emissao || '').substring(0, 10);
                if (dataInicio && docDate && docDate < dataInicio) pass = false;
                if (dataFim && docDate && docDate > dataFim) pass = false;
                if (tipoDoc) {
                  const dTipo = (doc.tipo_doc || '').toString().toUpperCase();
                  if (dTipo !== tipoDoc && !(tipoDoc === 'NFE' && dTipo === '55') && !(tipoDoc === 'NFCE' && dTipo === '65') && !(tipoDoc === 'CTE' && dTipo === '57')) {
                    pass = false;
                  }
                }
                if (filters.tipoOperacao && filters.tipoOperacao !== 'TODAS') {
                  const isEntrada = doc.tipo_operacao === 'Entrada';
                  if (filters.tipoOperacao === 'Entradas' && !isEntrada) pass = false;
                  if (filters.tipoOperacao === 'Saídas' && isEntrada) pass = false;
                }

                if (pass) {
                  accumulateDoc(totalFiltrado, doc);
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
  const totalGeralRow = db.prepare(`
    SELECT 
      COUNT(*) as totalDocs,
      SUM(CASE WHEN tipo_doc IN ('NFe', '55') THEN 1 ELSE 0 END) as nfeCount,
      SUM(CASE WHEN tipo_doc IN ('NFCe', '65') THEN 1 ELSE 0 END) as nfceCount,
      SUM(CASE WHEN tipo_doc IN ('CTe', '57') THEN 1 ELSE 0 END) as cteCount,
      SUM(CASE WHEN tipo_doc = 'NFSe' THEN 1 ELSE 0 END) as nfseCount,
      COALESCE(SUM(valor_total), 0) as totalValor,
      COALESCE(SUM(base_cbs), 0) as totalBaseCbs,
      COALESCE(SUM(base_ibs), 0) as totalBaseIbs,
      COALESCE(SUM(valor_icms), 0) as totalIcms,
      COALESCE(SUM(valor_pis), 0) as totalPis,
      COALESCE(SUM(valor_cofins), 0) as totalCofins,
      COALESCE(SUM(valor_cbs), 0) as totalCbs,
      COALESCE(SUM(valor_ibs), 0) as totalIbs,
      COALESCE(SUM(valor_is), 0) as totalIs,
      COALESCE(SUM(valor_irrf), 0) as totalIrrf,
      COALESCE(SUM(valor_inss), 0) as totalInss,
      COALESCE(SUM(valor_iss), 0) as totalIss
    FROM dfe_documentos
    ${filters.empresaId && !filters.isSuperadmin ? 'WHERE empresa_id = ?' : ''}
  `).get(...(filters.empresaId && !filters.isSuperadmin ? [filters.empresaId] : [])) as any;

  // Filtrado no SQLite
  let whereFiltrado = 'WHERE 1=1';
  const paramsFiltrado: any[] = [];
  if (filters.empresaId && !filters.isSuperadmin) {
    whereFiltrado += ' AND empresa_id = ?';
    paramsFiltrado.push(filters.empresaId);
  }
  if (filters.dataInicio) {
    whereFiltrado += ' AND data_emissao >= ?';
    paramsFiltrado.push(filters.dataInicio);
  }
  if (filters.dataFim) {
    whereFiltrado += ' AND data_emissao <= ?';
    paramsFiltrado.push(filters.dataFim);
  }
  if (filters.tipoDoc && filters.tipoDoc !== 'TODOS') {
    whereFiltrado += ' AND tipo_doc = ?';
    paramsFiltrado.push(filters.tipoDoc);
  }

  const totalFiltradoRow = db.prepare(`
    SELECT 
      COUNT(*) as totalDocs,
      SUM(CASE WHEN tipo_doc IN ('NFe', '55') THEN 1 ELSE 0 END) as nfeCount,
      SUM(CASE WHEN tipo_doc IN ('NFCe', '65') THEN 1 ELSE 0 END) as nfceCount,
      SUM(CASE WHEN tipo_doc IN ('CTe', '57') THEN 1 ELSE 0 END) as cteCount,
      SUM(CASE WHEN tipo_doc = 'NFSe' THEN 1 ELSE 0 END) as nfseCount,
      COALESCE(SUM(valor_total), 0) as totalValor,
      COALESCE(SUM(base_cbs), 0) as totalBaseCbs,
      COALESCE(SUM(base_ibs), 0) as totalBaseIbs,
      COALESCE(SUM(valor_icms), 0) as totalIcms,
      COALESCE(SUM(valor_pis), 0) as totalPis,
      COALESCE(SUM(valor_cofins), 0) as totalCofins,
      COALESCE(SUM(valor_cbs), 0) as totalCbs,
      COALESCE(SUM(valor_ibs), 0) as totalIbs,
      COALESCE(SUM(valor_is), 0) as totalIs,
      COALESCE(SUM(valor_irrf), 0) as totalIrrf,
      COALESCE(SUM(valor_inss), 0) as totalInss,
      COALESCE(SUM(valor_iss), 0) as totalIss
    FROM dfe_documentos
    ${whereFiltrado}
  `).get(...paramsFiltrado) as any;

  const mapRowToTotals = (row: any): KpiTotals => {
    const tValor = Number(row?.totalValor) || 0;
    const bCbs = Number(row?.totalBaseCbs) || 0;
    const bIbs = Number(row?.totalBaseIbs) || 0;
    const cbs = Number(row?.totalCbs) || 0;
    const ibs = Number(row?.totalIbs) || 0;
    const ibsUf = Number(row?.totalIbsUf) || 0;
    const ibsMun = Number(row?.totalIbsMun) || 0;

    return {
      totalDocs: Number(row?.totalDocs) || 0,
      totalValor: tValor,
      totalBaseCbs: bCbs,
      totalBaseIbs: bIbs,
      totalCbs: cbs,
      totalIbs: ibs,
      totalIbsUf: ibsUf,
      totalIbsMun: ibsMun,
      totalIvaDual: cbs + ibs,
      nfeCount: Number(row?.nfeCount) || 0,
      nfceCount: Number(row?.nfceCount) || 0,
      cteCount: Number(row?.cteCount) || 0,
      nfseCount: Number(row?.nfseCount) || 0,
      totalIcms: Number(row?.totalIcms) || 0,
      totalPis: Number(row?.totalPis) || 0,
      totalCofins: Number(row?.totalCofins) || 0,
      totalIpi: Number(row?.totalIpi) || 0,
      totalIrrf: Number(row?.totalIrrf) || 0,
      totalInss: Number(row?.totalInss) || 0,
      totalIss: Number(row?.totalIss) || 0,
    };
  };

  const totalGeral = mapRowToTotals(totalGeralRow);
  const totalFiltrado = mapRowToTotals(totalFiltradoRow);

  hotCache.setHotData(cacheKey, { totalGeral, totalFiltrado }, totalGeral.totalDocs);

  return {
    totalGeral,
    totalFiltrado,
    source: 'sqlite',
    executionTimeMs: Date.now() - startTime,
  };
}
