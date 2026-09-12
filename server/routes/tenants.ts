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

        const db = getDatabase();
        const formatted = (rows || []).map((r: any) => {
          const certList = Array.isArray(r.certificados) ? r.certificados : (r.certificados ? [r.certificados] : []);
          // Prioriza o certificado ativo com status_alerta === 'ok', ou o mais recente cadastrado
          const cert = certList.find((c: any) => c.status_alerta === 'ok') ||
                       certList.slice().sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
          
          const isValido = cert && (cert.status_alerta === 'ok' || (cert.validade && new Date(cert.validade) >= new Date()));

          if (cert) {
            try {
              db.prepare(`
                INSERT OR REPLACE INTO certificados (id, empresa_id, arquivo_nome, validade, status_alerta, emissor, impressao_digital, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
              `).run(cert.id, r.id, cert.arquivo_nome, cert.validade, cert.status_alerta || 'ok', cert.emissor || 'AC Certificadora A1', cert.impressao_digital || '');
            } catch {}
          }

          return {
            id: r.id,
            cnpjRaiz: r.cnpj_raiz,
            cnpjCompleto: r.cnpj_completo,
            razaoSocial: r.razao_social,
            nomeFantasia: r.nome_fantasia || r.razao_social,
            grupoContabilCliente: 'Carteira Geral',
            uf: r.uf,
            regimeTributario: r.regime_tributario,
            naturezaJuridica: r.natureza_juridica_desc,
            codigoNaturezaJuridica: r.natureza_juridica_codigo,
            manifestarCienciaAutomatica: r.manifestar_ciencia_automatica !== undefined ? Boolean(r.manifestar_ciencia_automatica) : true,
            ultimoNsu: r.ultimo_nsu || '000000000000000',
            maxNsu: r.max_nsu || '000000000000000',
            certificadoA1: cert ? {
              fileName: cert.arquivo_nome,
              validade: cert.validade,
              status: isValido ? 'valido' : (cert.status_alerta === 'expirado' ? 'expirado' : 'pendente'),
              emissor: cert.emissor || 'AC Certificadora A1',
              impressaoDigital: cert.impressao_digital || ''
            } : undefined,
            totalDocumentosCapturados: 0,
            statusConexaoSefaz: isValido ? 'ativo' : (cert ? 'pendente' : 'sem_certificado'),
            ultimaSincronizacao: isValido ? 'Certificado Ativo' : (cert ? 'Certificado Pendente' : 'Sem Certificado')
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
        LEFT JOIN certificados c ON c.empresa_id = e.id AND (c.status_alerta = 'ok' OR c.status_alerta IS NULL)
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
        LEFT JOIN certificados c ON c.empresa_id = e.id AND (c.status_alerta = 'ok' OR c.status_alerta IS NULL)
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
      naturezaJuridica: r.natureza_juridica_desc,
      codigoNaturezaJuridica: r.natureza_juridica_codigo,
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
    const { cnpjCompleto, razaoSocial, nomeFantasia, uf, regimeTributario, grupoContabilCliente, manifestarCienciaAutomatica, naturezaJuridica, codigoNaturezaJuridica } = req.body;
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
          natureza_juridica_desc: naturezaJuridica || null,
          natureza_juridica_codigo: codigoNaturezaJuridica || null,
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
      // Usamos try-catch interno para ignorar erro caso a coluna não exista no SQLite antigo
      try {
        db.prepare(`
          INSERT INTO empresas (id, cnpj_raiz, cnpj_completo, razao_social, nome_fantasia, uf, regime_tributario, natureza_juridica_desc, natureza_juridica_codigo, manifestar_ciencia_automatica, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo', ?, ?)
        `).run(
          id,
          cnpjRaiz,
          cnpjCompleto,
          razaoSocial.toUpperCase(),
          (nomeFantasia || razaoSocial).toUpperCase(),
          uf || 'SP',
          regimeTributario || 'Lucro Real',
          naturezaJuridica || null,
          codigoNaturezaJuridica || null,
          autoCiencia,
          brasiliaNow,
          brasiliaNow
        );
      } catch (err) {
        // Fallback for older schema without natureza_juridica
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
      }

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
        naturezaJuridica: naturezaJuridica || '',
        codigoNaturezaJuridica: codigoNaturezaJuridica || '',
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
router.put('/:id', requireAuth, requirePerfil('admin_master', 'suporte_ti', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user?.perfil !== 'admin_master') {
      const db = getDatabase();
      const vinculo = db.prepare('SELECT id FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ?').get(req.user!.userId, id);
      if (!vinculo && req.user?.empresaAtivaId !== id) {
        return res.status(403).json({ success: false, message: 'Você não tem permissão para editar esta empresa (fora do seu escopo).' });
      }
    }

    const { razaoSocial, nomeFantasia, uf, regimeTributario, manifestarCienciaAutomatica, naturezaJuridica, codigoNaturezaJuridica } = req.body;
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
            natureza_juridica_desc: naturezaJuridica || null,
            natureza_juridica_codigo: codigoNaturezaJuridica || null,
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

    try {
      db.prepare(`
        UPDATE empresas 
        SET razao_social = ?, nome_fantasia = ?, uf = ?, regime_tributario = ?, natureza_juridica_desc = ?, natureza_juridica_codigo = ?, manifestar_ciencia_automatica = ?, updated_at = ?
        WHERE id = ?
      `).run(
        (razaoSocial || '').toUpperCase(),
        (nomeFantasia || razaoSocial || '').toUpperCase(),
        uf || 'SP',
        regimeTributario || 'Lucro Real',
        naturezaJuridica || null,
        codigoNaturezaJuridica || null,
        autoCiencia,
        brasiliaNow,
        id
      );
    } catch (err) {
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
    }

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
