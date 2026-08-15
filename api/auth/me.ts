import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, verifyAuthToken, handleCors } from '../_supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const authUser = verifyAuthToken(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Token de acesso inválido ou expirado.', code: 'AUTH_INVALID_TOKEN' });
  }

  try {
    const supabase = getSupabase();
    const { data: user, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, perfil, mfa_habilitado, status, ultimo_acesso')
      .eq('id', authUser.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    return res.status(200).json({
      usuario: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil,
        mfaHabilitado: Boolean(user.mfa_habilitado),
        status: user.status,
        ultimoAcesso: user.ultimo_acesso,
      },
      empresaAtiva: authUser.empresaAtivaId ? {
        id: authUser.empresaAtivaId,
        cnpjCompleto: authUser.empresaCnpj,
      } : null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar dados do usuário: ' + err.message });
  }
}
