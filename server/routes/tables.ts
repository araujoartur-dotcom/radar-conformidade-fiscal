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
import multer from 'multer';
import * as XLSX from 'xlsx';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

/** Helper universal para envio de exportação em JSON, CSV ou XLSX */
function sendExportFile(res: Response, filename: string, format: string, data: any[]) {
  if (format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(JSON.stringify(data, null, 2));
  }
  if (format === 'csv') {
    const ws = XLSX.utils.json_to_sheet(data);
    const csvContent = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.send('\uFEFF' + csvContent);
  }
  // Formato padrão: XLSX
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return res.send(buffer);
}

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

/** GET /api/tables/aliquotas/ad-valorem/export — Exportar Ad Valorem (JSON ou XLSX) */
router.get('/aliquotas/ad-valorem/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT 
        codigo_cadastro as "Código",
        cbs_federal as "CBS Federal (%)",
        ibs_estadual as "IBS Estadual (%)",
        ibs_municipal as "IBS Municipal (%)",
        is_federal as "IS Federal (%)",
        unidade_medida as "Unidade",
        inicio_vigencia as "Início Vigência",
        final_vigencia as "Fim Vigência",
        descricao as "Descrição"
      FROM aliquotas_tabelas 
      WHERE modalidade = 'ad_valorem' 
      ORDER BY inicio_vigencia ASC, codigo_cadastro ASC
    `).all();
    sendExportFile(res, 'Aliquotas_Ad_Valorem', format, rows);
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao exportar Ad Valorem: ' + err.message });
  }
});

/** POST /api/tables/aliquotas/ad-valorem/upload — Upload em massa Ad Valorem (JSON ou XLSX) */
router.post('/aliquotas/ad-valorem/upload', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itens } = req.body as { itens: any[] };
    if (!Array.isArray(itens) || itens.length === 0) {
      res.status(400).json({ success: false, message: 'Nenhum item recebido.' });
      return;
    }
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO aliquotas_tabelas (
        id, codigo_cadastro, modalidade, cbs_federal, ibs_estadual, ibs_municipal, is_federal, unidade_medida, inicio_vigencia, final_vigencia, descricao, updated_at
      ) VALUES (?, ?, 'ad_valorem', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    let inseridos = 0;
    const tx = db.transaction((rows: any[]) => {
      for (const it of rows) {
        const rowId = it.id || uuid();
        stmt.run(
          rowId,
          String(it.codigo_cadastro || it['Código'] || `AV_${inseridos + 1}`),
          Number(it.cbs_federal || it['CBS Federal (%)'] || it['CBS'] || 0),
          Number(it.ibs_estadual || it['IBS Estadual (%)'] || it['IBS Estadual'] || 0),
          Number(it.ibs_municipal || it['IBS Municipal (%)'] || it['IBS Municipal'] || 0),
          Number(it.is_federal || it['IS Federal (%)'] || it['IS'] || 0),
          String(it.unidade_medida || it['Unidade'] || '%'),
          String(it.inicio_vigencia || it['Início Vigência'] || '2026-01-01'),
          String(it.final_vigencia || it['Fim Vigência'] || '2033-12-31'),
          String(it.descricao || it['Descrição'] || '')
        );
        inseridos++;
      }
    });
    tx(itens);
    res.json({ success: true, message: `${inseridos} alíquotas Ad Valorem importadas com sucesso!` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao importar Ad Valorem: ' + err.message });
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

/** GET /api/tables/aliquotas/ad-rem/export — Exportar Ad Rem (JSON ou XLSX) */
router.get('/aliquotas/ad-rem/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT 
        codigo_cadastro as "Código",
        cbs_federal as "CBS Federal (R$)",
        ibs_estadual as "IBS Estadual (R$)",
        ibs_municipal as "IBS Municipal (R$)",
        is_federal as "IS Federal (R$)",
        unidade_medida as "Unidade",
        inicio_vigencia as "Início Vigência",
        final_vigencia as "Fim Vigência",
        descricao as "Descrição"
      FROM aliquotas_tabelas 
      WHERE modalidade = 'ad_rem' 
      ORDER BY inicio_vigencia ASC, codigo_cadastro ASC
    `).all();
    sendExportFile(res, 'Aliquotas_Ad_Rem', format, rows);
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao exportar Ad Rem: ' + err.message });
  }
});

/** POST /api/tables/aliquotas/ad-rem/upload — Upload em massa Ad Rem (JSON ou XLSX) */
router.post('/aliquotas/ad-rem/upload', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itens } = req.body as { itens: any[] };
    if (!Array.isArray(itens) || itens.length === 0) {
      res.status(400).json({ success: false, message: 'Nenhum item recebido.' });
      return;
    }
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO aliquotas_tabelas (
        id, codigo_cadastro, modalidade, cbs_federal, ibs_estadual, ibs_municipal, is_federal, unidade_medida, inicio_vigencia, final_vigencia, descricao, updated_at
      ) VALUES (?, ?, 'ad_rem', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    let inseridos = 0;
    const tx = db.transaction((rows: any[]) => {
      for (const it of rows) {
        const rowId = it.id || uuid();
        stmt.run(
          rowId,
          String(it.codigo_cadastro || it['Código'] || `AR_${inseridos + 1}`),
          Number(it.cbs_federal || it['CBS Federal (R$)'] || it['CBS'] || 0),
          Number(it.ibs_estadual || it['IBS Estadual (R$)'] || it['IBS Estadual'] || 0),
          Number(it.ibs_municipal || it['IBS Municipal (R$)'] || it['IBS Municipal'] || 0),
          Number(it.is_federal || it['IS Federal (R$)'] || it['IS'] || 0),
          String(it.unidade_medida || it['Unidade'] || 'kg'),
          String(it.inicio_vigencia || it['Início Vigência'] || '2026-01-01'),
          String(it.final_vigencia || it['Fim Vigência'] || '2033-12-31'),
          String(it.descricao || it['Descrição'] || '')
        );
        inseridos++;
      }
    });
    tx(itens);
    res.json({ success: true, message: `${inseridos} alíquotas Ad Rem importadas com sucesso!` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao importar Ad Rem: ' + err.message });
  }
});

// =========================================================
// 4. CATÁLOGO DE ANEXOS DA LEI & NCMs (Reduções e Isenções)
// =========================================================

/** GET /api/tables/anexos-ncm — Listar regras de NCM / Anexos */
router.get('/anexos-ncm', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q, busca, tipo_tratamento, tributo, anexo, is_combustivel, limit, offset } = req.query as any;

    const db = getDatabase();
    let sql = 'SELECT * FROM ncm_regras_anexos WHERE ativo = 1';
    const params: any[] = [];

    const searchTerm = (busca || q || '').trim();
    if (searchTerm) {
      sql += ' AND (ncm LIKE ? OR descricao LIKE ? OR cclasstrib LIKE ? OR codigo_normalizado LIKE ? OR titulo_anexo LIKE ? OR descritivo LIKE ? OR anexo LIKE ? OR tratamento LIKE ? OR codigo LIKE ?)';
      const term = `%${searchTerm}%`;
      params.push(term, term, term, term, term, term, term, term, term);
    }
    if (tipo_tratamento && tipo_tratamento !== 'todos') {
      if (tipo_tratamento === 'imposto_seletivo') {
        sql += ' AND (tipo_tratamento = "imposto_seletivo" OR tributo = "IS")';
      } else {
        sql += ' AND tipo_tratamento = ?';
        params.push(tipo_tratamento);
      }
    }
    if (tributo && tributo !== 'todos') {
      sql += ' AND tributo = ?';
      params.push(tributo);
    }
    if (anexo && anexo !== 'todos') {
      sql += ' AND anexo = ?';
      params.push(anexo);
    }
    if (is_combustivel !== undefined && is_combustivel !== '' && is_combustivel !== 'todos') {
      sql += ' AND is_combustivel = ?';
      params.push(Number(is_combustivel));
    }

    sql += ' ORDER BY CASE WHEN tributo = "IS" THEN 0 ELSE 1 END, is_combustivel DESC, anexo ASC, codigo ASC';
    if (limit) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(Number(limit), Number(offset || 0));
    }

    const rows = db.prepare(sql).all(...params);
    const totalCount = (db.prepare('SELECT count(*) as total FROM ncm_regras_anexos WHERE ativo = 1').get() as any)?.total || rows.length;

    res.json({ success: true, data: rows, total: totalCount });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao listar anexos NCM: ' + err.message });
  }
});

