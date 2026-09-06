import dotenv from 'dotenv';
dotenv.config();
import { getSupabaseAdmin } from '../server/db/supabase.ts';

async function migrateEmpresas() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.log('Supabase client failed');
    return;
  }
  
  const sql = `
    ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS natureza_juridica_codigo VARCHAR(20) DEFAULT NULL;
    ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS natureza_juridica_desc VARCHAR(200) DEFAULT NULL;
    ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS cnae_principal VARCHAR(20) DEFAULT NULL;
    ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS inscricao_suframa VARCHAR(20) DEFAULT NULL;
    ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS grupo_contabil VARCHAR(100) DEFAULT NULL;
    NOTIFY pgrst, 'reload schema';
  `;

  try {
    // We try RPC if exec_sql exists
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
      console.log('Error executing via RPC, you might need to run manually:', error.message);
      console.log('SQL:\n', sql);
    } else {
      console.log('Success!', data);
    }
  } catch (e) {
    console.error('Catch error:', e.message);
  }
}

migrateEmpresas();
