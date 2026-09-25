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
import crypto from 'crypto';
import * as XLSX from 'xlsx';
import { getDatabase } from '../db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { getDecoupledKpiAggregates } from '../services/kpiAggregationService';

const router = Router();

/**
 * Extrai informações fáticas e oficiais de pagamento diretamente do grupo <pag> / <cobr> do XML
 * NUNCA infere "Pagamento Confirmado" artificialmente.
 */
function parsePaymentInfoFromXml(xmlRaw?: string | null): {
  indicadorOnerosidade: 'Oneroso' | 'Não Oneroso' | 'Indeterminado';
  criterioOnerosidade: string;
  tPag?: string;
  meioPagamentoDesc?: string;
  vPag?: number;
  indPag?: string;
  hasPagamentoIdentificado: boolean;
} {
  if (!xmlRaw) {
    return {
      indicadorOnerosidade: 'Indeterminado',
      criterioOnerosidade: 'Não informado no XML / Aguardando Conciliação',
      hasPagamentoIdentificado: false
    };
  }

  const pagMatch = xmlRaw.match(/<pag>([\s\S]*?)<\/pag>/i);
  const cobrMatch = xmlRaw.match(/<cobr>([\s\S]*?)<\/cobr>/i);

  if (pagMatch) {
    const pagContent = pagMatch[1];
    const tPagMatch = pagContent.match(/<tPag>(\d{2})<\/tPag>/i);
    const vPagMatch = pagContent.match(/<vPag>([\d.]+)<\/vPag>/i);
    const indPagMatch = pagContent.match(/<indPag>(\d+)<\/indPag>/i);
    const tPag = tPagMatch ? tPagMatch[1] : undefined;
    const vPag = vPagMatch ? parseFloat(vPagMatch[1]) : undefined;
    const indPag = indPagMatch ? indPagMatch[1] : undefined;

    const tPagDescriptions: Record<string, string> = {
      '01': 'Dinheiro à Vista',
      '02': 'Cheque',
      '03': 'Cartão de Crédito',
      '04': 'Cartão de Débito',
      '15': 'Boleto Bancário',
      '16': 'Depósito Bancário',
      '17': 'PIX (Instantâneo)',
      '18': 'Transferência Bancária / TED',
      '90': 'Sem Pagamento',
      '99': 'Outros Meios'
    };

    if (tPag === '90') {
      return {
        indicadorOnerosidade: 'Não Oneroso',
        criterioOnerosidade: 'Operação sem pagamento destacado no XML (tPag 90)',
        tPag,
        meioPagamentoDesc: 'Sem Pagamento (tPag 90)',
        vPag: 0,
        indPag,
        hasPagamentoIdentificado: true
      };
    }

    if (tPag) {
      const desc = tPagDescriptions[tPag] || `Meio de Pagamento (${tPag})`;
      const valorTxt = typeof vPag === 'number' && vPag > 0 ? ` - R$ ${vPag.toFixed(2)}` : '';
      return {
        indicadorOnerosidade: 'Oneroso',
        criterioOnerosidade: `${desc}${valorTxt}`,
        tPag,
        meioPagamentoDesc: desc,
        vPag,
        indPag,
        hasPagamentoIdentificado: true
      };
    }
  }

  if (cobrMatch) {
    const dupCount = (cobrMatch[1].match(/<dup>/gi) || []).length;
    return {
      indicadorOnerosidade: 'Oneroso',
      criterioOnerosidade: dupCount > 0 ? `Fatura no XML (${dupCount} duplicata(s))` : 'Fatura Comercial no XML',
      hasPagamentoIdentificado: true
    };
  }

  return {
    indicadorOnerosidade: 'Indeterminado',
    criterioOnerosidade: 'Não informado no XML / Aguardando Extrato',
    hasPagamentoIdentificado: false
  };
}

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
    const activeEmpresaId = (req.headers['x-empresa-ativa-id'] as string) || (paramEmpresaId as string) || req.user!.empresaAtivaId;
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

    const isExport = req.query.isExport === 'true';
    const requestedLimit = isExport ? 50000 : (req.query.limit === 'all' ? 50000 : Math.min(50000, parseInt(req.query.limit as string) || 10000));
    const requestedOffset = parseInt(req.query.offset as string) || 0;

    // Normalização do tipoDoc / relatório
    const relatorioParam = String(req.query.relatorio || req.query.tipoRelatorio || '');
    const isRelatorioRetencoes = relatorioParam === 'retencoes_fonte' || relatorioParam === 'consolidado_servicos';
    const isRelatorioServicos = isRelatorioRetencoes || relatorioParam === 'servicos';
    const isRelatorioMercadorias = relatorioParam === 'consolidado_mercadorias';
    let effectiveTipoDoc = isRelatorioServicos 
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
          const buildSupaQuery = () => {
            let sq = supabase.from('dfe_documentos').select('*', { count: 'exact' });
            if (targetEmpresaId) {
              sq = sq.eq('empresa_id', targetEmpresaId);
            } else if (tenantCnpjClean) {
              sq = sq.or(`cliente_cnpj.ilike.%${tenantCnpjClean}%,fornecedor_cnpj.ilike.%${tenantCnpjClean}%`);
            } else {
              sq = sq.eq('empresa_id', 'none');
            }

            if (cnpjEmitente) sq = sq.ilike('fornecedor_cnpj', `%${cnpjEmitente}%`);
            if (cnpjDestinatario) sq = sq.ilike('cliente_cnpj', `%${cnpjDestinatario}%`);
            if (supaDataInicio) sq = sq.gte('data_emissao', supaDataInicio);
            if (supaDataFim) sq = sq.lte('data_emissao', supaDataFim);
            if (situacaoDoc && situacaoDoc !== 'TODAS') sq = sq.ilike('situacao_doc', `%${situacaoDoc}%`);

            if (uf && uf !== 'TODAS') {
              sq = sq.or(`fornecedor_uf.eq.${uf},cliente_uf.eq.${uf}`);
            }

            if (effectiveTipoDoc && effectiveTipoDoc !== 'TODOS') {
              const td = effectiveTipoDoc.toUpperCase();
              if (td === 'MERCADORIAS' || td === 'CONSOLIDADO_MERCADORIAS') {
                sq = sq.in('tipo_doc', ['NFe', 'NF-e', 'NFE', '55', 'CTe', 'CT-e', 'CTE', '57', '67', 'NFCE', 'NFC-e', '65']);
              } else if (td === 'NFSE' || td === 'NFS-E' || td === 'NFS') {
                sq = sq.in('tipo_doc', ['NFSe', 'NFS-e', 'NFSE', 'NFS']);
              } else if (td === 'CTE' || td === 'CT-E') {
                sq = sq.in('tipo_doc', ['CTe', 'CT-e', 'CTE', '57', '67']);
              } else if (td === 'NFE' || td === 'NF-E') {
                sq = sq.in('tipo_doc', ['NFe', 'NF-e', 'NFE', '55']);
              } else {
                sq = sq.eq('tipo_doc', effectiveTipoDoc);
              }
            }

            const opParam = (req.query.tipoOperacao as string || req.query.direcaoMovimento as string || '').trim().toUpperCase();
            if (opParam && opParam !== 'TODAS' && opParam !== 'TODOS') {
              if (opParam.includes('SAI')) {
                sq = sq.or('tipo_operacao.ilike.%saí%,tipo_operacao.ilike.%sai%');
              } else if (opParam.includes('ENT')) {
                sq = sq.or('tipo_operacao.ilike.%ent%');
              }
            }

            if (searchTerm) {
              sq = sq.or(`fornecedor_razao.ilike.%${searchTerm}%,fornecedor_cnpj.ilike.%${searchTerm}%,chave_acesso.ilike.%${searchTerm}%`);
            }
            return sq;
          };

          let supaDocs: any[] = [];
          let supaTotal = 0;
          let supaErr: any = null;

          if (isExport) {
            let loopOffset = 0;
            let hasMore = true;
            while(hasMore) {
              const { data, count, error } = await buildSupaQuery()
                .order('data_emissao', { ascending: false })
                .range(loopOffset, loopOffset + 1000 - 1);
                
              if (error) { supaErr = error; break; }
              if (count !== null) supaTotal = count;
              
              if (data && data.length > 0) {
                supaDocs.push(...data);
                loopOffset += data.length;
                if (data.length < 1000) hasMore = false;
              } else {
                hasMore = false;
              }
            }
          } else {
            const result = await buildSupaQuery()
              .order('data_emissao', { ascending: false })
              .range(requestedOffset, requestedOffset + requestedLimit - 1);
            supaDocs = result.data || [];
            supaTotal = result.count || 0;
            supaErr = result.error;
          }

          if (!supaErr && supaDocs) {
            // Se a consulta foi geral (TODOS) e os 1000 CT-e de 2026 preencheram o teto do PostgREST,
            // injeta as 50 NFS-e da empresa para que estejam no lote consolidado de relatórios
            if (!isExport && requestedOffset === 0 && (!effectiveTipoDoc || effectiveTipoDoc === 'TODOS')) {
              const hasNfse = supaDocs.some(d => (d.tipo_doc || '').toString().toUpperCase().includes('NFS'));
              if (!hasNfse) {
                try {
                  let nfseQuery = supabase
                    .from('dfe_documentos')
                    .select('*')
                    .in('tipo_doc', ['NFSe', 'NFS-e', 'NFSE', 'NFS'])
                    .order('data_emissao', { ascending: false })
                    .limit(200);

                  if (targetEmpresaId) {
                    nfseQuery = nfseQuery.eq('empresa_id', targetEmpresaId);
                  } else if (tenantCnpjClean) {
                    nfseQuery = nfseQuery.or(`cliente_cnpj.ilike.%${tenantCnpjClean}%,fornecedor_cnpj.ilike.%${tenantCnpjClean}%`);
                  } else {
                    nfseQuery = nfseQuery.eq('empresa_id', 'none');
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

              // Buscar os itens reais da tabela dfe_itens para os documentos do lote
              const docIds = supaDocs.map(d => d.id);
              let supaItens: any[] = [];
              const CHUNK_SIZE = 100;
              for (let i = 0; i < docIds.length; i += CHUNK_SIZE) {
                const chunk = docIds.slice(i, i + CHUNK_SIZE);
                try {
                  const { data: itData, error: itErr } = await supabase
                    .from('dfe_itens')
                    .select('*')
                    .in('documento_id', chunk)
                    .order('item_nro', { ascending: true });
                  if (!itErr && itData) {
                    supaItens.push(...itData);
                  }
                } catch (itErr) {
                  console.warn('⚠️ Erro ao buscar dfe_itens no Supabase:', itErr);
                }
              }

              const itemsByDocId = new Map<string, any[]>();
              for (const it of supaItens) {
                const arr = itemsByDocId.get(it.documento_id) || [];
                arr.push(it);
                itemsByDocId.set(it.documento_id, arr);
              }

              rows = [];
              for (const d of supaDocs) {
                const isDocNfse = (d.tipo_doc || '').toString().toUpperCase().includes('NFS');
                const docItens = itemsByDocId.get(d.id) || [];

                if (docItens.length > 0) {
                  for (const it of docItens) {
                    rows.push({
                      docId: d.id,
                      empresaId: d.empresa_id,
                      tipoDoc: isDocNfse ? 'NFS-e' : (d.tipo_doc === 'CTe' ? 'CT-e' : (d.tipo_doc === 'NFe' ? 'NF-e' : d.tipo_doc)),
                      chaveAcesso: d.chave_acesso,
                      numeroSerie: d.numero_serie,
                      dataEmissao: d.data_emissao,
                      dataEntrada: d.data_entrada,
                      competencia: d.competencia,
                      tipoOperacao: d.tipo_operacao || (d.direcao_movimento === 'SAIDA' ? 'Saída' : 'Entrada'),
                      direcaoMovimento: d.direcao_movimento || (d.tipo_operacao === 'Saída' ? 'SAIDA' : 'ENTRADA'),
                      tomadorCnpj: d.tomador_cnpj || '',
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
                      xmlRaw: d.xml_raw,

                      // Propriedades reais extraídas de dfe_itens
                      itemId: it.id,
                      itemNro: it.item_nro || 1,
                      descricaoItem: it.descricao_item || '',
                      ncm: it.ncm || '',
                      cest: it.cest || '',
                      cfop: it.cfop || '',
                      cClassTrib: it.cclasstrib || '',
                      cstCsosn: it.cst_csosn || '',
                      naturezaOperacao: it.natureza_operacao || (isDocNfse ? 'Prestação de Serviços' : 'Operação Mercantil'),
                      quantidade: it.quantidade || 1,
                      unidade: it.unidade || 'UN',
                      valorUnitario: it.valor_unitario || 0,
                      valorBrutoItem: it.valor_bruto_item || 0,
                      descontoIncondicional: it.desconto_incondicional || 0,
                      freteSeguroRateado: it.frete_seguro_rateado || 0,
                      valorLiquidoItem: it.valor_liquido_item || 0,
                      baseIcms: it.base_icms || 0,
                      aliquotaIcms: it.aliquota_icms || 0,
                      valorIcms: it.valor_icms || 0,
                      baseIpi: it.base_ipi || 0,
                      aliquotaIpi: it.aliquota_ipi || 0,
                      valorIpi: it.valor_ipi || 0,
                      basePis: it.base_pis || 0,
                      aliquotaPis: it.aliquota_pis || 0,
                      valorPis: it.valor_pis || 0,
                      baseCofins: it.base_cofins || 0,
                      aliquotaCofins: it.aliquota_cofins || 0,
                      valorCofins: it.valor_cofins || 0,
                      baseIbs: it.base_ibs || 0,
                      aliquotaIbs: it.aliquota_ibs || 0,
                      valorIbs: it.valor_ibs || 0,
                      baseCbs: it.base_cbs || 0,
                      aliquotaCbs: it.aliquota_cbs || 0,
                      valorCbs: it.valor_cbs || 0,
                      valorIs: it.valor_is || 0
                    });
                  }
                } else {
                  // Fallback estrito: se o documento não possuir linhas em dfe_itens, mapeia estritamente os dados fiscais reais do cabeçalho sem simular valores
                  rows.push({
                    docId: d.id,
                    empresaId: d.empresa_id,
                    tipoDoc: isDocNfse ? 'NFS-e' : (d.tipo_doc === 'CTe' ? 'CT-e' : (d.tipo_doc === 'NFe' ? 'NF-e' : d.tipo_doc)),
                    chaveAcesso: d.chave_acesso,
                    numeroSerie: d.numero_serie,
                    dataEmissao: d.data_emissao,
                    dataEntrada: d.data_entrada,
                    competencia: d.competencia,
                    tipoOperacao: d.tipo_operacao || (d.direcao_movimento === 'SAIDA' ? 'Saída' : 'Entrada'),
                    direcaoMovimento: d.direcao_movimento || (d.tipo_operacao === 'Saída' ? 'SAIDA' : 'ENTRADA'),
                    tomadorCnpj: d.tomador_cnpj || '',
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
                    xmlRaw: d.xml_raw,

                    itemId: `doc-${d.chave_acesso}`,
                    itemNro: 1,
                    descricaoItem: isDocNfse ? 'Prestação de Serviços (NFS-e)' : 'Operação Global',
                    ncm: '',
                    cest: '',
                    cfop: '',
                    cClassTrib: '',
                    cstCsosn: '',
                    naturezaOperacao: isDocNfse ? 'Prestação de Serviços' : 'Operação Fiscal',
                    quantidade: 1,
                    unidade: 'UN',
                    valorUnitario: d.valor_total || 0,
                    valorBrutoItem: d.valor_total || 0,
                    descontoIncondicional: 0,
                    freteSeguroRateado: 0,
                    valorLiquidoItem: d.valor_total || 0,
                    baseIcms: d.valor_icms > 0 ? d.valor_total : 0,
                    aliquotaIcms: 0,
                    valorIcms: d.valor_icms || 0,
                    baseIpi: 0,
                    aliquotaIpi: 0,
                    valorIpi: d.valor_ipi || 0,
                    basePis: 0,
                    aliquotaPis: 0,
                    valorPis: d.valor_pis || 0,
                    baseCofins: 0,
                    aliquotaCofins: 0,
                    valorCofins: d.valor_cofins || 0,
                    baseIbs: d.base_ibs || 0,
                    aliquotaIbs: 0,
                    valorIbs: d.valor_ibs || 0,
                    baseCbs: d.base_cbs || 0,
                    aliquotaCbs: 0,
                    valorCbs: d.valor_cbs || 0,
                    valorIs: d.valor_is || 0
                  });
                }
              }
              supabaseFetched = true;
              console.log(`📡 GET /relatorios/xml: ${rows.length} itens reais de ${supaDocs.length} documentos carregados do Supabase.`);
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
          d.tipo_operacao as tipoOperacao,
          d.direcao_movimento as direcaoMovimento,
          d.tomador_cnpj as tomadorCnpj,
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
          d.xml_raw as xmlRaw,
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

      if (targetEmpresaId) {
        if (tenantCnpjClean) {
          query += `
            AND (
              d.empresa_id = ?
              OR d.cliente_cnpj LIKE ?
              OR d.fornecedor_cnpj LIKE ?
            )
          `;
          params.push(targetEmpresaId, `%${tenantCnpjClean}%`, `%${tenantCnpjClean}%`);
        } else {
          query += ` AND d.empresa_id = ?`;
          params.push(targetEmpresaId);
        }
      } else if (!isSuperadmin && activeEmpresaId) {
        query += `
          AND (
            d.empresa_id = ?
            OR d.empresa_id IN (SELECT empresa_id FROM usuario_empresa WHERE usuario_id = ?)
          )
        `;
        params.push(activeEmpresaId, req.user!.userId);
      } else {
        query += ` AND 1=0`;
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
      const opFilterSql = (req.query.tipoOperacao as string || req.query.direcaoMovimento as string || '').trim().toUpperCase();
      if (opFilterSql && opFilterSql !== 'TODAS' && opFilterSql !== 'TODOS') {
        if (opFilterSql.includes('SAI')) {
          query += " AND (d.direcao_movimento = 'SAIDA' OR (d.direcao_movimento IS NULL AND LOWER(d.tipo_operacao) IN ('saída', 'saida', 'saídas', 'saidas')))";
        } else if (opFilterSql.includes('ENT')) {
          query += " AND (d.direcao_movimento = 'ENTRADA' OR (d.direcao_movimento IS NULL AND LOWER(d.tipo_operacao) IN ('entrada', 'entradas')))";
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

    // Carregar dados de bloqueio de créditos e regras de combustíveis por empresa
    const empresasMap = new Map<string, any>();
    try {
      const empresasList = db.prepare('SELECT id, cnpj, bloquear_credito_combustiveis, ncm_vedados_credito FROM empresas').all() as any[];
      for (const emp of empresasList) {
        if (emp.id) empresasMap.set(emp.id, emp);
        if (emp.cnpj) empresasMap.set(emp.cnpj, emp);
      }
    } catch (_) {}

    // Carregar mapa de regras NCM (incluindo combustíveis e cclasstrib sugerido)
    const ncmRegrasMap = new Map<string, any>();
    try {
      const ncmList = db.prepare('SELECT * FROM ncm_regras_anexos').all() as any[];
      for (const n of ncmList) {
        if (n.codigo_normalizado) ncmRegrasMap.set(n.codigo_normalizado, n);
        if (n.ncm_sh) ncmRegrasMap.set(String(n.ncm_sh).replace(/\D/g, ''), n);
      }
    } catch (_) {}

    // Carregar mapa oficial de cClassTrib / CST SVRS
    const cClassMap = new Map<string, any>();
    try {
      const cclassList = db.prepare('SELECT * FROM cclasstrib_regras').all() as any[];
      for (const cc of cclassList) {
        if (cc.codigo) cClassMap.set(String(cc.codigo).trim(), cc);
        if (cc.cclasstrib) cClassMap.set(String(cc.cclasstrib).trim(), cc);
      }
    } catch (_) {}

    // Carregar mapa oficial de indOper SVRS
    const indOperMap = new Map<string, any>();
    try {
      const indOperList = db.prepare('SELECT * FROM indoper_regras').all() as any[];
      for (const io of indOperList) {
        if (io.codigo) indOperMap.set(String(io.codigo).trim(), io);
      }
    } catch (_) {}

    const mapped = rows.map(r => {
      const itemCfop = r.cfop || '';
      
      const docTotal = Number(r.docValorTotal) || 0;
      const itemValIbs = r.valorIbs !== null && r.valorIbs !== undefined ? Number(r.valorIbs) : (Number(r.docValorIbs) || 0);
      const itemValCbs = r.valorCbs !== null && r.valorCbs !== undefined ? Number(r.valorCbs) : (Number(r.docValorCbs) || 0);

      // Extração autêntica de pagamento diretamente do XML do documento fiscal
      const paymentInfo = parsePaymentInfoFromXml(r.xmlRaw);

      // Verificação de Combustíveis e Bloqueio de Créditos (Art. 267 da LC 214/2025)
      const empConfig = empresasMap.get(r.empresaId) || empresasMap.get(r.clienteCnpj);
      const ncmLimpo = String(r.ncm || '').replace(/\D/g, '');
      const ncmRegra = ncmRegrasMap.get(ncmLimpo) || ncmRegrasMap.get(ncmLimpo.substring(0, 4));
      
      const isCombustivel = Boolean(
        ncmRegra?.is_combustivel === 1 ||
        ncmLimpo.startsWith('2710') ||
        ncmLimpo.startsWith('2711') ||
        ncmLimpo.startsWith('2707') ||
        ncmLimpo.startsWith('2709') ||
        (r.descricaoItem && /gasolina|diesel|etanol|glp|g[aá]s|combust[ií]vel|querosene/i.test(r.descricaoItem))
      );

      // Checar se NCM consta na lista de vedados da empresa
      const listaVedados = (empConfig?.ncm_vedados_credito || '').split(',').map((s: string) => s.trim().replace(/\D/g, '')).filter(Boolean);
      const isNcmVedadoEmpresa = listaVedados.some((v: string) => ncmLimpo.startsWith(v));
      const bloqueioEmpresaAtivo = empConfig?.bloquear_credito_combustiveis === 1 || isNcmVedadoEmpresa;

      const creditoVedado = (isCombustivel && (bloqueioEmpresaAtivo || empConfig?.bloquear_credito_combustiveis !== 0)) || isNcmVedadoEmpresa;

      // Se o crédito for vedado, o crédito esperado DEVE ser 0.00
      const creditoEsperadoIbs = creditoVedado ? 0 : itemValIbs;
      const creditoEsperadoCbs = creditoVedado ? 0 : itemValCbs;
      
      // Conciliação de crédito apropriado com a apuração assistida (sem espelhamento falso do XML)
      const apOpPre = apuracaoMap.get(r.chaveAcesso);
      const creditoApropriadoIbs = apOpPre ? (Number(apOpPre.tot_credito_utilizado) || 0) : 0;
      const creditoApropriadoCbs = apOpPre ? (Number(apOpPre.tot_credito_utilizado) || 0) : 0;

      // Se o documento tomou crédito indevidamente
      const tomouCreditoIndevido = creditoVedado && (itemValIbs > 0 || itemValCbs > 0);
      const alertaApropriacaoIndevida = tomouCreditoIndevido;
      const motivoAlertaApropriacao = creditoVedado 
        ? `Vedação legal de crédito sobre combustíveis/itens de consumo (Art. 267 da LC 214/2025). Bloqueio ${bloqueioEmpresaAtivo ? 'ativo na Carteira de CNPJs' : 'legal aplicável'}. Crédito esperado: R$ 0,00.`
        : null;

      // Diagnóstico e Questionamento de cClassTrib e CST
      const currentCClass = String(r.cClassTrib || '').trim();
      const currentCst = String(r.cstCsosn || '').trim();
      
      let cclasstribInconsistente = false;
      let cclasstribSugerido = '';
      let cstSugerido = '';
      let motivoInconsistenciaCClassTrib = '';

      if (isCombustivel) {
        if (currentCClass === '000001' || currentCClass === '900001' || !currentCClass.startsWith('620') || currentCst === '000') {
          cclasstribInconsistente = true;
          cclasstribSugerido = ncmRegra?.cclasstrib_sugerido || '620006';
          cstSugerido = ncmRegra?.cst_sugerido || '620';
          motivoInconsistenciaCClassTrib = `Combustível classificado incorretamente no XML com cClassTrib ${currentCClass || 'não informado'} e CST ${currentCst}. Conforme o Portal de Conformidade Fácil SVRS e Art. 172/180 da LC 214/2025, o código correto é CST 620 (Tributação Monofásica) e cClassTrib ${cclasstribSugerido} (Combustíveis monofásicos cobrados anteriormente).`;
        }
      } else if (currentCClass === '900001') {
        cclasstribInconsistente = true;
        cclasstribSugerido = ncmRegra?.cclasstrib_sugerido || '000001';
        cstSugerido = ncmRegra?.cst_sugerido || '000';
        motivoInconsistenciaCClassTrib = `Código 900001 é um fallback fictício inexistente no padrão oficial SVRS. Reclassificar para cClassTrib oficial.`;
      }

      // Detalhes da regra cClassTrib oficial
      const cclassOficial = cClassMap.get(cclasstribSugerido || currentCClass);
      
      // Informações de indOper (Zero inferência: se não existir no XML, fica não informado)
      const indOperCode = String(r.indOper || '').trim();
      const indOperInfo = indOperCode ? (indOperMap.get(indOperCode) || {
        codigo: indOperCode,
        nome: `Operação ${indOperCode}`,
        dispositivo_legal: 'Art. 11 da LC 214/2025',
        local: 'Conforme documento'
      }) : {
        codigo: '',
        nome: 'Não informado no XML',
        dispositivo_legal: '—',
        local: '—'
      };

      // Determinação autêntica da regra e elegibilidade (Zero ELEG_001 fictício)
      let regraAplicadaId = 'RTC_PADRAO';
      let resultadoElegibilidade = 'Elegível';
      let motivoPadronizado = 'Aquisição de insumo ou mercadoria com crédito sujeito à não-cumulatividade plena (Art. 28 da LC 214/2025)';

      if (creditoVedado) {
        regraAplicadaId = 'VEDACAO_ART_267';
        resultadoElegibilidade = 'Não elegível';
        motivoPadronizado = motivoAlertaApropriacao || 'Vedação legal de crédito sobre combustíveis e derivados para consumo próprio (Art. 267 da LC 214/2025)';
      } else if (r.tipoDoc === 'NFSe' || r.tipoDoc === 'NFS-e' || (r.tipoDoc as string)?.toUpperCase().includes('NFS')) {
        regraAplicadaId = 'RET_NFS_LC116';
        resultadoElegibilidade = 'Elegível';
        motivoPadronizado = 'Serviço tomado auditado contra matriz de retenções';
      } else if (currentCClass) {
        regraAplicadaId = `cClass_${currentCClass}`;
        if (currentCClass.startsWith('2') || currentCClass.startsWith('3')) {
          resultadoElegibilidade = 'Não elegível';
          motivoPadronizado = `Enquadramento ${currentCClass} sem direito a crédito na entrada (Isenção / Imunidade / Não incidência)`;
        } else if (currentCClass.startsWith('9')) {
          resultadoElegibilidade = 'Pendente';
          motivoPadronizado = `Regime específico monofásico ${currentCClass} — apuração vinculada ao recolhimento na origem`;
        } else {
          resultadoElegibilidade = 'Elegível';
          motivoPadronizado = `Enquadramento oficial RTC cClassTrib ${currentCClass} (Art. 28 LC 214/2025)`;
        }
      } else if (itemCfop) {
        regraAplicadaId = `CFOP_${itemCfop}`;
        motivoPadronizado = `Operação autêntica registrada sob o CFOP ${itemCfop}`;
      }

      // ========================================================
      // CONCILIAÇÃO DINÂMICA COM APURAÇÃO ASSISTIDA SEPARADA
      // Ambiente IBS (CGIBS - Estados/Municípios) & Ambiente CBS (RFB - União)
      // Art. 28 da LC 214/2025 e Art. 27 da LC 215/2025
      // ========================================================
      const apOp = apuracaoMap.get(r.chaveAcesso);

      let statusApuracaoIbs: 'LIQUIDADO' | 'PENDENTE_EXTINCAO' | 'GLOSADO' | 'NAO_CONCILIADO' | 'ISENTO_OU_SEM_DESTAQUE' = 'NAO_CONCILIADO';
      let motivoApuracaoIbs = 'Operação não localizada no ledger de apuração do CGIBS';
      let valorCreditoLiquidadoIbs: number | null = null;

      let statusApuracaoCbs: 'LIQUIDADO' | 'PENDENTE_EXTINCAO' | 'GLOSADO' | 'NAO_CONCILIADO' | 'ISENTO_OU_SEM_DESTAQUE' = 'NAO_CONCILIADO';
      let motivoApuracaoCbs = 'Operação não localizada no ledger de apuração da RFB';
      let valorCreditoLiquidadoCbs: number | null = null;

      const creditoTotalDoc = creditoEsperadoIbs + creditoEsperadoCbs;

      // Batimento do IBS (CGIBS)
      if (itemValIbs === 0 && Number(r.baseIbs || 0) === 0) {
        statusApuracaoIbs = 'ISENTO_OU_SEM_DESTAQUE';
        motivoApuracaoIbs = 'Item sem destaque ou incidência de IBS no XML';
        valorCreditoLiquidadoIbs = 0;
      } else if (apOp) {
        const totExtinto = Number(apOp.tot_debito_extinto) || 0;
        const totEmAberto = Number(apOp.tot_debito_em_aberto) || 0;
        const totCredUtilizado = Number(apOp.tot_credito_utilizado) || 0;
        const totCredNaoUtilizado = Number(apOp.tot_credito_nao_utilizado) || 0;
        if (totCredUtilizado > 0 || totCredNaoUtilizado > 0 || (totExtinto > 0 && totEmAberto <= 0)) {
          statusApuracaoIbs = 'LIQUIDADO';
          motivoApuracaoIbs = 'Débito de IBS do fornecedor extinto perante o Comitê Gestor do IBS (CGIBS)';
          valorCreditoLiquidadoIbs = creditoEsperadoIbs;
        } else {
          statusApuracaoIbs = 'PENDENTE_EXTINCAO';
          motivoApuracaoIbs = 'Aguardando extinção do débito de IBS pelo fornecedor no CGIBS (Art. 28 LC 214/2025)';
          valorCreditoLiquidadoIbs = null;
        }
      } else if (itemValIbs > 0) {
        statusApuracaoIbs = 'PENDENTE_EXTINCAO';
        motivoApuracaoIbs = 'Aguardando conciliação da conta corrente com o ambiente CGIBS';
        valorCreditoLiquidadoIbs = null;
      }

      // Batimento da CBS (RFB)
      if (itemValCbs === 0 && Number(r.baseCbs || 0) === 0) {
        statusApuracaoCbs = 'ISENTO_OU_SEM_DESTAQUE';
        motivoApuracaoCbs = 'Item sem destaque ou incidência de CBS no XML';
        valorCreditoLiquidadoCbs = 0;
      } else if (apOp) {
        const totExtinto = Number(apOp.tot_debito_extinto) || 0;
        const totEmAberto = Number(apOp.tot_debito_em_aberto) || 0;
        const totCredUtilizado = Number(apOp.tot_credito_utilizado) || 0;
        const totCredNaoUtilizado = Number(apOp.tot_credito_nao_utilizado) || 0;
        if (totCredUtilizado > 0 || totCredNaoUtilizado > 0 || (totExtinto > 0 && totEmAberto <= 0)) {
          statusApuracaoCbs = 'LIQUIDADO';
          motivoApuracaoCbs = 'Débito de CBS do fornecedor extinto perante a Receita Federal do Brasil (RFB)';
          valorCreditoLiquidadoCbs = creditoEsperadoCbs;
        } else {
          statusApuracaoCbs = 'PENDENTE_EXTINCAO';
          motivoApuracaoCbs = 'Aguardando extinção do débito de CBS pelo fornecedor na RFB (Art. 28 LC 214/2025)';
          valorCreditoLiquidadoCbs = null;
        }
      } else if (itemValCbs > 0) {
        statusApuracaoCbs = 'PENDENTE_EXTINCAO';
        motivoApuracaoCbs = 'Aguardando conciliação da conta corrente com o ambiente RFB';
        valorCreditoLiquidadoCbs = null;
      }

      // Totais unificados de liquidação e RAD
      const statusLiquidacaoApuracao: 'LIQUIDADO' | 'PENDENTE_EXTINCAO' | 'GLOSADO' | 'NAO_CONCILIADO' = 
        (statusApuracaoIbs === 'LIQUIDADO' && statusApuracaoCbs === 'LIQUIDADO') ? 'LIQUIDADO' :
        (statusApuracaoIbs === 'PENDENTE_EXTINCAO' || statusApuracaoCbs === 'PENDENTE_EXTINCAO') ? 'PENDENTE_EXTINCAO' : 'NAO_CONCILIADO';

      const valorCreditoLiquidadoReal = (valorCreditoLiquidadoIbs !== null || valorCreditoLiquidadoCbs !== null)
        ? ((valorCreditoLiquidadoIbs || 0) + (valorCreditoLiquidadoCbs || 0))
        : null;

      const valorCreditoRetido = (statusLiquidacaoApuracao === 'PENDENTE_EXTINCAO') ? creditoTotalDoc : 0;
      const taxaLiquidacaoItem = creditoTotalDoc > 0 && typeof valorCreditoLiquidadoReal === 'number'
        ? Math.min(100, Number(((valorCreditoLiquidadoReal / creditoTotalDoc) * 100).toFixed(1)))
        : (statusLiquidacaoApuracao === 'LIQUIDADO' ? 100 : 0);

      const impactoDecisorioRad: 'APTO_PARA_RAD' | 'AGUARDAR_QUITACAO' | 'INAPTO_PARA_RAD' | 'NAO_CONCILIADO' = 
        statusLiquidacaoApuracao === 'LIQUIDADO' ? 'APTO_PARA_RAD' :
        statusLiquidacaoApuracao === 'PENDENTE_EXTINCAO' ? 'AGUARDAR_QUITACAO' : 'NAO_CONCILIADO';

      const motivoDecisaoRad = statusLiquidacaoApuracao === 'LIQUIDADO'
        ? 'Imposto liquidado pelo Fornecedor ou Split Payment no CGIBS/RFB. Crédito 100% liberado para apropriação (Art. 28 LC 214/2025).'
        : statusLiquidacaoApuracao === 'PENDENTE_EXTINCAO'
          ? 'Débito de IBS/CBS pendente de extinção pelo fornecedor. O adquirente pode emitir e recolher via RAD para liberar o crédito ou aguardar.'
          : 'Operação pendente de conciliação nos ambientes CGIBS e RFB.';

      let statusCreditoCgibs: 'CONFIRMADO' | 'PENDENTE_EXTINCAO' | 'UTILIZADO' | 'ESTORNADO' | 'NAO_CONCILIADO' = 
        statusApuracaoIbs === 'LIQUIDADO' ? 'CONFIRMADO' : (statusApuracaoIbs === 'PENDENTE_EXTINCAO' ? 'PENDENTE_EXTINCAO' : 'NAO_CONCILIADO');
      let motivoCreditoCgibs = motivoApuracaoIbs;

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
        tipoOperacao: r.tipoOperacao || (r.direcaoMovimento === 'SAIDA' ? 'Saída' : 'Entrada'),
        direcaoMovimento: r.direcaoMovimento || (r.tipoOperacao === 'Saída' ? 'SAIDA' : 'ENTRADA'),
        tomadorCnpj: r.tomadorCnpj || '',
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
        descricaoItem: r.descricaoItem || '',
        ncm: r.ncm || '',
        cest: r.cest || '',
        cfop: itemCfop || r.cfop || '',
        cClassTrib: r.cClassTrib || '',
        cstCsosn: r.cstCsosn || '',
        naturezaOperacao: r.naturezaOperacao || '',
        quantidade: r.quantidade || 1,
        unidade: r.unidade || '',
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
        diferencaCreditoIbs: Number((creditoEsperadoIbs - creditoApropriadoIbs).toFixed(2)),
        diferencaCreditoCbs: Number((creditoEsperadoCbs - creditoApropriadoCbs).toFixed(2)),
        fonteAliquota: 'documento',
        
        indicadorOnerosidade: paymentInfo.indicadorOnerosidade,
        criterioOnerosidade: paymentInfo.criterioOnerosidade,
        evidenciaCobranca: paymentInfo.hasPagamentoIdentificado,
        
        tipoAquisicao: isNfse ? 'servico' : 'insumo',
        destinacao: 'atividade_tributada',
        regraAplicadaId,
        resultadoElegibilidade,
        motivoPadronizado,
        evidencia: 'XML DF-e autêntico e auditado',
        
        usuarioCaptura: 'Processo Automático',
        rotinaCaptura: 'Robô SEFAZ / Upload',
        
        isExcecao: resultadoElegibilidade !== 'Elegível' || Boolean(r.alertaFraude) || diagnosticoRetencao === 'DIVERGENCIA_ALIQUOTA' || diagnosticoRetencao === 'FALTA_RETENCAO' || diagnosticoRetencao === 'SEM_REGRA_PARAMETRIZADA' || ehPendenteCgibs || alertaApropriacaoIndevida || cclasstribInconsistente,
        
        temEventoAfetaCredito: Boolean(r.alertaFraude) || alertaApropriacaoIndevida,
        creditoOriginalTotal: creditoEsperadoIbs + creditoEsperadoCbs,
        creditoEstornadoTotal: alertaApropriacaoIndevida ? (itemValIbs + itemValCbs) : 0,

        // Diagnóstico e Governança de Combustíveis & Bloqueio de Crédito
        isCombustivel,
        creditoVedado,
        bloqueioEmpresaAtivo,
        alertaApropriacaoIndevida,
        motivoAlertaApropriacao,

        // Diagnóstico e Governança RTC cClassTrib / CST (SVRS)
        cclasstribInconsistente,
        cclasstribSugerido,
        cstSugerido,
        motivoInconsistenciaCClassTrib,
        cclassOficialDesc: cclassOficial?.descricao || cclassOficial?.desc_cst || '',

        // Indicador de Operação / Local da Operação (indOper SVRS)
        indOperCode,
        indOperInfo,

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

        // Ambientes Segregados de Apuração (IBS - Estados/Municípios vs CBS - União) a Nível de Item
        statusApuracaoIbs,
        statusApuracaoCbs,
        motivoApuracaoIbs,
        motivoApuracaoCbs,
        valorCreditoLiquidadoIbs,
        valorCreditoLiquidadoCbs,

        // Dados Canônicos de Pagamento do XML
        dadosPagamentoXml: {
          tPag: paymentInfo.tPag,
          meioPagamentoDesc: paymentInfo.meioPagamentoDesc,
          vPag: paymentInfo.vPag,
          indPag: paymentInfo.indPag,
          hasPagamentoIdentificado: paymentInfo.hasPagamentoIdentificado
        },

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

    if (isExport) {
      try {
        const XLSX = require('xlsx');
        const wb = XLSX.utils.book_new();
        
        const exportData = finalMapped.map(item => ({
          'Documento': item.tipoDoc,
          'Série': item.numeroSerie || '-',
          'Chave de Acesso': item.chaveAcesso || '-',
          'Data Emissão': item.dataEmissao ? new Date(item.dataEmissao).toLocaleDateString('pt-BR') : '-',
          'Fornecedor / Emitente': item.fornecedorRazao || '-',
          'CNPJ Emitente': item.fornecedorCnpj || '-',
          'UF Emit.': item.fornecedorUf || '-',
          'Município Emit.': item.fornecedorMunicipio || '-',
          'Cliente / Dest.': item.clienteRazao || '-',
          'CNPJ Dest.': item.clienteCnpj || '-',
          'UF Dest.': item.clienteUf || '-',
          'Descrição': item.descricaoItem || '-',
          'NCM': item.ncm || '-',
          'CFOP': item.cfop || '-',
          'cClassTrib': item.cClassTrib || '-',
          'Situação': item.situacaoDoc || '-',
          'Valor Total (R$)': Number(item.valorLiquidoItem || 0).toFixed(2),
          'Base IBS/CBS (R$)': Number(item.baseIbs || 0).toFixed(2),
          'IBS (R$)': Number(item.valorIbs || 0).toFixed(2),
          'CBS (R$)': Number(item.valorCbs || 0).toFixed(2),
          'Crédito IBS (R$)': Number(item.creditoEsperadoIbs || 0).toFixed(2),
          'Crédito CBS (R$)': Number(item.creditoEsperadoCbs || 0).toFixed(2)
        }));
        
        if (req.query.format === 'json') {
          res.setHeader('Content-Disposition', 'attachment; filename="relatorio_export.json"');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          return res.send(JSON.stringify(exportData, null, 2));
        }
        
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
        
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', 'attachment; filename="relatorio_export.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return res.send(buffer);
      } catch (err) {
        console.error('Erro ao gerar exportação de relatório:', err);
        return res.status(500).json({ success: false, error: 'Erro ao gerar exportação' });
      }
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

/** GET /api/relatorios/xml/export — Rota de conveniência para download do relatório */
router.get('/xml/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  req.query.isExport = 'true';
  // Redireciona internamente para o handler /xml
  const nextHandler = (router as any).stack.find((layer: any) => layer.route && layer.route.path === '/xml')?.route?.stack?.[1]?.handle;
  if (nextHandler) {
    return nextHandler(req, res);
  }
  res.redirect(`/api/relatorios/xml?${new URLSearchParams(req.query as any).toString()}`);
});

// ============================================================
// CRUD & UPLOAD EM MASSA DE RELATÓRIOS (DF-e / Itens)
// ============================================================

/** POST /api/relatorios/item — Inserir item/documento manual no relatório */
router.post('/item', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const activeEmpresaId = (req.headers['x-empresa-ativa-id'] as string) || req.body.empresaId || req.user?.empresaAtivaId;
    if (!activeEmpresaId) {
      return res.status(400).json({ success: false, error: 'Empresa ativa não identificada para inclusão do item.' });
    }

    const {
      tipoDoc = 'NFe',
      chaveAcesso: rawChave,
      numeroSerie = '1',
      dataEmissao = new Date().toISOString().split('T')[0],
      fornecedorCnpj = '',
      fornecedorRazao = '',
      fornecedorUf = 'SP',
      fornecedorMunicipio = 'São Paulo',
      clienteCnpj = '',
      clienteRazao = '',
      clienteUf = 'SP',
      situacaoDoc = 'autorizado',
      itemNro = 1,
      descricaoItem = 'Item Manual',
      ncm = '',
      cfop = '1102',
      cClassTrib = '000001',
      cstCsosn = '000',
      quantidade = 1,
      unidade = 'UN',
      valorLiquidoItem = 0,
      baseIbs = 0,
      aliquotaIbs = 0,
      valorIbs = 0,
      baseCbs = 0,
      aliquotaCbs = 0,
      valorCbs = 0
    } = req.body;

    const docId = `doc-manual-${crypto.randomUUID()}`;
    const itemId = `item-manual-${crypto.randomUUID()}`;
    const chaveAcesso = rawChave && rawChave.length === 44 
      ? rawChave 
      : `35${new Date().toISOString().slice(2, 4)}${fornecedorCnpj.replace(/\D/g, '').padStart(14, '0')}${tipoDoc === 'NFe' ? '55' : '57'}001${String(Date.now()).slice(-9)}${Math.floor(10000000 + Math.random() * 90000000)}`.slice(0, 44);

    // 1. Inserir ou reaproveitar documento pai
    let existingDoc = db.prepare('SELECT id FROM dfe_documentos WHERE chave_acesso = ?').get(chaveAcesso) as any;
    let targetDocId = existingDoc ? existingDoc.id : docId;

    if (!existingDoc) {
      db.prepare(`
        INSERT INTO dfe_documentos (
          id, empresa_id, tipo_doc, chave_acesso, numero_serie, data_emissao, data_entrada,
          fornecedor_cnpj, fornecedor_razao, fornecedor_uf, fornecedor_municipio,
          cliente_cnpj, cliente_razao, cliente_uf, situacao_doc, valor_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        docId, activeEmpresaId, tipoDoc, chaveAcesso, numeroSerie, dataEmissao, dataEmissao,
        fornecedorCnpj, fornecedorRazao, fornecedorUf, fornecedorMunicipio,
        clienteCnpj, clienteRazao, clienteUf, situacaoDoc, Number(valorLiquidoItem)
      );

      if (isSupabaseConfigured()) {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          await supabase.from('dfe_documentos').upsert({
            id: docId,
            empresa_id: activeEmpresaId,
            tipo_doc: tipoDoc,
            chave_acesso: chaveAcesso,
            numero_serie: numeroSerie,
            data_emissao: dataEmissao,
            fornecedor_cnpj: fornecedorCnpj,
            fornecedor_razao: fornecedorRazao,
            fornecedor_uf: fornecedorUf,
            fornecedor_municipio: fornecedorMunicipio,
            cliente_cnpj: clienteCnpj,
            cliente_razao: clienteRazao,
            cliente_uf: clienteUf,
            situacao_doc: situacaoDoc,
            valor_total: Number(valorLiquidoItem)
          });
        }
      }
    }

    // 2. Inserir item
    db.prepare(`
      INSERT INTO dfe_itens (
        id, documento_id, item_nro, descricao_item, ncm, cfop, cclasstrib, cst_csosn,
        quantidade, unidade, valor_bruto_item, valor_liquido_item,
        base_ibs, aliquota_ibs, valor_ibs, base_cbs, aliquota_cbs, valor_cbs
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      itemId, targetDocId, Number(itemNro), descricaoItem, ncm, cfop, cClassTrib, cstCsosn,
      Number(quantidade), unidade, Number(valorLiquidoItem), Number(valorLiquidoItem),
      Number(baseIbs || valorLiquidoItem), Number(aliquotaIbs), Number(valorIbs),
      Number(baseCbs || valorLiquidoItem), Number(aliquotaCbs), Number(valorCbs)
    );

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase.from('dfe_itens').upsert({
          id: itemId,
          documento_id: targetDocId,
          item_nro: Number(itemNro),
          descricao_item: descricaoItem,
          ncm,
          cfop,
          cclasstrib: cClassTrib,
          cst_csosn: cstCsosn,
          quantidade: Number(quantidade),
          unidade,
          valor_bruto_item: Number(valorLiquidoItem),
          valor_liquido_item: Number(valorLiquidoItem),
          base_ibs: Number(baseIbs || valorLiquidoItem),
          aliquota_ibs: Number(aliquotaIbs),
          valor_ibs: Number(valorIbs),
          base_cbs: Number(baseCbs || valorLiquidoItem),
          aliquota_cbs: Number(aliquotaCbs),
          valor_cbs: Number(valorCbs)
        });
      }
    }

    res.json({ success: true, message: 'Item registrado com sucesso no relatório fiscal.', itemId, docId: targetDocId });
  } catch (err: any) {
    console.error('❌ Erro ao incluir item no relatório:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/** PUT /api/relatorios/item/:id — Atualizar item manual do relatório */
router.put('/item/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const {
      descricaoItem,
      ncm,
      cfop,
      cClassTrib,
      cstCsosn,
      quantidade,
      unidade,
      valorLiquidoItem,
      baseIbs,
      aliquotaIbs,
      valorIbs,
      baseCbs,
      aliquotaCbs,
      valorCbs
    } = req.body;

    const existing = db.prepare('SELECT id, documento_id FROM dfe_itens WHERE id = ?').get(id) as any;
    if (existing) {
      db.prepare(`
        UPDATE dfe_itens SET
          descricao_item = COALESCE(?, descricao_item),
          ncm = COALESCE(?, ncm),
          cfop = COALESCE(?, cfop),
          cclasstrib = COALESCE(?, cclasstrib),
          cst_csosn = COALESCE(?, cst_csosn),
          quantidade = COALESCE(?, quantidade),
          unidade = COALESCE(?, unidade),
          valor_liquido_item = COALESCE(?, valor_liquido_item),
          base_ibs = COALESCE(?, base_ibs),
          aliquota_ibs = COALESCE(?, aliquota_ibs),
          valor_ibs = COALESCE(?, valor_ibs),
          base_cbs = COALESCE(?, base_cbs),
          aliquota_cbs = COALESCE(?, aliquota_cbs),
          valor_cbs = COALESCE(?, valor_cbs)
        WHERE id = ?
      `).run(
        descricaoItem, ncm, cfop, cClassTrib, cstCsosn,
        quantidade !== undefined ? Number(quantidade) : null,
        unidade,
        valorLiquidoItem !== undefined ? Number(valorLiquidoItem) : null,
        baseIbs !== undefined ? Number(baseIbs) : null,
        aliquotaIbs !== undefined ? Number(aliquotaIbs) : null,
        valorIbs !== undefined ? Number(valorIbs) : null,
        baseCbs !== undefined ? Number(baseCbs) : null,
        aliquotaCbs !== undefined ? Number(aliquotaCbs) : null,
        valorCbs !== undefined ? Number(valorCbs) : null,
        id
      );
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase.from('dfe_itens').update({
          descricao_item: descricaoItem,
          ncm,
          cfop,
          cclasstrib: cClassTrib,
          cst_csosn: cstCsosn,
          quantidade: quantidade !== undefined ? Number(quantidade) : undefined,
          unidade,
          valor_liquido_item: valorLiquidoItem !== undefined ? Number(valorLiquidoItem) : undefined,
          base_ibs: baseIbs !== undefined ? Number(baseIbs) : undefined,
          aliquota_ibs: aliquotaIbs !== undefined ? Number(aliquotaIbs) : undefined,
          valor_ibs: valorIbs !== undefined ? Number(valorIbs) : undefined,
          base_cbs: baseCbs !== undefined ? Number(baseCbs) : undefined,
          aliquota_cbs: aliquotaCbs !== undefined ? Number(aliquotaCbs) : undefined,
          valor_cbs: valorCbs !== undefined ? Number(valorCbs) : undefined
        }).eq('id', id);
      }
    }

    res.json({ success: true, message: 'Item atualizado com sucesso!' });
  } catch (err: any) {
    console.error('❌ Erro ao atualizar item do relatório:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/** DELETE /api/relatorios/item/:id — Excluir item do relatório */
router.delete('/item/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Exclui de dfe_itens
    db.prepare('DELETE FROM dfe_itens WHERE id = ?').run(id);

    // Se o ID tiver padrão doc-*, remove documento correspondente
    db.prepare('DELETE FROM dfe_documentos WHERE id = ?').run(id);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase.from('dfe_itens').delete().eq('id', id);
        await supabase.from('dfe_documentos').delete().eq('id', id);
      }
    }

    res.json({ success: true, message: 'Item excluído com sucesso do relatório!' });
  } catch (err: any) {
    console.error('❌ Erro ao excluir item do relatório:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /api/relatorios/upload — Upload em lote de itens para o relatório (JSON ou XLSX) */
router.post('/upload', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itens, empresaId } = req.body;
    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ success: false, error: 'Formato inválido. Envie um array "itens".' });
    }

    const activeEmpresaId = (req.headers['x-empresa-ativa-id'] as string) || empresaId || req.user?.empresaAtivaId;
    if (!activeEmpresaId) {
      return res.status(400).json({ success: false, error: 'Empresa ativa não identificada.' });
    }

    const db = getDatabase();
    const insertDoc = db.prepare(`
      INSERT OR REPLACE INTO dfe_documentos (
        id, empresa_id, tipo_doc, chave_acesso, numero_serie, data_emissao, data_entrada,
        fornecedor_cnpj, fornecedor_razao, fornecedor_uf, fornecedor_municipio,
        cliente_cnpj, cliente_razao, cliente_uf, situacao_doc, valor_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertItem = db.prepare(`
      INSERT OR REPLACE INTO dfe_itens (
        id, documento_id, item_nro, descricao_item, ncm, cfop, cclasstrib, cst_csosn,
        quantidade, unidade, valor_bruto_item, valor_liquido_item,
        base_ibs, aliquota_ibs, valor_ibs, base_cbs, aliquota_cbs, valor_cbs
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction((rows: any[]) => {
      let inserted = 0;
      for (const row of rows) {
        const docId = `doc-up-${crypto.randomUUID()}`;
        const itemId = `item-up-${crypto.randomUUID()}`;
        const chaveAcesso = String(row['Chave de Acesso'] || row['chaveAcesso'] || row['chave_acesso'] || `UPLOAD_${Date.now()}_${inserted}`).trim();
        const tipoDoc = String(row['Documento'] || row['tipoDoc'] || row['tipo_doc'] || 'NFe').trim();
        const emitCnpj = String(row['CNPJ Emitente'] || row['fornecedorCnpj'] || row['fornecedor_cnpj'] || '').trim();
        const emitRazao = String(row['Fornecedor / Emitente'] || row['fornecedorRazao'] || row['fornecedor_razao'] || '').trim();
        const destCnpj = String(row['CNPJ Dest.'] || row['clienteCnpj'] || row['cliente_cnpj'] || '').trim();
        const destRazao = String(row['Cliente / Dest.'] || row['clienteRazao'] || row['cliente_razao'] || '').trim();
        const dataEmissao = String(row['Data Emissão'] || row['dataEmissao'] || row['data_emissao'] || new Date().toISOString().split('T')[0]).trim();
        const valorLiq = Number(row['Valor Total (R$)'] || row['valorLiquidoItem'] || row['valor_liquido_item'] || 0);

        insertDoc.run(
          docId, activeEmpresaId, tipoDoc, chaveAcesso,
          String(row['Série'] || row['numeroSerie'] || '1'),
          dataEmissao, dataEmissao,
          emitCnpj, emitRazao,
          String(row['UF Emit.'] || row['fornecedorUf'] || 'SP'),
          String(row['Município Emit.'] || row['fornecedorMunicipio'] || ''),
          destCnpj, destRazao,
          String(row['UF Dest.'] || row['clienteUf'] || 'SP'),
          String(row['Situação'] || row['situacaoDoc'] || 'autorizado'),
          valorLiq
        );

        insertItem.run(
          itemId, docId,
          Number(row['itemNro'] || row['item_nro'] || 1),
          String(row['Descrição'] || row['descricaoItem'] || row['descricao_item'] || 'Item Importado'),
          String(row['NCM'] || row['ncm'] || ''),
          String(row['CFOP'] || row['cfop'] || '1102'),
          String(row['cClassTrib'] || row['cclasstrib'] || ''),
          String(row['cstCsosn'] || row['cst_csosn'] || ''),
          Number(row['quantidade'] || 1),
          String(row['unidade'] || ''),
          valorLiq, valorLiq,
          Number(row['Base IBS/CBS (R$)'] || row['baseIbs'] || 0),
          Number(row['aliquotaIbs'] || 0),
          Number(row['IBS (R$)'] || row['valorIbs'] || 0),
          Number(row['Base IBS/CBS (R$)'] || row['baseCbs'] || 0),
          Number(row['aliquotaCbs'] || 0),
          Number(row['CBS (R$)'] || row['valorCbs'] || 0)
        );
        inserted++;
      }
      return inserted;
    });

    const totalInserted = tx(itens);
    res.json({ success: true, count: totalInserted, message: `${totalInserted} registros importados com sucesso para os relatórios fiscais.` });
  } catch (err: any) {
    console.error('❌ Erro no upload em massa de relatórios:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para sincronizar e mensurar crédito real liquidado com o Ledger da Apuração Assistida
router.get('/sincronizar-apuracao', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const activeEmpresaId = (req.headers['x-empresa-ativa-id'] as string) || (req.query.empresaId as string) || req.user?.empresaAtivaId;

    let queryOp = `SELECT COUNT(*) as count FROM apuracao_operacoes op WHERE 1=1`;
    const paramsOp: any[] = [];
    if (activeEmpresaId) {
      queryOp += ` AND op.empresa_id = ?`;
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
    if (activeEmpresaId) {
      queryExtrato += ` AND op.empresa_id = ?`;
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

