/**
 * ============================================================
 * SERVIDOR STANDALONE EXPRESS — RADAR DE CONFORMIDADE FISCAL
 * ============================================================
 * Inicializa banco de dados local (SQLite) e Supabase (se configurado)
 * e sobe o servidor HTTP na porta 3001.
 * ============================================================
 */

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { SERVER } from './config';
import { initializeSchema } from './db/schema';
import { seedDatabase } from './db/seed';
import { seedSupabaseDatabase } from './db/seed_supabase';
import { closeDatabase } from './db/database';
import { app } from './app';

// =========================================================
// SERVIR FRONTEND ESTÁTICO (produção local)
// =========================================================
const distPath = path.resolve(__dirname, '..', 'dist');
app.use(express.static(distPath));

// Fallback SPA para React Router
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Endpoint não encontrado.' });
    return;
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// =========================================================
// INICIALIZAÇÃO
// =========================================================
async function startServer() {
  try {
    // Inicializar banco de dados e schema
    console.log('🔧 Inicializando banco de dados...');
    initializeSchema();
    seedDatabase();
    await seedSupabaseDatabase();

    // Iniciar servidor
    app.listen(SERVER.PORT, SERVER.HOST, () => {
      console.log('');
      console.log('============================================================');
      console.log('  🚀 RADAR DE CONFORMIDADE FISCAL — Backend API v2.5.0');
      console.log('============================================================');
      console.log(`  🌐 URL:         http://${SERVER.HOST}:${SERVER.PORT}`);
      console.log(`  📋 Ambiente:    ${SERVER.NODE_ENV}`);
      console.log(`  🔒 CORS:        ${SERVER.CORS_ORIGIN}`);
      console.log(`  💾 Banco:       SQLite (WAL mode) / Supabase`);
      console.log(`  🔐 Auth:        JWT + bcrypt`);
      console.log('============================================================');
      console.log('');
      console.log('  📌 Credenciais do Admin Padrão:');
      console.log('     E-mail:  admin@radarfiscal.com.br');
      console.log('     Senha:   Admin@RadarFiscal2026!');
      console.log('');
    });
  } catch (err) {
    console.error('❌ Falha ao iniciar o servidor:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});

startServer();

export default app;
