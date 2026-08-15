import * as XLSX from 'xlsx';
import { XmlItemDetailReport, MapaCfopItem, MapaCClassTribItem, ReportFilterState } from '../types';

/**
 * Initial Governance Map for CFOPs (#6)
 */
export const INITIAL_MAPA_CFOP: MapaCfopItem[] = [
  {
    cfop: '1102',
    descricao: 'Compra para comercialização (Estado)',
    categoria: 'Compra',
    tratamentoPadrao: 'Elegível',
    exigeOnerosidade: true,
    exigeValidaçãoCClassTrib: true,
    evidenciaMinima: 'XML NF-e com Chave Válida + GRN Recebimento'
  },
  {
    cfop: '2102',
    descricao: 'Compra para comercialização (Outro Estado)',
    categoria: 'Compra',
    tratamentoPadrao: 'Elegível',
    exigeOnerosidade: true,
    exigeValidaçãoCClassTrib: true,
    evidenciaMinima: 'XML NF-e com Chave Válida + Conhecimento de Frete CT-e'
  },
  {
    cfop: '1551',
    descricao: 'Compra de bem para o ativo imobilizado',
    categoria: 'Compra',
    tratamentoPadrao: 'Elegível',
    exigeOnerosidade: true,
    exigeValidaçãoCClassTrib: true,
    evidenciaMinima: 'Fatura de Ativo + Laudo de CIAP/Apropriacao'
  },
  {
    cfop: '1910',
    descricao: 'Entrada de bonificação, doação ou brinde',
    categoria: 'Remessa',
    tratamentoPadrao: 'Não elegível',
    exigeOnerosidade: true,
    exigeValidaçãoCClassTrib: true,
    evidenciaMinima: 'Nota Fiscal de Bonificação (Verificar Regra Específica)'
  },
  {
    cfop: '1915',
    descricao: 'Entrada de mercadoria em conserto ou reparo',
    categoria: 'Remessa',
    tratamentoPadrao: 'Não elegível',
    exigeOnerosidade: true,
    exigeValidaçãoCClassTrib: false,
    evidenciaMinima: 'Ordem de Serviço / Remessa para Conserto'
  },
  {
    cfop: '1202',
    descricao: 'Devolução de venda de mercadoria adquirida',
    categoria: 'Devolução',
    tratamentoPadrao: 'Depende',
    exigeOnerosidade: true,
    exigeValidaçãoCClassTrib: true,
    evidenciaMinima: 'NF-e de Devolução Espelho com Chave da Origem'
  },
  {
    cfop: '1352',
    descricao: 'Aquisição de serviço de transporte por estabelecimento industrial',
    categoria: 'Compra',
    tratamentoPadrao: 'Elegível',
    exigeOnerosidade: true,
    exigeValidaçãoCClassTrib: true,
    evidenciaMinima: 'CT-e Vinculado à Nota Fiscal de Mercadoria'
  }
];

/**
 * Initial Governance Map for cClassTrib (#7)
 */
export const INITIAL_MAPA_CCLASSTRIB: MapaCClassTribItem[] = [
  {
    cClassTrib: '0001',
    descricaoInterna: 'Operação Tributada Integralmente IBS/CBS',
    tratamentoEsperado: 'tributado',
    permiteCredito: 'Sim',
    aliquotaEsperada: '26.5% (8.8% CBS + 17.7% IBS)',
    alertas: 'Verificar se houver destaque zerado em documento tributado.'
  },
  {
    cClassTrib: '1001',
    descricaoInterna: 'Alíquota Reduzida de Cesta Básica / Saúde',
    tratamentoEsperado: 'aliquota_reduzida',
    permiteCredito: 'Sim',
    aliquotaEsperada: '10.6% (60% de Redução IBS/CBS)',
    alertas: 'Conferir enquadramento NCM na lista anexa do regulamento.'
  },
  {
    cClassTrib: '2001',
    descricaoInterna: 'Isenção / Imunidade Constitucional',
    tratamentoEsperado: 'isento',
    permiteCredito: 'Não',
    aliquotaEsperada: '0.00%',
    alertas: 'Crédito bloqueado por ausência de incidência na entrada.'
  },
  {
    cClassTrib: '3001',
    descricaoInterna: 'Não Incidência / Exportação',
    tratamentoEsperado: 'nao_incidencia',
    permiteCredito: 'Não',
    aliquotaEsperada: '0.00%',
    alertas: 'Não gera crédito de entrada.'
  },
  {
    cClassTrib: '9001',
    descricaoInterna: 'Regime Específico Monofásico (Combustíveis/Bebidas)',
    tratamentoEsperado: 'monofasico',
    permiteCredito: 'Depende',
    aliquotaEsperada: 'Alíquota Ad Valorem Específica',
    alertas: 'Exige regra de diferimento e retenção na origem.'
  }
];

