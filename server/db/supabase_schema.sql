-- ============================================================
-- SCHEMA DDL POSTGRESQL / SUPABASE — RADAR DE CONFORMIDADE FISCAL
-- ============================================================
-- Execute este script no SQL Editor do Supabase para criar
-- toda a estrutura relacional, constraints, RLS e índices.
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. TABELA DE EMPRESAS / TENANTS (Matrizes e Filiais)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cnpj_raiz VARCHAR(8) NOT NULL,
    cnpj_completo VARCHAR(18) NOT NULL UNIQUE,
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255) DEFAULT '',
    uf VARCHAR(2) NOT NULL DEFAULT 'SP',
    regime_tributario VARCHAR(50) NOT NULL DEFAULT 'Lucro Real',
    status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'suspenso', 'inativo')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_empresas_cnpj_raiz ON public.empresas(cnpj_raiz);
CREATE INDEX IF NOT EXISTS idx_empresas_uf ON public.empresas(uf);

-- ============================================================
-- 2. TABELA DE USUÁRIOS (Sincronizado ou Custom)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    perfil VARCHAR(50) NOT NULL DEFAULT 'analista_fiscal' 
        CHECK (perfil IN ('admin_master', 'contador_gestor', 'analista_fiscal', 'auditor_externo', 'operador_leitura')),
    mfa_habilitado BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_segredo TEXT DEFAULT NULL,
    mfa_metodo VARCHAR(50) DEFAULT 'authenticator_app',
    status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'bloqueado', 'pendente_mfa')),
    ultimo_acesso TIMESTAMPTZ DEFAULT NULL,
    ip_ultimo_acesso VARCHAR(45) DEFAULT NULL,
    tentativas_falhas INTEGER NOT NULL DEFAULT 0,
    bloqueado_ate TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);

