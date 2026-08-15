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
    badge: 'Anulação'
  },
  {
    id: 'nfe-110110',
    codigoEvento: '110110',
    nome: 'Carta de Correção Eletrônica (CC-e)',
    descricao: 'Sanar erros em campos específicos da NF-e (que não afetem valores, impostos, dados de emitente/destinatário).',
    tipoDfe: 'NFe',
    categoria: 'emitente',
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
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
    badge: 'Logística'
  },
  {
    id: 'nfe-110140',
    codigoEvento: '110140',
    nome: 'EPEC (Contingência Prevista)',
    descricao: 'Emissão Prévia em Contingência transmitida ao WebService da EPEC em caso de indisponibilidade SEFAZ.',
    tipoDfe: 'NFe',
    categoria: 'contingencia',
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
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
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
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
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
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
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
    badge: 'NT 2025.002-RTC',
    isReformaTributaria: true
  },
  {
    id: 'nfe-112150',
    codigoEvento: '112150',
    nome: 'Atualização da Data de Previsão de Entrega',
    descricao: 'Fornecedor atualiza a data prevista de disponibilização/entrega do bem para ajustar o mês do fato gerador do débito IBS/CBS.',
    tipoDfe: 'NFe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
    badge: 'NT 2025.002-RTC',
    isReformaTributaria: true
  },

  // Eventos Oficiais NT 2025.002-RTC - Destinatário / Adquirente
  {
    id: 'nfe-211110',
    codigoEvento: '211110',
    nome: 'Solicitação de Apropriação de Crédito Presumido',
    descricao: 'Destinatário/Adquirente solicita formalmente à RFB/CGIBS o aproveitamento de crédito presumido de IBS/CBS sobre aquisições de terceiros.',
    tipoDfe: 'NFe',
    categoria: 'reforma_tributaria',
    requerJustificativa: false,
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
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
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
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
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
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
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
    badge: 'Transporte'
  },
  {
    id: 'cte-110110',
    codigoEvento: '110110',
    nome: 'Carta de Correção Eletrônica do CT-e (CC-e CT-e)',
    descricao: 'Correção de dados secundários da prestação de serviço de transporte multimodal/rodoviário.',
    tipoDfe: 'CTe',
    categoria: 'emitente',
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
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
    badge: 'NT 009 NFS-e'
  },
  {
    id: 'nfse-100110',
    codigoEvento: '100110',
    nome: 'Carta de Correção de NFS-e (CC-e NFS-e)',
    descricao: 'Retificação da descrição do serviço ou dados cadastrais sem alteração do valor do ISS/IBS/CBS.',
    tipoDfe: 'NFSe',
    categoria: 'emitente',
    requerJustificativa: true,
    minCaracteresJustificativa: 15,
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
    badge: 'NT 009 NFS-e',
    isReformaTributaria: true
  }
];

export function getEventosPorTipoDfe(tipo: TipoDFe): EventoDfeDefinition[] {
  return CATALOGO_EVENTOS_DFE.filter(
    e => e.tipoDfe === tipo || e.tipoDfe === 'TODOS'
  );
}
