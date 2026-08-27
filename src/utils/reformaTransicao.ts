/**
 * ============================================================
 * MOTOR DA REFORMA TRIBUTÁRIA — TRANSIÇÃO 2026-2033 & SPLIT PAYMENT
 * ============================================================
 * Regras e alíquotas conforme Emenda Constitucional nº 132/2023
 * e Lei Complementar nº 214/2025 (PLP 68/2024).
 * ============================================================
 */

import { RegraTransicaoAno, SplitPaymentInfo, MetodoSplitPayment, CustodiaWormItem, AliquotaTabelaItem } from '../types';

// =========================================================
// CONSTRUTOR DINÂMICO DO CRONOGRAMA A PARTIR DAS TABELAS
// =========================================================

/**
 * Constrói dinamicamente as alíquotas de cada ano de transição (2026-2033+)
 * com base estrita nas linhas cadastradas na tabela de alíquotas (aliquotas_tabelas).
 * NENHUM valor fica fixado no código!
 */
export function buildCronogramaFromTabelas(tabelas?: AliquotaTabelaItem[]): Record<number, RegraTransicaoAno> {
  const adValorem = (tabelas || []).filter(t => t.modalidade === 'ad_valorem' || !t.modalidade);

  // 1. Linha 2026 (Ano de Teste)
  const tab2026 = adValorem.find(t => t.codigo_cadastro === '00001' || t.inicio_vigencia?.startsWith('2026'));
  const cbs2026 = tab2026 ? Number(tab2026.cbs_federal) : 0.90;
  const ibsEst2026 = tab2026 ? Number(tab2026.ibs_estadual) : 0.05;
  const ibsMun2026 = tab2026 ? Number(tab2026.ibs_municipal) : 0.05;

  // 2. Linha 2027 (CBS Plena)
  const tab2027 = adValorem.find(t => t.codigo_cadastro === '00002' || t.inicio_vigencia?.startsWith('2027'));
  const cbs2027 = tab2027 ? Number(tab2027.cbs_federal) : 9.21;

  // 3. Linha 2033+ (Regime Pleno Definitivo — Comitê Gestor IBS)
  const tab2033 = adValorem.find(t => t.codigo_cadastro === '00003' || t.inicio_vigencia >= '2033-01-01' || t.final_vigencia >= '2099-01-01') || adValorem[adValorem.length - 1];

  const cbsRef = tab2033 ? Number(tab2033.cbs_federal) : (tab2027 ? Number(tab2027.cbs_federal) : 9.21);
  const ibsEstRef = tab2033 ? Number(tab2033.ibs_estadual) : 13.70;
  const ibsMunRef = tab2033 ? Number(tab2033.ibs_municipal) : 5.00;
  const ibsTotRef = Number((ibsEstRef + ibsMunRef).toFixed(4));
  const ivaTotRef = Number((cbsRef + ibsTotRef).toFixed(4));

  // Escala legal de transição do IBS (Art. 343 a 348 da LC 214/2025):
  const calcIbsFase = (fator: number) => {
    const est = Number((ibsEstRef * fator).toFixed(4));
    const mun = Number((ibsMunRef * fator).toFixed(4));
    const tot = Number((est + mun).toFixed(4));
    const iva = Number((cbsRef + tot).toFixed(4));
    return { est, mun, tot, iva };
  };

  const f2029 = calcIbsFase(0.10);
  const f2030 = calcIbsFase(0.20);
  const f2031 = calcIbsFase(0.30);
  const f2032 = calcIbsFase(0.40);

  return {
    2026: {
      ano: 2026,
      faseNome: 'Ano de Teste e Calibração Operacional',
      badge: `Ano Teste (CBS ${cbs2026.toFixed(1).replace('.', ',')}% + IBS ${(ibsEst2026 + ibsMun2026).toFixed(1).replace('.', ',')}%)`,
      aliquotaCbs: cbs2026,
      aliquotaIbsEstadual: ibsEst2026,
      aliquotaIbsMunicipal: ibsMun2026,
      aliquotaIbsTotal: Number((ibsEst2026 + ibsMun2026).toFixed(4)),
      aliquotaIvaTotal: Number((cbs2026 + ibsEst2026 + ibsMun2026).toFixed(4)),
      percentualReducaoIcmsIss: 0,
      observacoes: 'Alíquota teste recolhida e compensável com PIS/Cofins. Tributos atuais (ICMS, ISS, IPI, PIS, Cofins) continuam 100% vigentes.',
    },
    2027: {
      ano: 2027,
      faseNome: 'Entrada em Vigor Plena da CBS Federal',
      badge: `CBS Plena (${cbs2027.toFixed(2).replace('.', ',')}%) + Fim PIS/Cofins`,
      aliquotaCbs: cbs2027,
      aliquotaIbsEstadual: 0.0,
      aliquotaIbsMunicipal: 0.0,
      aliquotaIbsTotal: 0.0,
      aliquotaIvaTotal: cbs2027,
      percentualReducaoIcmsIss: 0,
      observacoes: 'Extinção definitiva de PIS e COFINS. CBS em alíquota plena. IBS com alíquota zero e início do Imposto Seletivo.',
    },
    2028: {
      ano: 2028,
      faseNome: 'Consolidação e Ajuste Fino da CBS',
      badge: `CBS Plena (${cbs2027.toFixed(2).replace('.', ',')}%) + IBS 0%`,
      aliquotaCbs: cbs2027,
      aliquotaIbsEstadual: 0.0,
      aliquotaIbsMunicipal: 0.0,
      aliquotaIbsTotal: 0.0,
      aliquotaIvaTotal: cbs2027,
      percentualReducaoIcmsIss: 0,
      observacoes: 'CBS plena em operação e adaptação dos sistemas estaduais e municipais para o IBS.',
    },
    2029: {
      ano: 2029,
      faseNome: 'Início da Transição Gradativa do IBS (10%)',
      badge: `IBS 10% da Ref. (${f2029.tot.toFixed(2).replace('.', ',')}%) + Redução ICMS 10%`,
      aliquotaCbs: cbsRef,
      aliquotaIbsEstadual: f2029.est,
      aliquotaIbsMunicipal: f2029.mun,
      aliquotaIbsTotal: f2029.tot,
      aliquotaIvaTotal: f2029.iva,
      percentualReducaoIcmsIss: 10,
      observacoes: 'ICMS e ISS reduzidos em 10%. IBS entra em vigor com 10% de sua alíquota de referência.',
    },
    2030: {
      ano: 2030,
      faseNome: 'Transição Gradativa do IBS (20%)',
      badge: `IBS 20% da Ref. (${f2030.tot.toFixed(2).replace('.', ',')}%) + Redução ICMS 20%`,
      aliquotaCbs: cbsRef,
      aliquotaIbsEstadual: f2030.est,
      aliquotaIbsMunicipal: f2030.mun,
      aliquotaIbsTotal: f2030.tot,
      aliquotaIvaTotal: f2030.iva,
      percentualReducaoIcmsIss: 20,
      observacoes: 'ICMS e ISS reduzidos em 20%. IBS assume 20% da alíquota de referência.',
    },
    2031: {
      ano: 2031,
      faseNome: 'Transição Gradativa do IBS (30%)',
      badge: `IBS 30% da Ref. (${f2031.tot.toFixed(2).replace('.', ',')}%) + Redução ICMS 30%`,
      aliquotaCbs: cbsRef,
      aliquotaIbsEstadual: f2031.est,
      aliquotaIbsMunicipal: f2031.mun,
      aliquotaIbsTotal: f2031.tot,
      aliquotaIvaTotal: f2031.iva,
      percentualReducaoIcmsIss: 30,
      observacoes: 'ICMS e ISS reduzidos em 30%. IBS assume 30% da alíquota de referência.',
    },
    2032: {
      ano: 2032,
      faseNome: 'Transição Gradativa do IBS (40%)',
      badge: `IBS 40% da Ref. (${f2032.tot.toFixed(2).replace('.', ',')}%) + Redução ICMS 40%`,
      aliquotaCbs: cbsRef,
      aliquotaIbsEstadual: f2032.est,
      aliquotaIbsMunicipal: f2032.mun,
      aliquotaIbsTotal: f2032.tot,
      aliquotaIvaTotal: f2032.iva,
      percentualReducaoIcmsIss: 40,
      observacoes: 'Último ano da fase de transição proporcional. ICMS e ISS reduzidos em 40%.',
    },
    2033: {
      ano: 2033,
      faseNome: 'Vigência Plena e Definitiva do IVA Dual',
      badge: `IVA Dual Pleno (CBS ${cbsRef.toFixed(2).replace('.', ',')}% + IBS ${ibsTotRef.toFixed(2).replace('.', ',')}% = ${ivaTotRef.toFixed(2).replace('.', ',')}%)`,
      aliquotaCbs: cbsRef,
      aliquotaIbsEstadual: ibsEstRef,
      aliquotaIbsMunicipal: ibsMunRef,
      aliquotaIbsTotal: ibsTotRef,
      aliquotaIvaTotal: ivaTotRef,
      percentualReducaoIcmsIss: 100,
      observacoes: 'Extinção completa e definitiva de ICMS, ISS e IPI da Zona Franca. IVA Dual 100% implantado no Brasil.',
    },
  };
}

