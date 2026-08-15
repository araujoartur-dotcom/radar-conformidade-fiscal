/**
 * ============================================================
 * CONFIGURAÇÃO CENTRAL DE CREDENCIAIS E SEGURANÇA
 * ============================================================
 * TODAS as chaves de API, tokens, endpoints e segredos
 * devem ser definidos EXCLUSIVAMENTE aqui via variáveis de
 * ambiente (.env). NENHUMA credencial deve existir no frontend.
 * ============================================================
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '..', '.env');

dotenv.config({ path: envPath });

// Auto-generate CERT_ENCRYPTION_KEY if missing
if (!process.env.CERT_ENCRYPTION_KEY) {
  const newKey = crypto.randomBytes(32).toString('hex');
  process.env.CERT_ENCRYPTION_KEY = newKey;
  fs.appendFileSync(envPath, `\nCERT_ENCRYPTION_KEY=${newKey}\n`);
  console.log('✅ CERT_ENCRYPTION_KEY gerada automaticamente e salva no .env');
}

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] || fallback;
  if (!value) {
    console.warn(`⚠️  Variável de ambiente ${key} não definida. Usando valor padrão ou vazio.`);
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
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
} as const;

// ============================================================
// JWT / AUTENTICAÇÃO
// ============================================================
export const AUTH = {
  /** Segredo para assinar tokens JWT — DEVE ser longo e aleatório em produção */
  JWT_SECRET: requireEnv('JWT_SECRET', 'dev-secret-radar-fiscal-change-in-production-2026'),
  /** Tempo de expiração do access token */
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  /** Tempo de expiração do refresh token */
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  /** Rounds do bcrypt para hash de senhas */
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
} as const;

// ============================================================
// BANCO DE DADOS
// ============================================================
export const DATABASE = {
  /** Caminho do arquivo SQLite (POC). Em produção, migrar para PostgreSQL */
  SQLITE_PATH: process.env.DATABASE_PATH || path.resolve(__dirname, '..', 'data', 'radar_fiscal.db'),
} as const;

// ============================================================
// SEFAZ — WEBSERVICES DE HOMOLOGAÇÃO E PRODUÇÃO
// ============================================================
export const SEFAZ = {
  /** Ambiente ativo: 1 = Produção, 2 = Homologação */
  TP_AMB: process.env.SEFAZ_TP_AMB || '2',

  /** Endpoints SVRS (Sefaz Virtual do Rio Grande do Sul) — Homologação */
  SVRS_HOMOLOGACAO: {
    RECEPCAO_EVENTO: process.env.SEFAZ_SVRS_HOM_EVENTO || 'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    CONSULTA_PROTOCOLO: process.env.SEFAZ_SVRS_HOM_CONSULTA || 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    DISTRIBUICAO_DFE: process.env.SEFAZ_SVRS_HOM_DIST || 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  },

  /** Endpoints SVRS — Produção */
  SVRS_PRODUCAO: {
    RECEPCAO_EVENTO: process.env.SEFAZ_SVRS_PROD_EVENTO || 'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    CONSULTA_PROTOCOLO: process.env.SEFAZ_SVRS_PROD_CONSULTA || 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    DISTRIBUICAO_DFE: process.env.SEFAZ_SVRS_PROD_DIST || 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  },

  /** NFS-e Ambiente Nacional */
  NFSE_NACIONAL: process.env.SEFAZ_NFSE_URL || 'https://www.nfse.gov.br/SINDNFe/api/v1',
} as const;

// ============================================================
// COMITÊ GESTOR DO IBS (CGIBS) — REFORMA TRIBUTÁRIA
// ============================================================
export const CGIBS = {
  /** URL da API do Comitê Gestor do IBS */
  API_URL: requireEnv('CGIBS_API_URL', 'https://api-homologacao.cgibs.gov.br/v1'),
  /** Chave de API do CGIBS */
  API_KEY: requireEnv('CGIBS_API_KEY'),
  /** Timeout em ms para chamadas ao CGIBS */
  TIMEOUT_MS: parseInt(process.env.CGIBS_TIMEOUT_MS || '15000', 10),
} as const;

// ============================================================
// RECEITA FEDERAL DO BRASIL (RFB)
// ============================================================
export const RFB = {
  /** URL da API de Apuração Assistida RTC */
  API_URL: requireEnv('RFB_API_URL', 'https://api-homologacao.receita.fazenda.gov.br/rtc/v1'),
  /** Token Bearer para autenticação na RFB */
  BEARER_TOKEN: requireEnv('RFB_BEARER_TOKEN'),
  /** Timeout em ms para chamadas à RFB */
  TIMEOUT_MS: parseInt(process.env.RFB_TIMEOUT_MS || '20000', 10),
} as const;

// ============================================================
// INTEGRAÇÃO SAP / ERP
// ============================================================
export const ERP = {
  /** Tipo de ERP padrão */
  TIPO: process.env.ERP_TIPO || 'SAP_S4HANA',
  /** URL do endpoint SAP/ERP */
  ENDPOINT_URL: requireEnv('ERP_ENDPOINT_URL'),
  /** System ID (ex: PRD-100) */
  SYSTEM_ID: process.env.ERP_SYSTEM_ID || '',
  /** Client/Mandante SAP */
  CLIENT_NUMBER: process.env.ERP_CLIENT_NUMBER || '100',
  /** API Key para comunicação com ERP */
  API_KEY: requireEnv('ERP_API_KEY'),
  /** URL de Webhook para recebimento de eventos */
  WEBHOOK_URL: requireEnv('ERP_WEBHOOK_URL'),
} as const;

// ============================================================
// CERTIFICADO DIGITAL A1
// ============================================================
export const CERTIFICADO = {
  /** Diretório seguro onde os .PFX são armazenados (criptografados) */
  STORAGE_DIR: process.env.CERT_STORAGE_DIR || path.resolve(__dirname, '..', 'data', 'certificates'),
  /** Chave mestra para criptografia AES-256-GCM dos PFX */
  ENCRYPTION_KEY: requireEnv('CERT_ENCRYPTION_KEY'),
} as const;

// ============================================================
// RATE LIMITING
// ============================================================
export const RATE_LIMIT = {
  /** Máximo de requisições por janela de tempo (por IP) */
  MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  /** Janela de tempo em minutos */
  WINDOW_MINUTES: parseInt(process.env.RATE_LIMIT_WINDOW_MIN || '15', 10),
  /** Máximo de requisições SEFAZ por segundo (por CNPJ) */
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
  SERVER,
  AUTH,
  DATABASE,
  SUPABASE,
  SEFAZ,
  CGIBS,
  RFB,
  ERP,
  CERTIFICADO,
  RATE_LIMIT,
};

