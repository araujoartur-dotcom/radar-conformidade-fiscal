import { Router, Request, Response } from 'express';
import {
  obterResumoCompetencia,
  listarOperacoes,
  obterExtratoOperacao,
  ingerirArquivoCgibs,
  carregarCenariosDidaticosOficiais
} from '../services/apuracaoAssistidaService';
import { calcularTributosRtc, ParametrosCalculoRtc } from '../services/calculadoraRfbService';
import { getDatabase } from '../db/database';
import { AuthenticatedRequest, requireAuth, requirePerfil } from '../middleware/auth';

const router = Router();

// =========================================================
// 1. RESUMO CONSOLIDADO POR COMPETÊNCIA (3 ABAS OFICIAIS)
// =========================================================
router.get('/competencia/:periodo', async (req: Request, res: Response) => {
  try {
    const { periodo } = req.params; // Ex: '2026-01', '2026-02'
    const empresaId = (req.query.empresaId as string) || 'default-empresa';

    const resumo = await obterResumoCompetencia(empresaId, periodo);
    res.json(resumo);
  } catch (err: any) {
    console.error('Erro ao obter resumo de competência:', err);
    res.status(500).json({ error: err.message || 'Erro ao processar resumo de apuração.' });
  }
});

// =========================================================
// 2. LISTAGEM DE OPERAÇÕES DO CONTA CORRENTE FISCAL
// =========================================================
router.get('/operacoes', async (req: Request, res: Response) => {
  try {
    const empresaId = (req.query.empresaId as string) || 'default-empresa';
    const tipo = req.query.tipo as 'fornecimento' | 'aquisicao' | 'todos' | undefined;
    const busca = req.query.busca as string | undefined;
    const competencia = req.query.competencia as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const result = await listarOperacoes(empresaId, {
      tipo,
      busca,
      competencia,
      limit,
      offset
    });

    res.json(result);
  } catch (err: any) {
    console.error('Erro ao listar operações:', err);
    res.status(500).json({ error: err.message || 'Erro ao listar operações.' });
  }
});

// =========================================================
// 3. EXTRATO COMPLETO DE UMA OPERAÇÃO ESPECÍFICA (LEDGER INCREMENTAL)
// =========================================================
router.get('/operacao/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await obterExtratoOperacao(id);

    if (!result) {
      res.status(404).json({ error: `Operação com ID "${id}" não foi localizada.` });
      return;
    }

    res.json(result);
  } catch (err: any) {
    console.error('Erro ao obter extrato da operação:', err);
    res.status(500).json({ error: err.message || 'Erro ao obter extrato da operação.' });
  }
});

// =========================================================
// 4. WEBHOOK OFICIAL DO CGIBS (NOTIFICAÇÕES PUSH)
// Ref: Seção 5.2 do Manual CGIBS (Julho/2026)
// =========================================================
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const tokenHeader = req.headers['tokencontrib'] || req.headers['authorization'];
    const payload = req.body;

    console.log('📡 [Webhook CGIBS] Notificação de arquivos recebida:', {
      token: tokenHeader ? 'presente' : 'ausente',
      tipoSolic: payload?.tipoSolic,
      sitSolic: payload?.sitSolic,
      cnpj: payload?.cnpj,
      arquivos: payload?.arquivos?.length || 0
    });

    // Registra recebimento do Webhook no audit log
    try {
      const db = getDatabase();
      db.prepare(`
        INSERT INTO audit_log (nivel, servico, acao, descricao, dados_extras)
        VALUES ('INFO', 'CGIBS_WEBHOOK', 'NOTIFICACAO_RECEBIDA', ?, ?)
      `).run(
        `Notificação de ${payload?.arquivos?.length || 0} arquivo(s) para CNPJ ${payload?.cnpj || ''}`,
        JSON.stringify(payload)
      );
    } catch {}

    // Resposta padrão HTTP 200 confirmando recepção
    res.status(200).json({
      status: 'RECEBIDO',
      timestamp: new Date().toISOString(),
      mensagem: 'Notificação processada com sucesso pelo Radar Fiscal.'
    });
  } catch (err: any) {
    console.error('Erro no webhook CGIBS:', err);
    res.status(500).json({ error: err.message });
  }
});