/**
 * Initial Detailed Item-by-Item Data Repository (#1 - #8)
 * XMLs captured from NFe Web Services & Root CNPJ directories
 */
export const INITIAL_XML_ITEM_REPORTS: XmlItemDetailReport[] = [
  {
    id: 'item-001-1',
    empresaCnpj: '00.000.000/0001-91',
    empresaNome: 'BANCO DO BRASIL SA (MATRIZ CCC)',
    tipoDoc: 'NF-e',
    chaveAcesso: '3526081721307100017555001000083220810012001',
    numeroSerie: '104892 / 1',
    dataEmissao: '2026-07-28',
    dataEntrada: '2026-07-29',
    competencia: '2026-07',
    fornecedorCnpj: '17.213.071/0001-75',
    fornecedorRazao: 'ASSOCIACAO DOS MORADORES DO EDIFICIO COSTA VERDE',
    fornecedorUf: 'DF',
    fornecedorMunicipio: 'BRASILIA',
    clienteCnpj: '00.000.000/0001-91',
    clienteRazao: 'BANCO DO BRASIL SA',
    clienteUf: 'DF',
    situacaoDoc: 'autorizado',
    itemNro: 1,
    descricaoItem: 'SERVICOS E SUPRIMENTOS DE MANUTENCAO PREDIAL E FISCAL',
    ncm: '84713019',
    cfop: '1102',
    cClassTrib: '0001',
    cstCsosn: '00',
    naturezaOperacao: 'COMPRA PARA COMERCIALIZACAO',
    quantidade: 10,
    unidade: 'UN',
    valorBrutoItem: 28450.00,
    descontoIncondicional: 0,
    freteSeguroRateado: 0,
    valorLiquidoItem: 28450.00,
    baseIbs: 28450.00,
    aliquotaIbs: 17.70,
    valorIbs: 5035.65,
    baseCbs: 28450.00,
    aliquotaCbs: 8.80,
    valorCbs: 2503.60,
    creditoEsperadoIbs: 5035.65,
    creditoEsperadoCbs: 2503.60,
    creditoApropriadoIbs: 5035.65,
    creditoApropriadoCbs: 2503.60,
    diferencaCreditoIbs: 0,
    diferencaCreditoCbs: 0,
    fonteAliquota: 'documento',
    indicadorOnerosidade: 'Oneroso',
    criterioOnerosidade: 'ValorLíquidoItem > 0 e Fatura Comercial vinculada',
    evidenciaCobranca: true,
    tipoAquisicao: 'insumo',
    destinacao: 'atividade_tributada',
    regraAplicadaId: 'ELEG_001',
    resultadoElegibilidade: 'Elegível',
    motivoPadronizado: 'Compra de insumo com documento idôneo e oneroso',
    evidencia: 'XML NFe e Chave Validada SEFAZ DF',
    pedidoContrato: 'PO-2026-991',
    recebimentoGrn: 'GRN-3001',
    lancamentoContabil: 'Conta 1.1.03.01 - Insumos',
    usuarioCaptura: 'AUTOMACAO_WEBSERVICE',
    rotinaCaptura: 'CRON_NFE_DISTRIBUICAO_DFE',
    isExcecao: false,
    creditoOriginalTotal: 7539.25,
    creditoEstornadoTotal: 0,
    temEventoAfetaCredito: false
  },
  {
    id: 'item-002-1',
    empresaCnpj: '33.000.167/0001-01',
    empresaNome: 'PETROLEO BRASILEIRO S A PETROBRAS',
    tipoDoc: 'NF-e',
    chaveAcesso: '3326083300016700010155001000099882211009802',
    numeroSerie: '542100 / 3',
    dataEmissao: '2026-07-30',
    dataEntrada: '2026-07-31',
    competencia: '2026-07',
    fornecedorCnpj: '33.000.167/0001-01',
    fornecedorRazao: 'PETROLEO BRASILEIRO S A PETROBRAS',
    fornecedorUf: 'RJ',
    fornecedorMunicipio: 'RIO DE JANEIRO',
    clienteCnpj: '60.701.190/0001-04',
    clienteRazao: 'ITAU UNIBANCO S.A.',
    clienteUf: 'SP',
    situacaoDoc: 'autorizado',
    itemNro: 1,
    descricaoItem: 'EQUIPAMENTOS INDUSTRIAIS TURBINAS DE REFINO - SERIE A1',
    ncm: '84118200',
    cfop: '1551',
    cClassTrib: '0001',
    cstCsosn: '00',
    naturezaOperacao: 'AQUISICAO DE BEM PARA O ATIVO IMOBILIZADO',
    quantidade: 1,
    unidade: 'UN',
    valorBrutoItem: 185000.00,
    descontoIncondicional: 5000.00,
    freteSeguroRateado: 2000.00,
    valorLiquidoItem: 182000.00,
    baseIbs: 182000.00,
    aliquotaIbs: 17.70,
    valorIbs: 32214.00,
    baseCbs: 182000.00,
    aliquotaCbs: 8.80,
    valorCbs: 16016.00,
    creditoEsperadoIbs: 32214.00,
    creditoEsperadoCbs: 16016.00,
    creditoApropriadoIbs: 30000.00, // Divergência para auditoria!
    creditoApropriadoCbs: 15000.00,
    diferencaCreditoIbs: 2214.00,
    diferencaCreditoCbs: 1016.00,
    fonteAliquota: 'documento',
    motivoDiferenca: 'Rateio parcial de CIAP no SAP S/4HANA (48 avos)',
    indicadorOnerosidade: 'Oneroso',
    criterioOnerosidade: 'ValorLíquidoItem > 0 e Contrato de Fornecimento B2B',
    evidenciaCobranca: true,
    tipoAquisicao: 'imobilizado',
    destinacao: 'ativo',
    regraAplicadaId: 'ELEG_015',
    resultadoElegibilidade: 'Elegível',
    motivoPadronizado: 'Ativo imobilizado gerador de crédito em 1/48 avos por competência',
    evidencia: 'Laudo Técnico CIAP + Fatura SAP PRD-100',
    pedidoContrato: 'SAP-4500129811',
    recebimentoGrn: 'GRN-88201',
    lancamentoContabil: 'Conta 1.2.01.02 - Ativo Fixo',
    usuarioCaptura: 'S4HANA_RFC_CONNECTOR',
    rotinaCaptura: 'SAP_BAPI_NFE_READ',
    isExcecao: true,
    tipoExcecao: 'Divergência Tributo Destacado x Apropriado SAP',
    detalheExcecao: 'Diferença de R$ 3.230,00 entre crédito esperado e apropriado na conta ERP.',
    statusSaneamento: 'em_analise',
    creditoOriginalTotal: 48230.00,
    creditoEstornadoTotal: 0,
    temEventoAfetaCredito: false
  },
  {
    id: 'item-003-1',
    empresaCnpj: '17.213.071/0001-75',
    empresaNome: 'ASSOCIACAO DOS MORADORES DO EDIFICIO COSTA VERDE',
    tipoDoc: 'NFS-e',
    chaveAcesso: '3526086070119000010455001000012345678901234',
    numeroSerie: '9811 / E',
    dataEmissao: '2026-08-01',
    dataEntrada: '2026-08-01',
    competencia: '2026-08',
    fornecedorCnpj: '60.701.190/0001-04',
    fornecedorRazao: 'ITAU UNIBANCO S.A.',
    fornecedorUf: 'SP',
    fornecedorMunicipio: 'SAO PAULO',
    clienteCnpj: '17.213.071/0001-75',
    clienteRazao: 'ASSOCIACAO DOS MORADORES DO EDIFICIO COSTA VERDE',
    clienteUf: 'DF',
    situacaoDoc: 'autorizado',
    itemNro: 1,
    descricaoItem: 'SERVICOS DE CONSULTORIA E GESTAO DE TESOURARIA BANCARIA',
    ncm: 'NBS-10293',
    cfop: '1352',
    cClassTrib: '0001',
    cstCsosn: '00',
    naturezaOperacao: 'PRESTACAO DE SERVICOS TRIBUTADOS',
    quantidade: 1,
    unidade: 'SV',
    valorBrutoItem: 4200.00,
    descontoIncondicional: 0,
    freteSeguroRateado: 0,
    valorLiquidoItem: 4200.00,
    baseIbs: 4200.00,
    aliquotaIbs: 17.70,
    valorIbs: 743.40,
    baseCbs: 4200.00,
    aliquotaCbs: 8.80,
    valorCbs: 369.60,
    creditoEsperadoIbs: 743.40,
    creditoEsperadoCbs: 369.60,
    creditoApropriadoIbs: 0,
    creditoApropriadoCbs: 0,
    diferencaCreditoIbs: 743.40,
    diferencaCreditoCbs: 369.60,
    fonteAliquota: 'documento',
    motivoDiferenca: 'Serviço financeiro com retenção pendente de homologação',
    indicadorOnerosidade: 'Oneroso',
    criterioOnerosidade: 'ValorLíquidoItem > 0',
    evidenciaCobranca: true,
    tipoAquisicao: 'servico',
    destinacao: 'uso_consumo',
    regraAplicadaId: 'ELEG_004',
    resultadoElegibilidade: 'Pendente',
    motivoPadronizado: 'Falta validação de cClassTrib e retenção de ISS/CBS',
    evidencia: 'RPS Prefeitura de SP',
    pedidoContrato: 'CTR-2026-SP',
    recebimentoGrn: 'GRN-SV-09',
    lancamentoContabil: 'Conta 3.1.02.04 - Serviços de Terceiros',
    usuarioCaptura: 'WEBSERVICE_NFSE_SP',
    rotinaCaptura: 'CAPTURA_MUNICIPAL',
    isExcecao: true,
    tipoExcecao: 'cClassTrib Incompleto / Incompatível em Serviços',
    detalheExcecao: 'Nota de Serviço sem enquadramento tributário completo no XML municipal.',
    statusSaneamento: 'pendente',
    creditoOriginalTotal: 1113.00,
    creditoEstornadoTotal: 0,
    temEventoAfetaCredito: false
  },
  {
    id: 'item-004-1',
    empresaCnpj: '33.000.167/0001-01',
    empresaNome: 'PETROLEO BRASILEIRO S A PETROBRAS',
    tipoDoc: 'CT-e',
    chaveAcesso: '4126084750841100015657001000045612310010044',
    numeroSerie: '45612 / 1',
    dataEmissao: '2026-07-29',
    dataEntrada: '2026-07-30',
    competencia: '2026-07',
    fornecedorCnpj: '47.508.411/0001-56',
    fornecedorRazao: 'LOGISTICA E TRANSPORTES EXPRES S.A.',
    fornecedorUf: 'PR',
    fornecedorMunicipio: 'CURITIBA',
    clienteCnpj: '33.000.167/0001-01',
    clienteRazao: 'PETROLEO BRASILEIRO S A PETROBRAS',
    clienteUf: 'RJ',
    situacaoDoc: 'autorizado',
    itemNro: 1,
    descricaoItem: 'FRETE RODOVIARIO INTERESTADUAL DE INSUMOS E PEÇAS',
    ncm: 'NBS-2001',
    cfop: '2102',
    cClassTrib: '0001',
    cstCsosn: '00',
    naturezaOperacao: 'TRANSPORTE INTERESTADUAL DE CARGAS',
    quantidade: 1,
    unidade: 'CT',
    valorBrutoItem: 12800.00,
    descontoIncondicional: 0,
    freteSeguroRateado: 0,
    valorLiquidoItem: 12800.00,
    baseIbs: 12800.00,
    aliquotaIbs: 17.70,
    valorIbs: 2265.60,
    baseCbs: 12800.00,
    aliquotaCbs: 8.80,
    valorCbs: 1126.40,
    creditoEsperadoIbs: 2265.60,
    creditoEsperadoCbs: 1126.40,
    creditoApropriadoIbs: 2265.60,
    creditoApropriadoCbs: 1126.40,
    diferencaCreditoIbs: 0,
    diferencaCreditoCbs: 0,
    fonteAliquota: 'documento',
    indicadorOnerosidade: 'Oneroso',
    criterioOnerosidade: 'CT-e vinculado à NF-e de entrada de insumos',
    evidenciaCobranca: true,
    tipoAquisicao: 'frete',
    destinacao: 'atividade_tributada',
    regraAplicadaId: 'ELEG_002',
    resultadoElegibilidade: 'Elegível',
    motivoPadronizado: 'Frete sobre aquisição creditável tomador do serviço',
    evidencia: 'CT-e autorizado e vinculado no DACTE',
    pedidoContrato: 'CTR-FRETE-900',
    recebimentoGrn: 'ROMANEIO-4482',
    lancamentoContabil: 'Conta 1.1.03.02 - Fretes sobre Compras',
    usuarioCaptura: 'AUTOMACAO_WEBSERVICE',
    rotinaCaptura: 'CRON_CTE_DISTRIBUICAO',
    isExcecao: false,
    creditoOriginalTotal: 3392.00,
    creditoEstornadoTotal: 0,
    temEventoAfetaCredito: false
  },
  {
    id: 'item-005-1',
    empresaCnpj: '00.000.000/0001-91',
    empresaNome: 'BANCO DO BRASIL SA (MATRIZ CCC)',
    tipoDoc: 'NF-e',
    chaveAcesso: '3526081234567800019055001000077665510022334',
    numeroSerie: '1290 / 1',
    dataEmissao: '2026-07-25',
    dataEntrada: '2026-07-26',
    competencia: '2026-07',
    fornecedorCnpj: '12.345.678/0001-90',
    fornecedorRazao: 'DISTRIBUIDORA DE MATERIAL AMSTRAD LTDA',
    fornecedorUf: 'SP',
    fornecedorMunicipio: 'CAMPINAS',
    clienteCnpj: '00.000.000/0001-91',
    clienteRazao: 'BANCO DO BRASIL SA',
    clienteUf: 'DF',
    situacaoDoc: 'cancelado', // Documento Cancelado!
    itemNro: 1,
    descricaoItem: 'KITS DE AMOSTRAS GRATUITAS E BRINDES CORPORATIVOS',
    ncm: '39269090',
    cfop: '1910', // Remessa/Bonificação
    cClassTrib: '2001', // Isento/Não On
    cstCsosn: '40',
    naturezaOperacao: 'REMESSA EM BONIFICACAO OU BRINDE',
    quantidade: 50,
    unidade: 'UN',
    valorBrutoItem: 1500.00,
    descontoIncondicional: 1500.00,
    freteSeguroRateado: 0,
    valorLiquidoItem: 0.00, // Não Oneroso
    baseIbs: 0,
    aliquotaIbs: 0,
    valorIbs: 0,
    baseCbs: 0,
    aliquotaCbs: 0,
    valorCbs: 0,
    creditoEsperadoIbs: 0,
    creditoEsperadoCbs: 0,
    creditoApropriadoIbs: 265.50, // Erro: Apropriado indevidamente!
    creditoApropriadoCbs: 132.00,
    diferencaCreditoIbs: -265.50,
    diferencaCreditoCbs: -132.00,
    fonteAliquota: 'tabela_interna',
    motivoDiferenca: 'Documento Cancelado com estorno de crédito pendente no ERP',
    indicadorOnerosidade: 'Não Oneroso',
    criterioOnerosidade: 'ValorLíquidoItem = 0 e CFOP de bonificação/amostra',
    evidenciaCobranca: false,
    tipoAquisicao: 'revenda',
    destinacao: 'uso_consumo',
    regraAplicadaId: 'ELEG_099',
    resultadoElegibilidade: 'Não elegível',
    motivoPadronizado: 'CFOP de remessa não onerosa + NF-e Cancelada na SEFAZ',
    evidencia: 'Evento de Cancelamento idProc 110111',
    pedidoContrato: 'S/N',
    recebimentoGrn: 'S/N',
    lancamentoContabil: 'Ajuste Manual Pendente',
    usuarioCaptura: 'AUDITORIA_EVENTOS',
    rotinaCaptura: 'JOB_CANCELAMENTO_NFE',
    isExcecao: true,
    tipoExcecao: 'Documento Cancelado / Crédito Não Estornado',
    detalheExcecao: 'NF-e foi cancelada pelo emitente após autorização. O crédito lançado no ERP deve ser estornado imediatamente.',
    statusSaneamento: 'pendente',
    creditoOriginalTotal: 397.50,
    creditoEstornadoTotal: 0,
    temEventoAfetaCredito: true,
    tipoEventoAfetaCredito: 'Cancelamento',
    chaveDocOriginal: '3526081234567800019055001000077665510022334',
    chaveDocEvento: '35260812345678000190110111000077665510022334',
    dataEventoAfetaCredito: '2026-07-27',
    usuarioAprovacaoEvento: 'AGUARDANDO_WORKFLOW'
  },
  {
    id: 'item-006-1',
    empresaCnpj: '17.213.071/0001-75',
    empresaNome: 'ASSOCIACAO DOS MORADORES DO EDIFICIO COSTA VERDE',
    tipoDoc: 'NF-e',
    chaveAcesso: '3526081721307100017555001000099887766554433',
    numeroSerie: '302 / 1',
    dataEmissao: '2026-07-15',
    dataEntrada: '2026-07-16',
    competencia: '2026-07',
    fornecedorCnpj: '17.213.071/0001-75',
    fornecedorRazao: 'ASSOCIACAO DOS MORADORES DO EDIFICIO COSTA VERDE',
    fornecedorUf: 'DF',
    fornecedorMunicipio: 'BRASILIA',
    clienteCnpj: '00.000.000/0001-91',
    clienteRazao: 'BANCO DO BRASIL SA',
    clienteUf: 'DF',
    situacaoDoc: 'substituido',
    itemNro: 1,
    descricaoItem: 'DEVOLUÇÃO DE COMPRA DE MATERIAIS DE ESCRITORIO',
    ncm: '48201000',
    cfop: '1202', // Devolução
    cClassTrib: '0001',
    cstCsosn: '00',
    naturezaOperacao: 'DEVOLUCAO DE COMPRA DE MERCADORIAS',
    quantidade: 2,
    unidade: 'CX',
    valorBrutoItem: 3200.00,
    descontoIncondicional: 0,
    freteSeguroRateado: 0,
    valorLiquidoItem: 3200.00,
    baseIbs: 3200.00,
    aliquotaIbs: 17.70,
    valorIbs: 566.40,
    baseCbs: 3200.00,
    aliquotaCbs: 8.80,
    valorCbs: 281.60,
    creditoEsperadoIbs: 0, // Devolução gera estorno!
    creditoEsperadoCbs: 0,
    creditoApropriadoIbs: 0,
    creditoApropriadoCbs: 0,
    diferencaCreditoIbs: 0,
    diferencaCreditoCbs: 0,
    fonteAliquota: 'documento',
    motivoDiferenca: 'Devolução de compra tratada com estorno de crédito proporcional',
    indicadorOnerosidade: 'Oneroso',
    criterioOnerosidade: 'Estorno de pagamento prévio',
    evidenciaCobranca: true,
    tipoAquisicao: 'revenda',
    destinacao: 'atividade_tributada',
    regraAplicadaId: 'ELEG_050',
    resultadoElegibilidade: 'Não elegível',
    motivoPadronizado: 'NF-e de Devolução é espelho para estorno, não compra nova',
    evidencia: 'NF-e de origem vinculada na tag refNFe',
    pedidoContrato: 'DEV-2026-01',
    recebimentoGrn: 'GRN-DEV-12',
    lancamentoContabil: 'Conta 2.1.05.01 - Estorno de Crédito Compras',
    usuarioCaptura: 'OPERADOR_FISCAL',
    rotinaCaptura: 'MANUAL_IMPORT_XML',
    isExcecao: false,
    creditoOriginalTotal: 848.00,
    creditoEstornadoTotal: 848.00,
    temEventoAfetaCredito: true,
    tipoEventoAfetaCredito: 'Devolução',
    chaveDocOriginal: '3526081721307100017555001000083220810012001',
    chaveDocEvento: '3526081721307100017555001000099887766554433',
    dataEventoAfetaCredito: '2026-07-20',
    usuarioAprovacaoEvento: 'GERENTE_FISCAL_01'
  }
];

