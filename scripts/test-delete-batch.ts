import { getSupabaseAdmin } from '../server/db/supabase';

async function main() {
  const supa = getSupabaseAdmin()!;
  const { count } = await supa.from('dfe_itens').select('*', { count: 'exact', head: true });
  console.log('Total de dfe_itens restante no Supabase:', count);
}

main();
