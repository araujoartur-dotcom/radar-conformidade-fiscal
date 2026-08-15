export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const envKeys = Object.keys(process.env).filter(k => 
    !k.toLowerCase().includes('secret') && 
    !k.toLowerCase().includes('key') && 
    !k.toLowerCase().includes('pass') &&
    !k.toLowerCase().includes('token')
  );

  return res.status(200).json({
    status: 'ok',
    version: '2.5.0',
    app: 'Radar de Conformidade Fiscal',
    supabaseConfigured: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    detectedEnvKeys: envKeys,
    timestamp: new Date().toISOString(),
  });
}
