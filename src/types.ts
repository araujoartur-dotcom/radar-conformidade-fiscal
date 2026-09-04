export type QueryMode = 'central_kpis' | 'lote' | 'avulsa' | 'detalhada' | 'dfe_xml' | 'eventos_dfe' | 'integracao_erp' | 'cruzamento_sped' | 'auditoria_fiscal' | 'relatorios_xml' | 'acesso_corporativo' | 'carteira_cnpjs' | 'observabilidade_dlq' | 'tabelas_fiscais' | 'parceiros_negocio';

// ==========================================
// ACESSO CORPORATIVO, PERFIS & MULTI-TENANT CNPJ
// ==========================================

export type PerfilUsuario = 'admin_master' | 'contador_gestor' | 'analista_fiscal' | 'auditor_externo' | 'operador_leitura';

export interface UsuarioCorporativo {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  mfaHabilitado: boolean;
  mfaMetodo: 'authenticator_app' | 'sms' | 'email';
  status: 'ativo' | 'bloqueado' | 'pendente_mfa';
  cnpjsAutorizados: string[]; // Lista de CNPJs aos quais o usuário tem acesso ("*" para todos)
  ultimoAcesso?: string;
}

export interface ContadorSped {
  nome: string;
  cpf: string;
  crc: string; // Ex: SP-123456/O-0
  ufCrc?: string;
  cnpjEscritorio?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  codMunicipioIbge?: string; // 7 dígitos IBGE
  municipio?: string;
  uf?: string;
  telefone?: string;
  email?: string;
}

export interface EnderecoEmpresa {
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  codMunicipioIbge?: string;
  municipio?: string;
  uf?: string;
  telefone?: string;
  email?: string;
}

export interface ClienteEmpresaTenant {
  id: string;
  cnpjRaiz: string; // Primeiros 8 dígitos do CNPJ
  cnpjCompleto: string; // CNPJ Matriz ou Filial
  razaoSocial: string;
  nomeFantasia: string;
  grupoContabilCliente?: string; // Nome da Carteira / Cliente da Contabilidade
  uf: string;
  regimeTributario: 'Real' | 'Presumido' | 'Simples Nacional' | 'MEI' | string;
  ie?: string; // Inscrição Estadual (SPED 0000)
  im?: string; // Inscrição Municipal
  cnaePrincipal?: string;
  cnaeDescricao?: string;
  codMunicipioIbge?: string; // 7 dígitos IBGE
  suframa?: string;
  perfilSped?: 'A' | 'B' | 'C'; // Perfil EFD Fiscal
  indAtiv?: '0' | '1'; // 0 = Industrial ou equiparado, 1 = Outros
  endereco?: EnderecoEmpresa; // SPED 0005
  contador?: ContadorSped; // SPED 0100
  certificadoA1?: {
    fileName: string;
    validade: string; // YYYY-MM-DD
    status: 'valido' | 'expirado' | 'pendente';
    emissor: string;
    impressaoDigital: string;
  };
  totalDocumentosCapturados: number;
  statusConexaoSefaz: 'ativo' | 'alerta' | 'sem_certificado';
  manifestarCienciaAutomatica?: boolean; // Manifesta automaticamente Ciência da Operação (210210) para liberação de XMLs completos
  ultimoNsu?: string; // Último NSU sincronizado no WebService SEFAZ
  maxNsu?: string; // Maior NSU disponível na SEFAZ
  ultimaSincronizacao?: string;
}

export type SituaçãoIE = 'Habilitado' | 'Não Habilitado' | 'Baixado' | 'Suspenso' | 'Isento' | 'Não Contribuinte' | 'Pendente';

export type SituaçãoCNPJ = 'ATIVA' | 'INAPTA' | 'SUSPENSA' | 'BAIXADA' | 'NULA' | 'PENDENTE';

export type TipoDFe = 'NFe' | 'NFCe' | 'CTe' | 'NFSe' | 'MDFe';

export interface CertificadoA1 {
  fileName: string;
  cnpj: string;
  razãoSocial: string;
  tipo: string; // e-CNPJ A1
  validade: string; // YYYY-MM-DD
  status: 'valido' | 'expirado' | 'nenhum';
}

