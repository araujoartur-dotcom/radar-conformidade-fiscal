Você tocou **no ponto exato!** Se a empresa emitiu notas em Homologação nos últimos 30 dias entre filiais, **essas notas existem sim na SEFAZ** e deveriam ser localizadas.

Fizemos uma auditoria completa no código da comunicação com o Ambiente Nacional da SEFAZ (`hom1.nfe.fazenda.gov.br`) e identificamos **4 detalhes técnicos fundamentais** que estavam fazendo a SEFAZ de Homologação rejeitar ou não entregar as notas:

---

### 🔍 O que estava acontecendo na comunicação do NSU:

1. **Parâmetro `action` no cabeçalho SOAP 1.2 da SEFAZ**:
   * O servidor de Homologação Nacional da SEFAZ é extremamente rigoroso com o cabeçalho HTTP: ele exige o parâmetro `action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"` junto ao `Content-Type: application/soap+xml`. Sem isso, o gateway da SEFAZ em homologação rejeitava a chamada antes de chegar na fila de notas.
   * **Corrigido!** ✅

2. **Código da UF do Autor (`cUFAutor`)**:
   * No XML de envio (`distDFeInt`), a tag `<cUFAutor>` estava usando `'35'` (São Paulo) como padrão. Se a filial que está consultando for de outro estado (ex: BA=29, PR=41, MT=51, RJ=33, MG=31), a SEFAZ rejeitava a consulta por divergência entre o CNPJ do certificado e a UF informada.
   * **Corrigido!** Agora o `cUFAutor` é extraído dinamicamente do estado real do CNPJ. ✅

3. **Ciclo de Resumo (`resNFe`) $\rightarrow$ Ciência da Emissão $\rightarrow$ XML Completo (`procNFe`)**:
   * Na SEFAZ, quando uma filial emite uma nota para outra, a SEFAZ **NÃO entrega o XML completo de primeira** pelo NSU: ela entrega primeiro um **Resumo (`resNFe`)**.
   * Para liberar o XML completo com todos os produtos e impostos, é obrigatório enviar o evento de **Ciência da Emissão (Código 210210)**.
   * O nosso código já está preparado para disparar a Ciência automaticamente e trazer o XML completo!

4. **Nova Opção: Consulta por NSU Específico (`consNSU`)**:
   * Se o ERP da empresa já consultou a fila de homologação anteriormente, o ponteiro da esteira (`ultNSU`) na SEFAZ pode ter avançado. Ao consultar `000000000000000`, a SEFAZ dizia que não havia nada novo a partir dali.
   * **Criamos uma nova aba no modal:** **`🎯 NSU Específico (consNSU)`**, onde você pode digitar o número exato do NSU (ex: `1`, `2`, `10`, etc.) e buscar a nota pontual diretamente!

---

### 🚀 O que mudou na tela (Já Deployado):

Na aba **"2. Consulta por NSU"**, você agora tem duas opções:
1. **`🔄 Varredura Sequencial (ultNSU)`**: Puxa pacotes de até 50 notas a partir do último NSU.
2. **`🎯 NSU Específico (consNSU)`**: Permite consultar qualquer nota individualmente pelo seu número de NSU sem depender da fila!

---

### 🌐 Status do Deploy:
* **Commit:** `58e4459`
* **Ambiente:** [cortex-tributario.netlify.app](https://cortex-tributario.netlify.app)

Basta dar um `F5` ou `Ctrl+Shift+R` e testar a busca por NSU em Homologação!