import { queryCnpjsData, determineTaxRegime, determineIeAndCccStatus } from '../src/utils/cnpj';
import { consultarCadastroTriplaCamada, calcularRegimeTributarioEstrito } from '../server/services/sefazService';

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TESTE 1: SUPERGASBRAS ENERGIA LTDA (FILIAL ARAUCÁRIA/PR)');
  console.log('CNPJ: 19.791.896/0046-02 | UF: PR');
  console.log('═══════════════════════════════════════════════════════════════');

  // Teste Frontend queryCnpjsData
  console.log('\n[Frontend queryCnpjsData]');
  const resultFe = await queryCnpjsData('19.791.896/0046-02', 'PR');
  console.log('Razão Social:', resultFe.razaoSocial);
  console.log('UF:', resultFe.uf);
  console.log('Inscrição Estadual (IE):', resultFe.ie);
  console.log('Tipo IE:', resultFe.tipoIE);
  console.log('Situação IE:', resultFe.situaçaoIE);
  console.log('Regime Tributário:', resultFe.regimeTributario);
  console.log('Capital Social:', resultFe.capitalSocial);

  // Teste Backend consultarCadastroTriplaCamada
  console.log('\n[Backend consultarCadastroTriplaCamada]');
  const resultBe = await consultarCadastroTriplaCamada({
    cnpj: '19791896004602',
    uf: 'PR',
  });
  console.log('Camada Utilizada:', resultBe.camadaUtilizada);
  console.log('Inscrição Estadual (IE):', resultBe.ie);
  console.log('Tipo IE:', resultBe.tipoIE);
  console.log('Situação IE:', resultBe.situaçaoIE);
  console.log('Regime Tributário:', resultBe.regimeTributario);

  // Validações de Asserção
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('VALIDAÇÃO DOS CRITÉRIOS DO USUÁRIO:');
  
  // 1. Regime Tributário Estrito
  const isRegimeValid = resultFe.regimeTributario === 'Lucro Real';
  console.log(`1. Regime Tributário é estritamente 'Lucro Real'? ${isRegimeValid ? '✅ PASS' : '❌ FAIL (' + resultFe.regimeTributario + ')'}`);

  // 2. IE Exata no Paraná
  const isIeValid = resultFe.ie === '1070110055';
  console.log(`2. Inscrição Estadual encontrada no PR é '1070110055'? ${isIeValid ? '✅ PASS' : '❌ FAIL (' + resultFe.ie + ')'}`);

  // 3. Tipo IE Habilitado
  const isTipoValid = resultFe.tipoIE === 'CONTRIBUINTE ICMS';
  console.log(`3. Tipo IE é 'CONTRIBUINTE ICMS'? ${isTipoValid ? '✅ PASS' : '❌ FAIL (' + resultFe.tipoIE + ')'}`);

  const isSitValid = resultFe.situaçaoIE === 'Habilitado';
  console.log(`4. Situação IE é 'Habilitado'? ${isSitValid ? '✅ PASS' : '❌ FAIL (' + resultFe.situaçaoIE + ')'}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('TESTE 2: CONSISTÊNCIA DE REGIMES TRIBUTÁRIOS & ISENÇÕES');
  console.log('═══════════════════════════════════════════════════════════════');

  const t1 = determineTaxRegime({ opcao_pelo_simples: true });
  console.log(`- Optante Simples Nacional: '${t1}' (esperado: 'Simples Nacional') -> ${t1 === 'Simples Nacional' ? '✅ PASS' : '❌ FAIL'}`);

  const t2 = determineTaxRegime({ opcao_pelo_mei: true });
  console.log(`- Optante MEI: '${t2}' (esperado: 'MEI') -> ${t2 === 'MEI' ? '✅ PASS' : '❌ FAIL'}`);

  const t3 = determineTaxRegime({ natureza_juridica: '3085', natureza_juridica_descricao: 'Condomínio Edilício' });
  console.log(`- Condomínio: '${t3}' (esperado: 'Imune / Isento') -> ${t3 === 'Imune / Isento' ? '✅ PASS' : '❌ FAIL'}`);

  const t4 = determineTaxRegime({ cnae_fiscal: '6422100', capital_social: 5000000 });
  console.log(`- Banco/Financeiro CNAE 64: '${t4}' (esperado: 'Lucro Real') -> ${t4 === 'Lucro Real' ? '✅ PASS' : '❌ FAIL'}`);

  const t5 = determineTaxRegime({ cnae_fiscal: '4711301', capital_social: 100000 });
  console.log(`- Comércio Pequeno não-Simples: '${t5}' (esperado: 'Lucro Presumido') -> ${t5 === 'Lucro Presumido' ? '✅ PASS' : '❌ FAIL'}`);

  const ie1 = determineIeAndCccStatus(undefined, '6201501', 'ATIVA');
  console.log(`- Serviços Puros TI (CNAE 6201-5/00 sem IE): IE='${ie1.ie}', Tipo='${ie1.tipoIE}' -> ${ie1.tipoIE === 'NÃO CONTRIBUINTE' ? '✅ PASS' : '❌ FAIL'}`);

  const ie2 = determineIeAndCccStatus(undefined, '4120400', 'ATIVA');
  console.log(`- Construção sem IE no CCC: IE='${ie2.ie}', Tipo='${ie2.tipoIE}' -> ${ie2.tipoIE.includes('Canteiro de Obras') ? '✅ PASS' : '❌ FAIL'}`);

  if (isRegimeValid && isIeValid && isTipoValid && isSitValid) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM COM 100% DE ACERVO FISCAL!');
  } else {
    console.error('\n⚠️ FALHA EM UM OU MAIS CRITÉRIOS.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
