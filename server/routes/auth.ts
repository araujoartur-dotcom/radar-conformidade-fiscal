/**
 * ============================================================
 * ROTAS DE AUTENTICAÇÃO — Login, Logout, Refresh, Trocar Empresa
 * ============================================================
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { AUTH } from '../config';
import { getDatabase } from '../db/database';
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

    const db = getDatabase();

    // Buscar usuário por email
    const user = db.prepare(`
      SELECT id, nome, email, senha_hash, perfil, mfa_habilitado, status, tentativas_falhas, bloqueado_ate
      FROM usuarios WHERE email = ?
    `).get(email.toLowerCase().trim()) as any;

    if (!user) {
      res.status(401).json({ error: 'E-mail ou senha incorretos.', code: 'AUTH_INVALID_CREDENTIALS' });
      return;
    }

    // Verificar bloqueio temporário (após 5 tentativas falhas)
    if (user.bloqueado_ate && new Date(user.bloqueado_ate) > new Date()) {
      res.status(423).json({
        error: `Conta bloqueada por excesso de tentativas. Tente novamente após ${user.bloqueado_ate}.`,
        code: 'AUTH_ACCOUNT_LOCKED'
      });
      return;
    }

    // Verificar status
    if (user.status === 'bloqueado') {
      res.status(403).json({ error: 'Conta bloqueada pelo administrador.', code: 'AUTH_USER_BLOCKED' });
      return;
    }

    // Comparar senha
    const senhaValida = bcrypt.compareSync(senha, user.senha_hash);
    if (!senhaValida) {
      // Incrementar tentativas
      const novasTentativas = (user.tentativas_falhas || 0) + 1;
      const bloqueioData = novasTentativas >= 5
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null;

      db.prepare(`
        UPDATE usuarios SET tentativas_falhas = ?, bloqueado_ate = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(novasTentativas, bloqueioData, user.id);

      res.status(401).json({
        error: 'E-mail ou senha incorretos.',
        code: 'AUTH_INVALID_CREDENTIALS',
        tentativasRestantes: Math.max(0, 5 - novasTentativas)
      });
      return;
    }

    // Resetar tentativas em caso de sucesso
    db.prepare(`
      UPDATE usuarios SET tentativas_falhas = 0, bloqueado_ate = NULL, 
      ultimo_acesso = datetime('now'), ip_ultimo_acesso = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(req.ip || '', user.id);

    // Buscar empresas vinculadas ao usuário
    const empresas = db.prepare(`
      SELECT e.id, e.cnpj_raiz, e.cnpj_completo, e.razao_social, e.nome_fantasia, e.uf, e.regime_tributario,
             ue.permissao, ue.modulos_permitidos
      FROM usuario_empresa ue
      JOIN empresas e ON e.id = ue.empresa_id
      WHERE ue.usuario_id = ? AND e.status = 'ativo'
    `).all(user.id) as any[];

    // Usar a primeira empresa como ativa por padrão
    const empresaAtiva = empresas[0];

    // Gerar tokens
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
    const refreshTokenHash = bcrypt.hashSync(refreshToken, 6);

    // Salvar sessão
    const sessaoId = uuid();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessoes (id, usuario_id, empresa_ativa_id, refresh_token_hash, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessaoId, user.id, empresaAtiva?.id || null, refreshTokenHash, req.ip || '', req.headers['user-agent'] || '', expiresAt);

    // Log de auditoria
    db.prepare(`
      INSERT INTO audit_log (nivel, servico, empresa_id, usuario_id, usuario_email, acao, descricao, ip_address)
      VALUES ('INFO', 'AUTH', ?, ?, ?, 'LOGIN', 'Login realizado com sucesso', ?)
    `).run(empresaAtiva?.id || null, user.id, user.email, req.ip || '');

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
    res.status(500).json({ error: 'Erro interno do servidor.', code: 'INTERNAL_ERROR' });
  }
});

// =========================================================
// POST /api/auth/refresh
// =========================================================
router.post('/refresh', (req: Request, res: Response) => {
  try {
    const { refreshToken, userId } = req.body;
    if (!refreshToken || !userId) {
      res.status(400).json({ error: 'refreshToken e userId são obrigatórios.' });
      return;
    }

    const db = getDatabase();

    // Buscar sessões ativas do usuário
    const sessoes = db.prepare(`
      SELECT s.*, e.cnpj_completo
      FROM sessoes s
      JOIN empresas e ON e.id = s.empresa_ativa_id
      WHERE s.usuario_id = ? AND s.revogada = 0 AND s.expires_at > datetime('now')
      ORDER BY s.created_at DESC
    `).all(userId) as any[];

    let sessaoValida = null;
    for (const sessao of sessoes) {
      if (bcrypt.compareSync(refreshToken, sessao.refresh_token_hash)) {
        sessaoValida = sessao;
        break;
      }
    }

    if (!sessaoValida) {
      res.status(401).json({ error: 'Refresh token inválido ou expirado.', code: 'AUTH_REFRESH_INVALID' });
      return;
    }

    // Buscar dados do usuário
    const user = db.prepare('SELECT id, email, perfil FROM usuarios WHERE id = ? AND status = ?').get(userId, 'ativo') as any;
    if (!user) {
      res.status(401).json({ error: 'Usuário não encontrado ou inativo.', code: 'AUTH_USER_NOT_FOUND' });
      return;
    }

    // Gerar novo access token
    const payload = {
      userId: user.id,
      email: user.email,
      perfil: user.perfil,
      empresaAtivaId: sessaoValida.empresa_ativa_id,
      empresaCnpj: sessaoValida.cnpj_completo,
    };

    const accessToken = jwt.sign(payload, AUTH.JWT_SECRET, {
      expiresIn: AUTH.JWT_EXPIRES_IN as any,
    });

    res.json({ accessToken, expiresIn: AUTH.JWT_EXPIRES_IN });
  } catch (err: any) {
    console.error('Erro no refresh:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// =========================================================
// POST /api/auth/switch-empresa — Trocar empresa ativa
// =========================================================
router.post('/switch-empresa', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { empresaId } = req.body;
    if (!empresaId) {
      res.status(400).json({ error: 'empresaId é obrigatório.' });
      return;
    }

    const db = getDatabase();

    // Verificar permissão
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

    // Gerar novo token com a empresa selecionada
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
router.post('/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    // Revogar todas as sessões do usuário
    db.prepare('UPDATE sessoes SET revogada = 1 WHERE usuario_id = ?').run(req.user!.userId);

    logAuditAction(req, 'LOGOUT', 'Logout realizado — todas as sessões revogadas');

    res.json({ message: 'Logout realizado com sucesso.' });
  } catch (err: any) {
    console.error('Erro no logout:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// =========================================================
// GET /api/auth/me — Dados do usuário logado
// =========================================================
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();

    const user = db.prepare(`
      SELECT id, nome, email, perfil, mfa_habilitado, mfa_metodo, status, ultimo_acesso, created_at
      FROM usuarios WHERE id = ?
    `).get(req.user!.userId) as any;

    const empresas = db.prepare(`
      SELECT e.id, e.cnpj_raiz, e.cnpj_completo, e.razao_social, e.nome_fantasia, e.uf, e.regime_tributario,
             ue.permissao, ue.modulos_permitidos
      FROM usuario_empresa ue
      JOIN empresas e ON e.id = ue.empresa_id
      WHERE ue.usuario_id = ? AND e.status = 'ativo'
    `).all(req.user!.userId) as any[];

    res.json({
      usuario: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil,
        mfaHabilitado: !!user.mfa_habilitado,
        mfaMetodo: user.mfa_metodo,
        status: user.status,
        ultimoAcesso: user.ultimo_acesso,
      },
      empresaAtivaId: req.user!.empresaAtivaId,
      empresas: empresas.map((e: any) => ({
        id: e.id,
        cnpjRaiz: e.cnpj_raiz,
        cnpjCompleto: e.cnpj_completo,
        razaoSocial: e.razao_social,
        nomeFantasia: e.nome_fantasia,
        uf: e.uf,
        regimeTributario: e.regime_tributario,
        permissao: e.permissao,
        modulosPermitidos: e.modulos_permitidos,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

export default router;
