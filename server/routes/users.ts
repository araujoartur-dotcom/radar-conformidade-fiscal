import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { getDatabase } from '../db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';
import { AUTH } from '../config';
import { AuthenticatedRequest, requireAuth, requirePerfil, logAuditAction } from '../middleware/auth';

const router = Router();

// GET /api/users - Listar usuários corporativos com CNPJs autorizados
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();

    const users = db.prepare(`
      SELECT id, nome, email, perfil, mfa_habilitado, status, ultimo_acesso, created_at
      FROM usuarios 
      ORDER BY created_at DESC
    `).all() as any[];

    // Buscar vínculos de empresas para cada usuário
    const vinculosStmt = db.prepare(`
      SELECT ue.usuario_id, e.cnpj_completo, e.razao_social
      FROM usuario_empresa ue
      JOIN empresas e ON e.id = ue.empresa_id
    `);
    const allVinculos = vinculosStmt.all() as any[];

    const formatted = users.map((u: any) => {
      const userVinculos = allVinculos.filter((v: any) => v.usuario_id === u.id);
      const cnpjsAutorizados = userVinculos.length > 0 
        ? userVinculos.map((v: any) => v.cnpj_completo) 
        : ['*'];

      return {
        id: u.id,
        nome: u.nome,
        email: u.email,
        perfil: u.perfil,
        grupoContabil: 'Carteira Geral',
        cnpjsAutorizados,
        mfaHabilitado: Boolean(u.mfa_habilitado),
        status: u.status,
        ultimoAcesso: u.ultimo_acesso || 'Nunca',
        createdAt: u.created_at
      };
    });

    return res.json({ success: true, data: formatted });
  } catch (err: any) {
    console.error('❌ Erro ao listar usuários:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao listar usuários: ' + err.message });
  }
});

// POST /api/users - Criar novo usuário com hash seguro e vínculo de CNPJ
router.post('/', requireAuth, requirePerfil('admin_master'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { nome, email, perfil, senha, cnpjsAutorizados } = req.body;
    if (!nome || !email) {
      return res.status(400).json({ success: false, message: 'Nome e Email são obrigatórios.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = getDatabase();

    // Verificar duplicidade de e-mail
    const existing = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Já existe um usuário com este e-mail.' });
    }

    const id = uuid();
    const rawSenha = senha || 'Mudar@123456';
    const senhaHash = bcrypt.hashSync(rawSenha, AUTH.BCRYPT_ROUNDS);

    db.transaction(() => {
      // 1. Inserir usuário
      db.prepare(`
        INSERT INTO usuarios (id, nome, email, senha_hash, perfil, status)
        VALUES (?, ?, ?, ?, ?, 'ativo')
      `).run(id, nome.trim(), cleanEmail, senhaHash, perfil || 'analista_fiscal');

      // 2. Vincular empresas autorizadas
      if (Array.isArray(cnpjsAutorizados) && cnpjsAutorizados.length > 0 && !cnpjsAutorizados.includes('*')) {
        const insertVinculo = db.prepare(`
          INSERT OR IGNORE INTO usuario_empresa (id, usuario_id, empresa_id, permissao, modulos_permitidos)
          VALUES (?, ?, ?, 'total', '*')
        `);

        for (const cnpj of cnpjsAutorizados) {
          const emp = db.prepare('SELECT id FROM empresas WHERE cnpj_completo = ?').get(cnpj) as any;
          if (emp) {
            insertVinculo.run(uuid(), id, emp.id);
          }
        }
      } else {
        // Vínculo global com todas as empresas cadastradas
        const todasEmpresas = db.prepare('SELECT id FROM empresas WHERE status = \'ativo\'').all() as any[];
        const insertVinculo = db.prepare(`
          INSERT OR IGNORE INTO usuario_empresa (id, usuario_id, empresa_id, permissao, modulos_permitidos)
          VALUES (?, ?, ?, 'total', '*')
        `);
        for (const emp of todasEmpresas) {
          insertVinculo.run(uuid(), id, emp.id);
        }
      }
    })();

    logAuditAction(req, 'USUARIO_CRIAR', `Usuário ${cleanEmail} criado com perfil ${perfil || 'analista_fiscal'}`);

    return res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso.',
      data: {
        id,
        nome: nome.trim(),
        email: cleanEmail,
        perfil: perfil || 'analista_fiscal',
        status: 'ativo',
        mfaHabilitado: false,
        cnpjsAutorizados: cnpjsAutorizados || ['*'],
        ultimoAcesso: 'Nunca'
      }
    });
  } catch (err: any) {
    console.error('❌ Erro ao cadastrar usuário:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao cadastrar usuário: ' + err.message });
  }
});