export interface CnpjLookupItem {
  id: string;
  cnpj: string;
  uf: string;
  ie?: string;
  tipoIE?: string;
  situaçaoIE?: SituaçãoIE;
  situaçaoCNPJ?: SituaçãoCNPJ;
  naturezaJuridica?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  cnaePrincipal?: string;
  cnaeDescricao?: string;
  dataAbertura?: string;
  regimeTributario?: string;
  capitalSocial?: number;
  enderecoCompleto?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  socios?: Array<{ nome: string; qualificacao: string }>;
  statusConsulta: 'pendente' | 'processando' | 'sucesso' | 'erro';
  mensagemErro?: string;
  dataConsulta?: string;
}

export interface ItemDfeDetail {
  numeroItem: number;
  codigo: string;
  descricao: string;
  ncm?: string;
  ncmCts?: string;
  cfop?: string;
  cClassTrib?: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  valorIcms?: number;
  valorIpi?: number;
  valorPis?: number;
  valorCofins?: number;
  valorCbs?: number;
  valorIbs?: number;
  aliquotaCbs?: number;
  aliquotaIbs?: number;
  aliquotaIcms?: number;
  aliquotaIpi?: number;
}

export interface DfeXmlItem {
  id: string;
  chaveAcesso: string;
  tipo: TipoDFe;
  numero: string;
  serie: string;
  dataEmissao: string;
  emitenteCnpj: string;
  emitenteNome: string;
  emitenteUf: string;
  emitenteIe?: string;
  destinatarioCnpj: string;
  destinatarioNome: string;
  destinatarioUf: string;
  destinatarioIe?: string;
  valorTotal: number;
  // Impostos Atuais
  valorIcms: number;
  valorIpi: number;
  valorPis: number;
  valorCofins: number;
  // Reforma Tributária (CBS / IBS / IS)
  aliquotaCbs: number; // percentual CBS destacado ou vigente
  valorCbs: number;
  aliquotaIbs: number; // percentual IBS destacado ou vigente
  valorIbs: number;
  valorImpostoSeletivo: number;
  
  // Retenções na Fonte de Serviços (NFS-e)
  valorIrrf?: number;
  valorCsllRetido?: number;
  valorPisRetido?: number;
  valorCofinsRetido?: number;
  valorCrfTotal?: number;
  valorInssRetido?: number;
  valorIssRetido?: number;
  aliquotaIss?: number;
  codigoServico?: string;
  codigoNbs?: string;
  descricaoServico?: string;

  // Informações de Transporte (CT-e)
  chaveNfeVinculada?: string;
  produtoPredominante?: string;
  municipioOrigem?: string;
  municipioDestino?: string;

  // Reforma Tributária por Documento
  cClassTrib?: string;
  percentualReducao?: number;

  // Lista de Itens do Documento
  itens?: ItemDfeDetail[];
  // Status de Auditoria
  statusAuditoria: 'conforme' | 'inconsistente' | 'pendente_ccc';
  alertasAuditoria: string[];
  // Status do Evento de Manifestação
  eventoUltimo?: string;
  statusSincronizacaoErp: 'pendente' | 'sincronizado' | 'erro';
  // Fase 3: Custódia Fiscal & Split Payment
  sha256?: string;
  splitPayment?: SplitPaymentInfo;
  custodiaWorm?: CustodiaWormItem;
  xmlRaw?: string;
  isResumoApenas?: boolean;
  situacaoManifestacao?: string;
  alertaFraude?: boolean;
  downloadAt?: string;
}

export interface EventoDfeDefinition {
  id: string;
  codigoEvento: string;
  nome: string;
  descricao: string;
  tipoDfe: 'NFe' | 'NFCe' | 'CTe' | 'NFSe' | 'TODOS';
  categoria: 'destinatario' | 'emitente' | 'tomador' | 'reforma_tributaria' | 'contingencia';
  requerJustificativa: boolean;
  minCaracteresJustificativa?: number;
  badge?: string;
  isReformaTributaria?: boolean;
}

export type EventoCatalogoItem = EventoDfeDefinition;

