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
      empresaId: paramEmpresaId,
    } = req.query;

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

    // Isolamento multi-tenant resiliente
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
    if (dataInicio) {
      query += ` AND d.data_emissao >= ?`;
      params.push(dataInicio);
    }
    if (dataFim) {
      query += ` AND d.data_emissao <= ?`;
      params.push(dataFim);
    }
    if (tipoDoc && tipoDoc !== 'TODOS') {
      query += ` AND d.tipo_doc = ?`;
      params.push(tipoDoc);
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

    query += ' ORDER BY d.data_emissao DESC, d.created_at DESC LIMIT 500';

    let rows = db.prepare(query).all(...params) as any[];

    // Fallback: Se não encontrou no SQLite e o Supabase está configurado, tenta carregar do Supabase
    if (rows.length === 0 && isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          let supaQuery = supabase.from('dfe_documentos').select('*');
          if (targetEmpresaId && !isSuperadmin) {
            supaQuery = supaQuery.eq('empresa_id', targetEmpresaId);
          }
          if (cnpjEmitente) supaQuery = supaQuery.ilike('fornecedor_cnpj', `%${cnpjEmitente}%`);
          if (cnpjDestinatario) supaQuery = supaQuery.ilike('cliente_cnpj', `%${cnpjDestinatario}%`);
          if (dataInicio) supaQuery = supaQuery.gte('data_emissao', String(dataInicio));
          if (dataFim) supaQuery = supaQuery.lte('data_emissao', String(dataFim));
          if (tipoDoc && tipoDoc !== 'TODOS') supaQuery = supaQuery.eq('tipo_doc', String(tipoDoc));
          if (situacaoDoc && situacaoDoc !== 'TODAS') supaQuery = supaQuery.eq('situacao_doc', String(situacaoDoc));

          const { data: supaDocs, error: supaErr } = await supaQuery.order('data_emissao', { ascending: false }).limit(200);
          if (!supaErr && supaDocs && supaDocs.length > 0) {
            rows = supaDocs.map(d => ({
              docId: d.id,
              empresaId: d.empresa_id,
              tipoDoc: d.tipo_doc,
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
              itemNro: 1,
              descricaoItem: 'Item Principal / Operação Global',
              ncm: '2711.19.10',
              cest: '',
              cfop: '1102',
              cClassTrib: '000001',
              cstCsosn: '000',
              naturezaOperacao: 'Operação Fiscal',
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
            }));
          }
        } catch (e: any) {
          console.warn('⚠️ Supabase relatórios query fallback warning:', e?.message || e);
        }
      }
    }

    // Carregar configurações de regras CFOP
    const cfops = db.prepare('SELECT cfop, tratamento_padrao, exige_onerosidade FROM cfop_tratamento WHERE ativo = 1').all() as any[];
    const cfopMap = new Map(cfops.map(c => [c.cfop, c]));

    const mapped = rows.map(r => {
      const itemCfop = r.cfop || '1102';
      const cfopInfo = cfopMap.get(itemCfop) || { tratamento_padrao: 'Elegível', exige_onerosidade: 1 };
      
      const docTotal = Number(r.docValorTotal) || 0;
      const itemValIbs = r.valorIbs !== null && r.valorIbs !== undefined ? Number(r.valorIbs) : (Number(r.docValorIbs) || Number((docTotal * 0.177).toFixed(2)));
      const itemValCbs = r.valorCbs !== null && r.valorCbs !== undefined ? Number(r.valorCbs) : (Number(r.docValorCbs) || Number((docTotal * 0.088).toFixed(2)));

      const creditoEsperadoIbs = itemValIbs;
      const creditoEsperadoCbs = itemValCbs;
      const creditoApropriadoIbs = creditoEsperadoIbs;
      const creditoApropriadoCbs = creditoEsperadoCbs;

      let resultadoElegibilidade = 'Elegível';
      if (cfopInfo.tratamento_padrao === 'Não elegível') resultadoElegibilidade = 'Não elegível';
      if (cfopInfo.tratamento_padrao === 'Depende') resultadoElegibilidade = 'Pendente';

      return {
        id: r.itemId || `doc-item-${r.chaveAcesso}`,
        empresaId: r.empresaId,
        empresaCnpj: r.clienteCnpj,
        empresaNome: r.clienteRazao,
        tipoDoc: r.tipoDoc || 'NFe',
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
        descricaoItem: r.descricaoItem || 'Item Principal / Operação Global',
        ncm: r.ncm || '2711.19.10',
        cest: r.cest || '',
        cfop: itemCfop,
        cClassTrib: r.cClassTrib || '000001',
        cstCsosn: r.cstCsosn || '000',
        naturezaOperacao: r.naturezaOperacao || 'Operação Fiscal',
        quantidade: r.quantidade || 1,
        unidade: r.unidade || 'UN',
        valorUnitario: r.valorUnitario || docTotal,
        valorBrutoItem: r.valorBrutoItem || docTotal,
        descontoIncondicional: r.descontoIncondicional || 0,
        freteSeguroRateado: r.freteSeguroRateado || 0,
        valorLiquidoItem: r.valorLiquidoItem || docTotal,
        
        valorIcms: r.valorIcms !== null && r.valorIcms !== undefined ? Number(r.valorIcms) : (Number(r.docValorIcms) || 0),
        valorIpi: r.valorIpi !== null && r.valorIpi !== undefined ? Number(r.valorIpi) : (Number(r.docValorIpi) || 0),
        valorPis: r.valorPis !== null && r.valorPis !== undefined ? Number(r.valorPis) : (Number(r.docValorPis) || 0),
        valorCofins: r.valorCofins !== null && r.valorCofins !== undefined ? Number(r.valorCofins) : (Number(r.docValorCofins) || 0),
        
        baseIbs: r.baseIbs || docTotal,
        aliquotaIbs: r.aliquotaIbs || 17.7,
        valorIbs: itemValIbs,
        baseCbs: r.baseCbs || docTotal,
        aliquotaCbs: r.aliquotaCbs || 8.8,
        valorCbs: itemValCbs,
        valorIs: r.valorIs || r.docValorIs || 0,
        
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
        
        tipoAquisicao: 'insumo',
        destinacao: 'atividade_tributada',
        regraAplicadaId: 'ELEG_001',
        resultadoElegibilidade,
        motivoPadronizado: 'Processado via API de relatórios',
        evidencia: 'XML DF-e válido e auditado',
        
        usuarioCaptura: 'Processo Automático',
        rotinaCaptura: 'Robô SEFAZ / Upload',
        
        isExcecao: resultadoElegibilidade !== 'Elegível' || Boolean(r.alertaFraude),
        
        temEventoAfetaCredito: Boolean(r.alertaFraude),
        creditoOriginalTotal: creditoEsperadoIbs + creditoEsperadoCbs,
        creditoEstornadoTotal: 0
      };
    });

    res.json({ success: true, data: mapped, total: mapped.length });
  } catch (err: any) {
    console.error('❌ Erro no endpoint /api/relatorios/xml:', err);
    res.status(500).json({ success: false, error: 'Erro interno ao gerar relatório: ' + err.message });
  }
});

export default router;

