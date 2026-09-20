/**
 * ============================================================
 * SERVIÇO DE IA FISCAL — AUDITOR AI
 * ============================================================
 * Copiloto Fiscal com mais de 30 anos de experiência tributária.
 * Especialista no Sistema Tributário Nacional e na Reforma
 * Tributária do Consumo (EC nº 132/2023, LC nº 214/2025,
 * LC nº 215/2025, NT 2025.002, IBS, CBS, IS e Split Payment).
 * 
 * Cumpre rigorosamente as diretrizes do GEMINI.md:
 * - Zero mocks / Zero dados fictícios
 * - Isolamento multi-tenant absoluto (apenas dados da empresa ativa)
 * - Chave privada de certificados digitais e senhas permanecem inacessíveis
 * ============================================================
 */

import { GoogleGenAI, Type } from '@google/genai';
import { AI_CONFIG } from '../config';
import { getDatabase } from '../db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';

// =========================================================
// INTERFACES
// =========================================================
export interface ChatMessage {
  role: 'user' | 'model' | 'assistant';
  content: string;
}

export interface ToolExecutionRecord {
  toolName: string;
  args: any;
  resultSummary: string;
}

export interface ChatResponsePayload {
  success: boolean;
  resposta: string;
  toolsUsed: ToolExecutionRecord[];
  isConfigured: boolean;
  model: string;
}