/** GET /api/tables/anexos-ncm/export — Exportar NCMs com as 17 colunas oficiais LC 214/2025 */
router.get('/anexos-ncm/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT 
        id_codigo as "ID_Codigo",
        id_item_anexo as "ID",
        anexo as "Anexo",
        titulo_anexo as "Titulo_Anexo",
        item_anexo as "Item_Anexo",
        descritivo as "Descritivo",
        tratamento as "Tratamento",
        percentual_reducao as "Perc_Reducao",
        perc_aliquota_aplicavel as "Perc_Aliquota_Aplicavel",
        tributo as "Tributo",
        tipo_classificacao as "Tipo_Classificacao",
        codigo as "Codigo",
        codigo_normalizado as "Codigo_Normalizado",
        nivel_codigo as "Nivel_Codigo",
        base_legal as "Base_Legal",
        linha_agrupadora as "Linha_Agrupadora",
        condicionantes_observacoes as "Condicionantes_Observacoes"
      FROM ncm_regras_anexos 
      WHERE ativo = 1 
      ORDER BY CASE WHEN tributo = 'IS' THEN 0 ELSE 1 END, is_combustivel DESC, anexo ASC, codigo ASC
    `).all();
    sendExportFile(res, 'LC214_2025_Itens_x_Codigo_v2', format, rows);
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao exportar NCMs: ' + err.message });
  }
});

/** POST /api/tables/anexos-ncm — Criar/Atualizar regra NCM */
router.post('/anexos-ncm', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      id, id_codigo, id_item_anexo, anexo, titulo_anexo, item_anexo, descritivo,
      tratamento, percentual_reducao, perc_aliquota_aplicavel, tributo,
      tipo_classificacao, codigo, codigo_normalizado, nivel_codigo, base_legal,
      linha_agrupadora, condicionantes_observacoes, ncm, nbs, cclasstrib, descricao,
      tipo_tratamento, anexo_lei, permite_credito, is_combustivel,
      cclasstrib_sugerido, cst_sugerido, vigencia_inicio, vigencia_fim
    } = req.body;

    const codRaw = String(codigo || ncm || codigo_normalizado || '').trim();
    if (!codRaw) {
      res.status(400).json({ success: false, message: 'Código/NCM é obrigatório.' });
      return;
    }

    const codNorm = String(codigo_normalizado || codRaw.replace(/\D/g, '')).trim();
    const rowId = id || (id_codigo ? `ncm-lc214-${id_codigo}` : `ncm-${uuid()}`);

    const tributoRaw = String(tributo || 'IBS e CBS').trim();
    const anexoRaw = String(anexo || anexo_lei || '').trim();
    const tratRaw = String(tratamento || '').trim();
    const titRaw = String(titulo_anexo || anexo_lei || '').trim();
    const descRaw = String(descritivo || descricao || 'Item Fiscal').trim();

    const isImpostoSeletivo = tributoRaw.toUpperCase() === 'IS' ||
                              anexoRaw.toUpperCase() === 'XVII' ||
                              tratRaw.toLowerCase().includes('seletivo') ||
                              titRaw.toLowerCase().includes('seletivo') ||
                              tipo_tratamento === 'imposto_seletivo';

    const isComb = Number(is_combustivel ?? (codNorm.startsWith('2710') || codNorm.startsWith('2711') ? 1 : 0));

    let percRed = 0.0;
    let percAliq: number | null = null;
    let finalTipoTratamento = tipo_tratamento || 'padrao';
    let cstSugerido = cst_sugerido || '000';
    let cclassSugerido = cclasstrib_sugerido || cclasstrib || '';
    let permiteCred = permite_credito || 'Sim';

    if (isImpostoSeletivo) {
      finalTipoTratamento = 'imposto_seletivo';
      percRed = 0.0;
      percAliq = null;
      cstSugerido = '000';
      cclassSugerido = '';
      permiteCred = 'Não';
    } else if (isComb) {
      finalTipoTratamento = 'ad_rem';
      percRed = 0.0;
      percAliq = null;
      cstSugerido = '620';
      cclassSugerido = '620006';
      permiteCred = 'Não';
    } else {
      const rawRed = percentual_reducao;
      if (rawRed !== undefined && rawRed !== null && rawRed !== '') {
        percRed = Number(rawRed);
      } else if (perc_aliquota_aplicavel !== undefined && perc_aliquota_aplicavel !== null) {
        percRed = 100 - Number(perc_aliquota_aplicavel);
      } else if (tratRaw.toLowerCase().includes('zero')) {
        percRed = 100.0;
      } else if (tratRaw.toLowerCase().includes('60')) {
        percRed = 60.0;
      } else if (tratRaw.toLowerCase().includes('30')) {
        percRed = 30.0;
      }

      if (perc_aliquota_aplicavel !== undefined && perc_aliquota_aplicavel !== null) {
        percAliq = Number(perc_aliquota_aplicavel);
      } else {
        percAliq = percRed > 0 ? (100 - percRed) : 100.0;
      }

      if (percRed === 100.0 || tratRaw.toLowerCase().includes('zero')) {
        finalTipoTratamento = 'cesta_basica_zero';
        cstSugerido = '000';
        cclassSugerido = '000001';
      } else if (percRed === 60.0 || tratRaw.toLowerCase().includes('60')) {
        finalTipoTratamento = 'reducao_60';
        cstSugerido = '200';
      } else if (percRed === 30.0 || tratRaw.toLowerCase().includes('30')) {
        finalTipoTratamento = 'reducao_30';
        cstSugerido = '200';
      }
    }

    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO ncm_regras_anexos (
        id, id_codigo, id_item_anexo, anexo, titulo_anexo, item_anexo, descritivo,
        tratamento, percentual_reducao, perc_aliquota_aplicavel, tributo, tipo_classificacao,
        codigo, codigo_normalizado, nivel_codigo, base_legal, linha_agrupadora,
        condicionantes_observacoes, ncm, nbs, cclasstrib, descricao, tipo_tratamento,
        anexo_lei, permite_credito, is_combustivel, cclasstrib_sugerido, cst_sugerido,
        vigencia_inicio, vigencia_fim, ativo, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, 1, datetime('now')
      )
    `).run(
      rowId,
      id_codigo ? Number(id_codigo) : null,
      id_item_anexo ? Number(id_item_anexo) : null,
      anexoRaw,
      titRaw,
      item_anexo || '',
      descRaw,
      tratRaw || (isImpostoSeletivo ? 'Imposto Seletivo' : finalTipoTratamento),
      percRed,
      percAliq,
      isImpostoSeletivo ? 'IS' : tributoRaw,
      tipo_classificacao || 'NCM/SH',
      codRaw,
      codNorm,
      nivel_codigo || (codRaw.length >= 8 ? '8 digitos' : '4 digitos'),
      base_legal || 'LC 214/2025',
      linha_agrupadora || 'Nao',
      condicionantes_observacoes || '',
      codRaw,
      nbs || '',
      cclassSugerido,
      descRaw,
      finalTipoTratamento,
      titRaw || anexoRaw,
      permiteCred,
      isComb,
      cclassSugerido,
      cstSugerido,
      vigencia_inicio || '2026-01-01',
      vigencia_fim || '2033-12-31'
    );

    res.json({ success: true, message: 'Regra de NCM gravada com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao gravar regra NCM: ' + err.message });
  }
});

/** POST /api/tables/anexos-ncm/upload — Upload em massa de NCMs (17 colunas oficiais LC 214/2025) */
router.post('/anexos-ncm/upload', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itens } = req.body as { itens: any[] };
    if (!Array.isArray(itens) || itens.length === 0) {
      res.status(400).json({ success: false, message: 'Nenhum item válido enviado para importação.' });
      return;
    }

    const db = getDatabase();
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO ncm_regras_anexos (
        id, id_codigo, id_item_anexo, anexo, titulo_anexo, item_anexo, descritivo,
        tratamento, percentual_reducao, perc_aliquota_aplicavel, tributo, tipo_classificacao,
        codigo, codigo_normalizado, nivel_codigo, base_legal, linha_agrupadora,
        condicionantes_observacoes, ncm, nbs, cclasstrib, descricao, tipo_tratamento,
        anexo_lei, permite_credito, is_combustivel, cclasstrib_sugerido, cst_sugerido,
        vigencia_inicio, vigencia_fim, ativo, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        '2026-01-01', '2033-12-31', 1, datetime('now')
      )
    `);

    let inseridos = 0;
    const tx = db.transaction((rows: any[]) => {
      for (const it of rows) {
        const idCodigo = it.id_codigo ?? it['ID_Codigo'] ?? null;
        const idItemAnexo = it.id_item_anexo ?? it['ID'] ?? it.id ?? null;
        const anexo = String(it.anexo || it['Anexo'] || '').trim();
        const tituloAnexo = String(it.titulo_anexo || it['Titulo_Anexo'] || it.anexo_lei || '').trim();
        const itemAnexo = String(it.item_anexo || it['Item_Anexo'] || '').trim();
        const descritivo = String(it.descritivo || it['Descritivo'] || it.descricao || it['Descricao'] || it['Descrição'] || 'Item Fiscal').trim();
        const tratamento = String(it.tratamento || it['Tratamento'] || '').trim();
        const tributoRaw = String(it.tributo || it['Tributo'] || 'IBS e CBS').trim();
        const tipoClass = String(it.tipo_classificacao || it['Tipo_Classificacao'] || 'NCM/SH').trim();
        const codigoRaw = String(it.codigo || it['Codigo'] || it['Código'] || it.ncm || it['NCM'] || '').trim();
        if (!codigoRaw) continue;

        const codNorm = String(it.codigo_normalizado || it['Codigo_Normalizado'] || codigoRaw.replace(/\D/g, '')).trim();
        const nivelCodigo = String(it.nivel_codigo || it['Nivel_Codigo'] || (codigoRaw.length >= 8 ? '8 digitos' : '4 digitos')).trim();
        const baseLegal = String(it.base_legal || it['Base_Legal'] || it['Base Legal'] || 'LC 214/2025').trim();
        const linhaAgrupadora = String(it.linha_agrupadora || it['Linha_Agrupadora'] || 'Nao').trim();
        const condicionantes = String(it.condicionantes_observacoes || it['Condicionantes_Observacoes'] || '').trim();

        // Checagem rigorosa de Imposto Seletivo (zero fallback, sem misturar com Cesta Básica)
        const isImpostoSeletivo = tributoRaw.toUpperCase() === 'IS' || 
                                  anexo.toUpperCase() === 'XVII' || 
                                  tratamento.toLowerCase().includes('seletivo') ||
                                  tituloAnexo.toLowerCase().includes('seletivo') ||
                                  it.tipo_tratamento === 'imposto_seletivo';

        const isComb = Number(it.is_combustivel ?? (codNorm.startsWith('2710') || codNorm.startsWith('2711') ? 1 : 0));

        let percRed = 0.0;
        let percAliq: number | null = null;
        let tipoTratamento: string = 'padrao';
        let cstSugerido = '000';
        let cclassSugerido = '';
        let permiteCredito = 'Sim';

        if (isImpostoSeletivo) {
          tipoTratamento = 'imposto_seletivo';
          percRed = 0.0; // IS tem incidência seletiva extra, NUNCA redução de 100%!
          percAliq = null;
          cstSugerido = '000';
          cclassSugerido = '';
          permiteCredito = 'Não';
        } else if (isComb) {
          tipoTratamento = 'ad_rem';
          percRed = 0.0;
          percAliq = null;
          cstSugerido = '620';
          cclassSugerido = '620006';
          permiteCredito = 'Não';
        } else {
          // IBS e CBS normais ou com redução
          const rawRed = it.percentual_reducao ?? it['Perc_Reducao'] ?? it['Redução (%)'];
          const rawAliq = it.perc_aliquota_aplicavel ?? it['Perc_Aliquota_Aplicavel'] ?? it['Alíquota Aplicável (%)'];
          
          if (rawRed !== undefined && rawRed !== null && rawRed !== '') {
            percRed = Number(rawRed);
          } else if (rawAliq !== undefined && rawAliq !== null && rawAliq !== '') {
            percRed = 100 - Number(rawAliq);
          } else if (tratamento.toLowerCase().includes('zero')) {
            percRed = 100.0;
          } else if (tratamento.toLowerCase().includes('60')) {
            percRed = 60.0;
          } else if (tratamento.toLowerCase().includes('30')) {
            percRed = 30.0;
          }

          if (rawAliq !== undefined && rawAliq !== null && rawAliq !== '') {
            percAliq = Number(rawAliq);
          } else {
            percAliq = percRed > 0 ? (100 - percRed) : 100.0;
          }

          if (percRed === 100.0 || tratamento.toLowerCase().includes('zero')) {
            tipoTratamento = 'cesta_basica_zero';
            cstSugerido = '000';
            cclassSugerido = '000001';
          } else if (percRed === 60.0 || tratamento.toLowerCase().includes('60')) {
            tipoTratamento = 'reducao_60';
            cstSugerido = '200';
          } else if (percRed === 30.0 || tratamento.toLowerCase().includes('30')) {
            tipoTratamento = 'reducao_30';
            cstSugerido = '200';
          }
        }

        const tributoFinal = isImpostoSeletivo ? 'IS' : tributoRaw;
        const rowId = idCodigo ? `ncm-lc214-${idCodigo}` : (it.id || `ncm-${uuid()}`);

        insertStmt.run(
          rowId,
          idCodigo ? Number(idCodigo) : null,
          idItemAnexo ? Number(idItemAnexo) : null,
          anexo,
          tituloAnexo,
          itemAnexo,
          descritivo,
          tratamento || (isImpostoSeletivo ? 'Imposto Seletivo' : tipoTratamento),
          percRed,
          percAliq,
          tributoFinal,
          tipoClass,
          codigoRaw,
          codNorm,
          nivelCodigo,
          baseLegal,
          linhaAgrupadora,
          condicionantes,
          codigoRaw, // ncm
          it.nbs || '',
          cclassSugerido,
          descritivo,
          tipoTratamento,
          tituloAnexo || anexo,
          permiteCredito,
          isComb,
          cclassSugerido,
          cstSugerido
        );
        inseridos++;
      }
    });

    tx(itens);
    res.json({ success: true, message: `${inseridos} regras de NCM importadas com sucesso.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro no upload de NCMs: ' + err.message });
  }
});

