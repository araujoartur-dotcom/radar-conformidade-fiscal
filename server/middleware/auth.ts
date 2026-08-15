/**
 * ============================================================
 * MIDDLEWARE DE AUTENTICAÇÃO JWT + CONTROLE MULTI-TENANT
 * ============================================================
 * Verifica token JWT em cada requisição, identifica o usuário
 * e a empresa ativa, e injeta no req para uso nas rotas.
 * ============================================================
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AUTH } from '../config';
import { getDatabase } from '../db/database';
import { isSupabaseConfigured } from '../db/supabase';

export interface JwtPayload {
  userId: string;
  email: string;
  perfil: string;
  empresaAtivaId: string;
  empresaCnpj: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * Middleware obrigatório — rejeita se não autenticado
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Token de acesso não fornecido.',
      code: 'AUTH_MISSING_TOKEN'
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, AUTH.JWT_SECRET) as JwtPayload;

    if (!decoded || !decoded.userId) {
      res.status(401).json({ error: 'Token inválido.', code: 'AUTH_INVALID_TOKEN' });
      return;
    }

    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token de acesso expirado.', code: 'AUTH_TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ error: 'Token inválido ou assinatura incorreta.', code: 'AUTH_INVALID_TOKEN' });
  }
}

/**
 * Middleware para validar perfis específicos
 */
export function requirePerfil(...perfisPermitidos: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado.', code: 'AUTH_REQUIRED' });
      return;
    }

    if (!perfisPermitidos.includes(req.user.perfil)) {
      res.status(403).json({
        error: `Perfil "${req.user.perfil}" não tem permissão para esta ação. Perfis aceitos: ${perfisPermitidos.join(', ')}`,
        code: 'AUTH_INSUFFICIENT_ROLE'
      });
      return;
    }

    next();
  };
}

/**
 * Registra ação no log de auditoria
 */
export function logAuditAction(
  req: AuthenticatedRequest,
  acao: string,
  descricao: string,
  nivel: string = 'INFO',
  dadosExtras: Record<string, any> = {}
): void {
  try {
    if (!isSupabaseConfigured()) {
      const db = getDatabase();
      db.prepare(`
        INSERT INTO audit_log (nivel, servico, empresa_id, usuario_id, usuario_email, acao, descricao, ip_address, dados_extras)
        VALUES (?, 'API', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        nivel,
        req.user?.empresaAtivaId || '',
        req.user?.userId || '',
        req.user?.email || '',
        acao,
        descricao,
        req.ip || req.socket.remoteAddress || '',
        JSON.stringify(dadosExtras)
      );
    }
  } catch (err) {
    // Audit logging failure should not break request flow
  }
}