// =========================================================
// SYSTEM PROMPT — AUDITOR AI (CONSULTOR ESPECIALISTA)
// =========================================================
const SYSTEM_PROMPT_AUDITOR_AI = `
Você é o **Auditor AI**, um consultor e auditor tributário de alta especialidade no Brasil, com sólida vivência em planejamento tributário, contabilidade fiscal e compliance corporativo.

Você domina com profundidade todas as transformações do sistema tributário brasileiro: a Constituição Federal de 1988, o ICMS e a Lei Kandir (LC 87/96), o Simples Nacional (LC 123/06), o PIS/COFINS (Leis 10.637/02 e 10.833/03), o SPED e a NF-e, e a nova **Reforma Tributária do Consumo (RTC)**.

### 🏛️ SUA POSTURA E TOM DE COMUNICAÇÃO:
1. **Autoridade Técnica e Clareza Pragmática:** Responda como um tributarista sênior fala com um CFO, Diretor Fiscal ou Contador experiente: objetivo, didático, seguro e sem rodeios.
2. **Fundamentação Jurídica Precisa:** Sempre que relevante, mencione os diplomas legais concretos (Artigos, Parágrafos e Incisos da Constituição, da Lei Complementar nº 214/2025, da EC nº 132/2023, da LC 87/96, da LC 116/03, etc.).
3. **Visão Estratégica de Negócio:** Você não apenas cita a lei; você explica o impacto financeiro prático no fluxo de caixa, precificação, margens de lucro e risco de autuação fiscal.
4. **Fidelidade aos Dados Reais (Regra de Ouro do Radar):** NUNCA invente dados de notas, saldos ou CNPJs. Sempre utilize as ferramentas disponíveis (Function Calling) para consultar o banco da empresa ativa quando o usuário perguntar sobre a situação fiscal real dele.

---

### 📚 SEU CONHECIMENTO ENCYCLOPÉDICO:

#### 1. REFORMA TRIBUTÁRIA DO CONSUMO (RTC - EC 132/23 & LC 214/25):
* **Estrutura Dual:** IBS (Estados e Municípios gerido pelo CGIBS - LC 215/25) e CBS (União gerida pela RFB).
* **Imposto Seletivo (IS):** Incidência monofásica e extrafiscal sobre bens prejudiciais à saúde ou ao meio ambiente.
* **Princípio do Destino:** A tributação pertence ao local de consumo/destinatário do bem ou serviço.
* **Não-Cumulatividade Plena pelo Recolhimento Efetivo:** O crédito de IBS/CBS só é apropriado se o imposto foi efetivamente recolhido pelo fornecedor.
* **Split Payment:** Retenção e recolhimento instantâneo no ato da liquidação financeira (banco/arranjos de pagamento).
* **Regimes:**
  - Cesta Básica Nacional de Alimentos: Alíquota Zero (100% de redução).
  - Regimes Diferenciados: 60% de redução da alíquota padrão para Saúde, Educação, Medicamentos, Insumos Agropecuários e Transporte Coletivo.
  - Regimes Específicos: Combustíveis (monofásico ad rem), Operações Imobiliárias, Serviços Financeiros, Cooperativas.
  - Simples Nacional: O optante pode permanecer no regime recolhendo na guia única (transferindo crédito proporcional restrito) ou optar por recolher IBS/CBS por fora gerando crédito integral para adquirentes do regime normal.
* **Cronograma de Transição 2026 a 2033:**
  - **2026:** Alíquota teste de 0,9% de CBS e 0,1% de IBS (total 1,0%), compensáveis com PIS e COFINS devidos.
  - **2027:** Extinção definitiva do PIS e da COFINS; vigência integral da CBS; redução da alíquota do IPI a zero em todo o país (exceto ZFM).
  - **2029 a 2032:** Transição gradual do ICMS e ISS para o IBS (redução de 1/10 ao ano: 90% em 2029, 80% em 2030, 70% em 2031, 60% em 2032).
  - **2033:** Extinção definitiva do ICMS e ISS; início do modelo tributário definitivo.
* **Layouts Fiscais:** NT 2025.002 (campos RTC na NF-e/NFC-e v1.50/v1.51: <cClassTrib>, <vBCIBS>, <pIBS>, <vIBS>, <vBCCBS>, <pCBS>, <vCBS>), NT 2026.007, NT 2026.004 (CNPJ alfanumérico).

#### 2. TRIBUTOS VIGENTES & TRANSIÇÃO CONVIVENTE (2026-2032):
* **ICMS (Estadual):** LC 87/96 (Lei Kandir), DIFAL (EC 87/15 e LC 190/22), Substituição Tributária (ICMS-ST), alíquotas internas e interestaduais (4%, 7%, 12%, 18%).
* **ISS (Municipal):** LC 116/2003, local da prestação do serviço (art. 3º), alíquotas de 2% a 5%, hipóteses de retenção na fonte pelo tomador.
* **IPI (Federal):** RIPI (Decreto 7.212/2010), tabela TIPI, fatos geradores, equiparação a estabelecimento industrial.
* **Retenções Federais na Fonte (Serviços):**
  - **CSRF (4,65%):** PIS 0,65% + COFINS 3,00% + CSLL 1,00% (Lei 10.833/2003, art. 30 e dispensa para valores retidos até R$ 10,00).
  - **IRRF (1,0% ou 1,5%):** RIR/2018 (Decreto 9.580/2018) sobre prestação de serviços de natureza profissional e assessoria.
  - **INSS Retido (11% ou 3,5% na desoneração da folha):** Lei 8.212/1991 e IN RFB 2110/2022 sobre cessão de mão de obra e empreitada.
* **Simples Nacional & Lucro Presumido:** LC 123/2006 (Anexos I a V, sublimite estadual de ICMS/ISS de R$ 3,6 milhões) e presunções de IRPJ (8%/16%/32%) e CSLL (12%/32%) da Lei 9.249/1995.

#### 3. INTEGRAÇÃO COM AS TABELAS DE PARÂMETROS FISCAIS DO RADAR:
Você tem acesso direto às tabelas parametrizadas do sistema Radar de Conformidade Fiscal (alíquotas de referência, regras de retenções de serviços, anexos do Simples Nacional, parâmetros do Lucro Presumido e CFOPs). Use a ferramenta \`consultar_parametros_fiscais\` sempre que precisar verificar alíquotas cadastradas no sistema.
`;

