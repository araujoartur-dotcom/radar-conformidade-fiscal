import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, verifyAuthToken, handleCors } from './_supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const authUser = verifyAuthToken(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Não autenticado.', code: 'AUTH_REQUIRED' });
  }

  const supabase = getSupabase();

  // GET /api/tenants
  if (req.method === 'GET') {
    try {
      const { data: rows, error } = await supabase
        .from('empresas')
        .select('*, certificados (*)')
        .order('created_at', { ascending: false });

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

      return res.status(200).json({ success: true, data: formatted });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro ao listar empresas: ' + err.message });
    }
  }

  // POST /api/tenants
  if (req.method === 'POST') {
    try {
      const { cnpjCompleto, razaoSocial, nomeFantasia, uf, regimeTributario, grupoContabilCliente } = req.body || {};
      if (!cnpjCompleto || !razaoSocial) {
        return res.status(400).json({ success: false, message: 'CNPJ e Razão Social são obrigatórios.' });
      }

      const cleanCnpj = cnpjCompleto.replace(/\D/g, '');
      const cnpjRaiz = cleanCnpj.substring(0, 8);

      const { data: newEmp, error: insertErr } = await supabase
        .from('empresas')
        .insert({
          cnpj_raiz: cnpjRaiz,
          cnpj_completo: cnpjCompleto,
          razao_social: razaoSocial.toUpperCase(),
          nome_fantasia: (nomeFantasia || razaoSocial).toUpperCase(),
          uf: uf || 'SP',
          regime_tributario: regimeTributario || 'Lucro Real',
          status: 'ativo'
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      if (authUser.userId) {
        await supabase.from('usuario_empresa').insert({
          usuario_id: authUser.userId,
          empresa_id: newEmp.id,
          permissao: 'total',
          modulos_permitidos: '*'
        });
      }

      return res.status(201).json({
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
          statusConexaoSefaz: 'sem_certificado',
          totalDocumentosCapturados: 0,
          ultimaSincronizacao: 'Cadastrado agora'
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro ao cadastrar empresa: ' + err.message });
    }
  }

  // PUT /api/tenants
  if (req.method === 'PUT') {
    try {
      const { id, razaoSocial, nomeFantasia, uf, regimeTributario } = req.body || {};
      const targetId = id || req.query.id;
      if (!targetId) {
        return res.status(400).json({ success: false, message: 'ID da empresa é obrigatório.' });
      }

      const { error } = await supabase
        .from('empresas')
        .update({
          razao_social: (razaoSocial || '').toUpperCase(),
          nome_fantasia: (nomeFantasia || razaoSocial || '').toUpperCase(),
          uf,
          regime_tributario: regimeTributario,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetId);

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Dados da empresa atualizados com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro ao atualizar empresa: ' + err.message });
    }
  }

  // DELETE /api/tenants
  if (req.method === 'DELETE') {
    try {
      const targetId = req.body?.id || req.query.id;
      if (!targetId) {
        return res.status(400).json({ success: false, message: 'ID da empresa é obrigatório.' });
      }

      await supabase.from('usuario_empresa').delete().eq('empresa_id', targetId);
      await supabase.from('certificados').delete().eq('empresa_id', targetId);
      const { error } = await supabase.from('empresas').delete().eq('id', targetId);
      if (error) throw error;

      return res.status(200).json({ success: true, message: 'Empresa removida com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro ao remover empresa: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
