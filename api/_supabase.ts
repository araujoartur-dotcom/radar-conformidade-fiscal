import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export function getSupabase() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');

  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!url || !key) {
    throw new Error(`SUPABASE_URL ou Chave ausente no ambiente da Vercel. Verifique as Environment Variables do projeto.`);
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function verifyAuthToken(req: any) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET || 'dev-secret-radar-fiscal-change-in-production-2026';
  try {
    return jwt.verify(token, secret) as {
      userId: string;
      email: string;
      perfil: string;
      empresaAtivaId: string;
      empresaCnpj: string;
    };
  } catch {
    return null;
  }
}

export function handleCors(req: any, res: any): boolean {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}
