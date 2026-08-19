/**
 * ============================================================
 * ROTAS SEFAZ — TRANSMISSÃO DE EVENTOS FISCAIS
 * ============================================================
 * Endpoints para transmitir eventos reais para a SEFAZ
 * em ambiente de homologação e produção. Todas as credenciais
 * e comunicações ficam no servidor — o frontend apenas
 * envia o ID do evento e a chave de acesso.
 * ============================================================
 */

import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDatabase } from '../db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';
import { AuthenticatedRequest, requireAuth, requirePerfil, logAuditAction } from '../middleware/auth';
import { transmitirEventoSefaz, testarConexaoSefaz, consultarDistribuicaoDFe, EventoSefazRequest } from '../services/sefazService';

const router = Router();

// =========================================================
// POST /api/sefaz/distribui-dfe — Consulta NFeDistribuicaoDFe
// =========================================================
router.post('/distribui-dfe', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cnpj, ultNSU, chNFe, nsuEspecifico, tpAmb, fluxo } = req.body;

    if (!cnpj) {
      res.status(400).json({ success: false, message: 'CNPJ é obrigatório para consulta no WebService SEFAZ.' });
      return;
    }

    const cleanCnpj = cnpj.replace(/\D/g, '');
    const db = getDatabase();

    // 1. Localizar a empresa no banco de dados para recuperar o ID e o certificado vinculado
    let empresa: any = null;

    if (req.user?.empresaAtivaId) {
      empresa = db.prepare('SELECT * FROM empresas WHERE id = ?').get(req.user.empresaAtivaId);
    }

    if (!empresa) {
      empresa = db.prepare(`
        SELECT * FROM empresas 
        WHERE REPLACE(REPLACE(REPLACE(cnpj_completo, '.', ''), '/', ''), '-', '') = ? 
           OR cnpj_raiz = ? 
           OR cnpj_completo = ?
        LIMIT 1
      `).get(cleanCnpj, cleanCnpj.substring(0, 8), cnpj);
    }

    if (!empresa && isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        let { data: supaEmp } = await supabase
          .from('empresas')
          .select('*')
          .eq('cnpj_raiz', cleanCnpj.substring(0, 8))
          .limit(1)
          .maybeSingle();

        if (!supaEmp) {
          const { data: supaByCnpj } = await supabase
            .from('empresas')
            .select('*')
            .eq('cnpj_completo', cnpj)
            .limit(1)
            .maybeSingle();
          supaEmp = supaByCnpj;
        }

        if (supaEmp) {
          empresa = supaEmp;
        }
      }
    }

    const empresaId = empresa?.id || req.user?.empresaAtivaId || '';
    const ufAutor = req.body.ufAutor || empresa?.uf || 'SP';
    const manifestarCienciaAutomatica = empresa?.manifestar_ciencia_automatica !== undefined 
      ? Boolean(empresa.manifestar_ciencia_automatica) 
      : true;

    // 2. Chamar o serviço de comunicação SOAP com mTLS
    const resultado = await consultarDistribuicaoDFe({
      cnpj: cleanCnpj,
      ultNSU: ultNSU !== undefined ? ultNSU : (empresa?.ultimo_nsu || '000000000000000'),
      chNFe,
      nsuEspecifico,
      tpAmb: (tpAmb === '1' || tpAmb === 'producao') ? '1' : '2',
      empresaId,
      ufAutor,
      fluxo: fluxo || 'entrada',
      manifestarCienciaAutomatica,
    });

    logAuditAction(
      req, 
      'SEFAZ_DISTRIBUICAO_DFE', 
      `Consulta NFeDistribuicaoDFe para CNPJ ${cleanCnpj} (ultNSU=${resultado.ultNSU}, docs=${resultado.docs.length}): cStat=${resultado.cStat} - ${resultado.xMotivo}`
    );

    res.json({
      success: resultado.success,
      cStat: resultado.cStat,
      xMotivo: resultado.xMotivo,
      ultNSU: resultado.ultNSU,
      maxNSU: resultado.maxNSU,
      tpAmb: resultado.tpAmb,
      docs: resultado.docs,
    });
  } catch (err: any) {
    console.error('❌ Erro na rota /api/sefaz/distribui-dfe:', err.message);
    res.status(500).json({ success: false, message: 'Erro interno ao consultar SEFAZ: ' + err.message });
  }
});

