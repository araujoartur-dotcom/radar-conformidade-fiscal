/**
 * ============================================================
 * ROTAS DE TABELAS TRIBUTÁRIAS — CRUD E MOTOR DINÂMICO
 * ============================================================
 * Endpoints para gerenciar alíquotas Ad Valorem, Ad Rem, CFOP,
 * cClassTrib, NCM Anexos e Regras de Elegibilidade.
 * Integridade total no SQLite com sincronização segura ao Supabase.
 * ============================================================
 */

import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDatabase } from '../db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';
import { AuthenticatedRequest, requireAuth, requirePerfil } from '../middleware/auth';
import { getBrasiliaTimestamp, getBrasiliaDate } from '../utils/timezone';

const router = Router();

// =========================================================
// 1. ALÍQUOTAS DE REFERÊNCIA CBS / IBS (por Competência)
// =========================================================

/** GET /api/tables/aliquotas — Listar alíquotas de referência */
router.get('/aliquotas', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { competencia, tipo_tributo } = req.query;

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
router.get('/aliquotas/vigente', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const hoje = getBrasiliaDate();
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

    // Sincronização segura em segundo plano com Supabase
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          await supabase.from('aliquotas_referencia').upsert({
            competencia_inicio,
            competencia_fim: competencia_fim || null,
            tipo_tributo,
            aliquota_referencia,
            descricao: descricao || '',
            base_legal: base_legal || '',
            fase_transicao: fase_transicao || '',
            updated_at: getBrasiliaTimestamp()
          }, { onConflict: 'competencia_inicio,tipo_tributo' });
        } catch (e: any) {
          console.warn('⚠️ Supabase sync warning (aliquotas_referencia):', e?.message || e);
        }
      }
    }

    res.status(200).json({ success: true, id, message: 'Alíquota gravada com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao gravar alíquota: ' + err.message });
  }
});

// =========================================================
// 2. TABELAS DE ALÍQUOTAS AD VALOREM (%)
// =========================================================

/** GET /api/tables/aliquotas/ad-valorem — Listar linhas Ad Valorem */
router.get('/aliquotas/ad-valorem', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM aliquotas_tabelas
      WHERE modalidade = 'ad_valorem'
      ORDER BY inicio_vigencia ASC, codigo_cadastro ASC
    `).all();

    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao listar alíquotas Ad Valorem: ' + err.message });
  }
});

/** POST /api/tables/aliquotas/ad-valorem — Criar/Atualizar linha Ad Valorem */
router.post('/aliquotas/ad-valorem', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, codigo_cadastro, cbs_federal, ibs_estadual, ibs_municipal, is_federal, inicio_vigencia, final_vigencia, descricao } = req.body;

    const rowId = id || uuid();
    const codCad = codigo_cadastro || '00001';
    const cbs = Number(cbs_federal || 0);
    const ibsEst = Number(ibs_estadual || 0);
    const ibsMun = Number(ibs_municipal || 0);
    const isFed = Number(is_federal || 0);
    const ini = inicio_vigencia || '2026-01-01';
    const fim = final_vigencia || '2026-12-31';
    const desc = descricao || '';

    // 1. Gravar com prioridade absoluta no SQLite local (100% ACID, zero schema cache errors)
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO aliquotas_tabelas (
        id, codigo_cadastro, modalidade, cbs_federal, ibs_estadual, ibs_municipal, is_federal, unidade_medida, inicio_vigencia, final_vigencia, descricao, updated_at
      ) VALUES (?, ?, 'ad_valorem', ?, ?, ?, ?, NULL, ?, ?, ?, datetime('now'))
    `).run(rowId, codCad, cbs, ibsEst, ibsMun, isFed, ini, fim, desc);

    // 2. Sincronização segura no Supabase (se a tabela existir na nuvem)
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          await supabase
            .from('aliquotas_tabelas')
            .upsert({
              id: rowId,
              codigo_cadastro: codCad,
              modalidade: 'ad_valorem',
              cbs_federal: cbs,
              ibs_estadual: ibsEst,
              ibs_municipal: ibsMun,
              is_federal: isFed,
              unidade_medida: null,
              inicio_vigencia: ini,
              final_vigencia: fim,
              descricao: desc,
              updated_at: getBrasiliaTimestamp()
            });
        } catch (supaErr: any) {
          console.warn('⚠️ Supabase ad-valorem sync warning:', supaErr?.message || supaErr);
        }
      }
    }

    res.json({ success: true, message: 'Alíquota Ad Valorem salva com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao salvar alíquota Ad Valorem: ' + err.message });
  }
});

