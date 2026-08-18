import { Router, Response } from 'express';
import { getDatabase } from '../db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { parseStringPromise } from 'xml2js';
import { v4 as uuidv4 } from 'uuid';
import { salvarXmlLocalmente } from '../utils/fileStorage';

const router = Router();

/**
 * Função utilitária para extrair tags XML simples via Regex (resistente a variações de namespaces e tags aninhadas)
 */
function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function extractSubTag(xml: string, parentTag: string, childTag: string): string {
  const parentContent = extractTag(xml, parentTag);
  if (!parentContent) return '';
  return extractTag(parentContent, childTag);
}

// POST /api/upload/xml — Processa e armazena um arquivo XML de NF-e, CT-e, NFS-e ou MDF-e
router.post('/xml', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { xmlContent } = req.body;
    if (!xmlContent || typeof xmlContent !== 'string' || xmlContent.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum conteúdo XML válido fornecido.' });
    }

    const db = getDatabase();
    let empresaId = req.user?.empresaAtivaId;

    // 1. Extração da Chave de Acesso
    let chaveAcesso = extractTag(xmlContent, 'chNFe') 
      || extractTag(xmlContent, 'chCTe') 
      || extractTag(xmlContent, 'chMDFe')
      || (xmlContent.match(/Id="[a-zA-Z]*([0-9]{44,50})"/i)?.[1])
      || (xmlContent.match(/<infNFe[^>]*Id="NFe([0-9]{44})"/i)?.[1])
      || '';

    // 2. Extração de Emitente e Destinatário
    const emitCnpj = extractSubTag(xmlContent, 'emit', 'CNPJ') || extractSubTag(xmlContent, 'emit', 'CPF') || extractTag(xmlContent, 'CNPJ');
    const emitNome = extractSubTag(xmlContent, 'emit', 'xNome') || extractSubTag(xmlContent, 'emit', 'xFant') || 'EMITENTE';
    const emitUf = extractSubTag(xmlContent, 'enderEmit', 'UF') || 'SP';

    const destCnpj = extractSubTag(xmlContent, 'dest', 'CNPJ') || extractSubTag(xmlContent, 'dest', 'CPF');
    const destNome = extractSubTag(xmlContent, 'dest', 'xNome') || 'DESTINATÁRIO';
    const destUf = extractSubTag(xmlContent, 'enderDest', 'UF') || 'SP';

    // 3. Identificar Empresa no Banco caso empresaId não esteja setado no token
    if (!empresaId) {
      const cleanEmit = emitCnpj.replace(/\D/g, '');
      const cleanDest = destCnpj.replace(/\D/g, '');

      let matchedEmp = db.prepare(`
        SELECT id, cnpj_completo FROM empresas 
        WHERE REPLACE(REPLACE(REPLACE(cnpj_completo, '.', ''), '/', ''), '-', '') IN (?, ?)
           OR cnpj_raiz IN (?, ?)
        LIMIT 1
      `).get(cleanEmit, cleanDest, cleanEmit.substring(0, 8), cleanDest.substring(0, 8)) as any;

      if (matchedEmp) {
        empresaId = matchedEmp.id;
      } else {
        // Fallback para a primeira empresa cadastrada no banco
        const firstEmp = db.prepare('SELECT id FROM empresas ORDER BY created_at ASC LIMIT 1').get() as any;
        empresaId = firstEmp?.id || uuidv4();
      }
    }

    // Obter dados da empresa ativa
    const empresaRow = db.prepare('SELECT cnpj_completo, razao_social, uf FROM empresas WHERE id = ?').get(empresaId) as any;
    const empresaCnpjRaiz = empresaRow?.cnpj_completo ? empresaRow.cnpj_completo.replace(/[^0-9]/g, '').substring(0, 8) : emitCnpj.substring(0, 8);

    // 4. Tipo de Operação (Entrada / Saída)
    let tipoOperacao = 'Entrada';
    const emitRaiz = emitCnpj.replace(/\D/g, '').substring(0, 8);
    const destRaiz = destCnpj.replace(/\D/g, '').substring(0, 8);

    if (emitRaiz && emitRaiz === empresaCnpjRaiz) {
      tipoOperacao = 'Saída';
    } else if (destRaiz && destRaiz === empresaCnpjRaiz) {
      tipoOperacao = 'Entrada';
    } else {
      tipoOperacao = 'Entrada';
    }

    // 5. Tipo de Documento e Valores
    let tipoDoc = 'NF-e';
    if (xmlContent.includes('<infCte') || xmlContent.includes('<CTe')) tipoDoc = 'CT-e';
    else if (xmlContent.includes('<infNfse') || xmlContent.includes('<NFSe') || xmlContent.includes('<CompNfse') || xmlContent.includes('<DPS')) tipoDoc = 'NFS-e';
    else if (xmlContent.includes('<tpAmb') && xmlContent.includes('mod=65')) tipoDoc = 'NFC-e';

    const nNF = extractTag(xmlContent, 'nNF') || extractTag(xmlContent, 'nCT') || extractTag(xmlContent, 'nNFSe') || extractTag(xmlContent, 'nDPS') || extractTag(xmlContent, 'Numero') || '1';
    const serie = extractTag(xmlContent, 'serie') || '1';
    const dhEmi = extractTag(xmlContent, 'dhEmi') || extractTag(xmlContent, 'dhProc') || extractTag(xmlContent, 'dEmi') || extractTag(xmlContent, 'DataEmissao') || new Date().toISOString();

    const vNF = parseFloat(
      extractSubTag(xmlContent, 'ICMSTot', 'vNF') 
      || extractTag(xmlContent, 'vNF') 
      || extractTag(xmlContent, 'vServ') 
      || extractTag(xmlContent, 'vServPrest')
      || extractTag(xmlContent, 'vTPrest')
      || extractTag(xmlContent, 'vLiquido') 
      || '0'
    ) || 0;
    const vICMS = parseFloat(extractSubTag(xmlContent, 'ICMSTot', 'vICMS') || extractTag(xmlContent, 'vICMS') || '0') || 0;
    const vIPI = parseFloat(extractSubTag(xmlContent, 'ICMSTot', 'vIPI') || extractTag(xmlContent, 'vIPI') || '0') || 0;
    const vPIS = parseFloat(extractSubTag(xmlContent, 'ICMSTot', 'vPIS') || extractTag(xmlContent, 'vPIS') || extractTag(xmlContent, 'vPis') || '0') || 0;
    const vCOFINS = parseFloat(extractSubTag(xmlContent, 'ICMSTot', 'vCOFINS') || extractTag(xmlContent, 'vCOFINS') || extractTag(xmlContent, 'vCofins') || '0') || 0;

    const vCBS = parseFloat(extractTag(xmlContent, 'vCBS') || '0') || (vNF * 0.009);
    const vIBS = parseFloat(extractTag(xmlContent, 'vIBSUF') || extractTag(xmlContent, 'vIBS') || '0') || (vNF * 0.001);

    if (!chaveAcesso) {
      chaveAcesso = `MANUAL-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    }

    const docId = uuidv4();

    // 6. Gravação no SQLite
    db.transaction(() => {
      // Upsert Documento
      db.prepare(`
        INSERT INTO dfe_documentos (
          id, empresa_id, tipo_doc, chave_acesso, tipo_operacao, numero_serie, data_emissao, data_entrada, 
          fornecedor_cnpj, fornecedor_razao, fornecedor_uf, 
          cliente_cnpj, cliente_razao, cliente_uf, situacao_doc, valor_total,
          valor_icms, valor_ipi, valor_pis, valor_cofins, valor_cbs, valor_ibs
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )
      `).run(
        docId, empresaId, tipoDoc, chaveAcesso, tipoOperacao, `${nNF} / ${serie}`, dhEmi.split('T')[0], new Date().toISOString(),
        emitCnpj, emitNome, emitUf,
        destCnpj, destNome, destUf, 'autorizado', vNF,
        vICMS, vIPI, vPIS, vCOFINS, vCBS, vIBS
      );
    })();

    // 7. Salvar no disco local em C:\SEFAZ\XMLs\[CNPJ_RAIZ]\[Entrada|Saida]\
    try {
      salvarXmlLocalmente(xmlContent, empresaCnpjRaiz, tipoOperacao as any, dhEmi, chaveAcesso);
    } catch (saveErr: any) {
      console.warn('Aviso: Não foi possível salvar arquivo físico no disco:', saveErr.message);
    }

    res.json({ 
      success: true, 
      message: 'XML processado e importado com sucesso.', 
      docId, 
      tipoOperacao,
      chaveAcesso,
      numero: `${nNF} / ${serie}`,
      valorTotal: vNF
    });

  } catch (err: any) {
    console.error('❌ Erro ao processar upload XML:', err);
    res.status(500).json({ success: false, error: 'Erro ao processar arquivo XML.', details: err.message });
  }
});

// GET /api/upload/documentos — Retorna a lista de documentos da empresa ativa
router.get('/documentos', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const empresaId = req.user?.empresaAtivaId;

    let documentos: any[] = [];
    if (empresaId) {
      documentos = db.prepare(`
        SELECT * FROM dfe_documentos
        WHERE empresa_id = ?
        ORDER BY data_emissao DESC
      `).all(empresaId);
    } else {
      documentos = db.prepare(`
        SELECT * FROM dfe_documentos
        ORDER BY data_emissao DESC
        LIMIT 100
      `).all();
    }

    res.json({ success: true, data: documentos });
  } catch (err: any) {
    console.error('Erro ao buscar documentos:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar documentos.', details: err.message });
  }
});

// GET /api/upload/documentos/:id/eventos — Retorna os eventos associados a uma chave de acesso
router.get('/documentos/:id/eventos', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    const doc = db.prepare('SELECT chave_acesso FROM dfe_documentos WHERE id = ?').get(id) as any;
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Documento não encontrado.' });
    }

    const eventos = db.prepare(`
      SELECT * FROM dfe_eventos
      WHERE chave_acesso = ?
      ORDER BY dh_evento DESC
    `).all(doc.chave_acesso);

    res.json({ success: true, data: eventos });
  } catch (err: any) {
    console.error('Erro ao buscar eventos:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar eventos.', details: err.message });
  }
});

export default router;
