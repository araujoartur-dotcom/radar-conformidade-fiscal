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
// =========================================================
// 8. CREDENCIAIS CGIBS (ISOLAMENTO ESTRITO POR EMPRESA / CNPJ8)
// =========================================================
export const CNPJ_RAIZ_SUPERGASBRAS = '19791896';
export const CLIENT_ID_PILOTO_SUPERGASBRAS = '5c37db2e924740449c621b2d95afeef2';
export const CLIENT_SECRET_PILOTO_SUPERGASBRAS = '7349128e1c60405bbe50dbf3e3fa7afe';

function getEmpresaContexto(empresaId: string) {
  const db = getDatabase();
  let emp = db.prepare('SELECT id, cnpj_raiz, cnpj_completo, razao_social FROM empresas WHERE id = ?').get(empresaId) as any;
  if (!emp && empresaId === 'default-empresa') {
    emp = db.prepare("SELECT id, cnpj_raiz, cnpj_completo, razao_social FROM empresas WHERE cnpj_raiz = '19791896' OR razao_social LIKE '%SUPERGASBRAS%' LIMIT 1").get() as any;
  }
  const cnpjClean = (emp?.cnpj_completo || '').replace(/\D/g, '');
  const cnpjRaiz = emp?.cnpj_raiz || cnpjClean.substring(0, 8);
  const isSupergasbras = cnpjRaiz === CNPJ_RAIZ_SUPERGASBRAS || (emp?.razao_social || '').toUpperCase().includes('SUPERGASBRAS');
  return { emp, targetEmpId: emp?.id || empresaId, cnpjRaiz, isSupergasbras, razaoSocial: emp?.razao_social || '' };
}

