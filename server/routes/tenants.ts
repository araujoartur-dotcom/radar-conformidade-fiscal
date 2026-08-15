/**
 * ============================================================
 * ROTAS DE TENANTS (EMPRESAS) — CRUD PERSISTENTE
 * ============================================================
 * Gerencia empresas na carteira. Suporta Matrizes e Filiais
 * compartilhando o mesmo CNPJ Raiz (8 dígitos) com isolamento
 * por CNPJ Completo (14 dígitos).
 * ============================================================
 */

import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import { getDatabase } from '../db/database';
import { AuthenticatedRequest, requireAuth, logAuditAction } from '../middleware/auth';

const router = Router();

// GET /api/tenants - Listar todas as empresas da carteira do usuário
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();

    const rows = db.prepare(`
      SELECT 
        e.*,
        c.arquivo_nome as cert_file_name,
        c.validade as cert_validade,
        c.status_alerta as cert_status,
        c.emissor as cert_emissor,
        c.impressao_digital as cert_fingerprint
      FROM empresas e
      LEFT JOIN certificados c ON c.empresa_id = e.id
      ORDER BY e.created_at DESC
    `).all() as any[];

    const formatted = rows.map((r: any) => ({
      id: r.id,
      cnpjRaiz: r.cnpj_raiz,
      cnpjCompleto: r.cnpj_completo,
      razaoSocial: r.razao_social,
      nomeFantasia: r.nome_fantasia || r.razao_social,
      grupoContabilCliente: 'Carteira Geral',
      uf: r.uf,
      regimeTributario: r.regime_tributario,
      certificadoA1: r.cert_file_name ? {
        fileName: r.cert_file_name,
        validade: r.cert_validade,
        status: r.cert_status === 'ok' ? 'valido' : (r.cert_status === 'expirado' ? 'expirado' : 'pendente'),
        emissor: r.cert_emissor || 'AC Certificadora A1',
        impressaoDigital: r.cert_fingerprint || ''
      } : undefined,
      totalDocumentosCapturados: 0,
      statusConexaoSefaz: r.cert_file_name ? 'ativo' : 'sem_certificado',
      ultimaSincronizacao: r.cert_file_name ? 'Certificado Ativo' : 'Sem Certificado'
    }));

    res.json({ success: true, data: formatted });
  } catch (err: any) {
    console.error('❌ Erro ao listar tenants:', err.message);
    res.status(500).json({ success: false, message: 'Erro ao listar empresas.' });
  }
});

// POST /api/tenants - Criar nova empresa (Matriz ou Filial)
router.post('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cnpjCompleto, razaoSocial, nomeFantasia, uf, regimeTributario, grupoContabilCliente } = req.body;
    if (!cnpjCompleto || !razaoSocial) {
      res.status(400).json({ success: false, message: 'CNPJ e Razão Social são obrigatórios.' });
      return;
    }

    const cleanCnpj = cnpjCompleto.replace(/\D/g, '');
    const cnpjRaiz = cleanCnpj.substring(0, 8);
    const id = uuid();

    const db = getDatabase();

    // Verificar duplicidade de CNPJ COMPLETO (permite múltiplas filiais com o mesmo cnpj_raiz)
    const existing = db.prepare('SELECT id FROM empresas WHERE cnpj_completo = ?').get(cnpjCompleto) as any;
    if (existing) {
      res.status(409).json({ success: false, message: `CNPJ ${cnpjCompleto} já cadastrado no sistema.` });
      return;
    }

    db.transaction(() => {
      // 1. Inserir empresa
      db.prepare(`
        INSERT INTO empresas (id, cnpj_raiz, cnpj_completo, razao_social, nome_fantasia, uf, regime_tributario, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'ativo')
      `).run(id, cnpjRaiz, cnpjCompleto, razaoSocial.toUpperCase(), (nomeFantasia || razaoSocial).toUpperCase(), uf || 'SP', regimeTributario || 'Lucro Real');

      // 2. Vincular ao usuário logado na tabela usuario_empresa
      if (req.user?.userId) {
        const vinculoId = uuid();
        db.prepare(`
          INSERT OR IGNORE INTO usuario_empresa (id, usuario_id, empresa_id, permissao, modulos_permitidos)
          VALUES (?, ?, ?, 'total', '*')
        `).run(vinculoId, req.user.userId, id);
      }
    })();

    logAuditAction(req, 'TENANT_CRIAR', `Empresa ${razaoSocial} (${cnpjCompleto}) cadastrada na carteira`);

    res.status(201).json({
      success: true,
      message: 'Empresa cadastrada com sucesso.',
      data: {
        id,
        cnpjRaiz,
        cnpjCompleto,
        razaoSocial: razaoSocial.toUpperCase(),
        nomeFantasia: (nomeFantasia || razaoSocial).toUpperCase(),
        grupoContabilCliente: grupoContabilCliente || 'Carteira Geral',
        uf: uf || 'SP',
        regimeTributario: regimeTributario || 'Lucro Real',
        statusConexaoSefaz: 'sem_certificado',
        totalDocumentosCapturados: 0,
        ultimaSincronizacao: 'Cadastrado agora'
      }
    });
  } catch (err: any) {
    console.error('❌ Erro ao cadastrar tenant:', err.message);
    res.status(500).json({ success: false, message: 'Erro ao cadastrar empresa: ' + err.message });
  }
});