/** POST /api/tables/anexos-ncm/upload-lote — Compatibilidade (redireciona para o parser das 17 colunas) */
router.post('/anexos-ncm/upload-lote', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  // Reutiliza o endpoint oficial de upload das 17 colunas
  const { itens } = req.body as { itens: any[] };
  if (!Array.isArray(itens) || itens.length === 0) {
    res.status(400).json({ success: false, message: 'Nenhum item válido enviado para importação.' });
    return;
  }
  const db = getDatabase();
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO ncm_regras_anexos (
      id, id_codigo, id_item_anexo, anexo, titulo_anexo, item_anexo, descritivo,
      tratamento, percentual_reducao, perc_aliquota_aplicavel, tributo, tipo_classificacao,
      codigo, codigo_normalizado, nivel_codigo, base_legal, linha_agrupadora,
      condicionantes_observacoes, ncm, nbs, cclasstrib, descricao, tipo_tratamento,
      anexo_lei, permite_credito, is_combustivel, cclasstrib_sugerido, cst_sugerido,
      vigencia_inicio, vigencia_fim, ativo, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      '2026-01-01', '2033-12-31', 1, datetime('now')
    )
  `);

  let inseridos = 0;
  const tx = db.transaction((rows: any[]) => {
    for (const it of rows) {
      const codigoRaw = String(it.codigo || it['Codigo'] || it['Código'] || it.ncm || it['NCM'] || '').trim();
      if (!codigoRaw) continue;
      const idCodigo = it.id_codigo ?? it['ID_Codigo'] ?? null;
      const idItemAnexo = it.id_item_anexo ?? it['ID'] ?? it.id ?? null;
      const anexo = String(it.anexo || it['Anexo'] || it.anexo_lei || '').trim();
      const tituloAnexo = String(it.titulo_anexo || it['Titulo_Anexo'] || it.anexo_lei || '').trim();
      const itemAnexo = String(it.item_anexo || it['Item_Anexo'] || '').trim();
      const descritivo = String(it.descritivo || it['Descritivo'] || it.descricao || it['Descricao'] || it['Descrição'] || 'Item Fiscal').trim();
      const tratamento = String(it.tratamento || it['Tratamento'] || '').trim();
      const tributoRaw = String(it.tributo || it['Tributo'] || 'IBS e CBS').trim();
      const tipoClass = String(it.tipo_classificacao || it['Tipo_Classificacao'] || 'NCM/SH').trim();
      const codNorm = String(it.codigo_normalizado || it['Codigo_Normalizado'] || codigoRaw.replace(/\D/g, '')).trim();
      const nivelCodigo = String(it.nivel_codigo || it['Nivel_Codigo'] || (codigoRaw.length >= 8 ? '8 digitos' : '4 digitos')).trim();
      const baseLegal = String(it.base_legal || it['Base_Legal'] || it['Base Legal'] || 'LC 214/2025').trim();
      const linhaAgrupadora = String(it.linha_agrupadora || it['Linha_Agrupadora'] || 'Nao').trim();
      const condicionantes = String(it.condicionantes_observacoes || it['Condicionantes_Observacoes'] || '').trim();

      const isImpostoSeletivo = tributoRaw.toUpperCase() === 'IS' || 
                                anexo.toUpperCase() === 'XVII' || 
                                tratamento.toLowerCase().includes('seletivo') ||
                                tituloAnexo.toLowerCase().includes('seletivo') ||
                                it.tipo_tratamento === 'imposto_seletivo';

      const isComb = Number(it.is_combustivel ?? (codNorm.startsWith('2710') || codNorm.startsWith('2711') ? 1 : 0));

      let percRed = 0.0;
      let percAliq: number | null = null;
      let tipoTratamento: string = 'padrao';
      let cstSugerido = '000';
      let cclassSugerido = '';
      let permiteCredito = 'Sim';

      if (isImpostoSeletivo) {
        tipoTratamento = 'imposto_seletivo';
        percRed = 0.0;
        percAliq = null;
        cstSugerido = '000';
        cclassSugerido = '';
        permiteCredito = 'Não';
      } else if (isComb) {
        tipoTratamento = 'ad_rem';
        percRed = 0.0;
        percAliq = null;
        cstSugerido = '620';
        cclassSugerido = '620006';
        permiteCredito = 'Não';
      } else {
        const rawRed = it.percentual_reducao ?? it['Perc_Reducao'] ?? it['Redução (%)'];
        const rawAliq = it.perc_aliquota_aplicavel ?? it['Perc_Aliquota_Aplicavel'] ?? it['Alíquota Aplicável (%)'];
        if (rawRed !== undefined && rawRed !== null && rawRed !== '') {
          percRed = Number(rawRed);
        } else if (rawAliq !== undefined && rawAliq !== null && rawAliq !== '') {
          percRed = 100 - Number(rawAliq);
        } else if (tratamento.toLowerCase().includes('zero')) {
          percRed = 100.0;
        } else if (tratamento.toLowerCase().includes('60')) {
          percRed = 60.0;
        } else if (tratamento.toLowerCase().includes('30')) {
          percRed = 30.0;
        }

        if (rawAliq !== undefined && rawAliq !== null && rawAliq !== '') {
          percAliq = Number(rawAliq);
        } else {
          percAliq = percRed > 0 ? (100 - percRed) : 100.0;
        }

        if (percRed === 100.0 || tratamento.toLowerCase().includes('zero')) {
          tipoTratamento = 'cesta_basica_zero';
          cstSugerido = '000';
          cclassSugerido = '000001';
        } else if (percRed === 60.0 || tratamento.toLowerCase().includes('60')) {
          tipoTratamento = 'reducao_60';
          cstSugerido = '200';
        } else if (percRed === 30.0 || tratamento.toLowerCase().includes('30')) {
          tipoTratamento = 'reducao_30';
          cstSugerido = '200';
        }
      }

      const tributoFinal = isImpostoSeletivo ? 'IS' : tributoRaw;
      const rowId = idCodigo ? `ncm-lc214-${idCodigo}` : (it.id || `ncm-${uuid()}`);

      insertStmt.run(
        rowId,
        idCodigo ? Number(idCodigo) : null,
        idItemAnexo ? Number(idItemAnexo) : null,
        anexo,
        tituloAnexo,
        itemAnexo,
        descritivo,
        tratamento || (isImpostoSeletivo ? 'Imposto Seletivo' : tipoTratamento),
        percRed,
        percAliq,
        tributoFinal,
        tipoClass,
        codigoRaw,
        codNorm,
        nivelCodigo,
        baseLegal,
        linhaAgrupadora,
        condicionantes,
        codigoRaw,
        it.nbs || '',
        cclassSugerido,
        descritivo,
        tipoTratamento,
        tituloAnexo || anexo,
        permiteCredito,
        isComb,
        cclassSugerido,
        cstSugerido
      );
      inseridos++;
    }
  });

  tx(itens);
  res.json({ success: true, message: `${inseridos} regras de NCM importadas com sucesso.` });
});

/** DELETE /api/tables/anexos-ncm/:id */
router.delete('/anexos-ncm/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    db.prepare('DELETE FROM ncm_regras_anexos WHERE id = ?').run(id);
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

/** GET /api/tables/cfop/export — Exportar CFOPs (JSON ou XLSX) */
router.get('/cfop/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const empresaId = req.user!.empresaAtivaId;
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT 
        cfop as "CFOP",
        descricao as "Descrição",
        categoria as "Categoria",
        tratamento_padrao as "Tratamento Padrão",
        CASE WHEN exige_onerosidade = 1 THEN 'Sim' ELSE 'Não' END as "Exige Onerosidade",
        evidencia_minima as "Evidência Mínima"
      FROM cfop_tratamento 
      WHERE (empresa_id IS NULL OR empresa_id = ?) AND ativo = 1
      ORDER BY cfop ASC
    `).all(empresaId);
    sendExportFile(res, 'Matriz_CFOP', format, rows);
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao exportar CFOP: ' + err.message });
  }
});

