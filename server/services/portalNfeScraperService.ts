/**
 * ====================================================================
 * SERVIÇO DE CAPTURA DE EVENTOS DO AMBIENTE NACIONAL (AN)
 * ====================================================================
 * Realiza consulta autenticada via mTLS (Certificado Digital A1)
 * diretamente ao Portal Nacional da NF-e (Ambiente Nacional da RFB/SERPRO),
 * extraindo a grade completa de eventos oficiais vinculados à chave
 * (Ciência da Emissão, Confirmação da Operação, Registro de Passagem,
 * Cancelamento, CC-e, Averbações, etc.).
 * ====================================================================
 */

import https from 'https';
import { getBrasiliaTimestamp } from '../utils/timezone';

export interface EventoPortalNacional {
  codigoEvento: string;
  nomeEvento: string;
  nSeqEvento: number;
  dataHora: string;
  protocolo: string;
  cStat: string;
  xMotivo: string;
  origemEvento: 'portal_nacional' | 'terceiro_destinatario' | 'proprio' | 'fisco' | 'sefaz';
  autorCnpj?: string;
  orgao?: string;
}

export interface ConsultaPortalNacionalResponse {
  success: boolean;
  chaveAcesso: string;
  eventos: EventoPortalNacional[];
  totalEventos: number;
  mensagem: string;
  origem: 'ambiente_nacional_mtls';
}

const DESCRICAO_PARA_CODIGO_EVENTO: Record<string, string> = {
  'autorizacao de uso': '100',
  'autorizacao de uso da nf-e': '100',
  'autorizado o uso da nf-e': '100',
  'ciencia da emissao': '210210',
  'ciencia da operacao': '210210',
  'confirmacao da operacao': '210200',
  'desconhecimento da operacao': '210220',
  'operacao nao realizada': '210240',
  'carta de correcao': '110110',
  'carta de correcao eletronica': '110110',
  'cancelamento': '110111',
  'cancelamento de nf-e': '110111',
  'registro de passagem': '610552',
  'registro de passagem em posto fiscal': '610552',
  'registro de passagem nf-e a ct-e': '610550',
  'registro de passagem mdf-e': '610554',
  'cte autorizado para nfe': '610600',
  'ct-e autorizado para nf-e': '610600',
  'mdfe autorizado para nfe': '610500',
  'mdf-e autorizado para nf-e': '610500',
  'vistoria suframa': '990900',
  'internalizacao suframa': '990910',
};

export function mapearCodigoPorDescricao(desc: string): string {
  const norm = desc
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  for (const [key, code] of Object.entries(DESCRICAO_PARA_CODIGO_EVENTO)) {
    if (norm.includes(key)) {
      return code;
    }
  }

  // Se já tiver número no texto (ex: "Evento 210200")
  const numMatch = desc.match(/\b(11011[01]|2102[0-4]0|6105[0-9]{2}|610600|9909[01]0|100)\b/);
  if (numMatch) {
    return numMatch[1];
  }

  return '999999';
}

/**
 * Executa uma requisição HTTPS com mTLS e gestão de cookies ASP.NET
 */
