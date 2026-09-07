import dotenv from 'dotenv';
dotenv.config();
import { getSupabaseAdmin } from '../server/db/supabase.ts';

async function run() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return console.log('No supabase client');

  const sql = `
    CREATE TABLE IF NOT EXISTS public.regras_retencao_servicos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      item_lc116 VARCHAR(50),
      descricao_item TEXT,
      nbs VARCHAR(50),
      descricao_nbs TEXT,
      ps_onerosa BOOLEAN,
      adq_exterior BOOLEAN,
      indop VARCHAR(50),
      local_incidencia_ibs VARCHAR(255),
      cclasstrib VARCHAR(50),
      nome_cclasstrib TEXT,
      irrf VARCHAR(20),
      csrf VARCHAR(20),
      inss VARCHAR(20),
      iss VARCHAR(20),
      cosirf_orgaos_publicos VARCHAR(20),
      fundamentos_legais TEXT,
      tipo_operacao VARCHAR(255),
      caracteristica_fornecimento TEXT,
      local_fornecimento TEXT,
      dispositivo_legal_lc214 TEXT,
      observacao TEXT,
      indnfe VARCHAR(20),
      indnfse VARCHAR(20),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    NOTIFY pgrst, 'reload schema';
  `;
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    console.log(error || 'Success');
  } catch (e) { console.error(e.message); }
}
run();