/** POST /api/tables/cfop/upload — Upload em massa CFOP (JSON ou XLSX) */
router.post('/cfop/upload', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itens } = req.body as { itens: any[] };
    if (!Array.isArray(itens) || itens.length === 0) {
      res.status(400).json({ success: false, message: 'Nenhum item recebido.' });
      return;
    }
    const empresaId = req.user!.empresaAtivaId;
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO cfop_tratamento (
        id, empresa_id, cfop, descricao, categoria, tratamento_padrao, exige_onerosidade, exige_validacao_cclasstrib, evidencia_minima, ativo, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 1, datetime('now'))
    `);
    let inseridos = 0;
    const tx = db.transaction((rows: any[]) => {
      for (const it of rows) {
        const cod = String(it.cfop || it['CFOP'] || '').trim();
        if (!cod) continue;
        const rowId = it.id || uuid();
        stmt.run(
          rowId,
          empresaId,
          cod,
          String(it.descricao || it['Descrição'] || 'Operação').trim(),
          String(it.categoria || it['Categoria'] || 'Compra'),
          String(it.tratamento_padrao || it['Tratamento Padrão'] || 'Elegível'),
          (it.exige_onerosidade === 0 || it['Exige Onerosidade'] === 'Não') ? 0 : 1,
          String(it.evidencia_minima || it['Evidência Mínima'] || '')
        );
        inseridos++;
      }
    });
    tx(itens);
    res.json({ success: true, message: `${inseridos} regras de CFOP importadas com sucesso!` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro no upload de CFOP: ' + err.message });
  }
});

// =========================================================
// 6. MAPA cClassTrib (6 Dígitos) — OFICIAL SVRS (164 Registros)
// =========================================================

/** GET /api/tables/cclasstrib — Listar códigos oficiais da SVRS */
router.get('/cclasstrib', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { busca, cst } = req.query as any;
    const db = getDatabase();
    let sql = 'SELECT * FROM cclasstrib_regras WHERE ativo = 1';
    const params: any[] = [];

    if (cst) {
      sql += ' AND cst = ?';
      params.push(cst);
    }
    if (busca) {
      sql += ' AND (cclasstrib LIKE ? OR descricao_interna LIKE ? OR descricao LIKE ? OR desc_cst LIKE ?)';
      const s = `%${busca}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY cclasstrib ASC';
    const rows = db.prepare(sql).all(...params);

    res.json({ success: true, data: rows, total: rows.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao listar cClassTrib: ' + err.message });
  }
});

/** GET /api/tables/cclasstrib/export — Exportar cClassTrib (JSON ou XLSX com cabeçalho oficial) */
router.get('/cclasstrib/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT 
        cst as "Código da Situação Tributária",
        desc_cst as "Descrição da Situação Tributária",
        exige_tributacao as "Exige Tributação",
        reducao_bc_cst as "Redução BC CST",
        reducao_aliquota as "Redução de Alíquota",
        transferencia_credito as "Transferência de Crédito",
        diferimento as "Diferimento",
        monofasica as "Monofásica",
        cclasstrib as "Código da Classificação Tributária",
        COALESCE(NULLIF(descricao, ''), descricao_interna) as "Descrição do Código da Classificação Tributária",
        perc_reducao_ibs as "Percentual Redução IBS",
        perc_reducao_cbs as "Percentual Redução CBS",
        tipo_aliquota as "Tipo de Alíquota",
        permite_credito as "Permite Crédito",
        tributacao_monofasica_normal as "Tributação Monofásica Normal",
        tributacao_monofasica_retencao as "Tributação Monofásica sujeita a retenção",
        tributacao_monofasica_retida_anteriormente as "Tributação Monofásica retida anteriormente",
        credito_presumido as "Crédito Presumido",
        estorno_credito as "Estorno de Crédito",
        numero_anexo as "Número do Anexo",
        url_legislacao as "Url da Legislação"
      FROM cclasstrib_regras 
      WHERE ativo = 1 AND cclasstrib != '900001'
      ORDER BY cclasstrib ASC
    `).all();
    sendExportFile(res, 'Tabela_Oficial_CST_cClassTrib_SVRS', format, rows);
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao exportar cClassTrib: ' + err.message });
  }
});

/** POST /api/tables/cclasstrib — Inserir ou Editar manualmente */
router.post('/cclasstrib', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      id, cclasstrib, descricao_interna, descricao, cst, desc_cst,
      tratamento_esperado, permite_credito, aliquota_esperada, alertas,
      exige_tributacao, reducao_bc_cst, reducao_aliquota, diferimento,
      monofasica, perc_reducao_ibs, perc_reducao_cbs, tipo_aliquota,
      url_legislacao, numero_anexo
    } = req.body;

    if (!cclasstrib) {
      res.status(400).json({ error: 'cclasstrib é obrigatório.' });
      return;
    }

    if (cclasstrib === '900001') {
      res.status(400).json({ error: 'O código 900001 é um fallback inexistente no RTC. Utilize os códigos oficiais da SVRS (620001 a 620007).' });
      return;
    }

    const db = getDatabase();
    const rowId = id || `cclass-${cclasstrib}`;
    const desc = descricao || descricao_interna || 'Classificação Tributária';
    const cstVal = cst || (cclasstrib.startsWith('620') ? '620' : '000');

    db.prepare(`
      INSERT INTO cclasstrib_regras (
        id, cclasstrib, descricao_interna, cst, desc_cst, descricao,
        exige_tributacao, reducao_bc_cst, reducao_aliquota, diferimento, monofasica,
        perc_reducao_ibs, perc_reducao_cbs, tipo_aliquota, permite_credito,
        aliquota_esperada, alertas, url_legislacao, numero_anexo, tratamento_esperado,
        ativo, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        1, datetime('now')
      )
      ON CONFLICT(id) DO UPDATE SET
        cclasstrib = excluded.cclasstrib,
        descricao_interna = excluded.descricao_interna,
        cst = excluded.cst,
        desc_cst = excluded.desc_cst,
        descricao = excluded.descricao,
        exige_tributacao = excluded.exige_tributacao,
        reducao_bc_cst = excluded.reducao_bc_cst,
        reducao_aliquota = excluded.reducao_aliquota,
        diferimento = excluded.diferimento,
        monofasica = excluded.monofasica,
        perc_reducao_ibs = excluded.perc_reducao_ibs,
        perc_reducao_cbs = excluded.perc_reducao_cbs,
        tipo_aliquota = excluded.tipo_aliquota,
        permite_credito = excluded.permite_credito,
        aliquota_esperada = excluded.aliquota_esperada,
        alertas = excluded.alertas,
        url_legislacao = excluded.url_legislacao,
        numero_anexo = excluded.numero_anexo,
        tratamento_esperado = excluded.tratamento_esperado,
        ativo = 1,
        updated_at = datetime('now')
    `).run(
      rowId, cclasstrib, desc, cstVal, desc_cst || '', desc,
      exige_tributacao || 'Sim', reducao_bc_cst || 'Não', reducao_aliquota || 'Não',
      diferimento || 'Não', monofasica || (cstVal === '620' ? 'Sim' : 'Não'),
      Number(perc_reducao_ibs || 0), Number(perc_reducao_cbs || 0), tipo_aliquota || '',
      permite_credito || (cstVal === '620' ? 'Não' : 'Sim'),
      aliquota_esperada || '', alertas || '', url_legislacao || '', numero_anexo || '',
      tratamento_esperado || (cstVal === '620' ? 'monofasico' : 'tributado')
    );

    res.status(201).json({ success: true, message: 'cClassTrib salvo com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao salvar cClassTrib: ' + err.message });
  }
});

/** POST /api/tables/cclasstrib/upload — Upload em massa por JSON ou XLSX */
router.post('/cclasstrib/upload', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itens } = req.body as { itens: any[] };
    if (!Array.isArray(itens) || itens.length === 0) {
      res.status(400).json({ success: false, message: 'Nenhum registro recebido para importação.' });
      return;
    }

    const db = getDatabase();
    // Expurga fallback fictício 900001
    db.prepare("DELETE FROM cclasstrib_regras WHERE cclasstrib = '900001'").run();

    const stmt = db.prepare(`
      INSERT INTO cclasstrib_regras (
        id, cclasstrib, descricao_interna, cst, desc_cst, descricao,
        exige_tributacao, reducao_bc_cst, reducao_aliquota, diferimento, monofasica,
        perc_reducao_ibs, perc_reducao_cbs, tipo_aliquota, permite_credito,
        url_legislacao, numero_anexo, tributacao_monofasica_normal,
        tributacao_monofasica_retencao, tributacao_monofasica_retida_anteriormente,
        tributacao_monofasica_diferimento, credito_presumido, estorno_credito,
        transferencia_credito, tratamento_esperado, dados_completos_json, ativo, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, 1, datetime('now')
      )
      ON CONFLICT(id) DO UPDATE SET
        cclasstrib = excluded.cclasstrib,
        descricao_interna = excluded.descricao_interna,
        cst = excluded.cst,
        desc_cst = excluded.desc_cst,
        descricao = excluded.descricao,
        exige_tributacao = excluded.exige_tributacao,
        reducao_bc_cst = excluded.reducao_bc_cst,
        reducao_aliquota = excluded.reducao_aliquota,
        diferimento = excluded.diferimento,
        monofasica = excluded.monofasica,
        perc_reducao_ibs = excluded.perc_reducao_ibs,
        perc_reducao_cbs = excluded.perc_reducao_cbs,
        tipo_aliquota = excluded.tipo_aliquota,
        permite_credito = excluded.permite_credito,
        url_legislacao = excluded.url_legislacao,
        numero_anexo = excluded.numero_anexo,
        tributacao_monofasica_normal = excluded.tributacao_monofasica_normal,
        tributacao_monofasica_retencao = excluded.tributacao_monofasica_retencao,
        tributacao_monofasica_retida_anteriormente = excluded.tributacao_monofasica_retida_anteriormente,
        tributacao_monofasica_diferimento = excluded.tributacao_monofasica_diferimento,
        credito_presumido = excluded.credito_presumido,
        estorno_credito = excluded.estorno_credito,
        transferencia_credito = excluded.transferencia_credito,
        tratamento_esperado = excluded.tratamento_esperado,
        dados_completos_json = excluded.dados_completos_json,
        ativo = 1,
        updated_at = datetime('now')
    `);

    let inseridos = 0;
    const tx = db.transaction((rows: any[]) => {
      for (const item of rows) {
        const cod = String(item['Código da Classificação Tributária'] || item.cclasstrib || '').trim();
        if (!cod || cod === '900001') continue;
        const cst = String(item['Código da Situação Tributária'] || item.cst || '').trim();
        const desc = String(item['Descrição do Código da Classificação Tributária'] || item.descricao || item.descricao_interna || '').trim();
        const descCst = String(item['Descrição da Situação Tributária'] || item.desc_cst || '').trim();
        const monofasica = String(item['Monofásica'] || item.monofasica || (cst === '620' ? 'Sim' : 'Não')).trim();
        const redIbs = Number(item['Percentual Redução IBS'] || item.perc_reducao_ibs || 0);
        const redCbs = Number(item['Percentual Redução CBS'] || item.perc_reducao_cbs || 0);

        let tratamento = 'tributado';
        if (cst === '620') tratamento = 'monofasico';
        else if (cst === '400') tratamento = 'isento';
        else if (cst === '410') tratamento = 'imune';
        else if (cst === '510' || cst === '515') tratamento = 'diferido';
        else if (cst === '550') tratamento = 'suspenso';
        else if (redIbs > 0 || redCbs > 0) tratamento = 'reduzido';

        let permiteCredito = String(item['Permite Crédito'] || item.permite_credito || 'Sim');
        if (cst === '620' || cod === '620006' || cod === '620001' || cod === '620002') {
          permiteCredito = 'Não';
        }

        const id = item.id || `cclass-${cod}`;

        stmt.run(
          id, cod, desc, cst, descCst, desc,
          String(item['Exige Tributação'] || item.exige_tributacao || 'Sim'),
          String(item['Redução BC CST'] || item.reducao_bc_cst || 'Não'),
          String(item['Redução de Alíquota'] || item.reducao_aliquota || 'Não'),
          String(item['Diferimento'] || item.diferimento || 'Não'),
          monofasica, redIbs, redCbs,
          String(item['Tipo de Alíquota'] || item.tipo_aliquota || ''),
          permiteCredito,
          String(item['Url da Legislação'] || item.url_legislacao || ''),
          String(item['Número do Anexo'] || item.numero_anexo || ''),
          String(item['Tributação Monofásica Normal'] || item.tributacao_monofasica_normal || 'Não'),
          String(item['Tributação Monofásica sujeita a retenção'] || item.tributacao_monofasica_retencao || 'Não'),
          String(item['Tributação Monofásica retida anteriormente'] || item.tributacao_monofasica_retida_anteriormente || 'Não'),
          String(item['Tributação Monofásica de Combustível com diferimento'] || item.tributacao_monofasica_diferimento || 'Não'),
          String(item['Crédito Presumido'] || item.credito_presumido || 'Não'),
          String(item['Estorno de Crédito'] || item.estorno_credito || 'Não'),
          String(item['Transferência de Crédito'] || item.transferencia_credito || 'Não'),
          tratamento,
          JSON.stringify(item)
        );
        inseridos++;
      }
    });

    tx(itens);
    res.json({ success: true, message: `${inseridos} registros de cClassTrib importados/atualizados com sucesso.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro no upload de cClassTrib: ' + err.message });
  }
});

