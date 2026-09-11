/**
 * ============================================================================
 * RADAR CONFORMIDADE FISCAL — PARÂMETROS FISCAIS & TABELAS DE REGIMES
 * ============================================================================
 * Base Normativa:
 * - Lei Complementar nº 123/2006 (Simples Nacional) alterada pela LC nº 155/2016
 * - Resolução CGSN nº 140/2018 (Art. 18, § 5º-E - Transporte de Cargas)
 * - Emenda Constitucional nº 132/2023 & Lei Complementar nº 214/2025 / LC nº 227
 * - Lei nº 9.249/1995 (Arts. 15 e 20 - Lucro Presumido)
 * - RIR/2018 (Decreto nº 9.580/2018, Art. 623 - Adicional de 10% do IRPJ)
 * - Lei nº 8.212/1991 (Encargos Previdenciários Patronais - CPP / RAT / Sistema S)
 * ============================================================================
 */

export interface FaixaSimples {
  faixa: number;
  limite: number;
  aliqNominal: number;
  deducao: number;
  // Repartição percentual dos tributos na faixa da LC 123/2006
  reparticao: {
    irpj: number;
    csll: number;
    cofins: number;
    pis: number;
    cpp: number;
    icms?: number;
    iss?: number;
    ipi?: number;
  };
}

export interface TabelaSimplesAnexo {
  id: string;
  nome: string;
  descricao: string;
  faixas: FaixaSimples[];
  // Fração de desoneração do IBS e CBS no DAS (Simples Híbrido) por ano de transição (LC 214/227)
  partilhaReforma: Record<string, number[]>;
}

