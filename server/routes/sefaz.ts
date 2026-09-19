/**
 * ============================================================
 * ROTAS SEFAZ — TRANSMISSÃO DE EVENTOS & MONITORAMENTO 360°
 * ============================================================
 * Endpoints seguros para consulta e transmissão de eventos fiscais:
 * - NFeDistribuicaoDFe (Consulta por NSU, Chave, Resumos e Eventos de Terceiros)
 * - NFeRecepcaoEvento4 (Transmissão de Manifestação e Eventos Próprios)
 * - Transações atômicas ACID com zero erro de Foreign Key
 * - Padronização estrita no Horário Oficial de Brasília (UTC-03:00)
 * ============================================================
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';
import { AuthenticatedRequest, requireAuth, requirePerfil, logAuditAction } from '../middleware/auth';
import {
  transmitirEventoSefaz,
  testarConexaoSefaz,
  consultarDistribuicaoDFe,
  consultarDistribuicaoCTe,
  consultarCadastroTriplaCamada,
  consultarSituacaoCompletaDFe,
  EventoSefazRequest,
} from '../services/sefazService';
import { getBrasiliaTimestamp, getBrasiliaDate } from '../utils/timezone';
import { SEFAZ } from '../config';

const router = Router();

/**
 * Helper para garantir que a empresa exista no banco antes de qualquer operação
 */
/**
 * Localiza a empresa cadastrada (no Supabase ou SQLite local) pelo ID ou CNPJ real.
 * Se a empresa não existir no cadastro oficial, REJEITA com erro explícito de conformidade.
 * PROIBIDO gerar dados fictícios ("EMPRESA PADRAO", "00.000.000/0001-00") ou selecionar outra empresa aleatória.
 */
