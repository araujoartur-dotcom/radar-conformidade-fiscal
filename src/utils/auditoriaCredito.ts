/**
 * ============================================================
 * MOTOR DE AUDITORIA E ELEGIBILIDADE DE CRÉDITOS (CBS / IBS)
 * ============================================================
 * Análise de Não-Cumulatividade Plena, Onerosidade e Idoneidade
 * conforme Emenda Constitucional nº 132/2023 e LC nº 214/2025.
 * ============================================================
 */

import { DfeXmlItem, ItemDfeDetail } from '../types';

export type StatusCreditoTributario =
  | 'CREDITO_PLENO'
  | 'CREDITO_REDUZIDO'
  | 'VEDADO_SEM_ONEROSIDADE'
  | 'ISENTO_ALIQUOTA_ZERO'
  | 'PENDENTE_VALIDACAO';

export interface ParecerCreditoItem {
  itemNumero: number;
  descricao: string;
  cfop: string;
  ncm: string;
  cClassTrib: string;
  valorItem: number;
  statusCredito: StatusCreditoTributario;
  percentualCreditoPermitido: number; // 0% a 100%
  valorCreditoCbsEstimado: number;
  valorCreditoIbsEstimado: number;
  fundamentacaoLegal: string;
  alertas: string[];
}

export interface ParecerCreditoDocumento {
  chaveAcesso: string;
  valorTotalDocumento: number;
  valorTotalCreditoCbs: number;
  valorTotalCreditoIbs: number;
  valorTotalCreditoIva: number;
  taxaAproveitamentoGeral: number; // % do total
  itensAvaliados: ParecerCreditoItem[];
  resumoAuditoria: {
    itensPlenos: number;
    itensReduzidos: number;
    itensVedados: number;
    itensIsentos: number;
  };
}

// CFOPs que caracterizam operação onerosa com direito presumido a crédito pleno
const CFOPS_ONEROSOS_COMPRA = [
  '1101', '1102', '2101', '2102', '3101', '3102', // Comercialização
  '1116', '1117', '2116', '2117',
  '1120', '1121', '2120', '2121',
  '1126', '2126',
  '1551', '2551', '3551', // Ativo Imobilizado
  '1556', '2556', '3556', // Uso e Consumo
  '1352', '1353', '2352', '2353', // Frete
];

// CFOPs não onerosos (remessa, bonificação, empréstimo, comodato) com vedação de crédito
const CFOPS_NAO_ONEROSOS_VEDADOS = [
  '1910', '2910', '5910', '6910', // Bonificação / Doação
  '1915', '2915', '5915', '6915', // Conserto / Reparo
  '1908', '2908', '5908', '6908', // Comodato
  '1911', '2911', '5911', '6911', // Amostra Grátis
  '1949', '2949', '5949', '6949', // Outra Saída/Entrada não especificada
];