/** DELETE /api/tables/aliquotas/ad-valorem/:id */
router.delete('/aliquotas/ad-valorem/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const db = getDatabase();
    db.prepare('DELETE FROM aliquotas_tabelas WHERE id = ?').run(id);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          await supabase.from('aliquotas_tabelas').delete().eq('id', id);
        } catch (e: any) {
          console.warn('⚠️ Supabase ad-valorem delete warning:', e?.message || e);
        }
      }
    }

    res.json({ success: true, message: 'Registro removido com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao excluir registro: ' + err.message });
  }
});

// =========================================================
// 3. TABELAS DE ALÍQUOTAS AD REM (R$ / UNIDADE)
// =========================================================

/** GET /api/tables/aliquotas/ad-rem — Listar linhas Ad Rem */
router.get('/aliquotas/ad-rem', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM aliquotas_tabelas
      WHERE modalidade = 'ad_rem'
      ORDER BY inicio_vigencia ASC, codigo_cadastro ASC
    `).all();

    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao listar alíquotas Ad Rem: ' + err.message });
  }
});

/** POST /api/tables/aliquotas/ad-rem — Criar/Atualizar linha Ad Rem */
router.post('/aliquotas/ad-rem', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, codigo_cadastro, cbs_federal, ibs_estadual, ibs_municipal, is_federal, unidade_medida, inicio_vigencia, final_vigencia, descricao } = req.body;

    const rowId = id || uuid();
    const codCad = codigo_cadastro || '00001';
    const cbs = Number(cbs_federal || 0);
    const ibsEst = Number(ibs_estadual || 0);
    const ibsMun = Number(ibs_municipal || 0);
    const isFed = Number(is_federal || 0);
    const unid = unidade_medida || 'kg';
    const ini = inicio_vigencia || '2026-01-01';
    const fim = final_vigencia || '2026-12-31';
    const desc = descricao || '';

    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO aliquotas_tabelas (
        id, codigo_cadastro, modalidade, cbs_federal, ibs_estadual, ibs_municipal, is_federal, unidade_medida, inicio_vigencia, final_vigencia, descricao, updated_at
      ) VALUES (?, ?, 'ad_rem', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(rowId, codCad, cbs, ibsEst, ibsMun, isFed, unid, ini, fim, desc);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          await supabase
            .from('aliquotas_tabelas')
            .upsert({
              id: rowId,
              codigo_cadastro: codCad,
              modalidade: 'ad_rem',
              cbs_federal: cbs,
              ibs_estadual: ibsEst,
              ibs_municipal: ibsMun,
              is_federal: isFed,
              unidade_medida: unid,
              inicio_vigencia: ini,
              final_vigencia: fim,
              descricao: desc,
              updated_at: getBrasiliaTimestamp()
            });
        } catch (supaErr: any) {
          console.warn('⚠️ Supabase ad-rem sync warning:', supaErr?.message || supaErr);
        }
      }
    }

    res.json({ success: true, message: 'Alíquota Ad Rem salva com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao salvar alíquota Ad Rem: ' + err.message });
  }
});

/** DELETE /api/tables/aliquotas/ad-rem/:id */
router.delete('/aliquotas/ad-rem/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const db = getDatabase();
    db.prepare('DELETE FROM aliquotas_tabelas WHERE id = ?').run(id);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          await supabase.from('aliquotas_tabelas').delete().eq('id', id);
        } catch (e: any) {
          console.warn('⚠️ Supabase ad-rem delete warning:', e?.message || e);
        }
      }
    }

    res.json({ success: true, message: 'Registro removido com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao excluir registro: ' + err.message });
  }
});

// =========================================================
// 4. CATÁLOGO DE ANEXOS DA LEI & NCMs (Reduções e Isenções)
// =========================================================

/** GET /api/tables/anexos-ncm — Listar regras de NCM / Anexos */
router.get('/anexos-ncm', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q, tipo_tratamento } = req.query as { q?: string; tipo_tratamento?: string };

    const db = getDatabase();
    let sql = 'SELECT * FROM ncm_regras_anexos WHERE ativo = 1';
    const params: any[] = [];

    if (tipo_tratamento && tipo_tratamento !== 'todos') {
      sql += ' AND tipo_tratamento = ?';
      params.push(tipo_tratamento);
    }
    if (q && q.trim()) {
      sql += ' AND (ncm LIKE ? OR descricao LIKE ? OR cclasstrib LIKE ?)';
      const term = `%${q.trim()}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY ncm ASC';
    const rows = db.prepare(sql).all(...params);

    res.json({ success: true, data: rows, total: rows.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao listar anexos NCM: ' + err.message });
  }
});

