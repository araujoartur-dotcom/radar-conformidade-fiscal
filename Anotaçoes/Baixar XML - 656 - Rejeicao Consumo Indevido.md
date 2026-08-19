Primeiramente, **uma excelente notícia:** A comunicação oficial SOAP com mTLS e o certificado digital A1 funcionou com **100% de sucesso**! O WebService oficial da SEFAZ Nacional recebeu seu certificado, autenticou o CNPJ e respondeu com **HTTP 200 OK**! 🚀

A mensagem que você recebeu (`cStat: 656 - Rejeicao: Consumo Indevido`) é uma **regra fiscal de proteção dos servidores da SEFAZ**. Veja a explicação detalhada de cada uma das suas dúvidas:

---

### 1. Por que deu `cStat: 656 - Consumo Indevido` se você fez poucas consultas?
A SEFAZ Nacional possui regras rígidas de tráfego (previstas na **NT 2014.002** e no Manual do Contribuinte):
1. **Consulta a partir do NSU Zero (`000000000000000`)**: 
   * Quando uma consulta é enviada com NSU `000000000000000`, a SEFAZ analisa se esse CNPJ já foi consultado recentemente (seja pelo seu ERP atual, por outro emissor/integrador que a empresa usa, ou pelas primeiras chamadas de teste).
   * Se a SEFAZ entender que não houve novos documentos desde a última consulta ou que foi feita uma nova busca no NSU zero em curto intervalo, ela retorna `cStat 656` para evitar sobrecarga nos servidores da Fazenda.
2. **Tempo de Espera**:
   * O bloqueio do `cStat 656` é temporário e dura **exatamente 1 hora**. Após 60 minutos, a SEFAZ libera o CNPJ novamente para uma nova requisição de lote.

---

### 2. Se você tentar em Homologação, acontece o mesmo?
* **O bloqueio não afeta Homologação**: O ambiente de Homologação (`tpAmb=2`) tem uma base de dados totalmente separada.
* **Porém, em Homologação não há notas reais**: No ambiente de Homologação da SEFAZ **não existem as NF-es reais de compras e vendas da sua empresa** (lá só constam notas de testes técnicos emitidas deliberadamente em homologação). Portanto, para capturar as notas fiscais comerciais reais, a consulta precisa ser mantida em **Produção (`tpAmb=1`)**.

---

### 3. Quantos dias para trás a SEFAZ disponibiliza os XMLs?
* Pela legislação fiscal da SEFAZ Nacional, o WebService `NFeDistribuicaoDFe` mantém disponíveis os documentos emitidos nos **últimos 90 dias** (cerca de 3 meses).
* Documentos anteriores a 90 dias não são mais distribuídos pela fila de NSU da SEFAZ (para esses períodos antigos, a importação no sistema é feita via arquivo SPED Fiscal ou pasta de XMLs em lote).

---

### 💡 Alternativas para consultar agora:

1. **Aguardar a janela de 1 hora da SEFAZ**:
   * Assim que completar 1 hora da tentativa (por volta das 21:36), ao clicar no botão, a SEFAZ responderá com os documentos (`cStat 138 - Documentos localizados`) e atualizará o `ultNSU` automaticamente para que as próximas consultas sejam instantâneas e sem bloqueio.
2. **Consultar por Chave de Acesso (44 dígitos)**:
   * A consulta por Chave de NF-e específica **não sofre a trava de NSU do cStat 656**.
   

Pode ficar 100% tranquilo, **não "lascou tudo" e o sistema não vai ficar bloqueado sempre!** 😄 

Vou te explicar exatamente como a SEFAZ funciona, como configurar novas empresas e como ter múltiplos sistemas sem nenhum conflito:

---

### 1. Posso ter 2 sistemas (ex: ERP interno e o nosso Radar Fiscal) consultando o mesmo CNPJ?
**Sim, com certeza!**
* A SEFAZ **não apaga** os XMLs quando um sistema consulta. Os XMLs dos últimos 90 dias ficam guardados nos servidores da Fazenda para o seu CNPJ.
* Cada sistema mantém o seu próprio controle de `ultNSU`.
* Se o seu ERP já baixou as notas do NSU `0` ao `5000`, o nosso **Radar Fiscal** também consegue baixar do `0` ao `5000` normalmente na primeira carga.

