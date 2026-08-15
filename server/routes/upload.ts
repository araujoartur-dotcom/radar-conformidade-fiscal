import { Router, Response } from 'express';
import { getDatabase } from '../db/database';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { parseStringPromise } from 'xml2js';
import { v4 as uuidv4 } from 'uuid';
import { salvarXmlLocalmente } from '../utils/fileStorage';

const router = Router();

router.post('/xml', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { xmlContent } = req.body;
    if (!xmlContent) {
      return res.status(400).json({ error: 'Nenhum conteúdo XML fornecido.' });
    }

    const db = getDatabase();
    const empresaId = req.user!.empresaAtivaId;

    // Get the company's CNPJ to determine Entrada vs Saída
    const empresaRow = db.prepare('SELECT cnpj_completo, razao_social, uf FROM empresas WHERE id = ?').get(empresaId) as any;
    if (!empresaRow) {
      return res.status(400).json({ error: 'Empresa ativa não encontrada.' });
    }
    const empresaCnpjRaiz = empresaRow.cnpj_completo.replace(/[^0-9]/g, '').substring(0, 8);

    // Parse XML
    const result = await parseStringPromise(xmlContent, { explicitArray: false });

    // Handle standard nfeProc
    const nfe = result.nfeProc?.NFe?.infNFe;
    if (!nfe) {
      return res.status(400).json({ error: 'XML inválido: não é um nfeProc válido.' });
    }

    const chaveAcesso = nfe.$.Id.replace('NFe', '');
    const emitente = nfe.emit;
    const destinatario = nfe.dest;
    
    const emitCnpj = emitente?.CNPJ || '';
    const emitCnpjRaiz = emitCnpj.substring(0, 8);
    const destCnpj = destinatario?.CNPJ || '';
    const destCnpjRaiz = destCnpj.substring(0, 8);

    // Determine Entrada or Saída
    let tipoOperacao = 'Entrada';
    if (emitCnpjRaiz === empresaCnpjRaiz) {
      tipoOperacao = 'Saída';
    } else if (destCnpjRaiz === empresaCnpjRaiz) {
      tipoOperacao = 'Entrada';
    } else {
      // Se não for nenhum dos dois, pode ser um terceiro (transporte, etc). Assumimos Entrada para não quebrar.
      tipoOperacao = 'Terceiros'; 
    }

    const docId = uuidv4();

    db.transaction(() => {
      // 1. Insert Documento
      db.prepare(`
        INSERT INTO dfe_documentos (
          id, empresa_id, tipo_doc, chave_acesso, tipo_operacao, numero_serie, data_emissao, data_entrada, 
          fornecedor_cnpj, fornecedor_razao, fornecedor_uf, 
          cliente_cnpj, cliente_razao, cliente_uf, situacao_doc, valor_total
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `).run(
        docId, empresaId, 'NF-e', chaveAcesso, tipoOperacao, `${nfe.ide?.nNF} / ${nfe.ide?.serie}`, nfe.ide?.dhEmi, new Date().toISOString(),
        emitCnpj, emitente?.xNome || '', emitente?.enderEmit?.UF || '',
        destCnpj, destinatario?.xNome || '', destinatario?.enderDest?.UF || '', 'autorizado', nfe.total?.ICMSTot?.vNF || 0
      );

      // 2. Insert Itens
      let detList = nfe.det;
      if (!Array.isArray(detList)) detList = [detList];

      const stmtItem = db.prepare(`
        INSERT INTO dfe_itens (
          id, documento_id, item_nro, descricao_item, ncm, cfop, 
          quantidade, unidade, valor_bruto_item, valor_liquido_item,
          base_ibs, aliquota_ibs, valor_ibs, base_cbs, aliquota_cbs, valor_cbs
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const det of detList) {
        if (!det) continue;
        const prod = det.prod;
        if (!prod) continue;

        // Tentar extrair tag de reforma tributária se existir no XML (cClassTrib, etc), caso contrário assume 0
        const valorItem = parseFloat(prod.vProd || 0);
        
        stmtItem.run(
          uuidv4(), docId, det.$.nItem, prod.xProd, prod.NCM, prod.CFOP,
          parseFloat(prod.qCom || 0), prod.uCom, valorItem, valorItem,
          valorItem, 17.7, valorItem * 0.177, // Mock IBS
          valorItem, 8.8, valorItem * 0.088 // Mock CBS
        );
      }
    })();

    // 3. Salvar no disco fisicamente (Inteligência de Diretórios)
    const dataEmissao = nfe.ide?.dhEmi || new Date().toISOString();
    salvarXmlLocalmente(xmlContent, empresaCnpjRaiz, tipoOperacao as any, dataEmissao, chaveAcesso);

    res.json({ success: true, message: 'XML processado e importado com sucesso.', docId, tipoOperacao });

  } catch (err: any) {
    console.error('Erro ao processar XML:', err);
    res.status(500).json({ error: 'Erro ao processar arquivo XML.', details: err.message });
  }
});

// GET /api/upload/documentos
// Retorna a lista de documentos da empresa ativa
router.get('/documentos', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const empresaId = req.user!.empresaAtivaId;

    const documentos = db.prepare(`
      SELECT * FROM dfe_documentos
      WHERE empresa_id = ?
      ORDER BY data_emissao DESC
    `).all(empresaId);

    res.json({ success: true, data: documentos });
  } catch (err: any) {
    console.error('Erro ao buscar documentos:', err);
    res.status(500).json({ error: 'Erro ao buscar documentos.', details: err.message });
  }
});

// GET /api/upload/documentos/:id/eventos
// Retorna os eventos associados a uma chave de acesso específica
router.get('/documentos/:id/eventos', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    // Buscar a chave de acesso do documento
    const doc = db.prepare('SELECT chave_acesso FROM dfe_documentos WHERE id = ?').get(id) as any;
    if (!doc) {
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    const eventos = db.prepare(`
      SELECT * FROM dfe_eventos
      WHERE chave_acesso = ?
      ORDER BY dh_evento DESC
    `).all(doc.chave_acesso);

    res.json({ success: true, data: eventos });
  } catch (err: any) {
    console.error('Erro ao buscar eventos:', err);
    res.status(500).json({ error: 'Erro ao buscar eventos.', details: err.message });
  }
});

export default router;
