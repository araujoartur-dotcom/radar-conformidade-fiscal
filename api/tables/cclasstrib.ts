import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, verifyAuthToken, handleCors } from '../_supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const authUser = verifyAuthToken(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Não autenticado.', code: 'AUTH_REQUIRED' });
  }

  const supabase = getSupabase();

  try {
    const { data, error } = await supabase
      .from('cclasstrib_regras')
      .select('*')
      .eq('ativo', true)
      .order('cclasstrib');

    if (error) throw error;
    return res.status(200).json({ success: true, data: data || [], total: (data || []).length });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Erro ao listar cClassTrib: ' + err.message });
  }
}
