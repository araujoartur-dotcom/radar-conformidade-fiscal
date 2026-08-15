import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { getSupabase, verifyAuthToken, handleCors } from '../_supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const authUser = verifyAuthToken(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Token de acesso inválido ou expirado.', code: 'AUTH_INVALID_TOKEN' });
  }

  const { empresaId } = req.body || {};
  if (!empresaId) {
    return res.status(400).json({ error: 'empresaId é obrigatório.' });
  }

  try {
    const supabase = getSupabase();
    const { data: empresa, error } = await supabase
      .from('empresas')
      .select('*')
      .eq('id', empresaId)
      .eq('status', 'ativo')
      .single();

    if (error || !empresa) {
      return res.status(403).json({ error: 'Sem acesso a esta empresa ou empresa inativa.', code: 'AUTH_NO_TENANT_ACCESS' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'dev-secret-radar-fiscal-change-in-production-2026';
    const payload = {
      userId: authUser.userId,
      email: authUser.email,
      perfil: authUser.perfil,
      empresaAtivaId: empresa.id,
      empresaCnpj: empresa.cnpj_completo,
    };

    const accessToken = jwt.sign(payload, jwtSecret, { expiresIn: '8h' });

    return res.status(200).json({
      accessToken,
      empresaAtiva: {
        id: empresa.id,
        cnpjRaiz: empresa.cnpj_raiz,
        cnpjCompleto: empresa.cnpj_completo,
        razaoSocial: empresa.razao_social,
        nomeFantasia: empresa.nome_fantasia || empresa.razao_social,
        uf: empresa.uf,
        regimeTributario: empresa.regime_tributario,
        permissao: 'total',
        modulosPermitidos: '*',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao trocar empresa: ' + err.message });
  }
}
