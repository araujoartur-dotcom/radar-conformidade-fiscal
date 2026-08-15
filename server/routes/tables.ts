/**
 * ============================================================
 * ROTAS DE TABELAS TRIBUTÁRIAS — CRUD
 * ============================================================
 * Endpoints para gerenciar alíquotas, CFOP, cClassTrib e
 * regras de elegibilidade com suporte a Supabase e SQLite.
 * ============================================================
 */

import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDatabase } from '../db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';
import { AuthenticatedRequest, requireAuth, requirePerfil, logAuditAction } from '../middleware/auth';

const router = Router();

// =========================================================
// ALÍQUOTAS DE REFERÊNCIA CBS / IBS
// =========================================================

/** GET /api/tables/aliquotas — Listar alíquotas vigentes */
router.get('/aliquotas', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { competencia, tipo_tributo } = req.query;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        let q = supabase.from('aliquotas_referencia').select('*');
        if (competencia) {
          q = q.lte('competencia_inicio', String(competencia));
        }
        if (tipo_tributo) {
          q = q.eq('tipo_tributo', String(tipo_tributo));
        }
        const { data, error } = await q.order('competencia_inicio', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data: data || [], total: (data || []).length });
        return;
      }
    }

    const db = getDatabase();
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
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao listar alíquotas: ' + err.message });
  }
});

/** GET /api/tables/aliquotas/vigente — Alíquotas vigentes para a data atual */
router.get('/aliquotas/vigente', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const hoje = new Date().toISOString().slice(0, 10);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data, error } = await supabase
          .from('aliquotas_referencia')
          .select('*')
          .lte('competencia_inicio', hoje)
          .order('tipo_tributo');

        if (error) throw error;
        res.json({ success: true, data: data || [], dataReferencia: hoje });
        return;
      }
    }

    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM aliquotas_referencia
      WHERE competencia_inicio <= ? AND (competencia_fim IS NULL OR competencia_fim >= ?)
      ORDER BY tipo_tributo
    `).all(hoje, hoje);

    res.json({ success: true, data: rows, dataReferencia: hoje });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao buscar alíquotas vigentes: ' + err.message });
  }
});

/** POST /api/tables/aliquotas — Gravar ou atualizar alíquota (UPSERT) */
router.post('/aliquotas', requireAuth, requirePerfil('admin_master', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { competencia_inicio, competencia_fim, tipo_tributo, aliquota_referencia, descricao, base_legal, fase_transicao } = req.body;

    if (!competencia_inicio || !tipo_tributo || aliquota_referencia === undefined) {
      res.status(400).json({ error: 'competencia_inicio, tipo_tributo e aliquota_referencia são obrigatórios.' });
      return;
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { error } = await supabase
          .from('aliquotas_referencia')
          .upsert({
            competencia_inicio,
            competencia_fim: competencia_fim || null,
            tipo_tributo,
            aliquota_referencia,
            descricao: descricao || '',
            base_legal: base_legal || '',
            fase_transicao: fase_transicao || '',
            updated_at: new Date().toISOString()
          }, { onConflict: 'competencia_inicio,tipo_tributo' });

        if (error) throw error;
        res.status(200).json({ success: true, message: 'Alíquota gravada com sucesso no Supabase.' });
        return;
      }
    }

    const db = getDatabase();
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

    res.status(200).json({ success: true, id, message: 'Alíquota gravada com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao gravar alíquota: ' + err.message });
  }
});

// =========================================================
// MAPA CFOP x TRATAMENTO
// =========================================================

/** GET /api/tables/cfop — Listar todos os CFOPs */
router.get('/cfop', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const empresaId = req.user!.empresaAtivaId;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data, error } = await supabase
          .from('cfop_tratamento')
          .select('*')
          .eq('ativo', true)
          .order('cfop');

        if (error) throw error;
        res.json({ success: true, data: data || [], total: (data || []).length });
        return;
      }
    }

    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM cfop_tratamento 
      WHERE (empresa_id IS NULL OR empresa_id = ?) AND ativo = 1
      ORDER BY cfop
    `).all(empresaId);

    res.json({ success: true, data: rows, total: rows.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao listar CFOPs: ' + err.message });
  }
});

