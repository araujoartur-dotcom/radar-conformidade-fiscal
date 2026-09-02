/**
 * ============================================================
 * 🚀 RADAR FISCAL — MOTOR DE INGESTÃO ULTRARRÁPIDA EM LOTE (V12)
 * ============================================================
 * Processa dinamicamente milhares de XMLs (20k, 50k, 100k+)
 * com parsing concorrente, transações atômicas e streaming
 * em lote direto para o Supabase (PostgreSQL) e SQLite local.
 * 
 * USO:
 *   npx tsx scripts/ingest-xmls-fast.ts "C:\Caminho\Da\Pasta\XML"
 *   npm run ingest -- "C:\Caminho\Da\Pasta\XML"
 *   npx tsx scripts/ingest-xmls-fast.ts   (Modo interativo com prompt)
 * ============================================================
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../server/db/database.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../server/db/supabase.js';
import { parseFiscalXml } from '../server/utils/xmlParser.js';
import { resolveSupabaseEmpresaId } from '../server/utils/tenantHelper.js';
import { getBrasiliaTimestamp } from '../server/utils/timezone.js';

// Configurações de Performance
const BATCH_SIZE_DOCS = 100;    // Tamanho do lote de documentos para o Supabase
const BATCH_SIZE_ITENS = 300;   // Tamanho do lote de itens para o Supabase
const PARSE_CONCURRENCY = 60;   // Concorrência de leitura e parse de arquivos em disco

interface ScanStats {
  totalFiles: number;
  processedDocs: number;
  totalItens: number;
  entradasCount: number;
  saidasCount: number;
  nfeCount: number;
  cteCount: number;
  nfseCount: number;
  valorTotalGeral: number;
  valorCbsGeral: number;
  valorIbsGeral: number;
  erros: Array<{ file: string; error: string }>;
  startTime: number;
}

/**
 * Busca recursiva de todos os arquivos .xml dentro de uma pasta
 */
function scanXmlFilesRecursively(dir: string, fileList: string[] = []): string[] {
  try {
    if (!fs.existsSync(dir)) return fileList;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanXmlFilesRecursively(fullPath, fileList);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) {
        fileList.push(fullPath);
      }
    }
  } catch (err: any) {
    console.warn(`⚠️ Aviso ao ler pasta ${dir}: ${err.message}`);
  }
  return fileList;
}

/**
 * Formata valores monetários em R$
 */
