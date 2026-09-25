import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { getDatabase } from './database';
import { USER_CFOP_LIST } from './cfop_user_data';

export function seedTabelasOficiais() {
  const db = getDatabase();

  console.log('🚀 Iniciando Seed das Tabelas Oficiais RTC (SVRS & LC 214/2025)...');

  // 1. SEED CCLASSTRIB (164 Registros Oficiais da SVRS)
  try {
    const cclassPath = path.resolve('server/db/tabela_oficial_cst_cclasstrib_svrs.json');
    if (fs.existsSync(cclassPath)) {
      const cclassData = JSON.parse(fs.readFileSync(cclassPath, 'utf8'));
      
      // Expurgar qualquer fallback inexistente 900001
      db.prepare("DELETE FROM cclasstrib_regras WHERE cclasstrib = '900001'").run();

      const stmtCClass = db.prepare(`
        INSERT INTO cclasstrib_regras (
          id, cclasstrib, descricao_interna, cst, desc_cst, descricao,
          exige_tributacao, reducao_bc_cst, reducao_aliquota, diferimento, monofasica,
          perc_reducao_ibs, perc_reducao_cbs, tipo_aliquota, permite_credito,
          url_legislacao, numero_anexo, tributacao_monofasica_normal,
          tributacao_monofasica_retencao, tributacao_monofasica_retida_anteriormente,
          tributacao_monofasica_diferimento, credito_presumido, estorno_credito,
          transferencia_credito, tratamento_esperado, dados_completos_json, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, ?, datetime('now')
        )
        ON CONFLICT(id) DO UPDATE SET
          cclasstrib = excluded.cclasstrib,
          descricao_interna = excluded.descricao_interna,
          cst = excluded.cst,
          desc_cst = excluded.desc_cst,
          descricao = excluded.descricao,
          exige_tributacao = excluded.exige_tributacao,
          reducao_bc_cst = excluded.reducao_bc_cst,
          reducao_aliquota = excluded.reducao_aliquota,
          diferimento = excluded.diferimento,
          monofasica = excluded.monofasica,
          perc_reducao_ibs = excluded.perc_reducao_ibs,
          perc_reducao_cbs = excluded.perc_reducao_cbs,
          tipo_aliquota = excluded.tipo_aliquota,
          permite_credito = excluded.permite_credito,
          url_legislacao = excluded.url_legislacao,
          numero_anexo = excluded.numero_anexo,
          tributacao_monofasica_normal = excluded.tributacao_monofasica_normal,
          tributacao_monofasica_retencao = excluded.tributacao_monofasica_retencao,
          tributacao_monofasica_retida_anteriormente = excluded.tributacao_monofasica_retida_anteriormente,
          tributacao_monofasica_diferimento = excluded.tributacao_monofasica_diferimento,
          credito_presumido = excluded.credito_presumido,
          estorno_credito = excluded.estorno_credito,
          transferencia_credito = excluded.transferencia_credito,
          tratamento_esperado = excluded.tratamento_esperado,
          dados_completos_json = excluded.dados_completos_json,
          updated_at = datetime('now')
      `);

      const insertManyCClass = db.transaction((items: any[]) => {
        for (const item of items) {
          const cod = String(item['Código da Classificação Tributária'] || item.cclasstrib || '').trim();
          if (!cod) continue;
          const cst = String(item['Código da Situação Tributária'] || item.cst || '').trim();
          const desc = String(item['Descrição do Código da Classificação Tributária'] || item.descricao || item.descricao_interna || '').trim();
          const descCst = String(item['Descrição da Situação Tributária'] || item.desc_cst || '').trim();
          const monofasica = String(item['Monofásica'] || item.monofasica || (cst === '620' ? 'Sim' : 'Não')).trim();
          const redIbs = Number(item['Percentual Redução IBS'] || item.perc_reducao_ibs || 0);
          const redCbs = Number(item['Percentual Redução CBS'] || item.perc_reducao_cbs || 0);
          
          // Tratamento esperado
          let tratamento = 'tributado';
          if (cst === '620') tratamento = 'monofasico';
          else if (cst === '400') tratamento = 'isento';
          else if (cst === '410') tratamento = 'imune';
          else if (cst === '510' || cst === '515') tratamento = 'diferido';
          else if (cst === '550') tratamento = 'suspenso';
          else if (redIbs > 0 || redCbs > 0) tratamento = 'reduzido';

          // Permissão de crédito: combustíveis cobrados anteriormente (620006) ou CST 400/410/620 é 'Não' por padrão
          let permiteCredito = 'Sim';
          if (cst === '620' || cod === '620006' || cod === '620001' || cod === '620002') {
            permiteCredito = 'Não';
          } else if (cst === '400' || (cst === '410' && item['Estorno de Crédito'] !== 'Sim')) {
            permiteCredito = 'Não';
          }

          // ID determinístico por código cClassTrib
          const id = `cclass-${cod}`;

          stmtCClass.run(
            id,
            cod,
            desc,
            cst,
            descCst,
            desc,
            String(item['Exige Tributação'] || 'Sim'),
            String(item['Redução BC CST'] || 'Não'),
            String(item['Redução de Alíquota'] || 'Não'),
            String(item['Diferimento'] || 'Não'),
            monofasica,
            redIbs,
            redCbs,
            String(item['Tipo de Alíquota'] || ''),
            permiteCredito,
            String(item['Url da Legislação'] || ''),
            String(item['Número do Anexo'] || ''),
            String(item['Tributação Monofásica Normal'] || 'Não'),
            String(item['Tributação Monofásica sujeita a retenção'] || 'Não'),
            String(item['Tributação Monofásica retida anteriormente'] || 'Não'),
            String(item['Tributação Monofásica de Combustível com diferimento'] || 'Não'),
            String(item['Crédito Presumido'] || 'Não'),
            String(item['Estorno de Crédito'] || 'Não'),
            String(item['Transferência de Crédito'] || 'Não'),
            tratamento,
            JSON.stringify(item)
          );
        }
      });

      insertManyCClass(cclassData);
      const totalCClass = (db.prepare('SELECT count(*) as total FROM cclasstrib_regras').get() as any)?.total || 0;
      console.log(`✅ cClassTrib Oficial SVRS semeado com sucesso: ${totalCClass} registros.`);
    }
  } catch (err: any) {
    console.error('Erro ao semear cClassTrib SVRS:', err.message);
  }

  // 2. SEED INDOPER (39 Registros Oficiais da SVRS)
  try {
    const indoperPath = path.resolve('server/db/tabela_oficial_indoper_svrs.json');
    if (fs.existsSync(indoperPath)) {
      const indoperData = JSON.parse(fs.readFileSync(indoperPath, 'utf8'));

      const stmtIndoper = db.prepare(`
        INSERT INTO indoper_regras (
          id, codigo, nome, dispositivo_legal, local, local_fornecedor,
          caracteristica, data_publicacao, inicio_vigencia, fim_vigencia, dados_completos_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(codigo) DO UPDATE SET
          nome = excluded.nome,
          dispositivo_legal = excluded.dispositivo_legal,
          local = excluded.local,
          local_fornecedor = excluded.local_fornecedor,
          caracteristica = excluded.caracteristica,
          data_publicacao = excluded.data_publicacao,
          inicio_vigencia = excluded.inicio_vigencia,
          fim_vigencia = excluded.fim_vigencia,
          dados_completos_json = excluded.dados_completos_json
      `);

      const insertManyIndoper = db.transaction((items: any[]) => {
        for (const item of items) {
          const cod = String(item['Código'] || item.codigo || '').trim();
          if (!cod) continue;
          const id = `indoper-${cod}`;
          stmtIndoper.run(
            id,
            cod,
            String(item['Nome'] || item.nome || ''),
            String(item['Dispositivo Legal'] || item.dispositivo_legal || ''),
            String(item['Local'] || item.local || ''),
            String(item['Local do Fornecedor'] || item.local_fornecedor || ''),
            String(item['Característica do Fornecedor'] || item.caracteristica || ''),
            String(item['Data de Publicação'] || '17/11/2025'),
            String(item['Início de Vigência'] || '17/11/2025'),
            String(item['Fim de Vigência'] || '-'),
            JSON.stringify(item)
          );
        }
      });

      insertManyIndoper(indoperData);
      const totalIndoper = (db.prepare('SELECT count(*) as total FROM indoper_regras').get() as any)?.total || 0;
      console.log(`✅ indOper Oficial SVRS semeado com sucesso: ${totalIndoper} registros.`);
    }
  } catch (err: any) {
    console.error('Erro ao semear indOper SVRS:', err.message);
  }

  // 3. SEED NCM ANEXOS LC 214/2025 (1.166 Itens)
  try {
    const csvPath = path.resolve('server/db/LC214_2025_Itens_x_Codigo_v2.csv');
    if (fs.existsSync(csvPath)) {
      const content = fs.readFileSync(csvPath, 'utf8');
      const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
      
      const parseCSVLine = (line: string) => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ';' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const header = parseCSVLine(lines[0]);

      // Limpar registros antigos para evitar poluição com dados distorcidos
      db.prepare("DELETE FROM ncm_regras_anexos WHERE id LIKE 'ncm-lc214-%'").run();

      const stmtNcm = db.prepare(`
        INSERT INTO ncm_regras_anexos (
          id, id_codigo, id_item_anexo, anexo, titulo_anexo, item_anexo, descritivo,
          tratamento, percentual_reducao, perc_aliquota_aplicavel, tributo, tipo_classificacao,
          codigo, codigo_normalizado, nivel_codigo, base_legal, linha_agrupadora,
          condicionantes_observacoes, ncm, nbs, cclasstrib, descricao, tipo_tratamento,
          anexo_lei, permite_credito, is_combustivel, cclasstrib_sugerido, cst_sugerido,
          vigencia_inicio, vigencia_fim, ativo, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          '2026-01-01', '2033-12-31', 1, datetime('now')
        )
        ON CONFLICT(id) DO UPDATE SET
          id_codigo = excluded.id_codigo,
          id_item_anexo = excluded.id_item_anexo,
          anexo = excluded.anexo,
          titulo_anexo = excluded.titulo_anexo,
          item_anexo = excluded.item_anexo,
          descritivo = excluded.descritivo,
          tratamento = excluded.tratamento,
          percentual_reducao = excluded.percentual_reducao,
          perc_aliquota_aplicavel = excluded.perc_aliquota_aplicavel,
          tributo = excluded.tributo,
          tipo_classificacao = excluded.tipo_classificacao,
          codigo = excluded.codigo,
          codigo_normalizado = excluded.codigo_normalizado,
          nivel_codigo = excluded.nivel_codigo,
          base_legal = excluded.base_legal,
          linha_agrupadora = excluded.linha_agrupadora,
          condicionantes_observacoes = excluded.condicionantes_observacoes,
          ncm = excluded.ncm,
          nbs = excluded.nbs,
          cclasstrib = excluded.cclasstrib,
          descricao = excluded.descricao,
          tipo_tratamento = excluded.tipo_tratamento,
          anexo_lei = excluded.anexo_lei,
          permite_credito = excluded.permite_credito,
          is_combustivel = excluded.is_combustivel,
          cclasstrib_sugerido = excluded.cclasstrib_sugerido,
          cst_sugerido = excluded.cst_sugerido,
          updated_at = datetime('now')
      `);

      const insertManyNcm = db.transaction((rowLines: string[]) => {
        for (let i = 1; i < rowLines.length; i++) {
          const vals = parseCSVLine(rowLines[i]);
          if (vals.length < header.length) continue;

          const row: Record<string, string> = {};
          header.forEach((h, idx) => {
            row[h] = vals[idx] || '';
          });

          const idCodigo = row['ID_Codigo'] !== undefined && row['ID_Codigo'] !== '' ? Number(row['ID_Codigo']) : i;
          const idItem = row['ID'] !== undefined && row['ID'] !== '' ? Number(row['ID']) : null;
          const anexo = (row['Anexo'] || '').trim();
          const tituloAnexo = (row['Titulo_Anexo'] || '').trim();
          const itemAnexo = (row['Item_Anexo'] || '').trim();
          const descritivo = (row['Descritivo'] || '').trim();
          const tratamento = (row['Tratamento'] || '').trim();
          const tributo = (row['Tributo'] || 'IBS e CBS').trim();
          const tipoClassificacao = (row['Tipo_Classificacao'] || 'NCM/SH').trim();
          const codigo = (row['Codigo'] || '').trim();
          const codNorm = (row['Codigo_Normalizado'] || codigo.replace(/\D/g, '')).trim();
          const nivelCodigo = (row['Nivel_Codigo'] || '').trim();
          const baseLegal = (row['Base_Legal'] || 'LC 214/2025').trim();
          const linhaAgrupadora = (row['Linha_Agrupadora'] || 'Nao').trim();
          const condicionantes = (row['Condicionantes_Observacoes'] || '').trim();

          // Identificação de Imposto Seletivo (Art. 409+ LC 214/2025)
          const isImpostoSeletivo = tributo === 'IS' || anexo === 'XVII' || tratamento.toLowerCase().includes('seletivo');

          let percRed: number | null = null;
          if (row['Perc_Reducao'] !== undefined && row['Perc_Reducao'] !== null && String(row['Perc_Reducao']).trim() !== '') {
            percRed = Number(row['Perc_Reducao']);
          }

          let percAliq: number | null = null;
          if (row['Perc_Aliquota_Aplicavel'] !== undefined && row['Perc_Aliquota_Aplicavel'] !== null && String(row['Perc_Aliquota_Aplicavel']).trim() !== '') {
            percAliq = Number(row['Perc_Aliquota_Aplicavel']);
          }

          // Para Imposto Seletivo: NÃO é redução de alíquota (incidência tributária monofásica/adicional)
          if (isImpostoSeletivo) {
            percRed = 0.0;
            percAliq = 0.0;
          } else if (percRed === null) {
            if (tratamento.toLowerCase().includes('zero') || tratamento.toLowerCase().includes('100%')) {
              percRed = 100.0;
            } else if (tratamento.toLowerCase().includes('60%')) {
              percRed = 60.0;
            } else if (tratamento.toLowerCase().includes('30%')) {
              percRed = 30.0;
            } else if (tratamento.toLowerCase().includes('80%')) {
              percRed = 80.0;
            } else if (tratamento.toLowerCase().includes('50%')) {
              percRed = 50.0;
            } else if (tratamento.toLowerCase().includes('70%')) {
              percRed = 70.0;
            } else if (tratamento.toLowerCase().includes('40%')) {
              percRed = 40.0;
            } else {
              percRed = 0.0;
            }
          }
          if (percAliq === null) percAliq = 0.0;

          // Flag de combustível (NCMs 2710, 2711 ou Artigo 172 da LC 214)
          const isCombustivel = (codNorm.startsWith('2710') || codNorm.startsWith('2711') || codNorm.startsWith('2207') || codNorm.startsWith('3826')) ? 1 : 0;
          
          let permiteCredito = (row['Permite_Credito'] || 'Sim').trim();
          let cclassSugerido = '';
          let cstSugerido = '000';
          let tipoTratamento: string = 'padrao';
          
          if (isCombustivel === 1) {
            cstSugerido = '620';
            cclassSugerido = '620006'; // Cobrada anteriormente
            permiteCredito = 'Não';    // Art. 267 da LC 214/2025
            tipoTratamento = 'ad_rem';
          } else if (isImpostoSeletivo) {
            cstSugerido = '000';
            cclassSugerido = '';
            tipoTratamento = 'imposto_seletivo';
          } else if (tratamento.toLowerCase().includes('zero') || percRed === 100) {
            cstSugerido = '200';
            cclassSugerido = '200003'; // Alíquota zero
            tipoTratamento = 'cesta_basica_zero';
          } else if (tratamento.toLowerCase().includes('60') || percRed === 60) {
            cstSugerido = '200';
            cclassSugerido = '200034'; // Redução de 60%
            tipoTratamento = 'reducao_60';
          } else if (tratamento.toLowerCase().includes('30') || percRed === 30) {
            cstSugerido = '200';
            cclassSugerido = '200052'; // Redução de 30%
            tipoTratamento = 'reducao_30';
          }

          const id = `ncm-lc214-${idCodigo}-${codNorm || 'item'}`;

          stmtNcm.run(
            id,
            idCodigo,
            idItem,
            anexo,
            tituloAnexo,
            itemAnexo,
            descritivo,
            tratamento,
            percRed,
            percAliq,
            tributo,
            tipoClassificacao,
            codigo,
            codNorm,
            nivelCodigo,
            baseLegal,
            linhaAgrupadora,
            condicionantes,
            codigo, // ncm
            row['NBS'] || '',
            cclassSugerido,
            descritivo || tituloAnexo,
            tipoTratamento,
            tituloAnexo,
            permiteCredito,
            isCombustivel,
            cclassSugerido,
            cstSugerido
          );
        }

        // Garantir os principais combustíveis monofásicos do Art. 172 da LC 214/2025
        const combustiveisArt172 = [
          { ncm: '2711.19.10', codNorm: '27111910', desc: 'Gás Liquefeito de Petróleo (GLP / Gás de Cozinha)', cclass: '620006', cst: '620' },
          { ncm: '2711.11.00', codNorm: '27111100', desc: 'Gás Natural Liquefeito (GNL)', cclass: '620006', cst: '620' },
          { ncm: '2711.21.00', codNorm: '27112100', desc: 'Gás Natural Veicular / Gasoso (GNV)', cclass: '620006', cst: '620' },
          { ncm: '2710.12.59', codNorm: '27101259', desc: 'Gasolina Comum e Aditivada (Gasolina A/C)', cclass: '620006', cst: '620' },
          { ncm: '2710.19.21', codNorm: '27101921', desc: 'Óleo Diesel (Diesel A/B/S10/S500)', cclass: '620006', cst: '620' },
          { ncm: '2207.10.10', codNorm: '22071010', desc: 'Álcool Etílico Anidro Combustível (EAC)', cclass: '620003', cst: '620' },
          { ncm: '2207.10.90', codNorm: '22071090', desc: 'Álcool Etílico Hidratado Combustível (EHC)', cclass: '620001', cst: '620' },
          { ncm: '3826.00.00', codNorm: '38260000', desc: 'Biodiesel (B100)', cclass: '620001', cst: '620' },
          { ncm: '2710.19.11', codNorm: '27101911', desc: 'Querosene de Aviação (QAV)', cclass: '620006', cst: '620' }
        ];

        for (const c of combustiveisArt172) {
          const id = `ncm-comb-${c.codNorm}`;
          stmtNcm.run(
            id,
            null,
            null,
            'Monofásico',
            'Regime Monofásico de Combustíveis (Art. 172 LC 214/2025)',
            '1',
            c.desc,
            'Tributação Monofásica Ad Rem',
            0.0,
            0.0,
            'IBS e CBS',
            'NCM/SH',
            c.ncm,
            c.codNorm,
            '8 digitos (item completo)',
            'Art. 172 da LC 214/2025',
            'Nao',
            'Alíquota ad rem por unidade de medida. Vedada a apropriação de créditos na revenda/consumo (Art. 267 LC 214/2025).',
            c.ncm,
            '',
            c.cclass,
            c.desc,
            'ad_rem',
            'Regime Monofásico de Combustíveis (Art. 172 LC 214/2025)',
            'Não',
            1,
            c.cclass,
            c.cst
          );
        }
      });

      insertManyNcm(lines);
      const totalNcm = (db.prepare('SELECT count(*) as total FROM ncm_regras_anexos').get() as any)?.total || 0;
      console.log(`✅ Regras da LC 214/2025 semeadas com sucesso: ${totalNcm} registros.`);
    } else {
      console.warn(`Arquivo ${csvPath} não encontrado para seed de NCM.`);
    }
  } catch (err: any) {
    console.error('Erro ao semear NCMs LC 214/2025:', err.message);
  }

  // 4. SEED MATRIZ CANÔNICA DE CFOPS (Lista Oficial com Onerosidade)
  try {
    const totalCfopsAtual = (db.prepare('SELECT count(*) as total FROM cfop_tratamento WHERE ativo = 1').get() as any)?.total || 0;
    if (totalCfopsAtual < 100) {
      const stmtCheck = db.prepare('SELECT id FROM cfop_tratamento WHERE cfop = ?');
      const stmtInsert = db.prepare(`
        INSERT INTO cfop_tratamento (
          id, empresa_id, cfop, descricao, categoria,
          tratamento_padrao, exige_onerosidade, exige_validacao_cclasstrib,
          evidencia_minima, ativo, created_at, updated_at
        ) VALUES (?, NULL, ?, ?, ?, ?, ?, 1, ?, 1, datetime('now'), datetime('now'))
      `);
      const insertManyCfop = db.transaction((items: any[]) => {
        for (const item of items) {
          const c = item.classe.toLowerCase();
          const categoria = c.includes('compra') || c.includes('aquisi') ? 'Compra' :
            c.includes('dev') ? 'Devolução' :
            c.includes('transf') ? 'Transferência' :
            c.includes('remessa') ? 'Remessa' :
            c.includes('retorno') ? 'Retorno' :
            c.includes('venda') || c.includes('presta') ? 'Venda' : 'Outros';

          const tratamentoPadrao = item.tipoOperacao === 'Depende - Avaliar cada Cenário SGB' ? 'Depende' :
            item.tipoOperacao === 'Não Onerosas' ? 'Não elegível' :
            categoria === 'Compra' ? 'Elegível' :
            categoria === 'Devolução' ? 'Depende' :
            categoria === 'Venda' ? 'Não elegível' : 'Depende';

          const exigeOnerosidade = item.tipoOperacao === 'Não Onerosas' ? 0 : 1;
          const evidenciaMinima = item.cfop.startsWith('3') ? 'DI / Duimp + NF-e de Entrada de Importação + Comprovante de Pagamento' :
            item.classe.includes('Transporte') ? 'CT-e Autorizado vinculado à NF-e + DACTE' :
            categoria === 'Compra' ? 'XML NF-e com Chave Válida + Fatura Comercial / Duplicata Paga' :
            categoria === 'Devolução' ? 'NF-e de Devolução espelho com chave da nota originária' :
            categoria === 'Transferência' ? 'NF-e de Transferência entre estabelecimentos da mesma empresa' :
            categoria === 'Remessa' || categoria === 'Retorno' ? 'NF-e de Remessa/Retorno sem cobrança financeira (Art. 32 LC 214/2025)' :
            'Documento Fiscal Eletrônico (DF-e) Autorizado';

          if (!stmtCheck.get(item.cfop)) {
            stmtInsert.run(uuid(), item.cfop, item.descricao, categoria, tratamentoPadrao, exigeOnerosidade, evidenciaMinima);
          }
        }
      });
      insertManyCfop(USER_CFOP_LIST);
      console.log(`✅ Matriz canônica de CFOPs semeada com sucesso no SQLite: ${USER_CFOP_LIST.length} itens.`);
    }
  } catch (err: any) {
    console.error('Erro ao semear Matriz de CFOPs:', err.message);
  }

  console.log('🏁 Seed das Tabelas Oficiais RTC finalizado!');
}
