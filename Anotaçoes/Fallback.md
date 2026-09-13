Searched for "fallback"
Searched for "fallback"
Searched for "fallback"
Searched for "mock"
Searched for "fictic"
Viewed TabelasFiscaisPanel.tsx:195-220
Viewed TabelasFiscaisPanel.tsx:385-430
Viewed upload.ts:720-760
Viewed upload.ts:850-900
Viewed relatorios.ts:255-275
Viewed RelatoriosXmlPanel.tsx:140-170
Viewed CentralKpisPanel.tsx:140-180
Viewed DanfeModal.tsx:160-185
Viewed calculadoraRfbService.ts:50-90
Viewed cnpj.ts:65-145
Viewed nfseService.ts:540-570
Searched for "8.8"
Searched for "pCBS"

Você está coberto de razão: **fallback silencioso é uma das práticas mais traiçoeiras em desenvolvimento corporativo**, especialmente na área fiscal e tributária. Ele mascara falhas de permissão, esconde erros de rede e faz a interface fingir que uma operação funcionou, quando na verdade o backend rejeitou ou usou dados defasados.

Fizemos um levantamento completo em todo o código-fonte do sistema. Os fallbacks estão categorizados por nível de risco e impacto:

---

### 1. Fallbacks Nocivos (Falsa Sensação de Sucesso e Mascaramento de Erros)
*Estes são os mais críticos, pois interceptam erros reais e simulam que tudo correu bem:*

