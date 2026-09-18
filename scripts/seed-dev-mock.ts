/**
 * ============================================================
 * SEED DEV MOCK — AMBIENTE DE DESENVOLVIMENTO ISOLADO & SEGURO
 * ============================================================
 * Este script inicializa o banco SQLite local e insere empresas,
 * usuários e documentos fiscais 100% FICTÍCIOS.
 *
 * Garante que desenvolvedores terceiros (Codespaces ou máquina local)
 * consigam rodar e testar todas as funcionalidades do sistema:
 * - Login & Troca de Empresa
 * - Relatórios Fiscais (NF-e, CT-e, NFS-e)
 * - Tax BI & Dashboards
 * - Apuração Assistida IBS/CBS (Reforma Tributária)
 *
 * NENHUM DADO REAL DE CLIENTES OU CERTIFICADOS É UTILIZADO AQUI.
 * ============================================================
 */

import { initializeSchema } from '../server/db/schema';
import { getDatabase, closeDatabase } from '../server/db/database';
import { seedRegimesParametros } from '../server/db/seed_regimes';
import { seedCategoriaB } from '../server/db/seed_categoria_b';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

export function runDevMockSeed() {
  console.log('🚀 [SEED:DEV] Inicializando banco local e tabelas...');
  initializeSchema();

  const db = getDatabase();

  // 1. Popula tabelas de parâmetros tributários da Reforma (LC 214/2025)
  console.log('📚 [SEED:DEV] Populando parâmetros tributários de referência...');
  seedRegimesParametros(db);
  seedCategoriaB(db);

  // 2. Usuário Desenvolvedor Padrão
  const devUserId = uuid();
  const devEmail = 'dev@radarfiscal.local';
  const devPasswordRaw = 'Dev@123456';
  const devPasswordHash = bcrypt.hashSync(devPasswordRaw, 10);

  const existingDev = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(devEmail) as any;
  const finalUserId = existingDev ? existingDev.id : devUserId;

  if (!existingDev) {
    db.prepare(`
      INSERT INTO usuarios (id, nome, email, senha_hash, perfil, status)
      VALUES (?, ?, ?, ?, 'admin_master', 'ativo')
    `).run(finalUserId, 'Desenvolvedor Sandbox', devEmail, devPasswordHash);
    console.log(`👤 [SEED:DEV] Usuário de desenvolvimento criado: ${devEmail} (Senha: ${devPasswordRaw})`);
  }

  // 3. Empresas Fictícias
  const empresasMock = [
    {
      id: uuid(),
      cnpj_raiz: '11222333',
      cnpj_completo: '11.222.333/0001-81',
      razao_social: 'COMERCIO E DISTRIBUICAO MODELO LTDA',
      nome_fantasia: 'MODELO DISTRIBUIDORA',
      uf: 'SP',
      regime: 'Lucro Real',
    },
    {
      id: uuid(),
      cnpj_raiz: '44555666',
      cnpj_completo: '44.555.666/0001-92',
      razao_social: 'SERVICOS DIGITAIS E TECNOLOGIA BETA ME',
      nome_fantasia: 'BETA TECH SERVICOS',
      uf: 'RJ',
      regime: 'Simples Nacional',
    },
  ];

  const empresaIds: string[] = [];

  for (const emp of empresasMock) {
    const existing = db.prepare('SELECT id FROM empresas WHERE cnpj_completo = ?').get(emp.cnpj_completo) as any;
    const empId = existing ? existing.id : emp.id;
    empresaIds.push(empId);

    if (!existing) {
      db.prepare(`
        INSERT INTO empresas (id, cnpj_raiz, cnpj_completo, razao_social, nome_fantasia, uf, regime_tributario, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'ativo')
      `).run(empId, emp.cnpj_raiz, emp.cnpj_completo, emp.razao_social, emp.nome_fantasia, emp.uf, emp.regime);
    }

    // Vincular usuário dev à empresa
    db.prepare(`
      INSERT OR IGNORE INTO usuario_empresa (id, usuario_id, empresa_id, permissao, modulos_permitidos)
      VALUES (?, ?, ?, 'total', '*')
    `).run(uuid(), finalUserId, empId);
  }

  console.log(`🏢 [SEED:DEV] ${empresasMock.length} empresas fictícias configuradas.`);

  // 4. Inserção de Documentos Fiscais Simulados para Alimentar Gráficos e Relatórios
  const stmtDoc = db.prepare(`
    INSERT OR IGNORE INTO dfe_documentos (
      id, empresa_id, tipo_doc, chave_acesso, numero_serie, data_emissao, data_entrada, competencia,
      fornecedor_cnpj, fornecedor_razao, fornecedor_uf, fornecedor_municipio,
      cliente_cnpj, cliente_razao, cliente_uf, situacao_doc, valor_total
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const stmtItem = db.prepare(`
    INSERT INTO dfe_itens (
      id, documento_id, item_nro, descricao_item, ncm, cfop, cclasstrib, cst_csosn,
      natureza_operacao, quantidade, unidade, valor_bruto_item, desconto_incondicional,
      frete_seguro_rateado, valor_liquido_item, base_ibs, aliquota_ibs, valor_ibs,
      base_cbs, aliquota_cbs, valor_cbs
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const mockDocs = [
    {
      tipo: 'NFE',
      chave: '35260111222333000181550010000001011000000011',
      serie: '001-101',
      data: '2026-03-01T10:30:00Z',
      comp: '2026-03',
      fornCnpj: '99.888.777/0001-11',
      fornRazao: 'FORNECEDOR MATERIAS PRIMAS ALFA LTDA',
      fornUf: 'SP',
      cliCnpj: empresasMock[0].cnpj_completo,
      cliRazao: empresasMock[0].razao_social,
      cliUf: 'SP',
      valor: 25000.00,
      itens: [
        {
          desc: 'Bobina de Aço Laminado para Produção',
          ncm: '72081000',
          cfop: '1101',
          cClassTrib: '010101',
          cst: '000',
          nat: 'Compra para industrialização',
          qtd: 5,
          und: 'TON',
          vBruto: 25000.00,
          aliqIbs: 0.10, // Transição 2026
          aliqCbs: 0.90, // Transição 2026
        },
      ],
    },
    {
      tipo: 'NFE',
      chave: '35260111222333000181550010000001021000000022',
      serie: '001-102',
      data: '2026-03-05T14:15:00Z',
      comp: '2026-03',
      fornCnpj: empresasMock[0].cnpj_completo,
      fornRazao: empresasMock[0].razao_social,
      fornUf: 'SP',
      cliCnpj: '12.345.678/0001-90',
      cliRazao: 'CLIENTE VAREJISTA CENTRAL S/A',
      cliUf: 'MG',
      valor: 48000.00,
      itens: [
        {
          desc: 'Estruturas Metálicas Pré-moldadas Mod A',
          ncm: '73089090',
          cfop: '6101',
          cClassTrib: '010101',
          cst: '000',
          nat: 'Venda de produção interestadual',
          qtd: 20,
          und: 'UN',
          vBruto: 48000.00,
          aliqIbs: 0.10,
          aliqCbs: 0.90,
        },
      ],
    },
    {
      tipo: 'NFSE',
      chave: '33260144555666000192000000000000501100000033',
      serie: 'NFS-501',
      data: '2026-03-10T09:00:00Z',
      comp: '2026-03',
      fornCnpj: empresasMock[1].cnpj_completo,
      fornRazao: empresasMock[1].razao_social,
      fornUf: 'RJ',
      cliCnpj: empresasMock[0].cnpj_completo,
      cliRazao: empresasMock[0].razao_social,
      cliUf: 'SP',
      valor: 12000.00,
      itens: [
        {
          desc: 'Consultoria e Suporte Técnico em Infraestrutura Cloud',
          ncm: '00000000',
          cfop: '0000',
          cClassTrib: '020101',
          cst: '102',
          nat: 'Prestação de serviços tributados no município',
          qtd: 1,
          und: 'SV',
          vBruto: 12000.00,
          aliqIbs: 0.00,
          aliqCbs: 0.00,
        },
      ],
    },
  ];

  let docsInseridos = 0;
  for (const doc of mockDocs) {
    const docId = uuid();
    const targetEmpId = empresaIds[0];

    const result = stmtDoc.run(
      docId, targetEmpId, doc.tipo, doc.chave, doc.serie, doc.data, doc.data, doc.comp,
      doc.fornCnpj, doc.fornRazao, doc.fornUf, 'SAO PAULO',
      doc.cliCnpj, doc.cliRazao, doc.cliUf, 'autorizada', doc.valor
    );

    if (result.changes > 0) {
      docsInseridos++;
      let itemNro = 1;
      for (const it of doc.itens) {
        const vIbs = (it.vBruto * it.aliqIbs) / 100;
        const vCbs = (it.vBruto * it.aliqCbs) / 100;
        stmtItem.run(
          uuid(), docId, itemNro++, it.desc, it.ncm, it.cfop, it.cClassTrib, it.cst,
          it.nat, it.qtd, it.und, it.vBruto, 0, 0, it.vBruto,
          it.vBruto, it.aliqIbs, vIbs, it.vBruto, it.aliqCbs, vCbs
        );
      }
    }
  }

  console.log(`📄 [SEED:DEV] ${docsInseridos} documentos fiscais de demonstração inseridos.`);
  console.log('\n======================================================');
  console.log('✅ AMBIENTE DE DESENVOLVIMENTO POPULADO COM SUCESSO!');
  console.log('======================================================');
  console.log(`Credenciais para teste:`);
  console.log(`  E-mail: ${devEmail}`);
  console.log(`  Senha:  ${devPasswordRaw}`);
  console.log('Empresas disponíveis para seleção no menu superior:');
  console.log(`  1. ${empresasMock[0].razao_social} (${empresasMock[0].cnpj_completo})`);
  console.log(`  2. ${empresasMock[1].razao_social} (${empresasMock[1].cnpj_completo})`);
  console.log('======================================================\n');

  closeDatabase();
}

// Execução direta via tsx
runDevMockSeed();
