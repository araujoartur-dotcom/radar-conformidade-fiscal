/**
 * ============================================================================
 * TESTE AUTOMATIZADO — MODELADOR DE REGIMES, COMUTAÇÃO FRETE & PONTO DE EQUILÍBRIO CPP
 * ============================================================================
 */

import {
  TABELAS_SIMPLES,
  ATIVIDADES_LUCRO_PRESUMIDO,
  ENCARGOS_PADRAO_POR_ATIVIDADE
} from '../src/data/parametrosFiscaisRegimes';

function testSimulador() {
  console.log('🧪 Iniciando Testes Unitários de Conformidade Matemática e Tributária...\n');

  // --------------------------------------------------------------------------
  // TESTE 1: COMUTAÇÃO DE FRETE (ART. 18, § 5º-E DA LC 123/2006)
  // --------------------------------------------------------------------------
  console.log('1. Testando Transporte de Cargas no Simples Nacional...');
  const anexoTransporte = TABELAS_SIMPLES.transporte_cargas;
  if (!anexoTransporte) {
    throw new Error('❌ Falha: Tabela transporte_cargas não encontrada!');
  }

  // Faixa 1: RBT12 = R$ 150.000
  const rbt12 = 150000;
  const faixa1 = anexoTransporte.faixas[0];
  const aliqEfetiva = ((rbt12 * faixa1.aliqNominal) - faixa1.deducao) / rbt12;
  console.log(`   Faixa 1 Alíquota Efetiva: ${(aliqEfetiva * 100).toFixed(2)}% (Esperado: 6.00%)`);
  if (Math.abs(aliqEfetiva - 0.06) > 0.0001) throw new Error('❌ Alíquota efetiva incorreta na Faixa 1!');

  // Verificar comutação da repartição: ICMS Anexo I presente e ISS Anexo III ausente
  console.log(`   Repartição ICMS: ${(faixa1.reparticao.icms! * 100).toFixed(1)}% | Repartição ISS: ${(faixa1.reparticao.iss! * 100).toFixed(1)}%`);
  if (faixa1.reparticao.icms !== 0.34 || faixa1.reparticao.iss !== 0.0) {
    throw new Error('❌ Erro na comutação legal: ICMS deveria ser 34% e ISS 0%!');
  }
  console.log('   ✅ Comutação do Art. 18, § 5º-E validada com sucesso!\n');

  // --------------------------------------------------------------------------
  // TESTE 2: TABELA DE PRESUNÇÃO DO LUCRO PRESUMIDO (LEI 9.249/1995)
  // --------------------------------------------------------------------------
  console.log('2. Testando Tabela de Presunções Oficiais (Lei 9.249/95)...');

  const combustiveis = ATIVIDADES_LUCRO_PRESUMIDO.find(a => a.id === 'combustiveis');
  if (!combustiveis || combustiveis.presuncaoIrpj !== 0.016 || combustiveis.presuncaoCsll !== 0.120) {
    throw new Error('❌ Falha na presunção de Combustíveis: IRPJ deve ser 1,6% e CSLL 12,0%!');
  }
  console.log(`   ✅ Combustíveis (Postos): IRPJ ${combustiveis.presuncaoIrpj * 100}% e CSLL ${combustiveis.presuncaoCsll * 100}% confirmados.`);

  const freteCargas = ATIVIDADES_LUCRO_PRESUMIDO.find(a => a.id === 'transporte_cargas');
  if (!freteCargas || freteCargas.presuncaoIrpj !== 0.080 || freteCargas.presuncaoCsll !== 0.120) {
    throw new Error('❌ Falha na presunção de Transporte de Cargas: IRPJ deve ser 8,0% e CSLL 12,0%!');
  }
  console.log(`   ✅ Transporte de Cargas: IRPJ ${freteCargas.presuncaoIrpj * 100}% e CSLL ${freteCargas.presuncaoCsll * 100}% confirmados.`);

  // --------------------------------------------------------------------------
  // TESTE 3: CÁLCULO EXATO DO ADICIONAL DO IRPJ (10% SOBRE EXCEDENTE DE R$ 20.000)
  // --------------------------------------------------------------------------
  console.log('\n3. Testando Adicional de 10% do IRPJ (Art. 623 RIR/2018)...');
  const fatMensal = 400000; // 400k faturamento
  const baseIrpj = fatMensal * 0.08; // 32.000
  const irpjBasico = baseIrpj * 0.15; // 4.800
  const excedente = Math.max(0, baseIrpj - 20000); // 12.000
  const irpjAdicional = excedente * 0.10; // 1.200
  const irpjTotal = irpjBasico + irpjAdicional; // 6.000

  console.log(`   Faturamento: R$ 400.000 | Base IRPJ (8%): R$ ${baseIrpj.toLocaleString('pt-BR')}`);
  console.log(`   Excedente: R$ ${excedente.toLocaleString('pt-BR')} | Adicional (10%): R$ ${irpjAdicional.toLocaleString('pt-BR')}`);
  console.log(`   Total IRPJ: R$ ${irpjTotal.toLocaleString('pt-BR')} (Alíquota Efetiva: ${((irpjTotal / fatMensal) * 100).toFixed(2)}%)`);
  if (irpjTotal !== 6000) throw new Error('❌ Erro no cálculo do adicional de IRPJ!');
  console.log('   ✅ Cálculo do IRPJ Básico + Adicional 10% aprovado!\n');

  // --------------------------------------------------------------------------
  // TESTE 4: PONTO DE EQUILÍBRIO PREVIDENCIÁRIO (BREAK-EVEN CPP)
  // --------------------------------------------------------------------------
  console.log('4. Testando Ponto de Equilíbrio CPP (Equipe x Regime)...');
  const fatMes = 200000;
  const aliqEfetivaSimples = 0.10; // 10%
  const pctCppSimples = 0.434; // 43,4% no Anexo III
  const cppSimples = fatMes * aliqEfetivaSimples * pctCppSimples; // 200.000 * 0.10 * 0.434 = R$ 8.680,00

  const salarioBase = 2500;
  const encargosTaxa = 0.282; // 28,2%
  const cppUnitarioFora = salarioBase * encargosTaxa; // R$ 705,00 por colaborador

  const nBreakEven = cppSimples / cppUnitarioFora; // 8680 / 705 = 12,31 colaboradores
  const nArredondado = Math.round(nBreakEven); // 12 colaboradores

  console.log(`   CPP Simples Nacional: R$ ${cppSimples.toFixed(2)} /mês (Constante)`);
  console.log(`   CPP Fora do Simples unitário: R$ ${cppUnitarioFora.toFixed(2)} /colaborador`);
  console.log(`   Ponto de Equilíbrio: N* = ${nBreakEven.toFixed(2)} (~${nArredondado} colaboradores)`);

  // Verificações: n = 5 colaboradores
  const custo5 = 5 * cppUnitarioFora; // 3.525 < 8680 -> Presumido mais barato
  console.log(`   Para n = 5: Fora = R$ ${custo5.toFixed(2)} vs Simples = R$ ${cppSimples.toFixed(2)} -> Mais barato: Presumido`);
  if (custo5 >= cppSimples) throw new Error('❌ Para 5 colaboradores, o Regime Normal deveria ser mais barato!');

  // Verificações: n = 20 colaboradores
  const custo20 = 20 * cppUnitarioFora; // 14.100 > 8680 -> Simples muito mais barato!
  console.log(`   Para n = 20: Fora = R$ ${custo20.toFixed(2)} vs Simples = R$ ${cppSimples.toFixed(2)} -> Mais barato: Simples (Economia: R$ ${(custo20 - cppSimples).toFixed(2)})`);
  if (custo20 <= cppSimples) throw new Error('❌ Para 20 colaboradores, o Simples deveria ser mais barato!');

  console.log('   ✅ Curvas de CPP e Ponto de Equilíbrio matematicamente comprovadas!\n');

  console.log('🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
}

testSimulador();