| Localização | O que faz atualmente | Por que gera falsa sensação | Correção recomendada |
| :--- | :--- | :--- | :--- |
| [Header.tsx](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/components/Header.tsx#L81-L87)<br>Linhas 81–87 | Se `POST /auth/switch-empresa` falhar ou retornar 403 (Acesso Negado), força a troca de empresa no estado da tela. | O cabeçalho mostra a empresa nova, mas o backend e o token JWT continuam na empresa anterior. Todas as ações seguintes (consultas, relatórios) quebram ou operam na empresa errada. | **Remover o fallback.** Se o backend falhar, manter a empresa atual e exibir alerta explícito na tela com o erro retornado pelo servidor. |
| [CarteiraCnpjsPanel.tsx](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/components/CarteiraCnpjsPanel.tsx#L710-L728)<br>Linhas 710–728 | Ao clicar em *Selecionar* ou *Ativar*, se o backend rejeitar, ativa a empresa localmente no navegador. | Dá a ilusão de que o usuário tem acesso à filial/cliente, quando na verdade o vínculo não existe ou está bloqueado no banco. | **Remover o fallback.** Notificar erro imediatamente e não alterar a seleção. |
| [DanfeModal.tsx](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/components/DanfeModal.tsx#L166-L185)<br>Linhas 166–185 | Se um XML não contiver os itens nas tags `<det>`, o código inventa um item sintético (`"MERCADORIA / PRODUTO..."`, NCM `2711.19.10`, CFOP `5102`). | O analista tributário vê itens na tela do DANFE que **não existem** no documento fiscal original. | Substituir por mensagem real: *"Nenhum item discriminado no corpo do XML"*. |
| [RelatoriosXmlPanel.tsx](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/components/RelatoriosXmlPanel.tsx#L150-L170)<br>Linhas 150–170 | Se a API de relatórios não retornar dados do banco, usa a memória com CNPJs e nomes fictícios (`00.000.000/0001-91`, `EMPRESA REGISTRADA`). | Apresenta números e gráficos baseados em dados inventados em vez de avisar que a busca no banco veio vazia. | Remover o mapeamento sintético e exibir estado vazio legítimo. |
| [TabelasFiscaisPanel.tsx](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/components/TabelasFiscaisPanel.tsx#L200-L218)<br>Linhas 200–218 e 389–425 | Se a API Express falhar ao salvar/excluir regras de retenção, tenta gravar direto no Supabase e ignora erros com `catch (_) {}`. | Burlar a API pula logs de auditoria e silencia falhas de validação. | Disparar erro na tela e não tentar escrita alternativa oculta. |
| [nfseService.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/services/nfseService.ts#L544-L560)<br>Linhas 544–560 | Se o banco rejeitar uma chave de NFS-e de 50 caracteres (por limite de coluna), trunca a chave em 44 caracteres (`substring(0, 44)`). | Grava uma chave **corrompida/incompleta** no banco de dados fiscal apenas para a query passar. | Lançar erro de schema ou ajustar a coluna para `VARCHAR(60)` sem jamais cortar chaves fiscais. |

---

### 2. Fallbacks de Banco de Dados Híbrido (Supabase Cloud ↔ SQLite Local)
*O sistema possui uma camada dupla: tenta o Supabase Cloud e, se falhar, cai no SQLite do disco local.*

- **Onde ocorre:**
  - [server/routes/auth.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/routes/auth.ts#L157) (Login, `/me` e `/switch-empresa`)
  - [server/routes/upload.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/routes/upload.ts#L859) (Listagem de documentos fiscais)
  - [server/routes/relatorios.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/routes/relatorios.ts#L261) (Relatórios e apurações)
  - [server/routes/tenants.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/routes/tenants.ts) e [certificates.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/routes/certificates.ts#L82)
- **Por que gera confusão:** Se uma empresa ou documento for cadastrado na nuvem (Netlify/Supabase) e o SQLite local estiver desatualizado (ou vazio), a alternância silenciosa entre bancos faz o usuário ora ver os dados, ora ver tela vazia, dependendo de qual conexão respondeu primeiro.
- **Solução recomendada:** Definir uma fonte da verdade explícita (se o Supabase estiver configurado, ele deve responder com sucesso ou erro definitivo; o SQLite só deve operar se o sistema for explicitamente iniciado em modo 100% offline).

---

### 3. Fallbacks de Integrações Externas (Resiliência de Rede)
*Mecanismos que tentam fontes alternativas quando um órgão público está fora do ar:*

- **Tripla Camada de Consulta Cadastral de CNPJ ([src/utils/cnpj.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/utils/cnpj.ts#L68-L145) e [sefazService.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/services/sefazService.ts#L1710)):**
  - Tenta primeiro a **SEFAZ SOAP (CCC)** via Certificado Digital.
  - Se a SEFAZ estadual der timeout/fora do ar, tenta a **CNPJá Open API**.
  - Se falhar, tenta a **CNPJ.ws Pública**.
  - Se falhar, tenta a **MinhaReceita / BrasilAPI**.
  - *Problema de falsa sensação:* O usuário pode achar que o dado veio da SEFAZ com carimbo oficial, quando veio de uma API pública secundária desatualizada.
  - *Solução:* Exibir na tela a etiqueta clara de proveniência (ex: `"Fonte: SEFAZ RS"` ou `"Fonte: Receita Federal via CNPJ.ws"`).

- **Motor da Reforma Tributária ([calculadoraRfbService.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/services/calculadoraRfbService.ts#L66-L75)):**
  - Tenta consultar o endpoint oficial da Receita Federal em `localhost:8080/api/calcular`.
  - Se não responder (quase sempre), cai silenciosamente no motor matemático do Radar Fiscal.
  - *Problema de falsa sensação:* Parece que a validação foi homologada pelo webservice oficial do governo, quando foi feita pelo algoritmo interno.

---

### 4. Fallbacks de Interface / Usabilidade
- **Redirecionamento de Módulo ([src/App.tsx](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/App.tsx#L50-L58)):** Se o usuário não tem permissão para a tela atual, redireciona para a primeira tela permitida (`fallbackModes`) em vez de mostrar a tela de "Acesso Não Autorizado".

---

### Próximos Passos (Sem Deploy)

Quer que eu já **elimine os fallbacks da Categoria 1** (especialmente o de seleção de empresa no [Header.tsx](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/components/Header.tsx) e [CarteiraCnpjsPanel.tsx](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/components/CarteiraCnpjsPanel.tsx), e os itens inventados no [DanfeModal.tsx](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/components/DanfeModal.tsx)), fazendo o sistema operar em modo **Fail-Fast** com erros claros e explicativos sempre que uma operação falhar?