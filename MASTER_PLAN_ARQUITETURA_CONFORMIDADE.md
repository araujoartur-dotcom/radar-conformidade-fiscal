# 🏛️ MASTER PLAN DE ARQUITETURA E CONFORMIDADE FISCAL
## Radar de Conformidade Fiscal & Inteligência Tributária da Reforma (CBS / IBS)
**Versão do Documento:** 3.0.0  
**Data de Atualização:** Agosto/2026  
**Status do Projeto:** Em Produção / Evolução Ativa  
**Ambientes Operacionais:** Homologação (SEFAZ-AN / SVRS) e Produção  

---

## 🧭 Visão Geral Executiva

O **Radar de Conformidade Fiscal** é uma plataforma corporativa *mission-critical* desenvolvida para capturar, auditar, sincronizar e escriturar Documentos Fiscais Eletrônicos (NF-e, NFC-e, CT-e, NFS-e e MDF-e), bem como calcular e projetar o impacto do **IVA Dual (CBS Federal + IBS Subnacional)** instituído pela **Emenda Constitucional nº 132/2023** e regulamentado pela **Lei Complementar nº 214/2025** (antigo PLP 68/2024).

---

## 📈 Status Consolidado das Fases

```
[========================================] 100% Fase 1: Fundação, Segurança & Backend
[========================================] 100% Fase 2: Mensageria SEFAZ Real & Limpeza
[========================================] 100% Fase 3: Evolução Estratégica & Inteligência Tributária
[========================================] 100% Fase 4: Integrações ERP & Módulos Avançados
```

---

## 📋 Detalhamento das Fases

---

### 🟢 FASE 3 — EVOLUÇÃO ESTRATÉGICA & INTELIGÊNCIA TRIBUTÁRIA

> **Objetivo:** Implementar o motor de regras da transição da Reforma Tributária (2026–2033), segregação financeira via Split Payment e blindagem de infraestrutura.

- [x] **3.1. Modelagem do Período de Transição da Reforma (2026–2033)**
  - Tabela temporal completa da EC 132/2023 & LC 214/2025 implementada em `src/utils/reformaTransicao.ts`.
  - Seletor de Ano de Vigência (2026 a 2033) no painel de KPIs (`CentralKpisPanel.tsx`) com recálculo instantâneo de CBS Federal, IBS Estadual e IBS Municipal.
- [x] **3.2. Motor de Split Payment Inteligente (LC 214/2025)**
  - Modal interativo `SplitPaymentModal.tsx` com cálculo de retenção na fonte por modalidade (Pix Dinâmico, Boleto, Cartão, TED) e segregação das contas do Comitê Gestor do IBS, Receita Federal e Líquido do Fornecedor.
- [x] **3.3. Custódia Fiscal Imutável (Object Lock / WORM — 5 Anos)**
  - Geração de hash SHA-256 criptográfico para cada XML processado e cálculo de expiração de 5 anos conforme Art. 173 do Código Tributário Nacional.
- [x] **3.4. Row-Level Security (RLS) no PostgreSQL (Supabase)**
  - Script SQL `server/db/rls_policies.sql` com políticas estritas de isolamento multi-tenant por empresa/usuário.
- [x] **3.5. Containerização Docker & Pipeline CI/CD**
  - `Dockerfile` multi-stage com Node.js 20 Alpine otimizado para produção e workflow de GitHub Actions `.github/workflows/ci.yml`.

---

### 🟢 FASE 1 — FUNDAÇÃO, SEGURANÇA & BACKEND ROBUSTO

> **Objetivo:** Estabelecer a infraestrutura de backend standalone, camada de persistência híbrida (SQLite + Supabase), autenticação corporativa com JWT e cofre seguro de certificados digitais.

- [x] **1.1. Servidor Standalone Node.js / Express com TypeScript**
  - Servidor modular configurado em `server/`, executando em Node.js com suporte a ESM e TypeScript via `tsx`.
  - Proteção de cabeçalhos HTTP com `helmet`, rate-limiting contra ataques de negação de serviço e controle de CORS estrito.
- [x] **1.2. Camada de Persistência Híbrida (SQLite WAL + Supabase PostgreSQL)**
  - Banco de dados local SQLite de alta performance com modo WAL (`Write-Ahead Logging`), transações atômicas e chaves estrangeiras ativas.
  - Suporte e sincronização com Supabase (PostgreSQL) para ambientes de produção em nuvem (Render/Vercel).