async function ensureEmpresaExists(db: any, empresaId?: string, cnpjBusca?: string): Promise<{ id: string; cnpj_completo: string; razao_social?: string }> {
  let empresa: any = null;
  const cleanCnpj = (cnpjBusca || '').replace(/\D/g, '');

  // 1. Tentar buscar no Supabase se configurado
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      if (empresaId) {
        const { data: supaEmp } = await supabase
          .from('empresas')
          .select('id, cnpj_completo, cnpj_raiz, razao_social, nome_fantasia, uf, regime_tributario')
          .eq('id', empresaId)
          .maybeSingle();
        if (supaEmp) empresa = supaEmp;
      }

      if (!empresa && cleanCnpj) {
        const { data: supaEmp } = await supabase
          .from('empresas')
          .select('id, cnpj_completo, cnpj_raiz, razao_social, nome_fantasia, uf, regime_tributario')
          .or(`cnpj_completo.eq.${cnpjBusca},cnpj_raiz.eq.${cleanCnpj.substring(0, 8)}`)
          .maybeSingle();
        if (supaEmp) empresa = supaEmp;
      }
    }
  }

  // 2. Se achou no Supabase, espelhar no SQLite local com dados 100% REAIS da empresa
  if (empresa && empresa.id) {
    const now = getBrasiliaTimestamp();
    db.prepare(`
      INSERT OR REPLACE INTO empresas (
        id, cnpj_raiz, cnpj_completo, razao_social, nome_fantasia, uf, regime_tributario, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      empresa.id,
      empresa.cnpj_raiz || cleanCnpj.substring(0, 8),
      empresa.cnpj_completo || cnpjBusca,
      empresa.razao_social,
      empresa.nome_fantasia || empresa.razao_social,
      empresa.uf || 'RJ',
      empresa.regime_tributario || 'Lucro Real',
      now,
      now
    );
    return { id: empresa.id, cnpj_completo: empresa.cnpj_completo, razao_social: empresa.razao_social };
  }

  // 3. Buscar no SQLite Local pelo ID oficial ou CNPJ cadastrado
  if (empresaId) {
    empresa = db.prepare('SELECT id, cnpj_completo, razao_social FROM empresas WHERE id = ?').get(empresaId);
  }

  if (!empresa && cleanCnpj) {
    empresa = db.prepare(`
      SELECT id, cnpj_completo, razao_social FROM empresas 
      WHERE REPLACE(REPLACE(REPLACE(cnpj_completo, '.', ''), '/', ''), '-', '') = ? 
         OR cnpj_raiz = ? 
         OR cnpj_completo = ?
      LIMIT 1
    `).get(cleanCnpj, cleanCnpj.substring(0, 8), cnpjBusca);
  }

  if (empresa) {
    return { id: empresa.id, cnpj_completo: empresa.cnpj_completo, razao_social: empresa.razao_social };
  }

  // Se a empresa não existir no cadastro oficial: PROIBIDO CRIAR EMPRESA FAKE! Lança erro de conformidade:
  throw new Error(`Empresa com identificador "${empresaId || cnpjBusca || 'não informado'}" não foi localizada na Carteira de CNPJs. Cadastre a empresa formalmente antes de prosseguir com operações SEFAZ.`);
}

/**
 * Valida a identidade do auditor/usuário autenticado.
 * Registra no SQLite local os dados REAIS da sessão autenticada caso ainda não sincronizados.
 * PROIBIDO selecionar usuários aleatórios ou criar contas fictícias ("admin@radarfiscal.com.br").
 */
function ensureUsuarioExists(db: any, authenticatedUser?: any, emailParam?: string): string {
  const userId = authenticatedUser?.userId || authenticatedUser?.id || (typeof authenticatedUser === 'string' ? authenticatedUser : null);
  const email = authenticatedUser?.email || emailParam;

  if (!userId && !email) {
    throw new Error('Operação fiscal não autorizada: Usuário auditor não identificado na sessão para registro de custódia.');
  }

  let user = db.prepare('SELECT id FROM usuarios WHERE id = ? OR (email = ? AND email IS NOT NULL AND email != "")').get(userId, email);
  if (!user) {
    if (!userId) {
      throw new Error('Operação fiscal não autorizada: ID do usuário auditor ausente.');
    }
    const nome = authenticatedUser?.nome || authenticatedUser?.name || email?.split('@')[0] || 'Auditor Fiscal';
    const perfil = authenticatedUser?.perfil || 'analista_fiscal';
    const now = getBrasiliaTimestamp();

    db.prepare(`
      INSERT OR REPLACE INTO usuarios (
        id, nome, email, senha_hash, perfil, status, created_at, updated_at
      ) VALUES (?, ?, ?, '$2a$10$authSessionTokenHash', ?, 'ativo', ?, ?)
    `).run(userId, nome, email || `${userId}@radarfiscal.com.br`, perfil, now, now);
    return userId;
  }

  return user.id;
}

// =========================================================
// POST /api/sefaz/distribui-dfe — Consulta NFeDistribuicaoDFe / CTeDistribuicaoDFe
// =========================================================
router.post('/distribui-dfe', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cnpj, ultNSU, chNFe, chCTe, nsuEspecifico, tpAmb, fluxo, tipoDoc, tipoDocumento } = req.body;

    if (!cnpj) {
      res.status(400).json({ success: false, message: 'CNPJ é obrigatório para consulta no WebService SEFAZ.' });
      return;
    }

    const cleanCnpj = cnpj.replace(/\D/g, '');
    const db = getDatabase();

    // 1. Garantir que a empresa exista
    const empresaIdTarget = req.body.empresaId || (req.headers['x-empresa-ativa-id'] as string) || req.user?.empresaAtivaId;
    const cnpjTarget = cnpj || req.user?.empresaCnpj;
    const empresa = await ensureEmpresaExists(db, empresaIdTarget, cnpjTarget);
    const empresaId = empresa.id;

    // Buscar dados complementares da empresa
    const empDetails = db.prepare('SELECT uf, manifestar_ciencia_automatica, ultimo_nsu FROM empresas WHERE id = ?').get(empresaId) as any;
    const ufAutor = req.body.ufAutor || empDetails?.uf || 'SP';
    const manifestarCienciaAutomatica = empDetails?.manifestar_ciencia_automatica !== undefined 
      ? Boolean(empDetails.manifestar_ciencia_automatica) 
      : true;

    const isCte = tipoDoc === 'CTe' || tipoDocumento === 'CTe' || Boolean(chCTe);

    // 2. Chamar o serviço de comunicação SOAP com mTLS (CT-e ou NF-e)
    const resultado = isCte
      ? await consultarDistribuicaoCTe({
          cnpj: cleanCnpj,
          ultNSU: ultNSU !== undefined ? ultNSU : '000000000000000',
          chNFe: chCTe || chNFe,
          nsuEspecifico,
          tpAmb: (tpAmb === '1' || tpAmb === 'producao') ? '1' : '2',
          empresaId,
          ufAutor,
          fluxo: fluxo || 'entrada',
          userId: req.user?.userId,
        })
      : await consultarDistribuicaoDFe({
          cnpj: cleanCnpj,
          ultNSU: ultNSU !== undefined ? ultNSU : (empDetails?.ultimo_nsu || '000000000000000'),
          chNFe,
          nsuEspecifico,
          tpAmb: (tpAmb === '1' || tpAmb === 'producao') ? '1' : '2',
          empresaId,
          ufAutor,
          fluxo: fluxo || 'entrada',
          manifestarCienciaAutomatica,
          userId: req.user?.userId,
        });

    logAuditAction(
      req, 
      isCte ? 'SEFAZ_DISTRIBUICAO_CTE' : 'SEFAZ_DISTRIBUICAO_DFE', 
      `Consulta ${isCte ? 'CTeDistribuicaoDFe' : 'NFeDistribuicaoDFe'} para CNPJ ${cleanCnpj} (ultNSU=${resultado.ultNSU}, docs=${resultado.docs.length}): cStat=${resultado.cStat} - ${resultado.xMotivo}`
    );

    res.json({
      success: resultado.success,
      tipoDocumento: isCte ? 'CTe' : 'NFe',
      cStat: resultado.cStat,
      xMotivo: resultado.xMotivo,
      ultNSU: resultado.ultNSU,
      maxNSU: resultado.maxNSU,
      tpAmb: resultado.tpAmb,
      docs: resultado.docs,
      eventosTerceiros: resultado.eventosTerceiros || [],
    });
  } catch (err: any) {
    console.error('❌ Erro na rota /api/sefaz/distribui-dfe:', err.message);
    res.status(500).json({ success: false, message: 'Erro interno ao consultar SEFAZ: ' + err.message });
  }
});

// =========================================================
// POST /api/sefaz/consulta-situacao — Consulta Completa de Eventos da Chave (Tudão)
// =========================================================
router.post('/consulta-situacao', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chNFe, tipoDoc } = req.body;
    
    if (!chNFe || chNFe.length < 44) {
      res.status(400).json({ success: false, error: 'Chave de acesso não informada ou inválida.' });
      return;
    }

    const db = getDatabase();
    const empresaIdTarget = req.body.empresaId || (req.headers['x-empresa-ativa-id'] as string) || req.user?.empresaAtivaId;
    const cnpjTarget = req.body.cnpj || req.user?.empresaCnpj;
    const empresa = await ensureEmpresaExists(db, empresaIdTarget, cnpjTarget);

    const tpAmb = (req.body.tpAmb === '1' || req.body.tpAmb === '2') 
      ? req.body.tpAmb 
      : (process.env.SEFAZ_TP_AMB || '1'); // Default para Produção ('1') para dados reais

    const resultado = await consultarSituacaoCompletaDFe({
      chaveAcesso: chNFe,
      tipoDoc: tipoDoc as 'NFe' | 'CTe',
      tpAmb: tpAmb as '1' | '2',
      empresaId: empresa.id,
      cnpj: empresa.cnpj_completo,
      userId: req.user?.userId
    });

    // Registrar no Log de Auditoria
    logAuditAction(
      req,
      'CONSULTA_SEFAZ',
      `Consulta Completa de Situação da chave ${chNFe.slice(0, 20)}... cStat=${resultado.cStat} - ${resultado.xMotivo}. ${resultado.eventos.length} evento(s) baixado(s).`,
      resultado.success ? 'INFO' : 'WARN',
      { chaveAcesso: chNFe, cStat: resultado.cStat, totalEventos: resultado.eventos.length }
    );

    res.json(resultado);
  } catch (err: any) {
    console.error('❌ Erro na Consulta de Situação SEFAZ:', err);
    res.status(500).json({ success: false, error: err.message || 'Falha ao consultar situação na SEFAZ.' });
  }
});

// =========================================================
// POST /api/sefaz/distribui-cte — Consulta CTeDistribuicaoDFe
// =========================================================
router.post('/distribui-cte', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cnpj, ultNSU, chCTe, nsuEspecifico, tpAmb, fluxo } = req.body;

    if (!cnpj) {
      res.status(400).json({ success: false, message: 'CNPJ é obrigatório para consulta no WebService SEFAZ.' });
      return;
    }

    const cleanCnpj = cnpj.replace(/\D/g, '');
    const db = getDatabase();

    const empresaIdTarget = req.body.empresaId || (req.headers['x-empresa-ativa-id'] as string) || req.user?.empresaAtivaId;
    const cnpjTarget = cnpj || req.user?.empresaCnpj;
    const empresa = await ensureEmpresaExists(db, empresaIdTarget, cnpjTarget);
    const empresaId = empresa.id;

    const empDetails = db.prepare('SELECT uf FROM empresas WHERE id = ?').get(empresaId) as any;
    const ufAutor = req.body.ufAutor || empDetails?.uf || 'SP';

    const resultado = await consultarDistribuicaoCTe({
      cnpj: cleanCnpj,
      ultNSU: ultNSU !== undefined ? ultNSU : '000000000000000',
      chNFe: chCTe,
      nsuEspecifico,
      tpAmb: (tpAmb === '1' || tpAmb === 'producao') ? '1' : '2',
      empresaId,
      ufAutor,
      fluxo: fluxo || 'entrada',
      userId: req.user?.userId,
    });

    logAuditAction(
      req, 
      'SEFAZ_DISTRIBUICAO_CTE', 
      `Consulta CTeDistribuicaoDFe para CNPJ ${cleanCnpj} (ultNSU=${resultado.ultNSU}, docs=${resultado.docs.length}): cStat=${resultado.cStat} - ${resultado.xMotivo}`
    );

    res.json({
      success: resultado.success,
      tipoDocumento: 'CTe',
      cStat: resultado.cStat,
      xMotivo: resultado.xMotivo,
      ultNSU: resultado.ultNSU,
      maxNSU: resultado.maxNSU,
      tpAmb: resultado.tpAmb,
      docs: resultado.docs,
      eventosTerceiros: resultado.eventosTerceiros || [],
    });
  } catch (err: any) {
    console.error('❌ Erro na rota /api/sefaz/distribui-cte:', err.message);
    res.status(500).json({ success: false, message: 'Erro interno ao consultar CT-e: ' + err.message });
  }
});

// =========================================================
// POST /api/sefaz/evento — Transmitir evento fiscal (ACID Safe)
// =========================================================
router.post('/evento', requireAuth, requirePerfil('admin_master', 'contador_gestor', 'analista_fiscal'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      chaveAcesso,
      codigoEvento,
      nomeEvento,
      categoria,
      justificativa,
      tpAmb,
      tipoDfe,
    } = req.body;

    // Validações básicas
    if (!chaveAcesso || !codigoEvento || !nomeEvento) {
      res.status(400).json({ error: 'chaveAcesso, codigoEvento e nomeEvento são obrigatórios.' });
      return;
    }

    const cleanChave = chaveAcesso.replace(/\D/g, '');
    if (cleanChave.length !== 44 && cleanChave.length !== 50) {
      res.status(400).json({ error: 'Chave de acesso deve conter 44 dígitos (NF-e/CT-e) ou 50 dígitos (NFS-e Nacional).' });
      return;
    }

    const db = getDatabase();

    // 1. Resolução segura de Empresa e Usuário (Elimina FOREIGN KEY constraint failed)
    const empresaIdTarget = req.body.empresaId || (req.headers['x-empresa-ativa-id'] as string) || req.user?.empresaAtivaId;
    const cnpjTarget = req.body.cnpj || req.user?.empresaCnpj;
    const empresa = await ensureEmpresaExists(db, empresaIdTarget, cnpjTarget);
    const empresaId = empresa.id;
    const userId = ensureUsuarioExists(db, req.user?.userId, req.user?.email);

    // 2. Verificar se o evento já foi transmitido com sucesso (Idempotência)
    const eventoExistente = db.prepare(`
      SELECT id, protocolo_sefaz, status, data_hora 
      FROM eventos_transmitidos
      WHERE chave_acesso = ? AND codigo_evento = ? AND empresa_id = ? AND status = 'processado'
    `).get(cleanChave, codigoEvento, empresaId) as any;

    if (eventoExistente) {
      res.status(409).json({
        error: `Evento ${codigoEvento} (${nomeEvento}) já foi transmitido anteriormente para esta chave.`,
        code: 'EVENTO_DUPLICADO',
        protocoloExistente: eventoExistente.protocolo_sefaz,
        dataHora: eventoExistente.data_hora,
      });
      return;
    }

    // 3. Montar request SEFAZ
    const sefazRequest: EventoSefazRequest = {
      chaveAcesso: cleanChave,
      codigoEvento,
      nomeEvento,
      justificativa: justificativa || undefined,
      tpAmb: tpAmb === '1' ? '1' : '2',
      cnpjAutor: empresa.cnpj_completo || req.user!.empresaCnpj,
      empresaId,
      userId,
    };

    // 4. Transmitir para SEFAZ
    const resultado = await transmitirEventoSefaz(sefazRequest);
    const eventoId = `evt-${cleanChave}-${codigoEvento}-${Date.now()}`;
    const docDbId = `doc-${cleanChave}`;
    const nowBrasilia = getBrasiliaTimestamp();
    const dateBrasilia = getBrasiliaDate();

    // 5. TRANSAÇÃO ATÔMICA ACID (Garantia de integridade referencial)
    db.transaction(() => {
      // Determinar situação manifestação
      let situacaoManifestacao = 'sem_manifestacao';
      let situacaoDoc = 'autorizado';
      let alertaFraude = 0;

      if (codigoEvento === '210210') {
        situacaoManifestacao = 'ciencia_emitida';
      } else if (codigoEvento === '210200') {
        situacaoManifestacao = 'confirmada';
      } else if (codigoEvento === '210220') {
        situacaoManifestacao = 'desconhecida_pelo_destinatario';
        situacaoDoc = 'desconhecido_pelo_destinatario';
        alertaFraude = 1;
      } else if (codigoEvento === '210240') {
        situacaoManifestacao = 'operacao_nao_realizada';
        situacaoDoc = 'operacao_nao_realizada';
        alertaFraude = 1;
      }

      // A. Garantir que o documento pai em dfe_documentos exista
      const existingDoc = db.prepare('SELECT id FROM dfe_documentos WHERE chave_acesso = ?').get(cleanChave) as any;

      if (!existingDoc) {
        // Inserir registro pai
        const emitCnpj = cleanChave.substring(6, 20);
        const numeroDoc = cleanChave.substring(25, 34);
        const serieDoc = cleanChave.substring(22, 25);
        const anoMes = `20${cleanChave.substring(2, 4)}-${cleanChave.substring(4, 6)}`;

        db.prepare(`
          INSERT INTO dfe_documentos (
            id, empresa_id, tipo_doc, chave_acesso, tipo_operacao, numero_serie,
            data_emissao, data_entrada, competencia,
            fornecedor_cnpj, fornecedor_razao, fornecedor_uf,
            cliente_cnpj, cliente_razao, cliente_uf,
            situacao_doc, situacao_manifestacao, evento_ultimo,
            valor_total, alerta_fraude, download_at, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, 'Entrada', ?,
            ?, ?, ?,
            ?, 'EMITENTE (CONSULTA SEFAZ)', 'SP',
            ?, 'DESTINATÁRIO', 'SP',
            ?, ?, ?,
            0, ?, ?, ?, ?
          )
        `).run(
          docDbId,
          empresaId,
          tipoDfe || 'NFe',
          cleanChave,
          `${numeroDoc} / ${serieDoc}`,
          `${anoMes}-01`,
          nowBrasilia,
          anoMes,
          emitCnpj,
          empresa.cnpj_completo.replace(/\D/g, ''),
          situacaoDoc,
          situacaoManifestacao,
          nomeEvento,
          alertaFraude,
          nowBrasilia,
          nowBrasilia,
          nowBrasilia
        );
      } else {
        // Atualizar situação do documento existente
        db.prepare(`
          UPDATE dfe_documentos
          SET situacao_manifestacao = ?,
              situacao_doc = CASE WHEN ? = 1 THEN ? ELSE situacao_doc END,
              evento_ultimo = ?,
              alerta_fraude = CASE WHEN ? = 1 THEN 1 ELSE alerta_fraude END,
              updated_at = ?
          WHERE chave_acesso = ?
        `).run(
          situacaoManifestacao,
          alertaFraude,
          situacaoDoc,
          nomeEvento,
          alertaFraude,
          nowBrasilia,
          cleanChave
        );
      }

      // B. Gravar histórico do evento com foreign keys estritamente válidas
      db.prepare(`
        INSERT INTO eventos_transmitidos (
          id, empresa_id, usuario_id, documento_id, chave_acesso, tipo_dfe, codigo_evento,
          nome_evento, categoria, autor_cnpj, origem_evento, justificativa, ambiente,
          protocolo_sefaz, xml_envio, xml_retorno, codigo_retorno, motivo_retorno,
          status, data_hora, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, 'proprio', ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?
        )
      `).run(
        eventoId,
        empresaId,
        userId,
        docDbId,
        cleanChave,
        tipoDfe || 'NFe',
        codigoEvento,
        nomeEvento,
        categoria || 'destinatario',
        empresa.cnpj_completo.replace(/\D/g, ''),
        justificativa || '',
        sefazRequest.tpAmb,
        resultado.nProt || '',
        resultado.xmlEnvio,
        resultado.xmlRetorno,
        resultado.cStat,
        resultado.xMotivo,
        resultado.success ? 'processado' : 'rejeitado',
        resultado.dhRegEvento || nowBrasilia,
        nowBrasilia
      );
    })();

    // 5.1. Espelhar evento transmitido no Supabase se configurado
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          await supabase.from('eventos_transmitidos').upsert({
            id: eventoId,
            empresa_id: empresaId,
            usuario_id: userId,
            documento_id: docDbId,
            chave_acesso: cleanChave,
            tipo_dfe: tipoDfe || 'NFe',
            codigo_evento: codigoEvento,
            nome_evento: nomeEvento,
            categoria: categoria || 'destinatario',
            autor_cnpj: empresa.cnpj_completo.replace(/\D/g, ''),
            origem_evento: 'proprio',
            justificativa: justificativa || '',
            ambiente: sefazRequest.tpAmb,
            protocolo_sefaz: resultado.nProt || '',
            xml_envio: resultado.xmlEnvio,
            xml_retorno: resultado.xmlRetorno,
            codigo_retorno: resultado.cStat,
            motivo_retorno: resultado.xMotivo,
            status: resultado.success ? 'processado' : 'rejeitado',
            data_hora: resultado.dhRegEvento || nowBrasilia,
            created_at: nowBrasilia
          }, { onConflict: 'id' });
        }
      } catch (supaErr: any) {
        console.warn('⚠️ Falha ao espelhar evento transmitido no Supabase:', supaErr.message);
      }
    }

    // 6. Log de auditoria
    logAuditAction(
      req,
      'EVENTO_SEFAZ',
      `Evento ${codigoEvento} (${nomeEvento}) transmitido para chave ${cleanChave.slice(0, 20)}... cStat=${resultado.cStat} - ${resultado.xMotivo}`,
      resultado.success ? 'INFO' : 'WARN',
      { codigoEvento, chaveAcesso: cleanChave, cStat: resultado.cStat, nProt: resultado.nProt }
    );

    res.json({
      id: eventoId,
      success: resultado.success,
      cStat: resultado.cStat,
      xMotivo: resultado.xMotivo,
      protocoloSefaz: resultado.nProt || '',
      dhRegEvento: resultado.dhRegEvento || nowBrasilia,
      ambiente: sefazRequest.tpAmb === '1' ? 'Produção' : 'Homologação',
      status: resultado.success ? 'processado' : 'rejeitado',
    });
  } catch (err: any) {
    console.error('❌ Erro ao transmitir evento SEFAZ:', err);
    res.status(500).json({ error: `Falha ao transmitir evento: ${err.message}`, code: 'SEFAZ_ERROR' });
  }
});

// =========================================================
// GET /api/sefaz/eventos — Histórico de eventos (Multi-Tenant & Multi-Filial)
// =========================================================
router.get('/eventos', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const { limit, offset, chaveAcesso, status, origem, cnpj } = req.query;

  const empresaId = (req.headers['x-empresa-ativa-id'] as string) || (req.query.empresaId as string) || req.user?.empresaAtivaId;
  const isSuperadmin = req.user?.perfil === 'admin_master';

  // Buscar CNPJ Raiz da empresa ativa para contemplar matriz e filiais
  let cnpjRaiz = '';
  if (cnpj) {
    cnpjRaiz = (cnpj as string).replace(/\D/g, '').substring(0, 8);
  }
  if (!cnpjRaiz && empresaId) {
    const emp = db.prepare('SELECT cnpj_raiz, cnpj_completo FROM empresas WHERE id = ?').get(empresaId) as any;
    if (emp) {
      cnpjRaiz = emp.cnpj_raiz || (emp.cnpj_completo || '').replace(/\D/g, '').substring(0, 8);
    }
  }

  let query = `
    SELECT et.*, u.nome as usuario_nome, u.email as usuario_email, e.razao_social as empresa_nome
    FROM eventos_transmitidos et
    LEFT JOIN usuarios u ON u.id = et.usuario_id
    LEFT JOIN empresas e ON e.id = et.empresa_id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Se houver empresa ativa especificada, isola por ela ou por seu grupo (CNPJ raiz)
  if (empresaId) {
    if (cnpjRaiz) {
      query += ' AND (et.empresa_id = ? OR e.cnpj_raiz = ? OR et.autor_cnpj LIKE ?)';
      params.push(empresaId, cnpjRaiz, `${cnpjRaiz}%`);
    } else {
      query += ' AND et.empresa_id = ?';
      params.push(empresaId);
    }
  } else if (!isSuperadmin) {
    query += ' AND 1=0';
  }

  if (chaveAcesso) {
    query += ' AND et.chave_acesso = ?';
    params.push(chaveAcesso);
  }
  if (status) {
    query += ' AND et.status = ?';
    params.push(status);
  }
  if (origem) {
    query += ' AND et.origem_evento = ?';
    params.push(origem);
  }

  query += ' ORDER BY et.data_hora DESC';
  query += ` LIMIT ? OFFSET ?`;
  const parsedLimit = parseInt(limit as string) || 100;
  const parsedOffset = parseInt(offset as string) || 0;
  params.push(parsedLimit);
  params.push(parsedOffset);

  let rows = db.prepare(query).all(...params);

  // Se Supabase estiver configurado, buscar também de lá e combinar os eventos
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        let supaQuery = supabase.from('eventos_transmitidos').select('*');
        if (chaveAcesso) {
          supaQuery = supaQuery.eq('chave_acesso', chaveAcesso);
        } else if (empresaId) {
          if (cnpjRaiz) {
            supaQuery = supaQuery.or(`empresa_id.eq.${empresaId},autor_cnpj.ilike.${cnpjRaiz}%`);
          } else {
            supaQuery = supaQuery.eq('empresa_id', empresaId);
          }
        }
        if (status) supaQuery = supaQuery.eq('status', status);
        if (origem) supaQuery = supaQuery.eq('origem_evento', origem);

        supaQuery = supaQuery.order('data_hora', { ascending: false }).limit(parsedLimit);

        const { data: supaRows } = await supaQuery;
        if (supaRows && supaRows.length > 0) {
          const mapById = new Map();
          for (const r of rows) mapById.set(r.id, r);
          for (const sr of supaRows) {
            if (!mapById.has(sr.id)) {
              mapById.set(sr.id, sr);
            }
          }
          rows = Array.from(mapById.values()).sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime());
        }
      }
    } catch (supaErr: any) {
      console.warn('⚠️ Falha ao buscar eventos no Supabase:', supaErr.message);
    }
  }

  res.json({ success: true, eventos: rows });
});

