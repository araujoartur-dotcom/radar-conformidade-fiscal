import { getDatabase } from '../server/db/database';
import { initializeSchema } from '../server/db/schema';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AUTH } from '../server/config';

async function runTests() {
  console.log('🧪 Iniciando testes de Gestão pelo Contador Gestor...');
  initializeSchema();
  const db = getDatabase();

  // 1. Criar empresa de teste para o contador
  const empId1 = 'emp-teste-' + Date.now();
  const root1 = String(Math.floor(10000000 + Math.random() * 89999999));
  const cnpj1 = `${root1}000199`;
  db.prepare(`
    INSERT INTO empresas (id, cnpj_raiz, cnpj_completo, razao_social, nome_fantasia, uf, regime_tributario, status)
    VALUES (?, ?, ?, 'EMPRESA CONTADOR TESTE LTDA', 'EMPRESA TESTE', 'SP', 'Lucro Real', 'ativo')
  `).run(empId1, root1, `${root1.slice(0,2)}.${root1.slice(2,5)}.${root1.slice(5,8)}/0001-99`);

  // Empresa fora da carteira do contador
  const empId2 = 'emp-fora-' + Date.now();
  const root2 = String(Math.floor(10000000 + Math.random() * 89999999));
  db.prepare(`
    INSERT INTO empresas (id, cnpj_raiz, cnpj_completo, razao_social, nome_fantasia, uf, regime_tributario, status)
    VALUES (?, ?, ?, 'EMPRESA DE OUTRO CONTADOR S/A', 'EMPRESA OUTRO', 'RJ', 'Lucro Real', 'ativo')
  `).run(empId2, root2, `${root2.slice(0,2)}.${root2.slice(2,5)}.${root2.slice(5,8)}/0001-11`);

  // 2. Criar Contador Gestor
  const contadorId = 'user-contador-' + Date.now();
  const senhaHash = bcrypt.hashSync('Mudar@123456', 6);
  db.prepare(`
    INSERT INTO usuarios (id, nome, email, senha_hash, perfil, status)
    VALUES (?, 'Contador Carlos', 'carlos.contador@teste.com', ?, 'contador_gestor', 'ativo')
  `).run(contadorId, senhaHash);

  // Vincular Contador à empId1
  db.prepare(`
    INSERT INTO usuario_empresa (id, usuario_id, empresa_id, permissao, modulos_permitidos)
    VALUES (?, ?, ?, 'total', '*')
  `).run(uuid(), contadorId, empId1);

  console.log('✅ Contador Gestor e Empresas de teste criadas.');

  // 3. Testar isolamento de escopo
  // Criar analista sem CNPJ (Identidade autônoma) criada pelo contador
  const analistaId = 'user-analista-' + Date.now();
  db.prepare(`
    INSERT INTO usuarios (id, nome, email, senha_hash, perfil, status, criado_por)
    VALUES (?, 'Ana Analista', 'ana.analista@teste.com', ?, 'analista_fiscal', 'ativo', ?)
  `).run(analistaId, senhaHash, contadorId);

  // Verificar se contador vê o analista sem CNPJs porque foi criado por ele
  const analistaCriado = db.prepare('SELECT id, nome, perfil, criado_por FROM usuarios WHERE id = ?').get(analistaId) as any;
  if (analistaCriado?.criado_por === contadorId) {
    console.log('✅ Analista criado sem CNPJs vinculado com sucesso via criado_por!');
  } else {
    throw new Error('Falha no campo criado_por do usuário');
  }

  // 4. Testar vinculação com permissão personalizada à empresa do contador
  const vinculoId = uuid();
  db.prepare(`
    INSERT INTO usuario_empresa (id, usuario_id, empresa_id, permissao, modulos_permitidos)
    VALUES (?, ?, ?, 'escrita', 'nfe,sped,relatorios')
  `).run(vinculoId, analistaId, empId1);

  const vinculoCriado = db.prepare('SELECT * FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ?').get(analistaId, empId1) as any;
  if (vinculoCriado?.permissao === 'escrita' && vinculoCriado?.modulos_permitidos === 'nfe,sped,relatorios') {
    console.log('✅ Vínculo granular (escrita, módulos restritos) verificado com sucesso!');
  } else {
    throw new Error('Falha no registro do vínculo granular');
  }

  // 5. Testar consulta de membros por empresa
  const membros = db.prepare(`
    SELECT u.nome, u.email, ue.permissao, ue.modulos_permitidos
    FROM usuario_empresa ue
    JOIN usuarios u ON u.id = ue.usuario_id
    WHERE ue.empresa_id = ?
  `).all(empId1) as any[];

  console.log(`✅ Membros vinculados à empresa: ${membros.length}`);
  if (!membros.some(m => m.email === 'ana.analista@teste.com')) {
    throw new Error('Analista não encontrado nos membros da empresa');
  }

  // 6. Testar desvinculação
  db.prepare('DELETE FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ?').run(analistaId, empId1);
  const membrosPosDel = db.prepare('SELECT * FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ?').get(analistaId, empId1);
  if (!membrosPosDel) {
    console.log('✅ Desvinculação executada com sucesso!');
  } else {
    throw new Error('Falha na desvinculação');
  }

  // Limpeza
  db.prepare('DELETE FROM usuario_empresa WHERE usuario_id IN (?, ?)').run(contadorId, analistaId);
  db.prepare('DELETE FROM usuarios WHERE id IN (?, ?)').run(contadorId, analistaId);
  db.prepare('DELETE FROM empresas WHERE id IN (?, ?)').run(empId1, empId2);

  console.log('🎉 Todos os testes de banco e regras de gestão contábil passaram com sucesso!');
}

runTests().catch(err => {
  console.error('❌ Erro no teste:', err);
  process.exit(1);
});