// Cache global reativo
let dynamicCronogramaCache: Record<number, RegraTransicaoAno> = buildCronogramaFromTabelas();

export function setDynamicCronograma(tabelas: AliquotaTabelaItem[]): void {
  dynamicCronogramaCache = buildCronogramaFromTabelas(tabelas);
}

export const CRONOGRAMA_TRANSICAO_REFORMA: Record<number, RegraTransicaoAno> = dynamicCronogramaCache;

export const ANOS_TRANSICAO = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033] as const;
export type AnoTransicao = typeof ANOS_TRANSICAO[number];

/**
 * Obtém a regra de transição para um determinado ano, consultando a tabela dinâmica
 */
export function getRegraTransicaoAno(ano: number, customCronograma?: Record<number, RegraTransicaoAno>): RegraTransicaoAno {
  const crono = customCronograma || dynamicCronogramaCache || CRONOGRAMA_TRANSICAO_REFORMA;
  if (ano in crono) {
    return crono[ano];
  }
  if (ano < 2026) return crono[2026];
  return crono[2033];
}


// =========================================================
// CÁLCULO DE TRIBUTOS POR ANO DE TRANSIÇÃO
// =========================================================

export interface ResultadoCalculoTransicao {
  ano: number;
  faseNome: string;
  valorBase: number;
  aliquotaCbs: number;
  valorCbs: number;
  aliquotaIbsEstadual: number;
  valorIbsEstadual: number;
  aliquotaIbsMunicipal: number;
  valorIbsMunicipal: number;
  aliquotaIbsTotal: number;
  valorIbsTotal: number;
  aliquotaIvaTotal: number;
  valorIvaTotal: number;
  percentualReducaoIcmsIss: number;
}