/** POST /api/tables/anexos-ncm — Criar/Atualizar regra NCM */
router.post('/anexos-ncm', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, ncm, nbs, cclasstrib, descricao, tipo_tratamento, percentual_reducao, anexo_lei, base_legal, vigencia_inicio, vigencia_fim } = req.body;

    if (!ncm || !descricao) {
      res.status(400).json({ success: false, message: 'NCM e Descrição são obrigatórios.' });
      return;
    }

    const rowId = id || uuid();
    const red = Number(percentual_reducao || 0);

    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO ncm_regras_anexos (
        id, ncm, nbs, cclasstrib, descricao, tipo_tratamento, percentual_reducao, anexo_lei, base_legal, vigencia_inicio, vigencia_fim, ativo, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `).run(
      rowId, ncm.trim(), nbs || '', cclasstrib || '', descricao.trim(),
      tipo_tratamento || 'padrao', red, anexo_lei || '', base_legal || '',
      vigencia_inicio || '2026-01-01', vigencia_fim || '2033-12-31'
    );

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          await supabase
            .from('ncm_regras_anexos')
            .upsert({
              id: rowId,
              ncm: ncm.trim(),
              nbs: nbs || '',
              cclasstrib: cclasstrib || '',
              descricao: descricao.trim(),
              tipo_tratamento: tipo_tratamento || 'padrao',
              percentual_reducao: red,
              anexo_lei: anexo_lei || '',
              base_legal: base_legal || '',
              vigencia_inicio: vigencia_inicio || '2026-01-01',
              vigencia_fim: vigencia_fim || '2033-12-31',
              ativo: true,
              updated_at: getBrasiliaTimestamp()
            });
        } catch (supaErr: any) {
          console.warn('⚠️ Supabase ncm_regras_anexos sync warning:', supaErr?.message || supaErr);
        }
      }
    }

    res.json({ success: true, message: 'Regra de NCM gravada com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao gravar regra NCM: ' + err.message });
  }
});

/** POST /api/tables/anexos-ncm/upload-lote — Inserir lote de NCMs importados do Excel */
router.post('/anexos-ncm/upload-lote', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itens } = req.body as { itens: any[] };
    if (!Array.isArray(itens) || itens.length === 0) {
      res.status(400).json({ success: false, message: 'Nenhum item válido enviado para importação.' });
      return;
    }

    const db = getDatabase();
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO ncm_regras_anexos (
        id, ncm, nbs, cclasstrib, descricao, tipo_tratamento, percentual_reducao, anexo_lei, base_legal, vigencia_inicio, vigencia_fim, ativo, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `);

    let inseridos = 0;
    const tx = db.transaction((rows: any[]) => {
      for (const it of rows) {
        if (!it.ncm) continue;
        insertStmt.run(
          it.id || uuid(),
          String(it.ncm).trim(),
          it.nbs || '',
          it.cclasstrib || '',
          it.descricao || 'Item Importado',
          it.tipo_tratamento || 'padrao',
          Number(it.percentual_reducao || 0),
          it.anexo_lei || '',
          it.base_legal || 'LC 214/2025',
          it.vigencia_inicio || '2026-01-01',
          it.vigencia_fim || '2033-12-31'
        );
        inseridos++;
      }
    });

    tx(itens);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          const supaRows = itens.map(it => ({
            id: it.id || uuid(),
            ncm: String(it.ncm).trim(),
            nbs: it.nbs || '',
            cclasstrib: it.cclasstrib || '',
            descricao: it.descricao || 'Item Importado',
            tipo_tratamento: it.tipo_tratamento || 'padrao',
            percentual_reducao: Number(it.percentual_reducao || 0),
            anexo_lei: it.anexo_lei || '',
            base_legal: it.base_legal || 'LC 214/2025',
            vigencia_inicio: it.vigencia_inicio || '2026-01-01',
            vigencia_fim: it.vigencia_fim || '2033-12-31',
            ativo: true
          }));
          await supabase.from('ncm_regras_anexos').upsert(supaRows);
        } catch (e: any) {
          console.warn('⚠️ Supabase ncm_regras_anexos batch warning:', e?.message || e);
        }
      }
    }

    res.json({ success: true, message: `${inseridos} regras de NCM importadas com sucesso.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro na importação em lote de NCMs: ' + err.message });
  }
});

/** DELETE /api/tables/anexos-ncm/:id */
router.delete('/anexos-ncm/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const db = getDatabase();
    db.prepare('DELETE FROM ncm_regras_anexos WHERE id = ?').run(id);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          await supabase.from('ncm_regras_anexos').delete().eq('id', id);
        } catch (e: any) {
          console.warn('⚠️ Supabase ncm_regras_anexos delete warning:', e?.message || e);
        }
      }
    }

    res.json({ success: true, message: 'Regra de NCM excluída com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao excluir regra NCM: ' + err.message });
  }
});

// =========================================================
// 5. MAPA CFOP x TRATAMENTO
// =========================================================

/** GET /api/tables/cfop — Listar todos os CFOPs */
router.get('/cfop', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const empresaId = req.user!.empresaAtivaId;
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
    const db = getDatabase();
    db.prepare("UPDATE cfop_tratamento SET ativo = 0, updated_at = datetime('now') WHERE id = ?").run(id);
    res.json({ success: true, message: 'CFOP desativado com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao desativar CFOP: ' + err.message });
  }
});

// =========================================================
// 6. MAPA cClassTrib (6 Dígitos)
// =========================================================

/** GET /api/tables/cclasstrib */
router.get('/cclasstrib', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
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

/** POST /api/tables/cclasstrib */
router.post('/cclasstrib', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cclasstrib, descricao_interna, tratamento_esperado, permite_credito, aliquota_esperada, alertas } = req.body;
    if (!cclasstrib || !descricao_interna) {
      res.status(400).json({ error: 'cclasstrib e descricao_interna são obrigatórios.' });
      return;
    }

    const db = getDatabase();
    const id = uuid();
    db.prepare(`
      INSERT OR REPLACE INTO cclasstrib_regras (id, cclasstrib, descricao_interna, tratamento_esperado, permite_credito, aliquota_esperada, alertas, ativo, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `).run(id, cclasstrib, descricao_interna, tratamento_esperado || 'tributado', permite_credito || 'Sim', aliquota_esperada || '27.91%', alertas || '');

    res.status(201).json({ success: true, message: 'cClassTrib cadastrado com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao salvar cClassTrib: ' + err.message });
  }
});

/** DELETE /api/tables/cclasstrib/:id */
router.delete('/cclasstrib/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    db.prepare("UPDATE cclasstrib_regras SET ativo = 0, updated_at = datetime('now') WHERE id = ?").run(id);
    res.json({ success: true, message: 'cClassTrib desativado com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao excluir cClassTrib: ' + err.message });
  }
});

// =========================================================
// 7. REGRAS DE ELEGIBILIDADE
// =========================================================

/** GET /api/tables/regras */
router.get('/regras', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
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

/** POST /api/tables/regras */
router.post('/regras', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { codigo_regra, nome, descricao, tipo_aquisicao, cfops_aplicaveis, resultado_padrao, evidencia_minima, base_legal } = req.body;
    if (!codigo_regra || !nome) {
      res.status(400).json({ error: 'codigo_regra e nome são obrigatórios.' });
      return;
    }

    const db = getDatabase();
    const id = uuid();
    db.prepare(`
      INSERT OR REPLACE INTO regras_elegibilidade (id, codigo_regra, nome, descricao, tipo_aquisicao, cfops_aplicaveis, resultado_padrao, evidencia_minima, base_legal, ativo, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `).run(id, codigo_regra, nome, descricao || '', tipo_aquisicao || 'Geral', cfops_aplicaveis || '', resultado_padrao || 'Elegível', evidencia_minima || '', base_legal || '');

    res.status(201).json({ success: true, message: 'Regra cadastrada com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao salvar regra: ' + err.message });
  }
});

/** DELETE /api/tables/regras/:id */
router.delete('/regras/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    db.prepare("UPDATE regras_elegibilidade SET ativo = 0, updated_at = datetime('now') WHERE id = ?").run(id);
    res.json({ success: true, message: 'Regra desativada com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao excluir regra: ' + err.message });
  }
});

// =========================================================
// 8. PARÂMETROS DE INFERÊNCIA (ALÍQUOTAS MÉDIAS P/ SIMULADOR)
// =========================================================

/** GET /api/tables/inferencia — Listar parâmetros de inferência */
router.get('/inferencia', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM parametros_inferencia 
      ORDER BY codigo
    `).all();

    res.json({ success: true, data: rows, total: rows.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao listar parâmetros de inferência: ' + err.message });
  }
});

/** POST /api/tables/inferencia — Gravar ou atualizar parâmetro de inferência */
router.post('/inferencia', requireAuth, requirePerfil('admin_master', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      codigo, descricao,
      icms_medio, pis_medio, cofins_medio, ipi_medio, iss_medio,
      aplica_simples_nac, aplica_cte, aplica_nfse,
      inicio_vigencia, final_vigencia
    } = req.body;

    if (!codigo || !descricao) {
      res.status(400).json({ error: 'codigo e descricao são obrigatórios.' });
      return;
    }

    const db = getDatabase();
    const id = uuid();

    db.prepare(`
      INSERT INTO parametros_inferencia (
        id, codigo, descricao,
        icms_medio, pis_medio, cofins_medio, ipi_medio, iss_medio,
        aplica_simples_nac, aplica_cte, aplica_nfse,
        inicio_vigencia, final_vigencia, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(codigo) DO UPDATE SET
        descricao = excluded.descricao,
        icms_medio = excluded.icms_medio,
        pis_medio = excluded.pis_medio,
        cofins_medio = excluded.cofins_medio,
        ipi_medio = excluded.ipi_medio,
        iss_medio = excluded.iss_medio,
        aplica_simples_nac = excluded.aplica_simples_nac,
        aplica_cte = excluded.aplica_cte,
        aplica_nfse = excluded.aplica_nfse,
        inicio_vigencia = excluded.inicio_vigencia,
        final_vigencia = excluded.final_vigencia,
        updated_at = datetime('now')
    `).run(
      id, codigo, descricao,
      Number(icms_medio) || 0, Number(pis_medio) || 0, Number(cofins_medio) || 0, Number(ipi_medio) || 0, Number(iss_medio) || 0,
      aplica_simples_nac ? 1 : 0, aplica_cte ? 1 : 0, aplica_nfse ? 1 : 0,
      inicio_vigencia || '2026-01-01', final_vigencia || '2099-12-31'
    );

    res.status(201).json({ success: true, message: 'Parâmetro de inferência salvo com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao salvar parâmetro de inferência: ' + err.message });
  }
});

/** DELETE /api/tables/inferencia/:id — Excluir parâmetro de inferência */
router.delete('/inferencia/:id', requireAuth, requirePerfil('admin_master', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    db.prepare('DELETE FROM parametros_inferencia WHERE id = ?').run(id);
    res.json({ success: true, message: 'Parâmetro de inferência excluído com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao excluir parâmetro de inferência: ' + err.message });
  }
});

export default router;