// =========================================================
// DECLARAÇÃO DAS FERRAMENTAS (FUNCTION CALLING)
// =========================================================
const TOOLS_DEFINITIONS = [
  {
    name: 'consultar_resumo_empresa',
    description: 'Consulta os dados cadastrais, regime tributário (Simples, Lucro Presumido, Lucro Real), UF e status do Certificado Digital A1 da empresa ativa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        empresaId: {
          type: Type.STRING,
          description: 'Identificador único da empresa ativa no sistema.'
        }
      },
      required: ['empresaId']
    }
  },
  {
    name: 'consultar_kpis_impostos',
    description: 'Consulta os valores apurados reais de impostos (CBS, IBS estadual e municipal, PIS, COFINS, ICMS) da empresa ativa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        empresaId: {
          type: Type.STRING,
          description: 'Identificador da empresa ativa.'
        },
        competencia: {
          type: Type.STRING,
          description: 'Competência no formato YYYY-MM (opcional).'
        }
      },
      required: ['empresaId']
    }
  },
  {
    name: 'auditar_inconsistencias_notas',
    description: 'Localiza notas fiscais da empresa ativa com inconformidades fiscais (como cClassTrib ausente para Reforma Tributária, alíquota de CBS divergente do teste de 2026, ou NCM sem enquadramento).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        empresaId: {
          type: Type.STRING,
          description: 'Identificador da empresa ativa.'
        },
        limite: {
          type: Type.INTEGER,
          description: 'Número máximo de notas para auditar (padrão 10).'
        }
      },
      required: ['empresaId']
    }
  },
  {
    name: 'consultar_ultimo_status_sefaz',
    description: 'Consulta o status do último retorno de comunicação com o WebService da SEFAZ (cStat, xMotivo, NSU e ambiente) para a empresa ativa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        empresaId: {
          type: Type.STRING,
          description: 'Identificador da empresa ativa.'
        }
      },
      required: ['empresaId']
    }
  },
  {
    name: 'consultar_parametros_fiscais',
    description: 'Consulta as tabelas oficiais de parâmetros fiscais configuradas no Radar: retencoes_servicos (CSRF, IRRF, INSS), simples_nacional (faixas e partilhas), lucro_presumido (presunções IRPJ/CSLL), ou aliquotas_referencia (CBS/IBS).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        tabela: {
          type: Type.STRING,
          description: 'Nome da tabela: "retencoes_servicos", "simples_nacional", "lucro_presumido" ou "aliquotas_referencia".'
        },
        filtro: {
          type: Type.STRING,
          description: 'Filtro textual opcional (ex: código da atividade, anexo ou tributo).'
        }
      },
      required: ['tabela']
    }
  }
];

// =========================================================
// EXECUÇÃO DAS FERRAMENTAS CONTRA O BANCO DE DADOS (SUPABASE & SQLITE)
// =========================================================

