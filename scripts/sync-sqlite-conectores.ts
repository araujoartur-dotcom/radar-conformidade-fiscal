import { getDatabase } from '../server/db/database';
import { initializeSchema } from '../server/db/schema';

async function syncSqlite() {
  const db = getDatabase();
  initializeSchema();

  // Ler do seed do supabase para popular sqlite também
  const { CONECTORES_SEEDS } = await import('./seed-conectores-supabase.js').catch(async () => {
    return await import('./seed-conectores-supabase.ts');
  });

  console.log(`Sincronizando ${CONECTORES_SEEDS.length} conectores no SQLite local...`);

  const stmt = db.prepare(`
    INSERT INTO conectores_municipais (
      id, ibge, municipio, uf, provedor, tecnologia, endpoint_producao, endpoint_homologacao, tipo_autenticacao, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(ibge) DO UPDATE SET
      municipio = excluded.municipio,
      uf = excluded.uf,
      provedor = excluded.provedor,
      tecnologia = excluded.tecnologia,
      endpoint_producao = excluded.endpoint_producao,
      endpoint_homologacao = excluded.endpoint_homologacao,
      tipo_autenticacao = excluded.tipo_autenticacao,
      status = excluded.status
  `);

  for (const c of CONECTORES_SEEDS) {
    stmt.run(c.id, c.ibge, c.municipio, c.uf, c.provedor, c.tecnologia, c.endpoint_producao, c.endpoint_homologacao, c.tipo_autenticacao, c.status);
  }

  const count = db.prepare('SELECT COUNT(*) as total FROM conectores_municipais').get() as any;
  console.log(`✅ SQLite local sincronizado com ${count.total} conectores municipais.`);
}

syncSqlite();
