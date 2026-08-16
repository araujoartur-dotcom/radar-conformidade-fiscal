-- ============================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES FOR SUPABASE / POSTGRESQL
-- ============================================================
-- Radar de Conformidade Fiscal & Inteligência Tributária
-- Garante o isolamento estrito de dados entre empresas (Tenants)
-- a nível de banco de dados (Kernel do PostgreSQL).
-- ============================================================

-- 1. HABILITAR ROW LEVEL SECURITY EM TODAS AS TABELAS MULTI-TENANT
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_transmitidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- 2. FUNÇÃO HELPER PARA EXTRAIR O EMPRESA_ID OU USUARIO_ID DO JWT
CREATE OR REPLACE FUNCTION auth.current_tenant_empresa_id() 
RETURNS TEXT AS $$
  SELECT coalesce(
    current_setting('request.jwt.claim.empresa_ativa_id', true),
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'empresa_ativa_id'),
    ''
  );
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION auth.current_user_id() 
RETURNS TEXT AS $$
  SELECT coalesce(
    current_setting('request.jwt.claim.sub', true),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'sub'),
    ''
  );
$$ LANGUAGE SQL STABLE;

-- 3. POLÍTICAS PARA A TABELA DE EMPRESAS (TENANTS)
-- Usuários só podem visualizar ou alterar empresas às quais têm vínculo explícito na tabela usuario_empresa
DROP POLICY IF EXISTS empresas_tenant_isolation ON empresas;
CREATE POLICY empresas_tenant_isolation ON empresas
  FOR ALL
  USING (
    id IN (
      SELECT empresa_id FROM usuario_empresa WHERE usuario_id = auth.current_user_id()
    )
    OR auth.current_tenant_empresa_id() = id
  );

-- 4. POLÍTICAS PARA A TABELA DE CERTIFICADOS DIGITAIS A1
-- Blindagem máxima: certificados só são acessíveis pelo tenant vinculado
DROP POLICY IF EXISTS certificados_tenant_isolation ON certificados;
CREATE POLICY certificados_tenant_isolation ON certificados
  FOR ALL
  USING (
    empresa_id IN (
      SELECT empresa_id FROM usuario_empresa WHERE usuario_id = auth.current_user_id()
    )
    OR auth.current_tenant_empresa_id() = empresa_id
  );

-- 5. POLÍTICAS PARA A TABELA DE EVENTOS TRANSMITIDOS
DROP POLICY IF EXISTS eventos_tenant_isolation ON eventos_transmitidos;
CREATE POLICY eventos_tenant_isolation ON eventos_transmitidos
  FOR ALL
  USING (
    empresa_id IN (
      SELECT empresa_id FROM usuario_empresa WHERE usuario_id = auth.current_user_id()
    )
    OR auth.current_tenant_empresa_id() = empresa_id
  );

-- 6. POLÍTICAS PARA A TABELA DE DOCUMENTOS FISCAIS (DF-e)
DROP POLICY IF EXISTS documentos_tenant_isolation ON documentos_fiscais;
CREATE POLICY documentos_tenant_isolation ON documentos_fiscais
  FOR ALL
  USING (
    empresa_id IN (
      SELECT empresa_id FROM usuario_empresa WHERE usuario_id = auth.current_user_id()
    )
    OR auth.current_tenant_empresa_id() = empresa_id
  );

-- 7. POLÍTICAS PARA A TABELA DE AUDIT LOG
-- Audit logs do tenant: leitura permitida para gestores/auditores; inserção permitida para qualquer ação do tenant
DROP POLICY IF EXISTS audit_log_tenant_isolation ON audit_log;
CREATE POLICY audit_log_tenant_isolation ON audit_log
  FOR SELECT
  USING (
    empresa_id IN (
      SELECT empresa_id FROM usuario_empresa WHERE usuario_id = auth.current_user_id()
    )
    OR auth.current_tenant_empresa_id() = empresa_id
  );

CREATE POLICY audit_log_insert_policy ON audit_log
  FOR INSERT
  WITH CHECK (true);
