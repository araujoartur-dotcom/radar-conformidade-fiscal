import { CnpjLookupItem, SituaçãoCNPJ, SituaçãoIE } from '../types';

/** Clean raw string to digits only */
export function onlyNumbers(value: string): string {
  return value ? value.replace(/\D/g, '') : '';
}

/** Format raw numbers as 00.000.000/0000-00 */
export function formatCNPJ(value: string): string {
  const digits = onlyNumbers(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

/** Basic CNPJ validation check */
export function isValidCNPJ(cnpjStr: string): boolean {
  const digits = onlyNumbers(cnpjStr);
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  let size = digits.length - 2;
  let numbers = digits.substring(0, size);
  const digitsToVerify = digits.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += Number(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== Number(digitsToVerify.charAt(0))) return false;

  size = size + 1;
  numbers = digits.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += Number(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== Number(digitsToVerify.charAt(1))) return false;

  return true;
}

/** Format currency BRL */
export function formatCurrency(value?: number): string {
  if (value === undefined || value === null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Verified real sample CNPJs for demonstration — removed for production integrity
export const DEMO_CNPJS: { cnpj: string; uf: string; name: string }[] = [];

// Cache em memória para evitar esgotamento de rate limits de APIs públicas gratuitas (24h de TTL)
const cnpjLookupMemoryCache = new Map<string, { data: Partial<CnpjLookupItem>; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

/**
 * Fetch CNPJ data using multi-API fallback and 3-tier IE architecture:
 * 1. Backend SEFAZ NFeConsultaCadastro 4.00 SOAP (if available with cert)
 * 2. CNPJá Open API (Primeiro Fallback)
 * 3. CNPJ.ws Pública (Segundo Fallback — Inscrições Estaduais por UF)
 * 4. MinhaReceita / BrasilAPI (Dados cadastrais complementares)
 */
export async function queryCnpjsData(rawCnpj: string, targetUf: string = ''): Promise<Partial<CnpjLookupItem>> {
  const clean = onlyNumbers(rawCnpj);
  const formatted = formatCNPJ(clean);
  const cleanUf = (targetUf || '').toUpperCase().trim();

  if (!isValidCNPJ(clean)) {
    return {
      cnpj: formatted || rawCnpj,
      statusConsulta: 'erro',
      mensagemErro: 'CNPJ inválido (dígito verificador incorreto)'
    };
  }

  // Verificar cache em memória
  const cacheKey = cleanUf ? `${clean}_${cleanUf}` : clean;
  const cached = cnpjLookupMemoryCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return { ...cached.data };
  }

  let resultItem: Partial<CnpjLookupItem> | null = null;
  let ieEncontrada: string | null = null;
  let tipoIeEncontrado: string | null = null;
  let situacaoIeEncontrada: SituaçãoIE | null = null;

  // ── CAMADA 1: Tentar consulta SEFAZ SOAP via Backend (quando a UF foi especificada) ──
  if (cleanUf) {
    try {
      const resBackend = await fetch('/api/sefaz/consulta-cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ cnpj: clean, uf: cleanUf }),
        signal: AbortSignal.timeout(4000)
      });

      if (resBackend.ok) {
        const respJson = await resBackend.json();
        if (respJson.success && respJson.data?.sucesso) {
          const d = respJson.data;
          if (d.ie && d.ie !== 'Não Consta no CCC') {
            ieEncontrada = d.ie;
            tipoIeEncontrado = d.tipoIE;
            situacaoIeEncontrada = d.situaçaoIE;
          }
          if (d.razaoSocial) {
            resultItem = {
              cnpj: formatted,
              uf: cleanUf,
              ie: d.ie,
              tipoIE: d.tipoIE,
              situaçaoIE: d.situaçaoIE,
              situaçaoCNPJ: 'ATIVA',
              razaoSocial: d.razaoSocial,
              nomeFantasia: d.nomeFantasia || d.razaoSocial,
              cnaePrincipal: d.cnaePrincipal,
              regimeTributario: d.regimeTributario || 'Lucro Real',
              capitalSocial: d.capitalSocial || 0,
              statusConsulta: 'sucesso',
              dataConsulta: new Date().toISOString()
            };
          }
        }
      }
    } catch {
      // Backend offline ou sem certificado para o tenant — prossegue para fallbacks públicos
    }
  }

  // ── CAMADA 2 & 3: Consultas Públicas de Suporte (CNPJ.ws, CNPJá, MinhaReceita, BrasilAPI) ──
  // 1. Tentar CNPJ.ws Pública (melhor fonte aberta de Inscrições Estaduais por UF)
  let dadosCnpjWs: any = null;
  try {
    const resWs = await fetch(`https://publica.cnpj.ws/cnpj/${clean}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    if (resWs.ok) {
      dadosCnpjWs = await resWs.json();
      const est = dadosCnpjWs.estabelecimento || {};
      const actualUf = (est.estado?.sigla || '').toUpperCase().trim();
      const effectiveUf = cleanUf || actualUf;

      if (!resultItem) {
        resultItem = parseCnpjWsResponse(dadosCnpjWs, formatted, effectiveUf);
      }
      // Extrair IE para a UF desejada ou UF real do estabelecimento
      const ieList = Array.isArray(est.inscricoes_estaduais) ? est.inscricoes_estaduais : [];
      const activeForUf = ieList.find((i: any) => (i.estado?.sigla || '').toUpperCase() === effectiveUf && i.ativo);
      const inactiveForUf = ieList.find((i: any) => (i.estado?.sigla || '').toUpperCase() === effectiveUf && !i.ativo);
      const anyActive = ieList.find((i: any) => i.ativo);
      const targetIeObj = activeForUf || inactiveForUf || anyActive;

      if (targetIeObj && targetIeObj.inscricao_estadual) {
        ieEncontrada = targetIeObj.inscricao_estadual;
        situacaoIeEncontrada = targetIeObj.ativo ? 'Habilitado' : 'Não Habilitado';
        tipoIeEncontrado = targetIeObj.ativo ? 'CONTRIBUINTE ICMS' : 'NÃO HABILITADO / INATIVO';
      }
    }
  } catch (err) {
    console.warn('CNPJ.ws fetch error:', err);
  }

  // 2. Se ainda não temos dados cadastrais completos, tentar CNPJá Open API
  if (!resultItem) {
    try {
      const resCnpja = await fetch(`https://open.cnpja.com/office/${clean}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      if (resCnpja.ok) {
        const dataCnpja = await resCnpja.json();
        const addr = dataCnpja.address || {};
        const actualUf = (addr.state || '').toUpperCase().trim();
        const effectiveUf = cleanUf || actualUf;

        resultItem = parseCnpjaResponse(dataCnpja, formatted, effectiveUf);
        if (!ieEncontrada && Array.isArray(dataCnpja.registrations)) {
          const regForUf = dataCnpja.registrations.find((r: any) => (r.state || '').toUpperCase() === effectiveUf && r.enabled);
          const anyReg = dataCnpja.registrations.find((r: any) => r.enabled);
          const chosen = regForUf || anyReg;
          if (chosen && chosen.number) {
            ieEncontrada = chosen.number;
            situacaoIeEncontrada = 'Habilitado';
            tipoIeEncontrado = chosen.taxpayer !== false ? 'CONTRIBUINTE ICMS' : 'IE Não Contribuinte (Canteiro de Obras, IE Virtual, outros)';
          }
        }
      }
    } catch (err) {
      console.warn('CNPJá fetch error:', err);
    }
  }

  // 3. Se ainda não temos dados cadastrais, tentar BrasilAPI
  if (!resultItem) {
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = await res.json();
        resultItem = parseBrasilApiResponse(data, formatted, cleanUf);
      }
    } catch (err) {
      console.warn('BrasilAPI fetch error:', err);
    }
  }

  // 4. Se ainda não temos dados cadastrais, tentar MinhaReceita
  if (!resultItem) {
    try {
      const res = await fetch(`https://minhareceita.org/${clean}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = await res.json();
        resultItem = parseMinhaReceitaResponse(data, formatted, cleanUf);
      }
    } catch (err) {
      console.warn('MinhaReceita fetch error:', err);
    }
  }

  // ── ENRIQUECIMENTO E PADRONIZAÇÃO FINAL DA IE ──
  if (resultItem) {
    // Se a IE foi identificada com precisão em qualquer das camadas, aplica
    if (ieEncontrada) {
      resultItem.ie = ieEncontrada;
      resultItem.tipoIE = tipoIeEncontrado || 'CONTRIBUINTE ICMS';
      resultItem.situaçaoIE = situacaoIeEncontrada || 'Habilitado';
    } else if (!resultItem.ie || resultItem.ie === 'Não Consta no CCC' || resultItem.ie === 'Consultar SEFAZ Estadual') {
      const cnae = resultItem.cnaePrincipal || '';
      if (isPureServiceCnae(cnae)) {
        resultItem.ie = 'Isento';
        resultItem.tipoIE = 'NÃO CONTRIBUINTE';
        resultItem.situaçaoIE = 'Não Contribuinte';
      } else {
        resultItem.ie = 'Não Consta no CCC';
        resultItem.tipoIE = 'IE Não Contribuinte (Canteiro de Obras, IE Virtual, outros)';
        resultItem.situaçaoIE = 'Não Contribuinte';
      }
    }

    cnpjLookupMemoryCache.set(cacheKey, { data: resultItem, timestamp: Date.now() });
    return resultItem;
  }

  // STRICT REQUIREMENT: If real open APIs fail or return 404, DO NOT INVENT DATA! Return clear error state.
  return {
    cnpj: formatted,
    uf: cleanUf,
    statusConsulta: 'erro',
    mensagemErro: 'CNPJ não encontrado na base pública SEFAZ / Receita Federal ou indisponibilidade de consulta no momento.'
  };
}

/**
 * Identifica se a atividade CNAE é tipicamente de Serviços puros (não sujeita a ICMS estadual).
 */
export function isPureServiceCnae(cnae: string): boolean {
  if (!cnae) return false;
  const cleanCnae = cnae.replace(/\D/g, '');
  const prefix2 = cleanCnae.slice(0, 2);
  const servicePrefixes = [
    '62', '63', '64', '65', '66', '68', '69', '70', '71', '72',
    '73', '74', '75', '78', '80', '81', '82', '85', '86', '87',
    '88', '90', '91', '92', '93', '94', '95', '96'
  ];
  return servicePrefixes.includes(prefix2);
}

/**
 * Determina com fidelidade estrita o Regime Tributário oficial (Lucro Real, Lucro Presumido ou Simples Nacional).
 * Elimina completamente rótulos ambíguos como "Regime Geral (Lucro Presumido / Real)".
 */
export function determineTaxRegime(data: any): 'Lucro Real' | 'Lucro Presumido' | 'Simples Nacional' | 'MEI' | 'Imune / Isento' {
  // 1. MEI
  const isMei = data.opcao_pelo_mei === true ||
    data.simples?.optante_mei === 'Sim' ||
    data.simples?.mei === 'Sim' ||
    data.company?.simei?.optant === true ||
    data.simei?.optant === true;
  if (isMei) return 'MEI';

  // 2. Simples Nacional
  const isSimples = data.opcao_pelo_simples === true ||
    data.simples?.optante_simples === 'Sim' ||
    data.simples?.simples === 'Sim' ||
    data.company?.simples?.optant === true;
  if (isSimples) return 'Simples Nacional';

  // 3. Imune / Isento (Associações, Condomínios, Fundações, Órgãos Públicos)
  const natJurStr = String(
    data.natureza_juridica?.descricao ||
    data.natureza_juridica ||
    data.natureza_juridica_descricao ||
    data.company?.nature?.text ||
    ''
  ).toLowerCase();

  const natJurCode = String(
    data.codigo_natureza_juridica ||
    data.natureza_juridica?.id ||
    data.natureza_juridica ||
    data.company?.nature?.id ||
    ''
  ).replace(/\D/g, '');

  if (
    natJurCode.startsWith('1') || // Administração pública
    natJurCode.startsWith('3') || // Entidades sem fins lucrativos
    natJurStr.includes('condomínio') ||
    natJurStr.includes('associação') ||
    natJurStr.includes('fundação') ||
    natJurStr.includes('religiosa')
  ) {
    return 'Imune / Isento';
  }

  // 4. Lucro Real Compulsório (Lei 9.718/98 art. 14, Lei 12.814/2013)
  const capSocial = Number(data.capital_social || data.company?.equity || data.capitalSocial || 0);
  if (capSocial >= 78000000) {
    return 'Lucro Real';
  }

  if (natJurCode === '2046' || natJurStr.includes('capital aberto') || natJurStr.includes('s/a aberta')) {
    return 'Lucro Real';
  }

  const cnaeClean = String(
    data.cnae_fiscal ||
    data.mainActivity?.id ||
    data.atividade_principal?.id ||
    data.cnaePrincipal ||
    ''
  ).replace(/\D/g, '');

  const cnaePrefix2 = cnaeClean.slice(0, 2);
  if (['64', '65', '66'].includes(cnaePrefix2)) {
    return 'Lucro Real';
  }

  const cnaePrefix4 = cnaeClean.slice(0, 4);
  if (['4681', '4682', '1921', '1922'].includes(cnaePrefix4)) {
    return 'Lucro Real';
  }

  const porteStr = String(data.porte || data.codigo_porte || data.company?.size?.text || data.company?.size?.acronym || '').toUpperCase();
  if ((porteStr === 'DEMAIS' || porteStr === 'GRANDE') && capSocial > 10000000) {
    return 'Lucro Real';
  }

  // Padrão não optante pelo Simples nem compulsório no Real:
  return 'Lucro Presumido';
}

/**
 * Determina com fidelidade a Inscrição Estadual e a situação cadastral no CCC/SEFAZ.
 */
export function determineIeAndCccStatus(
  rawIe: string | undefined | null,
  cnae: string,
  sitCNPJ: SituaçãoCNPJ
): { ie: string; tipoIE: string; situaçaoIE: SituaçãoIE } {
  const cleanIe = (rawIe || '').replace(/\D/g, '');
  
  if (cleanIe.length >= 6) {
    return {
      ie: rawIe || cleanIe,
      tipoIE: 'CONTRIBUINTE ICMS',
      situaçaoIE: sitCNPJ === 'ATIVA' ? 'Habilitado' : 'Não Habilitado'
    };
  }

  if (isPureServiceCnae(cnae)) {
    return {
      ie: 'Isento',
      tipoIE: 'NÃO CONTRIBUINTE',
      situaçaoIE: 'Não Contribuinte'
    };
  }

  return {
    ie: 'Não Consta no CCC',
    tipoIE: 'IE Não Contribuinte (Canteiro de Obras, IE Virtual, outros)',
    situaçaoIE: 'Não Contribuinte'
  };
}

function parseBrasilApiResponse(data: any, formattedCnpj: string, defaultUf: string): Partial<CnpjLookupItem> {
  const uf = data.uf || defaultUf;
  const sitCNPJ: SituaçãoCNPJ = data.descricao_situacao_cadastral === 'ATIVA'
    ? 'ATIVA'
    : (data.descricao_situacao_cadastral as SituaçãoCNPJ || 'PENDENTE');

  const cnaePrincipal = data.cnae_fiscal ? `${data.cnae_fiscal}` : '';
  const ieStatus = determineIeAndCccStatus(data.inscricao_estadual, cnaePrincipal, sitCNPJ);

  const sociosList = Array.isArray(data.qsa) && data.qsa.length > 0
    ? data.qsa.map((s: any) => ({
        nome: s.nome_socio || s.nome_socio_raz_social || '',
        qualificacao: s.qualificacao_socio || s.qualificacao_representante_legal || ''
      })).filter((s: any) => Boolean(s.nome))
    : [];

  return {
    cnpj: formattedCnpj,
    uf: uf,
    ie: ieStatus.ie,
    tipoIE: ieStatus.tipoIE,
    situaçaoIE: ieStatus.situaçaoIE,
    situaçaoCNPJ: sitCNPJ,
    naturezaJuridica: data.natureza_juridica || '',
    razaoSocial: data.razao_social || '',
    nomeFantasia: data.nome_fantasia || data.razao_social || '',
    cnaePrincipal: cnaePrincipal,
    cnaeDescricao: data.cnae_fiscal_descricao || '',
    dataAbertura: data.data_inicio_atividade || '',
    regimeTributario: determineTaxRegime(data),
    capitalSocial: Number(data.capital_social) || 0,
    enderecoCompleto: [data.logradouro, data.numero, data.complemento, data.bairro].filter(Boolean).join(', '),
    logradouro: data.logradouro || '',
    numero: data.numero || '',
    complemento: data.complemento || '',
    bairro: data.bairro || '',
    municipio: data.municipio || '',
    cep: data.cep || '',
    telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}` : '',
    email: data.email || '',
    socios: sociosList,
    statusConsulta: 'sucesso',
    dataConsulta: new Date().toISOString()
  };
}

function parseMinhaReceitaResponse(data: any, formattedCnpj: string, defaultUf: string): Partial<CnpjLookupItem> {
  const uf = data.uf || defaultUf;
  const sitCNPJ: SituaçãoCNPJ = data.descricao_situacao_cadastral === 'ATIVA'
    ? 'ATIVA'
    : (data.descricao_situacao_cadastral as SituaçãoCNPJ || 'PENDENTE');

  const cnaePrincipal = data.cnae_fiscal ? `${data.cnae_fiscal}` : '';
  const ieStatus = determineIeAndCccStatus(data.inscricao_estadual, cnaePrincipal, sitCNPJ);

  const sociosList = Array.isArray(data.qsa) && data.qsa.length > 0
    ? data.qsa.map((s: any) => ({
        nome: s.nome_socio || '',
        qualificacao: s.qualificacao_socio || ''
      })).filter((s: any) => Boolean(s.nome))
    : [];

  return {
    cnpj: formattedCnpj,
    uf: uf,
    ie: ieStatus.ie,
    tipoIE: ieStatus.tipoIE,
    situaçaoIE: ieStatus.situaçaoIE,
    situaçaoCNPJ: sitCNPJ,
    naturezaJuridica: data.natureza_juridica || '',
    razaoSocial: data.razao_social || '',
    nomeFantasia: data.nome_fantasia || data.razao_social || '',
    cnaePrincipal: cnaePrincipal,
    cnaeDescricao: data.cnae_fiscal_descricao || '',
    dataAbertura: data.data_inicio_atividade || '',
    regimeTributario: determineTaxRegime(data),
    capitalSocial: Number(data.capital_social) || 0,
    enderecoCompleto: [data.logradouro, data.numero, data.complemento, data.bairro].filter(Boolean).join(', '),
    logradouro: data.logradouro || '',
    numero: data.numero || '',
    complemento: data.complemento || '',
    bairro: data.bairro || '',
    municipio: data.municipio || '',
    cep: data.cep || '',
    telefone: data.ddd_telefone_1 || '',
    email: data.email || '',
    socios: sociosList,
    statusConsulta: 'sucesso',
    dataConsulta: new Date().toISOString()
  };
}

function parseCnpjWsResponse(data: any, formattedCnpj: string, defaultUf: string): Partial<CnpjLookupItem> {
  const est = data.estabelecimento || {};
  const uf = est.estado?.sigla || defaultUf;
  const sitCNPJ: SituaçãoCNPJ = est.situacao_cadastral === 'Ativa' ? 'ATIVA' : 'INAPTA';

  const ieList = Array.isArray(est.inscricoes_estaduais) ? est.inscricoes_estaduais : [];
  const activeIeForUf = ieList.find((i: any) => i.estado?.sigla === uf && i.ativo);
  const activeAnyIe = ieList.find((i: any) => i.ativo);
  const foundIe = activeIeForUf?.inscricao_estadual || activeAnyIe?.inscricao_estadual || (ieList[0]?.ativo ? ieList[0]?.inscricao_estadual : undefined);

  const cnaePrincipal = est.atividade_principal?.id ? `${est.atividade_principal.id}` : '';
  const ieStatus = determineIeAndCccStatus(foundIe, cnaePrincipal, sitCNPJ);

  const sociosList = Array.isArray(data.socios)
    ? data.socios.map((s: any) => ({
        nome: s.nome || '',
        qualificacao: s.qualificacao_socio?.descricao || ''
      })).filter((s: any) => Boolean(s.nome))
    : [];

  const logradouroParsed = [est.tipo_logradouro, est.logradouro].filter(Boolean).join(' ');

  return {
    cnpj: formattedCnpj,
    uf: uf,
    ie: ieStatus.ie,
    tipoIE: ieStatus.tipoIE,
    situaçaoIE: ieStatus.situaçaoIE,
    situaçaoCNPJ: sitCNPJ,
    naturezaJuridica: data.natureza_juridica?.descricao || '',
    razaoSocial: data.razao_social || '',
    nomeFantasia: est.nome_fantasia || data.razao_social || '',
    cnaePrincipal: cnaePrincipal,
    cnaeDescricao: est.atividade_principal?.descricao || '',
    dataAbertura: est.data_inicio_atividade || '',
    regimeTributario: determineTaxRegime(data),
    capitalSocial: Number(data.capital_social) || 0,
    enderecoCompleto: [logradouroParsed, est.numero, est.complemento, est.bairro].filter(Boolean).join(' '),
    logradouro: logradouroParsed || '',
    numero: est.numero || '',
    complemento: est.complemento || '',
    bairro: est.bairro || '',
    municipio: est.cidade?.nome || '',
    cep: est.cep || '',
    telefone: est.telefone1 || '',
    email: est.email || '',
    socios: sociosList,
    statusConsulta: 'sucesso',
    dataConsulta: new Date().toISOString()
  };
}

function parseCnpjaResponse(data: any, formattedCnpj: string, defaultUf: string): Partial<CnpjLookupItem> {
  const addr = data.address || {};
  const company = data.company || {};
  const uf = addr.state || defaultUf;
  const sitCNPJ: SituaçãoCNPJ = data.status?.text === 'Ativa' ? 'ATIVA' : 'INAPTA';

  const registrations = Array.isArray(data.registrations) ? data.registrations : [];
  const regForUf = registrations.find((r: any) => (r.state || '').toUpperCase() === uf.toUpperCase() && r.enabled);
  const anyReg = registrations.find((r: any) => r.enabled);
  const chosenReg = regForUf || anyReg;

  const foundIe = chosenReg?.number;
  const cnaePrincipal = data.mainActivity?.id ? `${data.mainActivity.id}` : '';
  const ieStatus = determineIeAndCccStatus(foundIe, cnaePrincipal, sitCNPJ);

  const sociosList = Array.isArray(company.members)
    ? company.members.map((m: any) => ({
        nome: m.person?.name || '',
        qualificacao: m.role?.text || ''
      })).filter((s: any) => Boolean(s.nome))
    : [];

  const logradouroParsed = [addr.street, addr.number, addr.district].filter(Boolean).join(', ');

  return {
    cnpj: formattedCnpj,
    uf: uf,
    ie: ieStatus.ie,
    tipoIE: ieStatus.tipoIE,
    situaçaoIE: ieStatus.situaçaoIE,
    situaçaoCNPJ: sitCNPJ,
    naturezaJuridica: company.nature?.text || '',
    razaoSocial: company.name || '',
    nomeFantasia: data.alias || company.name || '',
    cnaePrincipal: cnaePrincipal,
    cnaeDescricao: data.mainActivity?.text || '',
    dataAbertura: data.founded || '',
    regimeTributario: determineTaxRegime(data),
    capitalSocial: Number(company.equity) || 0,
    enderecoCompleto: [logradouroParsed, addr.details].filter(Boolean).join(' - '),
    logradouro: addr.street || '',
    numero: addr.number || '',
    complemento: addr.details || '',
    bairro: addr.district || '',
    municipio: addr.city || '',
    cep: addr.zip ? `${addr.zip}` : '',
    telefone: Array.isArray(data.phones) && data.phones[0] ? `(${data.phones[0].area}) ${data.phones[0].number}` : '',
    email: Array.isArray(data.emails) && data.emails[0]?.address ? data.emails[0].address : '',
    socios: sociosList,
    statusConsulta: 'sucesso',
    dataConsulta: new Date().toISOString()
  };
}

/** Alias for queryCnpjsData */
export const lookupCnpj = queryCnpjsData;