// =========================================================
// POST /api/sefaz/evento — Transmitir evento fiscal
// =========================================================
router.post('/evento', requireAuth, requirePerfil('admin_master', 'contador_gestor', 'analista_fiscal'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      chaveAcesso,
      codigoEvento,
      nomeEvento,
      categoria,
      justificativa,
      tpAmb,
      tipoDfe,
    } = req.body;

    // Validações
    if (!chaveAcesso || !codigoEvento || !nomeEvento) {
      res.status(400).json({ error: 'chaveAcesso, codigoEvento e nomeEvento são obrigatórios.' });
      return;
    }

    if (chaveAcesso.replace(/\D/g, '').length !== 44) {
      res.status(400).json({ error: 'Chave de acesso deve conter 44 dígitos.' });
      return;
    }

    // Verificar se evento já foi transmitido (idempotência)
    const db = getDatabase();
    const eventoExistente = db.prepare(`
      SELECT id, protocolo_sefaz, status FROM eventos_transmitidos
      WHERE chave_acesso = ? AND codigo_evento = ? AND empresa_id = ? AND status = 'processado'
    `).get(chaveAcesso, codigoEvento, req.user!.empresaAtivaId) as any;

    if (eventoExistente) {
      res.status(409).json({
        error: `Evento ${codigoEvento} já foi transmitido para esta chave de acesso.`,
        code: 'EVENTO_DUPLICADO',
        protocoloExistente: eventoExistente.protocolo_sefaz,
      });
      return;
    }

    // Buscar CNPJ da empresa ativa
    const empresa = db.prepare('SELECT cnpj_completo FROM empresas WHERE id = ?').get(req.user!.empresaAtivaId) as any;

    // Montar request para o serviço SEFAZ
    const sefazRequest: EventoSefazRequest = {
      chaveAcesso: chaveAcesso.replace(/\D/g, ''),
      codigoEvento,
      nomeEvento,
      justificativa: justificativa || undefined,
      tpAmb: tpAmb || '2', // Default: homologação
      cnpjAutor: empresa?.cnpj_completo || req.user!.empresaCnpj,
      empresaId: req.user!.empresaAtivaId,
    };

    // Transmitir para SEFAZ
    const resultado = await transmitirEventoSefaz(sefazRequest);

    // Salvar no banco de dados
    const eventoId = uuid();
    db.prepare(`
      INSERT INTO eventos_transmitidos (
        id, empresa_id, usuario_id, chave_acesso, tipo_dfe, codigo_evento,
        nome_evento, categoria, justificativa, ambiente, protocolo_sefaz,
        xml_envio, xml_retorno, codigo_retorno, motivo_retorno, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventoId,
      req.user!.empresaAtivaId,
      req.user!.userId,
      chaveAcesso,
      tipoDfe || 'NFe',
      codigoEvento,
      nomeEvento,
      categoria || 'destinatario',
      justificativa || '',
      sefazRequest.tpAmb,
      resultado.nProt || '',
      resultado.xmlEnvio,
      resultado.xmlRetorno,
      resultado.cStat,
      resultado.xMotivo,
      resultado.success ? 'processado' : 'rejeitado'
    );

    // Log de auditoria
    logAuditAction(
      req,
      'EVENTO_SEFAZ',
      `Evento ${codigoEvento} (${nomeEvento}) transmitido para chave ${chaveAcesso.slice(0, 20)}... cStat=${resultado.cStat}`,
      resultado.success ? 'INFO' : 'WARN',
      { codigoEvento, chaveAcesso, cStat: resultado.cStat, nProt: resultado.nProt }
    );

    res.json({
      id: eventoId,
      success: resultado.success,
      cStat: resultado.cStat,
      xMotivo: resultado.xMotivo,
      protocoloSefaz: resultado.nProt || '',
      dhRegEvento: resultado.dhRegEvento || new Date().toISOString(),
      ambiente: sefazRequest.tpAmb === '1' ? 'Produção' : 'Homologação',
      status: resultado.success ? 'processado' : 'rejeitado',
    });
  } catch (err: any) {
    console.error('Erro ao transmitir evento SEFAZ:', err);
    res.status(500).json({ error: `Falha ao transmitir evento: ${err.message}`, code: 'SEFAZ_ERROR' });
  }
});

// =========================================================
// GET /api/sefaz/eventos — Histórico de eventos transmitidos
// =========================================================
router.get('/eventos', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const { limit, offset, chaveAcesso, status } = req.query;

  let query = `
    SELECT et.*, u.nome as usuario_nome, u.email as usuario_email
    FROM eventos_transmitidos et
    LEFT JOIN usuarios u ON u.id = et.usuario_id
    WHERE et.empresa_id = ?
  `;
  const params: any[] = [req.user!.empresaAtivaId];

  if (chaveAcesso) {
    query += ' AND et.chave_acesso = ?';
    params.push(chaveAcesso);
  }
  if (status) {
    query += ' AND et.status = ?';
    params.push(status);
  }

  query += ' ORDER BY et.data_hora DESC';
  query += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit as string) || 50);
  params.push(parseInt(offset as string) || 0);

  const rows = db.prepare(query).all(...params);

  // Total count
  let countQuery = 'SELECT COUNT(*) as total FROM eventos_transmitidos WHERE empresa_id = ?';
  const countParams: any[] = [req.user!.empresaAtivaId];
  if (chaveAcesso) { countQuery += ' AND chave_acesso = ?'; countParams.push(chaveAcesso); }
  if (status) { countQuery += ' AND status = ?'; countParams.push(status); }
  const totalRow = db.prepare(countQuery).get(...countParams) as any;

  res.json({ data: rows, total: totalRow.total });
});

// =========================================================
// GET /api/sefaz/ping — Testar conectividade com SEFAZ
// =========================================================
router.get('/ping', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tpAmb = (req.query.tpAmb as string) || '2';
    const resultado = await testarConexaoSefaz(tpAmb as '1' | '2');

    logAuditAction(req, 'SEFAZ_PING', `Teste de conectividade SEFAZ (tpAmb=${tpAmb}): ${resultado.online ? 'OK' : 'FALHA'}`, resultado.online ? 'INFO' : 'WARN');

    res.json({
      ...resultado,
      ambiente: tpAmb === '1' ? 'Produção' : 'Homologação',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ online: false, error: err.message });
  }
});

export default router;
