-- ============================================================
-- MIGRATION EMERGENCIAL: CORRIGIR TABELAS dfe_documentos E dfe_itens
-- ============================================================
-- Execute este script no SQL Editor do Supabase Dashboard:
-- https://supabase.com/dashboard → Seu projeto → SQL Editor → New Query
-- ============================================================
-- DIAGNÓSTICO: 21 colunas faltando em dfe_documentos e 16 em dfe_itens.
-- CAUSA: As tabelas foram criadas com uma versão incompleta do schema.
-- SOLUÇÃO: Dropar e recriar com o schema completo e correto.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- PASSO 1: Dropar tabelas existentes (na ordem correta por FK)
-- ──────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.dfe_itens CASCADE;
DROP TABLE IF EXISTS public.dfe_documentos CASCADE;

-- ──────────────────────────────────────────────────────────────
-- PASSO 2: Recriar dfe_documentos com TODAS as colunas
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.dfe_documentos (
    id VARCHAR(60) PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    tipo_doc VARCHAR(10) NOT NULL,
    chave_acesso VARCHAR(44) NOT NULL UNIQUE,
    tipo_operacao VARCHAR(20) DEFAULT 'Entrada',
    numero_serie VARCHAR(50),
    data_emissao TIMESTAMPTZ,
    data_entrada TIMESTAMPTZ,
    competencia VARCHAR(7),
    fornecedor_cnpj VARCHAR(18),
    fornecedor_razao VARCHAR(255),
    fornecedor_uf VARCHAR(2),
    fornecedor_municipio VARCHAR(100) DEFAULT '',
    fornecedor_ie VARCHAR(30) DEFAULT '',
    cliente_cnpj VARCHAR(18),
    cliente_razao VARCHAR(255),
    cliente_uf VARCHAR(2),
    cliente_ie VARCHAR(30) DEFAULT '',
    situacao_doc VARCHAR(50) DEFAULT 'autorizado',
    situacao_manifestacao VARCHAR(50) DEFAULT 'sem_manifestacao',
    evento_ultimo VARCHAR(255) DEFAULT 'Autorizado o uso do DF-e',
    valor_total NUMERIC(15,2) DEFAULT 0,
    valor_icms NUMERIC(15,2) DEFAULT 0,
    valor_ipi NUMERIC(15,2) DEFAULT 0,
    valor_pis NUMERIC(15,2) DEFAULT 0,
    valor_cofins NUMERIC(15,2) DEFAULT 0,
    valor_cbs NUMERIC(15,2) DEFAULT 0,
    valor_ibs NUMERIC(15,2) DEFAULT 0,
    valor_is NUMERIC(15,2) DEFAULT 0,
    valor_irrf NUMERIC(15,2) DEFAULT 0,
    valor_inss NUMERIC(15,2) DEFAULT 0,
    valor_iss NUMERIC(15,2) DEFAULT 0,
    valor_csll NUMERIC(15,2) DEFAULT 0,
    xml_raw TEXT DEFAULT '',
    status_sefaz VARCHAR(30) DEFAULT 'autorizado',
    protocolo_sefaz VARCHAR(50) DEFAULT '',
    alerta_fraude BOOLEAN DEFAULT FALSE,
    download_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_dfe_doc_empresa ON public.dfe_documentos(empresa_id);
CREATE INDEX idx_dfe_doc_tipo ON public.dfe_documentos(tipo_doc);
CREATE INDEX idx_dfe_doc_emissao ON public.dfe_documentos(data_emissao);
CREATE INDEX idx_dfe_doc_fornecedor ON public.dfe_documentos(fornecedor_cnpj);
CREATE INDEX idx_dfe_doc_cliente ON public.dfe_documentos(cliente_cnpj);
CREATE INDEX idx_dfe_doc_competencia ON public.dfe_documentos(competencia);

-- ──────────────────────────────────────────────────────────────
-- PASSO 3: Recriar dfe_itens com TODAS as colunas
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.dfe_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_id VARCHAR(60) NOT NULL REFERENCES public.dfe_documentos(id) ON DELETE CASCADE,
    item_nro INTEGER,
    codigo_item VARCHAR(60) DEFAULT '',
    descricao_item TEXT,
    ncm VARCHAR(10),
    cest VARCHAR(10) DEFAULT '',
    cfop VARCHAR(4),
    cclasstrib VARCHAR(6),
    cst_csosn VARCHAR(10),
    natureza_operacao VARCHAR(100),
    quantidade NUMERIC(15,4) DEFAULT 1,
    unidade VARCHAR(10) DEFAULT 'UN',
    valor_unitario NUMERIC(15,4) DEFAULT 0,
    valor_bruto_item NUMERIC(15,2) DEFAULT 0,
    desconto_incondicional NUMERIC(15,2) DEFAULT 0,
    frete_seguro_rateado NUMERIC(15,2) DEFAULT 0,
    valor_liquido_item NUMERIC(15,2) DEFAULT 0,
    base_icms NUMERIC(15,2) DEFAULT 0,
    aliquota_icms NUMERIC(6,3) DEFAULT 0,
    valor_icms NUMERIC(15,2) DEFAULT 0,
    base_ipi NUMERIC(15,2) DEFAULT 0,
    aliquota_ipi NUMERIC(6,3) DEFAULT 0,
    valor_ipi NUMERIC(15,2) DEFAULT 0,
    base_pis NUMERIC(15,2) DEFAULT 0,
    aliquota_pis NUMERIC(6,3) DEFAULT 0,
    valor_pis NUMERIC(15,2) DEFAULT 0,
    base_cofins NUMERIC(15,2) DEFAULT 0,
    aliquota_cofins NUMERIC(6,3) DEFAULT 0,
    valor_cofins NUMERIC(15,2) DEFAULT 0,
    base_ibs NUMERIC(15,2) DEFAULT 0,
    aliquota_ibs NUMERIC(6,3) DEFAULT 0,
    valor_ibs NUMERIC(15,2) DEFAULT 0,
    base_cbs NUMERIC(15,2) DEFAULT 0,
    aliquota_cbs NUMERIC(6,3) DEFAULT 0,
    valor_cbs NUMERIC(15,2) DEFAULT 0,
    valor_is NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dfe_itens_doc ON public.dfe_itens(documento_id);
CREATE INDEX idx_dfe_itens_ncm ON public.dfe_itens(ncm);
CREATE INDEX idx_dfe_itens_cfop ON public.dfe_itens(cfop);

-- ──────────────────────────────────────────────────────────────
-- PASSO 4: Forçar reload do schema cache do PostgREST
-- ──────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ──────────────────────────────────────────────────────────────
-- VERIFICAÇÃO: Confirmar que as tabelas foram criadas corretamente
-- ──────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'dfe_documentos'
ORDER BY ordinal_position;
