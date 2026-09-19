# DIRETRIZ FUNDAMENTAL: COMPLIANCE FISCAL ESTRITO - PROIBIÇÃO ABSOLUTA DE FALLBACKS E DADOS FICTÍCIOS

## 1. Princípio da Realidade e Integridade Tributária
Em sistemas de conformidade fiscal, tributária e contábil (SPED, SEFAZ, RFB, RTC Reforma Tributária, LGPD):
- **NÃO EXISTE FALLBACK SILENCIOSO.**
- **NUNCA invente, simule, infira ou preencha dados fictícios** para satisfazer uma consulta, persistência ou execução (ex: "admin-master-01", "EMPRESA CONFORMIDADE", "EMITENTE PADRÃO", alíquotas aproximadas).
- **NUNCA selecione dados aleatórios de outra entidade** ("pegar o primeiro usuário ativo do banco") para cobrir ausência de dados de auditoria.

## 2. Tratamento de Falhas e Validações
- Se uma informação obrigatória não for fornecida ou for inválida (ex: usuário auditor da sessão, empresa na carteira, chave de acesso, certificado digital A1):
  - **O sistema DEVE falhar de forma explícita, transparente e descritiva.**
  - Deve retornar status de erro rastreável informando exatamente o que está faltando para que o operador legítimo corrija.
- Toda gravação em tabelas de auditoria (`eventos_transmitidos`, `dfe_documentos`, `logs_auditoria`) deve refletir fielmente a **identidade real do usuário autenticado** e o **registro oficial da empresa na Carteira de CNPJs**.

## 3. Filosofia de Desenvolvimento
- **"Melhor uma falha clara e imediata do que um dado falso persistido."**
- Em compliance fiscal, um dado gerado por fallback gera passivo tributário, nulidade de processo fiscal e quebra de custódia jurídica.
