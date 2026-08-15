import { Router } from 'express';
import { getDatabase } from '../db/database';

const router = Router();

// GET /api/audit/logs - Listar logs de auditoria
router.get('/logs', (req, res) => {
  try {
    const db = getDatabase();
    // In a real application, you might filter by empresa_id from token
    const rows = db.prepare(`SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 100`).all();

    const formatted = rows.map((r: any) => ({
      id: r.id,
      timestamp: r.timestamp,
      nivel: r.nivel,
      servico: r.servico,
      acao: r.acao,
      descricao: r.descricao,
      usuario_email: r.usuario_email
    }));

    return res.json({ success: true, data: formatted });
  } catch (err: any) {
    console.error('❌ Erro ao listar logs de auditoria:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao listar logs.' });
  }
});

// POST /api/audit/logs - Inserir log (uso interno ou endpoints)
router.post('/logs', (req, res) => {
  try {
    const { nivel, servico, acao, descricao, usuario_email } = req.body;
    const db = getDatabase();

    db.prepare(`
      INSERT INTO audit_log (nivel, servico, acao, descricao, usuario_email)
      VALUES (?, ?, ?, ?, ?)
    `).run(nivel || 'INFO', servico || 'API', acao, descricao, usuario_email || '');

    return res.json({ success: true });
  } catch (err: any) {
    console.error('❌ Erro ao inserir log:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao inserir log.' });
  }
});

export default router;
