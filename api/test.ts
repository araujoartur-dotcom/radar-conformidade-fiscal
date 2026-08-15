import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const hasSupabase = typeof createClient === 'function';
    const hasBcrypt = typeof bcrypt.compareSync === 'function';
    const hasJwt = typeof jwt.sign === 'function';
    const hasUuid = typeof uuid === 'function';

    const rawUrl = (process.env.SUPABASE_URL || '').trim();
    const cleanUrl = rawUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

    let supabaseTest = 'not_run';
    let userCount = 0;
    if (cleanUrl && key) {
      const client = createClient(cleanUrl, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, count, error } = await client.from('usuarios').select('id', { count: 'exact' });
      if (error) {
        supabaseTest = 'error: ' + error.message;
      } else {
        supabaseTest = 'connected_ok';
        userCount = count || (data ? data.length : 0);
      }
    }

    return res.status(200).json({
      status: 'ok',
      hasSupabase,
      hasBcrypt,
      hasJwt,
      hasUuid,
      supabaseUrlProvided: Boolean(cleanUrl),
      supabaseUrlValue: cleanUrl ? cleanUrl.substring(0, 15) + '...' : 'empty',
      supabaseKeyLength: key.length,
      supabaseTest,
      userCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
