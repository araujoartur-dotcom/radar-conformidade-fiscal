import { Router, Response } from 'express';
import { getDatabase } from '../db/database';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';

const router = Router();

router.get('/xml', requireAuth, (req: AuthenticatedRequest, res: Response) => {
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
    searchTerm
  } = req.query;

  const empresaId = req.user!.empresaAtivaId;

  let query = `
    SELECT 
      d.id as docId,
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
      d.valor_total as docValorTotal,
      d.valor_cbs as docValorCbs,
      d.valor_ibs as docValorIbs,
      i.item_nro as itemNro,
      i.descricao_item as descricaoItem,
      i.ncm,
      i.cfop,
      i.cclasstrib as cClassTrib,
      i.cst_csosn as cstCsosn,
      i.natureza_operacao as naturezaOperacao,
      i.quantidade,
      i.unidade,
      i.valor_bruto_item as valorBrutoItem,
      i.desconto_incondicional as descontoIncondicional,
      i.frete_seguro_rateado as freteSeguroRateado,
      i.valor_liquido_item as valorLiquidoItem,
      i.base_ibs as baseIbs,
      i.aliquota_ibs as aliquotaIbs,
      i.valor_ibs as valorIbs,
      i.base_cbs as baseCbs,
      i.aliquota_cbs as aliquotaCbs,
      i.valor_cbs as valorCbs,
      i.id as itemId
    FROM dfe_documentos d
    LEFT JOIN dfe_itens i ON d.id = i.documento_id
    WHERE (d.empresa_id = ? OR ? = '')
  `;
  const params: any[] = [empresaId, empresaId];

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

  const rows = db.prepare(query).all(...params) as any[];

  // Fetch configs for dynamic calculation (if necessary, here we just join logic in JS for simplicity, mimicking backend process)
  const cfops = db.prepare('SELECT cfop, tratamento_padrao, exige_onerosidade FROM cfop_tratamento WHERE ativo = 1 AND (empresa_id = ? OR empresa_id IS NULL)').all(empresaId) as any[];
  const cfopMap = new Map(cfops.map(c => [c.cfop, c]));

  const mapped = rows.map(r => {
    const itemCfop = r.cfop || '5102';
    const cfopInfo = cfopMap.get(itemCfop) || { tratamento_padrao: 'Depende', exige_onerosidade: 1 };
    
    const itemValIbs = r.valorIbs !== null && r.valorIbs !== undefined ? Number(r.valorIbs) : (Number(r.docValorIbs) || 0);
    const itemValCbs = r.valorCbs !== null && r.valorCbs !== undefined ? Number(r.valorCbs) : (Number(r.docValorCbs) || 0);

    const creditoEsperadoIbs = itemValIbs;
    const creditoEsperadoCbs = itemValCbs;
    const creditoApropriadoIbs = creditoEsperadoIbs;
    const creditoApropriadoCbs = creditoEsperadoCbs;

    let resultadoElegibilidade = 'Pendente';
    if (cfopInfo.tratamento_padrao === 'Elegível') resultadoElegibilidade = 'Elegível';
    if (cfopInfo.tratamento_padrao === 'Não elegível') resultadoElegibilidade = 'Não elegível';

    return {
      id: r.itemId || `doc-item-${r.chaveAcesso}`,
      empresaCnpj: r.clienteCnpj,
      empresaNome: r.clienteRazao,
      tipoDoc: r.tipoDoc,
      chaveAcesso: r.chaveAcesso,
      numeroSerie: r.numeroSerie,
      dataEmissao: r.dataEmissao,
      dataEntrada: r.dataEntrada,
      competencia: r.competencia,
      fornecedorCnpj: r.fornecedorCnpj,
      fornecedorRazao: r.fornecedorRazao,
      fornecedorUf: r.fornecedorUf,
      fornecedorMunicipio: r.fornecedorMunicipio,
      clienteCnpj: r.clienteCnpj,
      clienteRazao: r.clienteRazao,
      clienteUf: r.clienteUf,
      situacaoDoc: r.situacaoDoc,
      
      itemNro: r.itemNro || 1,
      descricaoItem: r.descricaoItem || 'Item Principal / Operação Global',
      ncm: r.ncm || '2711.19.10',
      cfop: itemCfop,
      cClassTrib: r.cClassTrib || '410999',
      cstCsosn: r.cstCsosn || '410',
      naturezaOperacao: r.naturezaOperacao || 'Operação Fiscal',
      quantidade: r.quantidade || 1,
      unidade: r.unidade || 'UN',
      valorBrutoItem: r.valorBrutoItem || r.docValorTotal || 0,
      descontoIncondicional: r.descontoIncondicional || 0,
      freteSeguroRateado: r.freteSeguroRateado || 0,
      valorLiquidoItem: r.valorLiquidoItem || r.docValorTotal || 0,
      
      baseIbs: r.baseIbs || r.docValorTotal || 0,
      aliquotaIbs: r.aliquotaIbs || 0,
      valorIbs: itemValIbs,
      baseCbs: r.baseCbs || r.docValorTotal || 0,
      aliquotaCbs: r.aliquotaCbs || 0,
      valorCbs: itemValCbs,
      
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
      evidencia: 'XML NF-e válido + GRN',
      
      usuarioCaptura: 'Processo Automático',
      rotinaCaptura: 'Robô Receita',
      
      isExcecao: resultadoElegibilidade !== 'Elegível',
      
      temEventoAfetaCredito: false,
      creditoOriginalTotal: creditoEsperadoIbs + creditoEsperadoCbs,
      creditoEstornadoTotal: 0
    };
  });

  res.json({ data: mapped, total: mapped.length });
});

export default router;