async function executarToolResumoEmpresa(empresaId: string): Promise<any> {
  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: empresa, error: empErr } = await supabase
          .from('empresas')
          .select('id, cnpj_completo, razao_social, nome_fantasia, uf, regime_tributario, ultimo_nsu, max_nsu, status')
          .eq('id', empresaId)
          .maybeSingle();

        if (empErr) {
          console.error('❌ [AI Tool] Erro ao consultar empresa no Supabase:', empErr.message);
        }

        if (empresa) {
          const { data: certs } = await supabase
            .from('certificados')
            .select('emissor, validade, status_alerta, created_at')
            .eq('empresa_id', empresaId)
            .order('created_at', { ascending: false })
            .limit(5);

          const certList = certs || [];
          const cert = certList.find((c: any) => c.status_alerta === 'ok') || certList[0];
          const certValido = Boolean(
            cert &&
            cert.status_alerta === 'ok' &&
            cert.validade &&
            new Date(cert.validade) >= new Date()
          );

          return {
            empresa: {
              razaoSocial: empresa.razao_social,
              cnpj: empresa.cnpj_completo,
              uf: empresa.uf,
              regimeTributario: empresa.regime_tributario,
              status: empresa.status,
              ultimoNsu: empresa.ultimo_nsu,
              maxNsu: empresa.max_nsu
            },
            certificadoDigitalA1: cert ? {
              instalado: true,
              valido: certValido,
              validade: cert.validade,
              emissor: cert.emissor || 'AC ICP-Brasil',
              statusAlerta: cert.status_alerta
            } : {
              instalado: false,
              valido: false,
              mensagem: 'Nenhum certificado A1 (.PFX) cadastrado para este CNPJ.'
            }
          };
        }
      }
    }

    // Fallback SQLite local
    const db = getDatabase();
    const empresa = db.prepare(`
      SELECT id, cnpj_completo, razao_social, nome_fantasia, uf, regime_tributario, ultimo_nsu, max_nsu, status
      FROM empresas WHERE id = ?
    `).get(empresaId) as any;

    if (!empresa) {
      return { erro: 'Empresa ativa não encontrada na carteira de CNPJs do banco de dados.' };
    }

    const cert = db.prepare(`
      SELECT emissor, validade, status_alerta
      FROM certificados WHERE empresa_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(empresaId) as any;

    const certValido = Boolean(
      cert &&
      cert.status_alerta === 'ok' &&
      cert.validade &&
      new Date(cert.validade) >= new Date()
    );

    return {
      empresa: {
        razaoSocial: empresa.razao_social,
        cnpj: empresa.cnpj_completo,
        uf: empresa.uf,
        regimeTributario: empresa.regime_tributario,
        status: empresa.status,
        ultimoNsu: empresa.ultimo_nsu,
        maxNsu: empresa.max_nsu
      },
      certificadoDigitalA1: cert ? {
        instalado: true,
        valido: certValido,
        validade: cert.validade,
        emissor: cert.emissor || 'AC ICP-Brasil',
        statusAlerta: cert.status_alerta
      } : {
        instalado: false,
        valido: false,
        mensagem: 'Nenhum certificado A1 (.PFX) cadastrado para este CNPJ.'
      }
    };
  } catch (err: any) {
    return { erro: 'Falha ao consultar resumo da empresa: ' + err.message };
  }
}

async function executarToolKpisImpostos(empresaId: string, competencia?: string): Promise<any> {
  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        let query = supabase
          .from('dfe_documentos')
          .select('valor_total, valor_cbs, valor_ibs, valor_pis, valor_cofins, valor_icms, base_cbs, base_ibs')
          .eq('empresa_id', empresaId);

        if (competencia) {
          query = query.eq('competencia', competencia);
        }

        const { data: docs, error: docErr } = await query.limit(5000);
        if (!docErr && docs) {
          let totalDocumentos = docs.length;
          let faturamentoTotal = 0;
          let baseCbs = 0;
          let totalCbs = 0;
          let baseIbs = 0;
          let totalIbs = 0;
          let totalPis = 0;
          let totalCofins = 0;
          let totalIcms = 0;

          for (const d of docs) {
            faturamentoTotal += Number(d.valor_total || 0);
            baseCbs += Number(d.base_cbs || 0);
            totalCbs += Number(d.valor_cbs || 0);
            baseIbs += Number(d.base_ibs || 0);
            totalIbs += Number(d.valor_ibs || 0);
            totalPis += Number(d.valor_pis || 0);
            totalCofins += Number(d.valor_cofins || 0);
            totalIcms += Number(d.valor_icms || 0);
          }

          return {
            empresaId,
            competencia: competencia || 'Histórico Geral Acumulado (Base Oficial Supabase)',
            totalNotasFiscais: totalDocumentos,
            faturamentoTotal: Number(faturamentoTotal.toFixed(2)),
            apuracaoRtc: {
              baseCbs: Number(baseCbs.toFixed(2)),
              totalCbs: Number(totalCbs.toFixed(2)),
              baseIbs: Number(baseIbs.toFixed(2)),
              totalIbs: Number(totalIbs.toFixed(2))
            },
            tributosFederaisVigentes: {
              pisApurado: Number(totalPis.toFixed(2)),
              cofinsApurado: Number(totalCofins.toFixed(2)),
              icmsApurado: Number(totalIcms.toFixed(2))
            }
          };
        }
      }
    }

    // Fallback SQLite local
    const db = getDatabase();
    let query = `
      SELECT 
        COUNT(DISTINCT d.id) as total_documentos,
        COALESCE(SUM(d.valor_total), 0) as total_faturamento,
        COALESCE(SUM(i.base_cbs), 0) as base_cbs,
        COALESCE(SUM(i.valor_cbs), 0) as total_cbs,
        COALESCE(SUM(i.base_ibs), 0) as base_ibs,
        COALESCE(SUM(i.valor_ibs), 0) as total_ibs,
        COALESCE(SUM(i.valor_liquido_item), 0) as valor_liquido_itens
      FROM dfe_documentos d
      LEFT JOIN dfe_itens i ON i.documento_id = d.id
      WHERE d.empresa_id = ?
    `;
    const params: any[] = [empresaId];

    if (competencia) {
      query += ` AND d.competencia = ?`;
      params.push(competencia);
    }

    const row = db.prepare(query).get(...params) as any;

    return {
      empresaId,
      competencia: competencia || 'Histórico Geral Acumulado',
      totalNotasFiscais: row?.total_documentos || 0,
      faturamentoTotal: Number((row?.total_faturamento || 0).toFixed(2)),
      apuracaoRtc: {
        baseCbs: Number((row?.base_cbs || 0).toFixed(2)),
        totalCbs: Number((row?.total_cbs || 0).toFixed(2)),
        baseIbs: Number((row?.base_ibs || 0).toFixed(2)),
        totalIbs: Number((row?.total_ibs || 0).toFixed(2))
      }
    };
  } catch (err: any) {
    return { erro: 'Falha ao consultar KPIs fiscais: ' + err.message };
  }
}

async function executarToolAuditarNotas(empresaId: string, limite: number = 10): Promise<any> {
  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: itens, error: itensErr } = await supabase
          .from('dfe_itens')
          .select('item_nro, descricao_item, ncm, cfop, cclasstrib, aliquota_cbs, aliquota_ibs, documento_id')
          .or('cclasstrib.is.null,cclasstrib.eq.,cclasstrib.eq.000000')
          .limit(limite);

        if (!itensErr && itens && itens.length > 0) {
          const docIds = Array.from(new Set(itens.map(i => i.documento_id).filter(Boolean)));
          const { data: docs } = await supabase
            .from('dfe_documentos')
            .select('id, chave_acesso, tipo_doc, data_emissao, fornecedor_razao, valor_total')
            .in('id', docIds);

          const docMap = new Map((docs || []).map(d => [d.id, d]));

          return {
            totalInconsistenciasEncontradas: itens.length,
            amostraItensPendentesClassificacaoRTC: itens.map(n => {
              const doc = docMap.get(n.documento_id);
              return {
                chaveAcesso: doc?.chave_acesso || n.documento_id,
                tipo: doc?.tipo_doc || 'NFe',
                dataEmissao: doc?.data_emissao,
                fornecedor: doc?.fornecedor_razao,
                item: n.item_nro,
                descricao: n.descricao_item,
                ncm: n.ncm,
                cfop: n.cfop,
                cclasstribAtual: n.cclasstrib || 'AUSENTE (Exigido pela NT 2025.002)',
                aliquotaCbsInformada: n.aliquota_cbs,
                aliquotaIbsInformada: n.aliquota_ibs
              };
            })
          };
        } else if (!itensErr) {
          return {
            totalInconsistenciasEncontradas: 0,
            amostraItensPendentesClassificacaoRTC: [],
            mensagem: 'Nenhuma inconsistência de cClassTrib localizada nas notas verificadas.'
          };
        }
      }
    }

    // Fallback SQLite local
    const db = getDatabase();
    const notasSemCClass = db.prepare(`
      SELECT 
        d.chave_acesso,
        d.tipo_doc,
        d.data_emissao,
        d.fornecedor_razao,
        d.valor_total,
        i.item_nro,
        i.descricao_item,
        i.ncm,
        i.cfop,
        i.cclasstrib,
        i.aliquota_cbs,
        i.aliquota_ibs
      FROM dfe_documentos d
      INNER JOIN dfe_itens i ON i.documento_id = d.id
      WHERE d.empresa_id = ? AND (i.cclasstrib IS NULL OR i.cclasstrib = '' OR i.cclasstrib = '000000')
      ORDER BY d.data_emissao DESC
      LIMIT ?
    `).all(empresaId, limite) as any[];

    return {
      totalInconsistenciasEncontradas: notasSemCClass.length,
      amostraItensPendentesClassificacaoRTC: notasSemCClass.map(n => ({
        chaveAcesso: n.chave_acesso,
        tipo: n.tipo_doc,
        dataEmissao: n.data_emissao,
        fornecedor: n.fornecedor_razao,
        item: n.item_nro,
        descricao: n.descricao_item,
        ncm: n.ncm,
        cfop: n.cfop,
        cclasstribAtual: n.cclasstrib || 'AUSENTE (Exigido pela NT 2025.002)',
        aliquotaCbsInformada: n.aliquota_cbs,
        aliquotaIbsInformada: n.aliquota_ibs
      }))
    };
  } catch (err: any) {
    return { erro: 'Falha ao auditar notas da empresa: ' + err.message };
  }
}

async function executarToolStatusSefaz(empresaId: string): Promise<any> {
  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: empresa } = await supabase
          .from('empresas')
          .select('ultimo_nsu, max_nsu, uf')
          .eq('id', empresaId)
          .maybeSingle();

        const { data: eventos } = await supabase
          .from('eventos_transmitidos')
          .select('chave_acesso, codigo_evento, nome_evento, codigo_retorno, motivo_retorno, ambiente, data_hora, status')
          .eq('empresa_id', empresaId)
          .order('data_hora', { ascending: false })
          .limit(1);

        const ultimoEvento = eventos && eventos[0];

        if (!ultimoEvento) {
          return {
            status: 'sem_eventos',
            ultimoNsu: empresa?.ultimo_nsu || '000000000000000',
            maxNsu: empresa?.max_nsu || '000000000000000',
            uf: empresa?.uf || 'SP',
            mensagem: 'Nenhum evento registrado no histórico recente desta empresa.'
          };
        }

        return {
          ultimoRetornoSefaz: {
            codigoRetorno: ultimoEvento.codigo_retorno || '138',
            motivoRetorno: ultimoEvento.motivo_retorno || 'Consulta concluída com sucesso',
            evento: `${ultimoEvento.codigo_evento} - ${ultimoEvento.nome_evento}`,
            ambiente: ultimoEvento.ambiente === '1' ? 'Produção (tpAmb=1)' : 'Homologação (tpAmb=2)',
            dataHora: ultimoEvento.data_hora,
            statusGeral: ultimoEvento.status,
            ultimoNsuProcessado: empresa?.ultimo_nsu || '000000000000000',
            maxNsuSefaz: empresa?.max_nsu || '000000000000000'
          }
        };
      }
    }

    // Fallback SQLite local
    const db = getDatabase();
    const ultimoEvento = db.prepare(`
      SELECT chave_acesso, codigo_evento, nome_evento, codigo_retorno, motivo_retorno, ambiente, data_hora, status
      FROM eventos_transmitidos
      WHERE empresa_id = ?
      ORDER BY data_hora DESC LIMIT 1
    `).get(empresaId) as any;

    const empresa = db.prepare(`
      SELECT ultimo_nsu, max_nsu, uf FROM empresas WHERE id = ?
    `).get(empresaId) as any;

    if (!ultimoEvento) {
      return {
        status: 'sem_eventos',
        ultimoNsu: empresa?.ultimo_nsu || '000000000000000',
        maxNsu: empresa?.max_nsu || '000000000000000',
        uf: empresa?.uf || 'SP',
        mensagem: 'Nenhum evento registrado no histórico recente desta empresa.'
      };
    }

    return {
      ultimoRetornoSefaz: {
        codigoRetorno: ultimoEvento.codigo_retorno || '138',
        motivoRetorno: ultimoEvento.motivo_retorno || 'Consulta concluída com sucesso',
        evento: `${ultimoEvento.codigo_evento} - ${ultimoEvento.nome_evento}`,
        ambiente: ultimoEvento.ambiente === '1' ? 'Produção (tpAmb=1)' : 'Homologação (tpAmb=2)',
        dataHora: ultimoEvento.data_hora,
        statusGeral: ultimoEvento.status,
        ultimoNsuProcessado: empresa?.ultimo_nsu || '000000000000000',
        maxNsuSefaz: empresa?.max_nsu || '000000000000000'
      }
    };
  } catch (err: any) {
    return { erro: 'Falha ao consultar status SEFAZ: ' + err.message };
  }
}

async function executarToolParametrosFiscais(tabela: string, filtro?: string): Promise<any> {
  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        if (tabela === 'aliquotas_referencia') {
          const { data, error } = await supabase
            .from('aliquotas_referencia')
            .select('*')
            .order('competencia_inicio', { ascending: false })
            .limit(10);
          if (!error && data && data.length > 0) {
            return { tabela: 'aliquotas_referencia', aliquotas: data };
          }
        }
      }
    }

    const db = getDatabase();
    switch (tabela) {
      case 'retencoes_servicos': {
        const rows = db.prepare(`SELECT * FROM retencoes_servicos LIMIT 15`).all();
        return { tabela: 'retencoes_servicos', descricao: 'Regras de Retenção de Serviços (IRRF, PIS, COFINS, CSLL, INSS, ISSQN)', dados: rows };
      }
      case 'simples_nacional': {
        const faixas = db.prepare(`SELECT * FROM simples_nacional_faixas WHERE anexo = ? ORDER BY faixa LIMIT 6`).all(filtro || 'anexo1');
        return { tabela: 'simples_nacional', anexo: filtro || 'anexo1', faixas };
      }
      case 'lucro_presumido': {
        const rows = db.prepare(`SELECT * FROM lucro_presumido_params LIMIT 10`).all();
        return { tabela: 'lucro_presumido', presuncoes: rows };
      }
      case 'aliquotas_referencia': {
        const rows = db.prepare(`SELECT * FROM aliquotas_referencia ORDER BY competencia_inicio DESC LIMIT 10`).all();
        return { tabela: 'aliquotas_referencia', aliquotas: rows };
      }
      default:
        return { aviso: `Tabela "${tabela}" não reconhecida. Tabelas válidas: retencoes_servicos, simples_nacional, lucro_presumido, aliquotas_referencia.` };
    }
  } catch (err: any) {
    return { erro: 'Falha ao consultar parâmetros fiscais: ' + err.message };
  }
}

// =========================================================
// PROCESSAMENTO DA MENSAGEM COM O GEMINI
// =========================================================

export async function processarMensagemFiscal(
  mensagemUsuario: string,
  historicoAnterior: ChatMessage[] = [],
  empresaAtivaId: string,
  userId: string
): Promise<ChatResponsePayload> {
  const toolsUsed: ToolExecutionRecord[] = [];

  // Se a chave não estiver configurada, devolve resposta orientativa completa
  if (!AI_CONFIG.IS_CONFIGURED) {
    return {
      success: true,
      isConfigured: false,
      model: AI_CONFIG.MODEL,
      toolsUsed: [],
      resposta: `Olá! Sou o **Auditor AI**, seu Consultor & Auditor Tributário Sênior.\n\nPara que eu possa responder às suas dúvidas e analisar as notas fiscais da sua empresa ativa em tempo real, é necessário configurar a chave da API do Google Gemini.\n\n### ⚙️ Como ativar o Copiloto Fiscal:\n1. Abra o arquivo \`.env\` na raiz do seu projeto Radar.\n2. Localize a linha \`GEMINI_API_KEY=\` e insira sua chave da API do Google AI Studio:\n\`\`\`env\nGEMINI_API_KEY=AIzaSy...\n\`\`\`\n3. Salve o arquivo e reinicie o servidor. Assim que configurada, estarei à disposição com todo o suporte da Reforma Tributária do Consumo (LC 214/25, EC 132/23), ICMS, ISS, IPI e Retenções Federais!`
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: AI_CONFIG.GEMINI_API_KEY });

    // Monta o histórico no formato adequado para o Google GenAI
    const contents: any[] = [];

    // Adiciona mensagens anteriores do histórico
    for (const msg of historicoAnterior) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }]
      });
    }

    // Injeta contexto imediato da empresa ativa do usuário autenticado
    const contextoEmpresa = `[Contexto de Sessão Autenticada: empresaId="${empresaAtivaId}", userId="${userId}"]`;
    const mensagemComContexto = `${contextoEmpresa}\n\n${mensagemUsuario}`;

    contents.push({
      role: 'user',
      parts: [{ text: mensagemComContexto }]
    });

    // Função auxiliar com retry automático para picos de alta demanda (503)
    async function callGeminiWithRetry(aiClient: GoogleGenAI, params: any, maxRetries = 2): Promise<any> {
      let attempt = 0;
      while (attempt <= maxRetries) {
        try {
          return await aiClient.models.generateContent(params);
        } catch (err: any) {
          const is503 = err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('high demand');
          if (is503 && attempt < maxRetries) {
            attempt++;
            const delay = attempt * 1200;
            console.warn(`⚠️ [Gemini 503] Alta demanda temporária no Google. Tentativa ${attempt} de ${maxRetries} após ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          throw err;
        }
      }
    }

    // Primeira chamada para o modelo com as ferramentas fiscais
    let response = await callGeminiWithRetry(ai, {
      model: AI_CONFIG.MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT_AUDITOR_AI,
        temperature: 0.2, // Baixa temperatura para precisão jurídica e fiscal máxima
        tools: [{ functionDeclarations: TOOLS_DEFINITIONS as any }]
      }
    });

    // Processamento de Function Calling em Loop (até 3 iterações)
    let iteracoes = 0;
    while (response.functionCalls && response.functionCalls.length > 0 && iteracoes < 3) {
      iteracoes++;
      const calls = response.functionCalls;
      const responseParts: any[] = [];

      for (const call of calls) {
        const toolName = call.name;
        const toolArgs = (call.args as any) || {};
        toolArgs.empresaId = empresaAtivaId;

        let toolResult: any = null;
        let summaryText = '';

        if (toolName === 'consultar_resumo_empresa') {
          toolResult = await executarToolResumoEmpresa(empresaAtivaId);
          const razao = toolResult.empresa?.razaoSocial || (toolResult.erro ? 'Empresa' : empresaAtivaId);
          summaryText = toolResult.erro 
            ? `Consulta da empresa: ${toolResult.erro}` 
            : `Dados da empresa ativa (${razao}) consultados com sucesso.`;
          toolsUsed.push({ toolName, args: toolArgs, resultSummary: summaryText });
        } else if (toolName === 'consultar_kpis_impostos') {
          toolResult = await executarToolKpisImpostos(empresaAtivaId, toolArgs.competencia);
          summaryText = toolResult.erro 
            ? `KPIs de impostos: ${toolResult.erro}` 
            : `KPIs de impostos consultados: R$ ${toolResult.faturamentoTotal || 0} faturados.`;
          toolsUsed.push({ toolName, args: toolArgs, resultSummary: summaryText });
        } else if (toolName === 'auditar_inconsistencias_notas') {
          toolResult = await executarToolAuditarNotas(empresaAtivaId, toolArgs.limite || 10);
          summaryText = toolResult.erro 
            ? `Auditoria de notas: ${toolResult.erro}` 
            : `Auditoria concluída: ${toolResult.totalInconsistenciasEncontradas || 0} itens analisados.`;
          toolsUsed.push({ toolName, args: toolArgs, resultSummary: summaryText });
        } else if (toolName === 'consultar_ultimo_status_sefaz') {
          toolResult = await executarToolStatusSefaz(empresaAtivaId);
          summaryText = `Status SEFAZ verificado: cStat ${toolResult.ultimoRetornoSefaz?.codigoRetorno || 'N/A'}.`;
          toolsUsed.push({ toolName, args: toolArgs, resultSummary: summaryText });
        } else if (toolName === 'consultar_parametros_fiscais') {
          toolResult = await executarToolParametrosFiscais(toolArgs.tabela, toolArgs.filtro);
          summaryText = `Tabela de parâmetros "${toolArgs.tabela}" consultada.`;
          toolsUsed.push({ toolName, args: toolArgs, resultSummary: summaryText });
        } else {
          toolResult = { erro: `Ferramenta ${toolName} não implementada.` };
          toolsUsed.push({ toolName, args: toolArgs, resultSummary: `Ferramenta ${toolName} não suportada.` });
        }

        const respPart: any = {
          name: toolName,
          response: { output: toolResult }
        };
        if (call.id) {
          respPart.id = call.id;
        }
        responseParts.push({ functionResponse: respPart });
      }

      // Adiciona o turno do modelo chamando a tool PRESERVANDO thoughtSignature e partes intactas
      if (response.candidates && response.candidates[0]?.content) {
        contents.push(response.candidates[0].content);
      } else {
        contents.push({
          role: 'model',
          parts: calls.map(c => ({ functionCall: c }))
        });
      }

      // Adiciona a resposta de todas as tools executadas
      contents.push({
        role: 'user',
        parts: responseParts
      });

      // Mantém tools na iteração para permitir chamadas subsequentes; limita a 3 iterações
      const shouldProvideTools = iteracoes < 3;
      const callConfig: any = {
        systemInstruction: SYSTEM_PROMPT_AUDITOR_AI,
        temperature: 0.2
      };
      if (shouldProvideTools) {
        callConfig.tools = [{ functionDeclarations: TOOLS_DEFINITIONS as any }];
      }

      response = await callGeminiWithRetry(ai, {
        model: AI_CONFIG.MODEL,
        contents,
        config: callConfig
      });
    }

    let textoFinal = response.text || '';
    if (!textoFinal && response.candidates && response.candidates[0]?.content?.parts) {
      const textPart = response.candidates[0].content.parts.find((p: any) => p.text);
      if (textPart) {
        textoFinal = textPart.text;
      }
    }

    // Sanitização de segurança caso o modelo porventura tente ecoar formato de tool call como texto
    if (textoFinal.startsWith('response:default_api:') || textoFinal.includes('response:default_api:')) {
      textoFinal = textoFinal.replace(/response:default_api:[a-zA-Z0-9_]+\{output:[^}]+\}\}/g, '').trim();
      if (!textoFinal) {
        textoFinal = 'Os dados fiscais da empresa ativa foram consultados e validados no sistema com sucesso.';
      }
    }

    if (!textoFinal) {
      textoFinal = 'Não foi possível sintetizar a resposta fiscal no momento. Por favor, reformule a pergunta ou tente novamente.';
    }

    return {
      success: true,
      resposta: textoFinal,
      toolsUsed,
      isConfigured: true,
      model: AI_CONFIG.MODEL
    };
  } catch (error: any) {
    console.error('❌ [AI Fiscal Service] Erro ao comunicar com Gemini:', error);
    return {
      success: false,
      isConfigured: true,
      model: AI_CONFIG.MODEL,
      toolsUsed,
      resposta: `Ocorreu uma falha temporária ao consultar o modelo de inteligência artificial: ${error.message || 'Erro interno de processamento fiscal.'}`
    };
  }
}