/** DELETE /api/tables/cclasstrib/:id */
router.delete('/cclasstrib/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    db.prepare("DELETE FROM cclasstrib_regras WHERE id = ? OR cclasstrib = ?").run(id, id);
    res.json({ success: true, message: 'cClassTrib excluído com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao excluir cClassTrib: ' + err.message });
  }
});

// =========================================================
// TABELA LOCAL DA OPERAÇÃO (indOper - Princípio do Destino)
// =========================================================

/** GET /api/tables/indoper — Listar códigos indOper */
router.get('/indoper', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { busca } = req.query as any;
    const db = getDatabase();
    let sql = 'SELECT * FROM indoper_regras WHERE 1=1';
    const params: any[] = [];

    if (busca) {
      sql += ' AND (codigo LIKE ? OR nome LIKE ? OR local LIKE ? OR caracteristica LIKE ?)';
      const s = `%${busca}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY codigo ASC';
    const rows = db.prepare(sql).all(...params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao listar indOper: ' + err.message });
  }
});

/** GET /api/tables/indoper/export — Exportar indOper (JSON ou XLSX) */
router.get('/indoper/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT 
        codigo as "Código",
        nome as "Nome",
        dispositivo_legal as "Dispositivo Legal",
        local as "Local",
        local_fornecedor as "Local do Fornecedor",
        caracteristica as "Característica do Fornecedor",
        data_publicacao as "Data de Publicação",
        inicio_vigencia as "Início de Vigência",
        fim_vigencia as "Fim de Vigência"
      FROM indoper_regras 
      ORDER BY codigo ASC
    `).all();
    sendExportFile(res, 'Tabela_Oficial_indOper_SVRS', format, rows);
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao exportar indOper: ' + err.message });
  }
});

/** POST /api/tables/indoper — Criar ou Editar indOper */
router.post('/indoper', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, codigo, nome, dispositivo_legal, local, local_fornecedor, caracteristica, data_publicacao, inicio_vigencia, fim_vigencia } = req.body;
    if (!codigo || !nome) {
      res.status(400).json({ error: 'codigo e nome são obrigatórios.' });
      return;
    }

    const rowId = id || `indoper-${codigo}`;
    const db = getDatabase();
    db.prepare(`
      INSERT INTO indoper_regras (
        id, codigo, nome, dispositivo_legal, local, local_fornecedor,
        caracteristica, data_publicacao, inicio_vigencia, fim_vigencia, dados_completos_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(codigo) DO UPDATE SET
        nome = excluded.nome,
        dispositivo_legal = excluded.dispositivo_legal,
        local = excluded.local,
        local_fornecedor = excluded.local_fornecedor,
        caracteristica = excluded.caracteristica,
        data_publicacao = excluded.data_publicacao,
        inicio_vigencia = excluded.inicio_vigencia,
        fim_vigencia = excluded.fim_vigencia,
        dados_completos_json = excluded.dados_completos_json
    `).run(
      rowId, codigo, nome, dispositivo_legal || '', local || '', local_fornecedor || '',
      caracteristica || '', data_publicacao || '17/11/2025', inicio_vigencia || '17/11/2025',
      fim_vigencia || '-', JSON.stringify(req.body)
    );

    res.status(201).json({ success: true, message: 'indOper salvo com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao salvar indOper: ' + err.message });
  }
});

/** POST /api/tables/indoper/upload — Upload em massa indOper (JSON ou XLSX) */
router.post('/indoper/upload', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itens } = req.body as { itens: any[] };
    if (!Array.isArray(itens) || itens.length === 0) {
      res.status(400).json({ success: false, message: 'Nenhum registro recebido para importação.' });
      return;
    }

    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO indoper_regras (
        id, codigo, nome, dispositivo_legal, local, local_fornecedor,
        caracteristica, data_publicacao, inicio_vigencia, fim_vigencia, dados_completos_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(codigo) DO UPDATE SET
        nome = excluded.nome,
        dispositivo_legal = excluded.dispositivo_legal,
        local = excluded.local,
        local_fornecedor = excluded.local_fornecedor,
        caracteristica = excluded.caracteristica,
        data_publicacao = excluded.data_publicacao,
        inicio_vigencia = excluded.inicio_vigencia,
        fim_vigencia = excluded.fim_vigencia,
        dados_completos_json = excluded.dados_completos_json
    `);

    let inseridos = 0;
    const tx = db.transaction((rows: any[]) => {
      for (const item of rows) {
        const cod = String(item['Código'] || item.codigo || '').trim();
        if (!cod) continue;
        const rowId = item.id || `indoper-${cod}`;
        stmt.run(
          rowId, cod,
          String(item['Nome'] || item.nome || ''),
          String(item['Dispositivo Legal'] || item.dispositivo_legal || ''),
          String(item['Local'] || item.local || ''),
          String(item['Local do Fornecedor'] || item.local_fornecedor || ''),
          String(item['Característica do Fornecedor'] || item.caracteristica || ''),
          String(item['Data de Publicação'] || item.data_publicacao || '17/11/2025'),
          String(item['Início de Vigência'] || item.inicio_vigencia || '17/11/2025'),
          String(item['Fim de Vigência'] || item.fim_vigencia || '-'),
          JSON.stringify(item)
        );
        inseridos++;
      }
    });

    tx(itens);
    res.json({ success: true, message: `${inseridos} registros de indOper importados/atualizados com sucesso.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro no upload de indOper: ' + err.message });
  }
});

