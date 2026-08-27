# Plano de Implementação: Arquitetura Fiscal 360°, Monitor de Eventos de Terceiros, Ingestão de XMLs, Timezone Brasília, Fix Foreign Key e Multi-Tenancy

Implementação e consolidação arquitetural do **Radar de Conformidade Fiscal**, projetado para ser o sistema de monitoramento fiscal mais avançado e seguro do Brasil, com alta performance, integridade transacional rigorosa (ACID), captura bidirecional de documentos e eventos (incluindo **Desconhecimento da Operação emitido por clientes**), padronização no Horário Oficial de Brasília (**America/Sao_Paulo / UTC-03:00**), resolução definitiva do erro `FOREIGN KEY constraint failed` e isolamento multi-tenant estrito por CNPJ com RBAC.

---

## User Review Required

> [!IMPORTANT]
> **Monitoramento de Eventos de Terceiros (Desconhecimento / Operação não Realizada pelo Cliente):**
> Quando sua empresa emite uma NF-e e o cliente destinatário envia uma manifestação de *Desconhecimento da Operação (210220)* ou *Operação não Realizada (210240)* para a SEFAZ, o WebService `NFeDistribuicaoDFe` entrega esse evento no fluxo de NSU da empresa emitente sob os schemas `procEventoNFe_v1.00.xsd` ou `resEvento_v1.00.xsd`.
> O sistema passará a capturar, descompactar e indexar esses eventos de terceiros em tempo real, disparando alertas de risco fiscal crítico no dashboard e atualizando a situação da NF-e de Saída.

> [!WARNING]
> **Isolamento de Tenants e Integridade de Chaves Estrangeiras:**
> Usuários regulares só acessam dados do(s) seu(s) respectivo(s) CNPJ(s). Toda persistência de evento (emitido ou recebido de terceiro) garante atomicamente que o documento pai (`dfe_documentos`) e a empresa existam antes da gravação do histórico, eliminando permanentemente qualquer erro de `FOREIGN KEY constraint failed`.

---

## Proposed Changes

### 1. Monitor 360° de Eventos de Terceiros (Desconhecimento, Confirmação, CC-e, Cancelamento)

Capturar, interpretar e alertar eventos disparados por terceiros contra notas emitidas ou recebidas pela empresa ativa.

#### [MODIFY] [sefazService.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/services/sefazService.ts)
- Expandir a extração do `NFeDistribuicaoDFe` para processar e estruturar eventos retornados em `docZip`:
  - `procEventoNFe` e `resEvento`:
    - `210220` — Desconhecimento da Operação (Alerta Crítico)
    - `210240` — Operação não Realizada (Alerta Crítico com Justificativa do cliente)
    - `210200` — Confirmação da Operação
    - `210210` — Ciência da Emissão
    - `110110` — Carta de Correção Eletrônica (CC-e)
    - `110111` — Cancelamento Homologado
  - Vincular o evento automaticamente à NF-e correspondente em `dfe_documentos`.
  - Se for nota emitida pela empresa ativa (`fluxo = 'saida'`), atualizar a `situacao_doc` para `desconhecida_pelo_destinatario` ou `operacao_nao_realizada` e marcar `status_auditoria = 'inconsistente'`.

---

### 2. Padronização Temporal & Timezone (Horário Oficial de Brasília UTC-03:00)

#### [NEW] [timezone.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/utils/timezone.ts)
- Funções utilitárias no backend:
  - `getBrasiliaTimestamp(date?)`: string ISO 8601 com offset `-03:00` (ex: `2026-08-26T23:15:30-03:00`).
  - `getBrasiliaDate(date?)`: data `YYYY-MM-DD` no fuso de Brasília.
  - `formatSefazDh(date?)`: compatível com a tag `TDataHora` da SEFAZ (`YYYY-MM-DDThh:mm:ss-03:00`).
  - `formatBrasiliaDisplay(date?)`: formatação `DD/MM/YYYY HH:mm:ss`.

#### [NEW] [timezone.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/utils/timezone.ts)
- Utilitário frontend para formatação e badges em Horário de Brasília.

---

### 3. Schema do Banco de Dados & Migrações Seguras (SQLite & Supabase)

#### [MODIFY] [schema.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/db/schema.ts)
- Atualizar `dfe_documentos`:
  - Colunas: `valor_icms`, `valor_ipi`, `valor_pis`, `valor_cofins`, `valor_cbs`, `valor_ibs`, `valor_is`, `valor_irrf`, `valor_inss`, `valor_iss`, `valor_csll`, `xml_raw`, `status_sefaz`, `protocolo_sefaz`, `download_at`, `evento_ultimo`, `situacao_manifestacao`, `alerta_fraude`, `updated_at`.
- Atualizar `dfe_itens`:
  - Detalhamento de impostos e tributos: `valor_icms`, `valor_ipi`, `valor_pis`, `valor_cofins`, `aliquota_icms`, `aliquota_ipi`, `aliquota_pis`, `aliquota_cofins`, `cest`.
- Atualizar `eventos_transmitidos`:
  - Coluna `documento_id TEXT REFERENCES dfe_documentos(id) ON DELETE SET NULL`.
  - Coluna `autor_cnpj TEXT`: CNPJ do autor do evento (suporta eventos emitidos pela empresa ou por terceiros/clientes).
  - Coluna `origem_evento TEXT DEFAULT 'proprio'`: `proprio` | `terceiro_destinatario` | `sefaz`.