// =========================================================
// POST /api/sefaz/consulta-cadastro — Tripla Camada (SEFAZ SOAP / CNPJá / CNPJ.ws)
// =========================================================
router.post('/consulta-cadastro', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cnpj, uf, empresaId } = req.body;
    if (!cnpj) {
      return res.status(400).json({ success: false, error: 'CNPJ é obrigatório para consulta.' });
    }

    const resultado = await consultarCadastroTriplaCamada({
      cnpj,
      uf: uf || 'SP',
      empresaId: empresaId || req.user?.empresaAtivaId,
      cnpjAutor: req.user?.empresaCnpj,
    });

    res.json({ success: true, data: resultado });
  } catch (err: any) {
    console.error('❌ Erro na consulta cadastro:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================
// GET /api/sefaz/status | /ping | /status-servico — Teste Real de Conectividade SEFAZ (Sem fallback)
// =========================================================
router.get(['/status', '/ping', '/status-servico'], requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tpAmb = (req.query.tpAmb as string) === '1' ? '1' : (SEFAZ.TP_AMB as '1' | '2');
    const status = await testarConexaoSefaz(tpAmb);

    if (!status.online) {
      res.status(503).json({
        success: false,
        online: false,
        status: 'indisponivel',
        error: status.error || 'WebService SEFAZ indisponível ou inacessível no momento.',
        message: status.error || 'WebService SEFAZ indisponível ou inacessível no momento.',
        latencyMs: status.latencyMs,
        endpoint: status.endpoint,
        ambiente: tpAmb === '1' ? 'Produção' : 'Homologação',
      });
      return;
    }

    res.json({
      success: true,
      online: true,
      status: 'operacional',
      message: 'Serviço em Operação — Comunicação com SEFAZ Autorizadora 100% Homologada.',
      latencyMs: status.latencyMs,
      endpoint: status.endpoint,
      ambiente: tpAmb === '1' ? 'Produção' : 'Homologação',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      online: false,
      error: `Erro ao testar comunicação SEFAZ: ${err.message}`,
      message: `Erro ao testar comunicação SEFAZ: ${err.message}`,
    });
  }
});

export default router;
