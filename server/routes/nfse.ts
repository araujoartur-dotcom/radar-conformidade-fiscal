/**
 * ============================================================
 * ROTAS DE NFS-E (SERVIÇOS) — RADAR FISCAL
 * ============================================================
 * Endpoints para busca, sincronização e auditoria de NFS-e
 * integrados ao Ambiente de Dados Nacional (ADN) e Prefeituras.
 * ============================================================
 */

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

export default router;