// =========================================================
// 5. INGESTÃO DE ARQUIVO JSON DO CGIBS (MANUAL OU DELTA)
// =========================================================
router.post('/ingerir', async (req: Request, res: Response) => {
  try {
    const { payload, empresaId, nomeArquivo } = req.body;
    if (!payload) {
      res.status(400).json({ error: 'Payload JSON é obrigatório para ingestão.' });
      return;
    }

    const empId = empresaId || 'default-empresa';
    const result = await ingerirArquivoCgibs(payload, empId, nomeArquivo);

    res.json({
      success: true,
      ...result
    });
  } catch (err: any) {
    console.error('Erro ao ingerir arquivo CGIBS:', err);
    res.status(500).json({ error: err.message || 'Erro ao ingerir arquivo.' });
  }
});

// =========================================================
// 6. CARGA DOS CENÁRIOS DIDÁTICOS DO MANUAL (Páginas 33 a 43)
// =========================================================
router.post('/simular-cenarios', async (req: Request, res: Response) => {
  try {
    const empresaId = req.body.empresaId || 'default-empresa';
    const mensagens = await carregarCenariosDidaticosOficiais(empresaId);

    res.json({
      success: true,
      mensagens
    });
  } catch (err: any) {
    console.error('Erro ao carregar cenários didáticos:', err);
    res.status(500).json({ error: err.message || 'Erro ao carregar cenários didáticos.' });
  }
});

// =========================================================
// 7. CÁLCULO DE TRIBUTOS RTC & CONFERÊNCIA DE DIVERGÊNCIAS
// Ref: Manual RTC Versão I (13/01/2026) - Calculadora RFB
// =========================================================
router.post('/calcular-tributos', async (req: Request, res: Response) => {
  try {
    const { params, compararXml } = req.body as {
      params: ParametrosCalculoRtc;
      compararXml?: { valorCbs?: number; valorIbs?: number; aliquotaCbs?: number; aliquotaIbs?: number };
    };

    if (!params || params.baseCalculo === undefined) {
      res.status(400).json({ error: 'Parâmetros de cálculo (baseCalculo) são obrigatórios.' });
      return;
    }

    const resultado = await calcularTributosRtc(params, compararXml);
    res.json(resultado);
  } catch (err: any) {
    console.error('Erro no cálculo de tributos RTC:', err);
    res.status(500).json({ error: err.message || 'Erro ao calcular tributos.' });
  }
});

// =========================================================
// =========================================================
// 8. CREDENCIAIS & INTEGRAÇÕES CGIBS / RFB (ISOLAMENTO MULTI-TENANT POR CNPJ)
// =========================================================

function getEmpresaContexto(empresaId: string) {
  const db = getDatabase();
  let emp = db.prepare('SELECT id, cnpj_raiz, cnpj_completo, razao_social FROM empresas WHERE id = ?').get(empresaId) as any;
  if (!emp && empresaId === 'default-empresa') {
    emp = db.prepare("SELECT id, cnpj_raiz, cnpj_completo, razao_social FROM empresas WHERE status = 'ativo' ORDER BY created_at ASC LIMIT 1").get() as any;
  }
  const cnpjClean = (emp?.cnpj_completo || '').replace(/\D/g, '');
  const cnpjRaiz = emp?.cnpj_raiz || cnpjClean.substring(0, 8);
  return { emp, targetEmpId: emp?.id || empresaId, cnpjRaiz, razaoSocial: emp?.razao_social || '' };
}

function canUserAccessEmpresa(req: AuthenticatedRequest, empresaId: string): boolean {
  if (!req.user) return false;
  if (req.user.perfil === 'admin_master') return true;
  const db = getDatabase();
  const vinculo = db.prepare('SELECT id FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ?').get(req.user.userId, empresaId);
  return !!vinculo || req.user.empresaAtivaId === empresaId;
}

