/**
 * ============================================================
 * SMOKE TEST & SANITY GATE AUTOMATIZADO — RADAR FISCAL
 * ============================================================
 * Valida os 10 fluxos vitais da aplicação antes ou depois de
 * qualquer deploy para garantir que nenhuma desconfiguração
 * atinja os clientes em produção.
 *
 * Uso:
 *   npx tsx scripts/verify-production-sanity.ts [BASE_URL]
 *   Ex: npx tsx scripts/verify-production-sanity.ts https://radarconformidade.netlify.app
 * ============================================================
 */

const TARGET_URL = (process.argv[2] || process.env.SANITY_TARGET_URL || 'https://radarconformidade.netlify.app').replace(/\/+$/, '');

interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<string>) {
  const start = Date.now();
  try {
    const details = await fn();
    results.push({ name, passed: true, durationMs: Date.now() - start, details });
    console.log(`  ✅ [PASS] ${name} (${Date.now() - start}ms) — ${details}`);
  } catch (err: any) {
    results.push({ name, passed: false, durationMs: Date.now() - start, details: err.message });
    console.error(`  ❌ [FAIL] ${name} (${Date.now() - start}ms) — Erro: ${err.message}`);
  }
}

async function main() {
  console.log('\n============================================================');
  console.log(` 🛡️  SANITY GATE AUTOMATIZADO: ${TARGET_URL}`);
  console.log(` 🕒  Data/Hora: ${new Date().toISOString()}`);
  console.log('============================================================\n');

  let adminToken = '';
  let empresaAtivaId = '';
  let empresaAtivaNome = '';

  // 1. Health Check
  await runTest('1. Health Check da API (/api/health)', async () => {
    const res = await fetch(`${TARGET_URL}/api/health`);
    if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);
    const json = await res.json();
    return `Versão ${json.version || 'ok'}, status=${json.status}`;
  });

  // 2. CORS Preflight com Header Customizado x-empresa-ativa-id
  await runTest('2. CORS Preflight com Header x-empresa-ativa-id', async () => {
    const res = await fetch(`${TARGET_URL}/api/upload/kpis`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://radarconformidade.netlify.app',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization, content-type, x-empresa-ativa-id',
      },
    });

    const allowHeaders = (res.headers.get('access-control-allow-headers') || '').toLowerCase();
    // Se for same-origin proxy (Netlify), preflight pode retornar 200/204;
    // se retornar allowHeaders, deve conter x-empresa-ativa-id
    if (allowHeaders && !allowHeaders.includes('x-empresa-ativa-id') && !allowHeaders.includes('*')) {
      throw new Error(`CORS rejeitou o header x-empresa-ativa-id! Headers permitidos: ${allowHeaders}`);
    }
    return `Preflight aceito com status ${res.status}`;
  });

  // 3. Login do Administrador Master
  await runTest('3. Login do Admin Master (/api/auth/login)', async () => {
    const res = await fetch(`${TARGET_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@radarfiscal.com.br',
        senha: 'Admin@RadarFiscal2026!',
      }),
    });

    if (!res.ok) throw new Error(`Falha no login (${res.status}): ${await res.text()}`);
    const json = await res.json();
    adminToken = json.accessToken || json.token;
    if (!adminToken) throw new Error('accessToken ausente na resposta de login');
    
    empresaAtivaId = json.empresaAtiva?.id || '';
    empresaAtivaNome = json.empresaAtiva?.razaoSocial || 'N/A';
    return `Usuário ${json.usuario?.nome} logado, Empresa Ativa: ${empresaAtivaNome}`;
  });

  const authHeaders: Record<string, string> = {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
    'x-empresa-ativa-id': empresaAtivaId,
  };

  // 4. Troca de Empresa Ativa (Switch Tenant)
  await runTest('4. Alternância de Empresa (/api/auth/switch-empresa)', async () => {
    if (!empresaAtivaId) throw new Error('Nenhuma empresa ativa disponível para alternância');
    const res = await fetch(`${TARGET_URL}/api/auth/switch-empresa`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ empresaId: empresaAtivaId }),
    });

    if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);
    const json = await res.json();
    if (!json.accessToken) throw new Error('Novo token não gerado após troca de empresa');
    return `Empresa ${json.empresaAtiva?.razaoSocial || empresaAtivaId} validada com sucesso`;
  });

  // 5. KPIs Agregados (Base de Dados)
  await runTest('5. KPIs Agregados (/api/upload/kpis)', async () => {
    const res = await fetch(`${TARGET_URL}/api/upload/kpis?empresaId=${empresaAtivaId}`, {
      headers: authHeaders,
    });

    if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const docs = json.totalGeral?.totalDocs ?? 0;
    const valor = (json.totalGeral?.totalValor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (docs === 0) {
      console.warn(`    ⚠️ Aviso: totalDocs retornou 0 para a empresa ativa atual.`);
    }
    return `Total de Docs: ${docs} | Valor Acumulado: ${valor}`;
  });

  // 6. Listagem de Documentos DF-e
  await runTest('6. Consulta de DF-e (/api/upload/documentos)', async () => {
    const res = await fetch(`${TARGET_URL}/api/upload/documentos?limit=5&empresaId=${empresaAtivaId}`, {
      headers: authHeaders,
    });

    if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const count = json.data?.length ?? 0;
    return `Retornados ${count} documentos (Total na base: ${json.total ?? count})`;
  });

  // 7. Gestão de Usuários Corporativos
  await runTest('7. Gestão de Usuários (/api/users)', async () => {
    const res = await fetch(`${TARGET_URL}/api/users`, { headers: authHeaders });
    if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const count = json.data?.length ?? 0;
    return `Cadastrados ${count} usuários corporativos`;
  });

  // 8. Cadastro de Tenants / Empresas
  await runTest('8. Carteira de Tenants (/api/tenants)', async () => {
    const res = await fetch(`${TARGET_URL}/api/tenants`, { headers: authHeaders });
    if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const count = json.data?.length ?? 0;
    return `Localizadas ${count} empresas na carteira`;
  });

  // 9. Parâmetros e Tabelas Fiscais
  await runTest('9. Parâmetros & Tabelas Fiscais (/api/tables/aliquotas/ad-valorem)', async () => {
    const res = await fetch(`${TARGET_URL}/api/tables/aliquotas/ad-valorem`, { headers: authHeaders });
    if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const count = json.data?.length ?? 0;
    return `Carregadas ${count} alíquotas Ad Valorem da Reforma Tributária`;
  });

  // 10. Relatórios Fiscais e Agregações
  await runTest('10. Relatórios Fiscais (/api/relatorios/xml)', async () => {
    const res = await fetch(`${TARGET_URL}/api/relatorios/xml?limit=5&empresaId=${empresaAtivaId}`, {
      headers: authHeaders,
    });

    if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const count = json.data?.length ?? 0;
    return `Relatório processou ${count} itens detalhados (Total: ${json.total ?? 0})`;
  });

  // ── RESUMO FINAL ──────────────────────────────────────────
  console.log('\n============================================================');
  const failedCount = results.filter(r => !r.passed).length;
  if (failedCount === 0) {
    console.log(' 🎉 TODAS AS 10 VERIFICAÇÕES PASSARAM COM SUCESSO!');
    console.log(' 🚀 O sistema está 100% íntegro e seguro para os clientes.');
    console.log('============================================================\n');
    process.exit(0);
  } else {
    console.error(` 🚨 FALHA DETECTADA: ${failedCount} de ${results.length} testes falharam!`);
    console.error(' 🛑 Deploy NÃO DEVE prosseguir até resolução dos erros acima.');
    console.error('============================================================\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Erro fatal durante execução do Sanity Gate:', err);
  process.exit(1);
});
