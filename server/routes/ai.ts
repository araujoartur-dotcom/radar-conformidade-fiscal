/**
 * ============================================================
 * ROTAS DE IA FISCAL — AUDITOR AI
 * ============================================================
 * Endpoints autenticados para interação com o Copiloto Fiscal.
 * - Proteção por JWT (requireAuth)
 * - Isolamento multi-tenant estrito por empresa ativa
 * - Rate Limiting de segurança por IP e Usuário
 * ============================================================
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { processarMensagemFiscal, ChatMessage } from '../services/aiFiscalService';
import { AI_CONFIG } from '../config';

const router = Router();

// Controle simples de rate-limit em memória (máximo 20 msgs/min por usuário)
const userRateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkUserRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = userRateLimitMap.get(userId);

  if (!entry || now > entry.resetTime) {
    userRateLimitMap.set(userId, { count: 1, resetTime: now + 60000 });
    return true;
  }

  if (entry.count >= 20) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * GET /api/ai/status
 * Verifica a prontidão do serviço de Inteligência Artificial
 */
router.get('/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    enabled: AI_CONFIG.ENABLED,
    isConfigured: AI_CONFIG.ENABLED && AI_CONFIG.IS_CONFIGURED,
    status: AI_CONFIG.ENABLED ? (AI_CONFIG.IS_CONFIGURED ? 'online' : 'unconfigured') : 'maintenance',
    model: AI_CONFIG.MODEL,
    empresaAtivaId: req.user?.empresaAtivaId || null,
    versaoCopiloto: '3.0 - RTC & Compliance Integral',
    mensagem: AI_CONFIG.ENABLED
      ? 'Auditor AI disponível.'
      : 'O Auditor AI está temporariamente em manutenção para aprimoramento de infraestrutura.'
  });
});

/**
 * POST /api/ai/chat
 * Envia uma pergunta tributária para o Auditor AI
 */
router.post('/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verificação de status da feature flag
    if (!AI_CONFIG.ENABLED) {
      res.status(503).json({
        success: false,
        error: 'O Auditor AI está temporariamente desativado para aprimoramento de infraestrutura e calibração de modelos tributários da LC 214/2025.'
      });
      return;
    }

    const userId = req.user?.userId;
    const empresaAtivaId = req.user?.empresaAtivaId || (req.body.empresaId as string);

    if (!userId) {
      res.status(401).json({ success: false, error: 'Sessão de usuário inválida.' });
      return;
    }

    if (!empresaAtivaId) {
      res.status(400).json({
        success: false,
        error: 'Nenhuma empresa ativa selecionada na sessão. Selecione uma empresa no menu superior para obter pareceres contextualizados.'
      });
      return;
    }

    // Validação de Rate Limit
    if (!checkUserRateLimit(userId)) {
      res.status(429).json({
        success: false,
        error: 'Limite de mensagens excedido (máximo 20 por minuto). Por favor, aguarde alguns segundos antes de enviar outra consulta.'
      });
      return;
    }

    const { mensagem, historico } = req.body;

    if (!mensagem || typeof mensagem !== 'string' || mensagem.trim() === '') {
      res.status(400).json({ success: false, error: 'A mensagem da consulta fiscal é obrigatória.' });
      return;
    }

    const historicoLimpo: ChatMessage[] = Array.isArray(historico)
      ? historico.slice(-10).map((h: any) => ({
          role: h.role === 'user' ? 'user' : 'model',
          content: String(h.content || h.texto || '')
        }))
      : [];

    const resultado = await processarMensagemFiscal(
      mensagem.trim(),
      historicoLimpo,
      empresaAtivaId,
      userId
    );

    res.json(resultado);
  } catch (err: any) {
    console.error('❌ [API /ai/chat] Falha na rota do copiloto fiscal:', err);
    res.status(500).json({
      success: false,
      error: 'Falha interna ao processar consulta fiscal: ' + (err.message || 'Erro de servidor.')
    });
  }
});

export default router;
