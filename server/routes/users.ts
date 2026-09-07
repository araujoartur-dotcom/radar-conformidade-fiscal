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
    let formatted: any[] = [];

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          const { data: supaUsers, error: uErr } = await supabase
            .from('usuarios')
            .select('*')
            .order('created_at', { ascending: false });

          if (!uErr && supaUsers && supaUsers.length > 0) {
            const { data: supaVinculos } = await supabase
              .from('usuario_empresa')
              .select('usuario_id, empresa_id');

            const { data: supaEmpresas } = await supabase
              .from('empresas')
              .select('id, cnpj_completo, razao_social');

            const empMap = new Map((supaEmpresas || []).map(e => [e.id, e.cnpj_completo]));

            formatted = supaUsers.map(u => {
              const uVincs = (supaVinculos || []).filter(v => v.usuario_id === u.id);
              let cnpjsAutorizados: string[] = [];

              if (u.perfil === 'admin_master' && uVincs.length === 0) {
                cnpjsAutorizados = ['*'];
              } else if (uVincs.length > 0) {
                cnpjsAutorizados = uVincs.map(v => empMap.get(v.empresa_id) || v.empresa_id).filter(Boolean);
                if (supaEmpresas && supaEmpresas.length > 0 && cnpjsAutorizados.length === supaEmpresas.length && u.perfil === 'admin_master') {
                  cnpjsAutorizados = ['*'];
                }
              } else {
                cnpjsAutorizados = u.perfil === 'admin_master' ? ['*'] : [];
              }

              return {
                id: u.id,
                nome: u.nome,
                email: u.email,
                perfil: u.perfil,
                grupoContabil: 'Carteira Geral',
                cnpjsAutorizados,
                mfaHabilitado: Boolean(u.mfa_habilitado),
                status: u.status || 'ativo',
                ultimoAcesso: u.ultimo_acesso || 'Nunca',
                createdAt: u.created_at
              };
            });

            return res.json({ success: true, data: formatted });
          }
        } catch (supaErr: any) {
          console.warn('⚠️ Erro ao listar usuários do Supabase, tentando SQLite:', supaErr?.message);
        }
      }
    }

    // Fallback SQLite
    const users = db.prepare(`
      SELECT id, nome, email, perfil, mfa_habilitado, status, ultimo_acesso, created_at
      FROM usuarios 
      ORDER BY created_at DESC
    `).all() as any[];

    const vinculosStmt = db.prepare(`
      SELECT ue.usuario_id, e.cnpj_completo, e.razao_social
      FROM usuario_empresa ue
      JOIN empresas e ON e.id = ue.empresa_id
    `);
    const allVinculos = vinculosStmt.all() as any[];

    formatted = users.map((u: any) => {
      const userVinculos = allVinculos.filter((v: any) => v.usuario_id === u.id);
      let cnpjsAutorizados: string[] = [];
      if (userVinculos.length > 0) {
        cnpjsAutorizados = userVinculos.map((v: any) => v.cnpj_completo);
      } else if (u.perfil === 'admin_master') {
        cnpjsAutorizados = ['*'];
      }

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
    const cleanNome = nome.trim();
    const userPerfil = perfil || 'analista_fiscal';
    const rawSenha = senha || 'Mudar@123456';
    const senhaHash = bcrypt.hashSync(rawSenha, AUTH.BCRYPT_ROUNDS);
    const id = uuid();

    const isGlobal = !Array.isArray(cnpjsAutorizados) || cnpjsAutorizados.includes('*') || (cnpjsAutorizados.length === 0 && userPerfil === 'admin_master');

    // 1. Gravar no Supabase (se configurado)
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          const { data: existingSupa } = await supabase.from('usuarios').select('id').eq('email', cleanEmail).maybeSingle();
          if (existingSupa) {
            return res.status(409).json({ success: false, message: 'Já existe um usuário com este e-mail no Supabase.' });
          }

          const { error: insErr } = await supabase.from('usuarios').insert([{
            id,
            nome: cleanNome,
            email: cleanEmail,
            senha_hash: senhaHash,
            perfil: userPerfil,
            status: 'ativo'
          }]);
          if (insErr) throw insErr;

          const { data: supaEmpresas } = await supabase.from('empresas').select('id, cnpj_completo');
          const allEmpresas = supaEmpresas || [];

          let empIdsToLink: string[] = [];
          if (isGlobal) {
            empIdsToLink = allEmpresas.map(e => e.id);
          } else {
            for (const cnpj of cnpjsAutorizados) {
              const cleanCnpjDigits = String(cnpj).replace(/\D/g, '');
              const found = allEmpresas.find(e => 
                e.id === cnpj || 
                e.cnpj_completo === cnpj || 
                (e.cnpj_completo && e.cnpj_completo.replace(/\D/g, '') === cleanCnpjDigits)
              );
              if (found) empIdsToLink.push(found.id);
            }
          }

          if (empIdsToLink.length > 0) {
            const vinculosRows = empIdsToLink.map(empId => ({
              id: uuid(),
              usuario_id: id,
              empresa_id: empId,
              permissao: 'total',
              modulos_permitidos: '*'
            }));
            await supabase.from('usuario_empresa').insert(vinculosRows);
          }
        } catch (e: any) {
          console.warn('⚠️ Erro ao salvar usuário no Supabase:', e?.message);
        }
      }
    }

    // 2. Gravar no SQLite local
    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(cleanEmail);
    if (!existing) {
      db.transaction(() => {
        db.prepare(`
          INSERT INTO usuarios (id, nome, email, senha_hash, perfil, status)
          VALUES (?, ?, ?, ?, ?, 'ativo')
        `).run(id, cleanNome, cleanEmail, senhaHash, userPerfil);

        const todasEmpresas = db.prepare('SELECT id, cnpj_completo FROM empresas WHERE status = \'ativo\'').all() as any[];
        let empIdsToLink: string[] = [];

        if (isGlobal) {
          empIdsToLink = todasEmpresas.map(e => e.id);
        } else {
          for (const cnpj of cnpjsAutorizados) {
            const cleanCnpjDigits = String(cnpj).replace(/\D/g, '');
            const found = todasEmpresas.find(e => 
              e.id === cnpj || 
              e.cnpj_completo === cnpj || 
              (e.cnpj_completo && e.cnpj_completo.replace(/\D/g, '') === cleanCnpjDigits)
            );
            if (found) empIdsToLink.push(found.id);
          }
        }

        const insertVinculo = db.prepare(`
          INSERT OR IGNORE INTO usuario_empresa (id, usuario_id, empresa_id, permissao, modulos_permitidos)
          VALUES (?, ?, ?, 'total', '*')
        `);
        for (const empId of empIdsToLink) {
          insertVinculo.run(uuid(), id, empId);
        }
      })();
    }

    logAuditAction(req, 'USUARIO_CRIAR', `Usuário ${cleanEmail} criado com perfil ${userPerfil}`);

    return res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso.',
      data: {
        id,
        nome: cleanNome,
        email: cleanEmail,
        perfil: userPerfil,
        status: 'ativo',
        mfaHabilitado: false,
        cnpjsAutorizados: isGlobal ? ['*'] : cnpjsAutorizados,
        ultimoAcesso: 'Nunca'
      }
    });
  } catch (err: any) {
    console.error('❌ Erro ao cadastrar usuário:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao cadastrar usuário: ' + err.message });
  }
});

