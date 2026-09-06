import http from 'http';
import { getDatabase } from '../db/database';

export interface ParametrosCalculoRtc {
  dataFatoGerador: string; // YYYY-MM-DD
  tipoOperacao: 'fornecimento' | 'aquisicao';
  ufOrigem: string;
  municipioOrigem?: string;
  ufDestino: string;
  municipioDestino?: string;
  ncm?: string;
  nbs?: string;
  cClassTrib?: string;
  cst?: string;
  baseCalculo: number;
  quantidade?: number;
  unidadeMedida?: string;
}

export interface ResultadoCalculoRtc {
  sucesso: boolean;
  origem: 'calculadora_rfb_offline' | 'motor_local_radar';
  baseCalculo: number;
  aliquotaCbs: number;
  percentualReducaoCbs: number;
  valorCbs: number;
  aliquotaIbsEstadual: number;
  percentualReducaoIbsEstadual: number;
  valorIbsEstadual: number;
  aliquotaIbsMunicipal: number;
  percentualReducaoIbsMunicipal: number;
  valorIbsMunicipal: number;
  valorTotalIbs: number;
  valorTotalTributos: number;
  memoriaCalculo: string;
  baseLegal: string;
  divergenciaDetectada?: {
    valorXmlCbs?: number;
    valorXmlIbs?: number;
    diferencaCbs: number;
    diferencaIbs: number;
    tipo: 'sem_divergencia' | 'valor_a_maior' | 'valor_a_menor' | 'divergencia_aliquota';
    detalhes: string;
  };
}

/**
 * Executa o cálculo de CBS e IBS consultando primeiramente a Calculadora Oficial da RFB (offline em localhost:8080).
 * Caso o componente Docker/JAR da Receita Federal não esteja em execução, aciona automaticamente
 * o motor local do Radar Fiscal (com base nas tabelas aliquotas_tabelas e ncm_regras_anexos).
 */
export async function calcularTributosRtc(
  params: ParametrosCalculoRtc,
  compararComXml?: { valorCbs?: number; valorIbs?: number; aliquotaCbs?: number; aliquotaIbs?: number }
): Promise<ResultadoCalculoRtc> {
  // 1. Tentar comunicação com a Calculadora Oficial da RFB (porta 8080)
  try {
    const rfbResult = await consultarCalculadoraRfbLocal(params);
    if (rfbResult) {
      if (compararComXml) {
        rfbResult.divergenciaDetectada = analisarDivergencia(rfbResult, compararComXml);
      }
      return rfbResult;
    }
  } catch {
    // Prosseguir para fallback local
  }

  // 2. Fallback Inteligente: Motor Nativo do Radar Fiscal
  const fallbackResult = calcularViaMotorLocal(params);
  if (compararComXml) {
    fallbackResult.divergenciaDetectada = analisarDivergencia(fallbackResult, compararComXml);
  }
  return fallbackResult;
}

/**
 * Consulta a API local exposta pela Calculadora de Tributos da RFB em http://localhost:8080/api/calcular
 */
async function consultarCalculadoraRfbLocal(
  params: ParametrosCalculoRtc
): Promise<ResultadoCalculoRtc | null> {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      dataFatoGerador: params.dataFatoGerador,
      uf: params.ufDestino || params.ufOrigem,
      municipio: params.municipioDestino || params.municipioOrigem,
      ncm: params.ncm,
      nbs: params.nbs,
      cClassTrib: params.cClassTrib,
      cst: params.cst,
      baseCalculo: params.baseCalculo,
      quantidade: params.quantidade || 1.0
    });

    const req = http.request(
      {
        hostname: 'localhost',
        port: 8080,
        path: '/api/calcular',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 1500 // 1.5s timeout para não travar se o serviço não estiver no ar
      },
      (res) => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }

        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const valCbs = Number(data.valorCbs || 0);
            const valIbsEst = Number(data.valorIbsEstadual || 0);
            const valIbsMun = Number(data.valorIbsMunicipal || 0);
            const totalIbs = Number((valIbsEst + valIbsMun).toFixed(2));

            resolve({
              sucesso: true,
              origem: 'calculadora_rfb_offline',
              baseCalculo: params.baseCalculo,
              aliquotaCbs: Number(data.aliquotaCbs || 0.9),
              percentualReducaoCbs: Number(data.reducaoCbs || 0),
              valorCbs: valCbs,
              aliquotaIbsEstadual: Number(data.aliquotaIbsEstadual || 0.1),
              percentualReducaoIbsEstadual: Number(data.reducaoIbsEstadual || 0),
              valorIbsEstadual: valIbsEst,
              aliquotaIbsMunicipal: Number(data.aliquotaIbsMunicipal || 0.0),
              percentualReducaoIbsMunicipal: Number(data.reducaoIbsMunicipal || 0),
              valorIbsMunicipal: valIbsMun,
              valorTotalIbs: totalIbs,
              valorTotalTributos: Number((valCbs + totalIbs).toFixed(2)),
              memoriaCalculo: data.memoriaCalculo || 'Cálculo homologado pelo motor oficial da RFB (localhost:8080).',
              baseLegal: data.baseLegal || 'LC 214/2025'
            });
          } catch {
            resolve(null);
          }
        });
      }
    );

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Motor de Cálculo Local baseado no banco de dados do Radar Fiscal (fallback oficial)
 */