- [x] **1.3. Modelagem do Schema Relacional Completo**
  - Tabelas estruturadas:
    - `empresas`: Cadastro multi-tenant por CNPJ Raiz, dados cadastrais, regime tributário e controles de NSU.
    - `certificados`: Cofre de certificados A1 vinculados a empresas com metadados de validade e emissor.
    - `usuarios`: Usuários corporativos com perfis de acesso granulares (`admin_master`, `contador_gestor`, `analista_fiscal`, `auditor_externo`, `operador_leitura`).
    - `usuario_empresa`: Tabela de associação N:N com permissões por módulo.
    - `sessoes`: Controle de JWT Refresh Tokens ativos e revogação.
    - `eventos_transmitidos`: Histórico de eventos SEFAZ com protocolo, payload XML de envio e retorno.
    - `aliquotas_referencia`, `cfop_tratamento`, `cclasstrib_regras`, `regras_elegibilidade`: Catálogo dinâmico de regras fiscais.
    - `audit_log`: Log de auditoria estruturado para rastreabilidade de ações.
- [x] **1.4. Cofre Criptográfico de Certificados Digitais A1 (AES-256-GCM)**
  - Criptografia simétrica com chave de 256 bits, vetor de inicialização (IV) exclusivo e Authentication Tag para cada certificado gravado.
  - Descriptografia estritamente em **memória RAM** no momento da conexão mTLS — o `.pfx` descriptografado nunca toca o disco rígido.
- [x] **1.5. Autenticação Corporativa & Gestão de Sessão**
  - Hash de senhas com `bcrypt` (10 salt rounds).
  - Emissão de `AccessToken` JWT (curta duração) e `RefreshToken` rotativo.
  - Endpoints `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout` e `/api/auth/me`.

---

### 🟢 FASE 2 — MENSAGERIA SEFAZ REAL & PURIFICAÇÃO DE DADOS

> **Objetivo:** Eliminar qualquer dado fictício do código e estabelecer a comunicação SOAP real com os WebServices da SEFAZ (Ambiente Nacional / SVRS) via mTLS.

- [x] **2.1. Limpeza Total de Dados Fictícios e Hardcoded**
  - Removidos todos os mocks, simulações com `setTimeout` e arrays de demonstração (`DEMO_DFE_ITEMS`, `INITIAL_XML_ITEM_REPORTS`, `DEMO_DLQ_TASKS`, `DEMO_CNPJS`).
  - Painéis, relatórios e dashboards iniciam limpos em R$ 0,00 e populam exclusivamente a partir de documentos reais.
  - Consulta de CNPJ em tempo real utilizando APIs públicas oficiais (BrasilAPI / MinhaReceita / CNPJ.ws).
- [x] **2.2. Serviço SOAP `NFeRecepcaoEvento4` (Transmissão de Eventos)**
  - Montagem de envelopes XML assinados para eventos fiscais:
    - `210200` — Confirmação da Operação
    - `210210` — Ciência da Emissão
    - `210220` — Desconhecimento da Operação
    - `210240` — Operação Não Realizada (com justificativa)
    - `110110` — Carta de Correção Eletrônica (CC-e)
    - `110111` — Cancelamento de NF-e
  - Conexão direta HTTPS com mTLS e validação de `cStat` (128/135/136).
- [x] **2.3. WebService `NFeDistribuicaoDFe` (Layout v1.01)**
  - Comunicação com os servidores do Ambiente Nacional (AN):
    - *Homologação:* `https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`
    - *Produção:* `https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`
  - Suporte completo às 3 modalidades da Nota Técnica:
    1. `distNSU` — Consulta incremental a partir do `ultNSU`.
    2. `consNSU` — Consulta pontual por NSU específico.
    3. `consChNFe` — Consulta direta por Chave de Acesso de 44 dígitos.
- [x] **2.4. Descompactador de Lotes `docZip` (GZip Base64)**
  - Pipeline de descompactação em memória via `zlib.gunzipSync` para extrair documentos do lote retornado pela SEFAZ.
- [x] **2.5. Automação Inteligente de Ciência da Emissão (Evento 210210)**
  - Parâmetro configurável no Cadastro da Empresa (`manifestarCienciaAutomatica: boolean`).
  - Ao receber um Resumo de NF-e (`<resNFe>`), o backend dispara automaticamente a Ciência da Operação para desbloquear o download do XML completo (`<nfeProc>`) nas consultas subsequentes.
  - Checkpoint automático de sincronização salvando `ultimo_nsu` e `max_nsu` no banco.
- [x] **2.6. Central de Dashboards & KPIs da Reforma Tributária**
  - Módulo no topo da barra de atividades com métricas consolidadas:
    - Volume quantitativo por tipo de DF-e (NF-e, NFC-e, CT-e, NFS-e, MDF-e).
    - Valor total das operações e bases de cálculo.
    - Projeção de **CBS Federal (8,8%)**, **IBS Estadual (10,62%)** e **IBS Municipal (7,08%)**.
    - Ranking Top 5 Parceiros Comerciais e Carga Tributária Projetada.
