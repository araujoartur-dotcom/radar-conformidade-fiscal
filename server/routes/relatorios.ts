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
    FROM dfe_itens i
    JOIN dfe_documentos d ON d.id = i.documento_id
    WHERE d.empresa_id = ?
  `;
  const params: any[] = [empresaId];

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
    query += ` AND i.cfop LIKE ?`;
    params.push(`%${cfop}%`);
  }
  if (cClassTrib) {
    query += ` AND i.cclasstrib LIKE ?`;
    params.push(`%${cClassTrib}%`);
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
    const cfopInfo = cfopMap.get(r.cfop) || { tratamento_padrao: 'Depende', exige_onerosidade: 1 };
    
    // Simulate some logic
    const creditoEsperadoIbs = r.baseIbs * (r.aliquotaIbs / 100);
    const creditoEsperadoCbs = r.baseCbs * (r.aliquotaCbs / 100);
    const creditoApropriadoIbs = creditoEsperadoIbs; // mock
    const creditoApropriadoCbs = creditoEsperadoCbs; // mock

    let resultadoElegibilidade = 'Pendente';
    if (cfopInfo.tratamento_padrao === 'Elegível') resultadoElegibilidade = 'Elegível';
    if (cfopInfo.tratamento_padrao === 'Não elegível') resultadoElegibilidade = 'Não elegível';

    return {
      id: r.itemId,
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
      
      itemNro: r.itemNro,
      descricaoItem: r.descricaoItem,
      ncm: r.ncm,
      cfop: r.cfop,
      cClassTrib: r.cClassTrib,
      cstCsosn: r.cstCsosn,
      naturezaOperacao: r.naturezaOperacao,
      quantidade: r.quantidade,
      unidade: r.unidade,
      valorBrutoItem: r.valorBrutoItem,
      descontoIncondicional: r.descontoIncondicional,
      freteSeguroRateado: r.freteSeguroRateado,
      valorLiquidoItem: r.valorLiquidoItem,
      
      baseIbs: r.baseIbs,
      aliquotaIbs: r.aliquotaIbs,
      valorIbs: r.valorIbs,
      baseCbs: r.baseCbs,
      aliquotaCbs: r.aliquotaCbs,
      valorCbs: r.valorCbs,
      
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
