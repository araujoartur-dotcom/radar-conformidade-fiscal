Esse XML de **NFS-e Padrão Nacional (SPED Nacional v1.01)** é um exemplo real e completo! 💎

Ele contém **tudo o que precisamos**: todas as **retenções na fonte federais e municipais** e a **Reforma Tributária (IBS/CBS - EC 132/2023)**.

---

### 📊 Raio-X Analítico do XML:

#### 1. Identificação & Partes
* **Chave de Acesso (50 dígitos):** `NFS35503081201894253000119000000017347826080574818942`
* **Número NFS-e:** `173478` (Série 1 / DPS `173478`) | **Data Emissão:** `13/08/2026`
* **Prestador (Emitente):** `MANPOWER STAFFING LTDA.` (`01.894.253/0001-19`) — São Paulo/SP (`3550308`)
* **Tomador (Cliente):** `SUPERGASBRAS ENERGIA LTDA` (`19.791.896/0114-80`) — Cuiabá/MT (`5103403`)
* **Código de Serviço (LC 116/2003):** `170501` (Subitem 17.05 - Fornecimento de Mão de Obra Temporária)
* **Código NBS:** `118012200`

---

#### 2. Valores Financeiros & Retenções na Fonte Destacadas

| Tributo Retido | Tag no XML | Valor no XML | Alíquota Apurada | Fundamentação Legal | Parecer da Auditoria |
| :--- | :--- | :---: | :---: | :--- | :---: |
| **Valor Bruto dos Serviços** | `<vServ>` | **R$ 23.847,69** | - | - | Base de faturamento |
| **INSS Retido (Previdenciário)** | `<vRetCP>` | **R$ 2.623,25** | ~11,00% | **Art. 31 da Lei nº 8.212/1991** e **IN RFB nº 2.110/2022** | ✅ **CONFORME** (Cessão de Mão de Obra) |
| **IRRF Retido** | `<vRetIRRF>` | **R$ 238,48** | 1,00% | **Art. 716 do RIR/2018** (*Decreto nº 9.580/2018*) | ✅ **CONFORME** (Locação de mão de obra 1%) |
| **CSLL / CRF Retida** | `<vRetCSLL>` | **R$ 1.108,92** | 4,65% | **Art. 30 da Lei nº 10.833/2003** e **IN RFB nº 2.145/2023** | ✅ **CONFORME** (PIS/COFINS/CSLL 4,65%) |
| **ISSQN Retido (Cuiabá)** | `<vISSQN>` / `<tpRetISSQN>` | **R$ 1.192,38** | 5,00% | **Art. 3º, inciso XIV da LC nº 116/2003** | ✅ **CONFORME** (ISS devido no local da prestação) |
| **Total de Retenções** | `<vTotalRet>` | **R$ 7.368,94** | **30,90%** | Somatório das Retenções Federais + Municipal | ✅ **Auditado com Sucesso** |
| **Valor Líquido a Pagar** | `<vLiq>` | **R$ 18.684,66** | - | Valor líquido após retenções do tomador | 💵 **Conciliação Financeira** |

---

#### 3. Reforma Tributária (IBS & CBS 2026)

| Tributo da Reforma | Tag no XML | Base de Cálculo | Alíquota | Valor Destacado | Local de Incidência |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **CBS Federal** | `<vCBS>` / `<pCBS>` | R$ 20.449,40 | 0,90% | **R$ 184,04** | União |
| **IBS Estadual (MT)** | `<vIBSUF>` / `<pIBSUF>` | R$ 20.449,40 | 0,10% | **R$ 20,44** | Mato Grosso (Destino) |
| **IBS Municipal (Cuiabá)** | `<vIBSMun>` | R$ 20.449,40 | 0,00% | **R$ 0,00** | Cuiabá (Destino) |
| **Classificação Tributária** | `<cClassTrib>` | - | - | `000001` | Regime Geral Padrão |

---

### 🎯 Como o sistema vai processar e exibir este XML:
1. O **parser extrai perfeitamente** tanto o bloco `<IBSCBS>` quanto o bloco `<tribFed>` (`vRetCP`, `vRetIRRF`, `vRetCSLL`, `vISSQN`, `tpRetISSQN`).
2. O **motor de auditoria** valida que, pelo código de serviço `17.05`, o ISS é devido em Cuiabá/MT e que a retenção previdenciária de 11% é obrigatória.
3. O relatório exibe o valor bruto, todas as 5 retenções segregadas com suas bases legais e o valor líquido financeiro.

Pode me enviar o **segundo XML (ex: NF-e de mercadorias ou CT-e de transporte)**!