// PUT /api/users/:id - Editar usuário
router.put('/:id', requireAuth, requirePerfil('admin_master'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { nome, email, perfil, status, senha, cnpjsAutorizados } = req.body;
    const cleanEmail = email ? email.toLowerCase().trim() : undefined;
    const cleanNome = nome ? nome.trim() : undefined;

    const isGlobal = Array.isArray(cnpjsAutorizados) && cnpjsAutorizados.includes('*');

    // 1. Atualizar no Supabase (se configurado)
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          const updatePayload: any = { updated_at: new Date().toISOString() };
          if (cleanNome) updatePayload.nome = cleanNome;
          if (cleanEmail) updatePayload.email = cleanEmail;
          if (perfil) updatePayload.perfil = perfil;
          if (status) updatePayload.status = status;
          if (senha && senha.trim().length >= 6) {
            updatePayload.senha_hash = bcrypt.hashSync(senha, AUTH.BCRYPT_ROUNDS);
          }

          await supabase.from('usuarios').update(updatePayload).eq('id', id);

          if (Array.isArray(cnpjsAutorizados)) {
            await supabase.from('usuario_empresa').delete().eq('usuario_id', id);

            const { data: supaEmpresas } = await supabase.from('empresas').select('id, cnpj_completo');
            const allEmpresas = supaEmpresas || [];

            let empIdsToLink: string[] = [];
            if (isGlobal) {
              empIdsToLink = allEmpresas.map(e => e.id);
            } else {
              for (const cnpj of cnpjsAutorizados) {
                const cleanCnpjDigits = String(cnpj).replace(/\D/g, '');
                const found = allEmpresas.find(e => 
                  e.id === cnpj || 
                  e.cnpj_completo === cnpj || 
                  (e.cnpj_completo && e.cnpj_completo.replace(/\D/g, '') === cleanCnpjDigits)
                );
                if (found) empIdsToLink.push(found.id);
              }
            }

            if (empIdsToLink.length > 0) {
              const vinculosRows = empIdsToLink.map(empId => ({
                id: uuid(),
                usuario_id: id,
                empresa_id: empId,
                permissao: 'total',
                modulos_permitidos: '*'
              }));
              await supabase.from('usuario_empresa').insert(vinculosRows);
            }
          }
        } catch (supaErr: any) {
          console.warn('⚠️ Erro ao atualizar usuário no Supabase:', supaErr?.message);
        }
      }
    }

    // 2. Atualizar no SQLite local
    const db = getDatabase();
    db.transaction(() => {
      let updateSql = `
        UPDATE usuarios
        SET nome = COALESCE(?, nome),
            email = COALESCE(?, email),
            perfil = COALESCE(?, perfil),
            status = COALESCE(?, status),
            updated_at = datetime('now')
      `;
      const params: any[] = [cleanNome, cleanEmail, perfil, status];

      if (senha && senha.trim().length >= 6) {
        const novaSenhaHash = bcrypt.hashSync(senha, AUTH.BCRYPT_ROUNDS);
        updateSql += `, senha_hash = ?`;
        params.push(novaSenhaHash);
      }

      updateSql += ` WHERE id = ?`;
      params.push(id);

      db.prepare(updateSql).run(...params);

      if (Array.isArray(cnpjsAutorizados)) {
        db.prepare('DELETE FROM usuario_empresa WHERE usuario_id = ?').run(id);

        const todasEmpresas = db.prepare('SELECT id, cnpj_completo FROM empresas WHERE status = \'ativo\'').all() as any[];
        let empIdsToLink: string[] = [];

        if (isGlobal) {
          empIdsToLink = todasEmpresas.map(e => e.id);
        } else {
          for (const cnpj of cnpjsAutorizados) {
            const cleanCnpjDigits = String(cnpj).replace(/\D/g, '');
            const found = todasEmpresas.find(e => 
              e.id === cnpj || 
              e.cnpj_completo === cnpj || 
              (e.cnpj_completo && e.cnpj_completo.replace(/\D/g, '') === cleanCnpjDigits)
            );
            if (found) empIdsToLink.push(found.id);
          }
        }

        const insertVinculo = db.prepare(`
          INSERT OR IGNORE INTO usuario_empresa (id, usuario_id, empresa_id, permissao, modulos_permitidos)
          VALUES (?, ?, ?, 'total', '*')
        `);
        for (const empId of empIdsToLink) {
          insertVinculo.run(uuid(), id, empId);
        }
      }

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
router.delete('/:id', requireAuth, requirePerfil('admin_master'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user?.userId === id) {
      return res.status(400).json({ success: false, message: 'Você não pode excluir o seu próprio usuário logado.' });
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          await supabase.from('usuario_empresa').delete().eq('usuario_id', id);
          await supabase.from('usuarios').delete().eq('id', id);
        } catch (e: any) {
          console.warn('⚠️ Erro ao excluir usuário no Supabase:', e?.message);
        }
      }
    }

    const db = getDatabase();
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