/** DELETE /api/tables/indoper/:id — Excluir indOper */
router.delete('/indoper/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    db.prepare("DELETE FROM indoper_regras WHERE id = ? OR codigo = ?").run(id, id);
    res.json({ success: true, message: 'indOper excluído com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao excluir indOper: ' + err.message });
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

/** GET /api/tables/regras/export — Exportar regras em JSON ou XLSX */
router.get('/regras/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT codigo_regra, nome, descricao, tipo_aquisicao, cfops_aplicaveis, resultado_padrao, evidencia_minima, base_legal, ativo
      FROM regras_elegibilidade 
      WHERE ativo = 1
      ORDER BY codigo_regra
    `).all();

    sendExportFile(res, 'Regras_Elegibilidade_Credito', format, rows);
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao exportar regras: ' + err.message });
  }
});

/** POST /api/tables/regras/upload — Upload em lote de regras (JSON ou XLSX) */
router.post('/regras/upload', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itens } = req.body as { itens: any[] };
    if (!Array.isArray(itens) || itens.length === 0) {
      res.status(400).json({ success: false, message: 'Nenhum registro recebido para importação.' });
      return;
    }

    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO regras_elegibilidade (
        id, codigo_regra, nome, descricao, tipo_aquisicao, cfops_aplicaveis, resultado_padrao, evidencia_minima, base_legal, ativo, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
      ON CONFLICT(codigo_regra) DO UPDATE SET
        nome = excluded.nome,
        descricao = excluded.descricao,
        tipo_aquisicao = excluded.tipo_aquisicao,
        cfops_aplicaveis = excluded.cfops_aplicaveis,
        resultado_padrao = excluded.resultado_padrao,
        evidencia_minima = excluded.evidencia_minima,
        base_legal = excluded.base_legal,
        ativo = 1,
        updated_at = datetime('now')
    `);

    let inseridos = 0;
    const tx = db.transaction((rows: any[]) => {
      for (const item of rows) {
        const cod = String(item['Código Regra'] || item.codigo_regra || '').trim();
        const nome = String(item['Nome'] || item.nome || '').trim();
        if (!cod || !nome) continue;
        const rowId = item.id || uuid();
        stmt.run(
          rowId, cod, nome,
          String(item['Descrição'] || item.descricao || ''),
          String(item['Tipo Aquisição'] || item.tipo_aquisicao || 'Geral'),
          String(item['CFOPs Aplicáveis'] || item.cfops_aplicaveis || ''),
          String(item['Resultado Padrão'] || item.resultado_padrao || 'Elegível'),
          String(item['Evidência Mínima'] || item.evidencia_minima || ''),
          String(item['Base Legal'] || item.base_legal || '')
        );
        inseridos++;
      }
    });
    tx(itens);

    res.json({ success: true, message: `${inseridos} regras de elegibilidade importadas com sucesso!` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao importar regras: ' + err.message });
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

/** GET /api/tables/inferencia/export — Exportar parâmetros de inferência (JSON ou XLSX) */
router.get('/inferencia/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT codigo, descricao, icms_medio, pis_medio, cofins_medio, ipi_medio, iss_medio,
             aplica_simples_nac, aplica_cte, aplica_nfse, inicio_vigencia, final_vigencia
      FROM parametros_inferencia 
      ORDER BY codigo
    `).all();

    sendExportFile(res, 'Parametros_Inferencia_Aliquota_Media', format, rows);
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao exportar parâmetros de inferência: ' + err.message });
  }
});

/** POST /api/tables/inferencia/upload — Upload em massa de parâmetros de inferência (JSON ou XLSX) */
router.post('/inferencia/upload', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itens } = req.body as { itens: any[] };
    if (!Array.isArray(itens) || itens.length === 0) {
      res.status(400).json({ success: false, message: 'Nenhum registro recebido para importação.' });
      return;
    }

    const db = getDatabase();
    const stmt = db.prepare(`
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
    `);

    let inseridos = 0;
    const tx = db.transaction((rows: any[]) => {
      for (const item of rows) {
        const cod = String(item['Código'] || item.codigo || '').trim();
        const desc = String(item['Descrição'] || item.descricao || '').trim();
        if (!cod || !desc) continue;
        const rowId = item.id || uuid();
        stmt.run(
          rowId, cod, desc,
          Number(item['ICMS Médio (%)'] ?? item.icms_medio ?? 0),
          Number(item['PIS Médio (%)'] ?? item.pis_medio ?? 0),
          Number(item['COFINS Médio (%)'] ?? item.cofins_medio ?? 0),
          Number(item['IPI Médio (%)'] ?? item.ipi_medio ?? 0),
          Number(item['ISS Médio (%)'] ?? item.iss_medio ?? 0),
          item.aplica_simples_nac ? 1 : 0,
          item.aplica_cte ? 1 : 0,
          item.aplica_nfse ? 1 : 0,
          String(item['Início Vigência'] || item.inicio_vigencia || '2026-01-01'),
          String(item['Fim Vigência'] || item.final_vigencia || '2099-12-31')
        );
        inseridos++;
      }
    });
    tx(itens);

    res.json({ success: true, message: `${inseridos} parâmetros de inferência importados com sucesso!` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao importar parâmetros de inferência: ' + err.message });
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

// =========================================================
// REGRAS DE RETENÇÃO DE SERVIÇOS (Importadas via CSV)
// =========================================================

/** GET /api/tables/regras-retencao-servicos — Listar regras de retenção */
router.get('/regras-retencao-servicos', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data, error } = await supabase.from('regras_retencao_servicos').select('*').order('item_lc116', { ascending: true });
        if (error) throw error;
        res.json({ success: true, data: data || [] });
        return;
      }
    }

    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM regras_retencao_servicos ORDER BY item_lc116 ASC').all();
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao listar regras de retenção: ' + err.message });
  }
});

/** GET /api/tables/regras-retencao-servicos/export — Exportar regras de retenção (JSON ou XLSX) */
router.get('/regras-retencao-servicos/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM regras_retencao_servicos ORDER BY item_lc116 ASC').all();
    sendExportFile(res, 'Regras_Retencao_Servicos_LC116_LC214', format, rows);
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao exportar regras de retenção: ' + err.message });
  }
});

/** Função para corrigir caracteres corrompidos por divergência de encoding (UTF-8 / Windows-1252 / ISO-8859-1) */
function fixEncoding(val: any): string {
  if (val === undefined || val === null) return '';
  let str = String(val).trim();
  if (!str) return '';

  try {
    if (/[\u00C2\u00C3]/.test(str)) {
      const latin1Bytes = Buffer.from(str, 'latin1');
      const decodedUtf8 = latin1Bytes.toString('utf-8');
      if (!decodedUtf8.includes('\uFFFD')) {
        str = decodedUtf8;
      }
    }
  } catch (_e) {
    // Seguir com str original
  }

  return str.replace(/\u00A0/g, ' ').trim();
}

/** POST /api/tables/regras-retencao-servicos/upload — Upload e substituição da tabela via CSV */
router.post('/regras-retencao-servicos/upload', requireAuth, requirePerfil('admin_master', 'contador_gestor'), upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
      return;
    }

    // Lê o buffer usando XLSX com codepage 65001 (UTF-8) como padrão para CSV e XLSX
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', codepage: 65001 });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // Pegar o array de arrays
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

    if (rawData.length < 2) {
      res.status(400).json({ success: false, message: 'Arquivo parece estar vazio ou sem cabeçalhos.' });
      return;
    }

    // Assume-se que a primeira linha é cabeçalho. Iterar e preparar inserts.
    const records = [];
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      // Pular linhas vazias
      if (!row || row.length === 0) continue;
      const hasValue = row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
      if (!hasValue) continue;

      const getStr = (index: number) => fixEncoding(row[index]);

      records.push({
        id: uuid(),
        item_lc116: getStr(0),
        descricao_item: getStr(1),
        nbs: getStr(2),
        descricao_nbs: getStr(3),
        ps_onerosa: getStr(4).toUpperCase() === 'S' ? 1 : 0,
        adq_exterior: getStr(5).toUpperCase() === 'S' ? 1 : 0,
        cclasstrib: getStr(6),
        nome_cclasstrib: getStr(7),
        irrf: getStr(8),
        csrf: getStr(9),
        inss: getStr(10),
        iss: getStr(11),
        cosirf_orgaos_publicos: getStr(12),
        fundamentos_legais: getStr(13),
        indop: getStr(14),
        local_incidencia_ibs: getStr(15),
        tipo_operacao: getStr(16),
        caracteristica_fornecimento: getStr(17),
        local_fornecimento: getStr(18),
        dispositivo_legal_lc214: getStr(19),
        observacao: getStr(20),
        indnfe: getStr(21),
        indnfse: getStr(22),
      });
    }

    // Bulk Insert Local (SQLite)
    const db = getDatabase();
    
    db.transaction(() => {
      // Deletar os atuais
      db.prepare('DELETE FROM regras_retencao_servicos').run();

      const insertStmt = db.prepare(`
        INSERT INTO regras_retencao_servicos (
          id, item_lc116, descricao_item, nbs, descricao_nbs, ps_onerosa, adq_exterior,
          indop, local_incidencia_ibs, cclasstrib, nome_cclasstrib,
          irrf, csrf, inss, iss, cosirf_orgaos_publicos,
          fundamentos_legais, tipo_operacao, caracteristica_fornecimento,
          local_fornecimento, dispositivo_legal_lc214, observacao, indnfe, indnfse
        ) VALUES (
          @id, @item_lc116, @descricao_item, @nbs, @descricao_nbs, @ps_onerosa, @adq_exterior,
          @indop, @local_incidencia_ibs, @cclasstrib, @nome_cclasstrib,
          @irrf, @csrf, @inss, @iss, @cosirf_orgaos_publicos,
          @fundamentos_legais, @tipo_operacao, @caracteristica_fornecimento,
          @local_fornecimento, @dispositivo_legal_lc214, @observacao, @indnfe, @indnfse
        )
      `);

      for (const rec of records) {
        insertStmt.run(rec);
      }
    })();

    // Sincronizar Supabase se ativo
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        // Deletar existentes
        const { error: delError } = await supabase.from('regras_retencao_servicos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (delError) {
          console.error('Erro ao deletar regras do supabase:', delError);
        } else {
          // Converter booleanos e inserir em lotes de 200 no Supabase (evita limite de payload/timeout)
          const supRecords = records.map(r => ({
            ...r,
            ps_onerosa: r.ps_onerosa === 1,
            adq_exterior: r.adq_exterior === 1
          }));
          
          const BATCH_SIZE = 200;
          let totalSupaInseridos = 0;
          for (let i = 0; i < supRecords.length; i += BATCH_SIZE) {
            const batch = supRecords.slice(i, i + BATCH_SIZE);
            const { error: insError } = await supabase.from('regras_retencao_servicos').insert(batch);
            if (insError) {
              console.error(`Erro ao inserir lote ${i}-${i + batch.length} no supabase:`, insError);
            } else {
              totalSupaInseridos += batch.length;
            }
          }
          console.log(`✅ Supabase sincronizado com ${totalSupaInseridos} regras.`);
        }
      }
    }

    res.json({ success: true, message: `Foram importadas ${records.length} regras com sucesso!` });
  } catch (err: any) {
    console.error('CRITICAL ERROR NO UPLOAD DE REGRAS DE RETENCAO:', err);
    res.status(500).json({ success: false, message: 'Erro ao processar o upload: ' + err.message });
  }
});

/** POST /api/tables/regras-retencao-servicos — Criar nova regra manual */
router.post('/regras-retencao-servicos', requireAuth, requirePerfil('admin_master', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = req.body;
    const db = getDatabase();
    
    // Check if ID is provided, else create one
    const id = data.id || uuid();
    const ps_onerosa = data.ps_onerosa === 1 || data.ps_onerosa === true || data.ps_onerosa === 'S' ? 1 : 0;
    const adq_exterior = data.adq_exterior === 1 || data.adq_exterior === true || data.adq_exterior === 'S' ? 1 : 0;
    
    db.prepare(`
      INSERT INTO regras_retencao_servicos (
        id, item_lc116, descricao_item, nbs, descricao_nbs, ps_onerosa, adq_exterior,
        indop, local_incidencia_ibs, cclasstrib, nome_cclasstrib,
        irrf, csrf, inss, iss, cosirf_orgaos_publicos,
        fundamentos_legais, tipo_operacao, caracteristica_fornecimento,
        local_fornecimento, dispositivo_legal_lc214, observacao, indnfe, indnfse,
        created_at, updated_at
      ) VALUES (
        @id, @item_lc116, @descricao_item, @nbs, @descricao_nbs, @ps_onerosa, @adq_exterior,
        @indop, @local_incidencia_ibs, @cclasstrib, @nome_cclasstrib,
        @irrf, @csrf, @inss, @iss, @cosirf_orgaos_publicos,
        @fundamentos_legais, @tipo_operacao, @caracteristica_fornecimento,
        @local_fornecimento, @dispositivo_legal_lc214, @observacao, @indnfe, @indnfse,
        datetime('now'), datetime('now')
      )
    `).run({ ...data, id, ps_onerosa, adq_exterior });

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase.from('regras_retencao_servicos').insert([{
          ...data, id, ps_onerosa: ps_onerosa === 1, adq_exterior: adq_exterior === 1
        }]);
      }
    }

    res.status(201).json({ success: true, message: 'Regra de retenção criada com sucesso.', id });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao criar regra de retenção: ' + err.message });
  }
});

/** PUT /api/tables/regras-retencao-servicos/:id — Atualizar regra existente */
router.put('/regras-retencao-servicos/:id', requireAuth, requirePerfil('admin_master', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const db = getDatabase();

    const ps_onerosa = data.ps_onerosa === 1 || data.ps_onerosa === true || data.ps_onerosa === 'S' ? 1 : 0;
    const adq_exterior = data.adq_exterior === 1 || data.adq_exterior === true || data.adq_exterior === 'S' ? 1 : 0;

    db.prepare(`
      UPDATE regras_retencao_servicos SET
        item_lc116 = @item_lc116, descricao_item = @descricao_item, nbs = @nbs, descricao_nbs = @descricao_nbs,
        ps_onerosa = @ps_onerosa, adq_exterior = @adq_exterior,
        indop = @indop, local_incidencia_ibs = @local_incidencia_ibs, cclasstrib = @cclasstrib, nome_cclasstrib = @nome_cclasstrib,
        irrf = @irrf, csrf = @csrf, inss = @inss, iss = @iss, cosirf_orgaos_publicos = @cosirf_orgaos_publicos,
        fundamentos_legais = @fundamentos_legais, tipo_operacao = @tipo_operacao, caracteristica_fornecimento = @caracteristica_fornecimento,
        local_fornecimento = @local_fornecimento, dispositivo_legal_lc214 = @dispositivo_legal_lc214, observacao = @observacao, 
        indnfe = @indnfe, indnfse = @indnfse, updated_at = datetime('now')
      WHERE id = @id
    `).run({ ...data, id, ps_onerosa, adq_exterior });

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase.from('regras_retencao_servicos').update({
          ...data, ps_onerosa: ps_onerosa === 1, adq_exterior: adq_exterior === 1, updated_at: new Date().toISOString()
        }).eq('id', id);
      }
    }

    res.json({ success: true, message: 'Regra de retenção atualizada com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao atualizar regra de retenção: ' + err.message });
  }
});

/** DELETE /api/tables/regras-retencao-servicos/:id — Excluir regra existente */
router.delete('/regras-retencao-servicos/:id', requireAuth, requirePerfil('admin_master', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    db.prepare('DELETE FROM regras_retencao_servicos WHERE id = ?').run(id);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase.from('regras_retencao_servicos').delete().eq('id', id);
      }
    }

    res.json({ success: true, message: 'Regra excluída com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao excluir regra: ' + err.message });
  }
});

// =========================================================
// 8. SIMPLES NACIONAL (LC 123/2006 & LC 214/2025)
// =========================================================

/** GET /api/tables/simples-nacional — Listar faixas e partilhas */
router.get('/simples-nacional', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const faixas = db.prepare(`
      SELECT * FROM simples_nacional_faixas
      WHERE ativo = 1
      ORDER BY anexo, faixa
    `).all();

    const partilhas = db.prepare(`
      SELECT * FROM simples_nacional_partilha_reforma
      ORDER BY anexo, ano_transicao, faixa
    `).all();

    res.json({ success: true, faixas, partilhas });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao buscar dados do Simples Nacional: ' + err.message });
  }
});

/** POST /api/tables/simples-nacional/faixa — Gravar/Atualizar faixa do Simples */
router.post('/simples-nacional/faixa', requireAuth, requirePerfil('admin_master', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const {
      id, anexo, nome_anexo, faixa, limite_superior, aliq_nominal, deducao,
      reparticao_irpj, reparticao_csll, reparticao_cofins, reparticao_pis,
      reparticao_cpp, reparticao_icms, reparticao_iss, reparticao_ipi
    } = req.body;

    const faixaId = id || uuid();

    db.prepare(`
      INSERT INTO simples_nacional_faixas (
        id, anexo, nome_anexo, faixa, limite_superior, aliq_nominal, deducao,
        reparticao_irpj, reparticao_csll, reparticao_cofins, reparticao_pis,
        reparticao_cpp, reparticao_icms, reparticao_iss, reparticao_ipi, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(anexo, faixa) DO UPDATE SET
        nome_anexo = excluded.nome_anexo,
        limite_superior = excluded.limite_superior,
        aliq_nominal = excluded.aliq_nominal,
        deducao = excluded.deducao,
        reparticao_irpj = excluded.reparticao_irpj,
        reparticao_csll = excluded.reparticao_csll,
        reparticao_cofins = excluded.reparticao_cofins,
        reparticao_pis = excluded.reparticao_pis,
        reparticao_cpp = excluded.reparticao_cpp,
        reparticao_icms = excluded.reparticao_icms,
        reparticao_iss = excluded.reparticao_iss,
        reparticao_ipi = excluded.reparticao_ipi,
        updated_at = datetime('now')
    `).run(
      faixaId, anexo, nome_anexo, faixa, limite_superior, aliq_nominal, deducao || 0,
      reparticao_irpj || 0, reparticao_csll || 0, reparticao_cofins || 0, reparticao_pis || 0,
      reparticao_cpp || 0, reparticao_icms || 0, reparticao_iss || 0, reparticao_ipi || 0
    );

    res.json({ success: true, message: 'Faixa do Simples Nacional salva com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao gravar faixa do Simples Nacional: ' + err.message });
  }
});

/** DELETE /api/tables/simples-nacional/faixas/:id — Excluir faixa do Simples Nacional */
router.delete('/simples-nacional/faixas/:id', requireAuth, requirePerfil('admin_master', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    db.prepare('DELETE FROM simples_nacional_faixas WHERE id = ?').run(id);
    res.json({ success: true, message: 'Faixa do Simples Nacional excluída com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao excluir faixa: ' + err.message });
  }
});

/** GET /api/tables/simples-nacional/export — Exportar faixas do Simples Nacional (JSON ou XLSX) */
router.get('/simples-nacional/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT anexo, nome_anexo, faixa, limite_superior, aliq_nominal, deducao,
             reparticao_irpj, reparticao_csll, reparticao_cofins, reparticao_pis,
             reparticao_cpp, reparticao_icms, reparticao_iss, reparticao_ipi
      FROM simples_nacional_faixas
      WHERE ativo = 1
      ORDER BY anexo, faixa
    `).all();

    sendExportFile(res, 'Simples_Nacional_Faixas', format, rows);
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao exportar faixas do Simples: ' + err.message });
  }
});

/** POST /api/tables/simples-nacional/upload — Upload em massa de faixas do Simples (JSON ou XLSX) */
router.post('/simples-nacional/upload', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itens } = req.body as { itens: any[] };
    if (!Array.isArray(itens) || itens.length === 0) {
      res.status(400).json({ success: false, message: 'Nenhum registro recebido para importação.' });
      return;
    }

    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO simples_nacional_faixas (
        id, anexo, nome_anexo, faixa, limite_superior, aliq_nominal, deducao,
        reparticao_irpj, reparticao_csll, reparticao_cofins, reparticao_pis,
        reparticao_cpp, reparticao_icms, reparticao_iss, reparticao_ipi, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(anexo, faixa) DO UPDATE SET
        nome_anexo = excluded.nome_anexo,
        limite_superior = excluded.limite_superior,
        aliq_nominal = excluded.aliq_nominal,
        deducao = excluded.deducao,
        reparticao_irpj = excluded.reparticao_irpj,
        reparticao_csll = excluded.reparticao_csll,
        reparticao_cofins = excluded.reparticao_cofins,
        reparticao_pis = excluded.reparticao_pis,
        reparticao_cpp = excluded.reparticao_cpp,
        reparticao_icms = excluded.reparticao_icms,
        reparticao_iss = excluded.reparticao_iss,
        reparticao_ipi = excluded.reparticao_ipi,
        updated_at = datetime('now')
    `);

    let inseridos = 0;
    const tx = db.transaction((rows: any[]) => {
      for (const item of rows) {
        const anexo = String(item['Anexo'] || item.anexo || '').trim();
        const faixa = Number(item['Faixa'] ?? item.faixa ?? 1);
        if (!anexo) continue;
        const rowId = item.id || uuid();
        stmt.run(
          rowId, anexo,
          String(item['Nome Anexo'] || item.nome_anexo || anexo),
          faixa,
          Number(item['Limite Superior'] ?? item.limite_superior ?? 0),
          Number(item['Alíquota Nominal'] ?? item.aliq_nominal ?? 0),
          Number(item['Dedução'] ?? item.deducao ?? 0),
          Number(item['IRPJ'] ?? item.reparticao_irpj ?? 0),
          Number(item['CSLL'] ?? item.reparticao_csll ?? 0),
          Number(item['COFINS'] ?? item.reparticao_cofins ?? 0),
          Number(item['PIS'] ?? item.reparticao_pis ?? 0),
          Number(item['CPP'] ?? item.reparticao_cpp ?? 0),
          Number(item['ICMS'] ?? item.reparticao_icms ?? 0),
          Number(item['ISS'] ?? item.reparticao_iss ?? 0),
          Number(item['IPI'] ?? item.reparticao_ipi ?? 0)
        );
        inseridos++;
      }
    });
    tx(itens);

    res.json({ success: true, message: `${inseridos} faixas do Simples Nacional importadas com sucesso!` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao importar Simples Nacional: ' + err.message });
  }
});

// =========================================================
// 9. LUCRO PRESUMIDO & PRESUNÇÕES (LEI 9.249/1995)
// =========================================================

/** GET /api/tables/lucro-presumido — Listar atividades e presunções */
router.get('/lucro-presumido', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM lucro_presumido_parametros
      WHERE ativo = 1
      ORDER BY nome_atividade
    `).all();

    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao listar parâmetros do Lucro Presumido: ' + err.message });
  }
});

