---
trigger: always_on
---

# DIRETRIZ FUNDAMENTAL: COMPLIANCE FISCAL ESTRITO - PROIBIÇÃO ABSOLUTA DE FALLBACKS E DADOS FICTÍCIOS

## 1. Princípio da Realidade e Integridade Tributária
Em sistemas de conformidade fiscal, tributária e contábil (SPED, SEFAZ, RFB, RTC Reforma Tributária, LGPD):
- **NÃO EXISTE FALLBACK SILENCIOSO.**
- **NUNCA inferir, supor, simular ou ingerir dados inexistentes.** NUNCA preencher informações supondo que está "resolvendo" sem antes conversar e obter autorização expressa do Proprietário do Sistema (o Usuário).
- **NUNCA invente ou preencha dados fictícios** para satisfazer uma consulta, persistência ou execução (ex: "admin-master-01", "000001", "EMPRESA CONFORMIDADE", "EMITENTE PADRÃO", alíquotas aproximadas ou supostas).
- **NUNCA preencha valores de um imposto usando tags de outro imposto** (ex: jamais preencher base_ibs ou base_cbs com vProd se a tag <vBC> do grupo IBSCBS não constar no XML).
- **NUNCA selecione dados aleatórios de outra entidade** ("pegar o primeiro usuário ativo do banco") para cobrir ausência de dados de auditoria.

## 2. Nomenclatura Canônica das Tags Oficiais do XML
- Todos os campos de valores, bases e alíquotas DEVEM adotar rigorosamente os nomes oficiais das tags dos esquemas XML da SEFAZ / RTC (ex: `vIBSUF`, `vIBSMun`, `vIBS`, `vCBS`, `vBC`, `pIBSUF`, `pIBSMun`, `pIBS`, `pCBS`, `cClassTrib`, `indOper`, `vProd`, `vNF`, `vICMS`, `vPIS`, `vCOFINS`, `cMun`, `xMun`, `UF`).

## 3. Tratamento de Falhas e Validações
- Se uma informação obrigatória não for fornecida ou for inválida (ex: usuário auditor da sessão, empresa na carteira, chave de acesso, certificado digital A1):
  - **O sistema DEVE falhar de forma explícita, transparente e descritiva.**
  - Deve retornar status de erro rastreável informando exatamente o que está faltando para que o operador legítimo corrija.
- Se uma tag XML opcional ou de nova vigência (ex: <IBSCBS>) não estiver presente no arquivo XML, o registro no banco DEVE refletir fielmente a ausência (valor numérico 0 ou string vazia/nula). Nenhuma inferência ou suposição é permitida.
- Toda gravação em tabelas de auditoria (`eventos_transmitidos`, `dfe_documentos`, `logs_auditoria`) deve refletir fielmente a **identidade real do usuário autenticado** e o **registro oficial da empresa na Carteira de CNPJs**.

## 4. Filosofia de Desenvolvimento
- **"Melhor uma falha clara e imediata do que um dado falso persistido."**
- Em compliance fiscal, um dado gerado por fallback gera passivo tributário, crime contra a ordem tributária, nulidade de processo fiscal e quebra irrevogável de custódia jurídica.