export interface EventoDfeRequest {
  id: string;
  chaveAcesso: string;
  tipoDfe: TipoDFe;
  tipoEventoId: string;
  codigoEvento: string;
  nomeEvento: string;
  categoria: 'destinatario' | 'emitente' | 'tomador' | 'reforma_tributaria' | 'contingencia';
  origemEvento?: 'proprio' | 'terceiro_destinatario' | 'sefaz';
  autorCnpj?: string;
  justificativa?: string;
  dataHora: string;
  protocoloSeFaz?: string;
  status: 'processado' | 'pendente' | 'rejeitado';
  detalhesReforma?: {
    cbsAjuste?: string;
    ibsAjuste?: string;
    cashbackStatus?: string;
  };
}

export interface ErpConnectionConfig {
  tipoErp: 'SAP_S4HANA' | 'SAP_ECC' | 'TOTVS_PROTHEUS' | 'REST_WEBHOOK';
  endpointUrl: string;
  systemId: string; // Ex: PRD-100
  clientNumber: string; // Ex: 100
  apiKey: string;
  autoSyncEvents: boolean;
  autoSyncAudit: boolean;
  statusConexao: 'conectado' | 'desconectado' | 'testando';
  ultimaSincronizacao?: string;
}

export interface CnpjRaizDirectoryConfig {
  id: string;
  cnpjRaiz: string; // Ex: "33.000.167" ou "17.213.071"
  razaoSocial: string;
  diretorioEntrada: string; // XMLs Recebidos/Compras
  subpastaDataEntrada: boolean; // Organizar em subpastas \YYYY\MM\
  estruturaNomeEntrada: 'chave' | 'tipo_numero' | 'data_emitente';
  diretorioSaida: string; // XMLs Emitidos/Vendas
  subpastaDataSaida: boolean; // Organizar em subpastas \YYYY\MM\
  estruturaNomeSaida: 'chave' | 'tipo_numero' | 'data_emitente';
  diretorioEventos: string; // XMLs de Eventos, CCE e Cancelamentos
  autoOrganizarAoCapturar: boolean;
  statusMonitoramento: 'ativo' | 'pausado' | 'erro';
  ultimaSincronizacao?: string;
}

export type AmbienteSefaz = 'homologacao' | 'producao';

export interface BatchStats {
  total: number;
  sucesso: number;
  erro: number;
  pendente: number;
  processando: number;
}

export const ESTADOS_BRASIL = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
] as const;

export type EstadoUF = typeof ESTADOS_BRASIL[number];

// ==========================================
// TIPOS PARA ÁREA DE RELATÓRIOS XML / SAP ERP
// ==========================================

export type ReportTabType = 
  | 'razao_entradas'        // #1 Razão de Entradas Item a Item
  | 'matriz_elegibilidade'  // #2 Matriz de Elegibilidade
  | 'calculo_credito'       // #3 Cálculo do Crédito Esperado x Apropriado
  | 'excecoes_pendencias'   // #4 Exceções e Pendências de Crédito
  | 'estornos_ajustes'      // #5 Estornos / Ajustes / Eventos
  | 'mapa_cfop'             // #6 Mapa CFOP x Tratamento
  | 'mapa_cclasstrib'       // #7 Mapa cClassTrib x Alíquota/Base
  | 'onerosidade_auditoria' // #8 Onerosidade - Auditoria e Evidências
  | 'retencoes_fonte';      // #9 Retenções na Fonte (NFS-e / Serviços)

export interface ReportFilterState {
  cnpjEmitente: string;     // CNPJ do Fornecedor / Emitente
  cnpjDestinatario: string; // CNPJ do Cliente / Filial / Destinatário
  uf: string;               // UF Emitente/Destinatário
  dataInicio: string;       // YYYY-MM-DD
  dataFim: string;          // YYYY-MM-DD
  tipoDoc: string;          // NF-e / CT-e / NFS-e / Todos
  situacaoDoc: string;      // autorizado / cancelado / denegado / substituido / todos
  cfop: string;             // Filtro de CFOP
  cClassTrib: string;       // Filtro de cClassTrib
  indicadorOnerosidade: string; // Oneroso / Não Oneroso / Misto / Indeterminado / todos
  resultadoElegibilidade: string; // Elegível / Parcial / Não elegível / Pendente / todos
  apenasExcecoes: boolean;  // Apenas com pendência de crédito / exceções
  searchTerm: string;       // Palavra-chave (Razão, Item, Chave, NCM, Pedido)
}

