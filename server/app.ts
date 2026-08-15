/**
 * ============================================================
 * EXPRESS APP — RADAR DE CONFORMIDADE FISCAL
 * ============================================================
 * Criação e configuração de middlewares e rotas do Express.
 * Compatível com execução standalone e Vercel Serverless.
 * ============================================================
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { SERVER } from './config';

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

export const app = express();

// =========================================================
// MIDDLEWARE DE SEGURANÇA
// =========================================================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS: Permitir chamadas do frontend
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// =========================================================
// ROTAS DA API (Compatível com /api/* e /*)
// =========================================================
app.use(['/api/auth', '/auth'], authRoutes);
app.use(['/api/sefaz', '/sefaz'], sefazRoutes);
app.use(['/api/tables', '/tables'], tablesRoutes);
app.use(['/api/relatorios', '/relatorios'], relatoriosRoutes);
app.use(['/api/upload', '/upload'], uploadRoutes);
app.use(['/api/config/certificate', '/config/certificate'], certificatesRoutes);
app.use(['/api/config', '/config'], credentialsRoutes);
app.use(['/api/tenants', '/tenants'], tenantsRoutes);
app.use(['/api/directories', '/directories'], directoriesRoutes);
app.use(['/api/users', '/users'], usersRoutes);
app.use(['/api/audit', '/audit'], auditRoutes);

// =========================================================
// HEALTH CHECK
// =========================================================
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    status: 'ok',
    version: '2.5.0',
    app: 'Radar de Conformidade Fiscal',
    environment: SERVER.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

export default app;
