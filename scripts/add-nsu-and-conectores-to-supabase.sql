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

-- 4. Seed Inicial de Capitais, Polos Industriais e Hubs Operacionais (40+ Prefeituras)
INSERT INTO public.conectores_municipais (
    id, ibge, municipio, uf, provedor, tecnologia, endpoint_producao, endpoint_homologacao, tipo_autenticacao, status
) VALUES 
-- Capitais e Grandes Metrópoles
('con-3550308', '3550308', 'São Paulo', 'SP', 'PMSP (Nota do Milhão)', 'SOAP', 'https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx', 'https://nfehomologacao.prefeitura.sp.gov.br/ws/lotenfe.asmx', 'certificado_a1', 'ativo'),
('con-3304557', '3304557', 'Rio de Janeiro', 'RJ', 'Nota Carioca (ABRASF 1.0)', 'SOAP', 'https://notacarioca.rio.gov.br/WSNacional/nfse.asmx', 'https://homologacao.notacarioca.rio.gov.br/WSNacional/nfse.asmx', 'certificado_a1', 'ativo'),
('con-3106200', '3106200', 'Belo Horizonte', 'MG', 'BHISS (ABRASF 2.04)', 'SOAP', 'https://bhissdigitalws.pbh.gov.br/bhiss-ws/nfse', 'https://bhisshomologaws.pbh.gov.br/bhiss-ws/nfse', 'certificado_a1', 'ativo'),
('con-2611606', '2611606', 'Recife', 'PE', 'Recife (ABRASF 1.1 / 2.04)', 'SOAP', 'https://nfse.recife.pe.gov.br/WS/nfse_v03.asmx', '', 'certificado_a1', 'ativo'),
('con-4314902', '4314902', 'Porto Alegre', 'RS', 'NFSE POA (ABRASF 2.04)', 'SOAP', 'https://nfse.portoalegre.rs.gov.br/bhiss-ws/nfse', '', 'certificado_a1', 'ativo'),
('con-4106902', '4106902', 'Curitiba', 'PR', 'Curitiba (ABRASF 2.04)', 'SOAP', 'https://isscuritiba.curitiba.pr.gov.br/Iss.NfseWebService/Nfsews.asmx', '', 'certificado_token', 'configuracao_pendente'),
('con-1302603', '1302603', 'Manaus', 'AM', 'Ábaco (ABRASF)', 'SOAP', 'https://nfse-prd.manaus.am.gov.br/nfse', 'https://nfsev-prd.manaus.am.gov.br/nfsev', 'certificado_a1', 'ativo'),
('con-2927408', '2927408', 'Salvador', 'BA', 'Salvador (ABRASF 1.0)', 'SOAP', 'https://nfse.salvador.ba.gov.br/rps/service.asmx', '', 'token_api', 'configuracao_pendente'),
('con-5300108', '5300108', 'Brasília', 'DF', 'ISSNET (ABRASF 2.04)', 'SOAP', 'https://www.issnetonline.com.br/webservice/df/servicos.asmx', '', 'usuario_senha', 'configuracao_pendente'),
('con-3136702', '3136702', 'Juiz de Fora', 'MG', 'ISS-e JF (ABRASF 2.02)', 'SOAP', 'https://nfse.pjf.mg.gov.br:4431/WebService.asmx', 'https://nfse.homologacao.pjf.mg.gov.br:4432/WebService.asmx', 'certificado_a1', 'ativo'),
('con-2704302', '2704302', 'Maceió', 'AL', 'GINFES (ABRASF)', 'SOAP', 'https://producao.ginfes.com.br/ServiceGinfesImpl', '', 'certificado_a1', 'ativo'),
('con-1501402', '1501402', 'Belém', 'PA', 'ISSONLINE (DSF)', 'SOAP', 'https://iss.belem.pa.gov.br', '', 'certificado_a1', 'ativo'),
('con-2111300', '2111300', 'São Luís', 'MA', 'ISSONLINE (DSF)', 'SOAP', 'https://iss.saoluis.ma.gov.br', '', 'certificado_a1', 'ativo'),
('con-2211001', '2211001', 'Teresina', 'PI', 'ISSONLINE (DSF)', 'SOAP', 'https://iss.teresina.pi.gov.br', '', 'certificado_a1', 'ativo'),
('con-5002704', '5002704', 'Campo Grande', 'MS', 'ISSONLINE (DSF)', 'SOAP', 'https://issonline.pmcg.ms.gov.br', '', 'certificado_a1', 'ativo'),
('con-2800308', '2800308', 'Aracaju', 'SE', 'WebISS', 'SOAP', 'https://aracaju.webiss.com.br/ws/nfse.asmx', '', 'certificado_a1', 'ativo'),
('con-1721000', '1721000', 'Palmas', 'TO', 'WebISS', 'SOAP', 'https://palmas.webiss.com.br/ws/nfse.asmx', '', 'certificado_a1', 'ativo'),
('con-1200401', '1200401', 'Rio Branco', 'AC', 'Ábaco (ABRASF)', 'SOAP', 'https://nota.riobranco.ac.gov.br', 'https://homologa.e-nfs.com.br/riobranco', 'certificado_a1', 'ativo'),

