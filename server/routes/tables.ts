/**
 * ============================================================
 * ROTAS DE TABELAS TRIBUTÁRIAS — CRUD
 * ============================================================
 * Endpoints para gerenciar alíquotas, CFOP, cClassTrib e
 * regras de elegibilidade via banco de dados.
 * ============================================================
 */

import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDatabase } from '../db/database';
import { AuthenticatedRequest, requireAuth, requirePerfil, logAuditAction } from '../middleware/auth';

const router = Router();

// =========================================================
// ALÍQUOTAS DE REFERÊNCIA CBS / IBS
// =========================================================

/** GET /api/tables/aliquotas — Listar alíquotas vigentes */
router.get('/aliquotas', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const { competencia, tipo_tributo } = req.query;

  let query = 'SELECT * FROM aliquotas_referencia WHERE 1=1';
  const params: any[] = [];

  if (competencia) {
    query += ' AND competencia_inicio <= ? AND (competencia_fim IS NULL OR competencia_fim >= ?)';
    params.push(competencia, competencia);
  }
  if (tipo_tributo) {
    query += ' AND tipo_tributo = ?';
    params.push(tipo_tributo);
  }

  query += ' ORDER BY competencia_inicio DESC, tipo_tributo';

  const rows = db.prepare(query).all(...params);
  res.json({ data: rows, total: rows.length });
});

/** GET /api/tables/aliquotas/vigente — Alíquotas vigentes para a data atual */
router.get('/aliquotas/vigente', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const hoje = new Date().toISOString().slice(0, 10);

  const rows = db.prepare(`
    SELECT * FROM aliquotas_referencia
    WHERE competencia_inicio <= ? AND (competencia_fim IS NULL OR competencia_fim >= ?)
    ORDER BY tipo_tributo
  `).all(hoje, hoje);

  res.json({ data: rows, dataReferencia: hoje });
});

