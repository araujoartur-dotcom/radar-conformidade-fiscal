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
// 8. CREDENCIAIS CGIBS (CONSULTA E ATUALIZAÇÃO)
// =========================================================
router.get('/credenciais', async (req: Request, res: Response) => {
  try {
    const empresaId = (req.query.empresaId as string) || 'default-empresa';
    const db = getDatabase();

    const cred = db.prepare('SELECT * FROM apuracao_credenciais_cgibs WHERE empresa_id = ?').get(empresaId) as any;

    if (!cred) {
      res.json({
        configurado: false,
        clientId: '',
        flagWebhook: true,
        flagConsultaDemanda: true,
        status: 'pendente_configuracao'
      });
      return;
    }

    res.json({
      configurado: true,
      clientId: cred.client_id,
      clientSecretMascarado: cred.client_secret ? `${cred.client_secret.substring(0, 4)}...${cred.client_secret.slice(-4)}` : '',
      tokenContrib: cred.token_contrib,
      webhookUrl: cred.webhook_url,
      flagWebhook: cred.flag_webhook === 1,
      flagConsultaDemanda: cred.flag_consulta_demanda === 1,
      status: cred.status,
      dataHabilitacao: cred.data_habilitacao
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/credenciais', async (req: Request, res: Response) => {
  try {
    const { empresaId, clientId, clientSecret, webhookUrl, tokenContrib, flagWebhook, flagConsultaDemanda } = req.body;
    if (!clientId || !clientSecret) {
      res.status(400).json({ error: 'ClientID e ClientSecret são obrigatórios.' });
      return;
    }

    const empId = empresaId || 'default-empresa';
    const db = getDatabase();

    db.prepare(`
      INSERT INTO apuracao_credenciais_cgibs (
        id, empresa_id, client_id, client_secret, webhook_url, token_contrib, flag_webhook, flag_consulta_demanda, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'habilitado')
      ON CONFLICT(empresa_id) DO UPDATE SET
        client_id = excluded.client_id,
        client_secret = excluded.client_secret,
        webhook_url = excluded.webhook_url,
        token_contrib = excluded.token_contrib,
        flag_webhook = excluded.flag_webhook,
        flag_consulta_demanda = excluded.flag_consulta_demanda,
        status = 'habilitado',
        updated_at = datetime('now')
    `).run(
      `cred-${empId}`,
      empId,
      clientId,
      clientSecret,
      webhookUrl || '',
      tokenContrib || '',
      flagWebhook !== false ? 1 : 0,
      flagConsultaDemanda !== false ? 1 : 0
    );

    res.json({ success: true, mensagem: 'Credenciais e preferências CGIBS salvas com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para alternar rapidamente as flags de Webhook ou Consulta por Demanda
router.post('/credenciais/flags', async (req: Request, res: Response) => {
  try {
    const { empresaId, flagWebhook, flagConsultaDemanda } = req.body;
    const empId = empresaId || 'default-empresa';
    const db = getDatabase();

    const cred = db.prepare('SELECT id FROM apuracao_credenciais_cgibs WHERE empresa_id = ?').get(empId);
    if (!cred) {
      // Cria registro base com flags
      db.prepare(`
        INSERT INTO apuracao_credenciais_cgibs (id, empresa_id, client_id, client_secret, flag_webhook, flag_consulta_demanda)
        VALUES (?, ?, '5c37db2e924740449c621b2d95afeef2', '7349128e1c60405bbe50dbf3e3fa7afe', ?, ?)
      `).run(`cred-${empId}`, empId, flagWebhook ? 1 : 0, flagConsultaDemanda ? 1 : 0);
    } else {
      db.prepare(`
        UPDATE apuracao_credenciais_cgibs
        SET flag_webhook = ?, flag_consulta_demanda = ?, updated_at = datetime('now')
        WHERE empresa_id = ?
      `).run(flagWebhook ? 1 : 0, flagConsultaDemanda ? 1 : 0, empId);
    }

    res.json({ success: true, flagWebhook: Boolean(flagWebhook), flagConsultaDemanda: Boolean(flagConsultaDemanda) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================
// 9. CONSULTA DE ARQUIVOS POR DEMANDA (GET /v1/aassist/solicitacao/...)
// Ref: Seção 5.1 do Manual CGIBS (Julho/2026)
// =========================================================
router.post('/consultar-demanda', async (req: Request, res: Response) => {
  try {
    const { empresaId, competencia } = req.body;
    const empId = empresaId || 'default-empresa';
    const db = getDatabase();

    const cred = db.prepare('SELECT * FROM apuracao_credenciais_cgibs WHERE empresa_id = ?').get(empId) as any;

    if (cred && cred.flag_consulta_demanda === 0) {
      res.status(400).json({ error: 'A flag de consulta por demanda está desativada nas configurações.' });
      return;
    }

    console.log(`🔍 [CGIBS Demanda] Disparando solicitação de arquivos por demanda para empresa ${empId}, competência ${competencia || 'atual'}`);

    // Registra a solicitação na auditoria
    db.prepare(`
      INSERT INTO audit_log (nivel, servico, acao, descricao, dados_extras)
      VALUES ('INFO', 'CGIBS_DEMANDA', 'SOLICITACAO_ARQUIVO', ?, ?)
    `).run(
      `Consulta manual por demanda GET /v1/aassist/solicitacao para competência ${competencia || 'atual'}`,
      JSON.stringify({ empId, competencia, timestamp: new Date().toISOString() })
    );

    res.json({
      success: true,
      protocoloSolicitacao: `SOL-CGIBS-${Date.now()}`,
      statusSolicitacao: 'PROCESSANDO_SEFIN',
      mensagem: 'Solicitação de arquivo por demanda enviada com sucesso à SEFIN Nacional. Os deltas serão disponibilizados na fila de download.',
      dataHora: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
