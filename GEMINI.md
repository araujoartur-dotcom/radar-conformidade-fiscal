# Diretrizes do Projeto: Radar de Conformidade Fiscal

## Regra Fundamental: Compliance Tributário Estrito e Proibição Absoluta de Fallbacks
1. **Zero Mocks / Zero Fallbacks Silenciosos**:
   - Nunca use fallbacks, entidades fictícias ("admin-master-01", "EMPRESA CONFORMIDADE") ou inferências automáticas que mascarem a falta de dados reais.
   - **PROIBIÇÃO ABSOLUTA DE INFERÊNCIA OU INGESTÃO DE DADOS INEXISTENTES**: Nunca inferir, supor, simular ou ingerir dados inexistentes, e NUNCA preencher informações supondo que está resolvendo algo sem antes consultar e obter aprovação explícita do Proprietário do Sistema.
   - Todo dado tributário, fiscal, societário e de auditoria DEVE ser 100% autêntico, extraído diretamente das tags oficiais dos arquivos XML dos documentos fiscais eletrônicos.
   - Caso uma tag não exista no XML (ex: ausência de <IBSCBS>, <cClassTrib>, <vIBS>), o valor no banco DEVE ser estritamente zero ou nulo/vazio. NUNCA preencher valores com tags de outros tributos (ex: jamais usar vProd como vBC do IBS/CBS).
   - Caso um dado obrigatório (ex: usuário autenticado, empresa na carteira, certificado digital A1, chave de acesso) esteja ausente ou inconsistente, o sistema deve **rejeitar a operação explicitamente com erro descritivo**.
2. **Nomenclatura Canônica Baseada nas Tags Oficiais do XML**:
   - Os nomes de campos fiscais e tributários devem refletir exatamente as tags oficiais do XML da SEFAZ e NT 2025.002 (ex: vIBSUF, vIBSMun, vIBS, vCBS, vBC, pIBSUF, pIBSMun, pIBS, pCBS, cClassTrib, indOper, vProd, vNF, vICMS, vPIS, vCOFINS, etc.).
3. **Centralização do Certificado Digital A1**:
   - A configuração, armazenamento e validação do Certificado A1 (.PFX + senha com cofre AES-256-GCM) é **exclusiva e definitiva dentro do Cadastro da Empresa** (`carteira_cnpjs`).
   - Não manter modais soltos de certificado no cabeçalho ou outros módulos; outros pontos atuam estritamente como indicadores direcionadores para a Carteira de CNPJs.
4. **Padrões Oficiais SEFAZ / RTC**:
   - Cumprimento rigoroso dos esquemas XML nacionais (Pacote 010f, NT 2025.002 RTC v1.50/v1.51, NT 2026.007, NT 2026.004 CNPJ Alfanumérico).
5. **Transparência e Realismo Técnico Obrigatório**:
   - Proibição de otimismo superficial. Só responder positivamente sobre viabilidade quando for 100% real, testado e comprovado.
   - Sempre declarar custos adicionais reais de APIs, limitações de provedores externos, SLAs e pontos de falha antes de iniciar qualquer trabalho.
