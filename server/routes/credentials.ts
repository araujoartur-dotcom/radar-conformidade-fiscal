/**
 * ============================================================
 * ROTAS DE CREDENCIAIS — PROXY SEGURO
 * ============================================================
 * O frontend NUNCA acessa APIs externas diretamente. Todas as
 * chamadas passam por aqui, onde as credenciais são injetadas
 * no servidor. O frontend só recebe os dados tratados.
 * ============================================================
 */

import { Router, Response } from 'express';
import { CGIBS, RFB, ERP, SEFAZ } from '../config';
import { AuthenticatedRequest, requireAuth, requirePerfil, logAuditAction } from '../middleware/auth';

const router = Router();

// =========================================================
// GET /api/config/endpoints — Retorna apenas os dados públicos
// =========================================================
router.get('/endpoints', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  // Retorna APENAS informações não-sensíveis para exibição na UI
  // NUNCA retorna API keys, tokens ou senhas
  res.json({
    sefaz: {
      tpAmb: SEFAZ.TP_AMB,
      ambiente: SEFAZ.TP_AMB === '1' ? 'Produção' : 'Homologação',
      svrs: SEFAZ.TP_AMB === '1'
        ? {
            recepcaoEvento: mascarar(SEFAZ.SVRS_PRODUCAO.RECEPCAO_EVENTO),
            consultaProtocolo: mascarar(SEFAZ.SVRS_PRODUCAO.CONSULTA_PROTOCOLO),
          }
        : {
            recepcaoEvento: mascarar(SEFAZ.SVRS_HOMOLOGACAO.RECEPCAO_EVENTO),
            consultaProtocolo: mascarar(SEFAZ.SVRS_HOMOLOGACAO.CONSULTA_PROTOCOLO),
          },
      nfseNacional: mascarar(SEFAZ.NFSE_NACIONAL),
    },
    cgibs: {
      urlConfigurada: !!CGIBS.API_URL,
      apiKeyConfigurada: !!CGIBS.API_KEY,
    },
    rfb: {
      urlConfigurada: !!RFB.API_URL,
      tokenConfigurado: !!RFB.BEARER_TOKEN,
    },
    erp: {
      tipo: ERP.TIPO,
      endpointConfigurado: !!ERP.ENDPOINT_URL,
      systemId: ERP.SYSTEM_ID,
      clientNumber: ERP.CLIENT_NUMBER,
      webhookConfigurado: !!ERP.WEBHOOK_URL,
    },
  });
});

// =========================================================
// POST /api/config/test-erp — Testa conectividade ERP (proxy)
// =========================================================
router.post('/test-erp', requireAuth, requirePerfil('admin_master', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ERP.ENDPOINT_URL) {
      res.status(400).json({ error: 'Endpoint ERP não configurado nas variáveis de ambiente.', connected: false });
      return;
    }

    // Testar ping para o endpoint ERP
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(ERP.ENDPOINT_URL, {
        method: 'GET',
        headers: {
          'X-Fiscal-API-Key': ERP.API_KEY,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - start;

      logAuditAction(req, 'ERP_TEST_CONNECTION', `Teste de conexão ERP ${ERP.TIPO}: ${response.status} (${latencyMs}ms)`);

      res.json({
        connected: response.status < 500,
        statusCode: response.status,
        latencyMs,
        erp: ERP.TIPO,
        systemId: ERP.SYSTEM_ID,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      res.json({
        connected: false,
        error: fetchErr.message,
        erp: ERP.TIPO,
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message, connected: false });
  }
});

// =========================================================
// POST /api/config/test-cgibs — Testa API do CGIBS (proxy)
// =========================================================
router.post('/test-cgibs', requireAuth, requirePerfil('admin_master', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!CGIBS.API_URL || !CGIBS.API_KEY) {
      res.json({
        connected: false,
        message: 'API CGIBS não configurada. Defina CGIBS_API_URL e CGIBS_API_KEY no .env'
      });
      return;
    }

    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CGIBS.TIMEOUT_MS);

    try {
      const response = await fetch(`${CGIBS.API_URL}/status`, {
        method: 'GET',
        headers: {
          'X-API-Key': CGIBS.API_KEY,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - start;

      logAuditAction(req, 'CGIBS_TEST', `Teste de conexão CGIBS: ${response.status} (${latencyMs}ms)`);

      res.json({
        connected: response.ok,
        statusCode: response.status,
        latencyMs,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      res.json({ connected: false, error: fetchErr.message });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message, connected: false });
  }
});

/**
 * Mascara URLs para exibição no frontend (sem expor paths completos)
 */
function mascarar(url: string): string {
  if (!url) return '[Não configurado]';
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}/...`;
  } catch {
    return url.slice(0, 30) + '...';
  }
}

export default router;