// PUT /api/tenants/:id - Editar empresa
router.put('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { razaoSocial, nomeFantasia, uf, regimeTributario } = req.body;

    const db = getDatabase();
    const result = db.prepare(`
      UPDATE empresas
      SET razao_social = ?, nome_fantasia = ?, uf = ?, regime_tributario = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(razaoSocial.toUpperCase(), (nomeFantasia || razaoSocial).toUpperCase(), uf, regimeTributario, id);

    if (result.changes === 0) {
      res.status(404).json({ success: false, message: 'Empresa não encontrada.' });
      return;
    }

    logAuditAction(req, 'TENANT_EDITAR', `Empresa ${id} atualizada: ${razaoSocial}`);

    res.json({ success: true, message: 'Dados da empresa atualizados com sucesso.' });
  } catch (err: any) {
    console.error('❌ Erro ao atualizar tenant:', err.message);
    res.status(500).json({ success: false, message: 'Erro ao atualizar empresa.' });
  }
});

// DELETE /api/tenants/:id - Excluir empresa com limpeza de certificados físicos
router.delete('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const empresa = db.prepare('SELECT razao_social, cnpj_completo FROM empresas WHERE id = ?').get(id) as any;

    // Buscar certificados para limpeza física em disco
    const certs = db.prepare('SELECT arquivo_path_enc FROM certificados WHERE empresa_id = ?').all(id) as any[];
    for (const c of certs) {
      if (c.arquivo_path_enc && fs.existsSync(c.arquivo_path_enc)) {
        try { fs.unlinkSync(c.arquivo_path_enc); } catch {}
      }
    }

    const result = db.prepare('DELETE FROM empresas WHERE id = ?').run(id);

    if (result.changes === 0) {
      res.status(404).json({ success: false, message: 'Empresa não encontrada.' });
      return;
    }

    // Limpar vínculos
    db.prepare('DELETE FROM usuario_empresa WHERE empresa_id = ?').run(id);
    db.prepare('DELETE FROM certificados WHERE empresa_id = ?').run(id);

    logAuditAction(req, 'TENANT_EXCLUIR', `Empresa ${empresa?.razao_social} (${empresa?.cnpj_completo}) removida da carteira`);

    res.json({ success: true, message: 'Empresa removida da carteira com sucesso.' });
  } catch (err: any) {
    console.error('❌ Erro ao excluir tenant:', err.message);
    res.status(500).json({ success: false, message: 'Erro ao excluir empresa.' });
  }
});

export default router;
