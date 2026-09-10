# Segregação Multi-Tenant: Central de APIs, Webhooks & Credenciais

Implementação completa do isolamento e blindagem de segurança para configurações de integração, endpoints, chaves e webhooks por CNPJ de empresa.

> **Status de Deploy**: **NENHUM DEPLOY FOI REALIZADO**, atendendo rigorosamente à instrução do usuário (*"só nao faça o deploy ainda"*). Todas as modificações estão salvas localmente no workspace prontas para sua conferência.

---

## 1. O Que Foi Realizado

### A. Ficha Cadastral do CNPJ (`CarteiraCnpjsPanel.tsx`)
- **Nova Aba 5: "5. APIs, Webhooks & Integrações (CGIBS / RFB / ERP)"**:
  - Centraliza a governança técnica da empresa em sua respectiva ficha cadastral.
  - Endpoints configuráveis por inquilino:
    - URL CGIBS (Apuração Assistida MOC)
    - URL RFB (CBS & Imposto Seletivo)
    - WebService SVRS (SEFAZ Virtual)
    - Endpoint NFS-e Padrão Nacional
    - URL de Webhook para recepção de eventos no ERP do cliente
  - Credenciais com mascaramento de segurança:
    - Client ID & Client Secret (CGIBS/SEFIN)
    - API Key CGIBS
    - Bearer Token RFB
  - Controle de visibilidade RBAC: Apenas administradores do sistema (`admin`) e suporte técnico da própria empresa (`suporte_ti`) têm privilégios para visualizar e editar esses dados.
  - Botão interativo para teste de ping e conectividade em tempo real dos motores de cálculo.

### B. Remoção da Central de APIs de Telas Operacionais (`EventosDfePanel.tsx`)
- A aba `apis_config` ("Central de APIs & Webhooks"), que anteriormente ficava visível indiscriminadamente para operadores e analistas na tela de eventos fiscais, foi **completamente removida**.
- Os analistas e operadores emissores agora interagem apenas com as abas de emissão de eventos, visualização de notas técnicas e gerador de schemas XML/JSON.

### C. Generalização e Isolamento na Apuração Assistida (`ApuracaoAssistidaPanel.tsx` & Backend)
- **Eliminação de Regras Hardcoded**: Removidas todas as variáveis e lógicas associadas a uma única empresa específica (`isSupergasbras`, `19791896`, credenciais fixas de piloto).
- O badge superior e os avisos agora exibem o status dinâmico do CNPJ ativo selecionado:
  - `{Razão Social} (CNPJ8: {CNPJ_RAIZ}) — Conectado CGIBS/RFB` ou `Credenciais Pendentes`.
- O modal de credenciais foi unificado e generalizado para qualquer empresa cadastrada no sistema.

### D. Segurança e RBAC no Backend (`server/routes/apuracao.ts` & `server/routes/tenants.ts`)
- Rotas `GET /credenciais`, `POST /credenciais`, `POST /credenciais/flags` e `POST /consultar-demanda`:
  - Protegidas com middleware de autenticação `requireAuth`.
  - Validação estrita de inquilino via `canUserAccessEmpresa(req.user, empresaId)`.
  - O `clientSecret` é persistido no banco e retornado mascarado (`****...`) para prevenir vazamentos.
- `PUT /api/tenants/:id`:
  - Usuários com perfil `suporte_ti` podem agora atualizar os parâmetros técnicos e de integração da sua respectiva empresa, com validação de escopo.

### E. Banco de Dados (`server/db/schema.ts`)
- A tabela `apuracao_credenciais_cgibs` foi estendida com as colunas:
  - `cgibs_url`
  - `rfb_url`
  - `svrs_url`
  - `nfse_nacional_url`
  - `api_key_cgibs`
  - `bearer_token_rfb`
- Migração dinâmica e resiliente via `addColumnIfNotExists`.

---

## 2. Verificação e Validação

1. **TypeScript (`npx tsc --noEmit`)**:
   - Status: **0 erros**, tipagem estrita validada.
2. **Bundle Vite (`npm run build`)**:
   - Status: **Build com sucesso em 24s** (`dist/` gerado perfeitamente).
3. **Auditoria de Termos Hardcoded**:
   - Nenhuma lógica de negócio vinculada à razão social ou CNPJ fixo permanece ativa no código-fonte.
4. **Git Status**:
   - Nenhum commit realizado, nenhum `git push` executado.

---

## 3. Arquivos Modificados

- `server/db/schema.ts`
- `server/routes/apuracao.ts`
- `server/routes/tenants.ts`
- `server/services/apuracaoAssistidaService.ts`
- `src/components/CarteiraCnpjsPanel.tsx`
- `src/components/EventosDfePanel.tsx`
- `src/components/ApuracaoAssistidaPanel.tsx`
- `src/components/RelatoriosXmlPanel.tsx`
- `src/utils/xmlParser.ts`