/** POST /api/tables/aliquotas — Gravar ou atualizar alíquota (UPSERT) */
router.post('/aliquotas', requireAuth, requirePerfil('admin_master', 'contador_gestor'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const { competencia_inicio, competencia_fim, tipo_tributo, aliquota_referencia, descricao, base_legal, fase_transicao } = req.body;

  if (!competencia_inicio || !tipo_tributo || aliquota_referencia === undefined) {
    res.status(400).json({ error: 'competencia_inicio, tipo_tributo e aliquota_referencia são obrigatórios.' });
    return;
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO aliquotas_referencia (id, competencia_inicio, competencia_fim, tipo_tributo, aliquota_referencia, descricao, base_legal, fase_transicao, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT (competencia_inicio, tipo_tributo) DO UPDATE SET
      aliquota_referencia = excluded.aliquota_referencia,
      competencia_fim = excluded.competencia_fim,
      descricao = excluded.descricao,
      base_legal = excluded.base_legal,
      fase_transicao = excluded.fase_transicao,
      updated_at = datetime('now')
  `).run(id, competencia_inicio, competencia_fim || null, tipo_tributo, aliquota_referencia, descricao || '', base_legal || '', fase_transicao || '');

  logAuditAction(req, 'ALIQUOTA_SALVAR', `Alíquota ${tipo_tributo} = ${aliquota_referencia}% salva para ${competencia_inicio}`);

  res.status(200).json({ success: true, id, message: 'Alíquota gravada com sucesso.' });
});

/** PUT /api/tables/aliquotas/:id — Atualizar alíquota */
router.put('/aliquotas/:id', requireAuth, requirePerfil('admin_master', 'contador_gestor'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const { id } = req.params;
  const { competencia_inicio, competencia_fim, tipo_tributo, aliquota_referencia, descricao, base_legal, fase_transicao } = req.body;

  db.prepare(`
    UPDATE aliquotas_referencia SET 
      competencia_inicio = COALESCE(?, competencia_inicio),
      competencia_fim = ?,
      tipo_tributo = COALESCE(?, tipo_tributo),
      aliquota_referencia = COALESCE(?, aliquota_referencia),
      descricao = COALESCE(?, descricao),
      base_legal = COALESCE(?, base_legal),
      fase_transicao = COALESCE(?, fase_transicao),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(competencia_inicio, competencia_fim, tipo_tributo, aliquota_referencia, descricao, base_legal, fase_transicao, id);

  logAuditAction(req, 'ALIQUOTA_EDITAR', `Alíquota ${id} atualizada`);

  res.json({ success: true, message: 'Alíquota atualizada com sucesso.' });
});

/** DELETE /api/tables/aliquotas/:id */
router.delete('/aliquotas/:id', requireAuth, requirePerfil('admin_master'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  db.prepare('DELETE FROM aliquotas_referencia WHERE id = ?').run(req.params.id);
  logAuditAction(req, 'ALIQUOTA_EXCLUIR', `Alíquota ${req.params.id} removida`, 'WARN');
  res.json({ success: true, message: 'Alíquota removida com sucesso.' });
});

// =========================================================
// MAPA CFOP x TRATAMENTO
// =========================================================

/** GET /api/tables/cfop — Listar todos os CFOPs */
router.get('/cfop', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const empresaId = req.user!.empresaAtivaId;

  // Regras globais (empresa_id = NULL) + regras específicas da empresa
  const rows = db.prepare(`
    SELECT * FROM cfop_tratamento 
    WHERE (empresa_id IS NULL OR empresa_id = ?) AND ativo = 1
    ORDER BY cfop
  `).all(empresaId);

  res.json({ success: true, data: rows, total: rows.length });
});

/** POST /api/tables/cfop — Criar novo CFOP */
router.post('/cfop', requireAuth, requirePerfil('admin_master', 'contador_gestor', 'analista_fiscal'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const { cfop, descricao, categoria, tratamento_padrao, exige_onerosidade, exige_validacao_cclasstrib, evidencia_minima, global } = req.body;

  if (!cfop || !descricao) {
    res.status(400).json({ error: 'cfop e descricao são obrigatórios.' });
    return;
  }

  const id = uuid();
  const empresaId = global ? null : req.user!.empresaAtivaId;

  db.prepare(`
    INSERT INTO cfop_tratamento (id, empresa_id, cfop, descricao, categoria, tratamento_padrao, exige_onerosidade, exige_validacao_cclasstrib, evidencia_minima)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, empresaId, cfop, descricao, categoria || 'Compra', tratamento_padrao || 'Depende', exige_onerosidade ? 1 : 0, exige_validacao_cclasstrib ? 1 : 0, evidencia_minima || '');

  logAuditAction(req, 'CFOP_CRIAR', `CFOP ${cfop} criado: ${descricao}`);

  res.status(201).json({ success: true, id, message: 'CFOP criado com sucesso.' });
});

/** PUT /api/tables/cfop/:id — Editar CFOP */
router.put('/cfop/:id', requireAuth, requirePerfil('admin_master', 'contador_gestor', 'analista_fiscal'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const { id } = req.params;
  const { cfop, descricao, categoria, tratamento_padrao, exige_onerosidade, evidencia_minima } = req.body;

  db.prepare(`
    UPDATE cfop_tratamento SET
      cfop = COALESCE(?, cfop),
      descricao = COALESCE(?, descricao),
      categoria = COALESCE(?, categoria),
      tratamento_padrao = COALESCE(?, tratamento_padrao),
      exige_onerosidade = COALESCE(?, exige_onerosidade),
      evidencia_minima = COALESCE(?, evidencia_minima),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(cfop, descricao, categoria, tratamento_padrao, exige_onerosidade !== undefined ? (exige_onerosidade ? 1 : 0) : null, evidencia_minima, id);

  logAuditAction(req, 'CFOP_EDITAR', `CFOP ${id} atualizado`);
  res.json({ success: true, message: 'CFOP atualizado com sucesso.' });
});

/** DELETE /api/tables/cfop/:id */
router.delete('/cfop/:id', requireAuth, requirePerfil('admin_master', 'contador_gestor'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  db.prepare('UPDATE cfop_tratamento SET ativo = 0, updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);
  logAuditAction(req, 'CFOP_DESATIVAR', `CFOP ${req.params.id} desativado`);
  res.json({ success: true, message: 'CFOP desativado com sucesso.' });
});

// =========================================================
// MAPA cClassTrib (6 Dígitos)
// =========================================================

/** GET /api/tables/cclasstrib */
router.get('/cclasstrib', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const empresaId = req.user!.empresaAtivaId;

  const rows = db.prepare(`
    SELECT * FROM cclasstrib_regras 
    WHERE (empresa_id IS NULL OR empresa_id = ?) AND ativo = 1
    ORDER BY cclasstrib
  `).all(empresaId);

  res.json({ success: true, data: rows, total: rows.length });
});

/** POST /api/tables/cclasstrib */
router.post('/cclasstrib', requireAuth, requirePerfil('admin_master', 'contador_gestor', 'analista_fiscal'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const { cclasstrib, descricao_interna, tratamento_esperado, permite_credito, aliquota_esperada, alertas, global } = req.body;

  if (!cclasstrib || !descricao_interna) {
    res.status(400).json({ error: 'cclasstrib e descricao_interna são obrigatórios.' });
    return;
  }

  const cleanCode = String(cclasstrib).replace(/\D/g, '').padStart(6, '0');
  const id = uuid();
  const empresaId = global ? null : req.user!.empresaAtivaId;

  db.prepare(`
    INSERT INTO cclasstrib_regras (id, empresa_id, cclasstrib, descricao_interna, tratamento_esperado, permite_credito, aliquota_esperada, alertas)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, empresaId, cleanCode, descricao_interna, tratamento_esperado || 'tributado', permite_credito || 'Sim', aliquota_esperada || '', alertas || '');

  logAuditAction(req, 'CCLASSTRIB_CRIAR', `cClassTrib ${cleanCode} criado: ${descricao_interna}`);

  res.status(201).json({ success: true, id, message: 'cClassTrib criado com sucesso.' });
});

/** PUT /api/tables/cclasstrib/:id */
router.put('/cclasstrib/:id', requireAuth, requirePerfil('admin_master', 'contador_gestor', 'analista_fiscal'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const { id } = req.params;
  const { cclasstrib, descricao_interna, tratamento_esperado, permite_credito, aliquota_esperada, alertas } = req.body;

  const cleanCode = cclasstrib ? String(cclasstrib).replace(/\D/g, '').padStart(6, '0') : undefined;

  db.prepare(`
    UPDATE cclasstrib_regras SET
      cclasstrib = COALESCE(?, cclasstrib),
      descricao_interna = COALESCE(?, descricao_interna),
      tratamento_esperado = COALESCE(?, tratamento_esperado),
      permite_credito = COALESCE(?, permite_credito),
      aliquota_esperada = COALESCE(?, aliquota_esperada),
      alertas = COALESCE(?, alertas),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(cleanCode, descricao_interna, tratamento_esperado, permite_credito, aliquota_esperada, alertas, id);

  logAuditAction(req, 'CCLASSTRIB_EDITAR', `cClassTrib ${id} atualizado`);
  res.json({ success: true, message: 'cClassTrib atualizado com sucesso.' });
});

/** DELETE /api/tables/cclasstrib/:id */
router.delete('/cclasstrib/:id', requireAuth, requirePerfil('admin_master', 'contador_gestor'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  db.prepare('UPDATE cclasstrib_regras SET ativo = 0, updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);
  logAuditAction(req, 'CCLASSTRIB_DESATIVAR', `cClassTrib ${req.params.id} desativado`);
  res.json({ success: true, message: 'cClassTrib desativado.' });
});

// =========================================================
// REGRAS DE ELEGIBILIDADE
// =========================================================

/** GET /api/tables/regras */
router.get('/regras', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const empresaId = req.user!.empresaAtivaId;

  const rows = db.prepare(`
    SELECT * FROM regras_elegibilidade 
    WHERE (empresa_id IS NULL OR empresa_id = ?) AND ativo = 1
    ORDER BY codigo_regra
  `).all(empresaId);

  res.json({ success: true, data: rows, total: rows.length });
});

/** POST /api/tables/regras */
router.post('/regras', requireAuth, requirePerfil('admin_master', 'contador_gestor'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const { codigo_regra, nome, descricao, tipo_aquisicao, cfops_aplicaveis, cclasstrib_aplicaveis, resultado_padrao, evidencia_minima, base_legal, global } = req.body;

  if (!codigo_regra || !nome || !descricao) {
    res.status(400).json({ error: 'codigo_regra, nome e descricao são obrigatórios.' });
    return;
  }

  const id = uuid();
  const empresaId = global ? null : req.user!.empresaAtivaId;

  db.prepare(`
    INSERT INTO regras_elegibilidade (id, empresa_id, codigo_regra, nome, descricao, tipo_aquisicao, cfops_aplicaveis, cclasstrib_aplicaveis, resultado_padrao, evidencia_minima, base_legal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, empresaId, codigo_regra, nome, descricao, tipo_aquisicao || '', cfops_aplicaveis || '[]', cclasstrib_aplicaveis || '[]', resultado_padrao || 'Pendente', evidencia_minima || '', base_legal || '');

  logAuditAction(req, 'REGRA_CRIAR', `Regra ${codigo_regra} criada: ${nome}`);

  res.status(201).json({ success: true, id, message: 'Regra criada com sucesso.' });
});

/** DELETE /api/tables/regras/:id */
router.delete('/regras/:id', requireAuth, requirePerfil('admin_master'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  db.prepare('UPDATE regras_elegibilidade SET ativo = 0, updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);
  logAuditAction(req, 'REGRA_DESATIVAR', `Regra ${req.params.id} desativada`);
  res.json({ success: true, message: 'Regra desativada.' });
});

export default router;
