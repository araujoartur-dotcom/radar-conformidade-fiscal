/**
 * ============================================================
 * SERVIÇO DE CAPTURA & GESTÃO DE NFS-E — RADAR FISCAL
 * ============================================================
 * Integração e orquestração de Notas Fiscais de Serviços:
 * 1. Ambiente de Dados Nacional (ADN - Receita Federal / Serpro)
 *    - API de Distribuição de DF-e da NFS-e Nacional via mTLS (Certificado A1)
 * 2. Conectores Municipais (Prefeituras):
 *    - Padrão ABRASF (Nota Carioca, BH, etc.)
 *    - PMSP (São Paulo - Capital / Nota do Milhão)
 * 
 * - Extração analítica de tomador, prestador, ISS e retenções (IRRF, INSS, PIS, COFINS, CSLL).
 * - Persistência unificada no Supabase (tipo_doc = 'NFSe') + SQLite local.
 * ============================================================
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import crypto from 'crypto';
import zlib from 'zlib';
import soap from 'soap';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';
import { getBrasiliaTimestamp, getBrasiliaDate } from '../utils/timezone';
import { parseFiscalXml, sanitizeXmlAntiXXE, extractTagRegex, extractSubTagRegex } from '../utils/xmlParser';
import { resolveSupabaseEmpresaId } from '../utils/tenantHelper';
import { descriptografarCertificado, converterPfxParaPem } from './sefazService';

export interface NfseSyncParams {
  empresaId: string;
  cnpj: string;
  tpAmb?: '1' | '2';
  ultNSU?: string;
  municipioIbge?: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface OcorrenciaConectorMunicipal {
  ibge?: string;
  municipio: string;
  uf: string;
  provedor: string;
  tecnologia?: string;
  status: 'sem_notas' | 'erro_500' | 'erro_rede_dns' | 'timeout' | 'erro_envelope' | 'autenticacao' | 'redirecionamento' | 'outro';
  statusCode?: number;
  mensagem: string;
  detalheTecnico?: string;
  acaoSugerida: string;
}

export interface NfseSyncResult {
  success: boolean;
  provedor: string;
  tpAmb: string;
  ultNSU: string;
  maxNSU: string;
  documentosNovos: number;
  documentosExistentes: number;
  totalValorServicos: number;
  totalRetencoes: {
    iss: number;
    irrf: number;
    inss: number;
    pis: number;
    cofins: number;
    csll: number;
  };
  mensagens: string[];
  detalhes?: any;
  prefeiturasSemCaptura?: OcorrenciaConectorMunicipal[];
}

export interface NfseStatusResumo {
  empresaId: string;
  cnpj: string;
  totalNfse: number;
  totalTomadas: number;
  totalPrestadas: number;
  totalValor: number;
  totalIss: number;
  totalRetencoes: number;
  ultNSUNacional: string;
  certificadoValido: boolean;
  certificadoDiasRestantes?: number;
  conectoresAtivos: Array<{
    id: string;
    nome: string;
    tipo: 'nacional' | 'municipal';
    status: 'operacional' | 'sem_certificado' | 'aguardando_configuracao';
    cidadesAtendidas: string;
  }>;
}

// =========================================================
// 1. ENDPOINTS DO AMBIENTE DE DADOS NACIONAL (ADN)
// Ref: https://adn.nfse.gov.br/contribuintes/docs/index.html
// =========================================================
const ADN_ENDPOINTS = {
  producao: {
    baseUrl: 'https://adn.nfse.gov.br',
    distribuicaoPath: '/contribuintes/DFe',
  },
  homologacao: {
    baseUrl: 'https://adn.producaorestrita.nfse.gov.br',
    distribuicaoPath: '/contribuintes/DFe',
  }
};

// =========================================================
// 2. SINCRONIZAÇÃO VIA ADN (NFS-E NACIONAL)
// =========================================================
export async function sincronizarNfseNacional(params: NfseSyncParams): Promise<NfseSyncResult> {
  const { empresaId, cnpj, tpAmb = '1' } = params;
  const cleanCnpj = cnpj.replace(/\D/g, '');
  const isProd = tpAmb === '1';
  const endpoint = isProd ? ADN_ENDPOINTS.producao : ADN_ENDPOINTS.homologacao;

  // Recuperar último NSU sincronizado do banco se não for fornecido explicitamente
  let ultNSU = params.ultNSU;
  if (!ultNSU || ultNSU === '0') {
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const { data: empSupa } = await supabase
            .from('empresas')
            .select('ultimo_nsu_nfse')
            .eq('id', empresaId)
            .maybeSingle();
          if (empSupa?.ultimo_nsu_nfse && empSupa.ultimo_nsu_nfse !== '0') {
            ultNSU = String(empSupa.ultimo_nsu_nfse);
          }
        }
      } catch {}
    }
    if (!ultNSU || ultNSU === '0') {
      try {
        const db = getDatabase();
        const emp = db.prepare('SELECT ultimo_nsu_nfse FROM empresas WHERE id = ?').get(empresaId) as any;
        if (emp?.ultimo_nsu_nfse && emp.ultimo_nsu_nfse !== '0') {
          ultNSU = emp.ultimo_nsu_nfse;
        }
      } catch {}
    }
  }
  if (!ultNSU) ultNSU = '0';

  const result: NfseSyncResult = {
    success: false,
    provedor: 'ADN - Ambiente de Dados Nacional (Receita Federal)',
    tpAmb: isProd ? 'Produção (tpAmb=1)' : 'Homologação (tpAmb=2)',
    ultNSU,
    maxNSU: ultNSU,
    documentosNovos: 0,
    documentosExistentes: 0,
    totalValorServicos: 0,
    totalRetencoes: { iss: 0, irrf: 0, inss: 0, pis: 0, cofins: 0, csll: 0 },
    mensagens: []
  };

  // Carregar e descriptografar Certificado A1
  const certData = await descriptografarCertificado(empresaId, cleanCnpj);
  if (!certData) {
    result.mensagens.push('⚠️ Certificado Digital A1 não encontrado ou não configurado para o CNPJ.');
    return result;
  }

  let pem: { key: string; cert: string; ca?: string[] };
  try {
    pem = converterPfxParaPem(certData.pfxBuffer, certData.senha);
  } catch (err: any) {
    result.mensagens.push(`❌ Erro ao processar chave do Certificado A1: ${err.message}`);
    return result;
  }

  // Configuração do Agente HTTPS com mTLS
  const httpsAgent = new https.Agent({
    cert: pem.cert,
    key: pem.key,
    ca: pem.ca && pem.ca.length > 0 ? pem.ca : undefined,
    rejectUnauthorized: false,
    timeout: 30000,
  });

  try {
    // Endpoint real: GET /contribuintes/DFe/{NSU}?cnpjConsulta={cleanCnpj}
    const urlObj = new URL(`${endpoint.baseUrl}${endpoint.distribuicaoPath}/${ultNSU}`);
    if (cleanCnpj) {
      urlObj.searchParams.set('cnpjConsulta', cleanCnpj);
    }
    const fullUrl = urlObj.toString();
    result.mensagens.push(`📡 Conectando ao ADN (${fullUrl}) com certificado do CNPJ ${cleanCnpj}...`);

    // Chamada à API REST do ADN da Receita Federal
    const responseData = await new Promise<any>((resolve, reject) => {
      const url = new URL(fullUrl);
      const req = https.request(url, {
        method: 'GET',
        agent: httpsAgent,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          result.mensagens.push(`🔄 ADN respondeu com HTTP ${res.statusCode}.`);
          
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(body);
              const preview = typeof parsed === 'object' ? JSON.stringify(parsed).substring(0, 250) : String(parsed).substring(0, 250);
              result.mensagens.push(`📦 Retorno ADN (${res.statusCode}): ${preview}`);
              resolve(parsed);
            } catch {
              // Se não for JSON, pode ser XML bruto
              const xmlPreview = body.substring(0, 250);
              result.mensagens.push(`📦 Retorno ADN em XML (${res.statusCode}, ${body.length}b): ${xmlPreview}`);
              resolve({ xmlRaw: body });
            }
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            result.mensagens.push(`🔒 Acesso negado (HTTP ${res.statusCode}). Possível problema com certificado digital ou CNPJ não credenciado no portal NFS-e Nacional.`);
            resolve({ httpStatus: res.statusCode, errorBody: body, authError: true });
          } else if (res.statusCode === 404) {
            result.mensagens.push(`⚠️ Endpoint não encontrado (HTTP 404). Verifique se o CNPJ está cadastrado no Portal Nacional da NFS-e.`);
            resolve({ httpStatus: 404, errorBody: body });
          } else {
            // Logar o corpo da resposta para diagnóstico
            const bodyPreview = body.substring(0, 500);
            result.mensagens.push(`⚠️ Resposta inesperada do ADN (HTTP ${res.statusCode}): ${bodyPreview}`);
            resolve({ httpStatus: res.statusCode, errorBody: body });
          }
        });
      });

      req.on('error', (err) => {
        result.mensagens.push(`❌ Erro de conexão com o ADN: ${err.message}`);
        if (err.message.includes('ENOTFOUND')) {
          result.mensagens.push(`🌐 DNS não resolvido. Verifique se o servidor ${endpoint.baseUrl} está acessível da sua rede.`);
        } else if (err.message.includes('ECONNREFUSED') || err.message.includes('ECONNRESET')) {
          result.mensagens.push(`🔌 Conexão recusada/resetada. O servidor do ADN pode estar em manutenção ou seu certificado pode não estar sendo aceito.`);
        } else if (err.message.includes('unable to get local issuer') || err.message.includes('self signed')) {
          result.mensagens.push(`🔐 Problema com a cadeia de certificados. Verifique se o certificado A1 é válido e está na cadeia ICP-Brasil.`);
        }
        resolve({ connError: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        result.mensagens.push(`⏱️ Timeout de 30s excedido. O servidor do ADN não respondeu a tempo.`);
        resolve({ connError: 'TIMEOUT', timeout: true });
      });

      req.end();
    });

    // Processamento do lote de retorno com suporte a todas as variações de schema da API REST ADN (Receita Federal / Serpro)
    let xmlsParaProcessar: Array<{ xml: string; chave?: string; nsu?: string }> = [];

    const extrairXmlDeItem = (item: any): { xml: string; chave?: string; nsu?: string } | null => {
      if (!item) return null;
      const chave = item.ChaveAcesso || item.chaveAcesso || item.chave || item.Chave || '';
      const nsu = item.NSU ?? item.nsu ?? item.Nsu;

      if (typeof item === 'string') {
        if (item.trim().startsWith('<')) return { xml: item, chave, nsu: nsu ? String(nsu) : undefined };
        try {
          const buf = Buffer.from(item, 'base64');
          try {
            return { xml: zlib.gunzipSync(buf).toString('utf-8'), chave, nsu: nsu ? String(nsu) : undefined };
          } catch {
            return { xml: buf.toString('utf-8'), chave, nsu: nsu ? String(nsu) : undefined };
          }
        } catch {
          return null;
        }
      }

      // 1. Priorizar chaves conhecidas do ADN Serpro e outros padrões
      let b64: any =
        item.ArquivoXml ||
        item.arquivoXml ||
        item.ArquivoXML ||
        item.arquivo_xml ||
        item.conteudoXml ||
        item.ConteudoXml ||
        item.xml ||
        item.XML ||
        item.xmlRaw ||
        item.docZip ||
        item.docXML ||
        item.xmlGzip;

      // 2. Se não encontrou nas chaves padrão, varrer heurística
      if (!b64) {
        for (const k of Object.keys(item)) {
          const kLower = k.toLowerCase();
          if (
            kLower.includes('xml') ||
            kLower.includes('zip') ||
            kLower.includes('conteudo') ||
            kLower.includes('arquivo') ||
            kLower.includes('dps')
          ) {
            if (typeof item[k] === 'string' && item[k].trim().length > 20) {
              b64 = item[k];
              break;
            }
          }
        }
      }

      if (b64 && typeof b64 === 'string') {
        if (b64.trim().startsWith('<')) {
          return { xml: b64, chave, nsu: nsu ? String(nsu) : undefined };
        }
        try {
          const buffer = Buffer.from(b64, 'base64');
          try {
            const decompressed = zlib.gunzipSync(buffer).toString('utf-8');
            return { xml: decompressed, chave, nsu: nsu ? String(nsu) : undefined };
          } catch {
            return { xml: buffer.toString('utf-8'), chave, nsu: nsu ? String(nsu) : undefined };
          }
        } catch (e: any) {
          result.mensagens.push(`⚠️ Falha ao decodificar Base64/GZIP de documento: ${e.message}`);
        }
      }

      if (item.xml || item.xmlRaw || item.conteudoXml || item.Xml || item.XML) {
        const directXml = item.xml || item.xmlRaw || item.conteudoXml || item.Xml || item.XML;
        return { xml: directXml, chave, nsu: nsu ? String(nsu) : undefined };
      }
      return null;
    };

    // 1. Verificar se a resposta é diretamente um array
    if (Array.isArray(responseData)) {
      for (const item of responseData) {
        const docInfo = extrairXmlDeItem(item);
        if (docInfo) xmlsParaProcessar.push(docInfo);
      }
    } else if (typeof responseData === 'object' && responseData !== null) {
      // 2. Extrair listas em QUALQUER propriedade do objeto (LoteDFe, loteDFe, documentos, itens, etc.)
      for (const key of Object.keys(responseData)) {
        const val = responseData[key];
        if (Array.isArray(val) && val.length > 0) {
          result.mensagens.push(`📦 Lote de documentos detectado sob '${key}': ${val.length} item(ns).`);
          for (const item of val) {
            const docInfo = extrairXmlDeItem(item);
            if (docInfo) {
              xmlsParaProcessar.push(docInfo);
              if (docInfo.nsu) {
                const num = Number(docInfo.nsu);
                if (!isNaN(num)) {
                  if (num > Number(result.ultNSU || 0)) result.ultNSU = String(num);
                  if (num > Number(result.maxNSU || 0)) result.maxNSU = String(num);
                }
              }
            }
          }
        }
      }

      // 3. Se não havia lista mas a raiz é um documento
      if (xmlsParaProcessar.length === 0) {
        const docRaiz = extrairXmlDeItem(responseData);
        if (docRaiz) {
          xmlsParaProcessar.push(docRaiz);
          result.mensagens.push(`📄 Documento NFS-e recebido na raiz e decodificado com sucesso.`);
        }
      }

      // 4. Extrair NSUs gerais retornados na raiz
      const returnedUlt = responseData.ultNSU ?? responseData.UltNSU ?? responseData.ultimoNSU ?? responseData.UltimoNSU ?? responseData.nsu ?? responseData.NSU;
      const returnedMax = responseData.maxNSU ?? responseData.MaxNSU ?? responseData.maiorNSU ?? responseData.MaiorNSU;
      if (returnedUlt !== undefined && returnedUlt !== null && Number(returnedUlt) > Number(result.ultNSU || 0)) {
        result.ultNSU = String(returnedUlt);
      }
      if (returnedMax !== undefined && returnedMax !== null && Number(returnedMax) > Number(result.maxNSU || 0)) {
        result.maxNSU = String(returnedMax);
      }
    }

    if (xmlsParaProcessar.length === 0 && !responseData.connError && !responseData.authError) {
      if (String(result.maxNSU) === '0') {
        result.mensagens.push(
          `ℹ️ O ADN informou maxNSU=0 para o CNPJ ${cleanCnpj}. Isso confirma que não há eventos ou notas disponíveis na fila nacional do ADN para este estabelecimento.`
        );
      } else {
        result.mensagens.push(
          `ℹ️ Nenhuma nova NFS-e retornada a partir do NSU ${ultNSU}. ultNSU=${result.ultNSU}, maxNSU=${result.maxNSU}.`
        );
      }
    }

    // Persistir os XMLs capturados
    for (const doc of xmlsParaProcessar) {
      const parsed = await persistirNfseNoBanco(doc.xml, empresaId, cleanCnpj, doc.chave);
      result.mensagens.push(`📄 NFS-e processada: Chave ${parsed.chaveAcesso || doc.chave} (NSU ${doc.nsu || 'N/A'}) - R$ ${parsed.valorTotal.toFixed(2)}`);
      if (parsed.isNovo) {
        result.documentosNovos++;
        result.totalValorServicos += parsed.valorTotal;
        result.totalRetencoes.iss += parsed.valorIss;
        result.totalRetencoes.irrf += parsed.valorIrrf;
        result.totalRetencoes.inss += parsed.valorInss;
        result.totalRetencoes.pis += parsed.valorPis;
        result.totalRetencoes.cofins += parsed.valorCofins;
        result.totalRetencoes.csll += parsed.valorCsll;
      } else {
        result.documentosExistentes++;
      }
    }

    result.success = true;
    result.mensagens.push(
      `✅ Varredura ADN finalizada. ${result.documentosNovos} NFS-e novas gravadas, ${result.documentosExistentes} já existentes.`
    );

    // Persistir checkpoint de NSU de NFS-e no banco de dados da empresa (SQLite + Supabase)
    if (empresaId && !responseData.connError && !responseData.authError) {
      const brasiliaNow = getBrasiliaTimestamp();
      try {
        const db = getDatabase();
        db.prepare(`
          UPDATE empresas
          SET ultimo_nsu_nfse = ?, max_nsu_nfse = ?, updated_at = ?
          WHERE id = ?
        `).run(result.ultNSU, result.maxNSU, brasiliaNow, empresaId);
        result.mensagens.push(`💾 Checkpoint salvo no banco: ultimo_nsu_nfse=${result.ultNSU}, max_nsu_nfse=${result.maxNSU}`);
      } catch (errDb: any) {
        console.warn('Aviso ao persistir NSU de NFS-e no banco local:', errDb.message);
      }

      if (isSupabaseConfigured()) {
        try {
          const supabase = getSupabaseAdmin();
          if (supabase) {
            await supabase.from('empresas').update({
              ultimo_nsu_nfse: result.ultNSU,
              max_nsu_nfse: result.maxNSU,
              updated_at: brasiliaNow
            }).eq('id', empresaId);
          }
        } catch (supaErr: any) {
          console.warn('Aviso ao persistir NSU de NFS-e no Supabase:', supaErr?.message || supaErr);
        }
      }
    }
  } catch (err: any) {
    console.error('❌ Erro na sincronização da NFS-e Nacional:', err);
    result.mensagens.push(`❌ Falha no processamento: ${err.message}`);
  }

  return result;
}

// =========================================================
// 3. PERSISTÊNCIA UNIFICADA DE NFS-E (SUPABASE + SQLITE)
// =========================================================
async function persistirNfseNoBanco(
  xmlContent: string,
  empresaId: string,
  tenantCnpj: string,
  chaveAcessoFallback?: string
): Promise<{ isNovo: boolean; chaveAcesso: string; numero?: string; valorTotal: number; valorIss: number; valorIrrf: number; valorInss: number; valorPis: number; valorCofins: number; valorCsll: number }> {
  const sanitized = sanitizeXmlAntiXXE(xmlContent);
  const parsed = await parseFiscalXml(sanitized, tenantCnpj);
  if (!parsed.chaveAcesso && chaveAcessoFallback) {
    parsed.chaveAcesso = chaveAcessoFallback;
  }
  if (!parsed.chaveAcesso) {
    parsed.chaveAcesso = `31062001${Date.now()}`.padEnd(50, '0');
  }
  const brasiliaNow = getBrasiliaTimestamp();

  let isNovo = false;

  // 1. Supabase
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const supaEmpresaId = await resolveSupabaseEmpresaId(supabase, {
          id: empresaId,
          cnpj_completo: tenantCnpj,
          cnpj_raiz: tenantCnpj.substring(0, 8)
        });

        const { data: existing } = await supabase
          .from('dfe_documentos')
          .select('id')
          .or(`chave_acesso.eq.${parsed.chaveAcesso},chave_acesso.eq.${parsed.chaveAcesso.substring(0, 44)}`)
          .maybeSingle();

        if (!existing) {
          isNovo = true;
          let activeDocId = `doc-nfse-${parsed.chaveAcesso}`;

          const docPayload = {
            id: activeDocId,
            empresa_id: supaEmpresaId,
            tipo_doc: 'NFSe',
            chave_acesso: parsed.chaveAcesso,
            tipo_operacao: parsed.tipoOperacao,
            numero_serie: `${parsed.numero || '1'} / ${parsed.serie || '1'}`.substring(0, 40),
            data_emissao: parsed.dataEmissao,
            data_entrada: parsed.dataEntrada || brasiliaNow,
            competencia: parsed.competencia,
            fornecedor_cnpj: parsed.emitenteCnpj,
            fornecedor_razao: parsed.emitenteNome,
            fornecedor_uf: parsed.emitenteUf,
            fornecedor_municipio: parsed.emitenteMunicipio,
            cliente_cnpj: parsed.destinatarioCnpj,
            cliente_razao: parsed.destinatarioNome,
            cliente_uf: parsed.destinatarioUf,
            situacao_doc: 'autorizado',
            situacao_manifestacao: 'sem_manifestacao',
            evento_ultimo: 'NFS-e Autorizada',
            valor_total: parsed.valorTotal,
            valor_iss: parsed.valorIss,
            valor_irrf: parsed.valorIrrf,
            valor_inss: parsed.valorInss,
            valor_pis: parsed.valorPis,
            valor_cofins: parsed.valorCofins,
            valor_csll: parsed.valorCsll,
            valor_ibs: parsed.valorIbs,
            valor_cbs: parsed.valorCbs,
            valor_is: parsed.valorIs,
            xml_raw: sanitized,
            created_at: brasiliaNow,
            updated_at: brasiliaNow
          };

          const { error: insertErr } = await supabase.from('dfe_documentos').insert(docPayload);

          if (insertErr) {
            console.error('❌ Falha ao salvar NFS-e no Supabase:', insertErr.message || insertErr);
            // Fallback imediato se o banco Supabase ainda tiver chave_acesso limitada a VARCHAR(44)
            if (insertErr.code === '22001' || insertErr.message?.includes('varying(44)')) {
              console.warn(`⚠️ Aplicando fallback de chave 44 caracteres para NFS-e ${parsed.chaveAcesso}...`);
              const fallbackChave = parsed.chaveAcesso.substring(0, 44);
              activeDocId = `doc-nfse-${fallbackChave}`;
              const fallbackPayload = {
                ...docPayload,
                id: activeDocId,
                chave_acesso: fallbackChave
              };
              const { error: retryErr } = await supabase.from('dfe_documentos').insert(fallbackPayload);
              if (retryErr) {
                console.error('❌ Falha também no retry do fallback de 44 chars:', retryErr);
                isNovo = false;
              } else {
                console.log(`✅ NFS-e ${fallbackChave} persistida no Supabase via fallback.`);
              }
            } else {
              isNovo = false;
            }
          }

          if (isNovo && parsed.itens && parsed.itens.length > 0) {
            const supaItens = parsed.itens.map((it, idx) => ({
              id: uuidv4(),
              documento_id: activeDocId,
              item_nro: it.numeroItem || idx + 1,
              descricao_item: it.descricao || 'Prestação de Serviços Profissionais / Técnicos',
              ncm: it.ncm || '17.01',
              cfop: it.cfop || '1933',
              cclasstrib: it.cClassTrib || '000001',
              cst_csosn: it.cstCsosn || '000',
              natureza_operacao: 'Prestação de Serviços (NFS-e)',
              quantidade: it.quantidade || 1,
              unidade: it.unidade || 'UN',
              valor_unitario: it.valorUnitario || parsed.valorTotal,
              valor_bruto_item: it.valorBruto || parsed.valorTotal,
              valor_liquido_item: it.valorLiquido || parsed.valorTotal,
              valor_pis: it.valorPis || 0,
              valor_cofins: it.valorCofins || 0,
              valor_ibs: it.valorIbs || 0,
              valor_cbs: it.valorCbs || 0
            }));
            await supabase.from('dfe_itens').insert(supaItens);
          }
        }
      } catch (err: any) {
        console.error('❌ Falha ao salvar NFS-e no Supabase:', err);
      }
    }
  }

  // 2. Fallback SQLite
  const db = getDatabase();
  try {
    const existingSqlite = db.prepare('SELECT id FROM dfe_documentos WHERE chave_acesso = ?').get(parsed.chaveAcesso) as any;
    if (!existingSqlite) {
      isNovo = true;
      const docId = `doc-nfse-${parsed.chaveAcesso}`;
      db.prepare(`
        INSERT INTO dfe_documentos (
          id, empresa_id, tipo_doc, chave_acesso, tipo_operacao, numero_serie,
          data_emissao, data_entrada, competencia, fornecedor_cnpj, fornecedor_razao,
          fornecedor_uf, fornecedor_municipio, cliente_cnpj, cliente_razao, cliente_uf,
          situacao_doc, valor_total, created_at
        ) VALUES (?, ?, 'NFSe', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'autorizado', ?, ?)
      `).run(
        docId, empresaId, parsed.chaveAcesso, parsed.tipoOperacao, `${parsed.numero}/${parsed.serie}`,
        parsed.dataEmissao, parsed.dataEntrada || brasiliaNow, parsed.competencia,
        parsed.emitenteCnpj, parsed.emitenteNome, parsed.emitenteUf, parsed.emitenteMunicipio,
        parsed.destinatarioCnpj, parsed.destinatarioNome, parsed.destinatarioUf,
        parsed.valorTotal, brasiliaNow
      );
    }
  } catch (sqlErr: any) {
    console.error('❌ Falha ao salvar NFS-e no SQLite:', sqlErr);
  }

  return {
    isNovo,
    chaveAcesso: parsed.chaveAcesso || chaveAcessoFallback || '',
    numero: parsed.numero,
    valorTotal: parsed.valorTotal,
    valorIss: parsed.valorIss,
    valorIrrf: parsed.valorIrrf,
    valorInss: parsed.valorInss,
    valorPis: parsed.valorPis,
    valorCofins: parsed.valorCofins,
    valorCsll: parsed.valorCsll
  };
}

// =========================================================
// 4. RESUMO E STATUS DE NFS-E POR TENANT
// =========================================================
export async function obterStatusNfse(empresaId: string, cnpj: string): Promise<NfseStatusResumo> {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  const db = getDatabase();

  let totalNfse = 0;
  let totalTomadas = 0;
  let totalPrestadas = 0;
  let totalValor = 0;
  let totalIss = 0;
  let totalRetencoes = 0;

  // Consulta agregada no Supabase ou SQLite
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data: docs } = await supabase
          .from('dfe_documentos')
          .select('tipo_operacao, valor_total, valor_iss, valor_irrf, valor_inss, valor_pis, valor_cofins, valor_csll')
          .eq('tipo_doc', 'NFSe')
          .or(`cliente_cnpj.ilike.%${cleanCnpj}%,fornecedor_cnpj.ilike.%${cleanCnpj}%,empresa_id.eq.${empresaId}`);

        if (docs && docs.length > 0) {
          totalNfse = docs.length;
          for (const d of docs) {
            const vTotal = Number(d.valor_total) || 0;
            const vIss = Number(d.valor_iss) || 0;
            const vRet = (Number(d.valor_irrf) || 0) + (Number(d.valor_inss) || 0) + (Number(d.valor_csll) || 0);
            totalValor += vTotal;
            totalIss += vIss;
            totalRetencoes += vRet;
            if (d.tipo_operacao === 'Saída') {
              totalPrestadas++;
            } else {
              totalTomadas++;
            }
          }
        }
      } catch (err: any) {
        console.warn('⚠️ Erro ao consultar NFS-e no Supabase:', err.message);
      }
    }
  }

  // Fallback SQLite se não trouxe do Supabase
  if (totalNfse === 0) {
    try {
      const rows = db.prepare(`
        SELECT tipo_operacao, valor_total
        FROM dfe_documentos
        WHERE tipo_doc = 'NFSe'
          AND (empresa_id = ? OR cliente_cnpj LIKE ? OR fornecedor_cnpj LIKE ?)
      `).all(empresaId, `%${cleanCnpj}%`, `%${cleanCnpj}%`) as any[];

      totalNfse = rows.length;
      for (const r of rows) {
        totalValor += Number(r.valor_total) || 0;
        if (r.tipo_operacao === 'Saída') totalPrestadas++;
        else totalTomadas++;
      }
    } catch {}
  }

  // Verificar Certificado A1
  const certData = await descriptografarCertificado(empresaId, cleanCnpj);
  const certificadoValido = Boolean(certData);

  return {
    empresaId,
    cnpj,
    totalNfse,
    totalTomadas,
    totalPrestadas,
    totalValor,
    totalIss,
    totalRetencoes,
    ultNSUNacional: '0',
    certificadoValido,
    conectoresAtivos: [
      {
        id: 'adn_nacional',
        nome: 'Ambiente de Dados Nacional (ADN / Receita Federal)',
        tipo: 'nacional',
        status: certificadoValido ? 'operacional' : 'sem_certificado',
        cidadesAtendidas: 'Todos os municípios conveniados + MEIs em todo o Brasil'
      },
      {
        id: 'pmsp_sp',
        nome: 'Prefeitura de São Paulo (PMSP / Nota do Milhão)',
        tipo: 'municipal',
        status: certificadoValido ? 'operacional' : 'sem_certificado',
        cidadesAtendidas: 'São Paulo - SP (IBGE 3550308)'
      },
      {
        id: 'abrasf_carioca',
        nome: 'Nota Carioca / Padrão ABRASF',
        tipo: 'municipal',
        status: certificadoValido ? 'operacional' : 'sem_certificado',
        cidadesAtendidas: 'Rio de Janeiro - RJ (IBGE 3304557), BH, Curitiba e rede ABRASF'
      }
    ]
  };
}

// =========================================================
// 5. CLIENTE SOAP MUNICIPAL (HTTPS + mTLS)
// =========================================================
async function enviarSoapMunicipal(params: {
  url: string;
  soapAction: string;
  soapEnvelope: string;
  pem: { key: string; cert: string; ca?: string[] };
  timeoutMs?: number;
}): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(params.url);
      const isHttps = parsedUrl.protocol === 'https:';
      const agent = isHttps
        ? new https.Agent({
            cert: params.pem.cert,
            key: params.pem.key,
            ca: params.pem.ca && params.pem.ca.length > 0 ? params.pem.ca : undefined,
            rejectUnauthorized: false,
            timeout: params.timeoutMs || 25000,
          })
        : undefined;

      const reqOptions: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': params.soapAction ? `"${params.soapAction}"` : '',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RadarFiscal/2.0',
          'Content-Length': Buffer.byteLength(params.soapEnvelope, 'utf8'),
        },
        agent,
        timeout: params.timeoutMs || 25000,
      };

      const client = isHttps ? https : http;
      const req = client.request(reqOptions, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode || 0, body });
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout de 25s excedido na comunicação com a prefeitura'));
      });

      req.write(params.soapEnvelope);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// =========================================================
// 6. MOTOR DE CONSULTA MUNICIPAL POR CONECTOR
// Suporte nativo a PMSP, Nota Carioca e ABRASF 1.0 / 2.04
// =========================================================
export async function sincronizarConectorMunicipalSoap(params: {
  empresaId: string;
  cnpj: string;
  conector: {
    id?: string;
    ibge: string;
    municipio: string;
    uf: string;
    provedor: string;
    tecnologia: string;
    endpoint_producao?: string;
    endpoint_homologacao?: string;
    tipo_autenticacao?: string;
    token_api?: string;
    usuario?: string;
    senha?: string;
  };
  tpAmb?: '1' | '2';
  dataInicio?: string;
  dataFim?: string;
}): Promise<NfseSyncResult> {
  const { empresaId, cnpj, conector, tpAmb = '1' } = params;
  const cleanCnpj = cnpj.replace(/\D/g, '');
  const isProd = tpAmb === '1';
  const url = (isProd ? conector.endpoint_producao : (conector.endpoint_homologacao || conector.endpoint_producao)) || '';

  const result: NfseSyncResult = {
    success: false,
    provedor: `${conector.municipio} - ${conector.uf} (${conector.provedor})`,
    tpAmb: isProd ? 'Produção (tpAmb=1)' : 'Homologação (tpAmb=2)',
    ultNSU: '0',
    maxNSU: '0',
    documentosNovos: 0,
    documentosExistentes: 0,
    totalValorServicos: 0,
    totalRetencoes: { iss: 0, irrf: 0, inss: 0, pis: 0, cofins: 0, csll: 0 },
    mensagens: []
  };

  if (!url) {
    result.mensagens.push(`⚠️ Endpoint não configurado para ${conector.municipio} (${conector.uf}). Configure no catálogo.`);
    return result;
  }

  // 1. Carregar Certificado A1
  const certData = await descriptografarCertificado(empresaId, cleanCnpj);
  if (!certData) {
    result.mensagens.push(`⚠️ Certificado Digital A1 não encontrado para consulta em ${conector.municipio}.`);
    return result;
  }

  let pem: { key: string; cert: string; ca?: string[] };
  try {
    pem = converterPfxParaPem(certData.pfxBuffer, certData.senha);
  } catch (err: any) {
    result.mensagens.push(`❌ Erro ao converter chave do Certificado A1: ${err.message}`);
    return result;
  }

  // 2. Datas (default últimos 30 dias)
  const dtFimStr = params.dataFim || new Date().toISOString().split('T')[0];
  const dtInicioDate = new Date();
  dtInicioDate.setDate(dtInicioDate.getDate() - 30);
  const dtInicioStr = params.dataInicio || dtInicioDate.toISOString().split('T')[0];

  // 3. Suporte a Conectores REST (Ex: Campinas, DSF v1, APIs modernas)
  if (conector.tecnologia === 'REST') {
    result.mensagens.push(`📡 Conectando ao WebService REST (${url})... Período: ${dtInicioStr} a ${dtFimStr}`);
    try {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.set('cnpj', cleanCnpj);
      parsedUrl.searchParams.set('dataInicio', dtInicioStr);
      parsedUrl.searchParams.set('dataFim', dtFimStr);

      const headers: Record<string, string> = {
        'Accept': 'application/json, application/xml, text/xml',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RadarFiscal/2.0'
      };

      if (conector.tipo_autenticacao === 'token_api' && conector.token_api) {
        headers['Authorization'] = `Bearer ${conector.token_api}`;
      } else if (conector.tipo_autenticacao === 'usuario_senha' && conector.usuario) {
        headers['Authorization'] = `Basic ${Buffer.from(`${conector.usuario}:${conector.senha || ''}`).toString('base64')}`;
      }

      const isHttps = parsedUrl.protocol === 'https:';
      const agent = isHttps
        ? new https.Agent({
            cert: pem.cert,
            key: pem.key,
            ca: pem.ca && pem.ca.length > 0 ? pem.ca : undefined,
            rejectUnauthorized: false,
            timeout: 25000
          })
        : undefined;

      const restResp = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
        const client = isHttps ? https : http;
        const req = client.request(
          parsedUrl.toString(),
          {
            method: 'GET',
            headers,
            agent,
            timeout: 25000
          },
          (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => resolve({ statusCode: res.statusCode || 0, body }));
          }
        );
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Timeout de 25s excedido na conexão REST com a prefeitura'));
        });
        req.end();
      });

      result.mensagens.push(`🔄 Prefeitura REST respondeu com HTTP ${restResp.statusCode}.`);

      let decodedXml = restResp.body
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&');

      const regexNfse = /<(?:[a-zA-Z0-9_-]+:)?(CompNfse|tcCompNfse|NFe|Nfse)[\s\S]*?<\/(?:[a-zA-Z0-9_-]+:)?\1>/gi;
      let match;
      const xmlsEncontrados: string[] = [];
      while ((match = regexNfse.exec(decodedXml)) !== null) {
        xmlsEncontrados.push(match[0]);
      }

      if (xmlsEncontrados.length > 0) {
        result.mensagens.push(`📦 ${xmlsEncontrados.length} NFS-e(s) localizada(s) em ${conector.municipio}!`);
        for (const xmlNota of xmlsEncontrados) {
          const parsed = await persistirNfseNoBanco(xmlNota, empresaId, cleanCnpj);
          result.mensagens.push(`📄 NFS-e Tomada: Nº ${parsed.numero || 'S/N'} - R$ ${parsed.valorTotal.toFixed(2)} - Chave: ${parsed.chaveAcesso}`);
          if (parsed.isNovo) {
            result.documentosNovos++;
            result.totalValorServicos += parsed.valorTotal;
            result.totalRetencoes.iss += parsed.valorIss;
            result.totalRetencoes.irrf += parsed.valorIrrf;
            result.totalRetencoes.inss += parsed.valorInss;
            result.totalRetencoes.pis += parsed.valorPis;
            result.totalRetencoes.cofins += parsed.valorCofins;
            result.totalRetencoes.csll += parsed.valorCsll;
          } else {
            result.documentosExistentes++;
          }
        }
      } else if (restResp.statusCode === 200) {
        result.mensagens.push(`ℹ️ A prefeitura REST retornou HTTP 200 (sem notas tomadas emitidas no período pesquisado).`);
      } else {
        result.mensagens.push(`ℹ️ Retorno REST (${conector.municipio}): HTTP ${restResp.statusCode}`);
      }

      result.success = true;
      return result;
    } catch (restErr: any) {
      result.mensagens.push(`⚠️ WebService REST Indisponível / Erro de Rede (${conector.municipio}): ${restErr.message}`);
      return result;
    }
  }

  // 4. Montar Envelope SOAP de acordo com o provedor/padrão
  let soapEnvelope = '';
  let soapAction = '';

  const provUpper = (conector.provedor || '').toUpperCase();
  const ibge = conector.ibge;

  if (ibge === '3550308' || provUpper.includes('PMSP')) {
    // São Paulo - SP (Nota do Milhão / PMSP)
    soapAction = 'http://ws.prefeitura.sp.gov.br/ConsultaNFeRecebidas';
    soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ConsultaNFeRecebidasRequest xmlns="http://ws.prefeitura.sp.gov.br/">
      <VersaoSchema>1</VersaoSchema>
      <MensagemXML><![CDATA[<PedidoConsultaNFe xmlns="http://www.prefeitura.sp.gov.br/nfe"><Cabecalho Versao="1"><CPFCNPJRemetente><CNPJ>${cleanCnpj}</CNPJ></CPFCNPJRemetente><dtInicio>${dtInicioStr}</dtInicio><dtFim>${dtFimStr}</dtFim><QtdPagina>1</QtdPagina></Cabecalho></PedidoConsultaNFe>]]></MensagemXML>
    </ConsultaNFeRecebidasRequest>
  </soap:Body>
</soap:Envelope>`;
  } else if (ibge === '3304557' || provUpper.includes('CARIOCA') || provUpper.includes('1.0')) {
    // Rio de Janeiro - RJ (Nota Carioca / ABRASF 1.0)
    soapAction = 'http://notacarioca.rio.rj.gov.br/ConsultarNfseServicoTomado';
    soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:not="http://notacarioca.rio.rj.gov.br/">
  <soapenv:Header/>
  <soapenv:Body>
    <not:ConsultarNfseServicoTomadoRequest>
      <not:inputXML><![CDATA[<ConsultarNfseServicoTomadoEnvio xmlns="http://notacarioca.rio.rj.gov.br/WSNacional/XSD/1/nfse_pcrj_v01.xsd"><Consulente><CpfCnpj><Cnpj>${cleanCnpj}</Cnpj></CpfCnpj></Consulente><PeriodoEmissao><DataInicial>${dtInicioStr}</DataInicial><DataFinal>${dtFimStr}</DataFinal></PeriodoEmissao><Tomador><CpfCnpj><Cnpj>${cleanCnpj}</Cnpj></CpfCnpj></Tomador></ConsultarNfseServicoTomadoEnvio>]]></not:inputXML>
    </not:ConsultarNfseServicoTomadoRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
  } else if (provUpper.includes('GINFES')) {
    // Padrão GINFES (Guarulhos, Betim, Contagem, Santos, SBC, Santo André, etc.)
    soapAction = 'http://nfse.ginfes.com.br/ConsultarNfseServicoTomado';
    soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:gin="http://nfse.ginfes.com.br">
  <soapenv:Header/>
  <soapenv:Body>
    <gin:ConsultarNfseServicoTomadoEnvio>
      <gin:Consulente><gin:Cnpj>${cleanCnpj}</gin:Cnpj></gin:Consulente>
      <gin:PeriodoEmissao><gin:DataInicial>${dtInicioStr}</gin:DataInicial><gin:DataFinal>${dtFimStr}</gin:DataFinal></PeriodoEmissao>
      <gin:Tomador><gin:CpfCnpj><gin:Cnpj>${cleanCnpj}</gin:Cnpj></gin:CpfCnpj></gin:Tomador>
    </gin:ConsultarNfseServicoTomadoEnvio>
  </soapenv:Body>
</soapenv:Envelope>`;
  } else if (provUpper.includes('WEBISS') || provUpper.includes('TIPLAN') || provUpper.includes('ISSNET')) {
    // Padrão WebISS / Tiplan / ISSNet (Exige parâmetros formais nfseCabecMsg e nfseDadosMsg)
    soapAction = 'http://tempuri.org/ConsultarNfseServicoTomado';
    soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <ws:ConsultarNfseServicoTomado>
      <ws:nfseCabecMsg><![CDATA[<cabecalho versao="2.02" xmlns="http://www.abrasf.org.br/nfse.xsd"><versaoDados>2.02</versaoDados></cabecalho>]]></ws:nfseCabecMsg>
      <ws:nfseDadosMsg><![CDATA[<ConsultarNfseServicoTomadoEnvio xmlns="http://www.abrasf.org.br/nfse.xsd"><Consulente><CpfCnpj><Cnpj>${cleanCnpj}</Cnpj></CpfCnpj></Consulente><PeriodoEmissao><DataInicial>${dtInicioStr}</DataInicial><DataFinal>${dtFimStr}</DataFinal></PeriodoEmissao><Tomador><CpfCnpj><Cnpj>${cleanCnpj}</Cnpj></CpfCnpj></Tomador></ConsultarNfseServicoTomadoEnvio>]]></ws:nfseDadosMsg>
    </ws:ConsultarNfseServicoTomado>
  </soapenv:Body>
</soapenv:Envelope>`;
  } else {
    // Padrão Geral ABRASF 2.04 (Belo Horizonte - BHISS, Recife, Porto Alegre, Curitiba, etc.)
    soapAction = 'http://nfse.abrasf.org.br/ConsultarNfseServicoTomado';
    soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfse="http://nfse.abrasf.org.br">
  <soapenv:Header/>
  <soapenv:Body>
    <nfse:ConsultarNfseServicoTomadoEnvio>
      <nfse:Consulente>
        <nfse:CpfCnpj>
          <nfse:Cnpj>${cleanCnpj}</nfse:Cnpj>
        </nfse:CpfCnpj>
      </nfse:Consulente>
      <nfse:PeriodoEmissao>
        <nfse:DataInicial>${dtInicioStr}</nfse:DataInicial>
        <nfse:DataFinal>${dtFimStr}</nfse:DataFinal>
      </nfse:PeriodoEmissao>
      <nfse:Tomador>
        <nfse:CpfCnpj>
          <nfse:Cnpj>${cleanCnpj}</nfse:Cnpj>
        </nfse:CpfCnpj>
      </nfse:Tomador>
    </nfse:ConsultarNfseServicoTomadoEnvio>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  result.mensagens.push(`📡 Conectando ao WebService SOAP (${url})... Período: ${dtInicioStr} a ${dtFimStr}`);

  try {
    const resp = await enviarSoapMunicipal({
      url,
      soapAction,
      soapEnvelope,
      pem
    });

    result.mensagens.push(`🔄 Prefeitura respondeu com HTTP ${resp.statusCode}.`);

    // Decodificar entidades XML caso venha encodado com &lt; e &gt;
    let decodedXml = resp.body
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&');

    // Localizar blocos de notas retornados: <CompNfse>, <tcCompNfse>, <NFe>, <Nfse>
    const regexNfse = /<(?:[a-zA-Z0-9_-]+:)?(CompNfse|tcCompNfse|NFe|Nfse)[\s\S]*?<\/(?:[a-zA-Z0-9_-]+:)?\1>/gi;
    let match;
    const xmlsEncontrados: string[] = [];

    while ((match = regexNfse.exec(decodedXml)) !== null) {
      xmlsEncontrados.push(match[0]);
    }

    if (xmlsEncontrados.length > 0) {
      result.mensagens.push(`📦 ${xmlsEncontrados.length} NFS-e(s) localizada(s) em ${conector.municipio}!`);
      for (const xmlNota of xmlsEncontrados) {
        const parsed = await persistirNfseNoBanco(xmlNota, empresaId, cleanCnpj);
        result.mensagens.push(`📄 NFS-e Tomada: Nº ${parsed.numero || 'S/N'} - R$ ${parsed.valorTotal.toFixed(2)} - Chave: ${parsed.chaveAcesso}`);
        if (parsed.isNovo) {
          result.documentosNovos++;
          result.totalValorServicos += parsed.valorTotal;
          result.totalRetencoes.iss += parsed.valorIss;
          result.totalRetencoes.irrf += parsed.valorIrrf;
          result.totalRetencoes.inss += parsed.valorInss;
          result.totalRetencoes.pis += parsed.valorPis;
          result.totalRetencoes.cofins += parsed.valorCofins;
          result.totalRetencoes.csll += parsed.valorCsll;
        } else {
          result.documentosExistentes++;
        }
      }
    } else {
      // Extrair mensagens informativas retornadas pela prefeitura (inclusive faultstring de erros 500)
      const msgMatch = decodedXml.match(/<(?:[a-zA-Z0-9_-]+:)?(Mensagem|Descricao|xMotivo|Motivo|Correcao|faultstring|detail)[^>]*>([^<]+)<\//i);
      if (msgMatch && msgMatch[2]) {
        result.mensagens.push(`ℹ️ Retorno da Prefeitura (${conector.municipio}): ${msgMatch[2].trim()}`);
      } else if (resp.statusCode === 200) {
        result.mensagens.push(`ℹ️ A prefeitura retornou HTTP 200 (sem notas tomadas emitidas no período pesquisado).`);
      } else {
        result.mensagens.push(`⚠️ Resposta HTTP ${resp.statusCode} recebida - Operando em contingência.`);
      }
    }

    result.success = true;
  } catch (soapErr: any) {
    result.mensagens.push(`⚠️ WebService Indisponível / Erro de Rede (${conector.municipio}): ${soapErr.message}`);
  }

  return result;
}

// =========================================================
// 7. SINCRONIZAÇÃO VIA PMSP (PREFEITURA DE SÃO PAULO)
// =========================================================
export async function sincronizarNfsePMSP(params: NfseSyncParams): Promise<NfseSyncResult> {
  return sincronizarConectorMunicipalSoap({
    empresaId: params.empresaId,
    cnpj: params.cnpj,
    conector: {
      ibge: '3550308',
      municipio: 'São Paulo',
      uf: 'SP',
      provedor: 'PMSP (Nota do Milhão)',
      tecnologia: 'SOAP',
      endpoint_producao: 'https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx',
      endpoint_homologacao: 'https://nfehomologacao.prefeitura.sp.gov.br/ws/lotenfe.asmx'
    },
    tpAmb: params.tpAmb,
    dataInicio: params.dataInicio,
    dataFim: params.dataFim
  });
}

// =========================================================
// 7b. CONSULTA INDIVIDUALIZADA POR MUNICÍPIO (CIRÚRGICA)
// Consulta especificamente uma prefeitura cadastrada sem acionar o ADN
// =========================================================
export async function sincronizarPrefeituraIndividual(params: {
  empresaId: string;
  cnpj?: string;
  ibge: string;
  tpAmb?: '1' | '2';
  dataInicio?: string;
  dataFim?: string;
}): Promise<NfseSyncResult> {
  const { empresaId, ibge, tpAmb = '1', dataInicio, dataFim } = params;
  const db = getDatabase();

  // 1. Obter CNPJ da empresa
  let cleanCnpj = (params.cnpj || '').replace(/\D/g, '');
  if (!cleanCnpj) {
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const { data: emp } = await supabase.from('empresas').select('cnpj_completo').eq('id', empresaId).maybeSingle();
          if (emp?.cnpj_completo) cleanCnpj = emp.cnpj_completo.replace(/\D/g, '');
        }
      } catch {}
    }
    if (!cleanCnpj) {
      try {
        const emp = db.prepare('SELECT cnpj_completo FROM empresas WHERE id = ?').get(empresaId) as any;
        if (emp?.cnpj_completo) cleanCnpj = emp.cnpj_completo.replace(/\D/g, '');
      } catch {}
    }
  }

  // 2. Buscar conector municipal de forma 100% dinâmica no Supabase ou SQLite (suporta qualquer novo município)
  let conector: any = null;
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data, error } = await supabase
          .from('conectores_municipais')
          .select('*')
          .or(`ibge.eq.${ibge},id.eq.${ibge}`)
          .maybeSingle();
        if (!error && data) {
          conector = data;
        }
      }
    } catch (err: any) {
      console.warn('Erro ao buscar conector individual no Supabase:', err.message);
    }
  }

  if (!conector) {
    try {
      conector = db.prepare(`
        SELECT * FROM conectores_municipais 
        WHERE ibge = ? OR id = ?
      `).get(ibge, ibge) as any;
    } catch (dbErr: any) {
      console.warn('Erro ao carregar conector individual do SQLite:', dbErr.message);
    }
  }

  if (!conector) {
    return {
      success: false,
      provedor: 'Conector Municipal',
      tpAmb: tpAmb === '1' ? 'Produção (tpAmb=1)' : 'Homologação (tpAmb=2)',
      ultNSU: '0',
      maxNSU: '0',
      documentosNovos: 0,
      documentosExistentes: 0,
      totalValorServicos: 0,
      totalRetencoes: { iss: 0, irrf: 0, inss: 0, pis: 0, cofins: 0, csll: 0 },
      mensagens: [`❌ Município com IBGE/ID "${ibge}" não foi encontrado no cadastro de Conectores Municipais.`]
    };
  }

  // 3. Executar chamada exclusivamente para a prefeitura selecionada
  const result: NfseSyncResult = {
    success: true,
    provedor: `${conector.municipio} - ${conector.uf} (${conector.provedor})`,
    tpAmb: tpAmb === '1' ? 'Produção Oficial (tpAmb=1)' : 'Homologação (tpAmb=2)',
    ultNSU: '0',
    maxNSU: '0',
    documentosNovos: 0,
    documentosExistentes: 0,
    totalValorServicos: 0,
    totalRetencoes: { iss: 0, irrf: 0, inss: 0, pis: 0, cofins: 0, csll: 0 },
    mensagens: [
      `🎯 Iniciando Consulta Individual para ${conector.municipio} - ${conector.uf} (${conector.provedor})...`,
      `🏢 CNPJ Tomador: ${cleanCnpj}`,
      `⚙️ Endpoint: ${conector.endpoint_producao || 'Não configurado'} (${conector.tecnologia || 'SOAP'})`
    ]
  };

  try {
    const munRes = await sincronizarConectorMunicipalSoap({
      empresaId,
      cnpj: cleanCnpj,
      conector,
      tpAmb,
      dataInicio,
      dataFim
    });

    result.documentosNovos = munRes.documentosNovos;
    result.documentosExistentes = munRes.documentosExistentes;
    result.totalValorServicos = munRes.totalValorServicos;
    result.totalRetencoes = munRes.totalRetencoes;
    result.mensagens.push(...munRes.mensagens);
    result.mensagens.push(`🏁 Consulta individualizada em ${conector.municipio} finalizada: ${munRes.documentosNovos} nova(s) NFS-e, ${munRes.documentosExistentes} já existente(s).`);
  } catch (err: any) {
    result.mensagens.push(`❌ Falha na consulta de ${conector.municipio}: ${err.message}`);
  }

  return result;
}

// =========================================================
// 8. OBTENÇÃO DE DANFSE OFICIAL (PDF) VIA ADN NACIONAL
// Ref: https://adn.nfse.gov.br/danfse/docs/index.html
// =========================================================
export async function obterDanfseNacionalPdf(
  chaveAcesso: string,
  empresaId: string,
  cnpj: string,
  tpAmb: '1' | '2' = '1'
): Promise<Buffer | null> {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  const certData = await descriptografarCertificado(empresaId, cleanCnpj);
  if (!certData) return null;

  let pem: { key: string; cert: string; ca?: string[] };
  try {
    pem = converterPfxParaPem(certData.pfxBuffer, certData.senha);
  } catch {
    return null;
  }

  const isProd = tpAmb === '1';
  const baseUrl = isProd ? 'https://adn.nfse.gov.br' : 'https://adn.producaorestrita.nfse.gov.br';
  const url = `${baseUrl}/danfse/${chaveAcesso}`;

  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const req = https.request({
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        agent: new https.Agent({
          cert: pem.cert,
          key: pem.key,
          ca: pem.ca && pem.ca.length > 0 ? pem.ca : undefined,
          rejectUnauthorized: false
        }),
        headers: {
          'Accept': 'application/pdf, application/json'
        },
        timeout: 20000
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(Buffer.concat(chunks));
          } else {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.end();
    } catch {
      resolve(null);
    }
  });
}

// =========================================================
// 8. MOTOR DE VARREDURA UNIFICADA (TOP-OF-THE-LINE ENGINE)
// Varredura automática em todos os ambientes e filiais com 1 clique
// =========================================================
export async function sincronizarNfseUnificada(params: {
  empresaId: string;
  tpAmb?: '1' | '2';
  incluirPrefeituras?: boolean;
}): Promise<NfseSyncResult> {
  const { empresaId, tpAmb = '1', incluirPrefeituras = true } = params;

  const result: NfseSyncResult = {
    success: true,
    provedor: 'Motor Fiscal Unificado (ADN Nacional + Prefeituras Integradas)',
    tpAmb: tpAmb === '1' ? 'Produção Oficial (tpAmb=1)' : 'Homologação (tpAmb=2)',
    ultNSU: '0',
    maxNSU: '0',
    documentosNovos: 0,
    documentosExistentes: 0,
    totalValorServicos: 0,
    totalRetencoes: { iss: 0, irrf: 0, inss: 0, pis: 0, cofins: 0, csll: 0 },
    mensagens: [],
    prefeiturasSemCaptura: []
  };

  // 1. Identificar dados da empresa ativa e de suas filiais vinculadas
  let empresaPrincipal: any = null;
  let filiaisVinculadas: any[] = [];
  const db = getDatabase();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data: emp } = await supabase.from('empresas').select('*').eq('id', empresaId).maybeSingle();
      empresaPrincipal = emp;
      if (empresaPrincipal) {
        const raiz = (empresaPrincipal.cnpj_raiz || (empresaPrincipal.cnpj_completo || '').replace(/\D/g, '').substring(0, 8));
        const { data: filiais } = await supabase.from('empresas').select('*').eq('cnpj_raiz', raiz);
        filiaisVinculadas = filiais || [];
      }
    }
  } else {
    try {
      empresaPrincipal = db.prepare('SELECT * FROM empresas WHERE id = ?').get(empresaId);
      if (empresaPrincipal) {
        const raiz = (empresaPrincipal.cnpj_raiz || (empresaPrincipal.cnpj_completo || '').replace(/\D/g, '').substring(0, 8));
        filiaisVinculadas = db.prepare('SELECT * FROM empresas WHERE cnpj_raiz = ?').all(raiz) || [];
      }
    } catch {
      // Tabela sqlite pode não existir se usar supabase
    }
  }

  if (!empresaPrincipal) {
    result.success = false;
    result.mensagens.push('❌ Empresa ativa não encontrada para executar a varredura.');
    return result;
  }

  const cleanCnpj = (empresaPrincipal.cnpj_completo || '').replace(/\D/g, '');
  const cleanRaiz = (empresaPrincipal.cnpj_raiz || cleanCnpj.substring(0, 8) || '').replace(/\D/g, '');
  const razaoSocial = empresaPrincipal.razao_social || empresaPrincipal.razaoSocial || 'Empresa';

  result.mensagens.push(`🚀 Iniciando Varredura Fiscal Autônoma para ${razaoSocial}...`);
  result.mensagens.push(`🏢 CNPJ Base detectado: ${cleanRaiz} (Matriz: ${cleanCnpj})`);

  // Montar conjunto de CNPJs (Matriz + filiais registradas sob o mesmo CNPJ Raiz)
  const cnpjsParaVarrer = new Set<string>();
  if (cleanCnpj) cnpjsParaVarrer.add(cleanCnpj);

  for (const f of filiaisVinculadas) {
    const fCnpj = (f.cnpj_completo || '').replace(/\D/g, '');
    if (fCnpj && fCnpj.length === 14) {
      cnpjsParaVarrer.add(fCnpj);
    }
  }

  result.mensagens.push(`⚡ Localizados ${cnpjsParaVarrer.size} estabelecimento(s) vinculados ao CNPJ Base.`);

  // 2. Varredura no Ambiente de Dados Nacional (ADN) para todos os CNPJs com o e-CNPJ da matriz
  result.mensagens.push(`🌐 [Ambiente Nacional] Executando varredura sequencial no ADN da Receita Federal...`);

  for (const cnpjItem of Array.from(cnpjsParaVarrer)) {
    const isMatriz = cnpjItem === cleanCnpj;
    const label = isMatriz ? `Matriz (${cnpjItem})` : `Filial (${cnpjItem})`;
    result.mensagens.push(`   ▶ Consultando ADN para ${label}...`);

    try {
      const adnRes = await sincronizarNfseNacional({
        empresaId,
        cnpj: cnpjItem,
        tpAmb
      });

      result.documentosNovos += adnRes.documentosNovos;
      result.documentosExistentes += adnRes.documentosExistentes;
      result.totalValorServicos += adnRes.totalValorServicos;
      result.totalRetencoes.iss += adnRes.totalRetencoes.iss;
      result.totalRetencoes.irrf += adnRes.totalRetencoes.irrf;
      result.totalRetencoes.inss += adnRes.totalRetencoes.inss;
      result.totalRetencoes.pis += adnRes.totalRetencoes.pis;
      result.totalRetencoes.cofins += adnRes.totalRetencoes.cofins;
      result.totalRetencoes.csll += adnRes.totalRetencoes.csll;

      for (const m of adnRes.mensagens) {
        result.mensagens.push(`   └ ${m}`);
      }
    } catch (err: any) {
      result.mensagens.push(`   └ ⚠️ Erro na consulta de ${label}: ${err.message}`);
    }
  }

  // 3. Varredura Automática em Prefeituras Homologadas (Conectores Municipais)
  if (incluirPrefeituras) {
    result.mensagens.push(`🏛️ [Conectores Municipais] Carregando prefeituras ativas do banco de dados...`);
    
    let conectoresAtivos: any[] = [];
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const { data, error } = await supabase
            .from('conectores_municipais')
            .select('*')
            .eq('status', 'ativo')
            .order('uf', { ascending: true })
            .order('municipio', { ascending: true });
          if (!error && data && data.length > 0) {
            conectoresAtivos = data;
          }
        }
      } catch (err: any) {
        console.warn('Erro ao buscar conectores no Supabase:', err.message);
      }
    }

    if (conectoresAtivos.length === 0) {
      try {
        conectoresAtivos = db.prepare(`
          SELECT * FROM conectores_municipais 
          WHERE status = 'ativo'
          ORDER BY uf ASC, municipio ASC
        `).all() as any[];
      } catch (dbErr: any) {
        console.warn('Erro ao carregar conectores_municipais do SQLite:', dbErr.message);
      }
    }

    // Se nenhuma prefeitura estiver cadastrada, utilizar catálogo padrão com endpoints oficiais validados
    if (conectoresAtivos.length === 0) {
      conectoresAtivos = [
        { ibge: '3550308', municipio: 'São Paulo', uf: 'SP', provedor: 'PMSP (Nota do Milhão)', tecnologia: 'SOAP', endpoint_producao: 'https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx', status: 'ativo' },
        { ibge: '3304557', municipio: 'Rio de Janeiro', uf: 'RJ', provedor: 'Nota Carioca (ABRASF 1.0)', tecnologia: 'SOAP', endpoint_producao: 'https://notacarioca.rio.gov.br/WSNacional/nfse.asmx', status: 'ativo' },
        { ibge: '3106200', municipio: 'Belo Horizonte', uf: 'MG', provedor: 'BHISS (ABRASF 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://bhissdigitalws.pbh.gov.br/bhiss-ws/nfse', status: 'ativo' },
        { ibge: '2611606', municipio: 'Recife', uf: 'PE', provedor: 'Recife (ABRASF 1.1 / 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://nfse.recife.pe.gov.br/WS/nfse_v03.asmx', status: 'ativo' },
        { ibge: '3136702', municipio: 'Juiz de Fora', uf: 'MG', provedor: 'ISS-e JF (ABRASF 2.02)', tecnologia: 'SOAP', endpoint_producao: 'https://nfse.pjf.mg.gov.br:4431/WebService.asmx', status: 'ativo' },
        { ibge: '4314902', municipio: 'Porto Alegre', uf: 'RS', provedor: 'NFSE POA (ABRASF 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://nfse.portoalegre.rs.gov.br/bhiss-ws/nfse', status: 'ativo' },
        { ibge: '1302603', municipio: 'Manaus', uf: 'AM', provedor: 'Ábaco (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://nfse-prd.manaus.am.gov.br/nfse', status: 'ativo' },
        { ibge: '3518800', municipio: 'Guarulhos', uf: 'SP', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', status: 'ativo' },
      ];
    }

    result.mensagens.push(`   ⚡ ${conectoresAtivos.length} prefeitura(s) ativa(s) configurada(s) para varredura de serviços tomados.`);
    
    for (const conector of conectoresAtivos) {
      result.mensagens.push(`   ▶ [${conector.municipio} - ${conector.uf} (${conector.provedor})]: Consultando notas tomadas para CNPJ ${cleanCnpj}...`);
      
      try {
        const munRes = await sincronizarConectorMunicipalSoap({
          empresaId,
          cnpj: cleanCnpj,
          conector,
          tpAmb
        });
        result.documentosNovos += munRes.documentosNovos;
        result.documentosExistentes += munRes.documentosExistentes;
        result.totalValorServicos += munRes.totalValorServicos;
        result.totalRetencoes.iss += munRes.totalRetencoes.iss;
        result.totalRetencoes.irrf += munRes.totalRetencoes.irrf;
        result.totalRetencoes.inss += munRes.totalRetencoes.inss;
        result.totalRetencoes.pis += munRes.totalRetencoes.pis;
        result.totalRetencoes.cofins += munRes.totalRetencoes.cofins;
        result.totalRetencoes.csll += munRes.totalRetencoes.csll;
        for (const m of munRes.mensagens) {
          result.mensagens.push(`      └ ${m}`);
        }

        // Se não capturou nenhuma nota nova nem existente, registrar ocorrência
        if (munRes.documentosNovos === 0 && munRes.documentosExistentes === 0 && result.prefeiturasSemCaptura) {
          const rawMsgs = munRes.mensagens.join(' ');
          let statusTipo: OcorrenciaConectorMunicipal['status'] = 'outro';
          let acao = 'Verificar parâmetros no catálogo de Conectores Municipais';
          let msgResumida = 'Nenhum documento retornado';

          if (rawMsgs.includes('HTTP 200 (sem notas') || (rawMsgs.includes('HTTP 200') && !rawMsgs.includes('inválida'))) {
            statusTipo = 'sem_notas';
            msgResumida = 'HTTP 200: Nenhuma NFS-e tomada emitida no período pesquisado';
            acao = 'Comunicação normal. Nenhuma nota tomada contra o CNPJ nos últimos 30 dias.';
          } else if (rawMsgs.includes('nfseCabecMsg') || rawMsgs.includes('nfseDadosMsg') || rawMsgs.includes('inválida')) {
            statusTipo = 'erro_envelope';
            msgResumida = 'Envelope SOAP ou parâmetros nfseCabecMsg/nfseDadosMsg rejeitados';
            acao = 'Ajustar formato do envelope SOAP do provedor';
          } else if (rawMsgs.includes('ENOTFOUND') || rawMsgs.includes('getaddrinfo')) {
            statusTipo = 'erro_rede_dns';
            msgResumida = 'Host/Domínio não encontrado no DNS (ENOTFOUND)';
            acao = 'Atualizar URL do endpoint no módulo Conectores Municipais';
          } else if (rawMsgs.includes('Timeout') || rawMsgs.includes('ETIMEDOUT') || rawMsgs.includes('ESOCKETTIMEDOUT')) {
            statusTipo = 'timeout';
            msgResumida = 'Timeout de conexão excedido (> 25s)';
            acao = 'Servidor municipal sobrecarregado ou bloqueando porta. Testar individualmente';
          } else if (rawMsgs.includes('HTTP 500') || rawMsgs.includes('HTTP 502') || rawMsgs.includes('HTTP 503')) {
            statusTipo = 'erro_500';
            msgResumida = 'Erro interno ou indisponibilidade no webservice da prefeitura (HTTP 50x)';
            acao = 'Instabilidade temporária da prefeitura ou layout XML rejeitado';
          } else if (rawMsgs.includes('HTTP 401') || rawMsgs.includes('HTTP 403') || rawMsgs.includes('HTTP 405') || rawMsgs.includes('HTTP 406')) {
            statusTipo = 'autenticacao';
            msgResumida = 'Acesso não autorizado / Método HTTP rejeitado (40x)';
            acao = 'Verificar método HTTP (POST/GET) ou credenciais de acesso municipal';
          } else if (rawMsgs.includes('HTTP 301') || rawMsgs.includes('HTTP 302')) {
            statusTipo = 'redirecionamento';
            msgResumida = 'Redirecionamento HTTP (301/302)';
            acao = 'Ajustar URL direta do WebService (remover redirecionamento)';
          }

          const detalheLinha = munRes.mensagens.find(m => m.includes('⚠️') || m.includes('ℹ️') || m.includes('Retorno')) || munRes.mensagens[munRes.mensagens.length - 1] || '';

          result.prefeiturasSemCaptura.push({
            ibge: conector.ibge,
            municipio: conector.municipio,
            uf: conector.uf,
            provedor: conector.provedor,
            tecnologia: conector.tecnologia || 'SOAP',
            status: statusTipo,
            mensagem: msgResumida,
            detalheTecnico: detalheLinha,
            acaoSugerida: acao
          });
        }
      } catch (err: any) {
        result.mensagens.push(`      └ ⚠️ Erro na consulta de ${conector.municipio}: ${err.message}`);
        if (result.prefeiturasSemCaptura) {
          const isDns = err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo');
          const isTimeout = err.message.includes('Timeout') || err.message.includes('ETIMEDOUT');
          result.prefeiturasSemCaptura.push({
            ibge: conector.ibge,
            municipio: conector.municipio,
            uf: conector.uf,
            provedor: conector.provedor,
            tecnologia: conector.tecnologia || 'SOAP',
            status: isDns ? 'erro_rede_dns' : isTimeout ? 'timeout' : 'erro_500',
            mensagem: `Falha na requisição: ${err.message}`,
            detalheTecnico: err.message,
            acaoSugerida: isDns ? 'Validar URL de DNS no cadastro do conector' : 'Testar prefeitura individualmente'
          });
        }
      }
    }
  }

  result.mensagens.push(`🏁 Varredura Fiscal Unificada finalizada com sucesso! Total consolidado: ${result.documentosNovos} novas NFS-e capturadas, ${result.documentosExistentes} já existentes.`);
  return result;
}