/**
 * Filter function for reports
 */
export function filterReportItems(
  items: XmlItemDetailReport[],
  filters: ReportFilterState
): XmlItemDetailReport[] {
  return items.filter(item => {
    // CNPJ Emitente
    if (filters.cnpjEmitente && !item.fornecedorCnpj.includes(filters.cnpjEmitente.replace(/\D/g, ''))) {
      const cleanInput = filters.cnpjEmitente.replace(/\D/g, '');
      const cleanItem = item.fornecedorCnpj.replace(/\D/g, '');
      if (!cleanItem.includes(cleanInput)) return false;
    }

    // CNPJ Destinatário
    if (filters.cnpjDestinatario && !item.clienteCnpj.includes(filters.cnpjDestinatario.replace(/\D/g, ''))) {
      const cleanInput = filters.cnpjDestinatario.replace(/\D/g, '');
      const cleanItem = item.clienteCnpj.replace(/\D/g, '');
      if (!cleanItem.includes(cleanInput)) return false;
    }

    // UF
    if (filters.uf && filters.uf !== 'TODAS') {
      if (item.fornecedorUf !== filters.uf && item.clienteUf !== filters.uf) {
        return false;
      }
    }

    // Tipo Doc
    if (filters.tipoDoc && filters.tipoDoc !== 'TODOS') {
      if (item.tipoDoc !== filters.tipoDoc) return false;
    }

    // Situação Doc
    if (filters.situacaoDoc && filters.situacaoDoc !== 'TODAS') {
      if (item.situacaoDoc !== filters.situacaoDoc) return false;
    }

    // CFOP
    if (filters.cfop && filters.cfop.trim() !== '') {
      if (!item.cfop.includes(filters.cfop.trim())) return false;
    }

    // cClassTrib
    if (filters.cClassTrib && filters.cClassTrib.trim() !== '') {
      if (!item.cClassTrib.includes(filters.cClassTrib.trim())) return false;
    }

    // Indicador Onerosidade
    if (filters.indicadorOnerosidade && filters.indicadorOnerosidade !== 'TODOS') {
      if (item.indicadorOnerosidade !== filters.indicadorOnerosidade) return false;
    }

    // Resultado Elegibilidade
    if (filters.resultadoElegibilidade && filters.resultadoElegibilidade !== 'TODOS') {
      if (item.resultadoElegibilidade !== filters.resultadoElegibilidade) return false;
    }

    // Apenas Exceções
    if (filters.apenasExcecoes && !item.isExcecao) {
      return false;
    }

    // Datas
    if (filters.dataInicio) {
      if (item.dataEmissao < filters.dataInicio) return false;
    }
    if (filters.dataFim) {
      if (item.dataEmissao > filters.dataFim) return false;
    }

    // Search term
    if (filters.searchTerm && filters.searchTerm.trim() !== '') {
      const q = filters.searchTerm.toLowerCase().trim();
      const matchKey = item.chaveAcesso.toLowerCase().includes(q);
      const matchForn = item.fornecedorRazao.toLowerCase().includes(q);
      const matchCli = item.clienteRazao.toLowerCase().includes(q);
      const matchDesc = item.descricaoItem.toLowerCase().includes(q);
      const matchNcm = item.ncm.toLowerCase().includes(q);
      const matchPed = (item.pedidoContrato || '').toLowerCase().includes(q);
      const matchNum = item.numeroSerie.toLowerCase().includes(q);

      if (!matchKey && !matchForn && !matchCli && !matchDesc && !matchNcm && !matchPed && !matchNum) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Export selected report view to Excel file
 */
export function exportReportToExcel(
  items: XmlItemDetailReport[],
  reportTitle: string = 'Relatorio_Razao_Entradas'
) {
  const exportRows = items.map(it => ({
    'Empresa (CNPJ/Filial)': it.empresaCnpj,
    'Razão Social Empresa': it.empresaNome,
    'Tipo Doc': it.tipoDoc,
    'Chave de Acesso': it.chaveAcesso,
    'Número / Série': it.numeroSerie,
    'Data Emissão': it.dataEmissao,
    'Data Entrada': it.dataEntrada,
    'Competência': it.competencia,
    'CNPJ Fornecedor': it.fornecedorCnpj,
    'Razão Fornecedor': it.fornecedorRazao,
    'UF Fornecedor': it.fornecedorUf,
    'Situação Doc': it.situacaoDoc.toUpperCase(),
    'Item Nro': it.itemNro,
    'Descrição Item': it.descricaoItem,
    'NCM / NBS': it.ncm,
    'CFOP': it.cfop,
    'cClassTrib': it.cClassTrib,
    'CST/CSOSN': it.cstCsosn,
    'Natureza Operação': it.naturezaOperacao,
    'Quantidade': it.quantidade,
    'Unid': it.unidade,
    'Valor Bruto (R$)': it.valorBrutoItem,
    'Desconto Incondicional (R$)': it.descontoIncondicional,
    'Frete/Seguro (R$)': it.freteSeguroRateado,
    'Valor Líquido Item (R$)': it.valorLiquidoItem,
    'Base IBS (R$)': it.baseIbs,
    'Alíquota IBS (%)': it.aliquotaIbs,
    'Valor IBS (R$)': it.valorIbs,
    'Base CBS (R$)': it.baseCbs,
    'Alíquota CBS (%)': it.aliquotaCbs,
    'Valor CBS (R$)': it.valorCbs,
    'Crédito Esperado IBS (R$)': it.creditoEsperadoIbs,
    'Crédito Esperado CBS (R$)': it.creditoEsperadoCbs,
    'Crédito Apropriado IBS (R$)': it.creditoApropriadoIbs,
    'Crédito Apropriado CBS (R$)': it.creditoApropriadoCbs,
    'Diferença Crédito IBS (R$)': it.diferencaCreditoIbs,
    'Diferença Crédito CBS (R$)': it.diferencaCreditoCbs,
    'Indicador Onerosidade': it.indicadorOnerosidade,
    'Critério Onerosidade': it.criterioOnerosidade,
    'Resultado Elegibilidade': it.resultadoElegibilidade,
    'Regra Aplicada': it.regraAplicadaId,
    'Motivo Elegibilidade': it.motivoPadronizado,
    'Exceção / Pendência': it.isExcecao ? 'SIM' : 'NÃO',
    'Tipo Exceção': it.tipoExcecao || '-',
    'Pedido / Contrato': it.pedidoContrato || '-',
    'Lançamento Contábil ERP': it.lancamentoContabil || '-'
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatorio_Fiscal_SEFAZ');

  // Auto column widths
  const colWidths = Object.keys(exportRows[0] || {}).map(key => ({
    wch: Math.max(key.length, 14)
  }));
  worksheet['!cols'] = colWidths;

  const fileName = `${reportTitle}_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
