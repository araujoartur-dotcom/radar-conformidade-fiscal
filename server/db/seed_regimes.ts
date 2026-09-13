/**
 * ============================================================================
 * SEED DE PARÂMETROS TRIBUTÁRIOS — SIMPLES NACIONAL, LUCRO PRESUMIDO & ENCARGOS
 * ============================================================================
 * Popula o banco com os parâmetros oficiais da LC 123/2006, LC 214/2025
 * e Lei 9.249/1995, permitindo que o usuário visualize e edite tudo
 * dentro do módulo de Parâmetros & Tabelas Fiscais.
 * ============================================================================
 */

import { v4 as uuid } from 'uuid';

export function seedRegimesParametros(db: any): void {
  seedSimplesNacional(db);
  seedLucroPresumido(db);
  seedEncargosPatronais(db);
}

export function seedSimplesNacional(db: any): void {
  try {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM simples_nacional_faixas').get() as any;
    if (countRow && countRow.count > 0) return;

    console.log('🌱 Populando faixas e alíquotas do Simples Nacional (LC 123/2006)...');

    const faixasData = [
      // ANEXO I - COMÉRCIO
      { anexo: 'anexo1', nome: 'Anexo I - Comércio', faixa: 1, limite: 180000, aliq: 0.040, ded: 0, irpj: 0.055, csll: 0.035, cof: 0.1274, pis: 0.0276, cpp: 0.4150, icms: 0.3400, iss: 0.0, ipi: 0.0 },
      { anexo: 'anexo1', nome: 'Anexo I - Comércio', faixa: 2, limite: 360000, aliq: 0.073, ded: 5940, irpj: 0.055, csll: 0.035, cof: 0.1274, pis: 0.0276, cpp: 0.4150, icms: 0.3400, iss: 0.0, ipi: 0.0 },
      { anexo: 'anexo1', nome: 'Anexo I - Comércio', faixa: 3, limite: 720000, aliq: 0.095, ded: 13860, irpj: 0.055, csll: 0.035, cof: 0.1274, pis: 0.0276, cpp: 0.4200, icms: 0.3350, iss: 0.0, ipi: 0.0 },
      { anexo: 'anexo1', nome: 'Anexo I - Comércio', faixa: 4, limite: 1800000, aliq: 0.107, ded: 22500, irpj: 0.055, csll: 0.035, cof: 0.1274, pis: 0.0276, cpp: 0.4200, icms: 0.3350, iss: 0.0, ipi: 0.0 },
      { anexo: 'anexo1', nome: 'Anexo I - Comércio', faixa: 5, limite: 3600000, aliq: 0.143, ded: 87300, irpj: 0.055, csll: 0.035, cof: 0.1274, pis: 0.0276, cpp: 0.4200, icms: 0.3350, iss: 0.0, ipi: 0.0 },
      { anexo: 'anexo1', nome: 'Anexo I - Comércio', faixa: 6, limite: 4800000, aliq: 0.190, ded: 378000, irpj: 0.135, csll: 0.100, cof: 0.2827, pis: 0.0613, cpp: 0.4210, icms: 0.0000, iss: 0.0, ipi: 0.0 },

      // ANEXO II - INDÚSTRIA
      { anexo: 'anexo2', nome: 'Anexo II - Indústria', faixa: 1, limite: 180000, aliq: 0.045, ded: 0, irpj: 0.055, csll: 0.035, cof: 0.1151, pis: 0.0249, cpp: 0.3750, icms: 0.3200, iss: 0.0, ipi: 0.0750 },
      { anexo: 'anexo2', nome: 'Anexo II - Indústria', faixa: 2, limite: 360000, aliq: 0.078, ded: 5940, irpj: 0.055, csll: 0.035, cof: 0.1151, pis: 0.0249, cpp: 0.3750, icms: 0.3200, iss: 0.0, ipi: 0.0750 },
      { anexo: 'anexo2', nome: 'Anexo II - Indústria', faixa: 3, limite: 720000, aliq: 0.100, ded: 13860, irpj: 0.055, csll: 0.035, cof: 0.1151, pis: 0.0249, cpp: 0.3750, icms: 0.3200, iss: 0.0, ipi: 0.0750 },
      { anexo: 'anexo2', nome: 'Anexo II - Indústria', faixa: 4, limite: 1800000, aliq: 0.112, ded: 22500, irpj: 0.055, csll: 0.035, cof: 0.1151, pis: 0.0249, cpp: 0.3750, icms: 0.3200, iss: 0.0, ipi: 0.0750 },
      { anexo: 'anexo2', nome: 'Anexo II - Indústria', faixa: 5, limite: 3600000, aliq: 0.147, ded: 85500, irpj: 0.055, csll: 0.035, cof: 0.1151, pis: 0.0249, cpp: 0.3750, icms: 0.3200, iss: 0.0, ipi: 0.0750 },
      { anexo: 'anexo2', nome: 'Anexo II - Indústria', faixa: 6, limite: 4800000, aliq: 0.300, ded: 720000, irpj: 0.085, csll: 0.075, cof: 0.2096, pis: 0.0454, cpp: 0.4000, icms: 0.0000, iss: 0.0, ipi: 0.1850 },

      // ANEXO III - SERVIÇOS
      { anexo: 'anexo3', nome: 'Anexo III - Serviços em Geral', faixa: 1, limite: 180000, aliq: 0.060, ded: 0, irpj: 0.040, csll: 0.035, cof: 0.1282, pis: 0.0278, cpp: 0.4340, icms: 0.0, iss: 0.3350, ipi: 0.0 },
      { anexo: 'anexo3', nome: 'Anexo III - Serviços em Geral', faixa: 2, limite: 360000, aliq: 0.112, ded: 9360, irpj: 0.040, csll: 0.035, cof: 0.1405, pis: 0.0305, cpp: 0.4340, icms: 0.0, iss: 0.3200, ipi: 0.0 },
      { anexo: 'anexo3', nome: 'Anexo III - Serviços em Geral', faixa: 3, limite: 720000, aliq: 0.135, ded: 17640, irpj: 0.040, csll: 0.035, cof: 0.1364, pis: 0.0296, cpp: 0.4340, icms: 0.0, iss: 0.3250, ipi: 0.0 },
      { anexo: 'anexo3', nome: 'Anexo III - Serviços em Geral', faixa: 4, limite: 1800000, aliq: 0.160, ded: 35640, irpj: 0.040, csll: 0.035, cof: 0.1360, pis: 0.0295, cpp: 0.4340, icms: 0.0, iss: 0.3250, ipi: 0.0 },
      { anexo: 'anexo3', nome: 'Anexo III - Serviços em Geral', faixa: 5, limite: 3600000, aliq: 0.210, ded: 125640, irpj: 0.040, csll: 0.035, cof: 0.1282, pis: 0.0278, cpp: 0.4340, icms: 0.0, iss: 0.3350, ipi: 0.0 },
      { anexo: 'anexo3', nome: 'Anexo III - Serviços em Geral', faixa: 6, limite: 4800000, aliq: 0.330, ded: 648000, irpj: 0.350, csll: 0.150, cof: 0.1603, pis: 0.0347, cpp: 0.3050, icms: 0.0, iss: 0.0000, ipi: 0.0 },

      // TRANSPORTE DE CARGAS (Art. 18, § 5º-E - Anexo III sem ISS + ICMS Anexo I)
      { anexo: 'transporte_cargas', nome: 'Transporte Rodoviário de Cargas (Art. 18, § 5º-E)', faixa: 1, limite: 180000, aliq: 0.060, ded: 0, irpj: 0.040, csll: 0.035, cof: 0.1282, pis: 0.0278, cpp: 0.4340, icms: 0.3400, iss: 0.0000, ipi: 0.0 },
      { anexo: 'transporte_cargas', nome: 'Transporte Rodoviário de Cargas (Art. 18, § 5º-E)', faixa: 2, limite: 360000, aliq: 0.112, ded: 9360, irpj: 0.040, csll: 0.035, cof: 0.1405, pis: 0.0305, cpp: 0.4340, icms: 0.3400, iss: 0.0000, ipi: 0.0 },
      { anexo: 'transporte_cargas', nome: 'Transporte Rodoviário de Cargas (Art. 18, § 5º-E)', faixa: 3, limite: 720000, aliq: 0.135, ded: 17640, irpj: 0.040, csll: 0.035, cof: 0.1364, pis: 0.0296, cpp: 0.4340, icms: 0.3350, iss: 0.0000, ipi: 0.0 },
      { anexo: 'transporte_cargas', nome: 'Transporte Rodoviário de Cargas (Art. 18, § 5º-E)', faixa: 4, limite: 1800000, aliq: 0.160, ded: 35640, irpj: 0.040, csll: 0.035, cof: 0.1360, pis: 0.0295, cpp: 0.4340, icms: 0.3350, iss: 0.0000, ipi: 0.0 },
      { anexo: 'transporte_cargas', nome: 'Transporte Rodoviário de Cargas (Art. 18, § 5º-E)', faixa: 5, limite: 3600000, aliq: 0.210, ded: 125640, irpj: 0.040, csll: 0.035, cof: 0.1282, pis: 0.0278, cpp: 0.4340, icms: 0.3350, iss: 0.0000, ipi: 0.0 },
      { anexo: 'transporte_cargas', nome: 'Transporte Rodoviário de Cargas (Art. 18, § 5º-E)', faixa: 6, limite: 4800000, aliq: 0.330, ded: 648000, irpj: 0.350, csll: 0.150, cof: 0.1603, pis: 0.0347, cpp: 0.3050, icms: 0.0000, iss: 0.0000, ipi: 0.0 },

      // ANEXO IV - SERVIÇOS SEM CPP NO DAS
      { anexo: 'anexo4', nome: 'Anexo IV - Serviços (§ 5º-C)', faixa: 1, limite: 180000, aliq: 0.045, ded: 0, irpj: 0.1880, csll: 0.1520, cof: 0.1767, pis: 0.0383, cpp: 0.0000, icms: 0.0, iss: 0.4450, ipi: 0.0 },
      { anexo: 'anexo4', nome: 'Anexo IV - Serviços (§ 5º-C)', faixa: 2, limite: 360000, aliq: 0.090, ded: 8100, irpj: 0.1980, csll: 0.1520, cof: 0.2055, pis: 0.0445, cpp: 0.0000, icms: 0.0, iss: 0.4000, ipi: 0.0 },
      { anexo: 'anexo4', nome: 'Anexo IV - Serviços (§ 5º-C)', faixa: 3, limite: 720000, aliq: 0.102, ded: 12420, irpj: 0.2080, csll: 0.1520, cof: 0.1973, pis: 0.0427, cpp: 0.0000, icms: 0.0, iss: 0.4000, ipi: 0.0 },
      { anexo: 'anexo4', nome: 'Anexo IV - Serviços (§ 5º-C)', faixa: 4, limite: 1800000, aliq: 0.140, ded: 39780, irpj: 0.1780, csll: 0.1920, cof: 0.1890, pis: 0.0410, cpp: 0.0000, icms: 0.0, iss: 0.4000, ipi: 0.0 },
      { anexo: 'anexo4', nome: 'Anexo IV - Serviços (§ 5º-C)', faixa: 5, limite: 3600000, aliq: 0.220, ded: 183780, irpj: 0.1880, csll: 0.1920, cof: 0.1808, pis: 0.0392, cpp: 0.0000, icms: 0.0, iss: 0.4000, ipi: 0.0 },
      { anexo: 'anexo4', nome: 'Anexo IV - Serviços (§ 5º-C)', faixa: 6, limite: 4800000, aliq: 0.330, ded: 828000, irpj: 0.5350, csll: 0.2150, cof: 0.2055, pis: 0.0440, cpp: 0.0000, icms: 0.0, iss: 0.0000, ipi: 0.0 },

      // ANEXO V - FATOR R
      { anexo: 'anexo5', nome: 'Anexo V - Serviços (§ 5º-I Fator R)', faixa: 1, limite: 180000, aliq: 0.155, ded: 0, irpj: 0.2500, csll: 0.1500, cof: 0.1410, pis: 0.0305, cpp: 0.2885, icms: 0.0, iss: 0.1400, ipi: 0.0 },
      { anexo: 'anexo5', nome: 'Anexo V - Serviços (§ 5º-I Fator R)', faixa: 2, limite: 360000, aliq: 0.180, ded: 4500, irpj: 0.2300, csll: 0.1500, cof: 0.1410, pis: 0.0305, cpp: 0.2785, icms: 0.0, iss: 0.1700, ipi: 0.0 },
      { anexo: 'anexo5', nome: 'Anexo V - Serviços (§ 5º-I Fator R)', faixa: 3, limite: 720000, aliq: 0.195, ded: 9900, irpj: 0.2400, csll: 0.1500, cof: 0.1492, pis: 0.0323, cpp: 0.2385, icms: 0.0, iss: 0.1900, ipi: 0.0 },
      { anexo: 'anexo5', nome: 'Anexo V - Serviços (§ 5º-I Fator R)', faixa: 4, limite: 1800000, aliq: 0.205, ded: 17100, irpj: 0.2100, csll: 0.1500, cof: 0.1574, pis: 0.0341, cpp: 0.2385, icms: 0.0, iss: 0.2100, ipi: 0.0 },
      { anexo: 'anexo5', nome: 'Anexo V - Serviços (§ 5º-I Fator R)', faixa: 5, limite: 3600000, aliq: 0.230, ded: 62100, irpj: 0.2300, csll: 0.1250, cof: 0.1410, pis: 0.0305, cpp: 0.2385, icms: 0.0, iss: 0.2350, ipi: 0.0 },
      { anexo: 'anexo5', nome: 'Anexo V - Serviços (§ 5º-I Fator R)', faixa: 6, limite: 4800000, aliq: 0.305, ded: 540000, irpj: 0.3500, csll: 0.1550, cof: 0.1644, pis: 0.0356, cpp: 0.2950, icms: 0.0, iss: 0.0000, ipi: 0.0 }
    ];

    const stmtFaixa = db.prepare(`
      INSERT OR REPLACE INTO simples_nacional_faixas (
        id, anexo, nome_anexo, faixa, limite_superior, aliq_nominal, deducao,
        reparticao_irpj, reparticao_csll, reparticao_cofins, reparticao_pis,
        reparticao_cpp, reparticao_icms, reparticao_iss, reparticao_ipi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const f of faixasData) {
      stmtFaixa.run(uuid(), f.anexo, f.nome, f.faixa, f.limite, f.aliq, f.ded, f.irpj, f.csll, f.cof, f.pis, f.cpp, f.icms, f.iss, f.ipi);
    }

    // PARTILHAS DA REFORMA (LC 214/227)
    const partilhasData = [
      // Anexo I
      { anexo: 'anexo1', ano: 2027, valores: [0.1550, 0.1550, 0.1550, 0.1550, 0.1550, 0.3402] },
      { anexo: 'anexo1', ano: 2029, valores: [0.1890, 0.1890, 0.1885, 0.1885, 0.1885, 0.3440] },
      { anexo: 'anexo1', ano: 2030, valores: [0.2230, 0.2230, 0.2220, 0.2220, 0.2220, 0.3440] },
      { anexo: 'anexo1', ano: 2031, valores: [0.2570, 0.2570, 0.2555, 0.2555, 0.2555, 0.3440] },
      { anexo: 'anexo1', ano: 2032, valores: [0.2910, 0.2910, 0.2890, 0.2890, 0.2890, 0.3440] },
      { anexo: 'anexo1', ano: 2033, valores: [0.4950, 0.4950, 0.4900, 0.4900, 0.4900, 0.3440] },

      // Transporte Cargas
      { anexo: 'transporte_cargas', ano: 2027, valores: [0.1600, 0.1750, 0.1700, 0.1700, 0.1600, 0.2400] },
      { anexo: 'transporte_cargas', ano: 2029, valores: [0.1950, 0.2080, 0.2030, 0.2030, 0.1950, 0.2450] },
      { anexo: 'transporte_cargas', ano: 2030, valores: [0.2300, 0.2400, 0.2360, 0.2360, 0.2300, 0.2450] },
      { anexo: 'transporte_cargas', ano: 2031, valores: [0.2650, 0.2720, 0.2690, 0.2690, 0.2650, 0.2450] },
      { anexo: 'transporte_cargas', ano: 2032, valores: [0.3000, 0.3050, 0.3020, 0.3020, 0.3000, 0.2450] },
      { anexo: 'transporte_cargas', ano: 2033, valores: [0.4950, 0.4950, 0.4900, 0.4900, 0.4900, 0.3440] }
    ];

    const stmtPartilha = db.prepare(`
      INSERT OR REPLACE INTO simples_nacional_partilha_reforma (id, anexo, ano_transicao, faixa, fracao_desoneracao)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const p of partilhasData) {
      p.valores.forEach((fracao, idx) => {
        stmtPartilha.run(uuid(), p.anexo, p.ano, idx + 1, fracao);
      });
    }

    console.log('✅ Simples Nacional e Partilha da Reforma populados com sucesso.');
  } catch (err: any) {
    console.warn('⚠️ Erro ao popular Simples Nacional:', err.message);
  }
}

