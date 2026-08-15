/**
 * ============================================================
 * CONFIGURAÇÃO CENTRAL DE CREDENCIAIS E SEGURANÇA
 * ============================================================
 * 100% compatível com Vercel Serverless (read-only filesystem).
 * ============================================================
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Gera CERT_ENCRYPTION_KEY em memória se não existir
if (!process.env.CERT_ENCRYPTION_KEY) {
  process.env.CERT_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
}

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] || fallback;
  if (!value) {
    return '';
  }
  return value;
}

// ============================================================
// SERVIDOR
// ============================================================
export const SERVER = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
} as const;

// ============================================================
// JWT / AUTENTICAÇÃO
// ============================================================
export const AUTH = {
  JWT_SECRET: requireEnv('JWT_SECRET', 'dev-secret-radar-fiscal-change-in-production-2026'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
} as const;

// ============================================================
// BANCO DE DADOS
// ============================================================
export const DATABASE = {
  SQLITE_PATH: process.env.DATABASE_PATH || './data/radar_fiscal.db',
} as const;

// ============================================================
// SEFAZ
// ============================================================
export const SEFAZ = {
  TP_AMB: process.env.SEFAZ_TP_AMB || '2',
  SVRS_HOMOLOGACAO: {
    RECEPCAO_EVENTO: process.env.SEFAZ_SVRS_HOM_EVENTO || 'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    CONSULTA_PROTOCOLO: process.env.SEFAZ_SVRS_HOM_CONSULTA || 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    DISTRIBUICAO_DFE: process.env.SEFAZ_SVRS_HOM_DIST || 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  },
  SVRS_PRODUCAO: {
    RECEPCAO_EVENTO: process.env.SEFAZ_SVRS_PROD_EVENTO || 'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    CONSULTA_PROTOCOLO: process.env.SEFAZ_SVRS_PROD_CONSULTA || 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    DISTRIBUICAO_DFE: process.env.SEFAZ_SVRS_PROD_DIST || 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  },
  NFSE_NACIONAL: process.env.SEFAZ_NFSE_URL || 'https://www.nfse.gov.br/SINDNFe/api/v1',
} as const;

// ============================================================
// COMITÊ GESTOR DO IBS (CGIBS)
// ============================================================
export const CGIBS = {
  API_URL: requireEnv('CGIBS_API_URL', 'https://api-homologacao.cgibs.gov.br/v1'),
  API_KEY: requireEnv('CGIBS_API_KEY'),
  TIMEOUT_MS: parseInt(process.env.CGIBS_TIMEOUT_MS || '15000', 10),
} as const;

// ============================================================
// RECEITA FEDERAL DO BRASIL (RFB)
// ============================================================
export const RFB = {
  API_URL: requireEnv('RFB_API_URL', 'https://api-homologacao.receita.fazenda.gov.br/rtc/v1'),
  BEARER_TOKEN: requireEnv('RFB_BEARER_TOKEN'),
  TIMEOUT_MS: parseInt(process.env.RFB_TIMEOUT_MS || '20000', 10),
} as const;

// ============================================================
// INTEGRAÇÃO SAP / ERP
// ============================================================
export const ERP = {
  TIPO: process.env.ERP_TIPO || 'SAP_S4HANA',
  ENDPOINT_URL: requireEnv('ERP_ENDPOINT_URL'),
  SYSTEM_ID: process.env.ERP_SYSTEM_ID || '',
  CLIENT_NUMBER: process.env.ERP_CLIENT_NUMBER || '100',
  API_KEY: requireEnv('ERP_API_KEY'),
  WEBHOOK_URL: requireEnv('ERP_WEBHOOK_URL'),
} as const;

// ============================================================
// CERTIFICADO DIGITAL A1
// ============================================================
export const CERTIFICADO = {
  STORAGE_DIR: process.env.CERT_STORAGE_DIR || '/tmp/certificates',
  ENCRYPTION_KEY: requireEnv('CERT_ENCRYPTION_KEY'),
} as const;

// ============================================================
// RATE LIMITING
// ============================================================
export const RATE_LIMIT = {
  MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  WINDOW_MINUTES: parseInt(process.env.RATE_LIMIT_WINDOW_MIN || '15', 10),
  SEFAZ_REQ_PER_SEC: parseInt(process.env.SEFAZ_RATE_LIMIT || '8', 10),
} as const;

// ============================================================
// SUPABASE (POSTGRESQL CLOUD)
// ============================================================
const rawSupabaseUrl = (process.env.SUPABASE_URL || '').trim();
const normalizedSupabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');

export const SUPABASE = {
  URL: normalizedSupabaseUrl,
  ANON_KEY: (process.env.SUPABASE_ANON_KEY || '').trim(),
  SERVICE_ROLE_KEY: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  IS_CONFIGURED: Boolean(normalizedSupabaseUrl && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)),
} as const;

export default {
  SERVER, AUTH, DATABASE, SUPABASE, SEFAZ, CGIBS, RFB, ERP, CERTIFICADO, RATE_LIMIT,
};