// 1. TABELAS OFICIAIS DO SIMPLES NACIONAL (LC 123/2006)
export const TABELAS_SIMPLES: Record<string, TabelaSimplesAnexo> = {
  anexo1: {
    id: 'anexo1',
    nome: 'Anexo I - Comércio',
    descricao: 'Revenda de mercadorias no atacado e varejo',
    faixas: [
      { faixa: 1, limite: 180000, aliqNominal: 0.040, deducao: 0, reparticao: { irpj: 0.055, csll: 0.035, cofins: 0.1274, pis: 0.0276, cpp: 0.4150, icms: 0.3400 } },
      { faixa: 2, limite: 360000, aliqNominal: 0.073, deducao: 5940, reparticao: { irpj: 0.055, csll: 0.035, cofins: 0.1274, pis: 0.0276, cpp: 0.4150, icms: 0.3400 } },
      { faixa: 3, limite: 720000, aliqNominal: 0.095, deducao: 13860, reparticao: { irpj: 0.055, csll: 0.035, cofins: 0.1274, pis: 0.0276, cpp: 0.4200, icms: 0.3350 } },
      { faixa: 4, limite: 1800000, aliqNominal: 0.107, deducao: 22500, reparticao: { irpj: 0.055, csll: 0.035, cofins: 0.1274, pis: 0.0276, cpp: 0.4200, icms: 0.3350 } },
      { faixa: 5, limite: 3600000, aliqNominal: 0.143, deducao: 87300, reparticao: { irpj: 0.055, csll: 0.035, cofins: 0.1274, pis: 0.0276, cpp: 0.4200, icms: 0.3350 } },
      { faixa: 6, limite: 4800000, aliqNominal: 0.190, deducao: 378000, reparticao: { irpj: 0.135, csll: 0.100, cofins: 0.2827, pis: 0.0613, cpp: 0.4210, icms: 0.0000 } }
    ],
    partilhaReforma: {
      '2027': [0.1550, 0.1550, 0.1550, 0.1550, 0.1550, 0.3402],
      '2029': [0.1890, 0.1890, 0.1885, 0.1885, 0.1885, 0.3440],
      '2030': [0.2230, 0.2230, 0.2220, 0.2220, 0.2220, 0.3440],
      '2031': [0.2570, 0.2570, 0.2555, 0.2555, 0.2555, 0.3440],
      '2032': [0.2910, 0.2910, 0.2890, 0.2890, 0.2890, 0.3440],
      '2033': [0.4950, 0.4950, 0.4900, 0.4900, 0.4900, 0.3440]
    }
  },
  anexo2: {
    id: 'anexo2',
    nome: 'Anexo II - Indústria',
    descricao: 'Fabricação e industrialização de produtos',
    faixas: [
      { faixa: 1, limite: 180000, aliqNominal: 0.045, deducao: 0, reparticao: { irpj: 0.055, csll: 0.035, cofins: 0.1151, pis: 0.0249, cpp: 0.3750, icms: 0.3200, ipi: 0.0750 } },
      { faixa: 2, limite: 360000, aliqNominal: 0.078, deducao: 5940, reparticao: { irpj: 0.055, csll: 0.035, cofins: 0.1151, pis: 0.0249, cpp: 0.3750, icms: 0.3200, ipi: 0.0750 } },
      { faixa: 3, limite: 720000, aliqNominal: 0.100, deducao: 13860, reparticao: { irpj: 0.055, csll: 0.035, cofins: 0.1151, pis: 0.0249, cpp: 0.3750, icms: 0.3200, ipi: 0.0750 } },
      { faixa: 4, limite: 1800000, aliqNominal: 0.112, deducao: 22500, reparticao: { irpj: 0.055, csll: 0.035, cofins: 0.1151, pis: 0.0249, cpp: 0.3750, icms: 0.3200, ipi: 0.0750 } },
      { faixa: 5, limite: 3600000, aliqNominal: 0.147, deducao: 85500, reparticao: { irpj: 0.055, csll: 0.035, cofins: 0.1151, pis: 0.0249, cpp: 0.3750, icms: 0.3200, ipi: 0.0750 } },
      { faixa: 6, limite: 4800000, aliqNominal: 0.300, deducao: 720000, reparticao: { irpj: 0.085, csll: 0.075, cofins: 0.2096, pis: 0.0454, cpp: 0.4000, icms: 0.0000, ipi: 0.1850 } }
    ],
    partilhaReforma: {
      '2027': [0.1400, 0.1400, 0.1400, 0.1400, 0.1400, 0.2522],
      '2029': [0.1720, 0.1720, 0.1720, 0.1720, 0.1720, 0.2550],
      '2030': [0.2040, 0.2040, 0.2040, 0.2040, 0.2040, 0.2550],
      '2031': [0.2360, 0.2360, 0.2360, 0.2360, 0.2360, 0.2550],
      '2032': [0.2680, 0.2680, 0.2680, 0.2680, 0.2680, 0.2550],
      '2033': [0.4600, 0.4600, 0.4600, 0.4600, 0.4600, 0.2550]
    }
  },
  anexo3: {
    id: 'anexo3',
    nome: 'Anexo III - Serviços em Geral & Locação',
    descricao: 'Serviços em geral, manutenção, instalação, locação e transporte municipal',
    faixas: [
      { faixa: 1, limite: 180000, aliqNominal: 0.060, deducao: 0, reparticao: { irpj: 0.040, csll: 0.035, cofins: 0.1282, pis: 0.0278, cpp: 0.4340, iss: 0.3350 } },
      { faixa: 2, limite: 360000, aliqNominal: 0.112, deducao: 9360, reparticao: { irpj: 0.040, csll: 0.035, cofins: 0.1405, pis: 0.0305, cpp: 0.4340, iss: 0.3200 } },
      { faixa: 3, limite: 720000, aliqNominal: 0.135, deducao: 17640, reparticao: { irpj: 0.040, csll: 0.035, cofins: 0.1364, pis: 0.0296, cpp: 0.4340, iss: 0.3250 } },
      { faixa: 4, limite: 1800000, aliqNominal: 0.160, deducao: 35640, reparticao: { irpj: 0.040, csll: 0.035, cofins: 0.1360, pis: 0.0295, cpp: 0.4340, iss: 0.3250 } },
      { faixa: 5, limite: 3600000, aliqNominal: 0.210, deducao: 125640, reparticao: { irpj: 0.040, csll: 0.035, cofins: 0.1282, pis: 0.0278, cpp: 0.4340, iss: 0.3350 } },
      { faixa: 6, limite: 4800000, aliqNominal: 0.330, deducao: 648000, reparticao: { irpj: 0.350, csll: 0.150, cofins: 0.1603, pis: 0.0347, cpp: 0.3050, iss: 0.0000 } }
    ],
    partilhaReforma: {
      '2027': [0.1560, 0.1710, 0.1660, 0.1660, 0.1560, 0.1929],
      '2029': [0.1895, 0.2030, 0.1985, 0.1985, 0.1895, 0.1950],
      '2030': [0.2230, 0.2350, 0.2310, 0.2310, 0.2230, 0.1950],
      '2031': [0.2565, 0.2670, 0.2635, 0.2635, 0.2565, 0.1950],
      '2032': [0.2900, 0.2990, 0.2960, 0.2960, 0.2900, 0.1950],
      '2033': [0.4910, 0.4910, 0.4910, 0.4910, 0.4910, 0.1950]
    }
  },
  transporte_cargas: {
    id: 'transporte_cargas',
    nome: 'Transporte Intermunicipal/Interestadual de Cargas (Art. 18, § 5º-E)',
    descricao: 'Transporte rodoviário de cargas: Alíquota base Anexo III, deduzido ISS e acrescido ICMS do Anexo I',
    faixas: [
      // Para o transporte de cargas, a comutação oficial é calculada faixa a faixa
      { faixa: 1, limite: 180000, aliqNominal: 0.060, deducao: 0, reparticao: { irpj: 0.040, csll: 0.035, cofins: 0.1282, pis: 0.0278, cpp: 0.4340, icms: 0.3400, iss: 0.0000 } },
      { faixa: 2, limite: 360000, aliqNominal: 0.112, deducao: 9360, reparticao: { irpj: 0.040, csll: 0.035, cofins: 0.1405, pis: 0.0305, cpp: 0.4340, icms: 0.3400, iss: 0.0000 } },
      { faixa: 3, limite: 720000, aliqNominal: 0.135, deducao: 17640, reparticao: { irpj: 0.040, csll: 0.035, cofins: 0.1364, pis: 0.0296, cpp: 0.4340, icms: 0.3350, iss: 0.0000 } },
      { faixa: 4, limite: 1800000, aliqNominal: 0.160, deducao: 35640, reparticao: { irpj: 0.040, csll: 0.035, cofins: 0.1360, pis: 0.0295, cpp: 0.4340, icms: 0.3350, iss: 0.0000 } },
      { faixa: 5, limite: 3600000, aliqNominal: 0.210, deducao: 125640, reparticao: { irpj: 0.040, csll: 0.035, cofins: 0.1282, pis: 0.0278, cpp: 0.4340, icms: 0.3350, iss: 0.0000 } },
      { faixa: 6, limite: 4800000, aliqNominal: 0.330, deducao: 648000, reparticao: { irpj: 0.350, csll: 0.150, cofins: 0.1603, pis: 0.0347, cpp: 0.3050, icms: 0.0000, iss: 0.0000 } }
    ],
    partilhaReforma: {
      '2027': [0.1600, 0.1750, 0.1700, 0.1700, 0.1600, 0.2400],
      '2029': [0.1950, 0.2080, 0.2030, 0.2030, 0.1950, 0.2450],
      '2030': [0.2300, 0.2400, 0.2360, 0.2360, 0.2300, 0.2450],
      '2031': [0.2650, 0.2720, 0.2690, 0.2690, 0.2650, 0.2450],
      '2032': [0.3000, 0.3050, 0.3020, 0.3020, 0.3000, 0.2450],
      '2033': [0.4950, 0.4950, 0.4900, 0.4900, 0.4900, 0.3440]
    }
  },
  anexo4: {
    id: 'anexo4',
    nome: 'Anexo IV - Serviços (§ 5º-C)',
    descricao: 'Construção de imóveis, vigilância, limpeza e advocacia (SEM CPP inclusa no DAS)',
    faixas: [
      { faixa: 1, limite: 180000, aliqNominal: 0.045, deducao: 0, reparticao: { irpj: 0.1880, csll: 0.1520, cofins: 0.1767, pis: 0.0383, cpp: 0.0000, iss: 0.4450 } },
      { faixa: 2, limite: 360000, aliqNominal: 0.090, deducao: 8100, reparticao: { irpj: 0.1980, csll: 0.1520, cofins: 0.2055, pis: 0.0445, cpp: 0.0000, iss: 0.4000 } },
      { faixa: 3, limite: 720000, aliqNominal: 0.102, deducao: 12420, reparticao: { irpj: 0.2080, csll: 0.1520, cofins: 0.1973, pis: 0.0427, cpp: 0.0000, iss: 0.4000 } },
      { faixa: 4, limite: 1800000, aliqNominal: 0.140, deducao: 39780, reparticao: { irpj: 0.1780, csll: 0.1920, cofins: 0.1890, pis: 0.0410, cpp: 0.0000, iss: 0.4000 } },
      { faixa: 5, limite: 3600000, aliqNominal: 0.220, deducao: 183780, reparticao: { irpj: 0.1880, csll: 0.1920, cofins: 0.1808, pis: 0.0392, cpp: 0.0000, iss: 0.4000 } },
      { faixa: 6, limite: 4800000, aliqNominal: 0.330, deducao: 828000, reparticao: { irpj: 0.5350, csll: 0.2150, cofins: 0.2055, pis: 0.0440, cpp: 0.0000, iss: 0.0000 } }
    ],
    partilhaReforma: {
      '2027': [0.2150, 0.2500, 0.2400, 0.2300, 0.2200, 0.2470],
      '2029': [0.2595, 0.2900, 0.2800, 0.2700, 0.2600, 0.2500],
      '2030': [0.3040, 0.3300, 0.3200, 0.3100, 0.3000, 0.2500],
      '2031': [0.3485, 0.3700, 0.3600, 0.3500, 0.3400, 0.2500],
      '2032': [0.3930, 0.4100, 0.4000, 0.3900, 0.3800, 0.2500],
      '2033': [0.6600, 0.6500, 0.6400, 0.6300, 0.6200, 0.2500]
    }
  },
  anexo5: {
    id: 'anexo5',
    nome: 'Anexo V - Serviços (§ 5º-I)',
    descricao: 'Serviços intelectuais, engenharia, desenvolvimento de software, consultorias (Fator R < 28%)',
    faixas: [
      { faixa: 1, limite: 180000, aliqNominal: 0.155, deducao: 0, reparticao: { irpj: 0.2500, csll: 0.1500, cofins: 0.1410, pis: 0.0305, cpp: 0.2885, iss: 0.1400 } },
      { faixa: 2, limite: 360000, aliqNominal: 0.180, deducao: 4500, reparticao: { irpj: 0.2300, csll: 0.1500, cofins: 0.1410, pis: 0.0305, cpp: 0.2785, iss: 0.1700 } },
      { faixa: 3, limite: 720000, aliqNominal: 0.195, deducao: 9900, reparticao: { irpj: 0.2400, csll: 0.1500, cofins: 0.1492, pis: 0.0323, cpp: 0.2385, iss: 0.1900 } },
      { faixa: 4, limite: 1800000, aliqNominal: 0.205, deducao: 17100, reparticao: { irpj: 0.2100, csll: 0.1500, cofins: 0.1574, pis: 0.0341, cpp: 0.2385, iss: 0.2100 } },
      { faixa: 5, limite: 3600000, aliqNominal: 0.230, deducao: 62100, reparticao: { irpj: 0.2300, csll: 0.1250, cofins: 0.1410, pis: 0.0305, cpp: 0.2385, iss: 0.2350 } },
      { faixa: 6, limite: 4800000, aliqNominal: 0.305, deducao: 540000, reparticao: { irpj: 0.3500, csll: 0.1550, cofins: 0.1644, pis: 0.0356, cpp: 0.2950, iss: 0.0000 } }
    ],
    partilhaReforma: {
      '2027': [0.1715, 0.1715, 0.1815, 0.1915, 0.1715, 0.1978],
      '2029': [0.1855, 0.1885, 0.2005, 0.2125, 0.1950, 0.2000],
      '2030': [0.1995, 0.2055, 0.2195, 0.2335, 0.2185, 0.2000],
      '2031': [0.2135, 0.2225, 0.2385, 0.2545, 0.2420, 0.2000],
      '2032': [0.2275, 0.2395, 0.2575, 0.2755, 0.2655, 0.2000],
      '2033': [0.3115, 0.3415, 0.3715, 0.4015, 0.4065, 0.2000]
    }
  }
};