export function seedLucroPresumido(db: any): void {
  try {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM lucro_presumido_parametros').get() as any;
    if (countRow && countRow.count > 0) return;

    console.log('🌱 Populando presunções e alíquotas do Lucro Presumido (Lei 9.249/1995)...');

    const atividades = [
      {
        codigo: 'combustiveis',
        nome: 'Revenda de Combustíveis & Gás Natural (Postos)',
        irpj: 0.016, csll: 0.120,
        artigo: 'Lei 9.249/95, Art. 15, § 1º, I e Art. 20, I',
        detalhe: 'Revenda para consumo de derivados de petróleo, álcool combustível e gás natural. CSLL mantida em 12%.',
        categoria: 'combustiveis', anexo: 'anexo1'
      },
      {
        codigo: 'transporte_cargas',
        nome: 'Transporte Rodoviário & Aquaviário de Cargas',
        irpj: 0.080, csll: 0.120,
        artigo: 'Lei 9.249/95, Art. 15, caput e Art. 20, I',
        detalhe: 'Transporte intermunicipal e interestadual de cargas. No Simples, aplica comutação Anexo III - ISS + ICMS Anexo I.',
        categoria: 'transporte', anexo: 'transporte_cargas'
      },
      {
        codigo: 'comercio_geral',
        nome: 'Comércio em Geral (Atacado & Varejo)',
        irpj: 0.080, csll: 0.120,
        artigo: 'Lei 9.249/95, Art. 15, caput e Art. 20, I',
        detalhe: 'Venda de mercadorias adquiridas de terceiros.',
        categoria: 'comercio', anexo: 'anexo1'
      },
      {
        codigo: 'industria_geral',
        nome: 'Indústria & Fabricação Própria',
        irpj: 0.080, csll: 0.120,
        artigo: 'Lei 9.249/95, Art. 15, caput e Art. 20, I',
        detalhe: 'Venda de produtos industrializados e transformação fabril.',
        categoria: 'industria', anexo: 'anexo2'
      },
      {
        codigo: 'servicos_hospitalares',
        nome: 'Serviços Hospitalares & Clínicas Médicas (c/ internação/exames)',
        irpj: 0.080, csll: 0.120,
        artigo: 'Lei 9.249/95, Art. 15, § 1º, III, "a" e Art. 20, I',
        detalhe: 'Serviços hospitalares, auxílio diagnóstico e terapia que atendam às normas da ANVISA.',
        categoria: 'servicos', anexo: 'anexo3'
      },
      {
        codigo: 'construcao_civil',
        nome: 'Construção Civil por Empreitada (com materiais)',
        irpj: 0.080, csll: 0.120,
        artigo: 'Lei 9.249/95, Art. 15, § 1º, III, "a" e Art. 20, I',
        detalhe: 'Construção civil por empreitada global com fornecimento de todos os materiais.',
        categoria: 'servicos', anexo: 'anexo4'
      },
      {
        codigo: 'transporte_passageiros',
        nome: 'Transporte de Passageiros (Coletivo / Fretamento)',
        irpj: 0.160, csll: 0.120,
        artigo: 'Lei 9.249/95, Art. 15, § 1º, II, "a" e Art. 20, I',
        detalhe: 'Transporte intermunicipal e interestadual de pessoas, turismo e fretamento contínuo.',
        categoria: 'transporte', anexo: 'anexo3'
      },
      {
        codigo: 'servicos_120k',
        nome: 'Prestação de Serviços com Faturamento até R$ 120 mil/ano',
        irpj: 0.160, csll: 0.320,
        artigo: 'Lei 9.249/95, Art. 15, § 2º e Art. 20, III',
        detalhe: 'Exclusivo para serviços comuns não regulamentados com receita bruta anual limitada a R$ 120.000.',
        categoria: 'servicos', anexo: 'anexo3'
      },
      {
        codigo: 'servicos_gerais',
        nome: 'Serviços em Geral (TI, Consultoria, Engenharia, Advocacia)',
        irpj: 0.320, csll: 0.320,
        artigo: 'Lei 9.249/95, Art. 15, § 1º, III, "a" e Art. 20, III',
        detalhe: 'Serviços profissionais regulamentados, consultoria de negócios, tecnologia e projetos.',
        categoria: 'servicos', anexo: 'anexo5'
      },
      {
        codigo: 'locacao_bens',
        nome: 'Locação, Sublocação e Cessão de Bens Móveis/Imóveis',
        irpj: 0.320, csll: 0.320,
        artigo: 'Lei 9.249/95, Art. 15, § 1º, III, "b" e Art. 20, III',
        detalhe: 'Aluguel de frotas, máquinas, equipamentos e imóveis próprios.',
        categoria: 'imobiliario', anexo: 'anexo3'
      },
      {
        codigo: 'intermediacao_corretagem',
        nome: 'Intermediação de Negócios & Corretagem',
        irpj: 0.320, csll: 0.320,
        artigo: 'Lei 9.249/95, Art. 15, § 1º, III, "b" e Art. 20, III',
        detalhe: 'Representação comercial autônoma, corretagem de seguros e agenciamento.',
        categoria: 'servicos', anexo: 'anexo3'
      },
      {
        codigo: 'factoring_fomento',
        nome: 'Factoring / Fomento Mercantil & Direitos Creditórios',
        irpj: 0.320, csll: 0.320,
        artigo: 'Lei 9.249/95, Art. 15, § 1º, III, "d" e Art. 20, III',
        detalhe: 'Assessoria creditícia e compra de direitos creditórios.',
        categoria: 'servicos', anexo: 'anexo3'
      }
    ];

    const stmtAtiv = db.prepare(`
      INSERT OR REPLACE INTO lucro_presumido_parametros (
        id, codigo_atividade, nome_atividade, presuncao_irpj, presuncao_csll,
        aliq_irpj_basico, aliq_irpj_adicional, limite_mensal_adicional, aliq_csll,
        artigo_legal, detalhe, categoria, anexo_simples_padrao
      ) VALUES (?, ?, ?, ?, ?, 0.15, 0.10, 20000.0, 0.09, ?, ?, ?, ?)
    `);

    for (const a of atividades) {
      stmtAtiv.run(uuid(), a.codigo, a.nome, a.irpj, a.csll, a.artigo, a.detalhe, a.categoria, a.anexo);
    }

    console.log('✅ Parâmetros do Lucro Presumido populados com sucesso.');
  } catch (err: any) {
    console.warn('⚠️ Erro ao popular Lucro Presumido:', err.message);
  }
}