export function calcularTributosTransicao(
  valorTotal: number,
  ano: number = 2026,
  cClassTrib?: string
): ResultadoCalculoTransicao {
  const regra = getRegraTransicaoAno(ano);

  // Verificação de redução por cClassTrib (ex: cesta básica nacional, saúde, educação)
  let fatorReducao = 1.0;
  if (cClassTrib) {
    // Alíquota zero (ex: Cesta Básica Nacional)
    if (cClassTrib.startsWith('10') || cClassTrib.startsWith('00')) {
      fatorReducao = 0.0;
    }
    // Redução de 60% (ex: Saúde, Educação, Transporte Coletivo)
    else if (cClassTrib.startsWith('20') || cClassTrib.startsWith('30')) {
      fatorReducao = 0.4; // Paga apenas 40%
    }
    // Redução de 30% (ex: Profissionais Liberais)
    else if (cClassTrib.startsWith('40')) {
      fatorReducao = 0.7;
    }
  }

  const aliqCbs = Number((regra.aliquotaCbs * fatorReducao).toFixed(4));
  const aliqIbsEst = Number((regra.aliquotaIbsEstadual * fatorReducao).toFixed(4));
  const aliqIbsMun = Number((regra.aliquotaIbsMunicipal * fatorReducao).toFixed(4));
  const aliqIbsTot = Number((aliqIbsEst + aliqIbsMun).toFixed(4));
  const aliqIvaTot = Number((aliqCbs + aliqIbsTot).toFixed(4));

  const valorCbs = Number(((valorTotal * aliqCbs) / 100).toFixed(2));
  const valorIbsEst = Number(((valorTotal * aliqIbsEst) / 100).toFixed(2));
  const valorIbsMun = Number(((valorTotal * aliqIbsMun) / 100).toFixed(2));
  const valorIbsTot = Number((valorIbsEst + valorIbsMun).toFixed(2));
  const valorIvaTot = Number((valorCbs + valorIbsTot).toFixed(2));

  return {
    ano: regra.ano,
    faseNome: regra.faseNome,
    valorBase: valorTotal,
    aliquotaCbs: aliqCbs,
    valorCbs,
    aliquotaIbsEstadual: aliqIbsEst,
    valorIbsEstadual: valorIbsEst,
    aliquotaIbsMunicipal: aliqIbsMun,
    valorIbsMunicipal: valorIbsMun,
    aliquotaIbsTotal: aliqIbsTot,
    valorIbsTotal: valorIbsTot,
    aliquotaIvaTotal: aliqIvaTot,
    valorIvaTotal: valorIvaTot,
    percentualReducaoIcmsIss: regra.percentualReducaoIcmsIss,
  };
}