export interface XmlItemDetailReport {
  id: string;
  // Cabeçalho do documento
  empresaCnpj: string;      // CNPJ/Filial que recebeu
  empresaNome: string;
  tipoDoc: 'NF-e' | 'CT-e' | 'NFS-e' | 'NFC-e' | 'Importação';
  chaveAcesso: string;
  numeroSerie: string;      // ex: "104892 / 1"
  dataEmissao: string;      // YYYY-MM-DD
  dataEntrada: string;      // YYYY-MM-DD
  competencia: string;      // YYYY-MM
  fornecedorCnpj: string;
  fornecedorRazao: string;
  fornecedorUf: string;
  fornecedorMunicipio: string;
  clienteCnpj: string;
  clienteRazao: string;
  clienteUf: string;
  situacaoDoc: 'autorizado' | 'cancelado' | 'denegado' | 'substituido';
  
  // Linha do Item
  itemNro: number;
  descricaoItem: string;
  ncm: string;
  cfop: string;
  cClassTrib: string;       // ex: "000001", "100001", "200001"
  cstCsosn: string;
  naturezaOperacao: string;
  quantidade: number;
  unidade: string;
  valorBrutoItem: number;
  descontoIncondicional: number;
  freteSeguroRateado: number;
  valorLiquidoItem: number;
  
  // Tributos e Crédito (Reforma Tributária IBS / CBS)
  baseIbs: number;
  aliquotaIbs: number;
  valorIbs: number;
  baseCbs: number;
  aliquotaCbs: number;
  valorCbs: number;
  creditoEsperadoIbs: number;
  creditoEsperadoCbs: number;
  creditoApropriadoIbs: number;
  creditoApropriadoCbs: number;
  diferencaCreditoIbs: number; // esperado - apropriado
  diferencaCreditoCbs: number;
  fonteAliquota: 'documento' | 'tabela_interna' | 'cadastro_fiscal';
  motivoDiferenca?: string;
  
  // Onerosidade
  indicadorOnerosidade: 'Oneroso' | 'Não Oneroso' | 'Misto' | 'Indeterminado';
  criterioOnerosidade: string;
  evidenciaCobranca: boolean; // Fatura/duplicata/contrato vinculado
  
  // Elegibilidade
  tipoAquisicao: 'revenda' | 'insumo' | 'imobilizado' | 'servico' | 'frete' | 'importacao';
  destinacao: 'atividade_tributada' | 'isenta' | 'uso_consumo' | 'ativo';
  regraAplicadaId: string;    // ex: "ELEG_012"
  resultadoElegibilidade: 'Elegível' | 'Parcial' | 'Não elegível' | 'Pendente';
  motivoPadronizado: string;
  evidencia: string;
  
  // Rastreabilidade & Governança
  pedidoContrato?: string;
  recebimentoGrn?: string;
  lancamentoContabil?: string;
  usuarioCaptura: string;
  rotinaCaptura: string;
  
  // Verificações Automáticas e Exceções
  isExcecao: boolean;
  tipoExcecao?: string;
  detalheExcecao?: string;
  statusSaneamento?: 'pendente' | 'em_analise' | 'saneado' | 'glosado';
  
  // Ciclo de Vida do Crédito (Estornos & Eventos)
  temEventoAfetaCredito: boolean;
  tipoEventoAfetaCredito?: 'Cancelamento' | 'Devolução' | 'NF Substituta' | 'Ajuste Manual' | 'Carta Correção';
  chaveDocOriginal?: string;
  chaveDocEvento?: string;
  creditoOriginalTotal: number;
  creditoEstornadoTotal: number;
  dataEventoAfetaCredito?: string;
  usuarioAprovacaoEvento?: string;

