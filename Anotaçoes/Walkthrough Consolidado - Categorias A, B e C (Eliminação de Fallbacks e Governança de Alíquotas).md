# Walkthrough Consolidado: Governança Definitiva de Alíquotas (Categorias A, B e C)
## Eliminação Integral de Fallbacks Silenciosos, Presunções Fictícias e Alíquotas Hardcoded

**Sistema:** Radar de Conformidade Fiscal (SPED • SEFAZ • Reforma Tributária LC 214/2025)  
**Status:** 100% Concluído & Auditado em Ambiente Local  
**Diretrizes:** Política Estrita *"Sem Fallback"* • Segregação em *"Parâmetros & Tabelas Fiscais"* • Zero Deploy (Sem git commit/push/deploy em nuvem)

---

## 1. Sumário Executivo e Matriz das Três Categorias

Toda a arquitetura de cálculo, simulação, visualização documental e relatórios analíticos foi reestruturada para eliminar qualquer suposição ou alíquota oculta no código-fonte. O sistema agora opera com governança transparente no módulo **"Parâmetros & Tabelas Fiscais"**, segregando cada alíquota em três categorias objetivas:

| Categoria | Descrição | Onde Fica no Sistema | Comportamento "Sem Fallback" |
| :--- | :--- | :--- | :--- |
| **Categoria A** | **Tabelas Oficiais da Lei / RFB**<br>Alíquotas de referência Ad Valorem e Ad Rem da Reforma Tributária (LC 214/2025, EC 132/2023) por ano de transição (2026 a 2033+), e catálogo de NCMs com alíquota zero (Cesta Básica) ou redução de 60%. | • `aliquotas_tabelas`<br>• `ncm_regras_anexos`<br>• Abas: *Ad Valorem (%)*, *Ad Rem (R$)* e *Anexos da Lei & NCMs* | **Bloqueio Formal:** Se o ano de competência ou o NCM não estiver cadastrado na tabela oficial do banco, o motor fiscal **não inventa** percentuais. Retorna erro estruturado (`SEM_ALIQUOTA_AD_VALOREM` / `SEM_ALIQUOTA_AD_REM`), tributos zerados e instrução direta de parametrização. |
| **Categoria B** | **Parâmetros Operacionais e Motores de Cálculo**<br>Tabelas editáveis que governam os motores de apuração e cenários de simulação: Simples Nacional (Faixas e Partilhas LC 123/06), Lucro Presumido (Presunções IRPJ/CSLL Lei 9.249/95), Encargos Patronais (Lei 8.212/91), e Inferência Fiscal de Alíquotas Médias. | • `simples_nacional_faixas`<br>• `simples_nacional_partilha_reforma`<br>• `lucro_presumido_parametros`<br>• `encargos_patronais_parametros`<br>• `parametros_inferencia` | **Aviso Explícito de Parâmetro Pendente:** Equações matemáticas mantidas 100% funcionais. Se uma atividade, anexo ou encargo não estiver parametrizado no banco, o sistema emite banner em destaque alertando exatamente o que precisa ser cadastrado para que o cálculo seja concluído. |
| **Categoria C** | **Informativas, Rótulos e Colunas Visuais**<br>Alíquotas que **não** afetam esquemas de cálculos matemáticos, mas orientam visualmente o usuário: Matriz de Retenções de Serviços (NFS-e - IRRF 1708, CRF 5952, INSS e ISSQN), Classificação Tributária cClassTrib (6D), Matriz CFOP de Elegibilidade, Visualização de DANFE e Relatórios de Auditoria. | • `regras_retencao_servicos`<br>• `cclasstrib_regras`<br>• `cfop_tratamento`<br>• Modal DANFE (`DanfeModal.tsx`)<br>• Relatório de Retenções na Fonte (`RelatorioRetencoesFonte.tsx`)<br>• Mapa cClassTrib (`RelatorioMapaCClassTrib.tsx`) | **Transparência Sem Adivinhação:** Rótulos, badges e colunas refletem dinamicamente os parâmetros do banco de dados. Na ausência de dado informado no XML ou na regra, exibe-se `— (Pendente de parametrização)` ou `— (Não informado)`, eliminando códigos e taxas fictícias como `410999`, `17.01`, `26.5%`, `10.6%`, `1.5%`, `11%` e `5%`. |

---

## 2. Detalhamento Técnico das Implementações