// 2. TABELA EXAUSTIVA DE PRESUNÇÃO DO LUCRO PRESUMIDO (LEI 9.249/1995 ARTS. 15 E 20)
export interface AtividadePresumido {
  id: string;
  nome: string;
  presuncaoIrpj: number;
  presuncaoCsll: number;
  artigoLegal: string;
  detalhe: string;
  categoria: 'combustiveis' | 'transporte' | 'comercio' | 'industria' | 'servicos' | 'imobiliario';
  anexoSimplesPadrao: string;
}

export const ATIVIDADES_LUCRO_PRESUMIDO: AtividadePresumido[] = [
  {
    id: 'combustiveis',
    nome: 'Revenda de Combustíveis & Gás Natural (Postos)',
    presuncaoIrpj: 0.016, // 1,6% (Art. 15, § 1º, I)
    presuncaoCsll: 0.120, // 12,0% (Art. 20, I - Não tem redução na CSLL!)
    artigoLegal: 'Lei 9.249/95, Art. 15, § 1º, I e Art. 20, I',
    detalhe: 'Revenda para consumo de derivados de petróleo, álcool combustível e gás natural. CSLL mantida em 12%.',
    categoria: 'combustiveis',
    anexoSimplesPadrao: 'anexo1'
  },
  {
    id: 'transporte_cargas',
    nome: 'Transporte Rodoviário & Aquaviário de Cargas',
    presuncaoIrpj: 0.080, // 8,0% (Art. 15, caput)
    presuncaoCsll: 0.120, // 12,0% (Art. 20, I)
    artigoLegal: 'Lei 9.249/95, Art. 15, caput e Art. 20, I; LC 123/06 Art. 18 § 5º-E',
    detalhe: 'Transporte intermunicipal e interestadual de cargas. No Simples, aplica comutação Anexo III - ISS + ICMS Anexo I.',
    categoria: 'transporte',
    anexoSimplesPadrao: 'transporte_cargas'
  },
  {
    id: 'comercio_geral',
    nome: 'Comércio em Geral (Atacado & Varejo)',
    presuncaoIrpj: 0.080, // 8,0%
    presuncaoCsll: 0.120, // 12,0%
    artigoLegal: 'Lei 9.249/95, Art. 15, caput e Art. 20, I',
    detalhe: 'Venda de mercadorias adquiridas de terceiros.',
    categoria: 'comercio',
    anexoSimplesPadrao: 'anexo1'
  },
  {
    id: 'industria_geral',
    nome: 'Indústria & Fabricação Própria',
    presuncaoIrpj: 0.080, // 8,0%
    presuncaoCsll: 0.120, // 12,0%
    artigoLegal: 'Lei 9.249/95, Art. 15, caput e Art. 20, I',
    detalhe: 'Venda de produtos industrializados e transformação fabril.',
    categoria: 'industria',
    anexoSimplesPadrao: 'anexo2'
  },
  {
    id: 'servicos_hospitalares',
    nome: 'Serviços Hospitalares & Clínicas Médicas (c/ internação/exames)',
    presuncaoIrpj: 0.080, // 8,0% (Equiparação hospitalar STJ Tema 125)
    presuncaoCsll: 0.120, // 12,0%
    artigoLegal: 'Lei 9.249/95, Art. 15, § 1º, III, "a" e Art. 20, I',
    detalhe: 'Serviços hospitalares, auxílio diagnóstico e terapia que atendam às normas da ANVISA.',
    categoria: 'servicos',
    anexoSimplesPadrao: 'anexo3'
  },
  {
    id: 'construcao_civil',
    nome: 'Construção Civil por Empreitada (com materiais)',
    presuncaoIrpj: 0.080, // 8,0%
    presuncaoCsll: 0.120, // 12,0%
    artigoLegal: 'Lei 9.249/95, Art. 15, § 1º, III, "a" e Art. 20, I',
    detalhe: 'Construção civil por empreitada global com fornecimento de todos os materiais.',
    categoria: 'servicos',
    anexoSimplesPadrao: 'anexo4'
  },
  {
    id: 'transporte_passageiros',
    nome: 'Transporte de Passageiros (Coletivo / Fretamento)',
    presuncaoIrpj: 0.160, // 16,0% (Art. 15, § 1º, II, "a")
    presuncaoCsll: 0.120, // 12,0%
    artigoLegal: 'Lei 9.249/95, Art. 15, § 1º, II, "a" e Art. 20, I',
    detalhe: 'Transporte intermunicipal e interestadual de pessoas, turismo e fretamento contínuo.',
    categoria: 'transporte',
    anexoSimplesPadrao: 'anexo3'
  },
  {
    id: 'servicos_120k',
    nome: 'Prestação de Serviços com Faturamento até R$ 120 mil/ano',
    presuncaoIrpj: 0.160, // 16,0% (Art. 15, § 2º)
    presuncaoCsll: 0.320, // 32,0%
    artigoLegal: 'Lei 9.249/95, Art. 15, § 2º e Art. 20, III',
    detalhe: 'Exclusivo para serviços comuns não regulamentados com receita bruta anual limitada a R$ 120.000.',
    categoria: 'servicos',
    anexoSimplesPadrao: 'anexo3'
  },
  {
    id: 'servicos_gerais',
    nome: 'Serviços em Geral (TI, Consultoria, Engenharia, Advocacia)',
    presuncaoIrpj: 0.320, // 32,0%
    presuncaoCsll: 0.320, // 32,0%
    artigoLegal: 'Lei 9.249/95, Art. 15, § 1º, III, "a" e Art. 20, III',
    detalhe: 'Serviços profissionais regulamentados, consultoria de negócios, tecnologia e projetos.',
    categoria: 'servicos',
    anexoSimplesPadrao: 'anexo5'
  },
  {
    id: 'locacao_bens',
    nome: 'Locação, Sublocação e Cessão de Bens Móveis/Imóveis',
    presuncaoIrpj: 0.320, // 32,0%
    presuncaoCsll: 0.320, // 32,0%
    artigoLegal: 'Lei 9.249/95, Art. 15, § 1º, III, "b" e Art. 20, III',
    detalhe: 'Aluguel de frotas, máquinas, equipamentos e imóveis próprios.',
    categoria: 'imobiliario',
    anexoSimplesPadrao: 'anexo3'
  },
  {
    id: 'intermediacao_corretagem',
    nome: 'Intermediação de Negócios & Corretagem',
    presuncaoIrpj: 0.320, // 32,0%
    presuncaoCsll: 0.320, // 32,0%
    artigoLegal: 'Lei 9.249/95, Art. 15, § 1º, III, "b" e Art. 20, III',
    detalhe: 'Representação comercial autônoma, corretagem de seguros e agenciamento.',
    categoria: 'servicos',
    anexoSimplesPadrao: 'anexo3'
  },
  {
    id: 'factoring_fomento',
    nome: 'Factoring / Fomento Mercantil & Direitos Creditórios',
    presuncaoIrpj: 0.320, // 32,0%
    presuncaoCsll: 0.320, // 32,0%
    artigoLegal: 'Lei 9.249/95, Art. 15, § 1º, III, "d" e Art. 20, III',
    detalhe: 'Assessoria creditícia e compra de direitos creditórios.',
    categoria: 'servicos',
    anexoSimplesPadrao: 'anexo3'
  }
];

