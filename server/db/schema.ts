/**
 * ============================================================
 * SCHEMA DO BANCO DE DADOS
 * ============================================================
 * Criação de todas as tabelas necessárias para:
 * - C1: Credenciais seguras (cofre de certificados)
 * - C3: Sessão por empresa (usuarios, empresas, sessões)
 * - C4: Tabelas tributárias (alíquotas, CFOP, cClassTrib, regras)
 * ============================================================
 */

import { getDatabase } from './database';

export function initializeSchema(): void {
  const db = getDatabase();

  db.exec(`
    -- =========================================================
    -- EMPRESAS / TENANTS (Multi-Tenant por CNPJ Raiz)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS empresas (
      id                    TEXT PRIMARY KEY,
      cnpj_raiz             TEXT NOT NULL,               -- 8 primeiros dígitos (agrupador de matriz/filiais)
      cnpj_completo         TEXT NOT NULL UNIQUE,        -- XX.XXX.XXX/XXXX-XX (único por filial/matriz)
      razao_social          TEXT NOT NULL,
      nome_fantasia         TEXT DEFAULT '',
      uf                    TEXT NOT NULL DEFAULT 'SP',
      regime_tributario      TEXT NOT NULL DEFAULT 'Lucro Real',
      manifestar_ciencia_automatica INTEGER NOT NULL DEFAULT 1, -- 1=Sim, 0=Não
      ultimo_nsu            TEXT NOT NULL DEFAULT '000000000000000',
      max_nsu               TEXT NOT NULL DEFAULT '000000000000000',
      status                TEXT NOT NULL DEFAULT 'ativo', -- ativo | suspenso | inativo
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =========================================================
    -- USUÁRIOS (Controle de Sessão por Empresa)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS usuarios (
      id                    TEXT PRIMARY KEY,
      nome                  TEXT NOT NULL,
      email                 TEXT NOT NULL UNIQUE,
      senha_hash            TEXT NOT NULL,               -- bcrypt hash
      perfil                TEXT NOT NULL DEFAULT 'analista_fiscal',
                            -- admin_master | contador_gestor | analista_fiscal | auditor_externo | operador_leitura
      mfa_habilitado        INTEGER NOT NULL DEFAULT 0,
      mfa_segredo           TEXT DEFAULT NULL,            -- TOTP secret (criptografado)
      mfa_metodo            TEXT DEFAULT 'authenticator_app',
      status                TEXT NOT NULL DEFAULT 'ativo', -- ativo | bloqueado | pendente_mfa
      ultimo_acesso         TEXT DEFAULT NULL,
      ip_ultimo_acesso      TEXT DEFAULT NULL,
      tentativas_falhas     INTEGER NOT NULL DEFAULT 0,
      bloqueado_ate         TEXT DEFAULT NULL,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =========================================================
    -- VÍNCULO USUÁRIO ↔ EMPRESA (Permissão Granular)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS usuario_empresa (
      id                    TEXT PRIMARY KEY,
      usuario_id            TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      empresa_id            TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      permissao             TEXT NOT NULL DEFAULT 'leitura', -- total | escrita | leitura
      modulos_permitidos    TEXT DEFAULT '*',              -- JSON array: ["consulta","eventos","relatorios"] ou "*"
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(usuario_id, empresa_id)
    );

    -- =========================================================
    -- SESSÕES ATIVAS (JWT Refresh Tokens)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS sessoes (
      id                    TEXT PRIMARY KEY,
      usuario_id            TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      empresa_ativa_id      TEXT REFERENCES empresas(id),
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
      arquivo_path_enc      TEXT NOT NULL,                 -- caminho do arquivo criptografado no disco
      senha_enc             TEXT NOT NULL,                 -- senha do PFX criptografada com AES-256-GCM
      iv                    TEXT NOT NULL,                 -- initialization vector
      auth_tag              TEXT NOT NULL,                 -- tag de autenticação GCM
      impressao_digital     TEXT DEFAULT '',               -- fingerprint SHA256
      emissor               TEXT DEFAULT '',
      validade              TEXT NOT NULL,                 -- YYYY-MM-DD
      dias_para_vencimento  INTEGER DEFAULT 0,
      status_alerta         TEXT DEFAULT 'ok',             -- ok | alerta_30_dias | alerta_15_dias | expirado
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
    -- ALÍQUOTAS DE REFERÊNCIA CBS / IBS (por Competência)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS aliquotas_referencia (
      id                    TEXT PRIMARY KEY,
      competencia_inicio    TEXT NOT NULL,                 -- YYYY-MM-DD (vigência inicial)
      competencia_fim       TEXT DEFAULT NULL,             -- YYYY-MM-DD (vigência final, NULL = vigente)
      tipo_tributo          TEXT NOT NULL,                 -- CBS | IBS | IS
      aliquota_referencia   REAL NOT NULL,                 -- ex: 8.8 para CBS
      aliquota_reducao_60   REAL DEFAULT NULL,             -- 60% de redução (cesta básica)
      aliquota_reducao_30   REAL DEFAULT NULL,             -- 30% de redução
      descricao             TEXT DEFAULT '',
      base_legal            TEXT DEFAULT '',                -- ex: LC 214/2025, Art. XYZ
      fase_transicao        TEXT DEFAULT '',                -- teste_2026 | transicao_2027_2028 | definitiva
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
      codigo_cadastro       TEXT NOT NULL,                 -- ex: "00001", "00002"
      modalidade            TEXT NOT NULL DEFAULT 'ad_valorem', -- ad_valorem | ad_rem
      cbs_federal           REAL NOT NULL DEFAULT 0.0,
      ibs_estadual          REAL NOT NULL DEFAULT 0.0,
      ibs_municipal         REAL NOT NULL DEFAULT 0.0,
      is_federal            REAL NOT NULL DEFAULT 0.0,
      unidade_medida        TEXT DEFAULT NULL,             -- kg | L | m3 | unid (para ad_rem)
      inicio_vigencia       TEXT NOT NULL,                 -- YYYY-MM-DD
      final_vigencia        TEXT NOT NULL,                 -- YYYY-MM-DD
      descricao             TEXT DEFAULT '',
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(codigo_cadastro, modalidade)
    );

    -- =========================================================
    -- REGRAS DE ANEXOS / NCM / NBS / cClassTrib (Reduções e Isenções)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS ncm_regras_anexos (
      id                    TEXT PRIMARY KEY,
      ncm                   TEXT NOT NULL,                 -- ex: "2711.19.10" ou "27111910"
      nbs                   TEXT DEFAULT '',
      cclasstrib            TEXT DEFAULT '',
      descricao             TEXT NOT NULL,
      tipo_tratamento       TEXT NOT NULL DEFAULT 'padrao', 
                            -- padrao | cesta_basica_zero | reducao_60 | reducao_30 | ad_rem | isento | monofasico
      percentual_reducao    REAL NOT NULL DEFAULT 0.0,     -- ex: 100, 60, 30, 0
      anexo_lei             TEXT DEFAULT '',               -- ex: "Anexo I", "Anexo VII", "Art. 132"
      base_legal            TEXT DEFAULT '',               -- ex: "LC 214/2025 Art. 45"
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
      empresa_id            TEXT DEFAULT NULL REFERENCES empresas(id), -- NULL = regra global
      cfop                  TEXT NOT NULL,
      descricao             TEXT NOT NULL,
      categoria             TEXT NOT NULL DEFAULT 'Compra', -- Compra | Devolução | Transferência | Remessa | Outros
      tratamento_padrao     TEXT NOT NULL DEFAULT 'Depende', -- Elegível | Não elegível | Depende
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
      empresa_id            TEXT DEFAULT NULL REFERENCES empresas(id), -- NULL = regra global
      cclasstrib            TEXT NOT NULL,
      descricao_interna     TEXT NOT NULL,
      tratamento_esperado   TEXT NOT NULL DEFAULT 'tributado',
                            -- tributado | aliquota_reduzida | isento | nao_incidencia | monofasico
      permite_credito       TEXT NOT NULL DEFAULT 'Sim',   -- Sim | Não | Parcial | Depende
      aliquota_esperada     TEXT DEFAULT '',                -- ex: "26.5% (8.8% CBS + 17.7% IBS)"
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
      empresa_id            TEXT DEFAULT NULL REFERENCES empresas(id), -- NULL = regra global
      codigo_regra          TEXT NOT NULL UNIQUE,           -- ex: ELEG_001, ELEG_012
      nome                  TEXT NOT NULL,
      descricao             TEXT NOT NULL,
      tipo_aquisicao        TEXT DEFAULT '',                -- revenda | insumo | imobilizado | servico | frete | importacao
      cfops_aplicaveis      TEXT DEFAULT '',                -- JSON array: ["1102","2102","1551"]
      cclasstrib_aplicaveis TEXT DEFAULT '',                -- JSON array: ["000001","100001"]
      resultado_padrao      TEXT NOT NULL DEFAULT 'Pendente',
                            -- Elegível | Parcial | Não elegível | Pendente
      exige_onerosidade     INTEGER NOT NULL DEFAULT 1,
      exige_evidencia_cobranca INTEGER NOT NULL DEFAULT 1,
      evidencia_minima      TEXT DEFAULT '',
      base_legal            TEXT DEFAULT '',
      ativo                 INTEGER NOT NULL DEFAULT 1,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =========================================================
    -- LOG DE AUDITORIA (Trilha imutável de ações)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS audit_log (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp             TEXT NOT NULL DEFAULT (datetime('now')),
      nivel                 TEXT NOT NULL DEFAULT 'INFO',   -- INFO | WARN | ERROR | FATAL
      servico               TEXT NOT NULL DEFAULT 'API',
      correlation_id        TEXT DEFAULT '',
      empresa_id            TEXT DEFAULT '',
      usuario_id            TEXT DEFAULT '',
      usuario_email         TEXT DEFAULT '',
      acao                  TEXT NOT NULL,
      descricao             TEXT NOT NULL,
      ip_address            TEXT DEFAULT '',
      dados_extras          TEXT DEFAULT ''                  -- JSON com detalhes adicionais
    );

    -- =========================================================
    -- EVENTOS FISCAIS TRANSMITIDOS (Histórico Real)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS eventos_transmitidos (
      id                    TEXT PRIMARY KEY,
      empresa_id            TEXT NOT NULL REFERENCES empresas(id),
      usuario_id            TEXT NOT NULL REFERENCES usuarios(id),
      chave_acesso          TEXT NOT NULL,
      tipo_dfe              TEXT NOT NULL,                   -- NFe | NFCe | CTe | NFSe
      codigo_evento         TEXT NOT NULL,
      nome_evento           TEXT NOT NULL,
      categoria             TEXT NOT NULL,
      justificativa         TEXT DEFAULT '',
      ambiente              TEXT NOT NULL DEFAULT '2',       -- 1 = Produção, 2 = Homologação
      protocolo_sefaz       TEXT DEFAULT '',
      xml_envio             TEXT DEFAULT '',                  -- XML SOAP completo enviado
      xml_retorno           TEXT DEFAULT '',                  -- XML SOAP de retorno da SEFAZ
      codigo_retorno        TEXT DEFAULT '',                  -- cStat (ex: 135 = autorizado)
      motivo_retorno        TEXT DEFAULT '',                  -- xMotivo
      status                TEXT NOT NULL DEFAULT 'pendente', -- pendente | processado | rejeitado | erro
      detalhes_reforma      TEXT DEFAULT '',                  -- JSON com ajustes CBS/IBS
      data_hora             TEXT NOT NULL DEFAULT (datetime('now')),
      created_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =========================================================
    -- DOCUMENTOS E ITENS (XMLs)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS dfe_documentos (
      id                    TEXT PRIMARY KEY,
      empresa_id            TEXT NOT NULL REFERENCES empresas(id),
      tipo_doc              TEXT NOT NULL, -- NFe | CTe | NFSe
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
      situacao_doc          TEXT,
      valor_total           REAL,
      created_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

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
      quantidade            REAL,
      unidade               TEXT,
      valor_bruto_item      REAL,
      desconto_incondicional REAL,
      frete_seguro_rateado  REAL,
      valor_liquido_item    REAL,
      base_ibs              REAL,
      aliquota_ibs          REAL,
      valor_ibs             REAL,
      base_cbs              REAL,
      aliquota_cbs          REAL,
      valor_cbs             REAL,
      created_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =========================================================
    -- ÍNDICES PARA PERFORMANCE
    -- =========================================================
    CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
    CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_sessoes_refresh ON sessoes(refresh_token_hash);
    CREATE INDEX IF NOT EXISTS idx_usuario_empresa_usuario ON usuario_empresa(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_usuario_empresa_empresa ON usuario_empresa(empresa_id);
    CREATE INDEX IF NOT EXISTS idx_certificados_empresa ON certificados(empresa_id);
    CREATE INDEX IF NOT EXISTS idx_aliquotas_competencia ON aliquotas_referencia(competencia_inicio, tipo_tributo);
    CREATE INDEX IF NOT EXISTS idx_cfop_empresa ON cfop_tratamento(empresa_id, cfop);
    CREATE INDEX IF NOT EXISTS idx_cclasstrib_empresa ON cclasstrib_regras(empresa_id, cclasstrib);
    CREATE INDEX IF NOT EXISTS idx_regras_codigo ON regras_elegibilidade(codigo_regra);
    CREATE INDEX IF NOT EXISTS idx_eventos_empresa ON eventos_transmitidos(empresa_id, data_hora);
    CREATE INDEX IF NOT EXISTS idx_eventos_chave ON eventos_transmitidos(chave_acesso);
    CREATE INDEX IF NOT EXISTS idx_audit_log_empresa ON audit_log(empresa_id, timestamp);
  `);

  // Safe migrations for newly added columns on existing SQLite databases
  try {
    db.exec(`
      ALTER TABLE empresas ADD COLUMN manifestar_ciencia_automatica INTEGER NOT NULL DEFAULT 1;
    `);
  } catch {}
  try {
    db.exec(`
      ALTER TABLE empresas ADD COLUMN ultimo_nsu TEXT NOT NULL DEFAULT '000000000000000';
    `);
  } catch {}
  try {
    db.exec(`
      ALTER TABLE empresas ADD COLUMN max_nsu TEXT NOT NULL DEFAULT '000000000000000';
    `);
  } catch {}

  console.log('✅ Schema do banco de dados inicializado com sucesso.');
}
