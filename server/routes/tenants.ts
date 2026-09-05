/**
 * ============================================================
 * ROTAS DE TENANTS (EMPRESAS) — CRUD PERSISTENTE & RBAC
 * ============================================================
 * Gerencia empresas com isolamento multi-tenant estrito:
 * - admin_master: visualiza e gerencia todas as empresas.
 * - Usuários regulares: visualizam apenas empresas autorizadas em usuario_empresa.
 * - Padronizado para Horário Oficial de Brasília.
 * ============================================================
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';
import { AuthenticatedRequest, requireAuth, requirePerfil, logAuditAction } from '../middleware/auth';
import { getBrasiliaTimestamp } from '../utils/timezone';

const router = Router();

// =========================================================
// GET /api/tenants - Listar empresas autorizadas do usuário
// =========================================================
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isSuperadmin = req.user?.perfil === 'admin_master';
    const userId = req.user?.userId;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        let query = supabase.from('empresas').select('*, certificados (*)').order('created_at', { ascending: false });
        
        if (!isSuperadmin && userId) {
          const { data: vinculos } = await supabase.from('usuario_empresa').select('empresa_id').eq('usuario_id', userId);
          const empIds = (vinculos || []).map(v => v.empresa_id);
          query = query.in('id', empIds);
        }

        const { data: rows, error } = await query;
        if (error) throw error;

        const formatted = (rows || []).map((r: any) => {
          const cert = Array.isArray(r.certificados) ? r.certificados[0] : r.certificados;
          return {
            id: r.id,
            cnpjRaiz: r.cnpj_raiz,
            cnpjCompleto: r.cnpj_completo,
            razaoSocial: r.razao_social,
            nomeFantasia: r.nome_fantasia || r.razao_social,
            grupoContabilCliente: 'Carteira Geral',
            uf: r.uf,
            regimeTributario: r.regime_tributario,
            manifestarCienciaAutomatica: r.manifestar_ciencia_automatica !== undefined ? Boolean(r.manifestar_ciencia_automatica) : true,
            ultimoNsu: r.ultimo_nsu || '000000000000000',
            maxNsu: r.max_nsu || '000000000000000',
            certificadoA1: cert ? {
              fileName: cert.arquivo_nome,
              validade: cert.validade,
              status: cert.status_alerta === 'ok' ? 'valido' : (cert.status_alerta === 'expirado' ? 'expirado' : 'pendente'),
              emissor: cert.emissor || 'AC Certificadora A1',
              impressaoDigital: cert.impressao_digital || ''
            } : undefined,
            totalDocumentosCapturados: 0,
            statusConexaoSefaz: cert ? 'ativo' : 'sem_certificado',
            ultimaSincronizacao: cert ? 'Certificado Ativo' : 'Sem Certificado'
          };
        });

        res.json({ success: true, data: formatted });
        return;
      }
    }

    const db = getDatabase();
    let rows: any[] = [];

    if (isSuperadmin) {
      rows = db.prepare(`
        SELECT 
          e.*,
          c.arquivo_nome as cert_file_name,
          c.validade as cert_validade,
          c.status_alerta as cert_status,
          c.emissor as cert_emissor,
          c.impressao_digital as cert_fingerprint
        FROM empresas e
        LEFT JOIN certificados c ON c.empresa_id = e.id
        ORDER BY e.created_at DESC
      `).all() as any[];
    } else {
      rows = db.prepare(`
        SELECT 
          e.*,
          c.arquivo_nome as cert_file_name,
          c.validade as cert_validade,
          c.status_alerta as cert_status,
          c.emissor as cert_emissor,
          c.impressao_digital as cert_fingerprint
        FROM empresas e
        INNER JOIN usuario_empresa ue ON ue.empresa_id = e.id
        LEFT JOIN certificados c ON c.empresa_id = e.id
        WHERE ue.usuario_id = ?
        ORDER BY e.created_at DESC
      `).all(userId) as any[];
    }

    const formatted = rows.map((r: any) => ({
      id: r.id,
      cnpjRaiz: r.cnpj_raiz,
      cnpjCompleto: r.cnpj_completo,
      razaoSocial: r.razao_social,
      nomeFantasia: r.nome_fantasia || r.razao_social,
      grupoContabilCliente: 'Carteira Geral',
      uf: r.uf,
      regimeTributario: r.regime_tributario,
      manifestarCienciaAutomatica: r.manifestar_ciencia_automatica !== undefined ? Boolean(r.manifestar_ciencia_automatica) : true,
      ultimoNsu: r.ultimo_nsu || '000000000000000',
      maxNsu: r.max_nsu || '000000000000000',
      certificadoA1: r.cert_file_name ? {
        fileName: r.cert_file_name,
        validade: r.cert_validade,
        status: r.cert_status === 'ok' ? 'valido' : (r.cert_status === 'expirado' ? 'expirado' : 'pendente'),
        emissor: r.cert_emissor || 'AC Certificadora A1',
        impressaoDigital: r.cert_fingerprint || ''
      } : undefined,
      totalDocumentosCapturados: 0,
      statusConexaoSefaz: r.cert_file_name ? 'ativo' : 'sem_certificado',
      ultimaSincronizacao: r.cert_file_name ? 'Certificado Ativo' : 'Sem Certificado'
    }));

    res.json({ success: true, data: formatted });
  } catch (err: any) {
    console.error('❌ Erro ao listar tenants:', err.message);
    res.status(500).json({ success: false, message: 'Erro ao listar empresas: ' + err.message });
  }
});

// =========================================================
// POST /api/tenants - Criar nova empresa (Matriz ou Filial)
// =========================================================
router.post('/', requireAuth, requirePerfil('admin_master', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cnpjCompleto, razaoSocial, nomeFantasia, uf, regimeTributario, grupoContabilCliente, manifestarCienciaAutomatica } = req.body;
    if (!cnpjCompleto || !razaoSocial) {
      res.status(400).json({ success: false, message: 'CNPJ e Razão Social são obrigatórios.' });
      return;
    }

    const cleanCnpj = cnpjCompleto.replace(/\D/g, '');
    const cnpjRaiz = cleanCnpj.substring(0, 8);
    const id = uuidv4();
    const autoCiencia = manifestarCienciaAutomatica !== false ? 1 : 0;
    const brasiliaNow = getBrasiliaTimestamp();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const insertPayload = {
          cnpj_raiz: cnpjRaiz,
          cnpj_completo: cnpjCompleto,
          razao_social: razaoSocial.toUpperCase(),
          nome_fantasia: (nomeFantasia || razaoSocial).toUpperCase(),
          uf: uf || 'SP',
          regime_tributario: regimeTributario || 'Lucro Real',
          status: 'ativo',
          created_at: brasiliaNow,
          updated_at: brasiliaNow,
        };

        const { data: newEmp, error: insertErr } = await supabase
          .from('empresas')
          .insert(insertPayload)
          .select()
          .single();

        if (insertErr) throw insertErr;

        if (req.user?.userId) {
          await supabase.from('usuario_empresa').insert({
            usuario_id: req.user.userId,
            empresa_id: newEmp.id,
            permissao: 'total',
            modulos_permitidos: '*',
            created_at: brasiliaNow,
          });
        }

        res.status(201).json({
          success: true,
          message: 'Empresa cadastrada com sucesso.',
          data: {
            id: newEmp.id,
            cnpjRaiz,
            cnpjCompleto,
            razaoSocial: razaoSocial.toUpperCase(),
            nomeFantasia: (nomeFantasia || razaoSocial).toUpperCase(),
            grupoContabilCliente: grupoContabilCliente || 'Carteira Geral',
            uf: uf || 'SP',
            regimeTributario: regimeTributario || 'Lucro Real',
            manifestarCienciaAutomatica: Boolean(autoCiencia),
            statusConexaoSefaz: 'sem_certificado',
            totalDocumentosCapturados: 0,
            ultimaSincronizacao: 'Cadastrado agora'
          }
        });
        return;
      }
    }

    const db = getDatabase();

    const existing = db.prepare('SELECT id FROM empresas WHERE cnpj_completo = ?').get(cnpjCompleto) as any;
    if (existing) {
      res.status(409).json({ success: false, message: `CNPJ ${cnpjCompleto} já cadastrado no sistema.` });
      return;
    }

    db.transaction(() => {
      db.prepare(`
        INSERT INTO empresas (id, cnpj_raiz, cnpj_completo, razao_social, nome_fantasia, uf, regime_tributario, manifestar_ciencia_automatica, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ativo', ?, ?)
      `).run(
        id,
        cnpjRaiz,
        cnpjCompleto,
        razaoSocial.toUpperCase(),
        (nomeFantasia || razaoSocial).toUpperCase(),
        uf || 'SP',
        regimeTributario || 'Lucro Real',
        autoCiencia,
        brasiliaNow,
        brasiliaNow
      );

      if (req.user?.userId) {
        const vinculoId = uuidv4();
        db.prepare(`
          INSERT OR IGNORE INTO usuario_empresa (id, usuario_id, empresa_id, permissao, modulos_permitidos, created_at)
          VALUES (?, ?, ?, 'total', '*', ?)
        `).run(vinculoId, req.user.userId, id, brasiliaNow);
      }
    })();

    logAuditAction(req, 'TENANT_CRIAR', `Empresa ${razaoSocial} (${cnpjCompleto}) cadastrada na carteira`);

    res.status(201).json({
      success: true,
      message: 'Empresa cadastrada com sucesso.',
      data: {
        id,
        cnpjRaiz,
        cnpjCompleto,
        razaoSocial: razaoSocial.toUpperCase(),
        nomeFantasia: (nomeFantasia || razaoSocial).toUpperCase(),
        grupoContabilCliente: grupoContabilCliente || 'Carteira Geral',
        uf: uf || 'SP',
        regimeTributario: regimeTributario || 'Lucro Real',
        manifestarCienciaAutomatica: Boolean(autoCiencia),
        statusConexaoSefaz: 'sem_certificado',
        totalDocumentosCapturados: 0,
        ultimaSincronizacao: 'Cadastrado agora'
      }
    });
  } catch (err: any) {
    console.error('❌ Erro ao cadastrar tenant:', err.message);
    res.status(500).json({ success: false, message: 'Erro ao cadastrar empresa: ' + err.message });
  }
});

// =========================================================
// PUT /api/tenants/:id - Editar empresa
// =========================================================
router.put('/:id', requireAuth, requirePerfil('admin_master', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { razaoSocial, nomeFantasia, uf, regimeTributario, manifestarCienciaAutomatica } = req.body;
    const autoCiencia = manifestarCienciaAutomatica !== false ? 1 : 0;
    const brasiliaNow = getBrasiliaTimestamp();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { error: updateErr } = await supabase
          .from('empresas')
          .update({
            razao_social: (razaoSocial || '').toUpperCase(),
            nome_fantasia: (nomeFantasia || razaoSocial || '').toUpperCase(),
            uf: uf || 'SP',
            regime_tributario: regimeTributario || 'Lucro Real',
            manifestar_ciencia_automatica: Boolean(autoCiencia),
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (updateErr) {
          console.error('❌ Erro ao editar empresa no Supabase:', updateErr.message);
          res.status(500).json({ success: false, message: updateErr.message });
          return;
        }

        logAuditAction(req, 'TENANT_EDITAR', `Empresa ID ${id} atualizada no Supabase`);
        res.json({ success: true, message: 'Dados da empresa atualizados com sucesso.' });
        return;
      }
    }

    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM empresas WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Empresa não encontrada.' });
      return;
    }

    db.prepare(`
      UPDATE empresas 
      SET razao_social = ?, nome_fantasia = ?, uf = ?, regime_tributario = ?, manifestar_ciencia_automatica = ?, updated_at = ?
      WHERE id = ?
    `).run(
      (razaoSocial || '').toUpperCase(),
      (nomeFantasia || razaoSocial || '').toUpperCase(),
      uf || 'SP',
      regimeTributario || 'Lucro Real',
      autoCiencia,
      brasiliaNow,
      id
    );

    logAuditAction(req, 'TENANT_EDITAR', `Empresa ID ${id} atualizada`);
    res.json({ success: true, message: 'Dados da empresa atualizados com sucesso.' });
  } catch (err: any) {
    console.error('❌ Erro ao editar tenant:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================
// DELETE /api/tenants/:id - Excluir empresa
// =========================================================
router.delete('/:id', requireAuth, requirePerfil('admin_master', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        // Remover dependências da empresa
        await supabase.from('certificados').delete().eq('empresa_id', id);
        await supabase.from('usuario_empresa').delete().eq('empresa_id', id);
        await supabase.from('eventos_transmitidos').delete().eq('empresa_id', id);
        await supabase.from('dfe_documentos').delete().eq('empresa_id', id);
        await supabase.from('sessoes').update({ empresa_ativa_id: null }).eq('empresa_ativa_id', id);

        const { error: delErr } = await supabase.from('empresas').delete().eq('id', id);
        if (delErr) {
          console.error('❌ Erro ao excluir empresa do Supabase:', delErr.message);
          res.status(500).json({ success: false, message: 'Erro ao excluir empresa: ' + delErr.message });
          return;
        }

        logAuditAction(req, 'TENANT_EXCLUIR', `Empresa ID ${id} excluída do Supabase`);
        res.json({ success: true, message: 'Empresa e dados associados excluídos com sucesso.' });
        return;
      }
    }

    const db = getDatabase();

    db.transaction(() => {
      db.prepare('DELETE FROM certificados WHERE empresa_id = ?').run(id);
      db.prepare('DELETE FROM usuario_empresa WHERE empresa_id = ?').run(id);
      db.prepare('DELETE FROM eventos_transmitidos WHERE empresa_id = ?').run(id);
      db.prepare('DELETE FROM dfe_documentos WHERE empresa_id = ?').run(id);
      db.prepare('DELETE FROM empresas WHERE id = ?').run(id);
    })();

    logAuditAction(req, 'TENANT_EXCLUIR', `Empresa ID ${id} excluída do sistema`);
    res.json({ success: true, message: 'Empresa e dados associados excluídos com sucesso.' });
  } catch (err: any) {
    console.error('❌ Erro ao excluir tenant:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