-- Rede GINFES: Polos Industriais e Logísticos
('con-3518800', '3518800', 'Guarulhos', 'SP', 'GINFES (ABRASF)', 'SOAP', 'https://producao.ginfes.com.br/ServiceGinfesImpl', '', 'certificado_a1', 'ativo'),
('con-3106705', '3106705', 'Betim', 'MG', 'GINFES (ABRASF)', 'SOAP', 'https://producao.ginfes.com.br/ServiceGinfesImpl', '', 'certificado_a1', 'ativo'),
('con-3118601', '3118601', 'Contagem', 'MG', 'GINFES (ABRASF)', 'SOAP', 'https://producao.ginfes.com.br/ServiceGinfesImpl', '', 'certificado_a1', 'ativo'),
('con-3548708', '3548708', 'São Bernardo do Campo', 'SP', 'GINFES (ABRASF)', 'SOAP', 'https://producao.ginfes.com.br/ServiceGinfesImpl', '', 'certificado_a1', 'ativo'),
('con-3547809', '3547809', 'Santo André', 'SP', 'GINFES (ABRASF)', 'SOAP', 'https://producao.ginfes.com.br/ServiceGinfesImpl', '', 'certificado_a1', 'ativo'),
('con-3513801', '3513801', 'Diadema', 'SP', 'GINFES (ABRASF)', 'SOAP', 'https://producao.ginfes.com.br/ServiceGinfesImpl', '', 'certificado_a1', 'ativo'),
('con-3529400', '3529400', 'Mauá', 'SP', 'GINFES (ABRASF)', 'SOAP', 'https://producao.ginfes.com.br/ServiceGinfesImpl', '', 'certificado_a1', 'ativo'),
('con-3548500', '3548500', 'Santos', 'SP', 'GINFES (ABRASF)', 'SOAP', 'https://producao.ginfes.com.br/ServiceGinfesImpl', '', 'certificado_a1', 'ativo'),
('con-3525904', '3525904', 'Jundiaí', 'SP', 'GINFES (ABRASF)', 'SOAP', 'https://producao.ginfes.com.br/ServiceGinfesImpl', '', 'certificado_a1', 'ativo'),
('con-3543402', '3543402', 'Ribeirão Preto', 'SP', 'GINFES (ABRASF)', 'SOAP', 'https://producao.ginfes.com.br/ServiceGinfesImpl', '', 'certificado_a1', 'ativo'),
('con-3170701', '3170701', 'Varginha', 'MG', 'GINFES (ABRASF)', 'SOAP', 'https://producao.ginfes.com.br/ServiceGinfesImpl', '', 'certificado_a1', 'ativo'),
('con-2604106', '2604106', 'Caruaru', 'PE', 'GINFES (ABRASF)', 'SOAP', 'https://producao.ginfes.com.br/ServiceGinfesImpl', '', 'certificado_a1', 'ativo'),
('con-4118204', '4118204', 'Paranaguá', 'PR', 'GINFES (ABRASF)', 'SOAP', 'https://producao.ginfes.com.br/ServiceGinfesImpl', '', 'certificado_a1', 'ativo'),
('con-1500800', '1500800', 'Ananindeua', 'PA', 'GINFES (ABRASF)', 'SOAP', 'https://producao.ginfes.com.br/ServiceGinfesImpl', '', 'certificado_a1', 'ativo'),

-- Rede DSF: Grandes Cidades e Polos Econômicos
('con-3509502', '3509502', 'Campinas', 'SP', 'ISSONLINE (DSF)', 'REST', 'https://issonline.campinas.sp.gov.br/ws/v1', '', 'token_api', 'configuracao_pendente'),
('con-3303500', '3303500', 'Nova Iguaçu', 'RJ', 'ISSONLINE (DSF)', 'SOAP', 'https://iss.novaiguacu.rj.gov.br', '', 'certificado_a1', 'ativo'),
('con-3170206', '3170206', 'Uberlândia', 'MG', 'ISSONLINE (DSF)', 'SOAP', 'https://udf.uberlandia.mg.gov.br', '', 'certificado_a1', 'ativo'),
('con-3549904', '3549904', 'São José dos Campos', 'SP', 'ISSONLINE (DSF)', 'SOAP', 'https://iss.sjc.sp.gov.br', '', 'certificado_a1', 'ativo'),
('con-3552205', '3552205', 'Sorocaba', 'SP', 'ISSONLINE (DSF)', 'SOAP', 'https://iss.sorocaba.sp.gov.br', '', 'certificado_a1', 'ativo'),

-- Polos de Refinarias e Terminais Operacionais de Petróleo e Gás
('con-3301702', '3301702', 'Duque de Caxias', 'RJ', 'SMARAPD / IPM', 'SOAP', 'https://nfse.duquedecaxias.rj.gov.br', '', 'certificado_a1', 'ativo'),
('con-3536505', '3536505', 'Paulínia', 'SP', 'SIGCORP (ABRASF)', 'SOAP', 'https://paulinia.sigcorp.com.br/ws/nfse.asmx', '', 'certificado_a1', 'ativo'),
('con-4304606', '4304606', 'Canoas', 'RS', 'IPM Saúde e Gestão', 'SOAP', 'https://canoas.atende.net/ws', '', 'certificado_a1', 'ativo'),
('con-4101804', '4101804', 'Araucária', 'PR', 'IPM Saúde e Gestão', 'SOAP', 'https://araucaria.atende.net/ws', '', 'certificado_a1', 'ativo')
ON CONFLICT (ibge) DO UPDATE SET 
    endpoint_producao = EXCLUDED.endpoint_producao,
    endpoint_homologacao = EXCLUDED.endpoint_homologacao,
    status = EXCLUDED.status;

-- 5. Expandir tamanho da chave de acesso para comportar a NFS-e Nacional (50 dígitos)
ALTER TABLE public.dfe_documentos ALTER COLUMN chave_acesso TYPE VARCHAR(60);
ALTER TABLE public.dfe_documentos ALTER COLUMN numero_serie TYPE VARCHAR(50);

