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
      const { competencia, tipo_tributo } = req.query;
      let q = supabase.from('aliquotas_referencia').select('*');
      if (competencia) {
        q = q.lte('competencia_inicio', String(competencia));
      }
      if (tipo_tributo) {
        q = q.eq('tipo_tributo', String(tipo_tributo));
      }
      const { data, error } = await q.order('competencia_inicio', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ success: true, data: data || [], total: (data || []).length });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro ao listar alíquotas: ' + err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { competencia_inicio, competencia_fim, tipo_tributo, aliquota_referencia, descricao, base_legal, fase_transicao } = req.body || {};
      if (!competencia_inicio || !tipo_tributo || aliquota_referencia === undefined) {
        return res.status(400).json({ error: 'competencia_inicio, tipo_tributo e aliquota_referencia são obrigatórios.' });
      }

      const { error } = await supabase
        .from('aliquotas_referencia')
        .upsert({
          competencia_inicio,
          competencia_fim: competencia_fim || null,
          tipo_tributo,
          aliquota_referencia,
          descricao: descricao || '',
          base_legal: base_legal || '',
          fase_transicao: fase_transicao || '',
          updated_at: new Date().toISOString()
        }, { onConflict: 'competencia_inicio,tipo_tributo' });

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Alíquota gravada com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro ao gravar alíquota: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
