/**
 * ============================================================
 * SERVIDOR EXPRESS — RADAR DE CONFORMIDADE FISCAL
 * ============================================================
 * Ponto de entrada do backend. Orquestra middleware, rotas,
 * banco de dados e segurança.
 * ============================================================
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { SERVER } from './config';
import { initializeSchema } from './db/schema';
import { seedDatabase } from './db/seed';
import { seedSupabaseDatabase } from './db/seed_supabase';
import { closeDatabase } from './db/database';


// Rotas
import authRoutes from './routes/auth';
import sefazRoutes from './routes/sefaz';
import tablesRoutes from './routes/tables';
import relatoriosRoutes from './routes/relatorios';
import uploadRoutes from './routes/upload';
import credentialsRoutes from './routes/credentials';
import tenantsRoutes from './routes/tenants';
import directoriesRoutes from './routes/directories';
import usersRoutes from './routes/users';
import certificatesRoutes from './routes/certificates';
import auditRoutes from './routes/audit';

const app = express();

// =========================================================
// MIDDLEWARE DE SEGURANÇA
// =========================================================

// Helmet: Headers de segurança HTTP
app.use(helmet({
  contentSecurityPolicy: false, // Desabilitado para permitir o frontend Vite em dev
  crossOriginEmbedderPolicy: false,
}));

// CORS: Permitir chamadas do frontend
app.use(cors({
  origin: SERVER.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// =========================================================
// RATE LIMITING SIMPLES (em produção usar express-rate-limit + Redis)
// =========================================================
const requestCounts = new Map<string, { count: number; resetTime: number }>();

app.use((req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutos

  const entry = requestCounts.get(ip);
  if (!entry || now > entry.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
  } else {
    entry.count++;
    if (entry.count > 500) {
      res.status(429).json({ error: 'Muitas requisições. Tente novamente em 15 minutos.', code: 'RATE_LIMITED' });
      return;
    }
  }
  next();
});

// =========================================================
// ROTAS DA API
// =========================================================
app.use('/api/auth', authRoutes);
app.use('/api/sefaz', sefazRoutes);
app.use('/api/tables', tablesRoutes);
app.use('/api/relatorios', relatoriosRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/config', credentialsRoutes);
app.use('/api/config/certificate', certificatesRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/directories', directoriesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audit', auditRoutes);

// =========================================================
// HEALTH CHECK
// =========================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.5.0',
    app: 'Radar de Conformidade Fiscal',
    environment: SERVER.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// =========================================================
// SERVIR FRONTEND ESTÁTICO (produção)
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
      console.log(`  💾 Banco:       SQLite (WAL mode)`);
      console.log(`  🔐 Auth:        JWT + bcrypt (${process.env.JWT_SECRET ? 'SECRET CONFIGURADO' : '⚠️  USANDO SECRET PADRÃO'})`);
      console.log('============================================================');
      console.log('');
      console.log('  📌 Credenciais do Admin Padrão:');
      console.log('     E-mail:  admin@radarfiscal.com.br');
      console.log('     Senha:   Admin@RadarFiscal2026!');
      console.log('');
      console.log('  📡 Endpoints da API:');
      console.log(`     POST   /api/auth/login`);
      console.log(`     POST   /api/auth/refresh`);
      console.log(`     POST   /api/auth/switch-empresa`);
      console.log(`     GET    /api/auth/me`);
      console.log(`     POST   /api/sefaz/evento`);
      console.log(`     GET    /api/sefaz/eventos`);
      console.log(`     GET    /api/sefaz/ping`);
      console.log(`     GET    /api/tables/aliquotas`);
      console.log(`     GET    /api/tables/aliquotas/vigente`);
      console.log(`     GET    /api/tables/cfop`);
      console.log(`     GET    /api/tables/cclasstrib`);
      console.log(`     GET    /api/tables/regras`);
      console.log(`     GET    /api/relatorios/xml`);
      console.log(`     POST   /api/upload/xml`);
      console.log(`     GET    /api/config/endpoints`);
      console.log(`     GET    /api/health`);
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
