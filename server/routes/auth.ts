/**
 * ============================================================
 * ROTAS DE AUTENTICAÇÃO — Login, Logout, Refresh, Trocar Empresa
 * ============================================================
 * Suporta Supabase (PostgreSQL Cloud) e SQLite local.
 * ============================================================
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { AUTH } from '../config';
import { getDatabase } from '../db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';
import { AuthenticatedRequest, requireAuth, logAuditAction } from '../middleware/auth';

const router = Router();

// =========================================================
// POST /api/auth/login
// =========================================================
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();

    // ── 1. SUPABASE CLOUD (Se configurado) ──────────────────
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: user, error: uErr } = await supabase
          .from('usuarios')
          .select('*')
          .eq('email', cleanEmail)
          .single();

        if (uErr || !user) {
          res.status(401).json({ error: 'E-mail ou senha incorretos.', code: 'AUTH_INVALID_CREDENTIALS' });
          return;
        }

        if (user.status === 'bloqueado') {
          res.status(403).json({ error: 'Conta bloqueada pelo administrador.', code: 'AUTH_USER_BLOCKED' });
          return;
        }

        const senhaValida = bcrypt.compareSync(senha, user.senha_hash);
        if (!senhaValida) {
          res.status(401).json({ error: 'E-mail ou senha incorretos.', code: 'AUTH_INVALID_CREDENTIALS' });
          return;
        }

        // Atualizar último acesso
        await supabase
          .from('usuarios')
          .update({ ultimo_acesso: new Date().toISOString(), ip_ultimo_acesso: req.ip || '' })
          .eq('id', user.id);

        // Buscar empresas vinculadas
        const { data: vinculos } = await supabase
          .from('usuario_empresa')
          .select('permissao, modulos_permitidos, empresa_id')
          .eq('usuario_id', user.id);

        let empresas: any[] = [];
        if (vinculos && vinculos.length > 0) {
          const empIds = vinculos.map(v => v.empresa_id);
          const { data: empData } = await supabase
            .from('empresas')
            .select('*')
            .in('id', empIds)
            .eq('status', 'ativo');
          
          empresas = (empData || []).map(e => {
            const v = vinculos.find(vinc => vinc.empresa_id === e.id);
            return {
              ...e,
              permissao: v?.permissao || 'total',
              modulos_permitidos: v?.modulos_permitidos || '*'
            };
          });
        }

        // Se o admin não tiver empresas vinculadas, buscar todas ativas
        if (empresas.length === 0 && user.perfil === 'admin_master') {
          const { data: allEmp } = await supabase
            .from('empresas')
            .select('*')
            .eq('status', 'ativo');
          empresas = (allEmp || []).map(e => ({ ...e, permissao: 'total', modulos_permitidos: '*' }));
        }

        const empresaAtiva = empresas[0] || null;

        const payload = {
          userId: user.id,
          email: user.email,
          perfil: user.perfil,
          empresaAtivaId: empresaAtiva?.id || null,
          empresaCnpj: empresaAtiva?.cnpj_completo || null,
        };

        const accessToken = jwt.sign(payload, AUTH.JWT_SECRET, {
          expiresIn: AUTH.JWT_EXPIRES_IN as any,
        });

        const refreshToken = uuid();

        res.json({
          accessToken,
          refreshToken,
          expiresIn: AUTH.JWT_EXPIRES_IN,
          usuario: {
            id: user.id,
            nome: user.nome,
            email: user.email,
            perfil: user.perfil,
            mfaHabilitado: Boolean(user.mfa_habilitado),
          },
          empresaAtiva: empresaAtiva ? {
            id: empresaAtiva.id,
            cnpjRaiz: empresaAtiva.cnpj_raiz,
            cnpjCompleto: empresaAtiva.cnpj_completo,
            razaoSocial: empresaAtiva.razao_social,
            nomeFantasia: empresaAtiva.nome_fantasia || empresaAtiva.razao_social,
            uf: empresaAtiva.uf,
            regimeTributario: empresaAtiva.regime_tributario,
            permissao: empresaAtiva.permissao,
            modulosPermitidos: empresaAtiva.modulos_permitidos,
          } : null,
          empresasDisponiveis: empresas.map((e: any) => ({
            id: e.id,
            cnpjCompleto: e.cnpj_completo,
            razaoSocial: e.razao_social,
            uf: e.uf,
          })),
        });
        return;
      }
    }

    // ── 2. SQLITE LOCAL FALLBACK ────────────────────────────
    const db = getDatabase();

    const user = db.prepare(`
      SELECT id, nome, email, senha_hash, perfil, mfa_habilitado, status, tentativas_falhas, bloqueado_ate
      FROM usuarios WHERE email = ?
    `).get(cleanEmail) as any;

    if (!user) {
      res.status(401).json({ error: 'E-mail ou senha incorretos.', code: 'AUTH_INVALID_CREDENTIALS' });
      return;
    }

    if (user.status === 'bloqueado') {
      res.status(403).json({ error: 'Conta bloqueada pelo administrador.', code: 'AUTH_USER_BLOCKED' });
      return;
    }

    const senhaValida = bcrypt.compareSync(senha, user.senha_hash);
    if (!senhaValida) {
      res.status(401).json({
        error: 'E-mail ou senha incorretos.',
        code: 'AUTH_INVALID_CREDENTIALS',
      });
      return;
    }

    db.prepare(`
      UPDATE usuarios SET tentativas_falhas = 0, bloqueado_ate = NULL, 
      ultimo_acesso = datetime('now'), ip_ultimo_acesso = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(req.ip || '', user.id);

    const empresas = db.prepare(`
      SELECT e.id, e.cnpj_raiz, e.cnpj_completo, e.razao_social, e.nome_fantasia, e.uf, e.regime_tributario,
             ue.permissao, ue.modulos_permitidos
      FROM usuario_empresa ue
      JOIN empresas e ON e.id = ue.empresa_id
      WHERE ue.usuario_id = ? AND e.status = 'ativo'
    `).all(user.id) as any[];

    const empresaAtiva = empresas[0];

    const payload = {
      userId: user.id,
      email: user.email,
      perfil: user.perfil,
      empresaAtivaId: empresaAtiva?.id || null,
      empresaCnpj: empresaAtiva?.cnpj_completo || null,
    };

    const accessToken = jwt.sign(payload, AUTH.JWT_SECRET, {
      expiresIn: AUTH.JWT_EXPIRES_IN as any,
    });

    const refreshToken = uuid();

    res.json({
      accessToken,
      refreshToken,
      expiresIn: AUTH.JWT_EXPIRES_IN,
      usuario: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil,
        mfaHabilitado: !!user.mfa_habilitado,
      },
      empresaAtiva: empresaAtiva ? {
        id: empresaAtiva.id,
        cnpjRaiz: empresaAtiva.cnpj_raiz,
        cnpjCompleto: empresaAtiva.cnpj_completo,
        razaoSocial: empresaAtiva.razao_social,
        nomeFantasia: empresaAtiva.nome_fantasia,
        uf: empresaAtiva.uf,
        regimeTributario: empresaAtiva.regime_tributario,
        permissao: empresaAtiva.permissao,
        modulosPermitidos: empresaAtiva.modulos_permitidos,
      } : null,
      empresasDisponiveis: empresas.map((e: any) => ({
        id: e.id,
        cnpjCompleto: e.cnpj_completo,
        razaoSocial: e.razao_social,
        uf: e.uf,
      })),
    });
  } catch (err: any) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno do servidor: ' + err.message, code: 'INTERNAL_ERROR' });
  }
});

// =========================================================
// GET /api/auth/me — Obter dados do usuário logado
// =========================================================
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: user } = await supabase
          .from('usuarios')
          .select('id, nome, email, perfil, mfa_habilitado, status, ultimo_acesso')
          .eq('id', userId)
          .single();

        if (!user) {
          res.status(404).json({ error: 'Usuário não encontrado.' });
          return;
        }

        res.json({
          usuario: {
            id: user.id,
            nome: user.nome,
            email: user.email,
            perfil: user.perfil,
            mfaHabilitado: Boolean(user.mfa_habilitado),
            status: user.status,
            ultimoAcesso: user.ultimo_acesso,
          },
          empresaAtiva: req.user!.empresaAtivaId ? {
            id: req.user!.empresaAtivaId,
            cnpjCompleto: req.user!.empresaCnpj,
          } : null,
        });
        return;
      }
    }

    const db = getDatabase();
    const user = db.prepare(`
      SELECT id, nome, email, perfil, mfa_habilitado, status, ultimo_acesso
      FROM usuarios WHERE id = ?
    `).get(userId) as any;

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    res.json({
      usuario: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil,
        mfaHabilitado: !!user.mfa_habilitado,
        status: user.status,
        ultimoAcesso: user.ultimo_acesso,
      },
      empresaAtiva: req.user!.empresaAtivaId ? {
        id: req.user!.empresaAtivaId,
        cnpjCompleto: req.user!.empresaCnpj,
      } : null,
    });
  } catch (err: any) {
    console.error('Erro ao buscar dados do usuário:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// =========================================================
// POST /api/auth/switch-empresa — Trocar empresa ativa
// =========================================================
router.post('/switch-empresa', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { empresaId } = req.body;
    if (!empresaId) {
      res.status(400).json({ error: 'empresaId é obrigatório.' });
      return;
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: empresa } = await supabase
          .from('empresas')
          .select('*')
          .eq('id', empresaId)
          .eq('status', 'ativo')
          .single();

        if (!empresa) {
          res.status(403).json({ error: 'Sem acesso a esta empresa.', code: 'AUTH_NO_TENANT_ACCESS' });
          return;
        }

        const payload = {
          userId: req.user!.userId,
          email: req.user!.email,
          perfil: req.user!.perfil,
          empresaAtivaId: empresaId,
          empresaCnpj: empresa.cnpj_completo,
        };

        const accessToken = jwt.sign(payload, AUTH.JWT_SECRET, {
          expiresIn: AUTH.JWT_EXPIRES_IN as any,
        });

        res.json({
          accessToken,
          empresaAtiva: {
            id: empresa.id,
            cnpjRaiz: empresa.cnpj_raiz,
            cnpjCompleto: empresa.cnpj_completo,
            razaoSocial: empresa.razao_social,
            nomeFantasia: empresa.nome_fantasia || empresa.razao_social,
            uf: empresa.uf,
            regimeTributario: empresa.regime_tributario,
            permissao: 'total',
            modulosPermitidos: '*',
          },
        });
        return;
      }
    }

    const db = getDatabase();
    const vinculo = db.prepare(`
      SELECT ue.permissao, ue.modulos_permitidos, e.*
      FROM usuario_empresa ue
      JOIN empresas e ON e.id = ue.empresa_id
      WHERE ue.usuario_id = ? AND ue.empresa_id = ? AND e.status = 'ativo'
    `).get(req.user!.userId, empresaId) as any;

    if (!vinculo) {
      res.status(403).json({ error: 'Sem acesso a esta empresa.', code: 'AUTH_NO_TENANT_ACCESS' });
      return;
    }

    const payload = {
      userId: req.user!.userId,
      email: req.user!.email,
      perfil: req.user!.perfil,
      empresaAtivaId: empresaId,
      empresaCnpj: vinculo.cnpj_completo,
    };

    const accessToken = jwt.sign(payload, AUTH.JWT_SECRET, {
      expiresIn: AUTH.JWT_EXPIRES_IN as any,
    });

    logAuditAction(req, 'SWITCH_EMPRESA', `Empresa ativa alterada para ${vinculo.razao_social} (${vinculo.cnpj_completo})`);

    res.json({
      accessToken,
      empresaAtiva: {
        id: vinculo.id,
        cnpjRaiz: vinculo.cnpj_raiz,
        cnpjCompleto: vinculo.cnpj_completo,
        razaoSocial: vinculo.razao_social,
        nomeFantasia: vinculo.nome_fantasia,
        uf: vinculo.uf,
        regimeTributario: vinculo.regime_tributario,
        permissao: vinculo.permissao,
        modulosPermitidos: vinculo.modulos_permitidos,
      },
    });
  } catch (err: any) {
    console.error('Erro ao trocar empresa:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// =========================================================
// POST /api/auth/logout
// =========================================================
router.post('/logout', (req: Request, res: Response) => {
  res.json({ message: 'Logout realizado com sucesso.' });
});

export default router;
