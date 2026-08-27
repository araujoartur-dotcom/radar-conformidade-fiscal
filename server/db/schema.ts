/**
 * ============================================================
 * SCHEMA DO BANCO DE DADOS — RADAR DE CONFORMIDADE FISCAL
 * ============================================================
 * Criação e migração segura de todas as tabelas:
 * - Multi-Tenant por CNPJ (empresas, usuario_empresa, usuarios, sessoes)
 * - Cofre de Certificados A1 (certificados)
 * - Documentos Fiscais Eletrônicos & Itens (dfe_documentos, dfe_itens)
 * - Histórico de Eventos Emitidos e Recebidos (eventos_transmitidos / dfe_eventos)
 * - Tabelas Tributárias RTC (alíquotas CBS/IBS, CFOP, cClassTrib, NCMs)
 * - Trilha de Auditoria Imutável (audit_log)
 * ============================================================
 */

import { getDatabase } from './database';
import { getBrasiliaTimestamp } from '../utils/timezone';

export function initializeSchema(): void {
  const db = getDatabase();

  // 1. Criação das tabelas base (IF NOT EXISTS)
  db.exec(`
    -- =========================================================
    -- EMPRESAS / TENANTS (Multi-Tenant por CNPJ Raiz)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS empresas (
      id                            TEXT PRIMARY KEY,
      cnpj_raiz                     TEXT NOT NULL,               -- 8 primeiros dígitos
      cnpj_completo                 TEXT NOT NULL UNIQUE,        -- XX.XXX.XXX/XXXX-XX
      razao_social                  TEXT NOT NULL,
      nome_fantasia                 TEXT DEFAULT '',
      uf                            TEXT NOT NULL DEFAULT 'SP',
      regime_tributario             TEXT NOT NULL DEFAULT 'Lucro Real',
      manifestar_ciencia_automatica INTEGER NOT NULL DEFAULT 1, -- 1=Sim, 0=Não
      ultimo_nsu                    TEXT NOT NULL DEFAULT '000000000000000',
      max_nsu                       TEXT NOT NULL DEFAULT '000000000000000',
      status                        TEXT NOT NULL DEFAULT 'ativo', -- ativo | suspenso | inativo
      created_at                    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at                    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =========================================================
    -- USUÁRIOS (Controle de Acesso RBAC)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS usuarios (
      id                    TEXT PRIMARY KEY,
      nome                  TEXT NOT NULL,
      email                 TEXT NOT NULL UNIQUE,
      senha_hash            TEXT NOT NULL,               -- bcrypt hash
      perfil                TEXT NOT NULL DEFAULT 'analista_fiscal',
                            -- admin_master | contador_gestor | analista_fiscal | auditor_externo | operador_leitura
      mfa_habilitado        INTEGER NOT NULL DEFAULT 0,
      mfa_segredo           TEXT DEFAULT NULL,            -- TOTP secret
      mfa_metodo            TEXT DEFAULT 'authenticator_app',
      status                TEXT NOT NULL DEFAULT 'ativo', -- ativo | bloqueado | pendente_mfa
      empresa_ativa_id      TEXT DEFAULT NULL,
      ultimo_acesso         TEXT DEFAULT NULL,
      ip_ultimo_acesso      TEXT DEFAULT NULL,
      tentativas_falhas     INTEGER NOT NULL DEFAULT 0,
      bloqueado_ate         TEXT DEFAULT NULL,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =========================================================
    -- VÍNCULO USUÁRIO ↔ EMPRESA (Isolamento Multi-Tenant)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS usuario_empresa (
      id                    TEXT PRIMARY KEY,
      usuario_id            TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      empresa_id            TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      permissao             TEXT NOT NULL DEFAULT 'leitura', -- total | escrita | leitura
      modulos_permitidos    TEXT DEFAULT '*',              -- JSON array ou "*"
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(usuario_id, empresa_id)
    );

    -- =========================================================
    -- SESSÕES ATIVAS (JWT Refresh Tokens)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS sessoes (
      id                    TEXT PRIMARY KEY,
      usuario_id            TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      empresa_ativa_id      TEXT REFERENCES empresas(id) ON DELETE SET NULL,
      refresh_token_hash    TEXT NOT NULL,
      ip_address            TEXT DEFAULT '',
      user_agent            TEXT DEFAULT '',
      expires_at            TEXT NOT NULL,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      revogada              INTEGER NOT NULL DEFAULT 0
    );

    -- =========================================================
    -- COFRE DE CERTIFICADOS DIGITAIS A1 (Criptografados)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS certificados (
      id                    TEXT PRIMARY KEY,
      empresa_id            TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      cnpj                  TEXT NOT NULL,
      razao_social          TEXT NOT NULL,
      tipo                  TEXT NOT NULL DEFAULT 'A1_PKCS12',
      arquivo_nome          TEXT NOT NULL,                 -- nome original do .pfx
      arquivo_path_enc      TEXT NOT NULL,                 -- base64 ou path criptografado
      senha_enc             TEXT NOT NULL,                 -- senha AES-256-GCM
      iv                    TEXT NOT NULL,
      auth_tag              TEXT NOT NULL,
      impressao_digital     TEXT DEFAULT '',
      emissor               TEXT DEFAULT '',
      validade              TEXT NOT NULL,                 -- YYYY-MM-DD
      dias_para_vencimento  INTEGER DEFAULT 0,
      status_alerta         TEXT DEFAULT 'ok',             -- ok | alerta_30_dias | alerta_15_dias | expirado | substituido
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =========================================================
    -- CONFIGURAÇÃO DE DIRETÓRIOS POR CNPJ RAIZ
    -- =========================================================
    CREATE TABLE IF NOT EXISTS diretorios_config (
      id                    TEXT PRIMARY KEY,
      cnpj_raiz             TEXT NOT NULL UNIQUE,
      razao_social          TEXT NOT NULL,
      diretorio_entrada     TEXT NOT NULL,
      subpasta_data_entrada INTEGER NOT NULL DEFAULT 1,
      estrutura_nome_entrada TEXT NOT NULL DEFAULT 'chave',
      diretorio_saida       TEXT NOT NULL,
      subpasta_data_saida   INTEGER NOT NULL DEFAULT 1,
      estrutura_nome_saida  TEXT NOT NULL DEFAULT 'chave',
      diretorio_eventos     TEXT NOT NULL,
      auto_organizar        INTEGER NOT NULL DEFAULT 1,
      status_monitoramento  TEXT NOT NULL DEFAULT 'ativo',
      ultima_sincronizacao  TEXT DEFAULT 'Pendente',
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =========================================================
    -- DOCUMENTOS FISCAIS ELETRÔNICOS (DF-e)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS dfe_documentos (
      id                    TEXT PRIMARY KEY,
      empresa_id            TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      tipo_doc              TEXT NOT NULL,
      chave_acesso          TEXT NOT NULL UNIQUE,
      tipo_operacao         TEXT DEFAULT 'Entrada',
      numero_serie          TEXT,
      data_emissao          TEXT,
      data_entrada          TEXT,
      competencia           TEXT,
      fornecedor_cnpj       TEXT,
      fornecedor_razao      TEXT,
      fornecedor_uf         TEXT,
      fornecedor_municipio  TEXT,
      cliente_cnpj          TEXT,
      cliente_razao         TEXT,
      cliente_uf            TEXT,
      situacao_doc          TEXT DEFAULT 'autorizado',
      valor_total           REAL DEFAULT 0,
      created_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =========================================================
    -- ITENS DOS DOCUMENTOS FISCAIS
    -- =========================================================
    CREATE TABLE IF NOT EXISTS dfe_itens (
      id                    TEXT PRIMARY KEY,
      documento_id          TEXT NOT NULL REFERENCES dfe_documentos(id) ON DELETE CASCADE,
      item_nro              INTEGER,
      descricao_item        TEXT,
      ncm                   TEXT,
      cfop                  TEXT,
      cclasstrib            TEXT,
      cst_csosn             TEXT,
      natureza_operacao     TEXT,
      quantidade            REAL DEFAULT 1,
      unidade               TEXT DEFAULT 'UN',
      valor_bruto_item      REAL DEFAULT 0,
      desconto_incondicional REAL DEFAULT 0,
      frete_seguro_rateado  REAL DEFAULT 0,
      valor_liquido_item    REAL DEFAULT 0,
      base_ibs              REAL DEFAULT 0,
      aliquota_ibs          REAL DEFAULT 0,
      valor_ibs             REAL DEFAULT 0,
      base_cbs              REAL DEFAULT 0,
      aliquota_cbs          REAL DEFAULT 0,
      valor_cbs             REAL DEFAULT 0,
      created_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =========================================================
    -- EVENTOS FISCAIS TRANSMITIDOS E RECEBIDOS
    -- =========================================================
    CREATE TABLE IF NOT EXISTS eventos_transmitidos (
      id                    TEXT PRIMARY KEY,
      empresa_id            TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      usuario_id            TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      chave_acesso          TEXT NOT NULL,
      tipo_dfe              TEXT NOT NULL,
      codigo_evento         TEXT NOT NULL,
      nome_evento           TEXT NOT NULL,
      categoria             TEXT NOT NULL,
      justificativa         TEXT DEFAULT '',
      ambiente              TEXT NOT NULL DEFAULT '2',
      protocolo_sefaz       TEXT DEFAULT '',
      xml_envio             TEXT DEFAULT '',
      xml_retorno           TEXT DEFAULT '',
      codigo_retorno        TEXT DEFAULT '',
      motivo_retorno        TEXT DEFAULT '',
      status                TEXT NOT NULL DEFAULT 'pendente',
      detalhes_reforma      TEXT DEFAULT '',
      data_hora             TEXT NOT NULL DEFAULT (datetime('now')),
      created_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =========================================================
    -- ALÍQUOTAS DE REFERÊNCIA CBS / IBS
    -- =========================================================
    CREATE TABLE IF NOT EXISTS aliquotas_referencia (
      id                    TEXT PRIMARY KEY,
      competencia_inicio    TEXT NOT NULL,
      competencia_fim       TEXT DEFAULT NULL,
      tipo_tributo          TEXT NOT NULL,
      aliquota_referencia   REAL NOT NULL,
      aliquota_reducao_60   REAL DEFAULT NULL,
      aliquota_reducao_30   REAL DEFAULT NULL,
      descricao             TEXT DEFAULT '',
      base_legal            TEXT DEFAULT '',
      fase_transicao        TEXT DEFAULT '',
      observacoes           TEXT DEFAULT '',
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(competencia_inicio, tipo_tributo)
    );

    -- =========================================================
    -- TABELAS DE ALÍQUOTAS (AD VALOREM % E AD REM R$)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS aliquotas_tabelas (
      id                    TEXT PRIMARY KEY,
      codigo_cadastro       TEXT NOT NULL,
      modalidade            TEXT NOT NULL DEFAULT 'ad_valorem',
      cbs_federal           REAL NOT NULL DEFAULT 0.0,
      ibs_estadual          REAL NOT NULL DEFAULT 0.0,
      ibs_municipal         REAL NOT NULL DEFAULT 0.0,
      is_federal            REAL NOT NULL DEFAULT 0.0,
      unidade_medida        TEXT DEFAULT NULL,
      inicio_vigencia       TEXT NOT NULL,
      final_vigencia        TEXT NOT NULL,
      descricao             TEXT DEFAULT '',
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(codigo_cadastro, modalidade)
    );

    -- =========================================================
    -- REGRAS DE ANEXOS / NCM / NBS / cClassTrib
    -- =========================================================
    CREATE TABLE IF NOT EXISTS ncm_regras_anexos (
      id                    TEXT PRIMARY KEY,
      ncm                   TEXT NOT NULL,
      nbs                   TEXT DEFAULT '',
      cclasstrib            TEXT DEFAULT '',
      descricao             TEXT NOT NULL,
      tipo_tratamento       TEXT NOT NULL DEFAULT 'padrao',
      percentual_reducao    REAL NOT NULL DEFAULT 0.0,
      anexo_lei             TEXT DEFAULT '',
      base_legal            TEXT DEFAULT '',
      vigencia_inicio       TEXT NOT NULL DEFAULT '2026-01-01',
      vigencia_fim          TEXT NOT NULL DEFAULT '2033-12-31',
      ativo                 INTEGER NOT NULL DEFAULT 1,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =========================================================
    -- MAPA CFOP x TRATAMENTO DE CRÉDITO
    -- =========================================================
    CREATE TABLE IF NOT EXISTS cfop_tratamento (
      id                    TEXT PRIMARY KEY,
      empresa_id            TEXT DEFAULT NULL REFERENCES empresas(id),
      cfop                  TEXT NOT NULL,
      descricao             TEXT NOT NULL,
      categoria             TEXT NOT NULL DEFAULT 'Compra',
      tratamento_padrao     TEXT NOT NULL DEFAULT 'Depende',
      exige_onerosidade     INTEGER NOT NULL DEFAULT 1,
      exige_validacao_cclasstrib INTEGER NOT NULL DEFAULT 1,
      evidencia_minima      TEXT DEFAULT '',
      ativo                 INTEGER NOT NULL DEFAULT 1,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =========================================================
    -- MAPA cClassTrib x ALÍQUOTA / BASE / REGRA
    -- =========================================================
    CREATE TABLE IF NOT EXISTS cclasstrib_regras (
      id                    TEXT PRIMARY KEY,
      empresa_id            TEXT DEFAULT NULL REFERENCES empresas(id),
      cclasstrib            TEXT NOT NULL,
      descricao_interna     TEXT NOT NULL,
      tratamento_esperado   TEXT NOT NULL DEFAULT 'tributado',
      permite_credito       TEXT NOT NULL DEFAULT 'Sim',
      aliquota_esperada     TEXT DEFAULT '',
      alertas               TEXT DEFAULT '',
      ativo                 INTEGER NOT NULL DEFAULT 1,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =========================================================
    -- REGRAS DE ELEGIBILIDADE DE CRÉDITO
    -- =========================================================
    CREATE TABLE IF NOT EXISTS regras_elegibilidade (
      id                    TEXT PRIMARY KEY,
      empresa_id            TEXT DEFAULT NULL REFERENCES empresas(id),
      codigo_regra          TEXT NOT NULL UNIQUE,
      nome                  TEXT NOT NULL,
      descricao             TEXT NOT NULL,
      tipo_aquisicao        TEXT DEFAULT '',
      cfops_aplicaveis      TEXT DEFAULT '',
      cclasstrib_aplicaveis TEXT DEFAULT '',
      resultado_padrao      TEXT NOT NULL DEFAULT 'Pendente',
      exige_onerosidade     INTEGER NOT NULL DEFAULT 1,
      exige_evidencia_cobranca INTEGER NOT NULL DEFAULT 1,
      evidencia_minima      TEXT DEFAULT '',
      base_legal            TEXT DEFAULT '',
      ativo                 INTEGER NOT NULL DEFAULT 1,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =========================================================
    -- LOG DE AUDITORIA
    -- =========================================================
    CREATE TABLE IF NOT EXISTS audit_log (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp             TEXT NOT NULL DEFAULT (datetime('now')),
      nivel                 TEXT NOT NULL DEFAULT 'INFO',
      servico               TEXT NOT NULL DEFAULT 'API',
      correlation_id        TEXT DEFAULT '',
      empresa_id            TEXT DEFAULT '',
      usuario_id            TEXT DEFAULT '',
      usuario_email         TEXT DEFAULT '',
      acao                  TEXT NOT NULL,
      descricao             TEXT NOT NULL,
      ip_address            TEXT DEFAULT '',
      dados_extras          TEXT DEFAULT ''
    );
  `);

  // 2. Migração dinâmica segura: adicionar colunas ausentes
  const addColumnIfNotExists = (table: string, column: string, definition: string) => {
    try {
      const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
      const exists = tableInfo.some(col => col.name.toLowerCase() === column.toLowerCase());
      if (!exists) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
        console.log(`⚡ Migração: Coluna [${column}] adicionada na tabela [${table}].`);
      }
    } catch (err: any) {
      console.warn(`Aviso na migração de ${table}.${column}:`, err.message);
    }
  };

  // Migrações em empresas
  addColumnIfNotExists('empresas', 'manifestar_ciencia_automatica', 'INTEGER NOT NULL DEFAULT 1');
  addColumnIfNotExists('empresas', 'ultimo_nsu', 'TEXT NOT NULL DEFAULT "000000000000000"');
  addColumnIfNotExists('empresas', 'max_nsu', 'TEXT NOT NULL DEFAULT "000000000000000"');

  // Migrações em usuarios
  addColumnIfNotExists('usuarios', 'empresa_ativa_id', 'TEXT DEFAULT NULL');

  // Migrações em dfe_documentos
  addColumnIfNotExists('dfe_documentos', 'fornecedor_ie', 'TEXT DEFAULT ""');
  addColumnIfNotExists('dfe_documentos', 'cliente_ie', 'TEXT DEFAULT ""');
  addColumnIfNotExists('dfe_documentos', 'situacao_manifestacao', 'TEXT DEFAULT "sem_manifestacao"');
  addColumnIfNotExists('dfe_documentos', 'evento_ultimo', 'TEXT DEFAULT "Autorizado o uso do DF-e"');
  addColumnIfNotExists('dfe_documentos', 'valor_icms', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_documentos', 'valor_ipi', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_documentos', 'valor_pis', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_documentos', 'valor_cofins', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_documentos', 'valor_cbs', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_documentos', 'valor_ibs', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_documentos', 'valor_is', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_documentos', 'valor_irrf', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_documentos', 'valor_inss', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_documentos', 'valor_iss', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_documentos', 'valor_csll', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_documentos', 'xml_raw', 'TEXT DEFAULT ""');
  addColumnIfNotExists('dfe_documentos', 'status_sefaz', 'TEXT DEFAULT "autorizado"');
  addColumnIfNotExists('dfe_documentos', 'protocolo_sefaz', 'TEXT DEFAULT ""');
  addColumnIfNotExists('dfe_documentos', 'alerta_fraude', 'INTEGER DEFAULT 0');
  addColumnIfNotExists('dfe_documentos', 'download_at', 'TEXT DEFAULT NULL');
  addColumnIfNotExists('dfe_documentos', 'updated_at', 'TEXT DEFAULT NULL');

  // Migrações em dfe_itens
  addColumnIfNotExists('dfe_itens', 'codigo_item', 'TEXT DEFAULT ""');
  addColumnIfNotExists('dfe_itens', 'cest', 'TEXT DEFAULT ""');
  addColumnIfNotExists('dfe_itens', 'valor_unitario', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_itens', 'base_icms', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_itens', 'aliquota_icms', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_itens', 'valor_icms', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_itens', 'base_ipi', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_itens', 'aliquota_ipi', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_itens', 'valor_ipi', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_itens', 'base_pis', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_itens', 'aliquota_pis', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_itens', 'valor_pis', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_itens', 'base_cofins', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_itens', 'aliquota_cofins', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_itens', 'valor_cofins', 'REAL DEFAULT 0');
  addColumnIfNotExists('dfe_itens', 'valor_is', 'REAL DEFAULT 0');

  // Migrações em eventos_transmitidos
  addColumnIfNotExists('eventos_transmitidos', 'documento_id', 'TEXT DEFAULT NULL');
  addColumnIfNotExists('eventos_transmitidos', 'autor_cnpj', 'TEXT DEFAULT ""');
  addColumnIfNotExists('eventos_transmitidos', 'origem_evento', 'TEXT NOT NULL DEFAULT "proprio"');

  // 3. Criar Índices de Performance e View de Compatibilidade (após todas as colunas existirem)
  db.exec(`
    DROP VIEW IF EXISTS dfe_eventos;
    CREATE VIEW dfe_eventos AS 
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
      FROM eventos_transmitidos;

    CREATE INDEX IF NOT EXISTS idx_empresas_cnpj_raiz ON empresas(cnpj_raiz);
    CREATE INDEX IF NOT EXISTS idx_empresas_cnpj_comp ON empresas(cnpj_completo);
    CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
    CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_sessoes_refresh ON sessoes(refresh_token_hash);
    CREATE INDEX IF NOT EXISTS idx_usuario_empresa_usuario ON usuario_empresa(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_usuario_empresa_empresa ON usuario_empresa(empresa_id);
    CREATE INDEX IF NOT EXISTS idx_certificados_empresa ON certificados(empresa_id);
    CREATE INDEX IF NOT EXISTS idx_dfe_docs_empresa_emissao ON dfe_documentos(empresa_id, data_emissao);
    CREATE INDEX IF NOT EXISTS idx_dfe_docs_chave ON dfe_documentos(chave_acesso);
    CREATE INDEX IF NOT EXISTS idx_dfe_docs_fornecedor ON dfe_documentos(fornecedor_cnpj);
    CREATE INDEX IF NOT EXISTS idx_dfe_docs_cliente ON dfe_documentos(cliente_cnpj);
    CREATE INDEX IF NOT EXISTS idx_dfe_docs_download ON dfe_documentos(download_at);
    CREATE INDEX IF NOT EXISTS idx_dfe_itens_documento ON dfe_itens(documento_id);
    CREATE INDEX IF NOT EXISTS idx_dfe_itens_cfop ON dfe_itens(cfop);
    CREATE INDEX IF NOT EXISTS idx_dfe_itens_cclasstrib ON dfe_itens(cclasstrib);
    CREATE INDEX IF NOT EXISTS idx_eventos_empresa_data ON eventos_transmitidos(empresa_id, data_hora);
    CREATE INDEX IF NOT EXISTS idx_eventos_chave_empresa ON eventos_transmitidos(chave_acesso, empresa_id);
    CREATE INDEX IF NOT EXISTS idx_eventos_doc_id ON eventos_transmitidos(documento_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_empresa ON audit_log(empresa_id, timestamp);
  `);

  console.log(`✅ Schema do banco de dados inicializado com sucesso em Horário Oficial de Brasília [${getBrasiliaTimestamp()}].`);
}