  // Retenções na Fonte (NFS-e / Serviços) — Lei 10.833/03, RIR/2018, LC 116/03
  valorIrrf?: number;
  aliquotaIrrf?: number;
  valorInss?: number;
  aliquotaInss?: number;
  valorPisRetido?: number;
  aliquotaPisRetido?: number;
  valorCofinsRetido?: number;
  aliquotaCofinsRetido?: number;
  valorCsllRetido?: number;
  aliquotaCsllRetido?: number;
  valorIssRetido?: number;
  aliquotaIssRetido?: number;
  totalRetencoes?: number;
  valorLiquidoServico?: number;
  codigoServicoLc116?: string;
  discriminacaoServico?: string;
  diagnosticoRetencao?: 'CONFORME' | 'DIVERGENCIA_ALIQUOTA' | 'FALTA_RETENCAO' | 'RETENCAO_INDEVIDA' | 'DISPENSADO_LIMITE' | 'SIMPLES_NACIONAL';
  motivoDiagnosticoRetencao?: string;
}

export interface MapaCfopItem {
  cfop: string;
  descricao: string;
  categoria: 'Compra' | 'Devolução' | 'Transferência' | 'Remessa' | 'Outros';
  tratamentoPadrao: 'Elegível' | 'Não elegível' | 'Depende';
  exigeOnerosidade: boolean;
  exigeValidaçãoCClassTrib: boolean;
  evidenciaMinima: string;
}

export interface MapaCClassTribItem {
  cClassTrib: string;
  descricaoInterna: string;
  tratamentoEsperado: 'tributado' | 'aliquota_reduzida' | 'isento' | 'nao_incidencia' | 'monofasico';
  permiteCredito: 'Sim' | 'Não' | 'Parcial' | 'Depende';
  aliquotaEsperada: string;
  alertas: string;
}

// ==========================================
// ARQUITETURA ASSÍNCRONA, FILAS, DLQ E RESILIÊNCIA
// ==========================================

export type QueueNameType = 
  | 'xml.ingest'
  | 'xml.validate'
  | 'xml.parse'
  | 'capture.execute'
  | 'certificate.sign'
  | 'events.send'
  | 'events.query'
  | 'ibs-cbs.calculate'
  | 'reports.generate'
  | 'notifications.send'
  | 'maintenance.execute';

export interface DlqTaskItem {
  id: string;
  correlationId: string;
  queueName: QueueNameType;
  organizationId: string;
  companyCnpj: string;
  companyName: string;
  taskType: string;
  priority: 'alta' | 'normal' | 'baixa';
  createdAt: string;
  startedAt: string;
  finishedAt?: string;
  currentAttempt: number;
  maxAttempts: number;
  status: 'na_fila' | 'processando' | 'erro_reprocessavel' | 'dlq_retido' | 'reprocessado' | 'cancelado';
  errorMessage: string;
  errorCategory: 'servico_externo_indisponivel' | 'certificado_invalido' | 'schema_xml_invalido' | 'timeout_sefaz' | 'erro_concorrencia';
  errorDetails?: string;
  payloadHash: string;
  retryBackoffMs: number;
  isIdempotent: boolean;
}

export interface CircuitBreakerState {
  serviceName: string;
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  failureThreshold: number;
  lastFailureTime?: string;
  successRate: number;
  averageLatencyMs: number;
  rateLimitReqSec: number;
  currentActiveWorkers: number;
}

export interface CofreCertificadoSecurity {
  id: string;
  cnpjOwner: string;
  razaoSocial: string;
  tipoCertificado: 'A1_PKCS12' | 'A3_LOCAL_AGENT';
  algoritmoCriptografia: 'AES-256-GCM';
  validadeData: string;
  diasParaVencimento: number;
  statusAlerta: 'ok' | 'alerta_30_dias' | 'alerta_15_dias' | 'expirado';
  chavePublicaFingerprint: string;
  agenteA3Status?: 'online' | 'offline' | 'token_nao_inserido';
  ultimaVerificacao: string;
}

export interface StructuredAuditLog {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  service: string;
  correlationId: string;
  jobId?: string;
  organizationId: string;
  companyCnpj: string;
  userId: string;
  documentId?: string;
  action: string;
  message: string;
  ipAddress: string;
}