function calcularViaMotorLocal(params: ParametrosCalculoRtc): ResultadoCalculoRtc {
  const db = getDatabase();

  // Buscar tabela de alíquotas para a data da operação
  const dataFato = params.dataFatoGerador || new Date().toISOString().split('T')[0];
  const tabela = db.prepare(`
    SELECT * FROM aliquotas_tabelas 
    WHERE inicio_vigencia <= ? AND final_vigencia >= ? AND modalidade = 'ad_valorem'
    ORDER BY inicio_vigencia DESC LIMIT 1
  `).get(dataFato, dataFato) as any;

  // Alíquotas padrão (Ano de teste 2026: CBS 0.9%, IBS 0.1%)
  let aliqCbs = tabela ? tabela.cbs_federal : 0.90;
  let aliqIbsEst = tabela ? tabela.ibs_estadual : 0.10;
  let aliqIbsMun = tabela ? tabela.ibs_municipal : 0.00;

  // Buscar regra de redução por NCM / cClassTrib
  let percentualReducao = 0.0;
  let baseLegal = 'LC 214/2025, Art. 342 (Período de Teste 2026)';

  if (params.ncm || params.cClassTrib) {
    const cleanNcm = (params.ncm || '').replace(/\D/g, '');
    const regra = db.prepare(`
      SELECT * FROM ncm_regras_anexos 
      WHERE (ncm = ? OR cclasstrib = ?) AND ativo = 1
      LIMIT 1
    `).get(cleanNcm, params.cClassTrib || '') as any;

    if (regra) {
      percentualReducao = regra.percentual_reducao || 0;
      baseLegal = regra.base_legal || 'LC 214/2025';
    }
  }

  const fatorReducao = 1 - (percentualReducao / 100);
  const valCbs = Number((params.baseCalculo * (aliqCbs / 100) * fatorReducao).toFixed(2));
  const valIbsEst = Number((params.baseCalculo * (aliqIbsEst / 100) * fatorReducao).toFixed(2));
  const valIbsMun = Number((params.baseCalculo * (aliqIbsMun / 100) * fatorReducao).toFixed(2));
  const totalIbs = Number((valIbsEst + valIbsMun).toFixed(2));
  const totalTributos = Number((valCbs + totalIbs).toFixed(2));

  const memoriaCalculo = `Base R$ ${params.baseCalculo.toFixed(2)} | CBS (${aliqCbs}% - Red. ${percentualReducao}%) = R$ ${valCbs.toFixed(2)} | IBS (${aliqIbsEst}% - Red. ${percentualReducao}%) = R$ ${totalIbs.toFixed(2)}`;

  return {
    sucesso: true,
    origem: 'motor_local_radar',
    baseCalculo: params.baseCalculo,
    aliquotaCbs: aliqCbs,
    percentualReducaoCbs: percentualReducao,
    valorCbs: valCbs,
    aliquotaIbsEstadual: aliqIbsEst,
    percentualReducaoIbsEstadual: percentualReducao,
    valorIbsEstadual: valIbsEst,
    aliquotaIbsMunicipal: aliqIbsMun,
    percentualReducaoIbsMunicipal: percentualReducao,
    valorIbsMunicipal: valIbsMun,
    valorTotalIbs: totalIbs,
    valorTotalTributos: totalTributos,
    memoriaCalculo,
    baseLegal
  };
}

/**
 * Confronta os valores de tributos calculados contra o que veio destacado no XML
 */
function analisarDivergencia(
  calculado: ResultadoCalculoRtc,
  xml: { valorCbs?: number; valorIbs?: number }
): ResultadoCalculoRtc['divergenciaDetectada'] {
  const vXmlCbs = xml.valorCbs || 0;
  const vXmlIbs = xml.valorIbs || 0;

  const diffCbs = Number((vXmlCbs - calculado.valorCbs).toFixed(2));
  const diffIbs = Number((vXmlIbs - calculado.valorTotalIbs).toFixed(2));

  if (Math.abs(diffCbs) <= 0.05 && Math.abs(diffIbs) <= 0.05) {
    return {
      valorXmlCbs: vXmlCbs,
      valorXmlIbs: vXmlIbs,
      diferencaCbs: 0,
      diferencaIbs: 0,
      tipo: 'sem_divergencia',
      detalhes: '✅ Documento fiscal em perfeita conformidade com o cálculo oficial da Reforma Tributária.'
    };
  }

  const tipo = (diffCbs > 0 || diffIbs > 0) ? 'valor_a_maior' : 'valor_a_menor';
  const detalhes = `⚠️ Divergência apurada no XML: CBS (Dif: R$ ${diffCbs.toFixed(2)}) / IBS (Dif: R$ ${diffIbs.toFixed(2)}).`;

  return {
    valorXmlCbs: vXmlCbs,
    valorXmlIbs: vXmlIbs,
    diferencaCbs: diffCbs,
    diferencaIbs: diffIbs,
    tipo,
    detalhes
  };
}
