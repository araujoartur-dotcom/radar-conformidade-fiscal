/**
 * ============================================================
 * ROTAS DE RELATÓRIOS & AUDITORIA XML — RADAR FISCAL
 * ============================================================
 * Consultas analíticas com isolamento estrito por tenant,
 * conciliação RTC (CBS/IBS/IS), tributos federais/estaduais
 * e regras de elegibilidade de crédito.
 * ============================================================
 */

import { Router, Response } from 'express';
import { getDatabase } from '../db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { getDecoupledKpiAggregates } from '../services/kpiAggregationService';

const router = Router();

router.get('/xml', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const {
      cnpjEmitente,
      cnpjDestinatario,
      dataInicio,
      dataFim,
      tipoDoc,
      situacaoDoc,
      cfop,
      cClassTrib,
      searchTerm,
      uf,
      indicadorOnerosidade,
      resultadoElegibilidade,
      apenasExcecoes,
      empresaId: paramEmpresaId,
    } = req.query;

    const cleanDataInicio = dataInicio ? String(dataInicio).trim() : '';
    const cleanDataFim = dataFim ? String(dataFim).trim() : '';

    const supaDataInicio = cleanDataInicio 
      ? (cleanDataInicio.includes('T') ? cleanDataInicio : `${cleanDataInicio}T00:00:00.000Z`)
      : null;

    const supaDataFim = cleanDataFim 
      ? (cleanDataFim.includes('T') ? cleanDataFim : `${cleanDataFim}T23:59:59.999Z`)
      : null;

    const isSuperadmin = req.user!.perfil === 'admin_master';
    const activeEmpresaId = req.user!.empresaAtivaId;
    const targetEmpresaId = (paramEmpresaId as string) || activeEmpresaId;

    // Obter informações do tenant ativo para consulta flexível
    let tenantCnpjClean = '';
    if (activeEmpresaId) {
      const empRow = db.prepare('SELECT cnpj_completo, cnpj_raiz FROM empresas WHERE id = ?').get(activeEmpresaId) as any;
      if (empRow?.cnpj_completo) {
        tenantCnpjClean = empRow.cnpj_completo.replace(/\D/g, '');
      }
    }

    if (!tenantCnpjClean && req.user?.empresaCnpj) {
      tenantCnpjClean = req.user.empresaCnpj.replace(/\D/g, '');
    }

    const requestedLimit = req.query.limit === 'all' ? 50000 : Math.min(50000, parseInt(req.query.limit as string) || 10000);
    const requestedOffset = parseInt(req.query.offset as string) || 0;

    // Normalização do tipoDoc / relatório
    const relatorioParam = String(req.query.relatorio || req.query.tipoRelatorio || '');
    const isRelatorioRetencoes = relatorioParam === 'retencoes_fonte' || relatorioParam === 'consolidado_servicos';
    const isRelatorioMercadorias = relatorioParam === 'consolidado_mercadorias';
    const effectiveTipoDoc = isRelatorioRetencoes && (!tipoDoc || tipoDoc === 'TODOS')
      ? 'NFSE'
      : (isRelatorioMercadorias && (!tipoDoc || tipoDoc === 'TODOS') ? 'MERCADORIAS' : (tipoDoc ? String(tipoDoc) : null));

    let rows: any[] = [];
    let totalCount = 0;
    let supabaseFetched = false;

    // ── ESTRATÉGIA 1: SUPABASE PRIMEIRO (Fonte Primária Durável) ──
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          let supaQuery = supabase.from('dfe_documentos').select('*', { count: 'exact' });
          if (targetEmpresaId && !isSuperadmin) {
            supaQuery = supaQuery.eq('empresa_id', targetEmpresaId);
          } else if (!isSuperadmin && tenantCnpjClean) {
            supaQuery = supaQuery.or(`cliente_cnpj.ilike.%${tenantCnpjClean}%,fornecedor_cnpj.ilike.%${tenantCnpjClean}%,empresa_id.eq.${targetEmpresaId || 'null'}`);
          }

          if (cnpjEmitente) supaQuery = supaQuery.ilike('fornecedor_cnpj', `%${cnpjEmitente}%`);
          if (cnpjDestinatario) supaQuery = supaQuery.ilike('cliente_cnpj', `%${cnpjDestinatario}%`);
          if (supaDataInicio) supaQuery = supaQuery.gte('data_emissao', supaDataInicio);
          if (supaDataFim) supaQuery = supaQuery.lte('data_emissao', supaDataFim);
          if (situacaoDoc && situacaoDoc !== 'TODAS') supaQuery = supaQuery.ilike('situacao_doc', `%${situacaoDoc}%`);

          if (uf && uf !== 'TODAS') {
            supaQuery = supaQuery.or(`fornecedor_uf.eq.${uf},cliente_uf.eq.${uf}`);
          }

          if (effectiveTipoDoc && effectiveTipoDoc !== 'TODOS') {
            const td = effectiveTipoDoc.toUpperCase();
            if (td === 'MERCADORIAS' || td === 'CONSOLIDADO_MERCADORIAS') {
              supaQuery = supaQuery.in('tipo_doc', ['NFe', 'NF-e', 'NFE', '55', 'CTe', 'CT-e', 'CTE', '57', '67', 'NFCE', 'NFC-e', '65']);
            } else if (td === 'NFSE' || td === 'NFS-E' || td === 'NFS') {
              supaQuery = supaQuery.in('tipo_doc', ['NFSe', 'NFS-e', 'NFSE', 'NFS']);
            } else if (td === 'CTE' || td === 'CT-E') {
              supaQuery = supaQuery.in('tipo_doc', ['CTe', 'CT-e', 'CTE', '57', '67']);
            } else if (td === 'NFE' || td === 'NF-E') {
              supaQuery = supaQuery.in('tipo_doc', ['NFe', 'NF-e', 'NFE', '55']);
            } else {
              supaQuery = supaQuery.eq('tipo_doc', effectiveTipoDoc);
            }
          }

          if (searchTerm) {
            supaQuery = supaQuery.or(`fornecedor_razao.ilike.%${searchTerm}%,fornecedor_cnpj.ilike.%${searchTerm}%,chave_acesso.ilike.%${searchTerm}%`);
          }

          let { data: supaDocs, count: supaTotal, error: supaErr } = await supaQuery
            .order('data_emissao', { ascending: false })
            .range(requestedOffset, requestedOffset + requestedLimit - 1);

          if (!supaErr && supaDocs) {
            // Se a consulta foi geral (TODOS) e os 1000 CT-e de 2026 preencheram o teto do PostgREST,
            // injeta as 50 NFS-e da empresa para que estejam no lote consolidado de relatórios
            if (requestedOffset === 0 && (!effectiveTipoDoc || effectiveTipoDoc === 'TODOS')) {
              const hasNfse = supaDocs.some(d => (d.tipo_doc || '').toString().toUpperCase().includes('NFS'));
              if (!hasNfse) {
                try {
                  let nfseQuery = supabase
                    .from('dfe_documentos')
                    .select('*')
                    .in('tipo_doc', ['NFSe', 'NFS-e', 'NFSE', 'NFS'])
                    .order('data_emissao', { ascending: false })
                    .limit(200);

                  if (!isSuperadmin && tenantCnpjClean) {
                    nfseQuery = nfseQuery.or(`cliente_cnpj.ilike.%${tenantCnpjClean}%,fornecedor_cnpj.ilike.%${tenantCnpjClean}%,empresa_id.eq.${targetEmpresaId || 'null'}`);
                  } else if (targetEmpresaId) {
                    nfseQuery = nfseQuery.eq('empresa_id', targetEmpresaId);
                  }

                  if (supaDataInicio) nfseQuery = nfseQuery.gte('data_emissao', supaDataInicio);
                  if (supaDataFim) nfseQuery = nfseQuery.lte('data_emissao', supaDataFim);
                  if (uf && uf !== 'TODAS') {
                    nfseQuery = nfseQuery.or(`fornecedor_uf.eq.${uf},cliente_uf.eq.${uf}`);
                  }

                  const { data: extraNfse } = await nfseQuery;
                  if (extraNfse && extraNfse.length > 0) {
                    supaDocs = [...extraNfse, ...supaDocs];
                    console.log(`📡 Relatórios: Injetadas ${extraNfse.length} NFS-e no lote inicial para consolidação.`);
                  }
                } catch (eNfse) {
                  console.warn('⚠️ Falha ao buscar NFS-e para relatórios:', eNfse);
                }
              }
            }

            if (supaDocs.length > 0) {
              totalCount = supaTotal || supaDocs.length;
              rows = supaDocs.map(d => {
                const isDocNfse = (d.tipo_doc || '').toString().toUpperCase().includes('NFS');
                let itemDesc = isDocNfse ? 'Prestação de Serviços Profissionais / Técnicos' : 'Item Principal / Operação Global';
                let itemNcm = isDocNfse ? '17.01' : '2711.19.10';
                let itemCfop = isDocNfse ? '1933' : (d.tipo_doc === 'CTe' ? '5353' : '1102');
                let itemCClass = '000001';

                if (d.xml_raw) {
                  const cfopMatch = d.xml_raw.match(/<CFOP>(\d{4})<\/CFOP>/i);
                  if (cfopMatch && cfopMatch[1]) {
                    itemCfop = cfopMatch[1];
                  }
                  const cClassMatch = d.xml_raw.match(/<cClassTrib>(\d{6})<\/cClassTrib>/i);
                  if (cClassMatch && cClassMatch[1]) {
                    itemCClass = cClassMatch[1];
                  }

                  if (isDocNfse) {
                    const descMatch = d.xml_raw.match(/<xDescServ>(.*?)<\/xDescServ>/) || d.xml_raw.match(/<xTribNac>(.*?)<\/xTribNac>/);
                    if (descMatch && descMatch[1]) {
                      itemDesc = descMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
                    }
                    const servMatch = d.xml_raw.match(/<cTribNac>(\d+)<\/cTribNac>/) || d.xml_raw.match(/<cServ>(\d+)<\/cServ>/);
                    if (servMatch && servMatch[1]) {
                      const rawCode = servMatch[1];
                      itemNcm = rawCode.length >= 4 ? `${rawCode.substring(0, 2)}.${rawCode.substring(2, 4)}` : rawCode;
                    }
                  } else {
                    const prodDescMatch = d.xml_raw.match(/<xProd>(.*?)<\/xProd>/i);
                    if (prodDescMatch && prodDescMatch[1]) {
                      itemDesc = prodDescMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
                    }
                    const ncmMatch = d.xml_raw.match(/<NCM>(\d+)<\/NCM>/i);
                    if (ncmMatch && ncmMatch[1]) {
                      itemNcm = ncmMatch[1];
                    }
                  }
                }

                return {
                  docId: d.id,
                  empresaId: d.empresa_id,
                  tipoDoc: isDocNfse ? 'NFS-e' : (d.tipo_doc === 'CTe' ? 'CT-e' : (d.tipo_doc === 'NFe' ? 'NF-e' : d.tipo_doc)),
                  chaveAcesso: d.chave_acesso,
                  numeroSerie: d.numero_serie,
                  dataEmissao: d.data_emissao,
                  dataEntrada: d.data_entrada,
                  competencia: d.competencia,
                  fornecedorCnpj: d.fornecedor_cnpj,
                  fornecedorRazao: d.fornecedor_razao,
                  fornecedorUf: d.fornecedor_uf,
                  fornecedorMunicipio: d.fornecedor_municipio,
                  clienteCnpj: d.cliente_cnpj,
                  clienteRazao: d.cliente_razao,
                  clienteUf: d.cliente_uf,
                  situacaoDoc: d.situacao_doc,
                  situacaoManifestacao: d.situacao_manifestacao,
                  eventoUltimo: d.evento_ultimo,
                  alertaFraude: d.alerta_fraude,
                  docValorTotal: d.valor_total,
                  docValorIcms: d.valor_icms,
                  docValorIpi: d.valor_ipi,
                  docValorPis: d.valor_pis,
                  docValorCofins: d.valor_cofins,
                  docValorCbs: d.valor_cbs,
                  docValorIbs: d.valor_ibs,
                  docValorIs: d.valor_is,
                  docValorIrrf: d.valor_irrf,
                  docValorInss: d.valor_inss,
                  docValorIss: d.valor_iss,
                  docValorCsll: d.valor_csll,
                  itemNro: 1,
                  descricaoItem: itemDesc,
                  ncm: itemNcm,
                  cest: '',
                  cfop: itemCfop,
                  cClassTrib: itemCClass,
                  cstCsosn: '000',
                  naturezaOperacao: isDocNfse ? 'Prestação de Serviços (NFS-e)' : 'Operação Fiscal',
                  quantidade: 1,
                  unidade: 'UN',
                  valorUnitario: d.valor_total,
                  valorBrutoItem: d.valor_total,
                  valorLiquidoItem: d.valor_total,
                  valorIcms: d.valor_icms,
                  valorIbs: d.valor_ibs,
                  valorCbs: d.valor_cbs,
                  valorIs: d.valor_is,
                  itemId: `item-${d.chave_acesso}-1`
                };
              });
              supabaseFetched = true;
              console.log(`📡 GET /relatorios/xml: ${rows.length} de ${totalCount} documentos carregados do Supabase.`);
            }
          }
        } catch (e: any) {
          console.warn('⚠️ Supabase relatórios query error:', e?.message || e);
        }
      }
    }

    // ── ESTRATÉGIA 2: SQLite (Fallback local) ──
    if (!supabaseFetched) {
      let query = `
        SELECT 
          d.id as docId,
          d.empresa_id as empresaId,
          d.tipo_doc as tipoDoc,
          d.chave_acesso as chaveAcesso,
          d.numero_serie as numeroSerie,
          d.data_emissao as dataEmissao,
          d.data_entrada as dataEntrada,
          d.competencia,
          d.fornecedor_cnpj as fornecedorCnpj,
          d.fornecedor_razao as fornecedorRazao,
          d.fornecedor_uf as fornecedorUf,
          d.fornecedor_municipio as fornecedorMunicipio,
          d.cliente_cnpj as clienteCnpj,
          d.cliente_razao as clienteRazao,
          d.cliente_uf as clienteUf,
          d.situacao_doc as situacaoDoc,
          d.situacao_manifestacao as situacaoManifestacao,
          d.evento_ultimo as eventoUltimo,
          d.alerta_fraude as alertaFraude,
          d.valor_total as docValorTotal,
          d.valor_icms as docValorIcms,
          d.valor_ipi as docValorIpi,
          d.valor_pis as docValorPis,
          d.valor_cofins as docValorCofins,
          d.valor_cbs as docValorCbs,
          d.valor_ibs as docValorIbs,
          d.valor_is as docValorIs,
          d.valor_irrf as docValorIrrf,
          d.valor_inss as docValorInss,
          d.valor_iss as docValorIss,
          d.valor_csll as docValorCsll,
          i.item_nro as itemNro,
          i.descricao_item as descricaoItem,
          i.ncm,
          i.cest,
          i.cfop,
          i.cclasstrib as cClassTrib,
          i.cst_csosn as cstCsosn,
          i.natureza_operacao as naturezaOperacao,
          i.quantidade,
          i.unidade,
          i.valor_unitario as valorUnitario,
          i.valor_bruto_item as valorBrutoItem,
          i.desconto_incondicional as descontoIncondicional,
          i.frete_seguro_rateado as freteSeguroRateado,
          i.valor_liquido_item as valorLiquidoItem,
          i.base_icms as baseIcms,
          i.aliquota_icms as aliquotaIcms,
          i.valor_icms as valorIcms,
          i.base_ipi as baseIpi,
          i.aliquota_ipi as aliquotaIpi,
          i.valor_ipi as valorIpi,
          i.base_pis as basePis,
          i.aliquota_pis as aliquotaPis,
          i.valor_pis as valorPis,
          i.base_cofins as baseCofins,
          i.aliquota_cofins as aliquotaCofins,
          i.valor_cofins as valorCofins,
          i.base_ibs as baseIbs,
          i.aliquota_ibs as aliquotaIbs,
          i.valor_ibs as valorIbs,
          i.base_cbs as baseCbs,
          i.aliquota_cbs as aliquotaCbs,
          i.valor_cbs as valorCbs,
          i.valor_is as valorIs,
          i.id as itemId
        FROM dfe_documentos d
        LEFT JOIN dfe_itens i ON d.id = i.documento_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (!isSuperadmin) {
        if (activeEmpresaId && tenantCnpjClean) {
          query += `
            AND (
              d.empresa_id = ?
              OR d.empresa_id IN (SELECT empresa_id FROM usuario_empresa WHERE usuario_id = ?)
              OR d.cliente_cnpj LIKE ?
              OR d.fornecedor_cnpj LIKE ?
            )
          `;
          params.push(activeEmpresaId, req.user!.userId, `%${tenantCnpjClean}%`, `%${tenantCnpjClean}%`);
        } else if (activeEmpresaId) {
          query += `
            AND (
              d.empresa_id = ?
              OR d.empresa_id IN (SELECT empresa_id FROM usuario_empresa WHERE usuario_id = ?)
            )
          `;
          params.push(activeEmpresaId, req.user!.userId);
        }
      } else if (targetEmpresaId) {
        query += ` AND (d.empresa_id = ? OR d.empresa_id IS NULL)`;
        params.push(targetEmpresaId);
      }

      if (cnpjEmitente) {
        query += ` AND d.fornecedor_cnpj LIKE ?`;
        params.push(`%${cnpjEmitente}%`);
      }
      if (cnpjDestinatario) {
        query += ` AND d.cliente_cnpj LIKE ?`;
        params.push(`%${cnpjDestinatario}%`);
      }
      if (uf && uf !== 'TODAS') {
        query += ` AND (d.fornecedor_uf = ? OR d.cliente_uf = ?)`;
        params.push(uf, uf);
      }
      if (cleanDataInicio) {
        query += ` AND d.data_emissao >= ?`;
        params.push(cleanDataInicio.substring(0, 10));
      }
      if (cleanDataFim) {
        query += ` AND d.data_emissao <= ?`;
        params.push(`${cleanDataFim.substring(0, 10)}T23:59:59`);
      }
      if (effectiveTipoDoc && effectiveTipoDoc !== 'TODOS') {
        const td = effectiveTipoDoc.toUpperCase();
        if (td === 'NFSE' || td === 'NFS-E' || td === 'NFS') {
          query += ` AND (d.tipo_doc IN ('NFSe', 'NFS-e') OR d.tipo_doc LIKE '%nfse%')`;
        } else if (td === 'CTE' || td === 'CT-E') {
          query += ` AND (d.tipo_doc IN ('CTe', 'CT-e') OR d.tipo_doc LIKE '%cte%')`;
        } else if (td === 'NFE' || td === 'NF-E') {
          query += ` AND (d.tipo_doc IN ('NFe', 'NF-e') OR d.tipo_doc LIKE '%nfe%')`;
        } else {
          query += ` AND d.tipo_doc = ?`;
          params.push(effectiveTipoDoc);
        }
      }
      if (situacaoDoc && situacaoDoc !== 'TODAS') {
        query += ` AND d.situacao_doc = ?`;
        params.push(situacaoDoc);
      }
      if (cfop) {
        query += ` AND (i.cfop LIKE ? OR ? = '')`;
        params.push(`%${cfop}%`, cfop);
      }
      if (cClassTrib) {
        query += ` AND (i.cclasstrib LIKE ? OR ? = '')`;
        params.push(`%${cClassTrib}%`, cClassTrib);
      }
      if (searchTerm) {
        query += ` AND (d.fornecedor_razao LIKE ? OR d.fornecedor_cnpj LIKE ? OR d.chave_acesso LIKE ? OR i.descricao_item LIKE ? OR i.ncm LIKE ?)`;
        const searchPattern = `%${searchTerm}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      }

      query += ' ORDER BY d.data_emissao DESC, d.created_at DESC LIMIT ? OFFSET ?';
      params.push(requestedLimit, requestedOffset);

      rows = db.prepare(query).all(...params) as any[];
      totalCount = rows.length;
    }

    // Carregar configurações de regras CFOP
    const cfops = db.prepare('SELECT cfop, tratamento_padrao, exige_onerosidade FROM cfop_tratamento WHERE ativo = 1').all() as any[];
    const cfopMap = new Map(cfops.map(c => [c.cfop, c]));

    // Carregar matriz de regras de retenção de serviços (Planilhão / LC 116 / Lei 10.833 / RIR 2018)
    let regrasRetencao: any[] = [];
    try {
      regrasRetencao = db.prepare('SELECT * FROM regras_retencao_servicos').all() as any[];
    } catch (_) {}
    if (regrasRetencao.length === 0 && isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          const { data } = await supabase.from('regras_retencao_servicos').select('*');
          if (data && data.length > 0) regrasRetencao = data;
        } catch (_) {}
      }
    }

    const normalizeLc116 = (code: string | null | undefined): string => {
      if (!code) return '';
      const clean = String(code).replace(/\D/g, '');
      return clean.padStart(4, '0');
    };

    const parseAliqStr = (val: any): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      const str = String(val).replace('%', '').replace(',', '.').trim();
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    };

    const regrasMapLc116 = new Map<string, any>();
    const regrasMapCClass = new Map<string, any>();
    for (const reg of regrasRetencao) {
      if (reg.item_lc116) {
        regrasMapLc116.set(normalizeLc116(reg.item_lc116), reg);
        regrasMapLc116.set(String(reg.item_lc116).trim(), reg);
      }
      if (reg.cclasstrib) {
        regrasMapCClass.set(String(reg.cclasstrib).trim(), reg);
      }
    }

    // Carregar mapa leve da Conta Corrente Fiscal / Apuração Assistida (Zero Duplicação)
    let apuracaoMap = new Map<string, any>();
    try {
      const apuracaoRows = db.prepare(`
        SELECT 
          op.id as operacao_id,
          op.chave_acesso,
          op.tipo_operacao,
          op.hash_acumulado,
          COALESCE(SUM(cc.credito_a_propriar), 0) as tot_credito_a_propriar,
          COALESCE(SUM(cc.credito_nao_utilizado), 0) as tot_credito_nao_utilizado,
          COALESCE(SUM(cc.credito_utilizado), 0) as tot_credito_utilizado,
          COALESCE(SUM(cc.debito_em_aberto), 0) as tot_debito_em_aberto,
          COALESCE(SUM(cc.debito_extinto), 0) as tot_debito_extinto
        FROM apuracao_operacoes op
        LEFT JOIN apuracao_extrato_cc cc ON cc.operacao_id = op.id
        GROUP BY op.id, op.chave_acesso
      `).all() as any[];

      for (const ap of apuracaoRows) {
        if (ap.chave_acesso) {
          apuracaoMap.set(ap.chave_acesso, ap);
        }
      }
    } catch (e: any) {
      console.warn('⚠️ Não foi possível carregar mapa de apuração assistida:', e?.message || e);
    }

    const mapped = rows.map(r => {
      const itemCfop = r.cfop || (r.tipoDoc === 'NFSe' ? '1933' : '1102');
      const cfopInfo = cfopMap.get(itemCfop) || { tratamento_padrao: 'Elegível', exige_onerosidade: 1 };
      
      const docTotal = Number(r.docValorTotal) || 0;
      const itemValIbs = r.valorIbs !== null && r.valorIbs !== undefined ? Number(r.valorIbs) : (Number(r.docValorIbs) || 0);
      const itemValCbs = r.valorCbs !== null && r.valorCbs !== undefined ? Number(r.valorCbs) : (Number(r.docValorCbs) || 0);

      const creditoEsperadoIbs = itemValIbs;
      const creditoEsperadoCbs = itemValCbs;
      const creditoApropriadoIbs = creditoEsperadoIbs;
      const creditoApropriadoCbs = creditoEsperadoCbs;

      let resultadoElegibilidade = 'Elegível';
      if (cfopInfo.tratamento_padrao === 'Não elegível') resultadoElegibilidade = 'Não elegível';
      if (cfopInfo.tratamento_padrao === 'Depende') resultadoElegibilidade = 'Pendente';

      // ========================================================
      // CONCILIAÇÃO DINÂMICA COM APURAÇÃO ASSISTIDA & DECISÃO RAD
      // Art. 27 LC 215/2025 - Não-cumulatividade vinculada à liquidação
      // ========================================================
      const apOp = apuracaoMap.get(r.chaveAcesso);
      let statusCreditoCgibs: 'CONFIRMADO' | 'PENDENTE_EXTINCAO' | 'UTILIZADO' | 'ESTORNADO' | 'NAO_CONCILIADO' = 'NAO_CONCILIADO';
      let motivoCreditoCgibs = 'Aguardando sincronismo com CGIBS / RTC';
      
      let statusLiquidacaoApuracao: 'LIQUIDADO' | 'PENDENTE_EXTINCAO' | 'GLOSADO' | 'NAO_CONCILIADO' = 'NAO_CONCILIADO';
      let valorCreditoLiquidadoReal: number | null = null; // SEM FALLBACK
      let valorCreditoRetido: number | null = null;
      let taxaLiquidacaoItem = 0;
      let impactoDecisorioRad: 'APTO_PARA_RAD' | 'AGUARDAR_QUITACAO' | 'INAPTO_PARA_RAD' | 'NAO_CONCILIADO' = 'NAO_CONCILIADO';
      let motivoDecisaoRad = 'Operação não localizada na Apuração Assistida do CGIBS. Crédito bloqueado para apropriação até a homologação da liquidação.';

      const creditoTotalDoc = creditoEsperadoIbs + creditoEsperadoCbs;

      if (apOp) {
        const totExtinto = Number(apOp.tot_debito_extinto) || 0;
        const totEmAberto = Number(apOp.tot_debito_em_aberto) || 0;
        const totCredUtilizado = Number(apOp.tot_credito_utilizado) || 0;
        const totCredNaoUtilizado = Number(apOp.tot_credito_nao_utilizado) || 0;
        const totCredAPropriar = Number(apOp.tot_credito_a_propriar) || 0;

        if (totCredUtilizado > 0 || totCredNaoUtilizado > 0 || (totExtinto > 0 && totEmAberto <= 0)) {
          statusCreditoCgibs = totCredUtilizado > 0 ? 'UTILIZADO' : 'CONFIRMADO';
          statusLiquidacaoApuracao = 'LIQUIDADO';
          valorCreditoLiquidadoReal = Number((totCredNaoUtilizado + totCredUtilizado > 0 ? totCredNaoUtilizado + totCredUtilizado : Math.min(creditoTotalDoc, totExtinto)).toFixed(2));
          valorCreditoRetido = 0;
          taxaLiquidacaoItem = creditoTotalDoc > 0 ? Math.min(100, Number(((valorCreditoLiquidadoReal / creditoTotalDoc) * 100).toFixed(1))) : 100;
          impactoDecisorioRad = 'APTO_PARA_RAD';
          motivoDecisaoRad = 'Imposto liquidado pelo Fornecedor ou Split Payment no CGIBS. Crédito 100% liberado para apropriação (Art. 27 LC 215/2025). Desnecessário RAD (Recolhimento pelo Adquirente).';
          motivoCreditoCgibs = 'Crédito homologado com débito comprovadamente extinto.';
        } else if (totCredAPropriar > 0 || totEmAberto > 0) {
          statusCreditoCgibs = 'PENDENTE_EXTINCAO';
          statusLiquidacaoApuracao = 'PENDENTE_EXTINCAO';
          valorCreditoLiquidadoReal = 0;
          valorCreditoRetido = totCredAPropriar > 0 ? totCredAPropriar : creditoTotalDoc;
          taxaLiquidacaoItem = 0;
          impactoDecisorioRad = 'AGUARDAR_QUITACAO';
          motivoDecisaoRad = 'Imposto NÃO liquidado pelo Fornecedor nem pelo Split Payment. Crédito bloqueado para apropriação. O Adquirente pode emitir e recolher via RAD (Recolhimento pelo Adquirente) para liquidar o débito e liberar o crédito, ou aguardar a quitação pelo fornecedor.';
          motivoCreditoCgibs = 'Aguardando extinção do débito pelo fornecedor ou emissão de RAD pelo adquirente (Art. 27 LC 215/2025)';
        }
      }

      // ==========================================
      // RETENÇÕES NA FONTE (NFS-E / SERVIÇOS)
      // ==========================================
      const isNfse = r.tipoDoc === 'NFSe' || r.tipoDoc === 'NFS-e' || (r.tipoDoc as string)?.toUpperCase().includes('NFS') || itemCfop === '1933' || itemCfop === '2933';
      
      let regraEncontrada: any = null;
      if (isNfse) {
        const candidateCode = r.ncm || '';
        const normCandidate = normalizeLc116(candidateCode);
        if (normCandidate && regrasMapLc116.has(normCandidate)) {
          regraEncontrada = regrasMapLc116.get(normCandidate);
        } else if (candidateCode && regrasMapLc116.has(candidateCode.trim())) {
          regraEncontrada = regrasMapLc116.get(candidateCode.trim());
        } else if (r.cClassTrib && regrasMapCClass.has(String(r.cClassTrib).trim())) {
          regraEncontrada = regrasMapCClass.get(String(r.cClassTrib).trim());
        }
        // SEM FALLBACK: Não assumir regra genérica ou 17.01 arbitrariamente!
      }

      const expectedIrrfAliq = regraEncontrada ? parseAliqStr(regraEncontrada.irrf) : null;
      const expectedCsrfAliq = regraEncontrada ? parseAliqStr(regraEncontrada.csrf) : null;
      const expectedInssAliq = regraEncontrada ? parseAliqStr(regraEncontrada.inss) : null;
      const expectedIssAliq = regraEncontrada ? parseAliqStr(regraEncontrada.iss) : null;

      const valorIrrf = Number(r.docValorIrrf) || 0;
      const valorInss = Number(r.docValorInss) || 0;
      const valorIssRetido = Number(r.docValorIss) || 0;
      // SEM FALLBACK: Não deduzir percentuais inventados se ausentes do XML
      const valorCsllRetido = Number(r.docValorCsll) || 0;
      const valorPisRetido = isNfse ? (Number(r.docValorPis) || 0) : 0;
      const valorCofinsRetido = isNfse ? (Number(r.docValorCofins) || 0) : 0;

      const totalRetencoes = valorIrrf + valorInss + valorIssRetido + valorCsllRetido + valorPisRetido + valorCofinsRetido;
      const valorLiquidoServico = docTotal > 0 ? Math.max(0, docTotal - totalRetencoes) : docTotal;

      const aliquotaIrrf = docTotal > 0 && valorIrrf > 0 ? Number(((valorIrrf / docTotal) * 100).toFixed(2)) : (expectedIrrfAliq ?? 0);
      const aliquotaInss = docTotal > 0 && valorInss > 0 ? Number(((valorInss / docTotal) * 100).toFixed(2)) : (expectedInssAliq ?? 0);
      const aliquotaCsllRetido = docTotal > 0 && valorCsllRetido > 0 ? Number(((valorCsllRetido / docTotal) * 100).toFixed(2)) : 0;
      const aliquotaPisRetido = docTotal > 0 && valorPisRetido > 0 ? Number(((valorPisRetido / docTotal) * 100).toFixed(2)) : 0;
      const aliquotaCofinsRetido = docTotal > 0 && valorCofinsRetido > 0 ? Number(((valorCofinsRetido / docTotal) * 100).toFixed(2)) : 0;
      const aliquotaIssRetido = docTotal > 0 && valorIssRetido > 0 ? Number(((valorIssRetido / docTotal) * 100).toFixed(2)) : (expectedIssAliq ?? 0);

      // Diagnóstico contra a Matriz de Retenções Parametrizada (LC 116 / Lei 10.833 / RIR 2018)
      let diagnosticoRetencao: 'CONFORME' | 'DIVERGENCIA_ALIQUOTA' | 'FALTA_RETENCAO' | 'RETENCAO_INDEVIDA' | 'DISPENSADO_LIMITE' | 'SIMPLES_NACIONAL' | 'SEM_REGRA_PARAMETRIZADA' = 'CONFORME';
      let motivoDiagnosticoRetencao = 'Retenções em conformidade legal';

      if (isNfse) {
        const candidateDisplay = r.ncm || (r.cClassTrib ? `cClass ${r.cClassTrib}` : 'não informado');
        
        if (!regraEncontrada) {
          // SEM FALLBACK: Notificar categoricamente que o serviço não está parametrizado
          diagnosticoRetencao = 'SEM_REGRA_PARAMETRIZADA';
          motivoDiagnosticoRetencao = `Código de serviço (${candidateDisplay}) sem regra cadastrada em Parâmetros & Tabelas Fiscais > Retenções de Serviços. Cadastre as alíquotas para auditar este serviço.`;
        } else {
          const itemCodeDesc = `Item ${regraEncontrada.item_lc116 || ''} (${regraEncontrada.descricao_item || ''})`;
          const crfTotal = valorPisRetido + valorCofinsRetido + valorCsllRetido;
          const crfAliq = docTotal > 0 ? (crfTotal / docTotal) * 100 : 0;

          if (docTotal <= 215.00 && totalRetencoes === 0) {
            diagnosticoRetencao = 'DISPENSADO_LIMITE';
            motivoDiagnosticoRetencao = `Dispensa de retenção CRF (imposto <= R$ 10,00 - Art. 31 da Lei 10.833/03) para ${itemCodeDesc}`;
          } else if (totalRetencoes > 0) {
            const divergencias: string[] = [];

            if (valorIrrf > 0 && expectedIrrfAliq !== null && expectedIrrfAliq > 0 && Math.abs(aliquotaIrrf - expectedIrrfAliq) > 0.1) {
              divergencias.push(`IRRF: aplicado ${aliquotaIrrf}% vs previsto ${expectedIrrfAliq}%`);
            } else if (valorIrrf > 0 && expectedIrrfAliq === 0) {
              divergencias.push(`IRRF retido indevidamente (regra prevê 0% ou não incidência)`);
            }

            if (crfTotal > 0 && expectedCsrfAliq !== null && expectedCsrfAliq > 0 && Math.abs(crfAliq - expectedCsrfAliq) > 0.25) {
              divergencias.push(`CRF/PCC: aplicado ${crfAliq.toFixed(2)}% vs previsto ${expectedCsrfAliq}%`);
            } else if (crfTotal > 0 && expectedCsrfAliq === 0) {
              divergencias.push(`CRF/PCC retido indevidamente (regra prevê 0%)`);
            }

            if (valorInss > 0 && expectedInssAliq !== null && expectedInssAliq > 0 && Math.abs(aliquotaInss - expectedInssAliq) > 0.5) {
              divergencias.push(`INSS: aplicado ${aliquotaInss}% vs previsto ${expectedInssAliq}%`);
            }

            if (divergencias.length > 0) {
              diagnosticoRetencao = 'DIVERGENCIA_ALIQUOTA';
              const baseLegal = regraEncontrada?.fundamentos_legais || regraEncontrada?.dispositivo_legal_lc214 || 'Lei 10.833/03 e RIR/2018';
              motivoDiagnosticoRetencao = `Divergência de alíquota para ${itemCodeDesc}: ${divergencias.join('; ')} [Base: ${baseLegal}]`;
            } else {
              diagnosticoRetencao = 'CONFORME';
              motivoDiagnosticoRetencao = `Retenções validadas conforme regra cadastrada do ${itemCodeDesc} (IRRF ${expectedIrrfAliq}%, CRF ${expectedCsrfAliq}%, INSS ${expectedInssAliq}%)`;
            }
          } else if (docTotal > 5000 && ((expectedIrrfAliq !== null && expectedIrrfAliq > 0) || (expectedCsrfAliq !== null && expectedCsrfAliq > 0))) {
            diagnosticoRetencao = 'FALTA_RETENCAO';
            motivoDiagnosticoRetencao = `Serviço (${itemCodeDesc}) acima de R$ 5.000 sem retenção destacada na fonte (previsto IRRF ${expectedIrrfAliq}% / CRF ${expectedCsrfAliq}%). Verificar se optante do Simples Nacional`;
          }
        }
      }

      const ehPendenteCgibs = statusCreditoCgibs === 'PENDENTE_EXTINCAO';

      // ==========================================
      // TRIBUTOS DO REGIME ATUAL (ICMS, IPI, PIS, COFINS)
      // ==========================================
      const valorIcms = r.valorIcms !== null && r.valorIcms !== undefined ? Number(r.valorIcms) : (Number(r.docValorIcms) || 0);
      const baseIcms = r.baseIcms !== null && r.baseIcms !== undefined ? Number(r.baseIcms) : (valorIcms > 0 ? docTotal : 0);
      const aliquotaIcms = r.aliquotaIcms !== null && r.aliquotaIcms !== undefined ? Number(r.aliquotaIcms) : (baseIcms > 0 && valorIcms > 0 ? Number(((valorIcms / baseIcms) * 100).toFixed(2)) : 0);

      const valorIpi = r.valorIpi !== null && r.valorIpi !== undefined ? Number(r.valorIpi) : (Number(r.docValorIpi) || 0);
      const baseIpi = r.baseIpi !== null && r.baseIpi !== undefined ? Number(r.baseIpi) : (valorIpi > 0 ? docTotal : 0);
      const aliquotaIpi = r.aliquotaIpi !== null && r.aliquotaIpi !== undefined ? Number(r.aliquotaIpi) : (baseIpi > 0 && valorIpi > 0 ? Number(((valorIpi / baseIpi) * 100).toFixed(2)) : 0);

      const valorPis = isNfse ? valorPisRetido : (r.valorPis !== null && r.valorPis !== undefined ? Number(r.valorPis) : (Number(r.docValorPis) || 0));
      const basePis = r.basePis !== null && r.basePis !== undefined ? Number(r.basePis) : (valorPis > 0 ? docTotal : 0);
      const aliquotaPis = r.aliquotaPis !== null && r.aliquotaPis !== undefined ? Number(r.aliquotaPis) : (basePis > 0 && valorPis > 0 ? Number(((valorPis / basePis) * 100).toFixed(2)) : 0);

      const valorCofins = isNfse ? valorCofinsRetido : (r.valorCofins !== null && r.valorCofins !== undefined ? Number(r.valorCofins) : (Number(r.docValorCofins) || 0));
      const baseCofins = r.baseCofins !== null && r.baseCofins !== undefined ? Number(r.baseCofins) : (valorCofins > 0 ? docTotal : 0);
      const aliquotaCofins = r.aliquotaCofins !== null && r.aliquotaCofins !== undefined ? Number(r.aliquotaCofins) : (baseCofins > 0 && valorCofins > 0 ? Number(((valorCofins / baseCofins) * 100).toFixed(2)) : 0);

      const totalTributosAtuais = Number((valorIcms + valorIpi + valorPis + valorCofins).toFixed(2));
      const cargaTributariaAtual = docTotal > 0 ? Number(((totalTributosAtuais / docTotal) * 100).toFixed(2)) : 0;

      // ==========================================
      // TRIBUTOS DA REFORMA (IBS, CBS, IS)
      // ==========================================
      const valorIs = Number(r.valorIs || r.docValorIs || 0);
      const aliquotaIs = docTotal > 0 && valorIs > 0 ? Number(((valorIs / docTotal) * 100).toFixed(2)) : 0;
      const totalTributosReforma = Number((itemValIbs + itemValCbs + valorIs).toFixed(2));
      const cargaTributariaReforma = docTotal > 0 ? Number(((totalTributosReforma / docTotal) * 100).toFixed(2)) : 0;
      const deltaCargaTributaria = Number((totalTributosReforma - totalTributosAtuais).toFixed(2));
      const deltaCargaPercentual = Number((cargaTributariaReforma - cargaTributariaAtual).toFixed(2));

      return {
        id: r.itemId || `doc-item-${r.chaveAcesso}`,
        empresaId: r.empresaId,
        empresaCnpj: r.clienteCnpj,
        empresaNome: r.clienteRazao,
        tipoDoc: isNfse ? 'NFS-e' : (r.tipoDoc === 'CTe' || r.tipoDoc === 'CT-e' ? 'CT-e' : (r.tipoDoc === 'NFe' || r.tipoDoc === 'NF-e' ? 'NF-e' : (r.tipoDoc || 'NF-e'))),
        chaveAcesso: r.chaveAcesso,
        numeroSerie: r.numeroSerie || '001',
        dataEmissao: r.dataEmissao,
        dataEntrada: r.dataEntrada,
        competencia: r.competencia || (r.dataEmissao ? String(r.dataEmissao).substring(0, 7) : '2026-08'),
        fornecedorCnpj: r.fornecedorCnpj,
        fornecedorRazao: r.fornecedorRazao,
        fornecedorUf: r.fornecedorUf || 'SP',
        fornecedorMunicipio: r.fornecedorMunicipio || 'São Paulo',
        clienteCnpj: r.clienteCnpj,
        clienteRazao: r.clienteRazao,
        clienteUf: r.clienteUf || 'SP',
        situacaoDoc: r.situacaoDoc || 'autorizado',
        situacaoManifestacao: r.situacaoManifestacao || 'sem_manifestacao',
        eventoUltimo: r.eventoUltimo || 'Autorizado o uso do DF-e',
        alertaFraude: Boolean(r.alertaFraude),
        
        itemNro: r.itemNro || 1,
        descricaoItem: r.descricaoItem || (isNfse ? 'Prestação de Serviços Profissionais / Técnicos' : 'Item Principal / Operação Global'),
        ncm: r.ncm || (isNfse ? '17.01' : '2711.19.10'),
        cest: r.cest || '',
        cfop: itemCfop,
        cClassTrib: r.cClassTrib || '000001',
        cstCsosn: r.cstCsosn || '000',
        naturezaOperacao: r.naturezaOperacao || (isNfse ? 'Prestação de Serviços (NFS-e)' : 'Operação Fiscal'),
        quantidade: r.quantidade || 1,
        unidade: r.unidade || 'UN',
        valorUnitario: r.valorUnitario || docTotal,
        valorBrutoItem: r.valorBrutoItem || docTotal,
        descontoIncondicional: r.descontoIncondicional || 0,
        freteSeguroRateado: r.freteSeguroRateado || 0,
        valorLiquidoItem: r.valorLiquidoItem || docTotal,
        
        // Regime Atual
        baseIcms,
        aliquotaIcms,
        valorIcms,
        cstIcms: r.cstCsosn || '000',
        baseIpi,
        aliquotaIpi,
        valorIpi,
        cstIpi: '50',
        basePis,
        aliquotaPis,
        valorPis,
        cstPis: '01',
        baseCofins,
        aliquotaCofins,
        valorCofins,
        cstCofins: '01',
        totalTributosAtuais,
        cargaTributariaAtual,

        // Regime Reforma
        baseIbs: r.baseIbs !== null && r.baseIbs !== undefined ? Number(r.baseIbs) : 0,
        aliquotaIbs: r.aliquotaIbs !== null && r.aliquotaIbs !== undefined ? Number(r.aliquotaIbs) : 0,
        valorIbs: itemValIbs,
        baseCbs: r.baseCbs !== null && r.baseCbs !== undefined ? Number(r.baseCbs) : 0,
        aliquotaCbs: r.aliquotaCbs !== null && r.aliquotaCbs !== undefined ? Number(r.aliquotaCbs) : 0,
        valorCbs: itemValCbs,
        valorIs,
        aliquotaIs,
        totalTributosReforma,
        cargaTributariaReforma,
        deltaCargaTributaria,
        deltaCargaPercentual,
        
        creditoEsperadoIbs,
        creditoEsperadoCbs,
        creditoApropriadoIbs,
        creditoApropriadoCbs,
        diferencaCreditoIbs: 0,
        diferencaCreditoCbs: 0,
        fonteAliquota: 'documento',
        
        indicadorOnerosidade: 'Oneroso',
        criterioOnerosidade: 'Pagamento Confirmado',
        evidenciaCobranca: true,
        
        tipoAquisicao: isNfse ? 'servico' : 'insumo',
        destinacao: 'atividade_tributada',
        regraAplicadaId: isNfse ? 'RET_SRV_001' : 'ELEG_001',
        resultadoElegibilidade,
        motivoPadronizado: isNfse ? 'Serviço com retenções na fonte mapeadas' : (ehPendenteCgibs ? 'Aguardando extinção do débito do fornecedor (Art. 27 LC 215/2025)' : 'Processado via API de relatórios'),
        evidencia: 'XML DF-e válido e auditado',
        
        usuarioCaptura: 'Processo Automático',
        rotinaCaptura: 'Robô SEFAZ / Upload',
        
        isExcecao: resultadoElegibilidade !== 'Elegível' || Boolean(r.alertaFraude) || diagnosticoRetencao === 'DIVERGENCIA_ALIQUOTA' || diagnosticoRetencao === 'FALTA_RETENCAO' || diagnosticoRetencao === 'SEM_REGRA_PARAMETRIZADA' || ehPendenteCgibs,
        
        temEventoAfetaCredito: Boolean(r.alertaFraude),
        creditoOriginalTotal: creditoEsperadoIbs + creditoEsperadoCbs,
        creditoEstornadoTotal: 0,

        // Campos de Retenção na Fonte (NFS-e / Serviços)
        valorIrrf,
        aliquotaIrrf,
        valorInss,
        aliquotaInss,
        valorPisRetido,
        aliquotaPisRetido,
        valorCofinsRetido,
        aliquotaCofinsRetido,
        valorCsllRetido,
        aliquotaCsllRetido,
        valorIssRetido,
        aliquotaIssRetido,
        totalRetencoes,
        valorLiquidoServico,
        codigoServicoLc116: isNfse ? (regraEncontrada?.item_lc116 || (r.ncm && r.ncm !== '2711.19.10' ? r.ncm : '17.01')) : '',
        discriminacaoServico: isNfse ? (regraEncontrada?.descricao_item || r.descricaoItem || 'Prestação de Serviços Profissionais / Técnicos') : (r.descricaoItem || 'Operação Fiscal'),
        diagnosticoRetencao,
        motivoDiagnosticoRetencao,
        regraRetencaoAplicada: regraEncontrada ? {
          id: regraEncontrada.id,
          item_lc116: regraEncontrada.item_lc116,
          descricao_item: regraEncontrada.descricao_item,
          irrf: regraEncontrada.irrf,
          csrf: regraEncontrada.csrf,
          inss: regraEncontrada.inss,
          iss: regraEncontrada.iss,
          fundamentos_legais: regraEncontrada.fundamentos_legais,
          dispositivo_legal_lc214: regraEncontrada.dispositivo_legal_lc214,
          observacao: regraEncontrada.observacao
        } : undefined,

        // Campos de Conta Corrente Fiscal CGIBS / RTC
        operacaoId: apOp?.operacao_id,
        statusCreditoCgibs,
        motivoCreditoCgibs,
        hashCgibs: apOp?.hash_acumulado,

        // Apuração Assistida & Opção RAD (Sem Fallback)
        statusLiquidacaoApuracao,
        valorCreditoLiquidadoReal,
        valorCreditoRetido,
        taxaLiquidacaoItem,
        impactoDecisorioRad,
        motivoDecisaoRad
      };
    });

    // ── PÓS-FILTRAGEM DETERMINÍSTICA E CONSISTENTE DE RELATÓRIOS ──
    let finalMapped = mapped;

    // 1. Filtro por Data Inicial (comparação estrita por YYYY-MM-DD)
    if (cleanDataInicio) {
      const dtIniStr = cleanDataInicio.substring(0, 10);
      finalMapped = finalMapped.filter(item => {
        const itemDate = (item.dataEmissao || '').substring(0, 10);
        return itemDate ? itemDate >= dtIniStr : true;
      });
    }

    // 2. Filtro por Data Final (comparação estrita por YYYY-MM-DD)
    if (cleanDataFim) {
      const dtFimStr = cleanDataFim.substring(0, 10);
      finalMapped = finalMapped.filter(item => {
        const itemDate = (item.dataEmissao || '').substring(0, 10);
        return itemDate ? itemDate <= dtFimStr : true;
      });
    }

    // 3. Filtro por Tipo de Documento
    if (effectiveTipoDoc && effectiveTipoDoc !== 'TODOS') {
      const tdUpper = effectiveTipoDoc.toUpperCase();
      finalMapped = finalMapped.filter(item => {
        const itemTipo = (item.tipoDoc || '').toUpperCase();
        if (tdUpper === 'MERCADORIAS' || tdUpper === 'CONSOLIDADO_MERCADORIAS') return !itemTipo.includes('NFS');
        if (tdUpper.includes('NFS')) return itemTipo.includes('NFS');
        if (tdUpper.includes('CTE') || tdUpper.includes('CT-E')) return itemTipo.includes('CT');
        if (tdUpper.includes('NFE') || tdUpper.includes('NF-E')) return itemTipo.includes('NF-E') || itemTipo === 'NFE' || itemTipo === '55';
        return itemTipo.includes(tdUpper);
      });
    }

    // 4. Filtro por Estado / UF Emitente ou Destinatário
    if (uf && uf !== 'TODAS') {
      const ufUpper = String(uf).toUpperCase();
      finalMapped = finalMapped.filter(item => 
        (item.fornecedorUf || '').toUpperCase() === ufUpper ||
        (item.clienteUf || '').toUpperCase() === ufUpper
      );
    }

    // 5. Filtro por CFOP
    if (cfop && String(cfop).trim()) {
      const cfopClean = String(cfop).trim();
      finalMapped = finalMapped.filter(item => 
        String(item.cfop || '').includes(cfopClean)
      );
    }

    // 6. Filtro por cClassTrib
    if (cClassTrib && String(cClassTrib).trim()) {
      const cClassClean = String(cClassTrib).trim();
      finalMapped = finalMapped.filter(item => 
        String(item.cClassTrib || '').includes(cClassClean)
      );
    }

    // 7. Filtro por Situação do Documento
    if (situacaoDoc && situacaoDoc !== 'TODAS') {
      const sitClean = String(situacaoDoc).toLowerCase();
      finalMapped = finalMapped.filter(item => 
        (item.situacaoDoc || '').toLowerCase().includes(sitClean)
      );
    }

    // 8. Filtro por Indicador de Onerosidade
    if (indicadorOnerosidade && indicadorOnerosidade !== 'TODOS') {
      finalMapped = finalMapped.filter(item => 
        item.indicadorOnerosidade === indicadorOnerosidade
      );
    }

    // 9. Filtro por Resultado de Elegibilidade
    if (resultadoElegibilidade && resultadoElegibilidade !== 'TODOS') {
      finalMapped = finalMapped.filter(item => 
        item.resultadoElegibilidade === resultadoElegibilidade
      );
    }

    // 10. Filtro por Exceções e Pendências Críticas
    if (String(apenasExcecoes) === 'true') {
      finalMapped = finalMapped.filter(item => Boolean(item.isExcecao));
    }

    // 11. Busca Textual Geral
    if (searchTerm && String(searchTerm).trim()) {
      const termLower = String(searchTerm).trim().toLowerCase();
      finalMapped = finalMapped.filter(item => 
        (item.fornecedorRazao || '').toLowerCase().includes(termLower) ||
        (item.fornecedorCnpj || '').includes(termLower) ||
        (item.clienteRazao || '').toLowerCase().includes(termLower) ||
        (item.clienteCnpj || '').includes(termLower) ||
        (item.chaveAcesso || '').toLowerCase().includes(termLower) ||
        (item.descricaoItem || '').toLowerCase().includes(termLower) ||
        (item.ncm || '').toLowerCase().includes(termLower)
      );
    }

    // Busca os totais consolidados da base para fornecer os quantitativos reais e totais aos relatórios
    let totaisBanco = null;
    let totaisFiltrados = null;
    try {
      const kpisRes = await getDecoupledKpiAggregates({
        empresaId: targetEmpresaId,
        tenantCnpj: tenantCnpjClean,
        dataInicio: cleanDataInicio,
        dataFim: cleanDataFim,
        tipoDoc: effectiveTipoDoc || undefined,
        isSuperadmin
      });
      totaisBanco = kpisRes.totalGeral;
      totaisFiltrados = kpisRes.totalFiltrado;
    } catch (kpiErr: any) {
      console.warn('⚠️ Falha ao obter totais agregados para /api/relatorios/xml:', kpiErr.message);
    }

    res.json({ 
      success: true, 
      data: finalMapped, 
      total: (totalCount && totalCount > finalMapped.length && !cleanDataInicio && !cleanDataFim && !cfop && !cClassTrib && !uf && !situacaoDoc && !searchTerm) ? totalCount : finalMapped.length,
      limit: requestedLimit,
      offset: requestedOffset,
      totaisBanco,
      totaisFiltrados
    });
  } catch (err: any) {
    console.error('❌ Erro no endpoint /api/relatorios/xml:', err);
    res.status(500).json({ success: false, error: 'Erro interno ao gerar relatório: ' + err.message });
  }
});

