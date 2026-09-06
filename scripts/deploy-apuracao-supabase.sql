-- ============================================================
-- SCRIPT DDL: MÓDULO DE APURAÇÃO ASSISTIDA & CONTA CORRENTE FISCAL
-- RADAR DE CONFORMIDADE FISCAL — SUPABASE POSTGRESQL
-- ============================================================
-- Execute este script no SQL Editor do seu Dashboard Supabase:
-- https://supabase.com/dashboard/project/vhkkmklzsstoxoenpyua/sql
-- ============================================================

-- 1. Tabela de Operações (Cabeçalho da Operação de Fornecimento ou Aquisição)
CREATE TABLE IF NOT EXISTS public.apuracao_operacoes (
    id VARCHAR(60) PRIMARY KEY,
    chave_acesso VARCHAR(44) NOT NULL,
    dth_emissao TIMESTAMPTZ NOT NULL,
    dth_autorizacao TIMESTAMPTZ NOT NULL,
    cnpj_fornecedor VARCHAR(14) NOT NULL,
    cnpj_adquirente VARCHAR(14) DEFAULT '',
    tipo_operacao VARCHAR(20) NOT NULL DEFAULT 'fornecimento',
    hash_acumulado VARCHAR(40) DEFAULT '',
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela de Extrato da Conta Corrente Fiscal (Ledger dos 7 Campos Oficiais CGIBS)
CREATE TABLE IF NOT EXISTS public.apuracao_extrato_cc (
    id VARCHAR(60) PRIMARY KEY,
    operacao_id VARCHAR(60) NOT NULL REFERENCES public.apuracao_operacoes(id) ON DELETE CASCADE,
    dth_lancto TIMESTAMPTZ NOT NULL,
    mov VARCHAR(150) NOT NULL,
    recurso_financeiro_disponivel_para_transferencia NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    recurso_financeiro_a_transferir NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    credito_a_propriar NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    credito_nao_utilizado NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    credito_utilizado NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    debito_em_aberto NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    debito_extinto NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    arquivo_origem VARCHAR(255) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela de Competências da Apuração Assistida (Ciclo de Vida: Em Andamento, Ajuste, Concluída)
CREATE TABLE IF NOT EXISTS public.apuracao_competencias (
    id VARCHAR(60) PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    competencia VARCHAR(7) NOT NULL,
    fase VARCHAR(30) NOT NULL DEFAULT 'em_andamento',
    total_debitos NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_creditos NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    saldo_apuracao NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    saldo_atualizado NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(empresa_id, competencia)
);

-- 4. Tabela de Credenciais e Preferências de Canais CGIBS (Webhook & Demanda GET)
CREATE TABLE IF NOT EXISTS public.apuracao_credenciais_cgibs (
    id VARCHAR(60) PRIMARY KEY,
    empresa_id UUID NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
    client_id VARCHAR(100) NOT NULL,
    client_secret VARCHAR(100) NOT NULL,
    token_contrib VARCHAR(100) DEFAULT '',
    webhook_url TEXT DEFAULT '',
    flag_webhook BOOLEAN NOT NULL DEFAULT true,
    flag_consulta_demanda BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(30) NOT NULL DEFAULT 'habilitado',
    data_habilitacao TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Índices de Performance para Consultas e Conciliação Instantânea
CREATE INDEX IF NOT EXISTS idx_apuracao_operacoes_chave ON public.apuracao_operacoes(chave_acesso);
CREATE INDEX IF NOT EXISTS idx_apuracao_operacoes_empresa ON public.apuracao_operacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_apuracao_extrato_operacao ON public.apuracao_extrato_cc(operacao_id);
CREATE INDEX IF NOT EXISTS idx_apuracao_competencias_empresa ON public.apuracao_competencias(empresa_id, competencia);

-- 6. Políticas de Segurança (Row Level Security)
ALTER TABLE public.apuracao_operacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso completo as operacoes" ON public.apuracao_operacoes;
CREATE POLICY "Permitir acesso completo as operacoes" ON public.apuracao_operacoes FOR ALL USING (true);

ALTER TABLE public.apuracao_extrato_cc ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso completo aos extratos cc" ON public.apuracao_extrato_cc;
CREATE POLICY "Permitir acesso completo aos extratos cc" ON public.apuracao_extrato_cc FOR ALL USING (true);

ALTER TABLE public.apuracao_competencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso completo as competencias" ON public.apuracao_competencias;
CREATE POLICY "Permitir acesso completo as competencias" ON public.apuracao_competencias FOR ALL USING (true);

ALTER TABLE public.apuracao_credenciais_cgibs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso as credenciais cgibs" ON public.apuracao_credenciais_cgibs;
CREATE POLICY "Permitir acesso as credenciais cgibs" ON public.apuracao_credenciais_cgibs FOR ALL USING (true);
