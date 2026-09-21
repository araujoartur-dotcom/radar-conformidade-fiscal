-- ============================================================
-- MIGRATION: ADICIONAR COLUNAS DE COMBUSTÍVEIS E METADADOS NA TABELA EMPRESAS
-- RADAR DE CONFORMIDADE FISCAL — SUPABASE POSTGRESQL
-- ============================================================
-- Execute este script no SQL Editor do seu Dashboard Supabase:
-- https://supabase.com/dashboard/project/vhkkmklzsstoxoenpyua/sql
-- ============================================================
-- DIAGNÓSTICO:
-- Erro: "Could not find the 'bloquear_credito_combustiveis' column of 'empresas' in the schema cache"
-- CAUSA: A coluna 'bloquear_credito_combustiveis' foi adicionada no código da aplicação,
-- mas ainda não havia sido criada na tabela 'empresas' do Supabase.
-- ============================================================

-- 1. Adicionar colunas de política de vedação de créditos de combustíveis
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS bloquear_credito_combustiveis INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS ncm_vedados_credito TEXT DEFAULT '2710,2711';

-- 2. Adicionar colunas cadastrais complementares (CNAE, Suframa, Grupo Contábil)
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS cnae_principal VARCHAR(10) DEFAULT NULL;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS inscricao_suframa VARCHAR(20) DEFAULT NULL;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS grupo_contabil VARCHAR(100) DEFAULT 'Carteira Geral';

-- 3. Adicionar colunas de controle de NSU caso ainda não existam
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS ultimo_nsu VARCHAR(30) DEFAULT '000000000000000';
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS max_nsu VARCHAR(30) DEFAULT '000000000000000';
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS ultimo_nsu_nfse VARCHAR(30) DEFAULT '0';
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS max_nsu_nfse VARCHAR(30) DEFAULT '0';
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS manifestar_ciencia_automatica BOOLEAN DEFAULT TRUE;

-- 4. Forçar o PostgREST a recarregar imediatamente o schema cache
NOTIFY pgrst, 'reload schema';