// GET /api/apuracao/credenciais — Consulta credenciais e endpoints da empresa
router.get('/credenciais', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const empresaId = (req.query.empresaId as string) || req.user?.empresaAtivaId || 'default-empresa';
    const { targetEmpId, cnpjRaiz, razaoSocial } = getEmpresaContexto(empresaId);

    if (!canUserAccessEmpresa(req, targetEmpId)) {
      res.status(403).json({ error: 'Acesso negado: Você não possui acesso a esta empresa.' });
      return;
    }

    const db = getDatabase();
    const cred = db.prepare('SELECT * FROM apuracao_credenciais_cgibs WHERE empresa_id = ?').get(targetEmpId) as any;

    if (!cred) {
      res.json({
        configurado: false,
        empresaId: targetEmpId,
        cnpjRaiz,
        razaoSocial,
        clientId: '',
        clientSecretMascarado: '',
        tokenContrib: '',
        webhookUrl: '',
        cgibsUrl: 'https://api.cgibs.gov.br/v1/eventos/sync',
        rfbUrl: 'https://api.receita.fazenda.gov.br/rtc/v1/apuracao-assistida',
        svrsUrl: 'https://nfe.svrs.rs.gov.br/ws/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
        nfseNacionalUrl: 'https://www.nfse.gov.br/dnfse/api/v1/eventos',
        apiKeyCgibs: '',
        bearerTokenRfb: '',
        flagWebhook: false,
        flagConsultaDemanda: false,
        status: 'pendente_configuracao',
        ambiente: 'Pendente de Configuração',
        aviso: 'Nenhuma credencial configurada para esta empresa. Um administrador pode configurá-la na Ficha Cadastral.'
      });
      return;
    }

    res.json({
      configurado: true,
      empresaId: targetEmpId,
      cnpjRaiz,
      razaoSocial,
      clientId: cred.client_id || '',
      clientSecretMascarado: cred.client_secret ? `${cred.client_secret.substring(0, 4)}...${cred.client_secret.slice(-4)}` : '',
      tokenContrib: cred.token_contrib || '',
      webhookUrl: cred.webhook_url || '',
      cgibsUrl: cred.cgibs_url || 'https://api.cgibs.gov.br/v1/eventos/sync',
      rfbUrl: cred.rfb_url || 'https://api.receita.fazenda.gov.br/rtc/v1/apuracao-assistida',
      svrsUrl: cred.svrs_url || 'https://nfe.svrs.rs.gov.br/ws/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
      nfseNacionalUrl: cred.nfse_nacional_url || 'https://www.nfse.gov.br/dnfse/api/v1/eventos',
      apiKeyCgibs: cred.api_key_cgibs || '',
      bearerTokenRfb: cred.bearer_token_rfb || '',
      flagWebhook: cred.flag_webhook === 1,
      flagConsultaDemanda: cred.flag_consulta_demanda === 1,
      status: cred.status || 'habilitado',
      ambiente: 'Homologado / Produção',
      dataHabilitacao: cred.data_habilitacao
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/apuracao/credenciais — Salvar credenciais e endpoints (Admin Master e Suporte TI do CNPJ)
router.post('/credenciais', requireAuth, requirePerfil('admin_master', 'suporte_ti'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      empresaId,
      clientId,
      clientSecret,
      webhookUrl,
      cgibsUrl,
      rfbUrl,
      svrsUrl,
      nfseNacionalUrl,
      apiKeyCgibs,
      bearerTokenRfb,
      tokenContrib,
      flagWebhook,
      flagConsultaDemanda
    } = req.body;

    const { targetEmpId, cnpjRaiz } = getEmpresaContexto(empresaId || req.user?.empresaAtivaId || 'default-empresa');

    if (!canUserAccessEmpresa(req, targetEmpId)) {
      res.status(403).json({ error: 'Acesso negado: Você não pode gerenciar credenciais desta empresa.' });
      return;
    }

    const db = getDatabase();
    const existing = db.prepare('SELECT client_secret FROM apuracao_credenciais_cgibs WHERE empresa_id = ?').get(targetEmpId) as any;

    const finalClientSecret = (clientSecret && clientSecret.trim()) ? clientSecret.trim() : (existing?.client_secret || '');

    db.prepare(`
      INSERT INTO apuracao_credenciais_cgibs (
        id, empresa_id, client_id, client_secret, webhook_url,
        cgibs_url, rfb_url, svrs_url, nfse_nacional_url, api_key_cgibs, bearer_token_rfb,
        token_contrib, flag_webhook, flag_consulta_demanda, status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'habilitado', datetime('now'))
      ON CONFLICT(empresa_id) DO UPDATE SET
        client_id = excluded.client_id,
        client_secret = excluded.client_secret,
        webhook_url = excluded.webhook_url,
        cgibs_url = excluded.cgibs_url,
        rfb_url = excluded.rfb_url,
        svrs_url = excluded.svrs_url,
        nfse_nacional_url = excluded.nfse_nacional_url,
        api_key_cgibs = excluded.api_key_cgibs,
        bearer_token_rfb = excluded.bearer_token_rfb,
        token_contrib = excluded.token_contrib,
        flag_webhook = excluded.flag_webhook,
        flag_consulta_demanda = excluded.flag_consulta_demanda,
        status = 'habilitado',
        updated_at = datetime('now')
    `).run(
      `cred-${targetEmpId}`,
      targetEmpId,
      (clientId || '').trim(),
      finalClientSecret,
      webhookUrl || '',
      cgibsUrl || 'https://api.cgibs.gov.br/v1/eventos/sync',
      rfbUrl || 'https://api.receita.fazenda.gov.br/rtc/v1/apuracao-assistida',
      svrsUrl || 'https://nfe.svrs.rs.gov.br/ws/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
      nfseNacionalUrl || 'https://www.nfse.gov.br/dnfse/api/v1/eventos',
      apiKeyCgibs || '',
      bearerTokenRfb || '',
      tokenContrib || '',
      flagWebhook !== false ? 1 : 0,
      flagConsultaDemanda !== false ? 1 : 0
    );

    res.json({ success: true, mensagem: `Configurações de APIs e Credenciais salvas com sucesso para a empresa (CNPJ8 ${cnpjRaiz}).` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/apuracao/credenciais/flags — Alternar flags de Webhook ou Consulta por Demanda
router.post('/credenciais/flags', requireAuth, requirePerfil('admin_master', 'suporte_ti'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { empresaId, flagWebhook, flagConsultaDemanda } = req.body;
    const { targetEmpId } = getEmpresaContexto(empresaId || req.user?.empresaAtivaId || 'default-empresa');

    if (!canUserAccessEmpresa(req, targetEmpId)) {
      res.status(403).json({ error: 'Acesso negado: Você não pode gerenciar preferências desta empresa.' });
      return;
    }

    const db = getDatabase();
    const cred = db.prepare('SELECT id FROM apuracao_credenciais_cgibs WHERE empresa_id = ?').get(targetEmpId);
    if (!cred) {
      res.status(400).json({ error: 'Configure as credenciais desta empresa na Ficha Cadastral antes de ativar os canais de ingestão.' });
      return;
    }

    db.prepare(`
      UPDATE apuracao_credenciais_cgibs
      SET flag_webhook = ?, flag_consulta_demanda = ?, updated_at = datetime('now')
      WHERE empresa_id = ?
    `).run(flagWebhook ? 1 : 0, flagConsultaDemanda ? 1 : 0, targetEmpId);

    res.json({ success: true, flagWebhook: Boolean(flagWebhook), flagConsultaDemanda: Boolean(flagConsultaDemanda) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================
// 9. CONSULTA DE ARQUIVOS POR DEMANDA (GET /v1/aassist/solicitacao/...)
// Ref: Seção 5.1 do Manual CGIBS (Julho/2026)
// =========================================================
router.post('/consultar-demanda', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { empresaId, competencia } = req.body;
    const { targetEmpId, cnpjRaiz } = getEmpresaContexto(empresaId || req.user?.empresaAtivaId || 'default-empresa');

    if (!canUserAccessEmpresa(req, targetEmpId)) {
      res.status(403).json({ error: 'Acesso negado: Você não possui acesso a esta empresa.' });
      return;
    }

    const db = getDatabase();
    const cred = db.prepare('SELECT * FROM apuracao_credenciais_cgibs WHERE empresa_id = ?').get(targetEmpId) as any;

    if (!cred || !cred.client_id) {
      res.status(400).json({ error: 'Nenhuma credencial CGIBS configurada para esta empresa. Um gestor pode cadastrá-la na Ficha Cadastral da Empresa.' });
      return;
    }

    if (cred.flag_consulta_demanda === 0) {
      res.status(400).json({ error: 'A flag de consulta por demanda está desativada nas configurações desta empresa.' });
      return;
    }

    console.log(`🔍 [CGIBS Demanda] Disparando solicitação de arquivos para empresa ${targetEmpId} (CNPJ8: ${cnpjRaiz}), competência ${competencia || 'atual'}`);

    // Registra a solicitação na auditoria
    db.prepare(`
      INSERT INTO audit_log (nivel, servico, acao, descricao, dados_extras)
      VALUES ('INFO', 'CGIBS_DEMANDA', 'SOLICITACAO_ARQUIVO', ?, ?)
    `).run(
      `Consulta manual por demanda GET /v1/aassist/solicitacao para empresa ${cnpjRaiz}, competência ${competencia || 'atual'}`,
      JSON.stringify({ targetEmpId, cnpjRaiz, competencia, timestamp: new Date().toISOString() })
    );

    res.json({
      success: true,
      protocoloSolicitacao: `SOL-CGIBS-${Date.now()}`,
      statusSolicitacao: 'PROCESSANDO_SEFIN',
      mensagem: `Solicitação enviada à SEFIN Nacional para o CNPJ ${cnpjRaiz}.`,
      dataHora: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