// PUT /api/users/:id - Editar usuário
router.put('/:id', requireAuth, requirePerfil('admin_master'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { nome, email, perfil, status, senha, cnpjsAutorizados } = req.body;

    const db = getDatabase();
    const cleanEmail = email ? email.toLowerCase().trim() : undefined;

    db.transaction(() => {
      // 1. Atualizar campos básicos
      let updateSql = `
        UPDATE usuarios
        SET nome = COALESCE(?, nome),
            email = COALESCE(?, email),
            perfil = COALESCE(?, perfil),
            status = COALESCE(?, status),
            updated_at = datetime('now')
      `;
      const params: any[] = [nome, cleanEmail, perfil, status];

      if (senha && senha.trim().length >= 6) {
        const novaSenhaHash = bcrypt.hashSync(senha, AUTH.BCRYPT_ROUNDS);
        updateSql += `, senha_hash = ?`;
        params.push(novaSenhaHash);
      }

      updateSql += ` WHERE id = ?`;
      params.push(id);

      const result = db.prepare(updateSql).run(...params);
      if (result.changes === 0) {
        throw new Error('USER_NOT_FOUND');
      }

      // 2. Atualizar vínculos de empresas se informado
      if (Array.isArray(cnpjsAutorizados)) {
        db.prepare('DELETE FROM usuario_empresa WHERE usuario_id = ?').run(id);

        if (cnpjsAutorizados.includes('*')) {
          const todasEmpresas = db.prepare('SELECT id FROM empresas WHERE status = \'ativo\'').all() as any[];
          const insertVinculo = db.prepare(`
            INSERT OR IGNORE INTO usuario_empresa (id, usuario_id, empresa_id, permissao, modulos_permitidos)
            VALUES (?, ?, ?, 'total', '*')
          `);
          for (const emp of todasEmpresas) {
            insertVinculo.run(uuid(), id, emp.id);
          }
        } else {
          const insertVinculo = db.prepare(`
            INSERT OR IGNORE INTO usuario_empresa (id, usuario_id, empresa_id, permissao, modulos_permitidos)
            VALUES (?, ?, ?, 'total', '*')
          `);
          for (const cnpj of cnpjsAutorizados) {
            const emp = db.prepare('SELECT id FROM empresas WHERE cnpj_completo = ?').get(cnpj) as any;
            if (emp) {
              insertVinculo.run(uuid(), id, emp.id);
            }
          }
        }
      }

      // Se usuário for bloqueado, revogar sessões ativas
      if (status === 'bloqueado') {
        db.prepare('UPDATE sessoes SET revogada = 1 WHERE usuario_id = ?').run(id);
      }
    })();

    logAuditAction(req, 'USUARIO_EDITAR', `Usuário ${id} atualizado`);

    return res.json({ success: true, message: 'Usuário atualizado com sucesso.' });
  } catch (err: any) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }
    console.error('❌ Erro ao atualizar usuário:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao atualizar usuário: ' + err.message });
  }
});

// DELETE /api/users/:id - Excluir usuário
router.delete('/:id', requireAuth, requirePerfil('admin_master'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Impedir que o usuário delete a si mesmo
    if (req.user?.userId === id) {
      return res.status(400).json({ success: false, message: 'Você não pode excluir o seu próprio usuário logado.' });
    }

    db.transaction(() => {
      db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(id);
      db.prepare('DELETE FROM usuario_empresa WHERE usuario_id = ?').run(id);
      const result = db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);

      if (result.changes === 0) {
        throw new Error('USER_NOT_FOUND');
      }
    })();

    logAuditAction(req, 'USUARIO_EXCLUIR', `Usuário ${id} removido do sistema`, 'WARN');

    return res.json({ success: true, message: 'Usuário removido com sucesso.' });
  } catch (err: any) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }
    console.error('❌ Erro ao excluir usuário:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao excluir usuário: ' + err.message });
  }
});

export default router;