// ==========================================
// DADOS MESTRES & CADASTRO FISCAL DE PARCEIROS (MDM)
// ==========================================

export type TipoPessoaParceiro = 'PJ' | 'PF' | 'EX';
export type PapelParceiro = 'cliente' | 'fornecedor' | 'prestador' | 'transportador' | 'ambos';
export type RegimeTributarioParceiro = '01' | '02' | '03' | '04' | '05' | '06'; // 01-Simples, 02-Simples(Excesso), 03-Presumido, 04-Real, 05-Imune/Isento, 06-MEI
export type EsferaPublica = 'NA' | 'FE' | 'ES' | 'MU';
export type SegmentoMercadologico = 'IND' | 'COM' | 'SER' | 'CON' | 'RUR' | 'FIN' | 'SAU' | 'EDU';

export interface EnderecoParceiro {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  codMunicipioIbge: string; // 7 dígitos (ex: 3550308)
  municipio: string;
  uf: string;
  codPaisBacen: string; // 1058 Brasil
  nomePais: string;
}

export interface FiscalParceiro {
  inscricaoEstadual?: string;
  indIeDestinatario: '1' | '2' | '9'; // 1-Contribuinte, 2-Isento, 9-Não Contribuinte
  inscricaoMunicipal?: string;
  indContribuinteIpi: boolean;
  indSubstitutoTrib: boolean;
  indProdutorRural: boolean;
  indCooperativa: boolean;
  indOptanteSimples: boolean;
  aliquotaIcmsSimples?: number; // Percentual de aproveitamento de crédito
  suframa?: string;
}

export interface RetencoesParceiro {
  retemIrrf: boolean;
  aliquotaIrrf?: number; // Ex: 1.5 ou 1.0
  codigoReceitaIrrf?: string; // Ex: 1708, 8045
  retemCrf: boolean; // PIS/COFINS/CSLL Lei 10.833
  aliquotaCrf?: number; // 4.65%
  retemInss: boolean; // Lei 8.212 / EFD-Reinf
  aliquotaInss?: number; // 11% ou 3.5%
  indicadorCprb?: boolean; // Desoneração da folha
  retemIss: boolean;
  aliquotaIss?: number; // 2% a 5%
  codigoServicoMunicipal?: string;
  regimeRetencaoPublica?: 'NA' | 'IN_1234_AMPLA' | 'LEI_9430';
}

export interface ContabilParceiro {
  contaContabilCliente?: string; // Código Plano Referencial SPED
  contaContabilFornecedor?: string;
  centroCustoDefault?: string;
  centroLucroDefault?: string;
  condicaoPagamentoDias?: number;
  limiteCredito?: number;
  dadosBancarios?: {
    bancoCodigo: string;
    bancoNome: string;
    agencia: string;
    contaCorrente: string;
    chavePix?: string;
    tipoChavePix?: 'CNPJ' | 'CPF' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA';
  };
  contatoFiscal?: {
    nome: string;
    email: string;
    telefone: string;
    crcContador?: string;
  };
}