```
                                ARQUITETURA DE GOVERNANÇA FISCAL UNIFICADA
                                
                    ┌─────────────────────────────────────────────────────────┐
                    │       Módulo: "Parâmetros & Tabelas Fiscais"            │
                    │               (TabelasFiscaisPanel.tsx)                 │
                    │  [Painel de Governança Fiscal — Categorias A, B e C]   │
                    └────────────────────────────┬────────────────────────────┘
                                                 │
         ┌───────────────────────────────────────┼───────────────────────────────────────┐
         │                                       │                                       │
         ▼                                       ▼                                       ▼
  [CATEGORIA A: OFICIAIS]                [CATEGORIA B: CÁLCULOS]                 [CATEGORIA C: VISUAIS]
  • aliquotas_tabelas (Ad Valorem/Rem)   • simples_nacional_faixas               • regras_retencao_servicos
  • ncm_regras_anexos                    • simples_nacional_partilhas            • cclasstrib_regras (6D)
  • Transição 2026-2033 (LC 214)         • lucro_presumido_parametros            • cfop_tratamento
  • Cesta Básica 100% / Saúde 60%        • encargos_patronais_parametros         • DanfeModal & Relatórios
         │                                       │                                       │
         ▼                                       ▼                                       ▼
  calculadoraRfbService.ts               SimuladorRegimesPanel.tsx               RelatorioRetencoesFonte.tsx
  • Sem alíquota = Erro explícito        • Sincronizado ao banco via API         • Badges dinâmicos (CRF/IRRF/INSS/ISS)
  • Sem presunção de taxa                • Botão "Restaurar Padrão Oficial"      • Alerta de regra não cadastrada
  • Zero fallback silencioso             • Memória Jurídica 100% dinâmica        • Zero código/taxa fictícia (410999/17.01)
```

---

### 2.1. Categoria A: Tabelas Oficiais da Lei / RFB

1. **Vigências Oficiais da Transição da Reforma Tributária (`aliquotas_tabelas`):**
   - Povoadas no banco SQLite `./data/radar_fiscal.db` todas as 8 vigências oficiais estipuladas na LC 214/2025:
     - `2026` (`00001`): CBS 0,90% • IBS Est 0,05% • IBS Mun 0,05% (Total 1,00% — Ano Teste)
     - `2027` (`00002`): CBS 8,80% • IBS Est 0,05% • IBS Mun 0,05% (Total 8,90% — Extinção PIS/COFINS)
     - `2028` (`00004`): CBS 8,80% • IBS Est 0,05% • IBS Mun 0,05% (Total 8,90%)
     - `2029` (`00005`): CBS 8,80% • IBS Est 1,37% • IBS Mun 0,50% (Total 10,67% — Início transição IBS 10%)
     - `2030` (`00006`): CBS 8,80% • IBS Est 2,74% • IBS Mun 1,00% (Total 12,54% — Transição IBS 20%)
     - `2031` (`00007`): CBS 8,80% • IBS Est 4,11% • IBS Mun 1,50% (Total 14,41% — Transição IBS 30%)
     - `2032` (`00008`): CBS 8,80% • IBS Est 5,48% • IBS Mun 2,00% (Total 16,28% — Transição IBS 40%)
     - `2033+` (`00003`): CBS 9,21% • IBS Est 13,70% • IBS Mun 5,00% (Total 27,91% — Transição Plena 100%)
2. **Eliminação de Fallbacks no Motor de Cálculo (`calculadoraRfbService.ts`):**
   - Se uma data de apuração não corresponder a uma vigência oficial cadastrada, o motor fiscal recusa estimativas e retorna `sucesso: false` e `erro: 'SEM_ALIQUOTA_AD_VALOREM'`, instruindo o usuário a cadastrar a vigência.
3. **Catálogo de NCMs com Redução de Alíquota (`ncm_regras_anexos`):**
   - Povoados itens da Cesta Básica Nacional (redução de 100%), Medicamentos Essenciais (redução de 60%) e Bens de Capital (redução de 30%), com busca insensível a pontuações de formatação.

---

### 2.2. Categoria B: Parâmetros Operacionais e Motores de Cálculo

1. **Faixas e Partilhas do Simples Nacional (`simples_nacional_faixas` e `simples_nacional_partilha_reforma`):**
   - 36 faixas e 72 regras de partilha da transição cadastradas (Anexos I a V e Transporte de Cargas com comutação do Art. 18, § 5º-E).
2. **Lucro Presumido e Encargos Patronais (`lucro_presumido_parametros` e `encargos_patronais_parametros`):**
   - 12 atividades econômicas com presunções oficiais de IRPJ (1,6% a 32%), CSLL (12% e 32%), adicional de 10% acima de R$ 20.000/mês e encargos patronais (INSS 20%, RAT/FAP e Sistema S).