/** GET /api/tables/lucro-presumido/export — Exportar Lucro Presumido (JSON ou XLSX) */
router.get('/lucro-presumido/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT codigo_atividade, nome_atividade, presuncao_irpj, presuncao_csll,
             aliq_irpj_basico, aliq_irpj_adicional, limite_mensal_adicional, aliq_csll,
             artigo_legal, detalhe, categoria, anexo_simples_padrao
      FROM lucro_presumido_parametros
      WHERE ativo = 1
      ORDER BY nome_atividade
    `).all();

    sendExportFile(res, 'Lucro_Presumido_Parametros', format, rows);
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao exportar Lucro Presumido: ' + err.message });
  }
});

/** POST /api/tables/lucro-presumido/upload — Upload em massa de Lucro Presumido (JSON ou XLSX) */
router.post('/lucro-presumido/upload', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itens } = req.body as { itens: any[] };
    if (!Array.isArray(itens) || itens.length === 0) {
      res.status(400).json({ success: false, message: 'Nenhum registro recebido para importação.' });
      return;
    }

    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO lucro_presumido_parametros (
        id, codigo_atividade, nome_atividade, presuncao_irpj, presuncao_csll,
        aliq_irpj_basico, aliq_irpj_adicional, limite_mensal_adicional, aliq_csll,
        artigo_legal, detalhe, categoria, anexo_simples_padrao, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(codigo_atividade) DO UPDATE SET
        nome_atividade = excluded.nome_atividade,
        presuncao_irpj = excluded.presuncao_irpj,
        presuncao_csll = excluded.presuncao_csll,
        aliq_irpj_basico = excluded.aliq_irpj_basico,
        aliq_irpj_adicional = excluded.aliq_irpj_adicional,
        limite_mensal_adicional = excluded.limite_mensal_adicional,
        aliq_csll = excluded.aliq_csll,
        artigo_legal = excluded.artigo_legal,
        detalhe = excluded.detalhe,
        categoria = excluded.categoria,
        anexo_simples_padrao = excluded.anexo_simples_padrao,
        updated_at = datetime('now')
    `);

    let inseridos = 0;
    const tx = db.transaction((rows: any[]) => {
      for (const item of rows) {
        const cod = String(item['Código'] || item.codigo_atividade || '').trim();
        const nome = String(item['Nome'] || item['Atividade'] || item.nome_atividade || '').trim();
        if (!cod || !nome) continue;
        const rowId = item.id || uuid();
        stmt.run(
          rowId, cod, nome,
          Number(item['Presunção IRPJ'] ?? item.presuncao_irpj ?? 0.08),
          Number(item['Presunção CSLL'] ?? item.presuncao_csll ?? 0.12),
          Number(item['Alíquota IRPJ'] ?? item.aliq_irpj_basico ?? 0.15),
          Number(item['IRPJ Adicional'] ?? item.aliq_irpj_adicional ?? 0.10),
          Number(item['Limite Adicional'] ?? item.limite_mensal_adicional ?? 20000.0),
          Number(item['Alíquota CSLL'] ?? item.aliq_csll ?? 0.09),
          String(item['Artigo Legal'] || item.artigo_legal || ''),
          String(item['Detalhe'] || item.detalhe || ''),
          String(item['Categoria'] || item.categoria || 'servicos'),
          String(item['Anexo Simples Padrão'] || item.anexo_simples_padrao || 'anexo1')
        );
        inseridos++;
      }
    });
    tx(itens);

    res.json({ success: true, message: `${inseridos} parâmetros de Lucro Presumido importados com sucesso!` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao importar Lucro Presumido: ' + err.message });
  }
});

