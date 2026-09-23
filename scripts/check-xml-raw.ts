import { getSupabaseAdmin, isSupabaseConfigured } from '../server/db/supabase';

async function main() {
  if (!isSupabaseConfigured()) {
    console.log('Supabase não configurado');
    process.exit(1);
  }
  const supa = getSupabaseAdmin()!;
  
  const { data: carteira } = await supa.from('carteira_cnpjs').select('id, cnpj, razao_social');
  console.log('Empresas em carteira_cnpjs:', carteira);

  const { data: sampleDocs } = await supa.from('dfe_documentos').select('empresa_id').limit(3);
  console.log('Sample empresa_id em dfe_documentos:', sampleDocs);

  process.exit(0);
}

main();