export interface ParceiroNegocio {
  id: string;
  tenantId?: string; // ID da empresa proprietária deste parceiro
  tipoPessoa: TipoPessoaParceiro;
  papel: PapelParceiro;
  cpfCnpj: string; // Suporta CNPJ Numérico (14) ou CNPJ Alfanumérico (14 caracteres)
  cnpjRaiz?: string; // 8 caracteres A-Z0-9
  cnpjOrdem?: string; // 4 caracteres A-Z0-9
  cnpjDv?: string; // 2 dígitos numéricos
  idEstrangeiro?: string;
  razaoSocial: string;
  nomeFantasia?: string;
  naturezaJuridica: string; // Ex: 2062, 2054, 2135, 1015
  regimeTributario: RegimeTributarioParceiro;
  esferaPublica: EsferaPublica;
  segmento: SegmentoMercadologico;
  cnaePrincipal: string;
  cnaesSecundarios?: string[];
  statusCadastro: 'A' | 'I' | 'B'; // Ativo, Inativo, Bloqueado
  endereco: EnderecoParceiro;
  fiscal: FiscalParceiro;
  retencoes: RetencoesParceiro;
  contabil: ContabilParceiro;
  situacaoCadastralSefaz?: 'Habilitado' | 'Não Habilitado' | 'Baixado' | 'Inapto' | 'Não Consultado';
  dataUltimaConsultaSefaz?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SimulacaoFiscalParceiro {
  tipoOperacao: 'venda_mercadoria' | 'compra_insumo' | 'prestacao_servico' | 'tomada_servico' | 'remessa_industrializacao';
  ufOrigem: string;
  ufDestino: string;
  cfopSugerido: string;
  cstIcmsSugerido: string;
  csosnSugerido?: string;
  cstPisSugerido: string;
  cstCofinsSugerido: string;
  cstIpiSugerido?: string;
  aliquotaIcms: number;
  exigeDifalPartilha: boolean;
  exigeFcp: boolean;
  retencoesAplicadas: {
    irrf: number;
    pis: number;
    cofins: number;
    csll: number;
    inss: number;
    iss: number;
    totalRetencoes: number;
  };
  observacoesFiscais: string[];
}

// =========================================================
// FASE 3: REFORMA TRIBUTÁRIA — TRANSIÇÃO 2026-2033 & SPLIT PAYMENT
// =========================================================

export interface RegraTransicaoAno {
  ano: number;
  faseNome: string;
  badge: string;
  aliquotaCbs: number; // Federal (%)
  aliquotaIbsEstadual: number; // Subnacional Estadual (%)
  aliquotaIbsMunicipal: number; // Subnacional Municipal (%)
  aliquotaIbsTotal: number; // IBS Total (%)
  aliquotaIvaTotal: number; // CBS + IBS Total (%)
  percentualReducaoIcmsIss: number; // Redução gradual de ICMS/ISS (%)
  observacoes: string;
}

export type MetodoSplitPayment = 'PIX_DINAMICO' | 'BOLETO_BANCARIO' | 'ARRANJO_CARTAO' | 'TED_DOC';

export interface SplitPaymentInfo {
  valorTotalOperacao: number;
  aliquotaCbsAplicada: number;
  valorCbsRetido: number;
  aliquotaIbsAplicada: number;
  valorIbsRetido: number;
  valorTotalTributosRetidos: number;
  valorLiquidoFornecedor: number;
  metodoLiquidacao: MetodoSplitPayment;
  statusLiquidacao: 'retencao_automatica_pendente' | 'liquidado_com_split' | 'dispensado_regime_especial';
  chaveAcesso: string;
  dataCalculo: string;
  destinatarioSplit: {
    comiteGestorIbs: string;
    receitaFederalCbs: string;
    fornecedorNome: string;
    fornecedorCnpj: string;
  };
}

export interface CustodiaWormItem {
  id: string;
  chaveAcesso: string;
  numero: string;
  tipoDfe: string;
  hashSha256: string;
  dataEmissao: string;
  dataCaptura: string;
  dataExpiracaoGuarda5Anos: string; // Art. 173 do CTN (5 anos)
  statusImutabilidade: 'bloqueado_worm_ativo' | 'em_custodia';
  tamanhoBytes: number;
  emissorCnpj: string;
  destinatarioCnpj: string;
}

// =========================================================
// TABELAS DINÂMICAS DE ALÍQUOTAS & ANEXOS NCM
// =========================================================

export interface AliquotaTabelaItem {
  id?: string;
  codigo_cadastro: string;
  modalidade: 'ad_valorem' | 'ad_rem';
  cbs_federal: number;
  ibs_estadual: number;
  ibs_municipal: number;
  is_federal: number;
  unidade_medida?: string | null;
  inicio_vigencia: string;
  final_vigencia: string;
  descricao?: string;
}

export interface NcmRegraAnexoItem {
  id?: string;
  ncm: string;
  nbs?: string;
  cclasstrib?: string;
  descricao: string;
  tipo_tratamento: 'padrao' | 'cesta_basica_zero' | 'reducao_60' | 'reducao_30' | 'ad_rem' | 'isento' | 'monofasico';
  percentual_reducao: number;
  anexo_lei?: string;
  base_legal?: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  ativo?: boolean;
}

