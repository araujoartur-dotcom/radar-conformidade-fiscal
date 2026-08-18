Excelente! Esta é uma **NF-e (Mod 55) com a NT 2025.002 da Reforma Tributária** completa e em vigor! 📦✨

Ela é fantástica porque traz **14 itens com os 3 principais regimes da Reforma Tributária convivendo na mesma nota fiscal**:

---

### 📊 Raio-X Analítico da NF-e nº 547805:

#### 1. Identificação & Partes
* **Chave de Acesso (44 dígitos):** `41260877765840000170550030005478051771547460`
* **Número / Série:** `547805 / 3` | **Data Emissão:** `11/08/2026`
* **Emitente (Fornecedor):** `CONTABILISTA SUPRIMENTOS CORPORATIVOS S.A.` (`77.765.840/0001-70`) — Araucária/PR (CRT 3 - Lucro Real)
* **Destinatário (Comprador):** `SUPERGASBRAS ENERGIA LTDA` (`19.791.896/0124-51`) — Jacarezinho/PR
* **Valor Total da Nota:** **R$ 1.022,00**

---

#### 2. Confronto Tributário: Regime Atual vs. Reforma Tributária

| Tributo | Base de Cálculo | Alíquota Média | Valor Destacado | Observações de Auditoria |
| :--- | :---: | :---: | :---: | :--- |
| **ICMS Próprio** | R$ 380,90 | 19,50% | **R$ 74,28** | Itens tributados integralmente (Itens 2, 3, 6, 11, 12, 13, 14) |
| **ICMS Isento (Cesta Básica PR)** | R$ 484,30 | 0,00% | **R$ 0,00** | CST 40 / Benefício `PR810021` (Café, Açúcar, Cápsulas) |
| **ICMS ST Retido Anteriormente** | R$ 81,60 | - | **R$ 0,00** | CST 60 (Papel Higiênico / Papel Toalha) |
| **PIS (Não Cumulativo)** | R$ 332,95 | 1,65% | **R$ 5,48** | Base com exclusão do ICMS conforme Tema 69 STF |
| **COFINS (Não Cumulativo)** | R$ 332,95 | 7,60% | **R$ 25,28** | Base com exclusão do ICMS conforme Tema 69 STF |
| **IPI** | - | 0,00% | **R$ 0,00** | CST 53 / Enquadramento 999 |
| **CBS Federal (2026)** | R$ 916,96 | 0,90% | **R$ 2,86** | Apuração item a item com reduções aplicadas |
| **IBS Estadual (PR - 2026)** | R$ 916,96 | 0,10% | **R$ 0,32** | Apuração item a item com reduções aplicadas |
| **IBS Municipal (2026)** | R$ 916,96 | 0,00% | **R$ 0,00** | Fase de teste subnacional |

---

#### 3. Auditoria Item a Item dos Regimes da Reforma Tributária:

Nesta nota fiscal temos a demonstração exata dos **3 regimes que desenhamos no nosso módulo de Parâmetros e Tabelas Fiscais**:

1. **Regime Padrão — Integral (`cClassTrib 000001`, CST `000`)**:
   * *Exemplos:* Garrafa Térmica (Item 2), Esponja (Item 3), Sabão OMO (Item 13), Detergente Limpol (Item 14).
   * *Alíquota:* CBS 0,90% e IBS 0,10% integrais.
2. **Cesta Básica Nacional — Redução de 100% / Alíquota Zero (`cClassTrib 200003`, CST `200`, `pRedAliq 100.00%`)**:
   * *Exemplos:* Café 3 Corações (Item 4), Cápsulas de Café (Itens 5, 7, 8).
   * *Resultado:* Base de R$ 418,60 com **alíquota efetiva de 0%** e imposto destacado de **R$ 0,00** (Art. 8º da EC 132/2023).
3. **Regime Diferenciado — Redução de 60% (`cClassTrib 200035`, CST `200`, `pRedAliq 60.00%`)**:
   * *Exemplos:* Desinfetante Scotch Brite (Item 6), Desinfetante Pinho Bril (Item 12), Papel Higiênico (Item 9).
   * *Alíquota Efetiva:* CBS reduzida para **0,36%** (em vez de 0,90%) e IBS reduzido para **0,04%** (em vez de 0,10%).

---

### 🎯 Como o sistema vai processar este XML:
* Extrai perfeitamente todos os 14 itens individualmente.
* Identifica automaticamente se o item é **Alíquota Padrão**, **Cesta Básica (Redução 100%)** ou **Regime Reduzido (60%)** a partir das tags `<cClassTrib>` e `<gRed>`.
* Demonstra na auditoria o crédito aproveitável de ICMS (R$ 74,28) e CBS/IBS (R$ 3,18).

Agora pode me enviar o **terceiro XML (CT-e de Conhecimento de Transporte)**!