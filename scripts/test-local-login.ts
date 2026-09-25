import http from 'http';
import { app } from '../server/app';

async function testLocalLogin() {
  const server = http.createServer(app);
  server.listen(3001, async () => {
    console.log('📡 Servidor de teste ouvindo em http://localhost:3001');

    try {
      // 1. Testar login com credenciais oficiais
      const res1 = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@radarfiscal.com.br', senha: 'Admin@RadarFiscal2026!' })
      });
      const data1: any = await res1.json();
      console.log('1. Login Oficial (admin@radarfiscal.com.br):', res1.status, data1.success ? '✅ SUCESSO' : data1);

      // 2. Testar login com usuário dev rápido
      const res2 = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@radar.com', senha: '123456' })
      });
      const data2: any = await res2.json();
      console.log('2. Login Dev Rápido (admin@radar.com):', res2.status, data2.success ? '✅ SUCESSO' : data2);

      // 3. Testar consulta à Matriz de CFOPs autenticado
      if (data1.token) {
        const resCfop = await fetch('http://localhost:3001/api/tables/cfop', {
          headers: { 'Authorization': `Bearer ${data1.token}` }
        });
        const dataCfop: any = await resCfop.json();
        console.log(`3. Consulta Matriz de CFOPs via API: ✅ SUCESSO (${dataCfop.total} CFOPs ativos retornados)`);
      }
    } catch (err: any) {
      console.error('❌ Erro no teste:', err.message);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

testLocalLogin();
