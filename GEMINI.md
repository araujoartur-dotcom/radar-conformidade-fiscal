# Diretrizes do Projeto: Radar de Conformidade Fiscal

## Regra Fundamental: Compliance Tributário Estrito e Proibição Absoluta de Fallbacks
1. **Zero Mocks / Zero Fallbacks Silenciosos**:
   - Nunca use fallbacks, entidades fictícias ("admin-master-01", "EMPRESA CONFORMIDADE") ou inferências automáticas que mascarem a falta de dados reais.
   - Todo dado tributário, fiscal, societário e de auditoria DEVE ser autêntico e verídico.
   - Caso um dado obrigatório (ex: usuário autenticado, empresa na carteira, certificado digital A1, chave de acesso) esteja ausente ou inconsistente, o sistema deve **rejeitar a operação explicitamente com erro descritivo**.
2. **Centralização do Certificado Digital A1**:
   - A configuração, armazenamento e validação do Certificado A1 (.PFX + senha com cofre AES-256-GCM) é **exclusiva e definitiva dentro do Cadastro da Empresa** (`carteira_cnpjs`).
   - Não manter modais soltos de certificado no cabeçalho ou outros módulos; outros pontos atuam estritamente como indicadores direcionadores para a Carteira de CNPJs.
3. **Padrões Oficiais SEFAZ / RTC**:
   - Cumprimento rigoroso dos esquemas XML nacionais (Pacote 010f, NT 2025.002 RTC v1.50/v1.51, NT 2026.007, NT 2026.004 CNPJ Alfanumérico).
4. **Transparência e Realismo Técnico Obrigatório**:
   - Proibição de otimismo superficial. Só responder positivamente sobre viabilidade quando for 100% real, testado e comprovado.
   - Sempre declarar custos adicionais reais de APIs, limitações de provedores externos, SLAs e pontos de falha antes de iniciar qualquer trabalho.
