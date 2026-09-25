import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { getDatabase } from '../server/db/database';

async function setupLocalUsers() {
  const db = getDatabase();

  // 1. Atualizar ou criar o admin oficial com a senha fornecida pelo usuário
  const hashAdminOficial = bcrypt.hashSync('Admin@RadarFiscal2026!', 10);
  const existsOficial = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('admin@radarfiscal.com.br') as any;
  if (existsOficial) {
    db.prepare("UPDATE usuarios SET senha_hash = ?, status = 'ativo' WHERE id = ?").run(hashAdminOficial, existsOficial.id);
    console.log('✅ Usuário oficial atualizado: admin@radarfiscal.com.br (Senha: Admin@RadarFiscal2026!)');
  } else {
    db.prepare(`
      INSERT INTO usuarios (id, nome, email, senha_hash, perfil, status)
      VALUES (?, 'Administrador Master', 'admin@radarfiscal.com.br', ?, 'admin_master', 'ativo')
    `).run(uuid(), hashAdminOficial);
    console.log('✅ Usuário oficial criado: admin@radarfiscal.com.br (Senha: Admin@RadarFiscal2026!)');
  }

  // 2. Criar ou atualizar usuário dev rápido para testes localhost: admin@radar.com / 123456
  const hashDev = bcrypt.hashSync('123456', 10);
  const existsDev = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('admin@radar.com') as any;
  if (existsDev) {
    db.prepare("UPDATE usuarios SET senha_hash = ?, status = 'ativo' WHERE id = ?").run(hashDev, existsDev.id);
    console.log('✅ Usuário de teste atualizado: admin@radar.com (Senha: 123456)');
  } else {
    db.prepare(`
      INSERT INTO usuarios (id, nome, email, senha_hash, perfil, status)
      VALUES (?, 'Admin Dev Local', 'admin@radar.com', ?, 'admin_master', 'ativo')
    `).run(uuid(), hashDev);
    console.log('✅ Usuário de teste criado: admin@radar.com (Senha: 123456)');
  }

  // 3. Garantir que uma empresa ativa exista para o usuário
  const empresas = db.prepare('SELECT id, razao_social, cnpj_completo FROM empresas LIMIT 1').all() as any[];
  if (empresas.length > 0) {
    db.prepare('UPDATE usuarios SET empresa_ativa_id = ? WHERE email IN (?, ?)').run(
      empresas[0].id,
      'admin@radarfiscal.com.br',
      'admin@radar.com'
    );
    console.log(`✅ Empresa ativa vinculada aos admins: ${empresas[0].razao_social} (${empresas[0].cnpj_completo})`);
  }
}

setupLocalUsers().catch(err => {
  console.error('❌ Erro ao configurar usuários locais:', err);
  process.exit(1);
});
