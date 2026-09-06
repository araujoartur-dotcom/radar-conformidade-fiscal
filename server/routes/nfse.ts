/**
 * ============================================================
 * ROTAS DE NFS-E (SERVIÇOS) — RADAR FISCAL
 * ============================================================
 * Endpoints para busca, sincronização e auditoria de NFS-e
 * integrados ao Ambiente de Dados Nacional (ADN) e Prefeituras.
 * ============================================================
 */

import crypto from 'crypto';
import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { getDatabase } from '../db/database';
import { isSupabaseConfigured, getSupabaseAdmin } from '../db/supabase';
import { sincronizarNfseNacional, sincronizarNfseUnificada, sincronizarNfsePMSP, obterStatusNfse } from '../services/nfseService';

const router = Router();

/**
 * GET /api/nfse/status
 * Retorna o painel de status e estatísticas de NFS-e do tenant ativo.
 */
router.get('/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activeEmpresaId = req.user?.empresaAtivaId;
    const empresaId = (req.query.empresaId as string) || activeEmpresaId;
    const db = getDatabase();

    let cleanCnpj = '';
    if (empresaId) {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseAdmin();
        const { data: emp } = await supabase.from('empresas').select('cnpj_completo').eq('id', empresaId).maybeSingle();
        if (emp?.cnpj_completo) cleanCnpj = emp.cnpj_completo.replace(/\D/g, '');
      } else {
        try {
          const emp = db.prepare('SELECT cnpj_completo FROM empresas WHERE id = ?').get(empresaId) as any;
          if (emp?.cnpj_completo) cleanCnpj = emp.cnpj_completo.replace(/\D/g, '');
        } catch {
          // fallback
        }
      }
    }
    if (!cleanCnpj && req.user?.empresaCnpj) {
      cleanCnpj = req.user.empresaCnpj.replace(/\D/g, '');
    }

    if (!empresaId || !cleanCnpj) {
      res.status(400).json({ success: false, error: 'Empresa ativa ou CNPJ não identificado.' });
      return;
    }

    const resumo = await obterStatusNfse(empresaId, cleanCnpj);
    res.json({ success: true, ...resumo });
  } catch (err: any) {
    console.error('❌ Erro ao obter status de NFS-e:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/nfse/sincronizar
 * Dispara varredura automática unificada no Ambiente de Dados Nacional (ADN) e Prefeituras.
 */
router.post('/sincronizar', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activeEmpresaId = req.user?.empresaAtivaId;
    const { empresaId: bodyEmpresaId, tpAmb = '1', ultNSU = '0', conector = 'unificado' } = req.body;
    const empresaId = bodyEmpresaId || activeEmpresaId;
    const db = getDatabase();

    let cleanCnpj = '';
    if (empresaId) {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseAdmin();
        const { data: emp } = await supabase.from('empresas').select('cnpj_completo').eq('id', empresaId).maybeSingle();
        if (emp?.cnpj_completo) cleanCnpj = emp.cnpj_completo.replace(/\D/g, '');
      } else {
        try {
          const emp = db.prepare('SELECT cnpj_completo FROM empresas WHERE id = ?').get(empresaId) as any;
          if (emp?.cnpj_completo) cleanCnpj = emp.cnpj_completo.replace(/\D/g, '');
        } catch {
          // fallback
        }
      }
    }
    if (!cleanCnpj && req.user?.empresaCnpj) {
      cleanCnpj = req.user.empresaCnpj.replace(/\D/g, '');
    }

    if (!empresaId || !cleanCnpj) {
      res.status(400).json({ success: false, error: 'Empresa ativa ou CNPJ não identificado.' });
      return;
    }

    let syncResult;
    if (conector === 'unificado' || conector === 'todos' || !conector) {
      // Modo Topo de Linha: Varredura Automática Completa (ADN Nacional Matriz + Filiais + Prefeituras)
      syncResult = await sincronizarNfseUnificada({
        empresaId,
        tpAmb,
        incluirPrefeituras: true
      });
    } else if (conector === 'pmsp') {
      syncResult = await sincronizarNfsePMSP({
        empresaId,
        cnpj: cleanCnpj,
        tpAmb
      });
    } else {
      syncResult = await sincronizarNfseNacional({
        empresaId,
        cnpj: cleanCnpj,
        tpAmb,
        ultNSU
      });
    }

    res.json(syncResult);
  } catch (err: any) {
    console.error('❌ Erro na rota de sincronização de NFS-e:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/nfse/conectores
 * Lista todos os conectores municipais cadastrados no banco de dados.
 */
router.get('/conectores', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT 
        id,
        ibge,
        municipio,
        uf,
        provedor,
        tecnologia,
        endpoint_producao,
        endpoint_homologacao,
        tipo_autenticacao,
        token_api,
        usuario,
        status,
        created_at,
        updated_at
      FROM conectores_municipais
      ORDER BY uf ASC, municipio ASC
    `).all() as any[];

    const conectores = rows.map(r => ({
      id: r.id,
      ibge: r.ibge,
      municipio: r.municipio,
      uf: r.uf,
      provedor: r.provedor,
      tecnologia: r.tecnologia || 'SOAP',
      endpoint_producao: r.endpoint_producao || '',
      endpoint_homologacao: r.endpoint_homologacao || '',
      urlProducao: r.endpoint_producao || '',
      urlHomologacao: r.endpoint_homologacao || '',
      tipoAutenticacao: r.tipo_autenticacao || 'certificado_a1',
      token_api: r.token_api || '',
      usuario: r.usuario || '',
      status: r.status || 'ativo',
      credenciaisConfiguradas: !!(r.tipo_autenticacao === 'certificado_a1' || r.token_api || r.usuario)
    }));

    res.json({ success: true, conectores });
  } catch (err: any) {
    console.error('❌ Erro ao listar conectores municipais:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/nfse/conectores
 * Cadastra uma nova prefeitura / conector municipal.
 */
router.post('/conectores', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      ibge,
      municipio,
      uf,
      provedor,
      tecnologia = 'SOAP',
      endpoint_producao = '',
      endpoint_homologacao = '',
      tipo_autenticacao = 'certificado_a1',
      token_api = '',
      usuario = '',
      senha = '',
      status = 'ativo'
    } = req.body;

    if (!ibge || !municipio || !uf || !provedor) {
      res.status(400).json({ success: false, error: 'IBGE, Município, UF e Provedor são obrigatórios.' });
      return;
    }

    const cleanIbge = String(ibge).replace(/\D/g, '');
    if (cleanIbge.length !== 7) {
      res.status(400).json({ success: false, error: 'Código IBGE deve conter exatamente 7 dígitos numéricos.' });
      return;
    }

    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM conectores_municipais WHERE ibge = ?').get(cleanIbge) as any;
    if (existing) {
      res.status(409).json({ success: false, error: `Já existe um conector cadastrado para o código IBGE ${cleanIbge}.` });
      return;
    }

    const id = `con-${cleanIbge}-${crypto.randomUUID().substring(0, 8)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO conectores_municipais (
        id, ibge, municipio, uf, provedor, tecnologia,
        endpoint_producao, endpoint_homologacao,
        tipo_autenticacao, token_api, usuario, senha, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      cleanIbge,
      municipio.trim(),
      uf.toUpperCase().trim(),
      provedor.trim(),
      tecnologia,
      endpoint_producao.trim(),
      endpoint_homologacao.trim(),
      tipo_autenticacao,
      token_api.trim(),
      usuario.trim(),
      senha.trim(),
      status,
      now,
      now
    );

    res.status(201).json({
      success: true,
      message: 'Conector municipal cadastrado com sucesso.',
      conector: {
        id,
        ibge: cleanIbge,
        municipio,
        uf,
        provedor,
        tecnologia,
        endpoint_producao,
        endpoint_homologacao,
        tipoAutenticacao: tipo_autenticacao,
        status
      }
    });
  } catch (err: any) {
    console.error('❌ Erro ao cadastrar conector municipal:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/nfse/conectores/:id
 * Atualiza parâmetros, endpoints ou credenciais de um conector.
 */
router.put('/conectores/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      municipio,
      uf,
      provedor,
      tecnologia,
      endpoint_producao,
      endpoint_homologacao,
      tipo_autenticacao,
      token_api,
      usuario,
      senha,
      status
    } = req.body;

    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM conectores_municipais WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ success: false, error: 'Conector municipal não localizado.' });
      return;
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE conectores_municipais SET
        municipio = COALESCE(?, municipio),
        uf = COALESCE(?, uf),
        provedor = COALESCE(?, provedor),
        tecnologia = COALESCE(?, tecnologia),
        endpoint_producao = COALESCE(?, endpoint_producao),
        endpoint_homologacao = COALESCE(?, endpoint_homologacao),
        tipo_autenticacao = COALESCE(?, tipo_autenticacao),
        token_api = COALESCE(?, token_api),
        usuario = COALESCE(?, usuario),
        senha = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE senha END,
        status = COALESCE(?, status),
        updated_at = ?
      WHERE id = ?
    `).run(
      municipio ?? null,
      uf ?? null,
      provedor ?? null,
      tecnologia ?? null,
      endpoint_producao ?? null,
      endpoint_homologacao ?? null,
      tipo_autenticacao ?? null,
      token_api ?? null,
      usuario ?? null,
      senha ?? null,
      senha ?? null,
      senha ?? null,
      status ?? null,
      now,
      id
    );

    res.json({ success: true, message: 'Conector municipal atualizado com sucesso.' });
  } catch (err: any) {
    console.error('❌ Erro ao atualizar conector municipal:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/nfse/conectores/:id
 * Remove um conector municipal.
 */
router.delete('/conectores/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const result = db.prepare('DELETE FROM conectores_municipais WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ success: false, error: 'Conector não encontrado para exclusão.' });
      return;
    }
    res.json({ success: true, message: 'Conector municipal excluído com sucesso.' });
  } catch (err: any) {
    console.error('❌ Erro ao excluir conector municipal:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