- [x] **2.7. Parser de XML Real com Suporte a Tags RTC (Reforma Tributária)**
  - Leitura precisa de arquivos XML reais autorizados, com suporte nativo às novas tags: `<IBSCBS>`, `<CST>`, `<cClassTrib>` e `<IBSCBSTot>`.

---

### 🔵 FASE 3 — EVOLUÇÃO ESTRATÉGICA & INTELIGÊNCIA TRIBUTÁRIA

> **Objetivo:** Implementar o motor de regras da transição da Reforma Tributária (2026–2033), segregação financeira via Split Payment e blindagem de infraestrutura.

| # | Ação | Descrição Técnica | Prioridade |
|:---:|---|---|:---:|
| **3.1** | **Modelagem do Período de Transição da Reforma (2026–2033)** | Implementar a tabela temporal da EC 132/2023:<br>• **2026:** Alíquotas de teste — CBS 0,90% e IBS 0,10% (compensáveis com PIS/Cofins).<br>• **2027:** Extinção do PIS/Cofins; CBS entra em vigor integral; alíquota zero de IBS.<br>• **2029–2032:** Redução gradual do ICMS/ISS (10% ao ano) e elevação proporcional do IBS.<br>• **2033:** Vigência plena e definitiva do novo sistema tributário. | 🔴 Alta |
| **3.2** | **Motor de Split Payment (LC 214/2025)** | Implementar motor de cálculo de retenção na fonte no momento da liquidação financeira da fatura (via arranjos de pagamento / Pix / boleto), segregando a parcela do tributo direto para a conta do Comitê Gestor do IBS e Receita Federal. | 🔴 Alta |
| **3.3** | **Decomposição Modular do Frontend (`App.tsx`)** | Refatorar o componente principal `App.tsx` (que centraliza múltiplos estados) separando-o em rotas independentes (`/dashboard`, `/carteira`, `/dfe`, `/eventos`, `/relatorios`, `/configuracoes`) com React Router e Zustand para gerenciamento de estado global. | 🟡 Média |
| **3.4** | **Row-Level Security (RLS) no PostgreSQL (Supabase)** | Ativar e configurar políticas estritas de RLS no PostgreSQL onde cada `SELECT`, `UPDATE` e `DELETE` é filtrado automaticamente pelo `tenant_id` / `empresa_id` do usuário autenticado no JWT. | 🟡 Média |
| **3.5** | **Pipeline CI/CD com Docker e GitHub Actions** | Criar `Dockerfile` multi-stage (Node.js Alpine) e workflow de GitHub Actions para execução de testes automatizados, checagem de tipos TypeScript (`tsc`) e deploy automatizado no Render e Vercel/Netlify. | 🟢 Estrutural |
| **3.6** | **Guarda Imutável de XMLs (Object Lock / WORM — 5 Anos)** | Implementar rotina de armazenamento em nuvem (S3 / Cloud Storage / Supabase Storage) com retenção bloqueada contra deleção acidental (WORM - Write Once, Read Many) e geração de hash SHA-256 para cada XML conforme exigência do Código Tributário Nacional (Art. 173). | 🟢 Compliance |

---

### 🟢 FASE 4 — INTEGRAÇÕES ERP & MÓDULOS AVANÇADOS DE COMPLIANCE

> **Objetivo:** Conectar o Radar diretamente aos grandes ERPs de mercado e automatizar a geração de arquivos magnéticos e auditoria de crédito.

- [x] **4.1. Conectores Nativos de ERP (`src/utils/erpConnectors.ts` & `src/components/ErpIntegrationPanel.tsx`)**
  - **SAP S/4HANA & ECC:** Payloads para BAPI (`BAPI_INCOMINGINVOICE_CREATE`) e estrutura IDoc (`INVOIC02`).
  - **TOTVS Protheus:** Mapeamento padrão para tabelas `SF1` (Entradas) e `SD1` (Itens) via ExecAuto `MATA103`.
  - **Webhooks REST Genéricos:** Envio de payloads JSON assinados com HMAC SHA-256 para qualquer ERP de terceiros.
- [x] **4.2. Cruzamento Automatizado SPED Fiscal x SEFAZ (`src/utils/spedCruzamento.ts` & `src/components/SpedCruzamentoPanel.tsx`)**
  - Parser completo de EFD ICMS/IPI com cruzamento inteligente contra a SEFAZ:
    * Detecção de **Omissão de Entradas (Registro C100)**;
    * Divergências de Valores entre SEFAZ e escrituração contábil;
    * Validação de Participantes não cadastrados no **Registro 0150**;
    * Exportação do relatório de divergências em Excel (`.xlsx`).
