import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, verifyAuthToken, handleCors } from '../_supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const authUser = verifyAuthToken(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Não autenticado.', code: 'AUTH_REQUIRED' });
  }

  const supabase = getSupabase();

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('cfop_tratamento')
        .select('*')
        .eq('ativo', true)
        .order('cfop');

      if (error) throw error;
      return res.status(200).json({ success: true, data: data || [], total: (data || []).length });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro ao listar CFOPs: ' + err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { cfop, descricao, categoria, tratamento_padrao, exige_onerosidade, evidencia_minima, global } = req.body || {};
      if (!cfop || !descricao) {
        return res.status(400).json({ error: 'cfop e descricao são obrigatórios.' });
      }

      const empresaId = global ? null : authUser.empresaAtivaId;
      const { data, error } = await supabase
        .from('cfop_tratamento')
        .insert({
          empresa_id: empresaId,
          cfop,
          descricao,
          categoria: categoria || 'Compra',
          tratamento_padrao: tratamento_padrao || 'Depende',
          exige_onerosidade: Boolean(exige_onerosidade),
          evidencia_minima: evidencia_minima || ''
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ success: true, id: data.id, message: 'CFOP criado com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro ao criar CFOP: ' + err.message });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, cfop, descricao, categoria, tratamento_padrao, exige_onerosidade, evidencia_minima } = req.body || {};
      const targetId = id || req.query.id;
      if (!targetId) {
        return res.status(400).json({ error: 'ID do CFOP é obrigatório.' });
      }

      const { error } = await supabase
        .from('cfop_tratamento')
        .update({
          cfop,
          descricao,
          categoria,
          tratamento_padrao,
          exige_onerosidade: Boolean(exige_onerosidade),
          evidencia_minima,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetId);

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'CFOP atualizado com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro ao atualizar CFOP: ' + err.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const targetId = req.body?.id || req.query.id;
      if (!targetId) {
        return res.status(400).json({ error: 'ID do CFOP é obrigatório.' });
      }

      const { error } = await supabase
        .from('cfop_tratamento')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('id', targetId);

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'CFOP desativado com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro ao excluir CFOP: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