- Criar View de compatibilidade `dfe_eventos` apontando para `eventos_transmitidos`.
- Rotina de migração dinâmica segura no boot do servidor (`initializeSchema`) com `PRAGMA table_info`.
- Índices de performance para consultas ultra-rápidas por chave de acesso, CNPJ emitente/destinatário, data e status.

#### [MODIFY] [supabase_schema.sql](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/db/supabase_schema.sql)
- Sincronizar DDL do PostgreSQL/Supabase.

---

### 4. Pipeline de Ingestão e Parser XML Seguro (Anti-XXE & 100% dos Dados)

#### [NEW] [xmlParser.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/utils/xmlParser.ts)
- Parser completo no backend para NF-e, CT-e, NFS-e e eventos SEFAZ:
  - **Segurança Anti-XXE**: sanitização de payloads XML, remoção de DTDs e entidades externas.
  - Extração de 100% das tags obrigatórias e itens fiscais.
  - Carimbo de download e ingestão no Horário Oficial de Brasília.

#### [MODIFY] [upload.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/routes/upload.ts)
- Ingestão vinculada ao tenant da sessão ativa com integridade referencial.
- Persistência transacional (ACID) do documento + itens + payload bruto (`xml_raw`) no banco e no disco via `salvarXmlLocalmente`.
- Idempotência no upload e prevenção de duplicidade.
- Consulta de eventos e documentos estritamente isolada por tenant.

---

### 5. Resolução Definitiva do `FOREIGN KEY constraint failed` em Eventos

#### [MODIFY] [sefaz.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/routes/sefaz.ts)
- Resolução e auto-provisionamento de entidades antes da inserção:
  1. **Empresa/Tenant**: valida `empresa_id`, busca por CNPJ ou provisiona com integridade.
  2. **Usuário**: valida `usuario_id`, associa a usuário existente ou admin do sistema.
  3. **Documento de Referência (`dfe_documentos`)**: se o evento for disparado para uma chave sem XML prévio no banco (ex: Ciência da Emissão avulsa), cria atomicamente o registro do documento em `dfe_documentos` com status apropriado.
  4. **Transação Atômica ACID**: executa toda a cadeia de persistência dentro de `db.transaction()`.
  5. **Idempotência**: evita reenvio duplicado de evento já processado.

---

### 6. Arquitetura Multi-Tenant Estrita, RBAC e Sessão por CNPJ

#### [MODIFY] [auth.ts (middleware)](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/middleware/auth.ts)
- Helpers de isolamento multi-tenant: `getAccessibleEmpresaIds(req)`, `enforceTenantFilter(req)` e `hasTenantAccess(req, empresaId)`.

#### [MODIFY] [auth.ts (rotas)](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/routes/auth.ts)
- Persistência e restauração automática do CNPJ ativo do usuário pós-login.

#### [MODIFY] [tenants.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/routes/tenants.ts)
- Filtragem no banco: usuários regulares só veem seus CNPJs autorizados; `admin_master` vê todos.

#### [MODIFY] [relatorios.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/routes/relatorios.ts) & [partners.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/routes/partners.ts)
- Isolamento estrito de dados analíticos e parceiros pelo tenant da sessão.

#### [MODIFY] [AuthContext.tsx](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/contexts/AuthContext.tsx)
- Restauração de sessão validada pelo endpoint `/api/auth/me`.

---

### 7. Interface e Experiência do Usuário (Alertas de Desconhecimento, DANFE, KPIs)

#### [MODIFY] [EventosDfePanel.tsx](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/components/EventosDfePanel.tsx)
- Adicionar aba e filtros para **Eventos de Terceiros / Manifestações de Clientes**.
- Destaque visual crítico para NF-es com manifestação de *Desconhecimento da Operação (210220)* ou *Operação não Realizada (210240)*.
- Ações recomendadas para o analista fiscal (ex: emitir cancelamento, acionar compliance ou registrar ocorrência).

#### [MODIFY] [DfeManagerPanel.tsx](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/components/DfeManagerPanel.tsx) & [RelatoriosXmlPanel.tsx](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/components/RelatoriosXmlPanel.tsx)
- Badges de situação de manifestação em tempo real e visualização de DANFE / XML completos.

---

## Verification Plan

### Automated Tests
1. **Compilação e Verificação de Tipos:** `npm run lint` (`tsc --noEmit`).
2. **Script de Teste de Integridade Transacional, Eventos de Terceiros e Multi-Tenant:**
   - Criar `server/test_suite.ts`:
     - Testar ingestão de XMLs (NF-e, CT-e, NFS-e).
     - Testar transmissão de evento próprio (Ciência 210210) sem documento prévio (zero erro de Foreign Key).
     - Testar recepção e processamento de evento de terceiro (Desconhecimento 210220 disparado por cliente em nota de saída).
     - Testar validação de carimbos no Horário Oficial de Brasília (`-03:00`).
     - Testar isolamento de dados de usuário regular vs superadmin.

### Manual Verification
1. Consultar distribuição SEFAZ e verificar identificação de eventos de terceiros.
2. Disparar eventos no `EventosDfePanel` e verificar gravação ACID sem erro de Foreign Key.
3. Testar alternância de CNPJs e login/logout persistente.
4. Validar abertura de DANFE e XML a partir do banco de dados.
