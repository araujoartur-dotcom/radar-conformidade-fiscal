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
    cClassTrib: '000001',
    descricaoInterna: 'Operação Tributada Integralmente IBS/CBS',
    tratamentoEsperado: 'tributado',
    permiteCredito: 'Sim',
    aliquotaEsperada: '26.5% (8.8% CBS + 17.7% IBS)',
    alertas: 'Verificar se houver destaque zerado em documento tributado.'
  },
  {
    cClassTrib: '100001',
    descricaoInterna: 'Alíquota Reduzida de Cesta Básica / Saúde',
    tratamentoEsperado: 'aliquota_reduzida',
    permiteCredito: 'Sim',
    aliquotaEsperada: '10.6% (60% de Redução IBS/CBS)',
    alertas: 'Conferir enquadramento NCM na lista anexa do regulamento.'
  },
  {
    cClassTrib: '200001',
    descricaoInterna: 'Isenção / Imunidade Constitucional',
    tratamentoEsperado: 'isento',
    permiteCredito: 'Não',
    aliquotaEsperada: '0.00%',
    alertas: 'Crédito bloqueado por ausência de incidência na entrada.'
  },
  {
    cClassTrib: '300001',
    descricaoInterna: 'Não Incidência / Exportação',
    tratamentoEsperado: 'nao_incidencia',
    permiteCredito: 'Não',
    aliquotaEsperada: '0.00%',
    alertas: 'Não gera crédito de entrada.'
  },
  {
    cClassTrib: '900001',
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
export const INITIAL_XML_ITEM_REPORTS: XmlItemDetailReport[] = [];

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