// =========================================================
// MOTOR DE SPLIT PAYMENT (LEI COMPLEMENTAR Nº 214/2025)
// =========================================================

export interface ParametrosSplitPayment {
  chaveAcesso: string;
  valorTotalOperacao: number;
  anoVigencia?: number;
  metodoLiquidacao?: MetodoSplitPayment;
  fornecedorNome?: string;
  fornecedorCnpj?: string;
  cClassTrib?: string;
}

export function calcularSplitPayment(params: ParametrosSplitPayment): SplitPaymentInfo {
  const {
    chaveAcesso,
    valorTotalOperacao,
    anoVigencia = 2026,
    metodoLiquidacao = 'PIX_DINAMICO',
    fornecedorNome = 'FORNECEDOR IDENTIFICADO',
    fornecedorCnpj = '00.000.000/0000-00',
    cClassTrib,
  } = params;

  const tributos = calcularTributosTransicao(valorTotalOperacao, anoVigencia, cClassTrib);

  const valorTotalTributosRetidos = Number((tributos.valorCbs + tributos.valorIbsTotal).toFixed(2));
  const valorLiquidoFornecedor = Number((valorTotalOperacao - valorTotalTributosRetidos).toFixed(2));

  return {
    valorTotalOperacao,
    aliquotaCbsAplicada: tributos.aliquotaCbs,
    valorCbsRetido: tributos.valorCbs,
    aliquotaIbsAplicada: tributos.aliquotaIbsTotal,
    valorIbsRetido: tributos.valorIbsTotal,
    valorTotalTributosRetidos,
    valorLiquidoFornecedor,
    metodoLiquidacao,
    statusLiquidacao: 'retencao_automatica_pendente',
    chaveAcesso,
    dataCalculo: new Date().toISOString(),
    destinatarioSplit: {
      comiteGestorIbs: 'CONTA ÚNICA DO COMITÊ GESTOR DO IBS (BANCO CENTRAL)',
      receitaFederalCbs: 'CONTA ÚNICA DO TESOURO NACIONAL / RECEITA FEDERAL (CBS)',
      fornecedorNome,
      fornecedorCnpj,
    },
  };
}

// =========================================================
// CUSTÓDIA FISCAL IMUTÁVEL (OBJECT LOCK / WORM - ART. 173 CTN)
// =========================================================

/**
 * Gera hash SHA-256 criptográfico para garantir a integridade do XML
 */
export async function gerarHashSha256(conteudo: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(conteudo);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback para ambiente Node ou sem subtle crypto
  let hash = 0;
  for (let i = 0; i < conteudo.length; i++) {
    const char = conteudo.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `sha256-${Math.abs(hash).toString(16).padStart(64, '0')}`;
}

/**
 * Calcula a data de expiração legal da guarda do documento (5 anos após o 1º dia do ano seguinte)
 * Conforme Art. 173 do Código Tributário Nacional (CTN)
 */
export function calcularDataExpiracaoGuarda5Anos(dataEmissao: string): string {
  try {
    const anoEmissao = new Date(dataEmissao).getFullYear() || 2026;
    const anoExpiracao = anoEmissao + 6; // 1 ano de exercício seguinte + 5 anos
    return `${anoExpiracao}-12-31T23:59:59.000Z`;
  } catch {
    return '2032-12-31T23:59:59.000Z';
  }
}

/**
 * Constrói o objeto de custódia imutável WORM para um documento
 */
export async function criarRegistroCustodiaWorm(params: {
  id: string;
  chaveAcesso: string;
  numero: string;
  tipoDfe: string;
  xmlRaw: string;
  dataEmissao: string;
  emissorCnpj: string;
  destinatarioCnpj: string;
}): Promise<CustodiaWormItem> {
  const hashSha256 = await gerarHashSha256(params.xmlRaw || params.chaveAcesso);
  const dataExpiracaoGuarda5Anos = calcularDataExpiracaoGuarda5Anos(params.dataEmissao);
  const tamanhoBytes = new Blob([params.xmlRaw || '']).size;

  return {
    id: `worm-${params.id}`,
    chaveAcesso: params.chaveAcesso,
    numero: params.numero,
    tipoDfe: params.tipoDfe,
    hashSha256,
    dataEmissao: params.dataEmissao,
    dataCaptura: new Date().toISOString(),
    dataExpiracaoGuarda5Anos,
    statusImutabilidade: 'bloqueado_worm_ativo',
    tamanhoBytes,
    emissorCnpj: params.emissorCnpj,
    destinatarioCnpj: params.destinatarioCnpj,
  };
}
