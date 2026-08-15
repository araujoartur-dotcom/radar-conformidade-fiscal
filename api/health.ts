import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './_supabase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  return res.status(200).json({
    status: 'ok',
    version: '2.5.0',
    app: 'Radar de Conformidade Fiscal',
    timestamp: new Date().toISOString(),
  });
}
