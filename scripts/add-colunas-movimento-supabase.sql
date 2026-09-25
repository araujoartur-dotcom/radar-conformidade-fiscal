-- ============================================================
-- MIGRATION: ADICIONAR direcao_movimento E tomador_cnpj NO SUPABASE
-- ============================================================
-- Execute este script no SQL Editor do Supabase Dashboard:
-- https://supabase.com/dashboard → Seu projeto → SQL Editor → New Query
-- ============================================================

ALTER TABLE public.dfe_documentos ADD COLUMN IF NOT EXISTS direcao_movimento VARCHAR(10) DEFAULT 'ENTRADA';
ALTER TABLE public.dfe_documentos ADD COLUMN IF NOT EXISTS tomador_cnpj VARCHAR(20) DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_dfe_docs_direcao ON public.dfe_documentos(empresa_id, direcao_movimento);
CREATE INDEX IF NOT EXISTS idx_dfe_docs_tomador ON public.dfe_documentos(tomador_cnpj);

-- Alinhar documentos históricos com base no tipo_operacao
UPDATE public.dfe_documentos
SET direcao_movimento = CASE 
  WHEN LOWER(tipo_operacao) IN ('saída', 'saida', 'saídas', 'saidas', '1') THEN 'SAIDA'
  ELSE 'ENTRADA'
END
WHERE direcao_movimento IS NULL OR direcao_movimento = '' OR direcao_movimento = 'ENTRADA';

-- Recarregar cache de schema do PostgREST para refletir colunas imediatamente
NOTIFY pgrst, 'reload schema';