---

### 2. Se a SEFAZ permite buscar do `0`, por que ela bloqueou hoje?
* A SEFAZ **permite** sim começar do `000000000000000` na primeira vez.
* O motivo do bloqueio de hoje foi apenas porque, durante os nossos testes anteriores enquanto ajustávamos os detalhes de certificado e rotas, foram enviadas requisições consecutivas no NSU `0` em um intervalo de poucos minutos.
* Quando a SEFAZ percebe várias chamadas seguidas no NSU `0` em poucos minutos, o mecanismo de segurança dela aciona a trava preventiva de 1 hora.
* **Após essa 1 hora (que já está quase acabando), a SEFAZ libera o CNPJ e a consulta a partir do `0` funciona perfeitamente!**

---

### 3. Como funciona a configuração de uma Empresa Nova no Radar Fiscal?
Para qualquer empresa nova que você cadastrar no sistema, o fluxo é totalmente transparente:
1. **Primeira Consulta (Carga Inicial)**:
   * O sistema envia `ultNSU = 000000000000000`.
   * A SEFAZ responde entregando o primeiro lote (ex: 50 notas) e informa: *"Te entreguei até o NSU 50, o máximo existente é 1200"*.
2. **Sincronização Automática**:
   * O sistema salva `ultNSU = 50` no banco e faz a próxima chamada já pedindo do `50` em diante (`50 -> 100 -> 150... -> 1200`).
3. **Rotina Contínua**:
   * Ao atingir o final da fila (`ultNSU == maxNSU`), todas as notas dos últimos 90 dias já estarão no seu banco de dados.
   * Dali para frente, o sistema **nunca mais consulta do zero**: ele só consulta a partir do último NSU salvo, trazendo apenas as notas novas que forem emitidas no dia a dia, em segundos e sem risco de `cStat 656`.

---

### 4. Eu posso "chutar" um NSU como `000000000001200`?
* **Não é recomendado chutar**, porque:
  * Se você colocar `1200` e o seu NSU na SEFAZ estiver no `300`, a SEFAZ vai dizer que não encontrou nada a partir de `1200`.
  * Se o seu NSU estiver no `5000` e você colocar `1200`, você vai **pular e perder** todas as notas emitidas entre o `0` e o `1199`.

---

### ⏳ O que esperar agora:
Daqui a pouco (por volta das **21:36**, completando a 1h da primeira chamada das 20:36), a SEFAZ destrava o CNPJ no Ambiente de Produção. Ao clicar em **"Buscar Novos XMLs Destinados (NSU)"**, ela começará a descarregar as notas reais!


____

1. Sobre a segurança do Certificado Digital da sua empresa:
Pode ficar 100% despreocupado:

O WebService NFeDistribuicaoDFe é um serviço exclusivamente de LEITURA/CONSULTA da SEFAZ Nacional.
Ele nunca emite, altera, cancela ou interfere em notas fiscais, no faturamento ou nas rotinas do ERP interno da Supergasbras.
De qualquer forma, respeitaremos a sua cautela e não dispararemos nenhuma nova consulta enquanto alinhamos essa questão fundamental das alíquotas.


Vamos esclarecer isso em detalhes! Essa dúvida é extremamente comum e entender como a SEFAZ funciona por trás dos panos vai te dar total domínio sobre o sistema.

---

### 1. O que é o NSU e como funciona o `distNSU`?

Na SEFAZ (Ambiente Nacional), cada nota fiscal emitida contra o seu CNPJ recebe um **NSU (Número Sequencial Único)**, que funciona como uma **esteira rolante numerada**:
* Nota 1 do fornecedor A $\rightarrow$ **NSU 0001**
* Nota 2 do fornecedor B $\rightarrow$ **NSU 0002**
* Cancelamento ou Carta de Correção $\rightarrow$ **NSU 0003**
* ... até a nota de hoje $\rightarrow$ **NSU 5420** (chamado de `maxNSU`)