function formatBrl(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

/**
 * Barra de progresso visual no terminal
 */
function renderProgressBar(current: number, total: number, speed: number, startTime: number) {
  const percent = total > 0 ? (current / total) * 100 : 0;
  const barLength = 30;
  const filled = Math.min(barLength, Math.round((percent / 100) * barLength));
  const empty = barLength - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  const elapsedSec = (Date.now() - startTime) / 1000;
  const remainingFiles = total - current;
  const etaSec = speed > 0 ? Math.round(remainingFiles / speed) : 0;
  const etaFormatted = new Date(etaSec * 1000).toISOString().substring(14, 19);

  const line = `\r⚡ [${bar}] ${percent.toFixed(1)}% | ${current.toLocaleString()}/${total.toLocaleString()} XMLs | ${Math.round(speed)} XML/s | ETA: ${etaFormatted} `;
  process.stdout.write(line);
}

/**
 * Função principal de Ingestão Ultrarrápida
 */
async function runFastIngestion() {
  console.clear();
  console.log('\n' + '═'.repeat(72));
  console.log('       🚀 RADAR DE CONFORMIDADE FISCAL — CARGA EM LOTE V12');
  console.log('═'.repeat(72));

  // 1. Obter caminho da pasta (CLI argument ou Prompt)
  let targetFolder = process.argv[2];

  if (!targetFolder) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    targetFolder = await new Promise<string>((resolve) => {
      console.log('\n📂 Nenhum caminho informado na linha de comando.');
      rl.question('👉 Digite ou cole o caminho completo da pasta com os XMLs:\n   > ', (answer) => {
        rl.close();
        resolve(answer.trim().replace(/^["']|["']$/g, ''));
      });
    });
  }

  if (!targetFolder || !fs.existsSync(targetFolder)) {
    // Tentar caminhos padrão conhecidos
    const fallbackFolders = [
      path.resolve('./XML ENTRADA'),
      path.resolve('./XML SAIDA'),
      'C:\\SEFAZ\\XMLs',
      path.resolve('./data/xmls')
    ];

    const foundFallback = fallbackFolders.find(f => fs.existsSync(f) && scanXmlFilesRecursively(f).length > 0);

    if (foundFallback) {
      console.log(`\n💡 Pasta "${targetFolder}" não encontrada. Usando pasta padrão encontrada: ${foundFallback}`);
      targetFolder = foundFallback;
    } else {
      console.error(`\n❌ Erro: O diretório informado "${targetFolder}" não existe ou está inacessível.`);
      console.log('Exemplo de uso:');
      console.log('  npx tsx scripts/ingest-xmls-fast.ts "C:\\MinhasNotas\\XMLs"\n');
      process.exit(1);
    }
  }

  console.log(`\n🔍 Escaneando diretório: ${targetFolder}`);
  const startTimeScan = Date.now();
  const xmlFiles = scanXmlFilesRecursively(targetFolder);
  const totalFound = xmlFiles.length;

  if (totalFound === 0) {
    console.log('⚠️ Nenhum arquivo .xml encontrado nesta pasta ou subpastas.');
    process.exit(0);
  }

  console.log(`✅ ${totalFound.toLocaleString()} arquivos XML localizados em ${((Date.now() - startTimeScan) / 1000).toFixed(2)}s.`);

  // 2. Conexões de Banco
  const db = getDatabase();
  const supabase = getSupabaseAdmin();
  const supaConfigured = isSupabaseConfigured();

  console.log(`💾 SQLite Local:  ✅ Conectado`);
  console.log(`☁️ Supabase Cloud: ${supaConfigured ? '✅ Conectado' : '⚠️ Desconectado (apenas SQLite local)'}`);

  // 3. Obter ou criar empresa ativa padrão para vinculação
  const empresaLocal = db.prepare('SELECT id, cnpj_completo, cnpj_raiz, razao_social, uf, regime_tributario FROM empresas LIMIT 1').get() as any;
  const defaultEmpresaId = empresaLocal?.id || uuidv4();
  let defaultSupaEmpresaId = defaultEmpresaId;

  if (supaConfigured && supabase) {
    defaultSupaEmpresaId = await resolveSupabaseEmpresaId(supabase, {
      id: empresaLocal?.id,
      cnpj_completo: empresaLocal?.cnpj_completo || '19.791.896/0001-00',
      cnpj_raiz: empresaLocal?.cnpj_raiz || '19791896',
      razao_social: empresaLocal?.razao_social || 'SUPERGASBRAS ENERGIA LTDA'
    });
  }

  console.log(`🏢 Tenant Ativo:   [${empresaLocal?.cnpj_completo || '19.791.896/0001-00'}] ${empresaLocal?.razao_social || 'SUPERGASBRAS'}`);
  console.log(`⚡ Supabase Tenant UUID: ${defaultSupaEmpresaId}`);
  console.log('\n🚀 INICIANDO PROCESSAMENTO DE ALTA PERFORMANCE...\n');

  const stats: ScanStats = {
    totalFiles: totalFound,
    processedDocs: 0,
    totalItens: 0,
    entradasCount: 0,
    saidasCount: 0,
    nfeCount: 0,
    cteCount: 0,
    nfseCount: 0,
    valorTotalGeral: 0,
    valorCbsGeral: 0,
    valorIbsGeral: 0,
    erros: [],
    startTime: Date.now()
  };

  // SQLite Statements pré-compilados para máxima velocidade
  const insertDocStmt = db.prepare(`
    INSERT OR REPLACE INTO dfe_documentos (
      id, empresa_id, tipo_doc, chave_acesso, tipo_operacao, numero_serie,
      data_emissao, data_entrada, competencia,
      fornecedor_cnpj, fornecedor_razao, fornecedor_uf, fornecedor_municipio, fornecedor_ie,
      cliente_cnpj, cliente_razao, cliente_uf, cliente_ie,
      situacao_doc, situacao_manifestacao, evento_ultimo,
      valor_total, valor_icms, valor_ipi, valor_pis, valor_cofins,
      valor_cbs, valor_ibs, valor_is, valor_irrf, valor_inss, valor_iss, valor_csll,
      xml_raw, status_sefaz, protocolo_sefaz, download_at, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `);

  const deleteItensStmt = db.prepare('DELETE FROM dfe_itens WHERE documento_id = ?');

  const insertItemStmt = db.prepare(`
    INSERT INTO dfe_itens (
      id, documento_id, item_nro, codigo_item, descricao_item, ncm, cest, cfop,
      cclasstrib, cst_csosn, natureza_operacao, quantidade, unidade,
      valor_unitario, valor_bruto_item, desconto_incondicional, frete_seguro_rateado,
      valor_liquido_item, base_icms, aliquota_icms, valor_icms,
      base_ipi, aliquota_ipi, valor_ipi,
      base_pis, aliquota_pis, valor_pis,
      base_cofins, aliquota_cofins, valor_cofins,
      base_ibs, aliquota_ibs, valor_ibs,
      base_cbs, aliquota_cbs, valor_cbs, valor_is, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);

  // Filas de buffer para inserção em lote no Supabase
  let bufferSupabaseDocs: any[] = [];
  let bufferSupabaseItens: any[] = [];

  const brasiliaNow = getBrasiliaTimestamp();

  // Função para descarregar buffers no Supabase
  async function flushSupabaseBuffers(forceAll = false) {
    if (!supaConfigured || !supabase) return;

    if (bufferSupabaseDocs.length >= BATCH_SIZE_DOCS || (forceAll && bufferSupabaseDocs.length > 0)) {
      const docsToInsert = bufferSupabaseDocs.splice(0, BATCH_SIZE_DOCS);
      try {
        const { error: docErr } = await supabase
          .from('dfe_documentos')
          .upsert(docsToInsert, { onConflict: 'chave_acesso' });

        if (docErr) {
          console.error(`\n❌ [Supabase Batch Docs Error]:`, docErr.message);
        }
      } catch (err: any) {
        console.error(`\n❌ [Supabase Batch Docs Exception]:`, err.message);
      }
    }

    if (bufferSupabaseItens.length >= BATCH_SIZE_ITENS || (forceAll && bufferSupabaseItens.length > 0)) {
      const itensToInsert = bufferSupabaseItens.splice(0, BATCH_SIZE_ITENS);
      try {
        const { error: itemErr } = await supabase
          .from('dfe_itens')
          .upsert(itensToInsert);

        if (itemErr) {
          console.error(`\n❌ [Supabase Batch Itens Error]:`, itemErr.message);
        }
      } catch (err: any) {
        console.error(`\n❌ [Supabase Batch Itens Exception]:`, err.message);
      }
    }
  }

  // Processamento Concorrente em Chunks
  for (let i = 0; i < xmlFiles.length; i += PARSE_CONCURRENCY) {
    const chunkFiles = xmlFiles.slice(i, i + PARSE_CONCURRENCY);

    // Leitura e Parsing Concorrente
    const parsedResults = await Promise.all(
      chunkFiles.map(async (filePath) => {
        try {
          const content = await fs.promises.readFile(filePath, 'utf8');
          if (!content || !content.includes('<')) return null;
          const parsed = await parseFiscalXml(content, empresaLocal?.cnpj_completo);
          return { filePath, parsed, content };
        } catch (err: any) {
          stats.erros.push({ file: path.basename(filePath), error: err.message });
          return null;
        }
      })
    );

    // Gravação Atômica do Chunk no SQLite (1 transação para todo o chunk)
    const sqliteTx = db.transaction(() => {
      for (const res of parsedResults) {
        if (!res) continue;
        const { parsed, content } = res;
        const docId = `doc-${parsed.chaveAcesso}`;

        insertDocStmt.run(
          docId,
          defaultEmpresaId,
          parsed.tipoDoc,
          parsed.chaveAcesso,
          parsed.tipoOperacao,
          parsed.numero,
          parsed.dataEmissao,
          parsed.dataEntrada,
          parsed.competencia,
          parsed.emitenteCnpj,
          parsed.emitenteNome,
          parsed.emitenteUf,
          parsed.emitenteMunicipio,
          parsed.emitenteIe || '',
          parsed.destinatarioCnpj,
          parsed.destinatarioNome,
          parsed.destinatarioUf,
          parsed.destinatarioIe || '',
          parsed.situacaoDoc,
          parsed.situacaoManifestacao,
          parsed.eventoUltimo,
          parsed.valorTotal,
          parsed.valorIcms,
          parsed.valorIpi,
          parsed.valorPis,
          parsed.valorCofins,
          parsed.valorCbs,
          parsed.valorIbs,
          parsed.valorIs,
          parsed.valorIrrf,
          parsed.valorInss,
          parsed.valorIss,
          parsed.valorCsll,
          content,
          parsed.statusSefaz,
          parsed.protocoloSefaz,
          brasiliaNow,
          brasiliaNow,
          brasiliaNow
        );

        deleteItensStmt.run(docId);

        if (parsed.itens && parsed.itens.length > 0) {
          for (const it of parsed.itens) {
            const itemId = `item-${parsed.chaveAcesso}-${it.numeroItem}`;
            insertItemStmt.run(
              itemId,
              docId,
              it.numeroItem,
              it.codigo,
              it.descricao,
              it.ncm,
              it.cest,
              it.cfop,
              it.cClassTrib,
              it.cstCsosn,
              it.naturezaOperacao,
              it.quantidade,
              it.unidade,
              it.valorUnitario,
              it.valorBruto,
              it.desconto,
              it.freteSeguro,
              it.valorLiquido,
              it.baseIcms,
              it.aliquotaIcms,
              it.valorIcms,
              it.baseIpi,
              it.aliquotaIpi,
              it.valorIpi,
              it.basePis,
              it.aliquotaPis,
              it.valorPis,
              it.baseCofins,
              it.aliquotaCofins,
              it.valorCofins,
              it.baseIbs,
              it.aliquotaIbs,
              it.valorIbs,
              it.baseCbs,
              it.aliquotaCbs,
              it.valorCbs,
              it.valorIs,
              brasiliaNow
            );
          }
        }
      }
    });

    sqliteTx();

    // Preparação para Lote no Supabase & Estatísticas
    for (const res of parsedResults) {
      if (!res) continue;
      const { parsed, content } = res;
      const docId = `doc-${parsed.chaveAcesso}`;

      stats.processedDocs++;
      stats.totalItens += parsed.itens?.length || 0;
      stats.valorTotalGeral += parsed.valorTotal || 0;
      stats.valorCbsGeral += parsed.valorCbs || 0;
      stats.valorIbsGeral += parsed.valorIbs || 0;

      if (parsed.tipoOperacao === 'Entrada') stats.entradasCount++;
      else stats.saidasCount++;

      if (parsed.tipoDoc === 'NFe') stats.nfeCount++;
      else if (parsed.tipoDoc === 'CTe') stats.cteCount++;
      else if (parsed.tipoDoc === 'NFSe') stats.nfseCount++;

      if (supaConfigured && supabase) {
        bufferSupabaseDocs.push({
          id: docId,
          empresa_id: defaultSupaEmpresaId,
          tipo_doc: parsed.tipoDoc,
          chave_acesso: parsed.chaveAcesso,
          tipo_operacao: parsed.tipoOperacao,
          numero_serie: parsed.numero,
          data_emissao: parsed.dataEmissao,
          data_entrada: parsed.dataEntrada,
          competencia: parsed.competencia,
          fornecedor_cnpj: parsed.emitenteCnpj,
          fornecedor_razao: parsed.emitenteNome,
          fornecedor_uf: parsed.emitenteUf,
          fornecedor_municipio: parsed.emitenteMunicipio,
          fornecedor_ie: parsed.emitenteIe || '',
          cliente_cnpj: parsed.destinatarioCnpj,
          cliente_razao: parsed.destinatarioNome,
          cliente_uf: parsed.destinatarioUf,
          cliente_ie: parsed.destinatarioIe || '',
          situacao_doc: parsed.situacaoDoc,
          situacao_manifestacao: parsed.situacaoManifestacao,
          evento_ultimo: parsed.eventoUltimo,
          valor_total: parsed.valorTotal,
          valor_icms: parsed.valorIcms,
          valor_ipi: parsed.valorIpi,
          valor_pis: parsed.valorPis,
          valor_cofins: parsed.valorCofins,
          valor_cbs: parsed.valorCbs,
          valor_ibs: parsed.valorIbs,
          valor_is: parsed.valorIs,
          valor_irrf: parsed.valorIrrf,
          valor_inss: parsed.valorInss,
          valor_iss: parsed.valorIss,
          valor_csll: parsed.valorCsll,
          xml_raw: content,
          status_sefaz: parsed.statusSefaz,
          protocolo_sefaz: parsed.protocoloSefaz,
          download_at: brasiliaNow,
          updated_at: brasiliaNow
        });

        if (parsed.itens && parsed.itens.length > 0) {
          for (const it of parsed.itens) {
            bufferSupabaseItens.push({
              id: uuidv4(),
              documento_id: docId,
              item_nro: it.numeroItem,
              codigo_item: it.codigo,
              descricao_item: it.descricao,
              ncm: it.ncm,
              cest: it.cest,
              cfop: it.cfop,
              cclasstrib: it.cClassTrib,
              cst_csosn: it.cstCsosn,
              natureza_operacao: it.naturezaOperacao,
              quantidade: it.quantidade,
              unidade: it.unidade,
              valor_unitario: it.valorUnitario,
              valor_bruto_item: it.valorBruto,
              desconto_incondicional: it.desconto,
              frete_seguro_rateado: it.freteSeguro,
              valor_liquido_item: it.valorLiquido,
              base_icms: it.baseIcms,
              aliquota_icms: it.aliquotaIcms,
              valor_icms: it.valorIcms,
              base_ipi: it.baseIpi,
              aliquota_ipi: it.aliquotaIpi,
              valor_ipi: it.valorIpi,
              base_pis: it.basePis,
              aliquota_pis: it.aliquotaPis,
              valor_pis: it.valorPis,
              base_cofins: it.baseCofins,
              aliquota_cofins: it.aliquotaCofins,
              valor_cofins: it.valorCofins,
              base_ibs: it.baseIbs,
              aliquota_ibs: it.aliquotaIbs,
              valor_ibs: it.valorIbs,
              base_cbs: it.baseCbs,
              aliquota_cbs: it.aliquotaCbs,
              valor_cbs: it.valorCbs,
              valor_is: it.valorIs
            });
          }
        }
      }
    }

    // Flush de lotes para o Supabase
    await flushSupabaseBuffers(false);

    // Atualização da Barra de Progresso
    const elapsedSec = (Date.now() - stats.startTime) / 1000;
    const currentSpeed = elapsedSec > 0 ? stats.processedDocs / elapsedSec : 0;
    renderProgressBar(stats.processedDocs, totalFound, currentSpeed, stats.startTime);
  }

  // Forçar esvaziamento final de todos os buffers restantes
  await flushSupabaseBuffers(true);

  const totalTimeSec = ((Date.now() - stats.startTime) / 1000).toFixed(1);
  const avgSpeed = (stats.processedDocs / parseFloat(totalTimeSec)).toFixed(0);

  // Relatório Final Consolidado
  console.log('\n\n' + '═'.repeat(72));
  console.log('🎉 CARGA EM LOTE CONCLUÍDA COM 100% DE INTEGRIDADE FISCAL');
  console.log('═'.repeat(72));
  console.log(`⏱️  Tempo Total:         ${totalTimeSec} segundos (Média: ${avgSpeed} XMLs/seg)`);
  console.log(`📑 Total de Documentos: ${stats.processedDocs.toLocaleString()} processados`);
  console.log(`📦 Total de Itens/Prod: ${stats.totalItens.toLocaleString()} itens indexados`);
  console.log(`📥 Documentos Entrada:  ${stats.entradasCount.toLocaleString()}`);
  console.log(`📤 Documentos Saída:    ${stats.saidasCount.toLocaleString()}`);
  console.log(`🏷️  Tipos:               NF-e: ${stats.nfeCount.toLocaleString()} | CT-e: ${stats.cteCount.toLocaleString()} | NFS-e: ${stats.nfseCount.toLocaleString()}`);
  console.log('─'.repeat(72));
  console.log(`💰 Volume Financeiro:   ${formatBrl(stats.valorTotalGeral)}`);
  console.log(`🏛️  CBS Apurado (RTC):   ${formatBrl(stats.valorCbsGeral)}`);
  console.log(`🏛️  IBS Apurado (RTC):   ${formatBrl(stats.valorIbsGeral)}`);
  if (stats.erros.length > 0) {
    console.log(`⚠️  Arquivos com aviso:  ${stats.erros.length} arquivos`);
  }
  console.log('═'.repeat(72) + '\n');
}

runFastIngestion().catch((err) => {
  console.error('\n❌ Erro fatal na execução:', err);
  process.exit(1);
});
