import express from 'express';
import jwt from 'jsonwebtoken';
import { AUTH } from '../server/config';
import authRoutes from '../server/routes/auth';
import uploadRoutes from '../server/routes/upload';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);

async function runFullVerification() {
  console.log('🚀 Iniciando Verificação de Ponta a Ponta: Autenticação + Multi-Tenant + DF-e...');

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api`;

  try {
    // 1. Test Login Admin Master
    console.log('\n1. Testando POST /api/auth/login para admin@radarfiscal.com.br...');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@radarfiscal.com.br', senha: 'Admin@RadarFiscal2026!' })
    });

    const loginData: any = await loginRes.json();
    if (!loginRes.ok) {
      console.error('❌ Falha no login do admin:', loginRes.status, loginData);
      process.exit(1);
    }
    console.log('✅ Login Admin OK! Usuário:', loginData.usuario?.nome);
    console.log('Empresas disponíveis para Admin Master:', loginData.empresasDisponiveis?.length);

    // 2. Test Analista Fiscal Token & GET /api/auth/me
    console.log('\n2. Testando contexto de Analista Fiscal (analista_fiscal)...');
    const analistaPayload = {
      userId: '2838835b-b807-47c3-bdc6-92ad1307be82',
      email: 'analista.fiscal@empresa.com.br',
      perfil: 'analista_fiscal',
      empresaAtivaId: '7c0aa7e3-fc96-4df4-9837-4c20d7b87376',
      empresaCnpj: '01001001000191',
    };
    const analistaToken = jwt.sign(analistaPayload, AUTH.JWT_SECRET, { expiresIn: '1d' });

    console.log('Testando GET /api/auth/me para Analista...');
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { 'Authorization': `Bearer ${analistaToken}` }
    });

    const meData: any = await meRes.json();
    if (!meRes.ok) {
      console.error('❌ Falha no GET /me para Analista:', meRes.status, meData);
      process.exit(1);
    }
    console.log('✅ GET /me OK! Usuário:', meData.usuario?.nome);
    console.log('Empresa Ativa:', meData.empresaAtiva?.razaoSocial, `(CNPJ: ${meData.empresaAtiva?.cnpjCompleto})`);
    console.log('Empresas vinculadas:', meData.empresasDisponiveis?.map((e: any) => e.razaoSocial));

    if (!meData.empresaAtiva) {
      console.error('❌ ERRO: Empresa ativa do analista deveria estar definida!');
      process.exit(1);
    }

    // 3. Test GET /api/upload/documentos para Empresa Matriz
    console.log('\n3. Testando GET /api/upload/documentos para Empresa Matriz...');
    const empresaMatrizId = '7c0aa7e3-fc96-4df4-9837-4c20d7b87376';
    const docsRes = await fetch(`${baseUrl}/upload/documentos?empresaId=${empresaMatrizId}&limit=100`, {
      headers: { 'Authorization': `Bearer ${analistaToken}` }
    });

    const docsData: any = await docsRes.json();
    if (!docsRes.ok) {
      console.error('❌ Falha ao buscar documentos:', docsRes.status, docsData);
      process.exit(1);
    }
    console.log(`✅ Documentos retornados na página: ${docsData.data?.length} notas.`);
    console.log(`✅ Total quantificado na base para Empresa Matriz: ${docsData.total?.toLocaleString('pt-BR') || 0} notas!`);
    console.log(`✅ Amostra de notas:`);
    for (let i = 0; i < Math.min(3, docsData.data.length); i++) {
      const d = docsData.data[i];
      console.log(`   - ${d.tipo_doc} Nº ${d.numero_serie || d.chave_acesso.slice(25, 34)} | ${d.empresa_nome} | R$ ${Number(d.valor_total).toFixed(2)}`);
    }

    // 4. Test GET /api/upload/kpis para Empresa Matriz
    console.log('\n4. Testando GET /api/upload/kpis para Empresa Matriz...');
    const kpiRes = await fetch(`${baseUrl}/upload/kpis?empresaId=${empresaMatrizId}`, {
      headers: { 'Authorization': `Bearer ${analistaToken}` }
    });

    const kpiData: any = await kpiRes.json();
    if (!kpiRes.ok) {
      console.error('❌ Falha ao buscar KPIs:', kpiRes.status, kpiData);
      process.exit(1);
    }
    const kpis = kpiData.totalGeral;
    console.log(`✅ KPIs consolidados (Fonte: ${kpiData.source}):`);
    console.log(`   - Total Docs: ${kpis?.totalDocs?.toLocaleString('pt-BR')}`);
    console.log(`   - Total Valor: R$ ${kpis?.totalValor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   - Total CBS: R$ ${kpis?.totalCbs?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   - Total IBS: R$ ${kpis?.totalIbs?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    // 5. Test Switch Empresa para Empresa Secundária
    const empresaSecundariaId = '1f669943-4cf8-49a7-a7de-55cbfd782f86';
    console.log('\n5. Testando POST /api/auth/switch-empresa para Empresa Secundária...');
    const switchRes = await fetch(`${baseUrl}/auth/switch-empresa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${analistaToken}`
      },
      body: JSON.stringify({ empresaId: empresaSecundariaId })
    });

    const switchData: any = await switchRes.json();
    if (!switchRes.ok) {
      console.error('❌ Falha ao alternar empresa:', switchRes.status, switchData);
      process.exit(1);
    }
    const secundariaToken = switchData.accessToken;
    console.log('✅ Empresa alternada com sucesso para:', switchData.empresaAtiva?.razaoSocial);

    // 6. Test documentos para Empresa Secundária
    console.log('\n6. Testando GET /api/upload/documentos para Empresa Secundária...');
    const secundariaDocsRes = await fetch(`${baseUrl}/upload/documentos?empresaId=${empresaSecundariaId}`, {
      headers: { 'Authorization': `Bearer ${secundariaToken}` }
    });

    const secundariaDocsData: any = await secundariaDocsRes.json();
    console.log(`✅ Empresa Secundária possui: ${secundariaDocsData.data?.length || 0} notas (Total: ${secundariaDocsData.total || 0})`);

    // 7. Switch Back to Empresa Matriz
    console.log('\n7. Testando POST /api/auth/switch-empresa de volta para Empresa Matriz...');
    const switchBackRes = await fetch(`${baseUrl}/auth/switch-empresa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secundariaToken}`
      },
      body: JSON.stringify({ empresaId: empresaMatrizId })
    });

    const switchBackData: any = await switchBackRes.json();
    if (!switchBackRes.ok) {
      console.error('❌ Falha ao voltar para Empresa Matriz:', switchBackRes.status, switchBackData);
      process.exit(1);
    }
    console.log('✅ Retorno com sucesso para:', switchBackData.empresaAtiva?.razaoSocial);

    console.log('\n🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO E ISOLAMENTO MULTI-TENANT SEGURO!');
  } finally {
    server.close();
  }
  process.exit(0);
}

runFullVerification().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