// 3. PARÂMETROS PADRÃO DE ENCARGOS PATRONAIS FORA DO SIMPLES
export interface ParametrosEncargosPatronais {
  inssPatronal: number; // 20.0%
  ratFap: number;        // 1.0% a 3.0% (Frete de cargas grau 3 = 3.0%)
  sistemaSTerceiros: number; // 5.2% para Transportes (SEST/SENAT) ou 5.8% para Comércio/Serviços
  totalEncargos: number;
}

export const ENCARGOS_PADRAO_POR_ATIVIDADE: Record<string, ParametrosEncargosPatronais> = {
  transporte_cargas: {
    inssPatronal: 0.20,
    ratFap: 0.03, // Grau de risco 3 para transporte rodoviário de cargas
    sistemaSTerceiros: 0.052, // SEST/SENAT (2,5%) + Salário Educação (2,5%) + INCRA (0,2%)
    totalEncargos: 0.282 // 28,2%
  },
  transporte_passageiros: {
    inssPatronal: 0.20,
    ratFap: 0.03,
    sistemaSTerceiros: 0.052,
    totalEncargos: 0.282
  },
  comercio_geral: {
    inssPatronal: 0.20,
    ratFap: 0.02, // Grau de risco 2
    sistemaSTerceiros: 0.058, // SESC/SENAC (2,5%) + Sal. Educação (2,5%) + INCRA (0,2%) + Sebrae (0,6%)
    totalEncargos: 0.278 // 27,8%
  },
  industria_geral: {
    inssPatronal: 0.20,
    ratFap: 0.03, // Grau de risco 3
    sistemaSTerceiros: 0.058, // SESI/SENAI
    totalEncargos: 0.288 // 28,8%
  },
  padrao: {
    inssPatronal: 0.20,
    ratFap: 0.02,
    sistemaSTerceiros: 0.058,
    totalEncargos: 0.278
  }
};
