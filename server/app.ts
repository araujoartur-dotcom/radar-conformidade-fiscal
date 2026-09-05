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

export const app = express();

// =========================================================
// MIDDLEWARE DE SEGURANÇA
// =========================================================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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