3. **Sincronização no Modelador de Regimes (`SimuladorRegimesPanel.tsx`):**
   - O simulador consome diretamente a API `/tables/aliquotas/ad-valorem`. A mudança do ano da transição (ex: 2026, 2029, 2033) atualiza dinamicamente a alíquota oficial do IVA Geral.
   - Criado o botão **"Restaurar Padrão dos Parâmetros Oficiais"**, que reestabelece as alíquotas oficiais do banco para o ano, atividade e anexos selecionados.
   - Implementado aviso em destaque caso qualquer parâmetro essencial esteja pendente de cadastro.

---

### 2.3. Categoria C: Informativas, Rótulos e Colunas Visuais

1. **DANFE Eletrônico (`DanfeModal.tsx`):**
   - Eliminado o preenchimento forçado do código `'410999'` quando o XML não informar `<cClassTrib>` (agora exibe `—`).
   - Eliminado o preenchimento forçado de `'17.01'` em NFS-e sem código de serviço (agora exibe `—`).
   - Substituída a discriminação genérica fictícia `'PRESTAÇÃO DE SERVIÇOS'` por `'Discriminação não informada no XML'`.
   - Adicionada a **Nota de Governança Fiscal (Categoria C - Visualização Documental)** no rodapé.
2. **Auditoria de Retenções na Fonte (`RelatorioRetencoesFonte.tsx`):**
   - Vinculado via API à tabela `regras_retencao_servicos`.
   - Os badges do banner e KPIs calculam dinamicamente os valores de referência cadastrados (CRF, IRRF, INSS e ISSQN).
   - Se não houver regras cadastradas, exibe badge `—` e um banner de alerta explícito para orientar a parametrização.
   - Eliminados todos os fallbacks inline da tabela analítica (`1.5%`, `11%`, `5%` e Item `'17.01'`).
3. **Modelos de Exportação e Relatórios (`reportsData.ts` e `RelatorioMapaCClassTrib.tsx`):**
   - Removida a constante legada `'10.6% (60% de Redução IBS/CBS)'`, substituída por `'Reduzida Conforme Regulamento (Anexos da Lei)'`.
   - Na exportação para Excel, notas com retenções sem alíquota cadastrada exportam `'— (Pendente de parametrização)'`.
   - No mapa cClassTrib, o placeholder não induz mais a taxas estáticas e alíquotas vazias recebem o aviso de pendência.
4. **Memória Jurídica Dinâmica (`SimuladorRegimesPanel.tsx`):**
   - O drawer expansível de fundamentação legal agora exibe dinamicamente as presunções, artigos de lei e encargos patronais da atividade em análise, vinculados aos parâmetros cadastrados no banco.
5. **Painel de Governança e Badges no Módulo de Tabelas (`TabelasFiscaisPanel.tsx`):**
   - Banner executivo com drawer expansível no topo explicando a separação das Categorias A, B e C.
   - Badges visuais em todas as abas: `[Cat. A & B]`, `[Cat. B]` e `[Cat. C]`.
   - Remoção do valor padrão estático `'26.5%'` no formulário de inclusão de regras cClassTrib.

---

## 3. Mapeamento Completo de Arquivos Alterados