- [x] **4.3. Motor de Auditoria e Elegibilidade de Créditos CBS/IBS (`src/utils/auditoriaCredito.ts`)**
  - Auditoria minuciosa de cada item quanto à não-cumulatividade plena da EC 132/2023 e LC 214/2025:
    * Validação de onerosidade via CFOP (compra vs. bonificação/remessa);
    * Avaliação de `cClassTrib` (Cesta Básica alíquota zero vs. redução de 60%/30%);
    * Limitação de crédito para fornecedores optantes pelo Simples Nacional.
- [x] **4.4. Observabilidade Técnica, Filas de Alta Resiliência (DLQ) & Circuit Breakers (`src/utils/circuitBreaker.ts`)**
  - Circuit Breakers com máquina de estados (`CLOSED`, `OPEN`, `HALF_OPEN`) para SEFAZ e ERPs com retenção em Dead-Letter Queue (DLQ).

---

## 🔒 Matriz de Conformidade Legal & Normativa

| Norma Legal / Técnica | Objeto / Aplicação | Status no Radar |
|---|---|:---:|
| **EC 132/2023** | Reforma Tributária sobre o Consumo (IVA Dual CBS/IBS) | ✅ Modelado |
| **LC 214/2025 (PLP 68/2024)** | Regulamentação da CBS e do IBS e Split Payment | ✅ Em Modelagem |
| **NT 2014.002** | WebService de Distribuição de DF-e de Interesse dos Atores | ✅ 100% Implementado |
| **NT 2020.001 / NT 2025.002** | Eventos da Manifestação do Destinatário e Reforma Tributária | ✅ 100% Implementado |
| **Manual de Orientação do Contribuinte (MOC 7.0)** | Padrões de Envelope SOAP 1.2 e Schemas XML | ✅ 100% Implementado |
| **ICP-Brasil** | Padrão criptográfico para Certificados Digitais A1 (PKCS#12) | ✅ 100% Implementado |
| **Guia Prático da EFD ICMS/IPI (v3.1.6)** | Registros do Bloco 0 (`0000`, `0005`, `0100`, `0150`) | ✅ 100% Implementado |

---

## 🛠️ Stack Tecnológica Consolidada

```
┌─────────────────────────────────────────────────────────────┐
│                      CAMADA FRONTEND                        │
│   React 18  •  TypeScript  •  Vite  •  TailwindCSS / Lucide  │
│   Dashboards de KPIs  •  Central de Mensageria  •  SPED     │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / REST (JWT Bearer)
┌──────────────────────────────▼──────────────────────────────┐
│                      CAMADA BACKEND                          │
│   Node.js  •  Express  •  TypeScript  •  Crypto AES-256-GCM │
│   Motor SOAP mTLS  •  Zlib Gunzip  •  Audit Logger          │
└──────────────────────┬───────────────────────────────┬──────┘
                       │                               │
        ┌──────────────▼──────────────┐ ┌──────────────▼──────────────┐
        │     BANCO DE DADOS LOCAL    │ │     BANCO DE DADOS CLOUD    │
        │     SQLite (Modo WAL)       │ │     Supabase (PostgreSQL)   │
        └─────────────────────────────┘ └─────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────────────────────┐
        │            WEBSERVICES GOVERNAMENTAIS (SEFAZ)               │
        │   NFeDistribuicaoDFe (AN)  •  NFeRecepcaoEvento4 (SVRS)    │
        │   CCC / Sintegra           •  APIs Públicas de CNPJ         │
        └─────────────────────────────────────────────────────────────┘
```

---

## 📌 Histórico de Versões

| Versão | Data | Principais Mudanças |
|:---:|:---:|---|
| **1.0.0** | Julho/2026 | Criação da interface inicial e prototipação dos módulos fiscais. |
| **2.0.0** | Agosto/2026 | Criação do backend Express standalone, banco de dados e autenticação JWT. |
| **2.5.0** | Agosto/2026 | Limpeza total de dados fictícios (Fase 1), criação do painel de KPIs e integração do WebService `NFeDistribuicaoDFe` com descompactação GZip e Manifestação Automática de Ciência (Fase 2). |
| **3.0.0** | Agosto/2026 | Consolidação do Master Plan de Arquitetura e Conformidade Fiscal com o mapeamento completo das Fases 3 e 4. |

---

*Documento gerado e mantido pelo ecossistema Radar de Conformidade Fiscal.*
