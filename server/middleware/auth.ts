/**
 * ============================================================
 * MIDDLEWARE DE AUTENTICAÇÃO JWT + CONTROLE MULTI-TENANT & RBAC
 * ============================================================
 * Verifica token JWT em cada requisição, identifica o usuário,
 * valida o escopo da empresa ativa e assegura o isolamento de dados.
 * ============================================================
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AUTH } from '../config';
import { getDatabase } from '../db/database';
import { isSupabaseConfigured } from '../db/supabase';
import { getBrasiliaTimestamp } from '../utils/timezone';

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
 * Middleware obrigatório — validação de autenticação JWT
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
 * Middleware para validar perfis específicos (RBAC)
 */
export function requirePerfil(...perfisPermitidos: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado.', code: 'AUTH_REQUIRED' });
      return;
    }

    // admin_master tem acesso a todas as rotas
    if (req.user.perfil === 'admin_master') {
      next();
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
 * Retorna os IDs das empresas acessíveis pelo usuário logado.
 * Retorna `null` para `admin_master` (acesso irrestrito a todos os tenants).
 */
export function getAccessibleEmpresaIds(req: AuthenticatedRequest): string[] | null {
  if (!req.user) return [];
  if (req.user.perfil === 'admin_master') return null; // Acesso total

  const db = getDatabase();
  const rows = db.prepare(`
    SELECT empresa_id FROM usuario_empresa WHERE usuario_id = ?
  `).all(req.user.userId) as any[];

  const ids = rows.map(r => r.empresa_id);
  if (req.user.empresaAtivaId && !ids.includes(req.user.empresaAtivaId)) {
    ids.push(req.user.empresaAtivaId);
  }

  return ids;
}

/**
 * Verifica se a requisição tem permissão para acessar a empresa especificada
 */
export function hasTenantAccess(req: AuthenticatedRequest, empresaId: string): boolean {
  if (!req.user) return false;
  if (req.user.perfil === 'admin_master') return true;
  if (req.user.empresaAtivaId === empresaId) return true;

  const accessible = getAccessibleEmpresaIds(req);
  if (!accessible) return true;
  return accessible.includes(empresaId);
}

/**
 * Registra ação no log de auditoria com carimbo em Horário Oficial de Brasília
 */
export function logAuditAction(
  req: AuthenticatedRequest,
  acao: string,
  descricao: string,
  nivel: string = 'INFO',
  dadosExtras: Record<string, any> = {}
): void {
  try {
    const db = getDatabase();
    const timestamp = getBrasiliaTimestamp();

    db.prepare(`
      INSERT INTO audit_log (timestamp, nivel, servico, empresa_id, usuario_id, usuario_email, acao, descricao, ip_address, dados_extras)
      VALUES (?, ?, 'API', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      timestamp,
      nivel,
      req.user?.empresaAtivaId || '',
      req.user?.userId || '',
      req.user?.email || '',
      acao,
      descricao,
      req.ip || req.socket.remoteAddress || '',
      JSON.stringify(dadosExtras)
    );
  } catch (err) {
    // Erro em log de auditoria não deve quebrar o fluxo da requisição
  }
}