function httpsRequestMtls(
  options: https.RequestOptions,
  postData?: string
): Promise<{ statusCode: number; headers: Record<string, any>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers as Record<string, any>,
          body,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(25000, () => {
      req.destroy(new Error('Timeout de 25s na conexão mTLS com o Portal Nacional da NF-e'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

/**
 * Parser de HTML do Portal Nacional para extração da grade de eventos oficiais
 */
export function extrairEventosDoHtmlPortal(html: string, chaveAcesso: string): EventoPortalNacional[] {
  const eventos: EventoPortalNacional[] = [];
  if (!html || html.trim() === '') return eventos;

  // 1. Procurar tabelas com id GrdEventos ou classes/linhas contendo eventos
  const tableRegex = /<table[^>]*id=["'][^"']*(?:GrdEventos|tabEventos|Eventos)[^"']*["'][^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch = tableRegex.exec(html);

  // Se não achou tabela por ID específico, tenta qualquer tabela com cabeçalhos de eventos
  if (!tableMatch) {
    const genericTableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    let tMatch;
    while ((tMatch = genericTableRegex.exec(html)) !== null) {
      const tableContent = tMatch[1];
      if (/evento/i.test(tableContent) && (/protocolo/i.test(tableContent) || /data/i.test(tableContent))) {
        tableMatch = tMatch;
        break;
      }
    }
  }

  if (tableMatch) {
    const rows = tableMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    let seq = 1;

    for (const row of rows) {
      // Ignorar cabeçalho <th>
      if (row.includes('<th')) continue;

      const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map((c) =>
        c.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
      );

      if (cells.length >= 2) {
        // Encontra célula de descrição e protocolo
        const descCell = cells.find((c) =>
          /autoriza|ciencia|confirma|cancel|correcao|passagem|suframa/i.test(c)
        ) || cells[0];

        const protoCell = cells.find((c) => /^\d{15}$/.test(c.replace(/\D/g, ''))) ||
          cells.find((c) => /\d{10,20}/.test(c)) || '';

        const dataCell = cells.find((c) =>
          /\d{2}\/\d{2}\/\d{4}/.test(c) || /\d{4}-\d{2}-\d{2}/.test(c)
        ) || '';

        if (descCell && descCell.length > 3) {
          const codigo = mapearCodigoPorDescricao(descCell);
          const cleanProto = protoCell.replace(/\D/g, '');

          let parsedData = getBrasiliaTimestamp();
          if (dataCell) {
            const dateMatch = dataCell.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
            if (dateMatch) {
              const [_, d, m, y, h, min, s] = dateMatch;
              parsedData = `${y}-${m}-${d}T${h || '12'}:${min || '00'}:${s || '00'}-03:00`;
            }
          }

          let origem: EventoPortalNacional['origemEvento'] = 'portal_nacional';
          if (codigo === '100') origem = 'sefaz';
          else if (codigo.startsWith('2102')) origem = 'terceiro_destinatario';
          else if (codigo.startsWith('610') || codigo.startsWith('990')) origem = 'fisco';

          eventos.push({
            codigoEvento: codigo,
            nomeEvento: descCell,
            nSeqEvento: seq++,
            dataHora: parsedData,
            protocolo: cleanProto || '',
            cStat: '135',
            xMotivo: 'Evento vinculado à NF-e no Ambiente Nacional (Portal)',
            origemEvento: origem,
          });
        }
      }
    }
  }

  // 2. Extração heurística suplementar de eventos declarados em blocos de texto ou spans
  const blocosEventosRegex = /(?:Evento|Tipo do Evento):\s*([^\n<]+)[\s\S]*?(?:Protocolo|Sequencial):\s*([0-9]+)[\s\S]*?(?:Data|Data\/Hora):\s*([0-9\/:\s-]+)/gi;
  let blocoMatch;
  while ((blocoMatch = blocosEventosRegex.exec(html)) !== null) {
    const desc = blocoMatch[1].trim();
    const proto = blocoMatch[2].trim();
    const dtRaw = blocoMatch[3].trim();
    const codigo = mapearCodigoPorDescricao(desc);

    const jaExiste = eventos.some((e) => e.protocolo === proto || (e.codigoEvento === codigo && proto === ''));
    if (!jaExiste && desc.length > 3) {
      eventos.push({
        codigoEvento: codigo,
        nomeEvento: desc,
        nSeqEvento: eventos.length + 1,
        dataHora: getBrasiliaTimestamp(),
        protocolo: proto,
        cStat: '135',
        xMotivo: 'Evento extraído do Ambiente Nacional',
        origemEvento: codigo.startsWith('2102') ? 'terceiro_destinatario' : 'portal_nacional',
      });
    }
  }

  return eventos;
}

/**
 * Consulta autenticada via mTLS com Certificado A1 ao Portal Nacional da NF-e
 */
export async function consultarEventosPortalNacionalMtls(params: {
  chaveAcesso: string;
  pfxBuffer: Buffer;
  senhaPfx: string;
}): Promise<ConsultaPortalNacionalResponse> {
  const cleanChave = params.chaveAcesso.replace(/\D/g, '');
  if (cleanChave.length !== 44) {
    throw new Error('Chave de acesso inválida (deve conter 44 dígitos numéricos).');
  }

  console.log(`🌐 [Ambiente Nacional - mTLS] Conectando ao Portal Nacional da NF-e com Certificado A1 para chave ${cleanChave}...`);

  const agent = new https.Agent({
    pfx: params.pfxBuffer,
    passphrase: params.senhaPfx,
    rejectUnauthorized: false, // Suporta cadeias intermediárias da ICP-Brasil
    keepAlive: false,
  });

  const headersBase: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
    'Connection': 'close',
  };

  const cookies: string[] = ['AspxAutoDetectCookieSupport=1'];
  const eventos: EventoPortalNacional[] = [];

  try {
    // 1. Inicializar sessão no Portal Nacional da NF-e
    const initialRes = await httpsRequestMtls({
      hostname: 'www.nfe.fazenda.gov.br',
      port: 443,
      path: `/portal/consultaCompleta.aspx?tipoConteudo=XbSeqxE8pl8=&chNFe=${cleanChave}`,
      method: 'GET',
      agent,
      headers: {
        ...headersBase,
        'Cookie': cookies.join('; '),
      },
    });

    if (initialRes.headers['set-cookie']) {
      for (const c of initialRes.headers['set-cookie']) {
        cookies.push(c.split(';')[0]);
      }
    }

    // 2. Extrair eventos da resposta direta
    let pageHtml = initialRes.body;
    let extracted = extrairEventosDoHtmlPortal(pageHtml, cleanChave);
    eventos.push(...extracted);

    // Se houve redirecionamento (302) para a consulta completa
    if (initialRes.statusCode === 302 && initialRes.headers.location) {
      const redirectPath = initialRes.headers.location;
      const redirectRes = await httpsRequestMtls({
        hostname: 'www.nfe.fazenda.gov.br',
        port: 443,
        path: redirectPath.startsWith('/') ? redirectPath : `/portal/${redirectPath}`,
        method: 'GET',
        agent,
        headers: {
          ...headersBase,
          'Cookie': cookies.join('; '),
          'Referer': 'https://www.nfe.fazenda.gov.br/portal/consultaCompleta.aspx',
        },
      });

      pageHtml = redirectRes.body;
      const redirectedEvents = extrairEventosDoHtmlPortal(pageHtml, cleanChave);
      for (const re of redirectedEvents) {
        if (!eventos.some((e) => e.protocolo === re.protocolo && e.codigoEvento === re.codigoEvento)) {
          eventos.push(re);
        }
      }
    }

    // 3. Consulta de fallback via WebService SVRS DFe Portal com mTLS
    if (eventos.length === 0) {
      try {
        const svrsRes = await httpsRequestMtls({
          hostname: 'dfe-portal.svrs.rs.gov.br',
          port: 443,
          path: `/Nfe/ConsultaNfeCompleta?chave=${cleanChave}`,
          method: 'GET',
          agent,
          headers: headersBase,
        });
        const svrsEvents = extrairEventosDoHtmlPortal(svrsRes.body, cleanChave);
        for (const se of svrsEvents) {
          if (!eventos.some((e) => e.protocolo === se.protocolo && e.codigoEvento === se.codigoEvento)) {
            eventos.push(se);
          }
        }
      } catch (svrsErr: any) {
        console.warn(`[Ambiente Nacional] Consulta complementar SVRS: ${svrsErr.message}`);
      }
    }

    console.log(`✅ [Ambiente Nacional - mTLS] Total de eventos obtidos diretamente do Portal Nacional: ${eventos.length}`);

    return {
      success: true,
      chaveAcesso: cleanChave,
      eventos,
      totalEventos: eventos.length,
      mensagem: eventos.length > 0
        ? `Sucesso: ${eventos.length} evento(s) oficial(is) extraído(s) do Ambiente Nacional via mTLS.`
        : 'Consulta ao Ambiente Nacional realizada; nenhum evento tabular foi retornado na sessão pública.',
      origem: 'ambiente_nacional_mtls',
    };
  } catch (err: any) {
    console.error(`❌ [Ambiente Nacional - mTLS] Erro ao consultar Portal Nacional:`, err.message);
    return {
      success: false,
      chaveAcesso: cleanChave,
      eventos: [],
      totalEventos: 0,
      mensagem: `Falha na consulta mTLS ao Ambiente Nacional: ${err.message}`,
      origem: 'ambiente_nacional_mtls',
    };
  }
}