| Arquivo Modificado | Categoria Impactada | Principais Alterações |
| :--- | :--- | :--- |
| `server/db/schema.ts` | A, B | Definição dos schemas das tabelas de alíquotas, faixas do Simples, partilhas da transição, presunções e encargos patronais. |
| `server/db/seed.ts` & `seed_categoria_b.ts` | A, B, C | Povoamento atômico de 8 vigências Ad Valorem, 2 Ad Rem, 8 NCMs reduzidos, 36 faixas Simples, 72 partilhas, 12 presunções e 8 regras de retenção NFS-e. |
| `server/services/calculadoraRfbService.ts` | A, B | Remoção total de fallbacks silenciosos. Se a data de fato gerador não encontrar alíquota cadastrada, emite erro `SEM_ALIQUOTA_AD_VALOREM` estruturado. |
| `server/routes/tables.ts` | A, B, C | Endpoints CRUD e upload de todas as tabelas fiscais do sistema, sincronizados entre SQLite e Supabase. |
| `src/utils/reformaTransicao.ts` | A, B | Construção do cronograma dinâmico a partir do banco e emissão de avisos quando um ano de transição não estiver cadastrado. |
| `src/utils/reportsData.ts` | C | Eliminação de strings estáticas (`10.6%`, `17.01`) e substituição de fallbacks numéricos por `'— (Pendente de parametrização)'` na exportação. |
| `src/components/TabelasFiscaisPanel.tsx` | A, B, C | Inclusão do Painel de Governança Fiscal, badges em todas as abas (`Cat. A & B`, `Cat. B`, `Cat. C`), notas conceituais e remoção do default estático `26.5%`. |
| `src/components/SimuladorRegimesPanel.tsx` | B, C | Sincronização dinâmica do IVA da Reforma com o banco, botão "Restaurar Padrão Oficial", avisos de ausência de parâmetros e Memória Jurídica 100% dinâmica. |
| `src/components/DanfeModal.tsx` | C | Eliminação de `410999`, `17.01` e `'PRESTAÇÃO DE SERVIÇOS'`, exibindo `—` e Nota de Governança Fiscal Categoria C. |
| `src/components/relatorios/RelatorioRetencoesFonte.tsx` | C | Conexão à API de retenções, badges de base legal e KPIs dinâmicos, banner de alerta de pendência e eliminação de fallbacks na tabela. |
| `src/components/relatorios/RelatorioMapaCClassTrib.tsx` | C | Pré-preenchimento via API com alíquotas do banco, placeholder higienizado e indicador visual de parametrização pendente. |

---

## 4. Auditoria de Dados no Banco SQLite (`./data/radar_fiscal.db`)

Auditoria automatizada executada via script [audit_database_categories.cjs](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/scratch/audit_database_categories.cjs):

```
=== AUDITORIA GERAL DE REGISTROS POR CATEGORIA ===
[Categoria A & B] aliquotas_tabelas: 10 registros (8 Ad Valorem 2026-2033+ / 2 Ad Rem)
[Categoria A & B] ncm_regras_anexos: 8 registros (Cesta Básica 100%, Saúde 60%, Bens Capital 30%)
[Categoria B]     simples_nacional_faixas: 36 registros (Anexos I a V e Transporte de Cargas)
[Categoria B]     simples_nacional_partilha_reforma: 72 registros (Repartição 2027 a 2033)
[Categoria B]     lucro_presumido_parametros: 12 registros (Presunções IRPJ/CSLL Lei 9.249/95)
[Categoria B]     encargos_patronais_parametros: 5 registros (INSS, RAT/FAP, Terceiros Lei 8.212/91)
[Categoria B]     parametros_inferencia: 3 registros (Alíquotas médias configuráveis)
[Categoria C]     regras_retencao_servicos: 8 registros (Matriz LC 116, IRRF, CRF, INSS, ISS)
[Categoria C]     cclasstrib_regras: 7 registros (Classificações 6D da Reforma)
[Categoria C]     cfop_tratamento: 12 registros (Regras de elegibilidade a crédito)
==================================================
Total: 10/10 tabelas ativas, integradas e consistentes (Zero tabelas ausentes).
```

---

## 5. Bateria de Testes e Validação de Conformidade

1. **Compilação Estática TypeScript (`npx tsc --noEmit`):**
   - **Resultado:** Código 0 (Zero erros). Todos os tipos, imports e contratos estão estritamente consistentes.
2. **Bateria de Testes do Backend (`server/test_suite.ts`):**
   - **Resultado:** 39/39 testes aprovados (100%), validando parsing de XML, proteção Anti-XXE, timezone de Brasília (-03:00), cálculo dinâmico do IVA Dual sem fallbacks, isolamento multi-tenant e gravação de arquivos em disco.
3. **Suite Específica Categoria B (`scratch/verify_categoria_b.ts`):**
   - **Resultado:** 100% aprovado, validando alíquotas oficiais do banco, cronograma dinâmico de transição e bloqueio formal com erro em datas não cadastradas.
4. **Suite Específica Categoria C (`scratch/verify_categoria_c.ts`):**
   - **Resultado:** 35/35 testes aprovados (100%), validando a ausência de códigos arbitrários no DANFE, conexão dinâmica do relatório de retenções, modelo de exportação auditável e Memória Jurídica dinâmica no simulador.

---

## 6. Declaração de Salvaguarda

- **Zero Deploy:** Todo o trabalho foi estritamente circunscrito ao ambiente de desenvolvimento local. Nenhum comando `git add`, `git commit`, `git push` ou pipeline de integração contínua (CI/CD) foi acionado.
- **Transparência Absoluta:** Qualquer ausência de configuração de alíquota agora resulta em exibição clara da pendência ao usuário, eliminando de forma irrevogável o risco de falsas presunções fiscais.