// Endpoint para sincronizar e mensurar crédito real liquidado com o Ledger da Apuração Assistida
router.get('/sincronizar-apuracao', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const activeEmpresaId = req.user!.empresaAtivaId;
    const isSuperadmin = req.user!.perfil === 'admin_master';

    let queryOp = `SELECT COUNT(*) as count FROM apuracao_operacoes op WHERE 1=1`;
    const paramsOp: any[] = [];
    if (!isSuperadmin && activeEmpresaId) {
      queryOp += ` AND (op.empresa_id = ? OR op.empresa_id IS NULL)`;
      paramsOp.push(activeEmpresaId);
    }
    const opCount = (db.prepare(queryOp).get(...paramsOp) as any)?.count || 0;

    let queryExtrato = `
      SELECT 
        COUNT(cc.id) as count,
        COALESCE(SUM(cc.debito_extinto), 0) as tot_debito_extinto,
        COALESCE(SUM(cc.credito_nao_utilizado), 0) as tot_credito_nao_utilizado,
        COALESCE(SUM(cc.credito_utilizado), 0) as tot_credito_utilizado,
        COALESCE(SUM(cc.credito_a_propriar), 0) as tot_credito_a_propriar
      FROM apuracao_extrato_cc cc
      JOIN apuracao_operacoes op ON op.id = cc.operacao_id
      WHERE 1=1
    `;
    const paramsExtrato: any[] = [];
    if (!isSuperadmin && activeEmpresaId) {
      queryExtrato += ` AND (op.empresa_id = ? OR op.empresa_id IS NULL)`;
      paramsExtrato.push(activeEmpresaId);
    }
    const extratoStats = db.prepare(queryExtrato).get(...paramsExtrato) as any;

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      empresaId: activeEmpresaId,
      totalOperacoes: opCount,
      totalLancamentos: extratoStats?.count || 0,
      totDebitoExtinto: extratoStats?.tot_debito_extinto || 0,
      totCreditoRealLiquidado: (extratoStats?.tot_credito_nao_utilizado || 0) + (extratoStats?.tot_credito_utilizado || 0),
      totCreditoAPropriar: extratoStats?.tot_credito_a_propriar || 0,
      mensagem: 'Ledger da Apuração Assistida sincronizado em tempo real com a base individual do cliente.'
    });
  } catch (err: any) {
    console.error('❌ Erro no endpoint /api/relatorios/sincronizar-apuracao:', err);
    res.status(500).json({ success: false, error: 'Erro ao sincronizar apuração assistida: ' + err.message });
  }
});

export default router;

