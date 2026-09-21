/**
 * ============================================================
 * CONFIGURAÇÃO CENTRAL DE CREDENCIAIS E SEGURANÇA
 * ============================================================
 * Configuração de ambiente e segurança para Node.js / Render.
 * ============================================================
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Deriva CERT_ENCRYPTION_KEY de forma estável e determinística se não existir no ambiente
if (!process.env.CERT_ENCRYPTION_KEY) {
  const seed = process.env.JWT_SECRET || 'radar_fiscal_default_secure_key_2026';
  process.env.CERT_ENCRYPTION_KEY = crypto.createHash('sha256').update(seed).digest('hex');
}

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] || fallback;
  if (!value) {
    return '';
  }
  return value;
}

const isProduction = (process.env.NODE_ENV || 'development') === 'production';
const DEV_JWT_FALLBACK = 'dev-secret-radar-fiscal-change-in-production-2026';

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (isProduction) {
    if (!secret || secret.trim() === '' || secret === DEV_JWT_FALLBACK || secret.includes('dev-secret')) {
      throw new Error(
        '🚨 [SEGURANÇA CRÍTICA] Em ambiente de PRODUÇÃO, a variável JWT_SECRET é obrigatória e deve conter um segredo forte de 64+ caracteres! ' +
        'O uso de valores vazios ou chaves padrão de desenvolvimento foi bloqueado pelo sistema.'
      );
    }
    return secret;
  }
  if (!secret) {
    console.warn('⚠️ [SEGURANÇA] JWT_SECRET não configurado. Usando chave padrão de desenvolvimento.');
    return DEV_JWT_FALLBACK;
  }
  return secret;
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
  JWT_SECRET: resolveJwtSecret(),
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
  CTE_SVRS_HOMOLOGACAO: {
    DISTRIBUICAO_DFE: process.env.CTE_SVRS_HOM_DIST || 'https://cte-homologacao.svrs.rs.gov.br/ws/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx',
  },
  CTE_SVRS_PRODUCAO: {
    DISTRIBUICAO_DFE: process.env.CTE_SVRS_PROD_DIST || 'https://cte.svrs.rs.gov.br/ws/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx',
  },
  AN_HOMOLOGACAO: {
    RECEPCAO_EVENTO: process.env.SEFAZ_AN_HOM_EVENTO || 'https://hom1.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  },
  AN_PRODUCAO: {
    RECEPCAO_EVENTO: process.env.SEFAZ_AN_PROD_EVENTO || 'https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
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

// ============================================================
// INTELIGÊNCIA ARTIFICIAL FISCAL (GOOGLE GEMINI)
// ============================================================
export const AI_CONFIG = {
  GEMINI_API_KEY: (process.env.GEMINI_API_KEY || '').trim(),
  MODEL: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  FALLBACK_MODELS: ['gemini-3.5-flash', 'gemini-flash-latest'],
  IS_CONFIGURED: Boolean((process.env.GEMINI_API_KEY || '').trim()),
} as const;

export default {
  SERVER, AUTH, DATABASE, SUPABASE, SEFAZ, CGIBS, RFB, ERP, CERTIFICADO, RATE_LIMIT, AI_CONFIG,
};
