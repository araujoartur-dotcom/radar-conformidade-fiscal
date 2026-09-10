# 🔍 Auditoria de Integridade de Software — Radar de Conformidade Fiscal

**Data:** 07/09/2026  
**Auditor:** IA — Modo Auditor de Software  
**Escopo:** Integridade entre módulos, consistência de dados, erros de build e lacunas funcionais

---

## 🔴 Severidade CRÍTICA (Bloqueia Produção)

### 1. Build Quebrado — 4 Erros TypeScript no Frontend

O comando `tsc --noEmit` retornou **4 erros fatais** que impedem o build no Netlify:

```
src/components/TabelasFiscaisPanel.tsx(283,27): error TS2304: Cannot find name 'uploadFile'.
src/components/TabelasFiscaisPanel.tsx(1316,28): error TS2304: Cannot find name 'Pencil'.
src/components/TabelasFiscaisPanel.tsx(2214,20): error TS2304: Cannot find name 'Calculator'.
src/components/TabelasFiscaisPanel.tsx(2282,20): error TS2304: Cannot find name 'Calculator'.
```

| Erro | Causa Raiz | Arquivo | Linha |
|------|-----------|---------|-------|
| `uploadFile` não encontrado | O hook `useApi` retorna `{ get, post, put, del, uploadFile }`, mas no destructuring da linha 64 do componente, `uploadFile` pode não estar sendo extraído corretamente ou a referência está errada após refatoração. | [TabelasFiscaisPanel.tsx](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/components/TabelasFiscaisPanel.tsx#L283) | 283 |
| `Pencil` não importado | O ícone `Pencil` do Lucide é referenciado mas **não existe** na lista de imports (linha 2-6). O import correto disponível é `Edit3`. | [TabelasFiscaisPanel.tsx](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/components/TabelasFiscaisPanel.tsx#L1316) | 1316 |
| `Calculator` não importado (2x) | O ícone `Calculator` é usado em 2 pontos mas **não está importado** do `lucide-react`. | [TabelasFiscaisPanel.tsx](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/components/TabelasFiscaisPanel.tsx#L2214) | 2214, 2282 |

> [!CAUTION]
> Estes erros **impedem o deploy no Netlify**. O Netlify roda `npm run build` (que inclui `tsc`) e rejeita builds com erros de tipo. **É possível que os últimos commits não tenham sido deployados com sucesso.**

---

### 2. Arquitetura de Deploy Incompatível — Frontend (Netlify) ≠ Backend (Express)

O sistema possui um **backend Express completo** ([server/app.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/app.ts)) com 14 módulos de rotas. Porém o deploy no Netlify é configurado como **site estático puro**:

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Impacto:** Todas as chamadas a `/api/*` em produção são redirecionadas para `index.html` (retornando HTML em vez de JSON). As funções que dependem exclusivamente da API backend (login, consulta SEFAZ, geração de relatórios, etc.) **não podem funcionar** sem um backend Express rodando em algum lugar.

**Evidência do conflito:**
- [apiConfig.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/utils/apiConfig.ts#L11-L21): `getApiBaseUrl()` retorna `/api` quando `VITE_API_URL` não é definida.
- `.env` local define `VITE_API_URL=http://localhost:3001`, mas **essa variável não existe no `.env` para builds de produção**.
- O Vite proxy (`localhost:3001`) só funciona em dev.

> [!IMPORTANT]
> **Hipótese:** Se o sistema funciona em produção, é porque existe uma `VITE_API_URL` configurada nas **Environment Variables do painel do Netlify** apontando para um backend Express rodando em algum serviço (Render, Railway, Docker local, etc.). Isso precisa ser confirmado pelo usuário.

---

## 🟠 Severidade ALTA (Funcionalidade Comprometida)

### 3. Relatório 9 (Retenções) NÃO Consulta a Tabela de Regras

O endpoint [/api/relatorios/xml](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/routes/relatorios.ts#L440-L485) aplica a lógica de auditoria de retenções com **alíquotas hardcoded**:

```typescript
// relatorios.ts:453-458 — Alíquotas fixas, NÃO lidas da tabela regras_retencao_servicos
const aliquotaIrrf = docTotal > 0 && valorIrrf > 0 ? ... : (isNfse ? 1.5 : 0);
const aliquotaInss = docTotal > 0 && valorInss > 0 ? ... : (isNfse ? 11.0 : 0);
const aliquotaCsllRetido = 1.0;    // ← FIXO
const aliquotaPisRetido = 0.65;    // ← FIXO
const aliquotaCofinsRetido = 3.0;  // ← FIXO
const aliquotaIssRetido = ... : 5.0; // ← FIXO
```

**O motor de auditoria ignora completamente** a tabela `regras_retencao_servicos` que foi criada para ser a base de inteligência tributária. Não há nenhum `SELECT` ou `JOIN` com essa tabela em todo o arquivo `relatorios.ts`.

| Esperado | Realidade |
|----------|-----------|
| Cruzar `item_lc116` / `cClassTrib` da NFS-e com a tabela de regras | Alíquotas hardcoded (1.5%, 4.65%, 11%, 5%) |
| Usar `irrf`, `csrf`, `inss`, `iss` da tabela por código de serviço | Valores genéricos aplicados a todas as NFS-e |
| Diagnóstico baseado em regra específica do serviço | Diagnóstico genérico com threshold fixo (`> R$ 5.000`, `> R$ 215`) |

> [!WARNING]
> Esta é a **lacuna funcional mais importante** do sistema. A tabela de regras existe, o CRUD funciona, mas o Relatório 9 não a consulta. Isso significa que a auditoria de retenções não diferencia um serviço de análise de sistemas (01.01, IRRF 1.50%) de um serviço de cessão de mão de obra (INSS 11%).

---

### 4. Divergência de Schema — SQLite (`INTEGER`) vs Supabase (`BOOLEAN`)

Os campos `ps_onerosa` e `adq_exterior` têm tipos diferentes entre os dois bancos:

| Campo | SQLite ([schema.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/db/schema.ts#L264-L265)) | Supabase ([create-regras-retencao.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/scripts/create-regras-retencao.ts#L16-L17)) |
|-------|--------|----------|
| `ps_onerosa` | `INTEGER DEFAULT 0` | `BOOLEAN` |
| `adq_exterior` | `INTEGER DEFAULT 0` | `BOOLEAN` |
| `id` | `TEXT PRIMARY KEY` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` |

**Impacto:** O backend faz conversão manual (`=== 1 ? true : false`) em vários pontos, o que funciona, mas:
- IDs gerados pelo SQLite (`uuid()` do Node) são strings tipo `"a1b2c3..."`, enquanto o Supabase gera UUIDs nativos.
- O frontend direto no Supabase ([supabaseFrontend.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/utils/supabaseFrontend.ts)) envia `boolean` (correto para Supabase), mas se o backend espelhar de volta para SQLite, receberá `true/false` em vez de `1/0`.

---

### 5. Upload CSV — Dual Path com Inconsistência de Dados

O upload do CSV agora tem **duas rotas paralelas** que produzem dados ligeiramente diferentes:

| Aspecto | Backend Express ([tables.ts:805](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/routes/tables.ts#L805)) | Frontend Direto ([TabelasFiscaisPanel.tsx:267](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/components/TabelasFiscaisPanel.tsx#L267)) |
|---------|------------------|-----------------|
| ID gerado | `uuid()` (Node.js) | Supabase `gen_random_uuid()` |
| `ps_onerosa` | `1` ou `0` (INTEGER) | `true` ou `false` (BOOLEAN) |
| Grava em SQLite? | ✅ Sim | ❌ Não |
| Grava em Supabase? | ✅ Sim (com conversão) | ✅ Sim (direto) |
| Sincronização bidirecional | N/A (fonte única) | ❌ SQLite fica desatualizado |

> [!WARNING]
> Se o usuário faz upload pelo frontend direto (Supabase), o **SQLite local fica desatualizado**. O backend Express continuará lendo dados antigos do SQLite para quem acessar localmente.

---

## 🟡 Severidade MÉDIA (Risco Funcional)

### 6. CRUD (Criar/Editar/Excluir) de Regras Não Tem Fallback Supabase

Os handlers `handleSaveRegraRetencao` e `handleDeleteRegraRetencao` usam **apenas** `put()` e `del()` do `useApi`, que roteiam para o backend Express:

```typescript
// TabelasFiscaisPanel.tsx:362-364
res = await put(`/tables/regras-retencao-servicos/${payload.id}`, payload);
res = await post('/tables/regras-retencao-servicos', payload);
```

Se o backend Express não estiver acessível (cenário Netlify puro), essas operações **falham silenciosamente**. O `loadRetencoes()` tem fallback para Supabase, mas o CRUD individual não.

---

### 7. `loadRetencoes()` — Parsing Inconsistente da Resposta da API

```typescript
// TabelasFiscaisPanel.tsx:191-196
const res = await get<{ success: boolean; data: any[] }>('/tables/regras-retencao-servicos');
if (res?.ok && res?.data?.data) {
  setRegrasRetencao(res.data.data);     // Acessa res.data.data
} else if (res?.success && res?.data) {
  setRegrasRetencao(res.data as any);   // Acessa res.data diretamente
}
```

O `useApi` encapsula a resposta em `{ ok, status, data }`, onde `data` já é o JSON da API (`{ success, data: [...] }`). Então o acesso correto seria `res.data.data`. O segundo `else if` (`res?.success`) nunca será `true` porque o objeto retornado pelo `useApi` não tem campo `success` — ele tem `ok`.

---

### 8. Variáveis de Ambiente Sensíveis no `.env`

O arquivo `.env` contém chaves sensíveis que agora também são expostas ao frontend:

```
VITE_SUPABASE_ANON_KEY=eyJhbG...   ← Exposta ao browser (via build Vite)
SUPABASE_SERVICE_ROLE_KEY=eyJhbG... ← Chave ADMIN (backend only, OK)
```

A `ANON_KEY` por design é segura para o browser (com Row Level Security). Mas:

> [!IMPORTANT]
> **A tabela `regras_retencao_servicos` não tem RLS (Row Level Security) habilitada no Supabase.** O frontend faz `DELETE` e `INSERT` diretamente via `ANON_KEY`. Qualquer pessoa com a anon key poderia manipular essa tabela.

---

## 🔵 Severidade BAIXA (Qualidade / Manutenibilidade)

### 9. Script `create-regras-retencao.ts` Usa `exec_sql` RPC

```typescript
// create-regras-retencao.ts:41
const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
```

A função `exec_sql` é uma RPC personalizada que provavelmente não existe no Supabase do usuário (precisa ser criada manualmente). O script falhará silenciosamente.

### 10. Dockerfile Orphan

O [Dockerfile](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/Dockerfile) existe e é funcional, mas **não há evidência de uso** (sem CI/CD para Docker, sem docker-compose, sem referência em workflows). Está como código morto.

### 11. `netlify.toml` — Redirect Wildcard Engole APIs

O redirect `/* → /index.html (200)` deveria **excluir** rotas de API ou Netlify Functions, caso contrário qualquer tentativa de chamar `/api/*` retorna o HTML do SPA com status 200 (em vez de 404), dificultando o debug.

---

## 📊 Resumo Executivo

| Severidade | Qtd | Impacto |
|:----------:|:---:|---------|
| 🔴 Crítica | 2 | Build quebrado + Arquitetura de deploy incompatível |
| 🟠 Alta | 3 | Relatório 9 sem inteligência, Schema divergente, Upload dual-path |
| 🟡 Média | 3 | CRUD sem fallback, parsing inconsistente, RLS ausente |
| 🔵 Baixa | 3 | Script RPC, Dockerfile orphan, redirect wildcard |

---

## ✅ Recomendação de Ação Imediata (Ordem de Prioridade)

1. **Corrigir os 4 erros de TypeScript** — Adicionar imports `Pencil`, `Calculator` e corrigir referência `uploadFile` → Sem isso, nenhum deploy funcionará.
2. **Confirmar onde o backend Express roda em produção** — Verificar se há `VITE_API_URL` nas variáveis do Netlify.
3. **Integrar `regras_retencao_servicos` no motor do Relatório 9** — Fazer JOIN por `item_lc116` / `cClassTrib` para cruzar alíquotas reais vs aplicadas.
4. **Habilitar RLS no Supabase** para a tabela `regras_retencao_servicos`.
5. **Unificar o path de upload** — Escolher uma estratégia (backend OU Supabase direto, não ambos).