Quando você usa a consulta por **NSU (`distNSU`)**:
1. O sistema pergunta à SEFAZ: *"SEFAZ, me mande tudo o que chegou para mim a partir do último NSU que consultei (ex: NSU 5000)"*.
2. A SEFAZ responde com **um pacote compactado contendo até 50 documentos de uma vez só** (`cStat 138: Documentos localizados`).
3. Enquanto houver notas na esteira para alcançar o `maxNSU`, você pode continuar puxando pacotes de 50 em 50 **sem limite de 20 notas/hora** — é possível baixar centenas ou milhares de notas!

---

### 2. Por que o NSU gerou rejeição para você anteriormente?

Você teve rejeição no NSU anteriormente por **dois motivos técnicos específicos da regra da SEFAZ**:

#### Motivo A: A esteira estava vazia (`ultNSU == maxNSU`)
* Se o seu sistema consulta o NSU e **não há nenhuma nota nova na fila**, a SEFAZ responde: `cStat 137: Nenhum documento localizado`.
* A regra da SEFAZ diz: *Se você chegou no final da esteira (fila vazia), você é OBRIGADO a esperar no mínimo 1 hora para perguntar de novo*.
* Se você tentar consultar o NSU novamente antes de 1 hora com a esteira já zerada, a SEFAZ pune com o `cStat 656: Consumo Indevido`.

#### Motivo B: Concorrência com o outro sistema de mensageria da sua empresa
* Como você comentou que a sua empresa já possui outro sistema de mensageria/ERP (ex: SAP, Totvs, Oobj), esse outro sistema **já consulta o NSU periodicamente e já consome a esteira**.
* Quando você tentou consultar por NSU a partir do zero (`000000000000000`), a SEFAZ viu que o NSU já estava no final ou que houve consultas concorrentes em curto período.

#### Motivo C: Testes em Homologação
* Em ambiente de Homologação quase não existem notas reais emitidas para o seu CNPJ. A fila fica sempre vazia (`cStat 137`), gerando bloqueio 656 quase imediato ao tentar testar. Em **Produção**, como há compras reais todos os dias, a esteira se movimenta.

---

### 3. Comparativo Definitivo das 3 Formas que você tem no seu sistema:

| Método de Captura | Como Funciona | Vantagens | Limitações da SEFAZ | Para quando usar? |
| :--- | :--- | :--- | :--- | :--- |
| **1. Por Chave de Acesso (`consChNFe`)** | Você informa a chave de 44 dígitos exata da nota. | **Direto e Imediato.** Não depende da fila/esteira de NSU. Baixa a nota completa na hora (como as 21 que você baixou com sucesso!). | A SEFAZ limita a **no máximo 20 consultas por hora** por CNPJ. | Para notas urgentes, conciliações pontuais ou lotes de até 20 notas por hora. |
| **2. Varredura por NSU (`distNSU`)** | Puxa a esteira sequencial de compras da empresa. | Baixa **pacotes de até 50 notas por chamada**, podendo trazer centenas de notas sem a trava de 20/h. | Se a fila estiver vazia (`ultNSU == maxNSU`), deve-se aguardar 1 hora para nova consulta. | Para rotinas de sincronização diária/automática de todas as compras. |
| **3. Upload Direto XML (Contingência)** | Você arrasta os arquivos `.xml` do seu computador. | **100% autônomo.** Não depende de internet, de webservice nem de cotas da SEFAZ. | Requer que você tenha os arquivos `.xml` (enviados por e-mail ou do ERP). | Quando a SEFAZ estiver fora do ar ou com cota bloqueada. |

---

### 💡 Resumo Prático:

* Você **não fez nada de errado**: as **21 notas que você baixou hoje por chave de acesso foram um sucesso total** e já estão salvas na pasta `C:\SEFAZ\XMLs\...` e no banco de dados!
* O bloqueio a partir da nota 22 ocorreu simplesmente porque a SEFAZ tem um "pedágio" que só deixa puxar 20 chaves individuais por hora.
* Para as 6 notas que faltaram: você pode **copiar as 6 pendentes** no botão que criamos e rodar daqui a 1 hora, ou puxar o histórico pelo **NSU** se a sua empresa tiver notas acumuladas na esteira!