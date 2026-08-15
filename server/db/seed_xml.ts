import { getDatabase } from './database';
import { v4 as uuid } from 'uuid';
import { INITIAL_XML_ITEM_REPORTS } from '../../src/utils/reportsData';

export function seedXmls() {
  const db = getDatabase();

  const empresaDemoId = db.prepare('SELECT id FROM empresas WHERE cnpj_raiz = ?').get('33.000.167') as {id: string};
  const empresa2Id = db.prepare('SELECT id FROM empresas WHERE cnpj_raiz = ?').get('00.000.000') as {id: string};

  if (!empresaDemoId) {
    console.log('Empresas não encontradas');
    return;
  }

  const stmtDoc = db.prepare(`
    INSERT INTO dfe_documentos (id, empresa_id, tipo_doc, chave_acesso, numero_serie, data_emissao, data_entrada, competencia, fornecedor_cnpj, fornecedor_razao, fornecedor_uf, fornecedor_municipio, cliente_cnpj, cliente_razao, cliente_uf, situacao_doc, valor_total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(chave_acesso) DO NOTHING
  `);

  const stmtItem = db.prepare(`
    INSERT INTO dfe_itens (id, documento_id, item_nro, descricao_item, ncm, cfop, cclasstrib, cst_csosn, natureza_operacao, quantidade, unidade, valor_bruto_item, desconto_incondicional, frete_seguro_rateado, valor_liquido_item, base_ibs, aliquota_ibs, valor_ibs, base_cbs, aliquota_cbs, valor_cbs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const rep of INITIAL_XML_ITEM_REPORTS) {
    const docId = uuid();
    const empId = rep.empresaCnpj === '33.000.167/0001-01' ? empresaDemoId.id : empresa2Id.id;
    
    const info = stmtDoc.run(
      docId, empId, rep.tipoDoc, rep.chaveAcesso, rep.numeroSerie, rep.dataEmissao, rep.dataEntrada, rep.competencia, rep.fornecedorCnpj, rep.fornecedorRazao, rep.fornecedorUf, rep.fornecedorMunicipio, rep.clienteCnpj, rep.clienteRazao, rep.clienteUf, rep.situacaoDoc, rep.valorBrutoItem
    );

    if (info.changes > 0) {
      count++;
      stmtItem.run(
        uuid(), docId, rep.itemNro, rep.descricaoItem, rep.ncm, rep.cfop, rep.cClassTrib, rep.cstCsosn, rep.naturezaOperacao, rep.quantidade, rep.unidade, rep.valorBrutoItem, rep.descontoIncondicional, rep.freteSeguroRateado, rep.valorLiquidoItem, rep.baseIbs, rep.aliquotaIbs, rep.valorIbs, rep.baseCbs, rep.aliquotaCbs, rep.valorCbs
      );
    }
  }

  console.log(`XMLs seed concluído. ${count} documentos inseridos.`);
}

seedXmls();
