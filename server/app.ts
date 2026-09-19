/**
 * ============================================================
 * EXPRESS APP — RADAR DE CONFORMIDADE FISCAL
 * ============================================================
 * Configuração limpa de middlewares e rotas.
 * Compatível com standalone (Node.js) e Render Backend.
 * ============================================================
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { getBrasiliaTimestamp } from './utils/timezone';
import { SERVER } from './config';

// Rotas
import authRoutes from './routes/auth';
import sefazRoutes from './routes/sefaz';
import tablesRoutes from './routes/tables';
import relatoriosRoutes from './routes/relatorios';
import uploadRoutes from './routes/upload';
import credentialsRoutes from './routes/credentials';
import tenantsRoutes from './routes/tenants';
import usersRoutes from './routes/users';
import certificatesRoutes from './routes/certificates';
import auditRoutes from './routes/audit';
import partnersRoutes from './routes/partners';
import exportRoutes from './routes/export';
import nfseRoutes from './routes/nfse';
import apuracaoRoutes from './routes/apuracao';
import aiRoutes from './routes/ai';

export const app = express();

// =========================================================
// MIDDLEWARE DE SEGURANÇA
// =========================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: [
        "'self'",
        'https://*.supabase.co',
        'https://*.fazenda.gov.br',
        'https://*.gov.br',
        'http://localhost:*',
        'http://127.0.0.1:*'
      ],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Lista de origens autorizadas configuradas no ambiente
const configuredOrigins = (SERVER.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Origens padrão permitidas para desenvolvimento local
const devOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3001'
];

app.use(cors({
  origin: (origin, callback) => {
    // Permite chamadas sem header Origin (curl, server-to-server, scripts locais)
    if (!origin) {
      return callback(null, true);
    }

    const isDev = SERVER.NODE_ENV !== 'production';

    // Em desenvolvimento, aceita localhost e 127.0.0.1 em qualquer porta
    if (isDev && (devOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
      return callback(null, true);
    }

    // Se estiver explicitamente na lista de origens configuradas ou for wildcard '*'
    if (configuredOrigins.includes(origin) || configuredOrigins.includes('*')) {
      return callback(null, true);
    }

    // Bloqueia em produção
    if (!isDev) {
      console.warn(`⚠️ [CORS] Requisição bloqueada para origem não autorizada: ${origin}`);
      return callback(new Error(`Origem não autorizada pelo CORS: ${origin}`), false);
    }

    // Fallback permissivo apenas em desenvolvimento
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-empresa-ativa-id',
    'x-tenant-id',
    'x-requested-with',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['x-empresa-ativa-id', 'Content-Range', 'X-Total-Count'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// =========================================================
// ROTAS DA API
// =========================================================
app.use('/api/auth', authRoutes);
app.use('/api/sefaz', sefazRoutes);
app.use('/api/tables', tablesRoutes);
app.use('/api/relatorios', relatoriosRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/config/certificate', certificatesRoutes);
app.use('/api/config', credentialsRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/partners', partnersRoutes);
app.use('/api/nfse', nfseRoutes);
app.use('/api/apuracao', apuracaoRoutes);
app.use('/api/ai', aiRoutes);

// =========================================================
// HEALTH CHECK
// =========================================================
const handleHealthCheck = (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    version: '2.5.0',
    app: 'Radar de Conformidade Fiscal',
    environment: SERVER.NODE_ENV,
    timestamp: getBrasiliaTimestamp(),
  });
};

app.get('/api/health', handleHealthCheck);
app.get('/health', handleHealthCheck);
app.get('/', handleHealthCheck);

// =========================================================
// ERROR HANDLERS
// =========================================================
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado', code: 'NOT_FOUND' });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('❌ Erro não tratado:', err);
  res.status(500).json({ error: err?.message || 'Erro interno', code: 'INTERNAL_ERROR' });
});

export default app;