export function seedEncargosPatronais(db: any): void {
  try {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM encargos_patronais_parametros').get() as any;
    if (countRow && countRow.count > 0) return;

    console.log('🌱 Populando encargos previdenciários patronais fora do Simples...');

    const encargos = [
      { codigo: 'transporte_cargas', ramo: 'Transporte Rodoviário de Cargas', inss: 0.20, rat: 0.03, s: 0.052, desc: 'SEST/SENAT (2,5%) + Salário Educação (2,5%) + INCRA (0,2%)' },
      { codigo: 'transporte_passageiros', ramo: 'Transporte de Passageiros', inss: 0.20, rat: 0.03, s: 0.052, desc: 'SEST/SENAT (2,5%) + Salário Educação (2,5%) + INCRA (0,2%)' },
      { codigo: 'comercio_geral', ramo: 'Comércio em Geral', inss: 0.20, rat: 0.02, s: 0.058, desc: 'SESC/SENAC (2,5%) + Sal. Educação (2,5%) + INCRA (0,2%) + Sebrae (0,6%)' },
      { codigo: 'industria_geral', ramo: 'Indústria em Geral', inss: 0.20, rat: 0.03, s: 0.058, desc: 'SESI/SENAI (2,5%) + Sal. Educação (2,5%) + INCRA (0,2%) + Sebrae (0,6%)' },
      { codigo: 'padrao', ramo: 'Padrão / Serviços Gerais', inss: 0.20, rat: 0.02, s: 0.058, desc: 'Sistema S Padrão (5,8%)' }
    ];

    const stmtEnc = db.prepare(`
      INSERT OR REPLACE INTO encargos_patronais_parametros (id, codigo_atividade, nome_ramo, inss_patronal, rat_fap, sistema_s, entidades_descricao)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const e of encargos) {
      stmtEnc.run(uuid(), e.codigo, e.ramo, e.inss, e.rat, e.s, e.desc);
    }

    console.log('✅ Encargos patronais populados com sucesso.');
  } catch (err: any) {
    console.warn('⚠️ Erro ao popular encargos patronais:', err.message);
  }
}