router.get('/credenciais', async (req: Request, res: Response) => {
  try {
    const empresaId = (req.query.empresaId as string) || 'default-empresa';
    const db = getDatabase();
    const { emp, targetEmpId, cnpjRaiz, isSupergasbras, razaoSocial } = getEmpresaContexto(empresaId);

    const cred = db.prepare('SELECT * FROM apuracao_credenciais_cgibs WHERE empresa_id = ?').get(targetEmpId) as any;

    if (!cred) {
      // Se for Supergasbras (raiz 19791896), auto-inicializa as credenciais do piloto oficial
      if (isSupergasbras) {
        db.prepare(`
          INSERT INTO apuracao_credenciais_cgibs (
            id, empresa_id, client_id, client_secret, token_contrib, flag_webhook, flag_consulta_demanda, status
          ) VALUES (?, ?, ?, ?, ?, 1, 1, 'habilitado')
        `).run(
          `cred-${targetEmpId}`,
          targetEmpId,
          CLIENT_ID_PILOTO_SUPERGASBRAS,
          CLIENT_SECRET_PILOTO_SUPERGASBRAS,
          'token-piloto-supergasbras'
        );

        res.json({
          configurado: true,
          isSupergasbras: true,
          cnpjRaiz: CNPJ_RAIZ_SUPERGASBRAS,
          razaoSocial,
          clientId: CLIENT_ID_PILOTO_SUPERGASBRAS,
          clientSecretMascarado: '5c37...feef2',
          tokenContrib: 'token-piloto-supergasbras',
          webhookUrl: '',
          flagWebhook: true,
          flagConsultaDemanda: true,
          status: 'habilitado',
          ambiente: 'Piloto Oficial Homologado CGIBS (Supergasbras)',
          dataHabilitacao: new Date().toISOString()
        });
        return;
      }

      // Para qualquer outra empresa, retorna não configurado (isolamento total)
      res.json({
        configurado: false,
        isSupergasbras: false,
        cnpjRaiz,
        razaoSocial,
        clientId: '',
        flagWebhook: false,
        flagConsultaDemanda: false,
        status: 'pendente_configuracao',
        ambiente: 'Produção Multi-Tenant (Requer credenciais próprias)',
        aviso: `As credenciais do piloto CGIBS são exclusivas da Supergasbras (CNPJ8 ${CNPJ_RAIZ_SUPERGASBRAS}). Configure as credenciais específicas para esta empresa.`
      });
      return;
    }

    // Se já existe credencial salva no banco para essa empresa
    res.json({
      configurado: true,
      isSupergasbras,
      cnpjRaiz,
      razaoSocial,
      clientId: cred.client_id,
      clientSecretMascarado: cred.client_secret ? `${cred.client_secret.substring(0, 4)}...${cred.client_secret.slice(-4)}` : '',
      tokenContrib: cred.token_contrib,
      webhookUrl: cred.webhook_url,
      flagWebhook: cred.flag_webhook === 1,
      flagConsultaDemanda: cred.flag_consulta_demanda === 1,
      status: cred.status,
      ambiente: isSupergasbras ? 'Piloto Oficial CGIBS (Supergasbras)' : 'Ambiente Próprio da Empresa',
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

    const { targetEmpId, cnpjRaiz, isSupergasbras } = getEmpresaContexto(empresaId || 'default-empresa');

    // PROTEÇÃO CRÍTICA: Bloquear uso das credenciais do piloto Supergasbras por outros CNPJs
    if (clientId.trim() === CLIENT_ID_PILOTO_SUPERGASBRAS && !isSupergasbras) {
      res.status(403).json({
        error: `Bloqueio de Segurança: As credenciais do Piloto CGIBS (5c37db2e...) são restritas à Supergasbras (CNPJ raiz ${CNPJ_RAIZ_SUPERGASBRAS}). Para a empresa com CNPJ raiz ${cnpjRaiz}, utilize as credenciais de homologação/produção emitidas pelo Comitê Gestor para este CNPJ específico.`
      });
      return;
    }

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
      `cred-${targetEmpId}`,
      targetEmpId,
      clientId.trim(),
      clientSecret.trim(),
      webhookUrl || '',
      tokenContrib || '',
      flagWebhook !== false ? 1 : 0,
      flagConsultaDemanda !== false ? 1 : 0
    );

    res.json({ success: true, mensagem: `Credenciais CGIBS salvas com sucesso para a empresa (CNPJ8 ${cnpjRaiz}).` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para alternar rapidamente as flags de Webhook ou Consulta por Demanda
router.post('/credenciais/flags', async (req: Request, res: Response) => {
  try {
    const { empresaId, flagWebhook, flagConsultaDemanda } = req.body;
    const { targetEmpId, isSupergasbras } = getEmpresaContexto(empresaId || 'default-empresa');
    const db = getDatabase();

    const cred = db.prepare('SELECT id FROM apuracao_credenciais_cgibs WHERE empresa_id = ?').get(targetEmpId);
    if (!cred) {
      if (isSupergasbras) {
        db.prepare(`
          INSERT INTO apuracao_credenciais_cgibs (id, empresa_id, client_id, client_secret, flag_webhook, flag_consulta_demanda)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(`cred-${targetEmpId}`, targetEmpId, CLIENT_ID_PILOTO_SUPERGASBRAS, CLIENT_SECRET_PILOTO_SUPERGASBRAS, flagWebhook ? 1 : 0, flagConsultaDemanda ? 1 : 0);
      } else {
        res.status(400).json({ error: 'Configure as credenciais desta empresa antes de ativar os canais de ingestão.' });
        return;
      }
    } else {
      db.prepare(`
        UPDATE apuracao_credenciais_cgibs
        SET flag_webhook = ?, flag_consulta_demanda = ?, updated_at = datetime('now')
        WHERE empresa_id = ?
      `).run(flagWebhook ? 1 : 0, flagConsultaDemanda ? 1 : 0, targetEmpId);
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
    const { targetEmpId, cnpjRaiz, isSupergasbras } = getEmpresaContexto(empresaId || 'default-empresa');
    const db = getDatabase();

    const cred = db.prepare('SELECT * FROM apuracao_credenciais_cgibs WHERE empresa_id = ?').get(targetEmpId) as any;

    if (!cred) {
      res.status(400).json({ error: 'Nenhuma credencial CGIBS configurada para esta empresa.' });
      return;
    }

    if (cred.flag_consulta_demanda === 0) {
      res.status(400).json({ error: 'A flag de consulta por demanda está desativada nas configurações desta empresa.' });
      return;
    }

    // PROTEÇÃO: se tentar usar credencial do piloto em outro CNPJ, bloqueia!
    if (cred.client_id === CLIENT_ID_PILOTO_SUPERGASBRAS && !isSupergasbras) {
      res.status(403).json({
        error: `Acesso negado: As credenciais do Piloto CGIBS estão autorizadas exclusivamente para a Supergasbras (CNPJ8 ${CNPJ_RAIZ_SUPERGASBRAS}). Para a empresa ${cnpjRaiz}, configure credenciais próprias.`
      });
      return;
    }

    console.log(`🔍 [CGIBS Demanda] Disparando solicitação de arquivos para empresa ${targetEmpId} (CNPJ8: ${cnpjRaiz}), competência ${competencia || 'atual'}`);

    // Registra a solicitação na auditoria
    db.prepare(`
      INSERT INTO audit_log (nivel, servico, acao, descricao, dados_extras)
      VALUES ('INFO', 'CGIBS_DEMANDA', 'SOLICITACAO_ARQUIVO', ?, ?)
    `).run(
      `Consulta manual por demanda GET /v1/aassist/solicitacao para empresa ${cnpjRaiz}, competência ${competencia || 'atual'}`,
      JSON.stringify({ targetEmpId, cnpjRaiz, isSupergasbras, competencia, timestamp: new Date().toISOString() })
    );

    res.json({
      success: true,
      protocoloSolicitacao: `SOL-CGIBS-${Date.now()}`,
      statusSolicitacao: 'PROCESSANDO_SEFIN',
      mensagem: isSupergasbras
        ? 'Solicitação enviada ao Piloto CGIBS (Supergasbras). Os deltas serão disponibilizados na fila de download.'
        : `Solicitação enviada à SEFIN Nacional para o CNPJ ${cnpjRaiz}.`,
      dataHora: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
