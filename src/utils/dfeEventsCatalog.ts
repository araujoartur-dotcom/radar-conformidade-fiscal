import { EventoDfeDefinition, TipoDFe } from '../types';

export const CATALOGO_EVENTOS_DFE: EventoDfeDefinition[] = [
  // =========================================================================
  // 1. NOTA FISCAL ELETRÔNICA (NF-e - Modelo 55) - NT 2025.002-RTC v1.51
  // =========================================================================
  
  // Manifestações Tradicionais & Governança
  {
    id: 'nfe-210210',
    codigoEvento: '210210',
    nome: 'Ciência da Emissão',
    descricao: 'Declara ciência da NF-e emitida contra seu CNPJ. Permite o download do XML completo na SEFAZ.',
    tipoDfe: 'NFe',
    categoria: 'destinatario',
    requerJustificativa: false,
    tipoPreenchimento: 'nenhum',
    badge: 'Manifestação'
  },
  {
    id: 'nfe-210200',
    codigoEvento: '210200',
    nome: 'Confirmação da Operação',
    descricao: 'Confirma a realização da operação e recebimento das mercadorias, assegurando o direito ao crédito fiscal.',
    tipoDfe: 'NFe',
    categoria: 'destinatario',
    requerJustificativa: false,
    tipoPreenchimento: 'nenhum',
    badge: 'Manifestação'
  },
  {
    id: 'nfe-210220',
    codigoEvento: '210220',
    nome: 'Desconhecimento da Operação',
    descricao: 'Informa à SEFAZ que o CNPJ do destinatário foi utilizado indevidamente pelo emitente sem seu conhecimento.',
    tipoDfe: 'NFe',
    categoria: 'destinatario',
    requerJustificativa: false,
    tipoPreenchimento: 'justificativa',
    justificativasPadrao: [
      'Operação comercial e emissão de documento fiscal totalmente desconhecidas pelo destinatário.',
      'Uso indevido e não autorizado da Inscrição Estadual e do CNPJ da empresa por terceiros emitentes.',
      'Inexistência de qualquer relação comercial, negociação ou solicitação de fornecimento junto ao emitente.',
      'Mercadoria faturada para este CNPJ sem existência de pedido de compra ou contrato de fornecimento vigente.'
    ],
    badge: 'Segurança'
  },
  {
    id: 'nfe-210240',
    codigoEvento: '210240',
    nome: 'Operação não Realizada',
    descricao: 'Informa que a operação física/comercial não ocorreu (devolução, recusa, transporte danificado ou desacordo).',
    tipoDfe: 'NFe',
    categoria: 'destinatario',
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
    tipoPreenchimento: 'justificativa',
    justificativasPadrao: [
      'Mercadoria devolvida integralmente ao transportador no ato da entrega por desacordo comercial com o pedido de compra.',
      'Mercadoria avariada e danificada durante o transporte; recebimento recusado pelo destinatário.',
      'Carga não entregue no estabelecimento destinatário até a presente data, descumprindo o prazo pactuado.',
      'Divergência de preço unitário, quantidade faturada ou condição de pagamento em relação ao pedido aprovado.',
      'Operação comercial cancelada previamente de comum acordo entre emitente e destinatário antes da expedição.'
    ],
    badge: 'Recusa'
  },
  {
    id: 'nfe-110111',
    codigoEvento: '110111',
    nome: 'Cancelamento de NF-e',
    descricao: 'Anulação do documento fiscal autorizado dentro do prazo regulamentar da SEFAZ Estadual.',
    tipoDfe: 'NFe',
    categoria: 'emitente',
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
    tipoPreenchimento: 'justificativa',
    justificativasPadrao: [
      'Emissão em duplicidade para a mesma operação comercial e mesmo destinatário.',
      'Desistência da compra e cancelamento formal da operação comercial a pedido do cliente.',
      'Erro cadastral ou tributário impeditivo que não pode ser sanado por Carta de Correção Eletrônica (CC-e).',
      'Divergência insanável nas condições comerciais, itens faturados ou valores de impostos apurados.',
      'Cancelamento da venda antes da saída física da mercadoria do estabelecimento emitente.'
    ],
    badge: 'Anulação'
  },
  {
    id: 'nfe-110110',
    codigoEvento: '110110',
    nome: 'Carta de Correção Eletrônica (CC-e)',
    descricao: 'Sanar erros em campos específicos da NF-e (que não afetem valores, impostos, dados de emitente/destinatário conforme Art. 58-B SINIEF).',
    tipoDfe: 'NFe',
    categoria: 'emitente',
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
    tipoPreenchimento: 'texto_livre',
    badge: 'Retificação'
  },
  {
    id: 'nfe-110130',
    codigoEvento: '110130',
    nome: 'Comprovante de Entrega da NF-e',
    descricao: 'Registro do canhoto eletrônico contendo data, hora e assinatura do recebedor da mercadoria.',
    tipoDfe: 'NFe',
    categoria: 'emitente',
    requerJustificativa: false,
    tipoPreenchimento: 'nenhum',
    badge: 'Logística'
  },
  {
    id: 'nfe-110140',
    codigoEvento: '110140',
    nome: 'EPEC (Contingência Prévia)',
    descricao: 'Emissão Prévia em Contingência transmitida ao WebService da EPEC em caso de indisponibilidade SEFAZ.',
    tipoDfe: 'NFe',
    categoria: 'contingencia',
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
    tipoPreenchimento: 'justificativa',
    justificativasPadrao: [
      'Indisponibilidade temporária de conexão com os servidores do WebService da SEFAZ de origem.',
      'Falha técnica no link de comunicação e internet local do estabelecimento emissor.',
      'Instabilidade severa com tempo de resposta excedido nos serviços autorizadores da SEFAZ.'
    ],
    badge: 'Offline'
  },

  // Eventos Oficiais NT 2025.002-RTC - Emitente
  {
    id: 'nfe-112110',
    codigoEvento: '112110',
    nome: 'Liberação de Crédito Presumido (Efetivo Pagamento Integral)',
    descricao: 'Emitente informa a quitação integral da operação para autorizar a liberação imediata do crédito presumido ao adquirente (Art. 450 LC 214/25).',
    tipoDfe: 'NFe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    tipoPreenchimento: 'aceite_booleano',
    badge: 'NT 2025.002-RTC',
    isReformaTributaria: true
  },
  {
    id: 'nfe-112120',
    codigoEvento: '112120',
    nome: 'Importação ALC/ZFM Não Convertida em Isenção',
    descricao: 'Informa que a tributação na importação em Área de Livre Comércio / Zona Franca de Manaus não se converteu em isenção por descumprimento de requisitos legais.',
    tipoDfe: 'NFe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    tipoPreenchimento: 'campos_estruturados',
    tipoCamposEstruturados: 'importacao_alc_zfm',
    badge: 'NT 2025.002-RTC',
    isReformaTributaria: true
  },
  {
    id: 'nfe-112130',
    codigoEvento: '112130',
    nome: 'Perecimento, Perda, Roubo/Furto no Transporte (Frete CIF)',
    descricao: 'Emitente/Fornecedor comunica perda, sinistro ou furto de mercadoria durante o frete contratado pelo fornecedor (CIF) antes da entrega.',
    tipoDfe: 'NFe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    tipoPreenchimento: 'campos_estruturados',
    tipoCamposEstruturados: 'perecimento',
    badge: 'NT 2025.002-RTC',
    isReformaTributaria: true
  },
  {
    id: 'nfe-112140',
    codigoEvento: '112140',
    nome: 'Fornecimento Não Realizado com Pagamento Antecipado',
    descricao: 'Emitente da nota de débito de pagamento antecipado informa a não realização da entrega e cancelamento/restituição.',
    tipoDfe: 'NFe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    tipoPreenchimento: 'campos_estruturados',
    tipoCamposEstruturados: 'nao_fornecido',
    badge: 'NT 2025.002-RTC',
    isReformaTributaria: true
  },
  {
    id: 'nfe-112150',
    codigoEvento: '112150',
    nome: 'Atualização da Data de Previsão de Entrega',
    descricao: 'Fornecedor atualiza a data prevista de disponibilização/entrega do bem para ajustar o mês do fato gerador do débito IBS/CBS (tag dPrevEntrega).',
    tipoDfe: 'NFe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    tipoPreenchimento: 'campos_estruturados',
    tipoCamposEstruturados: 'data_entrega',
    badge: 'NT 2025.002-RTC',
    isReformaTributaria: true
  },

  // Eventos Oficiais NT 2025.002-RTC - Destinatário / Adquirente
  {
    id: 'nfe-211110',
    codigoEvento: '211110',
    nome: 'Solicitação de Apropriação de Crédito Presumido',
    descricao: 'Destinatário/Adquirente solicita formalmente à RFB/CGIBS o aproveitamento de crédito presumido de IBS/CBS sobre aquisições de terceiros (Anexo IV cCredPres).',
    tipoDfe: 'NFe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    tipoPreenchimento: 'campos_estruturados',
    tipoCamposEstruturados: 'credito_presumido',
    badge: 'NT 2025.002-RTC',
    isReformaTributaria: true
  },
  {
    id: 'nfe-211124',
    codigoEvento: '211124',
    nome: 'Perecimento, Perda, Roubo/Furto no Transporte (Frete FOB)',
    descricao: 'Adquirente informa sinistro, roubo ou perecimento em trânsito em compras com frete sob sua responsabilidade (FOB).',
    tipoDfe: 'NFe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    tipoPreenchimento: 'campos_estruturados',
    tipoCamposEstruturados: 'perecimento',
    badge: 'NT 2025.002-RTC',
    isReformaTributaria: true
  },
  {
    id: 'nfe-211128',
    codigoEvento: '211128',
    nome: 'Aceite de Débito na Apuração por Emissão de Nota de Crédito',
    descricao: 'Destinatário concorda expressamente com os valores da nota de crédito emitida para lançamento a débito na apuração assistida do IBS/CBS.',
    tipoDfe: 'NFe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    tipoPreenchimento: 'aceite_booleano',
    badge: 'NT 2025.002-RTC',
    isReformaTributaria: true
  },
  {
    id: 'nfe-211130',
    codigoEvento: '211130',
    nome: 'Imobilização de Item (Ativo Imobilizado)',
    descricao: 'Adquirente comunica a integração do bem ao seu Ativo Imobilizado para contagem de prazo e apreciação de ressarcimento (Art. 40 LC 214/25).',
    tipoDfe: 'NFe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    tipoPreenchimento: 'campos_estruturados',
    tipoCamposEstruturados: 'imobilizacao',
    badge: 'NT 2025.002-RTC',
    isReformaTributaria: true
  },
  {
    id: 'nfe-211140',
    codigoEvento: '211140',
    nome: 'Solicitação de Apropriação de Crédito de Combustível',
    descricao: 'Adquirente integrante da cadeia produtiva de combustíveis solicita crédito sobre a parcela consumida em sua atividade comercial (Art. 172 LC 214/25).',
    tipoDfe: 'NFe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    tipoPreenchimento: 'campos_estruturados',
    tipoCamposEstruturados: 'combustivel',
    badge: 'NT 2025.002-RTC',
    isReformaTributaria: true
  },
  {
    id: 'nfe-211150',
    codigoEvento: '211150',
    nome: 'Crédito de Bens/Serviços Vinculados à Atividade Econômica',
    descricao: 'Adquirente requer o aproveitamento de créditos de IBS e CBS para insumos e serviços indispensáveis ao desenvolvimento da atividade empresarial.',
    tipoDfe: 'NFe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    tipoPreenchimento: 'campos_estruturados',
    tipoCamposEstruturados: 'credito_presumido',
    badge: 'NT 2025.002-RTC',
    isReformaTributaria: true
  },

  // Eventos de Sucessão & Fisco (NT 2025.002-RTC)
  {
    id: 'nfe-212110',
    codigoEvento: '212110',
    nome: 'Manifestação sobre Transferência de Crédito IBS (Sucessão)',
    descricao: 'Empresa sucessora manifesta aceite do pedido de transferência de saldo credor acumulado de IBS de empresa sucedida.',
    tipoDfe: 'NFe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    tipoPreenchimento: 'aceite_booleano',
    badge: 'NT 2025.002-RTC',
    isReformaTributaria: true
  },
  {
    id: 'nfe-212120',
    codigoEvento: '212120',
    nome: 'Manifestação sobre Transferência de Crédito CBS (Sucessão)',
    descricao: 'Empresa sucessora manifesta aceite do pedido de transferência de saldo credor acumulado de CBS de empresa sucedida.',
    tipoDfe: 'NFe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    tipoPreenchimento: 'aceite_booleano',
    badge: 'NT 2025.002-RTC',
    isReformaTributaria: true
  },
  {
    id: 'nfe-412120',
    codigoEvento: '412120',
    nome: 'Manifestação do Fisco sobre Transferência de Crédito IBS',
    descricao: 'Decisão do Fisco Estadual/Comitê Gestor homologando ou indeferindo transferência de saldo credor de IBS.',
    tipoDfe: 'NFe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    tipoPreenchimento: 'aceite_booleano',
    badge: 'Fisco / CGIBS',
    isReformaTributaria: true
  },
  {
    id: 'nfe-412130',
    codigoEvento: '412130',
    nome: 'Manifestação do Fisco sobre Transferência de Crédito CBS',
    descricao: 'Decisão do Fisco Federal / Receita Federal homologando ou indeferindo transferência de saldo credor de CBS.',
    tipoDfe: 'NFe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    tipoPreenchimento: 'aceite_booleano',
    badge: 'Fisco / RFB',
    isReformaTributaria: true
  },
  {
    id: 'nfe-110001',
    codigoEvento: '110001',
    nome: 'Cancelamento Genérico de Evento RTC',
    descricao: 'Cancelamento de qualquer evento anteriormente homologado no âmbito da Reforma Tributária.',
    tipoDfe: 'NFe',
    categoria: 'reforma_tributaria',
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
    tipoPreenchimento: 'justificativa',
    justificativasPadrao: [
      'Cancelamento de evento homologado indevidamente por retificação de dados da apuração assistida.',
      'Ajuste cadastral de crédito presumido após conciliação contábil e patrimonial da empresa.',
      'Cancelamento solicitado após conferência física de estoque e desembaraço de mercadorias.'
    ],
    badge: 'NT 2025.002-RTC',
    isReformaTributaria: true
  },

  // =========================================================================
  // 2. NOTA FISCAL DE CONSUMIDOR (NFC-e - Modelo 65) - NT 2025.002-RTC v1.51
  // =========================================================================
  {
    id: 'nfce-110111',
    codigoEvento: '110111',
    nome: 'Cancelamento de NFC-e',
    descricao: 'Cancelamento imediato de cupom fiscal eletrônico no varejo (prazo reduzido SEFAZ de 30 min / 24 hrs).',
    tipoDfe: 'NFCe',
    categoria: 'emitente',
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
    tipoPreenchimento: 'justificativa',
    justificativasPadrao: [
      'Cancelamento da venda no PDV por desistência do consumidor antes da retirada do produto.',
      'Erro na digitação de itens, quantidades ou forma de pagamento selecionada no caixa.',
      'Emissão duplicada de cupom fiscal para a mesma operação no ponto de venda.'
    ],
    badge: 'Varejo'
  },
  {
    id: 'nfce-110150',
    codigoEvento: '110150',
    nome: 'Substituição em Contingência NFC-e',
    descricao: 'Sincronização pós-offline de NFC-e emitidas em ambiente sem internet no PDV.',
    tipoDfe: 'NFCe',
    categoria: 'contingencia',
    requerJustificativa: false,
    tipoPreenchimento: 'nenhum',
    badge: 'PDV Offline'
  },
  {
    id: 'nfce-110160',
    codigoEvento: '110160',
    nome: 'Vincular CPF/CNPJ Consumidor Pós-Venda',
    descricao: 'Inclusão do documento do consumidor após o encerramento do cupom para nota fiscal paulista/gaúcha.',
    tipoDfe: 'NFCe',
    categoria: 'emitente',
    requerJustificativa: false,
    tipoPreenchimento: 'nenhum',
    badge: 'Consumidor'
  },
  {
    id: 'nfce-990200',
    codigoEvento: '990200',
    nome: 'Registro de Cashback CBS / IBS (Consumidor Final)',
    descricao: 'Devolução de imposto para famílias cadastradas nos programas de proteção social (Cashback Cidadão LC 214/25).',
    tipoDfe: 'NFCe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    tipoPreenchimento: 'nenhum',
    badge: 'Cashback Cidadão',
    isReformaTributaria: true
  },
  {
    id: 'nfce-990210',
    codigoEvento: '990210',
    nome: 'Estorno de Cashback em Devolução de Mercadoria',
    descricao: 'Anulação proporcional do benefício de cashback CBS/IBS devido à troca ou devolução de item no PDV.',
    tipoDfe: 'NFCe',
    categoria: 'reforma_tributaria',
    requerJustificativa: true,
    minCaracteresJustificativa: 10,
    tipoPreenchimento: 'justificativa',
    justificativasPadrao: [
      'Estorno integral de cashback em decorrência da devolução total de mercadoria pelo consumidor.',
      'Estorno proporcional de benefício tributário por troca parcial de itens adquiridos no cupom fiscal.'
    ],
    badge: 'NT 2025.002-RTC',
    isReformaTributaria: true
  },

  // =========================================================================
  // 3. CONHECIMENTO DE TRANSPORTE (CT-e / CT-e OS - Mod. 57/67) - NT 2025.001-RTC v1.14a
  // =========================================================================
  {
    id: 'cte-610110',
    codigoEvento: '610110',
    nome: 'Prestação de Serviço em Desacordo',
    descricao: 'Evento emitido obrigatoriamente pelo Tomador do Serviço informando desacordo para autorizar a substituição do CT-e (NT 2025.001-RTC).',
    tipoDfe: 'CTe',
    categoria: 'tomador',
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
    tipoPreenchimento: 'justificativa',
    justificativasPadrao: [
      'Valor do frete cobrado em desacordo com a tabela tarifária e proposta comercial formalizada.',
      'Tomador do serviço de transporte indicado incorretamente no Conhecimento de Transporte Eletrônico.',
      'Divergência de endereço de coleta, trajeto ou município de encerramento da prestação do frete.',
      'Cobrança indevida de taxas acessórias de estadia, pedágio ou seguro não contratadas previamente.',
      'Carga transportada em condições inadequadas com avarias físicas relatadas no destino.'
    ],
    badge: 'NT 2025.001-RTC'
  },
  {
    id: 'cte-610111',
    codigoEvento: '610111',
    nome: 'Cancelamento da Prestação em Desacordo',
    descricao: 'Anulação do evento de desacordo pelo tomador após renegociação do valor ou rota do frete.',
    tipoDfe: 'CTe',
    categoria: 'tomador',
    requerJustificativa: false,
    tipoPreenchimento: 'nenhum',
    badge: 'NT 2025.001-RTC'
  },
  {
    id: 'cte-110111',
    codigoEvento: '110111',
    nome: 'Cancelamento do CT-e',
    descricao: 'Anulação do conhecimento de transporte antes de iniciada a prestação do serviço de frete.',
    tipoDfe: 'CTe',
    categoria: 'emitente',
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
    tipoPreenchimento: 'justificativa',
    justificativasPadrao: [
      'Cancelamento da prestação de serviço de transporte por desistência formal do embarcador antes do início da viagem.',
      'Erro no preenchimento de dados do tomador do serviço ou nos valores da prestação que impedem a emissão de CC-e.',
      'Emissão incorreta do modal ou tipo de serviço de transporte.'
    ],
    badge: 'Transporte'
  },
  {
    id: 'cte-110110',
    codigoEvento: '110110',
    nome: 'Carta de Correção Eletrônica do CT-e (CC-e CT-e)',
    descricao: 'Correção de dados secundários da prestação de serviço de transporte multimodal/rodoviário (sem alterar tomador, valores ou tributos).',
    tipoDfe: 'CTe',
    categoria: 'emitente',
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
    tipoPreenchimento: 'texto_livre',
    badge: 'Retificação'
  },
  {
    id: 'cte-110180',
    codigoEvento: '110180',
    nome: 'Comprovante de Entrega do CT-e',
    descricao: 'Confirmação física com foto/geolocalização e data da entrega da carga no destino final.',
    tipoDfe: 'CTe',
    categoria: 'emitente',
    requerJustificativa: false,
    tipoPreenchimento: 'nenhum',
    badge: 'Logística'
  },
  {
    id: 'cte-990300',
    codigoEvento: '990300',
    nome: 'Apontamento CBS/IBS Frete (Compras Governamentais & Redução)',
    descricao: 'Dedução / redução de alíquotas e rateio do IBS/CBS por município de término da prestação de frete (gCompraGov/tpOperGov).',
    tipoDfe: 'CTe',
    categoria: 'reforma_tributaria',
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
    tipoPreenchimento: 'justificativa',
    justificativasPadrao: [
      'Adequação de alíquota efetiva para fornecimento a órgão governamental conforme Art. 472 da LC 214/2025.',
      'Apontamento de fornecimento de transporte com pagamento posterior ao ente público (tpOperGov=1).',
      'Rateio do IBS de acordo com o município de término da prestação do serviço de frete interestadual.'
    ],
    badge: 'NT 2025.001-RTC',
    isReformaTributaria: true
  },
  {
    id: 'cte-990310',
    codigoEvento: '990310',
    nome: 'Crédito IBS/CBS em Subcontratação e Redespacho',
    descricao: 'Geração e apropriação do crédito de IBS e CBS na cadeia de subcontratação e redespacho multimodal.',
    tipoDfe: 'CTe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    tipoPreenchimento: 'nenhum',
    badge: 'NT 2025.001-RTC',
    isReformaTributaria: true
  },

  // =========================================================================
  // 4. NOTA FISCAL DE SERVIÇOS ELETRÔNICA (NFS-e) - Nota Técnica nº 009 NFS-e
  // =========================================================================
  {
    id: 'nfse-200100',
    codigoEvento: '200100',
    nome: 'Aceite de NFS-e (Tomador de Serviços)',
    descricao: 'Aceite expresso pelo tomador autorizando a medição, apropriação de crédito e o pagamento do serviço.',
    tipoDfe: 'NFSe',
    categoria: 'tomador',
    requerJustificativa: false,
    tipoPreenchimento: 'aceite_booleano',
    badge: 'NT 009 NFS-e'
  },
  {
    id: 'nfse-200200',
    codigoEvento: '200200',
    nome: 'Rejeição / Contestação de NFS-e',
    descricao: 'Impugnação da NFS-e pelo tomador por divergência no contrato, medição ou alíquotas retidas de CBS/IBS.',
    tipoDfe: 'NFSe',
    categoria: 'tomador',
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
    tipoPreenchimento: 'justificativa',
    justificativasPadrao: [
      'Serviço não executado ou medição técnica reprovada pela fiscalização do contrato.',
      'Divergência no enquadramento de alíquotas ou valor de retenção na fonte de ISS, IBS ou CBS.',
      'Faturamento emitido sem a prévia autorização de medição, ordem de serviço ou contrato vigente.',
      'Cobrança em duplicidade referente a serviço já faturado em nota fiscal anterior.'
    ],
    badge: 'NT 009 NFS-e'
  },
  {
    id: 'nfse-100100',
    codigoEvento: '100100',
    nome: 'Cancelamento por Substituição de NFS-e',
    descricao: 'Anulação da NFS-e atual com vínculo automático à nova NFS-e substituta gerada na praça municipal/nacional.',
    tipoDfe: 'NFSe',
    categoria: 'emitente',
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
    tipoPreenchimento: 'justificativa',
    justificativasPadrao: [
      'Substituição de NFS-e para retificação de dados cadastrais do tomador e enquadramento tributário municipal.',
      'Emissão de nova NFS-e substituta para ajuste de competência e retenções na fonte de IBS/CBS.',
      'Substituição da nota fiscal por acordo mútuo entre as partes para alteração de itens de serviço contratados.'
    ],
    badge: 'NT 009 NFS-e'
  },
  {
    id: 'nfse-100110',
    codigoEvento: '100110',
    nome: 'Carta de Correção de NFS-e (CC-e NFS-e)',
    descricao: 'Retificação da descrição complementar do serviço ou dados cadastrais sem alteração da base de cálculo do ISS/IBS/CBS.',
    tipoDfe: 'NFSe',
    categoria: 'emitente',
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
    tipoPreenchimento: 'texto_livre',
    badge: 'Retificação'
  },
  {
    id: 'nfse-990400',
    codigoEvento: '990400',
    nome: 'Retenção Unificada CBS / IBS na Fonte (Serviços NT 009)',
    descricao: 'Registro do recolhimento de CBS e IBS retidos pelo tomador do serviço no padrão nacional ABRASF.',
    tipoDfe: 'NFSe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    tipoPreenchimento: 'nenhum',
    badge: 'NT 009 NFS-e',
    isReformaTributaria: true
  },
  {
    id: 'nfse-990410',
    codigoEvento: '990410',
    nome: 'Apontamento de Isenção / Alíquota Reduzida CBS/IBS (Serviços)',
    descricao: 'Registro do enquadramento em alíquota reduzida da Reforma Tributária (Saúde, Educação, Atividades Culturais e Sociedades de Profissões Regulamentadas).',
    tipoDfe: 'NFSe',
    categoria: 'reforma_tributaria',
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
    tipoPreenchimento: 'justificativa',
    justificativasPadrao: [
      'Enquadramento da prestação de serviço de saúde humana em alíquota reduzida de 60% conforme LC 214/2025.',
      'Enquadramento de serviços de educação regular e superior em regime de redução de alíquota de IBS/CBS.',
      'Sociedade de profissionais regulamentados conforme regimes favorecidos da Reforma Tributária.'
    ],
    badge: 'NT 009 NFS-e',
    isReformaTributaria: true
  }
];

export function getEventosPorTipoDfe(tipo: TipoDFe): EventoDfeDefinition[] {
  return CATALOGO_EVENTOS_DFE.filter(
    e => e.tipoDfe === tipo || e.tipoDfe === 'TODOS'
  );
}
