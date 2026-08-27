/**
 * ============================================================
 * ROTAS DE AUTENTICAÇÃO — Login, Logout, Refresh, Trocar Empresa
 * ============================================================
 * Suporta Supabase (PostgreSQL Cloud) e SQLite local com
 * persistência robusta de escopo de CNPJ e Horário de Brasília.
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
import { getBrasiliaTimestamp } from '../utils/timezone';

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
    const brasiliaNow = getBrasiliaTimestamp();

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

        // Se for admin_master, carregar todas as empresas ativas
        if (user.perfil === 'admin_master') {
          const { data: allEmp } = await supabase
            .from('empresas')
            .select('*')
            .eq('status', 'ativo');
          empresas = (allEmp || []).map(e => ({ ...e, permissao: 'total', modulos_permitidos: '*' }));
        }

        // Selecionar empresa ativa persistida ou a primeira
        let empresaAtiva = empresas.find(e => e.id === user.empresa_ativa_id) || empresas[0] || null;

        // Atualizar último acesso e empresa ativa
        await supabase
          .from('usuarios')
          .update({
            ultimo_acesso: brasiliaNow,
            ip_ultimo_acesso: req.ip || '',
            empresa_ativa_id: empresaAtiva?.id || null,
          })
          .eq('id', user.id);

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
      SELECT id, nome, email, senha_hash, perfil, mfa_habilitado, status, empresa_ativa_id, tentativas_falhas, bloqueado_ate
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

    // Carregar empresas disponíveis para este usuário
    let empresas: any[] = [];
    if (user.perfil === 'admin_master') {
      empresas = db.prepare(`
        SELECT id, cnpj_raiz, cnpj_completo, razao_social, nome_fantasia, uf, regime_tributario,
               'total' as permissao, '*' as modulos_permitidos
        FROM empresas WHERE status = 'ativo'
        ORDER BY razao_social ASC
      `).all() as any[];
    } else {
      empresas = db.prepare(`
        SELECT e.id, e.cnpj_raiz, e.cnpj_completo, e.razao_social, e.nome_fantasia, e.uf, e.regime_tributario,
               ue.permissao, ue.modulos_permitidos
        FROM usuario_empresa ue
        JOIN empresas e ON e.id = ue.empresa_id
        WHERE ue.usuario_id = ? AND e.status = 'ativo'
        ORDER BY e.razao_social ASC
      `).all(user.id) as any[];
    }

    // Priorizar a empresa ativa salva no cadastro do usuário
    let empresaAtiva = empresas.find(e => e.id === user.empresa_ativa_id) || empresas[0] || null;

    // Atualizar último acesso e empresa_ativa_id
    db.prepare(`
      UPDATE usuarios 
      SET tentativas_falhas = 0, bloqueado_ate = NULL, 
          ultimo_acesso = ?, ip_ultimo_acesso = ?, empresa_ativa_id = ?, updated_at = ?
      WHERE id = ?
    `).run(brasiliaNow, req.ip || '', empresaAtiva?.id || null, brasiliaNow, user.id);

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
  } catch (err: any) {
    console.error('❌ Erro no login:', err);
    res.status(500).json({ error: 'Erro interno do servidor: ' + err.message, code: 'INTERNAL_ERROR' });
  }
});

// =========================================================
// GET /api/auth/me — Obter dados do usuário logado e contexto
// =========================================================
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const db = getDatabase();

    const user = db.prepare(`
      SELECT id, nome, email, perfil, mfa_habilitado, status, empresa_ativa_id, ultimo_acesso
      FROM usuarios WHERE id = ?
    `).get(userId) as any;

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    let empresas: any[] = [];
    if (user.perfil === 'admin_master') {
      empresas = db.prepare(`
        SELECT id, cnpj_raiz, cnpj_completo, razao_social, nome_fantasia, uf, regime_tributario,
               'total' as permissao, '*' as modulos_permitidos
        FROM empresas WHERE status = 'ativo'
        ORDER BY razao_social ASC
      `).all() as any[];
    } else {
      empresas = db.prepare(`
        SELECT e.id, e.cnpj_raiz, e.cnpj_completo, e.razao_social, e.nome_fantasia, e.uf, e.regime_tributario,
               ue.permissao, ue.modulos_permitidos
        FROM usuario_empresa ue
        JOIN empresas e ON e.id = ue.empresa_id
        WHERE ue.usuario_id = ? AND e.status = 'ativo'
        ORDER BY e.razao_social ASC
      `).all(user.id) as any[];
    }

    const activeId = req.user!.empresaAtivaId || user.empresa_ativa_id;
    const empresaAtiva = empresas.find(e => e.id === activeId) || empresas[0] || null;

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
  } catch (err: any) {
    console.error('❌ Erro ao buscar dados do usuário:', err);
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

    const db = getDatabase();
    const isSuperadmin = req.user!.perfil === 'admin_master';
    let empresa: any = null;

    if (isSuperadmin) {
      empresa = db.prepare(`
        SELECT id, cnpj_raiz, cnpj_completo, razao_social, nome_fantasia, uf, regime_tributario
        FROM empresas WHERE id = ? AND status = 'ativo'
      `).get(empresaId);
      if (empresa) {
        empresa.permissao = 'total';
        empresa.modulos_permitidos = '*';
      }
    } else {
      empresa = db.prepare(`
        SELECT ue.permissao, ue.modulos_permitidos, e.*
        FROM usuario_empresa ue
        JOIN empresas e ON e.id = ue.empresa_id
        WHERE ue.usuario_id = ? AND ue.empresa_id = ? AND e.status = 'ativo'
      `).get(req.user!.userId, empresaId) as any;
    }

    if (!empresa) {
      res.status(403).json({ error: 'Acesso negado para esta empresa.', code: 'AUTH_NO_TENANT_ACCESS' });
      return;
    }

    // Persistir empresa_ativa_id no cadastro do usuário
    const brasiliaNow = getBrasiliaTimestamp();
    db.prepare('UPDATE usuarios SET empresa_ativa_id = ?, updated_at = ? WHERE id = ?')
      .run(empresa.id, brasiliaNow, req.user!.userId);

    const payload = {
      userId: req.user!.userId,
      email: req.user!.email,
      perfil: req.user!.perfil,
      empresaAtivaId: empresa.id,
      empresaCnpj: empresa.cnpj_completo,
    };

    const accessToken = jwt.sign(payload, AUTH.JWT_SECRET, {
      expiresIn: AUTH.JWT_EXPIRES_IN as any,
    });

    logAuditAction(req, 'SWITCH_EMPRESA', `Empresa ativa alterada para ${empresa.razao_social} (${empresa.cnpj_completo})`);

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
        permissao: empresa.permissao,
        modulosPermitidos: empresa.modulos_permitidos,
      },
    });
  } catch (err: any) {
    console.error('❌ Erro ao trocar empresa:', err);
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
