-- ============================================================
-- MIGRATION: ADICIONAR COLUNAS DE NSU E CONECTORES MUNICIPAIS
-- ============================================================
-- Execute este script no SQL Editor do Supabase Dashboard:
-- https://supabase.com/dashboard → Seu projeto → SQL Editor → New Query
-- ============================================================

-- 1. Adicionar colunas de controle de NSU (NF-e, CT-e e NFS-e) na tabela empresas
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS ultimo_nsu VARCHAR(30) DEFAULT '000000000000000';
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS max_nsu VARCHAR(30) DEFAULT '000000000000000';
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS ultimo_nsu_nfse VARCHAR(30) DEFAULT '0';
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS max_nsu_nfse VARCHAR(30) DEFAULT '0';
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS manifestar_ciencia_automatica BOOLEAN DEFAULT TRUE;

-- 2. Criar a tabela de Conectores Municipais no Supabase
CREATE TABLE IF NOT EXISTS public.conectores_municipais (
    id VARCHAR(60) PRIMARY KEY,
    ibge VARCHAR(7) NOT NULL UNIQUE,
    municipio VARCHAR(100) NOT NULL,
    uf VARCHAR(2) NOT NULL,
    provedor VARCHAR(100) NOT NULL,
    tecnologia VARCHAR(10) NOT NULL DEFAULT 'SOAP',
    endpoint_producao TEXT DEFAULT '',
    endpoint_homologacao TEXT DEFAULT '',
    tipo_autenticacao VARCHAR(30) NOT NULL DEFAULT 'certificado_a1',
    token_api TEXT DEFAULT '',
    usuario VARCHAR(100) DEFAULT '',
    senha TEXT DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'ativo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices de busca rápida
CREATE INDEX IF NOT EXISTS idx_conectores_ibge ON public.conectores_municipais(ibge);
CREATE INDEX IF NOT EXISTS idx_conectores_uf ON public.conectores_municipais(uf);

-- 4. Seed Inicial das Principais Capitais e Prefeituras Validadas
INSERT INTO public.conectores_municipais (
    id, ibge, municipio, uf, provedor, tecnologia, endpoint_producao, endpoint_homologacao, tipo_autenticacao, status
) VALUES 
('con-3550308', '3550308', 'São Paulo', 'SP', 'PMSP (Nota do Milhão)', 'SOAP', 'https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx', 'https://nfehomologacao.prefeitura.sp.gov.br/ws/lotenfe.asmx', 'certificado_a1', 'ativo'),
('con-3304557', '3304557', 'Rio de Janeiro', 'RJ', 'Nota Carioca (ABRASF 1.0)', 'SOAP', 'https://notacarioca.rio.gov.br/WSNacional/nfse.asmx', 'https://homologacao.notacarioca.rio.gov.br/WSNacional/nfse.asmx', 'certificado_a1', 'ativo'),
('con-3106200', '3106200', 'Belo Horizonte', 'MG', 'BHISS (ABRASF 2.04)', 'SOAP', 'https://bhissdigitalws.pbh.gov.br/bhiss-ws/nfse', 'https://bhisshomologaws.pbh.gov.br/bhiss-ws/nfse', 'certificado_a1', 'ativo'),
('con-2611606', '2611606', 'Recife', 'PE', 'Recife (ABRASF 1.1 / 2.04)', 'SOAP', 'https://nfse.recife.pe.gov.br/WS/nfse_v03.asmx', '', 'certificado_a1', 'ativo'),
('con-3136702', '3136702', 'Juiz de Fora', 'MG', 'ISS-e JF (ABRASF 2.02)', 'SOAP', 'https://nfse.pjf.mg.gov.br:4431/WebService.asmx', 'https://nfse.homologacao.pjf.mg.gov.br:4432/WebService.asmx', 'certificado_a1', 'ativo'),
('con-4106902', '4106902', 'Curitiba', 'PR', 'Curitiba (ABRASF 2.04)', 'SOAP', 'https://isscuritiba.curitiba.pr.gov.br/Iss.NfseWebService/Nfsews.asmx', '', 'certificado_token', 'configuracao_pendente'),
('con-4314902', '4314902', 'Porto Alegre', 'RS', 'NFSE POA (ABRASF 2.04)', 'SOAP', 'https://nfse.portoalegre.rs.gov.br/bhiss-ws/nfse', '', 'certificado_a1', 'ativo'),
('con-1302603', '1302603', 'Manaus', 'AM', 'Ábaco (ABRASF)', 'SOAP', 'https://nfse-prd.manaus.am.gov.br/nfse', 'https://nfsev-prd.manaus.am.gov.br/nfsev', 'certificado_a1', 'ativo'),
('con-3518800', '3518800', 'Guarulhos', 'SP', 'GINFES (ABRASF)', 'SOAP', 'https://producao.ginfes.com.br/ServiceGinfesImpl', '', 'certificado_a1', 'ativo'),
('con-3509502', '3509502', 'Campinas', 'SP', 'ISSONLINE (DSF)', 'REST', 'https://issonline.campinas.sp.gov.br/ws/v1', '', 'token_api', 'configuracao_pendente'),
('con-2927408', '2927408', 'Salvador', 'BA', 'Salvador (ABRASF 1.0)', 'SOAP', 'https://nfse.salvador.ba.gov.br/rps/service.asmx', '', 'token_api', 'configuracao_pendente'),
('con-5300108', '5300108', 'Brasília', 'DF', 'ISSNET (ABRASF 2.04)', 'SOAP', 'https://www.issnetonline.com.br/webservice/df/servicos.asmx', '', 'usuario_senha', 'configuracao_pendente')
ON CONFLICT (ibge) DO UPDATE SET 
    endpoint_producao = EXCLUDED.endpoint_producao,
    endpoint_homologacao = EXCLUDED.endpoint_homologacao,
    status = EXCLUDED.status;