-- ============================================================
-- 3. VÍNCULO USUÁRIO <-> EMPRESA (Multi-Tenant com Permissões)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usuario_empresa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    permissao VARCHAR(20) NOT NULL DEFAULT 'leitura' CHECK (permissao IN ('total', 'escrita', 'leitura')),
    modulos_permitidos VARCHAR(255) DEFAULT '*',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(usuario_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_empresa_usr ON public.usuario_empresa(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_empresa_emp ON public.usuario_empresa(empresa_id);

-- ============================================================
-- 4. SESSÕES ATIVAS (JWT Refresh Tokens)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sessoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    empresa_ativa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
    refresh_token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) DEFAULT '',
    user_agent TEXT DEFAULT '',
    expires_at TIMESTAMPTZ NOT NULL,
    revogada BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. COFRE DE CERTIFICADOS DIGITAIS A1 (Criptografados)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.certificados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL DEFAULT 'A1_PKCS12',
    arquivo_nome VARCHAR(255) NOT NULL,
    arquivo_path_enc TEXT NOT NULL,
    senha_enc TEXT NOT NULL,
    iv VARCHAR(64) NOT NULL,
    auth_tag VARCHAR(64) NOT NULL,
    impressao_digital VARCHAR(128) DEFAULT '',
    emissor VARCHAR(255) DEFAULT '',
    validade DATE NOT NULL,
    status_alerta VARCHAR(30) DEFAULT 'ok',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificados_empresa ON public.certificados(empresa_id);

-- ============================================================
-- 6. CONFIGURAÇÃO DE DIRETÓRIOS POR CNPJ RAIZ
-- ============================================================
CREATE TABLE IF NOT EXISTS public.diretorios_config (
    id VARCHAR(50) PRIMARY KEY,
    cnpj_raiz VARCHAR(8) NOT NULL UNIQUE,
    razao_social VARCHAR(255) NOT NULL,
    diretorio_entrada TEXT NOT NULL,
    subpasta_data_entrada BOOLEAN NOT NULL DEFAULT TRUE,
    estrutura_nome_entrada VARCHAR(50) NOT NULL DEFAULT 'chave',
    diretorio_saida TEXT NOT NULL,
    subpasta_data_saida BOOLEAN NOT NULL DEFAULT TRUE,
    estrutura_nome_saida VARCHAR(50) NOT NULL DEFAULT 'chave',
    diretorio_eventos TEXT NOT NULL,
    auto_organizar BOOLEAN NOT NULL DEFAULT TRUE,
    status_monitoramento VARCHAR(30) NOT NULL DEFAULT 'ativo',
    ultima_sincronizacao VARCHAR(50) DEFAULT 'Pendente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. ALÍQUOTAS DE REFERÊNCIA CBS / IBS (por Competência)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aliquotas_referencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competencia_inicio DATE NOT NULL,
    competencia_fim DATE DEFAULT NULL,
    tipo_tributo VARCHAR(10) NOT NULL CHECK (tipo_tributo IN ('CBS', 'IBS', 'IS')),
    aliquota_referencia NUMERIC(6,3) NOT NULL,
    aliquota_reducao_60 NUMERIC(6,3) DEFAULT NULL,
    aliquota_reducao_30 NUMERIC(6,3) DEFAULT NULL,
    descricao TEXT DEFAULT '',
    base_legal TEXT DEFAULT '',
    fase_transicao VARCHAR(50) DEFAULT '',
    observacoes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_competencia_tributo UNIQUE(competencia_inicio, tipo_tributo)
);

-- ============================================================
-- 8. MAPA cClassTrib x REGRAS TRIBUTÁRIAS (6 Dígitos)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cclasstrib_regras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID DEFAULT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    cclasstrib VARCHAR(6) NOT NULL CHECK (length(cclasstrib) = 6),
    descricao_interna TEXT NOT NULL,
    tratamento_esperado VARCHAR(50) NOT NULL DEFAULT 'tributado',
    permite_credito VARCHAR(20) NOT NULL DEFAULT 'Sim' CHECK (permite_credito IN ('Sim', 'Não', 'Parcial', 'Depende')),
    aliquota_esperada VARCHAR(50) DEFAULT '',
    alertas TEXT DEFAULT '',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cclasstrib_code ON public.cclasstrib_regras(cclasstrib);

-- ============================================================
-- 9. MAPA CFOP x TRATAMENTO DE CRÉDITO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cfop_tratamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID DEFAULT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    cfop VARCHAR(4) NOT NULL,
    descricao TEXT NOT NULL,
    categoria VARCHAR(50) NOT NULL DEFAULT 'Compra',
    tratamento_padrao VARCHAR(30) NOT NULL DEFAULT 'Depende',
    exige_onerosidade BOOLEAN NOT NULL DEFAULT TRUE,
    exige_validacao_cclasstrib BOOLEAN NOT NULL DEFAULT TRUE,
    evidencia_minima TEXT DEFAULT '',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cfop_code ON public.cfop_tratamento(cfop);

-- ============================================================
-- 10. REGRAS DE ELEGIBILIDADE DE CRÉDITO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.regras_elegibilidade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID DEFAULT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    codigo_regra VARCHAR(50) NOT NULL UNIQUE,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT NOT NULL,
    tipo_aquisicao VARCHAR(50) DEFAULT '',
    cfops_aplicaveis TEXT DEFAULT '[]',
    cclasstrib_aplicaveis TEXT DEFAULT '[]',
    resultado_padrao VARCHAR(30) NOT NULL DEFAULT 'Pendente',
    exige_onerosidade BOOLEAN NOT NULL DEFAULT TRUE,
    exige_evidencia_cobranca BOOLEAN NOT NULL DEFAULT TRUE,
    evidencia_minima TEXT DEFAULT '',
    base_legal TEXT DEFAULT '',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. DOCUMENTOS FISCAIS ELETRÔNICOS (DF-e) & ITENS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dfe_documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    fornecedor_municipio VARCHAR(100),
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

CREATE TABLE IF NOT EXISTS public.dfe_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_id UUID NOT NULL REFERENCES public.dfe_documentos(id) ON DELETE CASCADE,
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

-- ============================================================
-- 12. LOG DE AUDITORIA & EVENTOS TRANSMITIDOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    nivel VARCHAR(10) NOT NULL DEFAULT 'INFO',
    servico VARCHAR(50) NOT NULL DEFAULT 'API',
    correlation_id VARCHAR(100) DEFAULT '',
    empresa_id VARCHAR(100) DEFAULT '',
    usuario_id VARCHAR(100) DEFAULT '',
    usuario_email VARCHAR(255) DEFAULT '',
    acao VARCHAR(100) NOT NULL,
    descricao TEXT NOT NULL,
    ip_address VARCHAR(45) DEFAULT '',
    dados_extras JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.eventos_transmitidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    documento_id UUID REFERENCES public.dfe_documentos(id) ON DELETE SET NULL,
    chave_acesso VARCHAR(44) NOT NULL,
    tipo_dfe VARCHAR(10) NOT NULL,
    codigo_evento VARCHAR(10) NOT NULL,
    nome_evento VARCHAR(100) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    autor_cnpj VARCHAR(18) DEFAULT '',
    origem_evento VARCHAR(30) NOT NULL DEFAULT 'proprio',
    justificativa TEXT DEFAULT '',
    ambiente VARCHAR(5) NOT NULL DEFAULT '2',
    protocolo_sefaz VARCHAR(50) DEFAULT '',
    xml_envio TEXT DEFAULT '',
    xml_retorno TEXT DEFAULT '',
    codigo_retorno VARCHAR(10) DEFAULT '',
    motivo_retorno TEXT DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'pendente',
    detalhes_reforma JSONB DEFAULT '{}'::jsonb,
    data_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE VIEW public.dfe_eventos AS 
  SELECT 
    id, 
    documento_id, 
    empresa_id, 
    chave_acesso, 
    codigo_evento AS tipo_evento, 
    nome_evento, 
    autor_cnpj, 
    origem_evento, 
    protocolo_sefaz AS protocolo, 
    xml_envio, 
    xml_retorno, 
    codigo_retorno, 
    motivo_retorno, 
    status, 
    data_hora AS dh_evento, 
    created_at 
  FROM public.eventos_transmitidos;

-- ============================================================
-- PARCEIROS DE NEGÓCIO (MDM FISCAL & SPED / SCANC)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parceiros_negocio (
    id VARCHAR(100) PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    tipo_pessoa VARCHAR(2) NOT NULL DEFAULT 'PJ',
    papel VARCHAR(20) NOT NULL DEFAULT 'fornecedor',
    cpf_cnpj VARCHAR(20) NOT NULL,
    cnpj_raiz VARCHAR(8),
    cnpj_ordem VARCHAR(4),
    cnpj_dv VARCHAR(2),
    id_estrangeiro VARCHAR(50),
    razao_social VARCHAR(200) NOT NULL,
    nome_fantasia VARCHAR(150),
    natureza_juridica VARCHAR(10) DEFAULT '2062',
    regime_tributario VARCHAR(5) DEFAULT '04',
    esfera_publica VARCHAR(5) DEFAULT 'NA',
    segmento VARCHAR(10) DEFAULT 'IND',
    cnae_principal VARCHAR(10),
    cnaes_secundarios JSONB DEFAULT '[]'::jsonb,
    status_cadastro VARCHAR(2) DEFAULT 'A',
    endereco JSONB NOT NULL DEFAULT '{}'::jsonb,
    fiscal JSONB NOT NULL DEFAULT '{}'::jsonb,
    retencoes JSONB NOT NULL DEFAULT '{}'::jsonb,
    contabil JSONB NOT NULL DEFAULT '{}'::jsonb,
    situacao_cadastral_sefaz VARCHAR(50) DEFAULT 'Habilitado',
    data_ultima_consulta_sefaz TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parceiros_cpf_cnpj ON public.parceiros_negocio(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_parceiros_razao ON public.parceiros_negocio(razao_social);
CREATE INDEX IF NOT EXISTS idx_parceiros_papel ON public.parceiros_negocio(papel);
CREATE INDEX IF NOT EXISTS idx_parceiros_regime ON public.parceiros_negocio(regime_tributario);

ALTER TABLE public.parceiros_negocio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acesso completo aos parceiros de negócio" ON public.parceiros_negocio FOR ALL USING (true);

-- ============================================================
-- 13. SEED INICIAL DE DADOS MESTRES (PostgreSQL)
-- ============================================================

-- Alíquotas de Referência CBS / IBS
INSERT INTO public.aliquotas_referencia (competencia_inicio, competencia_fim, tipo_tributo, aliquota_referencia, descricao, base_legal, fase_transicao)
VALUES 
('2026-01-01', '2026-12-31', 'CBS', 0.900, 'CBS Teste (Art. 342 LC 214/25) — Alíquota teste de adaptação', 'LC 214/2025, Art. 342', 'teste_2026'),
('2026-01-01', '2026-12-31', 'IBS', 0.100, 'IBS Teste (Art. 342 LC 214/25) — Alíquota teste de adaptação', 'LC 214/2025, Art. 342', 'teste_2026'),
('2027-01-01', '2027-12-31', 'CBS', 8.800, 'CBS Referência — Substituição integral de PIS/COFINS', 'LC 214/2025', 'transicao_2027'),
('2027-01-01', '2027-12-31', 'IBS', 17.700, 'IBS Referência — Substituição progressiva de ICMS/ISS', 'LC 214/2025', 'transicao_2027'),
('2033-01-01', NULL, 'CBS', 8.800, 'CBS Definitiva', 'LC 214/2025', 'definitiva'),
('2033-01-01', NULL, 'IBS', 17.700, 'IBS Definitiva', 'LC 214/2025', 'definitiva')
ON CONFLICT (competencia_inicio, tipo_tributo) DO UPDATE 
SET aliquota_referencia = EXCLUDED.aliquota_referencia, descricao = EXCLUDED.descricao, updated_at = NOW();

-- cClassTrib Oficial 6 Dígitos
INSERT INTO public.cclasstrib_regras (cclasstrib, descricao_interna, tratamento_esperado, permite_credito, aliquota_esperada, alertas)
VALUES
('000001', 'Operação Tributada Integralmente IBS/CBS', 'tributado', 'Sim', '26.5% (8.8% CBS + 17.7% IBS)', 'Verificar destaque de alíquota no XML.'),
('100001', 'Alíquota Reduzida de Cesta Básica / Saúde (60%)', 'aliquota_reduzida', 'Sim', '10.6% (60% Redução)', 'Conferir enquadramento NCM na lista do regulamento.'),
('100002', 'Alíquota Reduzida 30% — Serviços de Educação', 'aliquota_reduzida', 'Sim', '18.55% (30% Redução)', 'Aplicável a serviços educacionais conforme Art. 262.'),
('200001', 'Isenção / Imunidade Constitucional', 'isento', 'Não', '0.00%', 'Crédito vedado por ausência de tributação na entrada.'),
('300001', 'Não Incidência / Exportação', 'nao_incidencia', 'Não', '0.00%', 'Não gera crédito de entrada.'),
('900001', 'Regime Específico Monofásico (Combustíveis/Bebidas)', 'monofasico', 'Depende', 'Alíquota Específica', 'Exige regra de retenção na origem.')
ON CONFLICT DO NOTHING;

-- CFOP x Tratamento
INSERT INTO public.cfop_tratamento (cfop, descricao, categoria, tratamento_padrao, exige_onerosidade, exige_validacao_cclasstrib, evidencia_minima)
VALUES
('1102', 'Compra para comercialização (Estado)', 'Compra', 'Elegível', TRUE, TRUE, 'XML NF-e com Chave Válida + GRN Recebimento'),
('2102', 'Compra para comercialização (Outro Estado)', 'Compra', 'Elegível', TRUE, TRUE, 'XML NF-e com Chave Válida + CT-e Vinculado'),
('1551', 'Compra de bem para o ativo imobilizado', 'Compra', 'Elegível', TRUE, TRUE, 'Fatura de Ativo + Laudo de CIAP/Apropriação'),
('1202', 'Devolução de venda de mercadoria adquirida', 'Devolução', 'Depende', TRUE, TRUE, 'NF-e de Devolução Espelho com Chave da Origem'),
('1352', 'Aquisição de serviço de transporte por industrial', 'Compra', 'Elegível', TRUE, TRUE, 'CT-e Vinculado à Nota Fiscal de Mercadoria'),
('1910', 'Entrada de bonificação, doação ou brinde', 'Remessa', 'Não elegível', TRUE, TRUE, 'Nota Fiscal de Bonificação (Crédito Vedado)'),
('1915', 'Entrada de mercadoria em conserto ou reparo', 'Remessa', 'Não elegível', TRUE, FALSE, 'Ordem de Serviço / Remessa para Conserto')
ON CONFLICT DO NOTHING;