export function auditarItemCredito(
  item: Partial<ItemDfeDetail>,
  index: number = 0,
  regimeEmitente: string = 'Lucro Real',
  aliquotaCbsDoc: number = 8.8,
  aliquotaIbsDoc: number = 17.7
): ParecerCreditoItem {
  const cfop = item.cfop || '1102';
  const cClassTrib = item.cClassTrib || '000001';
  const valor = item.valorTotal || 0;
  const alertas: string[] = [];

  let status: StatusCreditoTributario = 'CREDITO_PLENO';
  let percentualPermitido = 100;
  let fundamentacao = 'Art. 28 LC 214/2025: Operação onerosa de aquisição de insumos/bens gera direito a crédito amplo e irrestrito de CBS e IBS.';

  // 1. Verificação por CFOP (Onerosidade)
  if (CFOPS_NAO_ONEROSOS_VEDADOS.includes(cfop)) {
    status = 'VEDADO_SEM_ONEROSIDADE';
    percentualPermitido = 0;
    fundamentacao = 'Art. 32 LC 214/2025: Veda-se a apropriação de créditos de CBS/IBS sobre operações a título gratuito, bonificações não-onerosas ou simples remessas.';
    alertas.push(`CFOP ${cfop} indica remessa não-onerosa: Crédito vedado pela legislação.`);
  }
  // 2. Verificação de Alíquota Zero / Cesta Básica
  else if (cClassTrib.startsWith('10') || cClassTrib.startsWith('000000')) {
    status = 'ISENTO_ALIQUOTA_ZERO';
    percentualPermitido = 0;
    fundamentacao = 'Art. 8º da EC 132/2023: Itens da Cesta Básica Nacional e imunidades constitucionais não possuem destaque de tributo na entrada.';
    alertas.push('Item com alíquota zero (Cesta Básica Nacional / Imunidade).');
  }
  // 3. Verificação de Redução de Alíquota (ex: Saúde / Educação - 60% de redução)
  else if (cClassTrib.startsWith('20') || cClassTrib.startsWith('30')) {
    status = 'CREDITO_REDUZIDO';
    percentualPermitido = 40; // Paga e credita apenas sobre a base reduzida de 40%
    fundamentacao = 'Art. 9º da EC 132/2023: Regime favorecido com redução de 60% na alíquota. Crédito proporcional ao imposto efetivamente destacado.';
    alertas.push('Regime favorecido: Crédito apurado sobre alíquota reduzida.');
  }
  // 4. Fornecedor Optante pelo Simples Nacional
  else if (regimeEmitente.toLowerCase().includes('simples') || regimeEmitente.toLowerCase().includes('mei')) {
    status = 'CREDITO_REDUZIDO';
    percentualPermitido = 35; // Crédito restrito à alíquota de ICMS/ISS na guia do DAS
    fundamentacao = 'Art. 146-A da CF/88: Aquisições de optantes pelo Simples Nacional geram crédito limitado ao montante recolhido no PGDAS.';
    alertas.push('Fornecedor do Simples Nacional: Crédito limitado ao montante recolhido no DAS.');
  }

  const baseCalculo = (valor * percentualPermitido) / 100;
  const valorCreditoCbs = Number(((baseCalculo * aliquotaCbsDoc) / 100).toFixed(2));
  const valorCreditoIbs = Number(((baseCalculo * aliquotaIbsDoc) / 100).toFixed(2));

  return {
    itemNumero: item.numeroItem || (index + 1),
    descricao: item.descricao || 'ITEM DA NOTA FISCAL',
    cfop,
    ncm: item.ncm || '00000000',
    cClassTrib,
    valorItem: valor,
    statusCredito: status,
    percentualCreditoPermitido: percentualPermitido,
    valorCreditoCbsEstimado: valorCreditoCbs,
    valorCreditoIbsEstimado: valorCreditoIbs,
    fundamentacaoLegal: fundamentacao,
    alertas,
  };
}

export function auditarDocumentoCreditos(
  doc: DfeXmlItem,
  regimeEmitente: string = 'Lucro Real'
): ParecerCreditoDocumento {
  const itens = doc.itens && doc.itens.length > 0
    ? doc.itens
    : [{ numeroItem: 1, descricao: 'OPERAÇÃO GLOBAL', valorTotal: doc.valorTotal, cfop: '1102', ncm: '00000000' }];

  const itensAvaliados = itens.map((it, idx) =>
    auditarItemCredito(it, idx, regimeEmitente, doc.aliquotaCbs, doc.aliquotaIbs)
  );

  const totalCredCbs = itensAvaliados.reduce((acc, it) => acc + it.valorCreditoCbsEstimado, 0);
  const totalCredIbs = itensAvaliados.reduce((acc, it) => acc + it.valorCreditoIbsEstimado, 0);
  const totalCredIva = Number((totalCredCbs + totalCredIbs).toFixed(2));

  const totalTributoDestaque = Number((doc.valorCbs + doc.valorIbs).toFixed(2));
  const taxaAproveitamento = totalTributoDestaque > 0
    ? Number(((totalCredIva / totalTributoDestaque) * 100).toFixed(1))
    : 100;

  const resumo = {
    itensPlenos: itensAvaliados.filter(i => i.statusCredito === 'CREDITO_PLENO').length,
    itensReduzidos: itensAvaliados.filter(i => i.statusCredito === 'CREDITO_REDUZIDO').length,
    itensVedados: itensAvaliados.filter(i => i.statusCredito === 'VEDADO_SEM_ONEROSIDADE').length,
    itensIsentos: itensAvaliados.filter(i => i.statusCredito === 'ISENTO_ALIQUOTA_ZERO').length,
  };

  return {
    chaveAcesso: doc.chaveAcesso,
    valorTotalDocumento: doc.valorTotal,
    valorTotalCreditoCbs: Number(totalCredCbs.toFixed(2)),
    valorTotalCreditoIbs: Number(totalCredIbs.toFixed(2)),
    valorTotalCreditoIva: totalCredIva,
    taxaAproveitamentoGeral: taxaAproveitamento,
    itensAvaliados,
    resumoAuditoria: resumo,
  };
}