/** POST /api/tables/cfop — Criar novo CFOP */
router.post('/cfop', requireAuth, requirePerfil('admin_master', 'contador_gestor', 'analista_fiscal'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cfop, descricao, categoria, tratamento_padrao, exige_onerosidade, evidencia_minima, global } = req.body;

    if (!cfop || !descricao) {
      res.status(400).json({ error: 'cfop e descricao são obrigatórios.' });
      return;
    }

    const empresaId = global ? null : req.user!.empresaAtivaId;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data, error } = await supabase
          .from('cfop_tratamento')
          .insert({
            empresa_id: empresaId,
            cfop,
            descricao,
            categoria: categoria || 'Compra',
            tratamento_padrao: tratamento_padrao || 'Depende',
            exige_onerosidade: Boolean(exige_onerosidade),
            evidencia_minima: evidencia_minima || ''
          })
          .select()
          .single();

        if (error) throw error;
        res.status(201).json({ success: true, id: data.id, message: 'CFOP criado com sucesso no Supabase.' });
        return;
      }
    }

    const db = getDatabase();
    const id = uuid();
    db.prepare(`
      INSERT INTO cfop_tratamento (id, empresa_id, cfop, descricao, categoria, tratamento_padrao, exige_onerosidade, exige_validacao_cclasstrib, evidencia_minima)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(id, empresaId, cfop, descricao, categoria || 'Compra', tratamento_padrao || 'Depende', exige_onerosidade ? 1 : 0, evidencia_minima || '');

    res.status(201).json({ success: true, id, message: 'CFOP criado com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao criar CFOP: ' + err.message });
  }
});

/** PUT /api/tables/cfop/:id */
router.put('/cfop/:id', requireAuth, requirePerfil('admin_master', 'contador_gestor', 'analista_fiscal'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { cfop, descricao, categoria, tratamento_padrao, exige_onerosidade, evidencia_minima } = req.body;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { error } = await supabase
          .from('cfop_tratamento')
          .update({
            cfop,
            descricao,
            categoria,
            tratamento_padrao,
            exige_onerosidade: Boolean(exige_onerosidade),
            evidencia_minima,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'CFOP atualizado com sucesso no Supabase.' });
        return;
      }
    }

    const db = getDatabase();
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

    res.json({ success: true, message: 'CFOP atualizado com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao atualizar CFOP: ' + err.message });
  }
});

/** DELETE /api/tables/cfop/:id */
router.delete('/cfop/:id', requireAuth, requirePerfil('admin_master', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { error } = await supabase
          .from('cfop_tratamento')
          .update({ ativo: false, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        res.json({ success: true, message: 'CFOP desativado no Supabase.' });
        return;
      }
    }

    const db = getDatabase();
    db.prepare('UPDATE cfop_tratamento SET ativo = 0, updated_at = datetime(\'now\') WHERE id = ?').run(id);
    res.json({ success: true, message: 'CFOP desativado com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao desativar CFOP: ' + err.message });
  }
});

// =========================================================
// MAPA cClassTrib (6 Dígitos)
// =========================================================

/** GET /api/tables/cclasstrib */
router.get('/cclasstrib', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data, error } = await supabase
          .from('cclasstrib_regras')
          .select('*')
          .eq('ativo', true)
          .order('cclasstrib');

        if (error) throw error;
        res.json({ success: true, data: data || [], total: (data || []).length });
        return;
      }
    }

    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM cclasstrib_regras 
      WHERE ativo = 1
      ORDER BY cclasstrib
    `).all();

    res.json({ success: true, data: rows, total: rows.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao listar cClassTrib: ' + err.message });
  }
});

// =========================================================
// REGRAS DE ELEGIBILIDADE
// =========================================================

/** GET /api/tables/regras */
router.get('/regras', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data, error } = await supabase
          .from('regras_elegibilidade')
          .select('*')
          .eq('ativo', true)
          .order('codigo_regra');

        if (error) throw error;
        res.json({ success: true, data: data || [], total: (data || []).length });
        return;
      }
    }

    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM regras_elegibilidade 
      WHERE ativo = 1
      ORDER BY codigo_regra
    `).all();

    res.json({ success: true, data: rows, total: rows.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao listar regras: ' + err.message });
  }
});

export default router;
