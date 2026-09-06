import { getSupabaseAdmin } from '../server/db/supabase';
import { getDatabase } from '../server/db/database';

async function main() {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from('empresas')
      .update({ ultimo_nsu_nfse: '0', max_nsu_nfse: '0' })
      .eq('cnpj_raiz', '19791896')
      .select();
    console.log('Reset Supabase resultado:', data, error);
  }

  try {
    const db = getDatabase();
    db.prepare("UPDATE empresas SET ultimo_nsu_nfse = '0', max_nsu_nfse = '0' WHERE cnpj_raiz = '19791896'").run();
    console.log('Reset SQLite OK');
  } catch (err: any) {
    console.log('SQLite:', err.message);
  }
}

main();
