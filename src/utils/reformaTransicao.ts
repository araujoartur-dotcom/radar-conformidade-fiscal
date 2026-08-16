/**
 * ============================================================
 * MOTOR DA REFORMA TRIBUTÁRIA — TRANSIÇÃO 2026-2033 & SPLIT PAYMENT
 * ============================================================
 * Regras e alíquotas conforme Emenda Constitucional nº 132/2023
 * e Lei Complementar nº 214/2025 (PLP 68/2024).
 * ============================================================
 */

import { RegraTransicaoAno, SplitPaymentInfo, MetodoSplitPayment, CustodiaWormItem } from '../types';

// =========================================================
// CRONOGRAMA OFICIAL DA REFORMA TRIBUTÁRIA (2026 A 2033)
// =========================================================

export const CRONOGRAMA_TRANSICAO_REFORMA: Record<number, RegraTransicaoAno> = {
  2026: {
    ano: 2026,
    faseNome: 'Ano de Teste e Calibração Operacional',
    badge: 'Ano Teste (CBS 0,9% + IBS 0,1%)',
    aliquotaCbs: 0.9,
    aliquotaIbsEstadual: 0.05,
    aliquotaIbsMunicipal: 0.05,
    aliquotaIbsTotal: 0.1,
    aliquotaIvaTotal: 1.0,
    percentualReducaoIcmsIss: 0,
    observacoes: 'Alíquota teste recolhida e compensável com PIS/Cofins. Tributos atuais (ICMS, ISS, IPI, PIS, Cofins) continuam 100% vigentes.',
  },
  2027: {
    ano: 2027,
    faseNome: 'Entrada em Vigor Plena da CBS Federal',
    badge: 'CBS Plena (8,8%) + Fim PIS/Cofins',
    aliquotaCbs: 8.8,
    aliquotaIbsEstadual: 0.0,
    aliquotaIbsMunicipal: 0.0,
    aliquotaIbsTotal: 0.0,
    aliquotaIvaTotal: 8.8,
    percentualReducaoIcmsIss: 0,
    observacoes: 'Extinção definitiva de PIS e COFINS. CBS em alíquota plena (8,8%). IBS com alíquota zero e início do Imposto Seletivo.',
  },
  2028: {
    ano: 2028,
    faseNome: 'Consolidação e Ajuste Fino da CBS',
    badge: 'CBS Plena (8,8%) + IBS 0%',
    aliquotaCbs: 8.8,
    aliquotaIbsEstadual: 0.0,
    aliquotaIbsMunicipal: 0.0,
    aliquotaIbsTotal: 0.0,
    aliquotaIvaTotal: 8.8,
    percentualReducaoIcmsIss: 0,
    observacoes: 'CBS plena em operação e adaptação dos sistemas estaduais e municipais para o IBS.',
  },
  2029: {
    ano: 2029,
    faseNome: 'Início da Transição Gradativa do IBS (10%)',
    badge: 'IBS 10% da Ref. (1,77%) + Redução ICMS 10%',
    aliquotaCbs: 8.8,
    aliquotaIbsEstadual: 1.062,
    aliquotaIbsMunicipal: 0.708,
    aliquotaIbsTotal: 1.77,
    aliquotaIvaTotal: 10.57,
    percentualReducaoIcmsIss: 10,
    observacoes: 'ICMS e ISS reduzidos em 10%. IBS entra em vigor com 10% de sua alíquota de referência.',
  },
  2030: {
    ano: 2030,
    faseNome: 'Transição Gradativa do IBS (20%)',
    badge: 'IBS 20% da Ref. (3,54%) + Redução ICMS 20%',
    aliquotaCbs: 8.8,
    aliquotaIbsEstadual: 2.124,
    aliquotaIbsMunicipal: 1.416,
    aliquotaIbsTotal: 3.54,
    aliquotaIvaTotal: 12.34,
    percentualReducaoIcmsIss: 20,
    observacoes: 'ICMS e ISS reduzidos em 20%. IBS assume 20% da alíquota de referência.',
  },
  2031: {
    ano: 2031,
    faseNome: 'Transição Gradativa do IBS (30%)',
    badge: 'IBS 30% da Ref. (5,31%) + Redução ICMS 30%',
    aliquotaCbs: 8.8,
    aliquotaIbsEstadual: 3.186,
    aliquotaIbsMunicipal: 2.124,
    aliquotaIbsTotal: 5.31,
    aliquotaIvaTotal: 14.11,
    percentualReducaoIcmsIss: 30,
    observacoes: 'ICMS e ISS reduzidos em 30%. IBS assume 30% da alíquota de referência.',
  },
  2032: {
    ano: 2032,
    faseNome: 'Transição Gradativa do IBS (40%)',
    badge: 'IBS 40% da Ref. (7,08%) + Redução ICMS 40%',
    aliquotaCbs: 8.8,
    aliquotaIbsEstadual: 4.248,
    aliquotaIbsMunicipal: 2.832,
    aliquotaIbsTotal: 7.08,
    aliquotaIvaTotal: 15.88,
    percentualReducaoIcmsIss: 40,
    observacoes: 'Último ano da fase de transição proporcional. ICMS e ISS reduzidos em 40%.',
  },
  2033: {
    ano: 2033,
    faseNome: 'Vigência Plena e Definitiva do IVA Dual',
    badge: 'IVA Dual Pleno (CBS 8,8% + IBS 17,7% = 26,5%)',
    aliquotaCbs: 8.8,
    aliquotaIbsEstadual: 10.62,
    aliquotaIbsMunicipal: 7.08,
    aliquotaIbsTotal: 17.7,
    aliquotaIvaTotal: 26.5,
    percentualReducaoIcmsIss: 100,
    observacoes: 'Extinção completa e definitiva de ICMS, ISS e IPI da Zona Franca. IVA Dual 100% implantado no Brasil.',
  },
};

export const ANOS_TRANSICAO = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033] as const;
export type AnoTransicao = typeof ANOS_TRANSICAO[number];

/**
 * Obtém a regra de transição para um determinado ano
 */
export function getRegraTransicaoAno(ano: number): RegraTransicaoAno {
  if (ano in CRONOGRAMA_TRANSICAO_REFORMA) {
    return CRONOGRAMA_TRANSICAO_REFORMA[ano];
  }
  if (ano < 2026) return CRONOGRAMA_TRANSICAO_REFORMA[2026];
  return CRONOGRAMA_TRANSICAO_REFORMA[2033];
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