/** POST /api/tables/lucro-presumido — Gravar/Atualizar atividade */
router.post('/lucro-presumido', requireAuth, requirePerfil('admin_master', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const {
      id, codigo_atividade, nome_atividade, presuncao_irpj, presuncao_csll,
      aliq_irpj_basico, aliq_irpj_adicional, limite_mensal_adicional, aliq_csll,
      artigo_legal, detalhe, categoria, anexo_simples_padrao
    } = req.body;

    const rowId = id || uuid();

    db.prepare(`
      INSERT INTO lucro_presumido_parametros (
        id, codigo_atividade, nome_atividade, presuncao_irpj, presuncao_csll,
        aliq_irpj_basico, aliq_irpj_adicional, limite_mensal_adicional, aliq_csll,
        artigo_legal, detalhe, categoria, anexo_simples_padrao, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(codigo_atividade) DO UPDATE SET
        nome_atividade = excluded.nome_atividade,
        presuncao_irpj = excluded.presuncao_irpj,
        presuncao_csll = excluded.presuncao_csll,
        aliq_irpj_basico = excluded.aliq_irpj_basico,
        aliq_irpj_adicional = excluded.aliq_irpj_adicional,
        limite_mensal_adicional = excluded.limite_mensal_adicional,
        aliq_csll = excluded.aliq_csll,
        artigo_legal = excluded.artigo_legal,
        detalhe = excluded.detalhe,
        categoria = excluded.categoria,
        anexo_simples_padrao = excluded.anexo_simples_padrao,
        updated_at = datetime('now')
    `).run(
      rowId, codigo_atividade, nome_atividade, presuncao_irpj, presuncao_csll,
      aliq_irpj_basico ?? 0.15, aliq_irpj_adicional ?? 0.10, limite_mensal_adicional ?? 20000.0,
      aliq_csll ?? 0.09, artigo_legal || '', detalhe || '', categoria || 'servicos', anexo_simples_padrao || 'anexo1'
    );

    res.json({ success: true, message: 'Parâmetro de Lucro Presumido gravado com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao gravar Lucro Presumido: ' + err.message });
  }
});

/** DELETE /api/tables/lucro-presumido/:id — Excluir parâmetro de Lucro Presumido */
router.delete('/lucro-presumido/:id', requireAuth, requirePerfil('admin_master', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    db.prepare('DELETE FROM lucro_presumido_parametros WHERE id = ?').run(id);
    res.json({ success: true, message: 'Parâmetro de Lucro Presumido excluído com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao excluir parâmetro: ' + err.message });
  }
});

// =========================================================
// 10. ENCARGOS PREVIDENCIÁRIOS PATRONAIS
// =========================================================

/** GET /api/tables/encargos-patronais — Listar encargos */
router.get('/encargos-patronais', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM encargos_patronais_parametros
      WHERE ativo = 1
      ORDER BY nome_ramo
    `).all();

    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao listar encargos patronais: ' + err.message });
  }
});

/** GET /api/tables/encargos-patronais/export — Exportar encargos patronais (JSON ou XLSX) */
router.get('/encargos-patronais/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT codigo_atividade, nome_ramo, inss_patronal, rat_fap, sistema_s, entidades_descricao
      FROM encargos_patronais_parametros
      WHERE ativo = 1
      ORDER BY nome_ramo
    `).all();

    sendExportFile(res, 'Encargos_Previdenciarios_Patronais', format, rows);
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao exportar encargos patronais: ' + err.message });
  }
});

/** POST /api/tables/encargos-patronais/upload — Upload em massa de encargos (JSON ou XLSX) */
router.post('/encargos-patronais/upload', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itens } = req.body as { itens: any[] };
    if (!Array.isArray(itens) || itens.length === 0) {
      res.status(400).json({ success: false, message: 'Nenhum registro recebido para importação.' });
      return;
    }

    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO encargos_patronais_parametros (
        id, codigo_atividade, nome_ramo, inss_patronal, rat_fap, sistema_s, entidades_descricao, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(codigo_atividade) DO UPDATE SET
        nome_ramo = excluded.nome_ramo,
        inss_patronal = excluded.inss_patronal,
        rat_fap = excluded.rat_fap,
        sistema_s = excluded.sistema_s,
        entidades_descricao = excluded.entidades_descricao,
        updated_at = datetime('now')
    `);

    let inseridos = 0;
    const tx = db.transaction((rows: any[]) => {
      for (const item of rows) {
        const cod = String(item['Código'] || item.codigo_atividade || '').trim();
        const nome = String(item['Nome'] || item['Ramo'] || item.nome_ramo || '').trim();
        if (!cod || !nome) continue;
        const rowId = item.id || uuid();
        stmt.run(
          rowId, cod, nome,
          Number(item['INSS Patronal'] ?? item.inss_patronal ?? 0.20),
          Number(item['RAT / FAP'] ?? item.rat_fap ?? 0.02),
          Number(item['Sistema S'] ?? item.sistema_s ?? 0.058),
          String(item['Entidades'] || item.entidades_descricao || '')
        );
        inseridos++;
      }
    });
    tx(itens);

    res.json({ success: true, message: `${inseridos} encargos patronais importados com sucesso!` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao importar encargos patronais: ' + err.message });
  }
});

/** POST /api/tables/encargos-patronais — Gravar encargos */
router.post('/encargos-patronais', requireAuth, requirePerfil('admin_master', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { id, codigo_atividade, nome_ramo, inss_patronal, rat_fap, sistema_s, entidades_descricao } = req.body;
    const rowId = id || uuid();

    db.prepare(`
      INSERT INTO encargos_patronais_parametros (
        id, codigo_atividade, nome_ramo, inss_patronal, rat_fap, sistema_s, entidades_descricao, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(codigo_atividade) DO UPDATE SET
        nome_ramo = excluded.nome_ramo,
        inss_patronal = excluded.inss_patronal,
        rat_fap = excluded.rat_fap,
        sistema_s = excluded.sistema_s,
        entidades_descricao = excluded.entidades_descricao,
        updated_at = datetime('now')
    `).run(rowId, codigo_atividade, nome_ramo, inss_patronal, rat_fap, sistema_s, entidades_descricao || '');

    res.json({ success: true, message: 'Encargo patronal gravado com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao gravar encargos patronais: ' + err.message });
  }
});

/** DELETE /api/tables/encargos-patronais/:id — Excluir encargo patronal */
router.delete('/encargos-patronais/:id', requireAuth, requirePerfil('admin_master', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    db.prepare('DELETE FROM encargos_patronais_parametros WHERE id = ?').run(id);
    res.json({ success: true, message: 'Encargo patronal excluído com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Erro ao excluir encargo patronal: ' + err.message });
  }
});

export default router;


