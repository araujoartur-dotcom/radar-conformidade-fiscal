/**
 * ============================================================================
 * SEED DE PARÂMETROS FISCAIS — CATEGORIA B
 * ============================================================================
 * Popula e garante a integridade de todas as alíquotas da Categoria B:
 * 1. Alíquotas Ad Valorem anuais da Reforma (2026 a 2033+)
 * 2. Alíquotas Ad Rem de referência (GLP e Combustíveis)
 * 3. Catálogo de NCMs com tratamento diferenciado e redução (LC 214/2025)
 * 4. Matriz oficial de retenções de serviços da LC 116/03
 * 5. Parâmetros de inferência fiscal média
 *
 * Tudo 100% visível, auditável e editável em "Parâmetros & Tabelas Fiscais".
 * ============================================================================
 */

import { v4 as uuid } from 'uuid';

export function seedCategoriaB(db: any): void {
  seedAdValoremEAdRem(db);
  seedNcmRegrasAnexos(db);
  seedRegrasRetencaoServicos(db);
  seedParametrosInferencia(db);
}

export function seedAdValoremEAdRem(db: any): void {
  try {
    const countAdValorem = db.prepare("SELECT COUNT(*) as count FROM aliquotas_tabelas WHERE modalidade = 'ad_valorem'").get() as any;
    
    // Se tiver menos de 8 vigências Ad Valorem, atualizar/inserir o cronograma completo
    if (!countAdValorem || countAdValorem.count < 8) {
      console.log('🌱 Semeando vigências anuais da alíquota Ad Valorem (2026 a 2033+)...');

      const adValoremData = [
        { cod: '00001', ini: '2026-01-01', fim: '2026-12-31', cbs: 0.9000, est: 0.0500, mun: 0.0500, is: 0.0000, desc: 'Ano de Teste e Calibração Operacional (Art. 342 LC 214/2025) - Total 1,00%' },
        { cod: '00002', ini: '2027-01-01', fim: '2027-12-31', cbs: 8.8000, est: 0.0500, mun: 0.0500, is: 0.0000, desc: 'Entrada em Vigor Plena da CBS Federal (8,80%) e IBS Teste (0,10%)' },
        { cod: '00003', ini: '2033-01-01', fim: '2099-12-31', cbs: 9.2100, est: 13.7000, mun: 5.0000, is: 0.0000, desc: 'Regime Pleno Definitivo do IVA Dual (27,91%) — Comitê Gestor IBS' },
        { cod: '00004', ini: '2028-01-01', fim: '2028-12-31', cbs: 8.8000, est: 0.0500, mun: 0.0500, is: 0.0000, desc: 'Consolidação da CBS e Ajuste Fino para o IBS Estadual/Municipal' },
        { cod: '00005', ini: '2029-01-01', fim: '2029-12-31', cbs: 8.8000, est: 1.3700, mun: 0.5000, is: 0.0000, desc: 'Transição IBS (10% da Ref. = 1,87%) + Redução ICMS/ISS 10% - Total 10,67%' },
        { cod: '00006', ini: '2030-01-01', fim: '2030-12-31', cbs: 8.8000, est: 2.7400, mun: 1.0000, is: 0.0000, desc: 'Transição IBS (20% da Ref. = 3,74%) + Redução ICMS/ISS 20% - Total 12,54%' },
        { cod: '00007', ini: '2031-01-01', fim: '2031-12-31', cbs: 8.8000, est: 4.1100, mun: 1.5000, is: 0.0000, desc: 'Transição IBS (30% da Ref. = 5,61%) + Redução ICMS/ISS 30% - Total 14,41%' },
        { cod: '00008', ini: '2032-01-01', fim: '2032-12-31', cbs: 8.8000, est: 5.4800, mun: 2.0000, is: 0.0000, desc: 'Transição IBS (40% da Ref. = 7,48%) + Redução ICMS/ISS 40% - Total 16,28%' },
      ];

      const stmtAdVal = db.prepare(`
        INSERT OR REPLACE INTO aliquotas_tabelas (
          id, codigo_cadastro, modalidade, cbs_federal, ibs_estadual, ibs_municipal, is_federal, unidade_medida, inicio_vigencia, final_vigencia, descricao
        ) VALUES (?, ?, 'ad_valorem', ?, ?, ?, ?, NULL, ?, ?, ?)
      `);

      for (const row of adValoremData) {
        stmtAdVal.run(uuid(), row.cod, row.cbs, row.est, row.mun, row.is, row.ini, row.fim, row.desc);
      }
    }

    const countAdRem = db.prepare("SELECT COUNT(*) as count FROM aliquotas_tabelas WHERE modalidade = 'ad_rem'").get() as any;
    if (!countAdRem || countAdRem.count === 0) {
      console.log('🌱 Semeando alíquotas Ad Rem (GLP e Combustíveis)...');
      const adRemData = [
        { cod: '00001', ini: '2026-01-01', fim: '2026-12-31', cbs: 0.0000, est: 0.0000, mun: 0.0000, is: 0.0000, unid: 'kg', desc: 'Ano de Teste Ad Rem (Combustíveis e GLP)' },
        { cod: '00002', ini: '2027-01-01', fim: '2099-12-31', cbs: 176.7000, est: 1.4700, mun: 0.0000, is: 0.0000, unid: 'kg', desc: 'Ad Rem Monofásico GLP / Combustíveis — LC 214/2025' }
      ];

      const stmtAdRem = db.prepare(`
        INSERT OR REPLACE INTO aliquotas_tabelas (
          id, codigo_cadastro, modalidade, cbs_federal, ibs_estadual, ibs_municipal, is_federal, unidade_medida, inicio_vigencia, final_vigencia, descricao
        ) VALUES (?, ?, 'ad_rem', ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const row of adRemData) {
        stmtAdRem.run(uuid(), row.cod, row.cbs, row.est, row.mun, row.is, row.unid, row.ini, row.fim, row.desc);
      }
    }
  } catch (e) {
    console.error('Erro ao semear aliquotas_tabelas:', e);
  }
}

export function seedNcmRegrasAnexos(db: any): void {
  try {
    const countNcm = db.prepare('SELECT COUNT(*) as count FROM ncm_regras_anexos').get() as any;
    if (countNcm && countNcm.count > 0) return;

    console.log('🌱 Semeando catálogo de regras de redução por NCM da LC 214/2025...');

    const ncmRegras = [
      { ncm: '2711.19.10', nbs: '', cclasstrib: '900001', desc: 'Gás Liquefeito de Petróleo (GLP)', tipo: 'ad_rem', red: 0, anexo: 'Art. 350 LC 214/25', base: 'LC 214/2025' },
      { ncm: '1006.10.92', nbs: '', cclasstrib: '030001', desc: 'Arroz em grãos não parboilizado', tipo: 'cesta_basica_zero', red: 100, anexo: 'Anexo I Cesta Básica Nacional', base: 'Art. 8º LC 214/2025' },
      { ncm: '0401.20.10', nbs: '', cclasstrib: '030001', desc: 'Leite pasteurizado integral', tipo: 'cesta_basica_zero', red: 100, anexo: 'Anexo I Cesta Básica Nacional', base: 'Art. 8º LC 214/2025' },
      { ncm: '0713.33.19', nbs: '', cclasstrib: '030001', desc: 'Feijão preto e feijão carioca', tipo: 'cesta_basica_zero', red: 100, anexo: 'Anexo I Cesta Básica Nacional', base: 'Art. 8º LC 214/2025' },
      { ncm: '0201.30.00', nbs: '', cclasstrib: '030001', desc: 'Carnes bovinas frescas ou refrigeradas', tipo: 'cesta_basica_zero', red: 100, anexo: 'Anexo I Cesta Básica Nacional', base: 'Art. 8º LC 214/2025' },
      { ncm: '3004.90.99', nbs: '', cclasstrib: '010001', desc: 'Medicamentos essenciais de uso humano', tipo: 'reducao_60', red: 60, anexo: 'Anexo VII Produtos de Saúde', base: 'Art. 132 LC 214/2025' },
      { ncm: '8504.40.21', nbs: '', cclasstrib: '000001', desc: 'Equipamentos e conversores estáticos industriais', tipo: 'padrao', red: 0, anexo: 'Regime Geral', base: 'LC 214/2025' },
      { ncm: '8425.31.10', nbs: '', cclasstrib: '200031', desc: 'Guinchos e equipamentos de elevação (Bens de Capital)', tipo: 'reducao_30', red: 30, anexo: 'Bens de Capital', base: 'Art. 262 LC 214/2025' }
    ];

    const stmtNcm = db.prepare(`
      INSERT OR REPLACE INTO ncm_regras_anexos (
        id, ncm, nbs, cclasstrib, descricao, tipo_tratamento, percentual_reducao, anexo_lei, base_legal, vigencia_inicio, vigencia_fim, ativo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-01-01', '2033-12-31', 1)
    `);

    for (const n of ncmRegras) {
      stmtNcm.run(uuid(), n.ncm, n.nbs, n.cclasstrib, n.desc, n.tipo, n.red, n.anexo, n.base);
    }
  } catch (e) {
    console.error('Erro ao semear ncm_regras_anexos:', e);
  }
}

export function seedRegrasRetencaoServicos(db: any): void {
  try {
    const countRet = db.prepare('SELECT COUNT(*) as count FROM regras_retencao_servicos').get() as any;
    if (countRet && countRet.count > 0) return;

    console.log('🌱 Semeando matriz de retenções de serviços oficiais da LC 116/03...');

    const retencoesData = [
      { item: '17.01', desc: 'Assessoria ou consultoria de qualquer natureza, gestão, informática e TI', nbs: '1.0101.10.00', irrf: '1,50%', csrf: '4,65%', inss: '0,00%', iss: '5,00%', fund: 'Art. 714 RIR/18; Art. 30 Lei 10.833/03' },
      { item: '07.02', desc: 'Execução de obras de construção civil, engenharia consultiva e reparação', nbs: '1.0201.20.00', irrf: '1,50%', csrf: '4,65%', inss: '11,00%', iss: '3,00%', fund: 'Art. 714 RIR/18; Art. 31 Lei 8.212/91' },
      { item: '11.02', desc: 'Vigilância, segurança ou monitoramento de bens, pessoas e semoventes', nbs: '1.0301.30.00', irrf: '1,00%', csrf: '4,65%', inss: '11,00%', iss: '5,00%', fund: 'Art. 716 RIR/18; Art. 31 Lei 8.212/91' },
      { item: '11.04', desc: 'Limpeza, manutenção e conservação de imóveis, prédios e parques', nbs: '1.0301.40.00', irrf: '1,00%', csrf: '4,65%', inss: '11,00%', iss: '5,00%', fund: 'Art. 716 RIR/18; Art. 31 Lei 8.212/91' },
      { item: '14.01', desc: 'Lubrificação, limpeza, revisão, manutenção e conservação de máquinas e motores', nbs: '1.0401.10.00', irrf: '1,50%', csrf: '4,65%', inss: '11,00%', iss: '5,00%', fund: 'Art. 714 RIR/18; Art. 31 Lei 8.212/91' },
      { item: '17.14', desc: 'Advocacia e assessoria jurídica', nbs: '1.0101.20.00', irrf: '1,50%', csrf: '4,65%', inss: '0,00%', iss: '5,00%', fund: 'Art. 714 RIR/18; Art. 30 Lei 10.833/03' },
      { item: '04.01', desc: 'Medicina e biomedicina, consultas e exames laboratoriais', nbs: '1.0501.10.00', irrf: '1,50%', csrf: '4,65%', inss: '0,00%', iss: '2,00%', fund: 'Art. 714 RIR/18; LC 116/03' },
      { item: '10.05', desc: 'Agenciamento, corretagem ou intermediação de bens e serviços', nbs: '1.0601.10.00', irrf: '1,50%', csrf: '4,65%', inss: '0,00%', iss: '5,00%', fund: 'Art. 718 RIR/18; Art. 30 Lei 10.833/03' },
    ];

    const stmtRet = db.prepare(`
      INSERT OR REPLACE INTO regras_retencao_servicos (
        id, item_lc116, descricao_item, nbs, descricao_nbs, ps_onerosa, adq_exterior,
        indop, local_incidencia_ibs, cclasstrib, nome_cclasstrib,
        irrf, csrf, inss, iss, cosirf_orgaos_publicos,
        fundamentos_legais, tipo_operacao, caracteristica_fornecimento,
        local_fornecimento, dispositivo_legal_lc214, observacao, indnfe, indnfse
      ) VALUES (
        ?, ?, ?, ?, '', 1, 0,
        'Prestação de Serviços', 'Destino', '000001', 'Tributação Normal',
        ?, ?, ?, ?, 'Dispensa se inferior a R$ 10',
        ?, 'Prestação Nacional', 'Presencial/Remoto',
        'Estabelecimento do Tomador', 'LC 116/03 e LC 214/25', 'Retenção na fonte auditável', 'N', 'S'
      )
    `);

    for (const r of retencoesData) {
      stmtRet.run(uuid(), r.item, r.desc, r.nbs, r.irrf, r.csrf, r.inss, r.iss, r.fund);
    }
  } catch (e) {
    console.error('Erro ao semear regras_retencao_servicos:', e);
  }
}

export function seedParametrosInferencia(db: any): void {
  try {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM parametros_inferencia').get() as any;
    if (countRow && countRow.count > 0) return;

    console.log('🌱 Semeando parâmetros de inferência fiscal média...');

    const parametrosInferencia = [
      { codigo: 'INF_001', descricao: 'Alíquotas Médias - Simples Nacional (CRT 1/4)', icms: 3.50, pis: 0.55, cofins: 2.56, ipi: 0.00, iss: 3.50, sn: 1, cte: 0, nfse: 0 },
      { codigo: 'INF_002', descricao: 'Alíquotas Médias - CT-e (PIS/COFINS Transporte)', icms: 0.00, pis: 1.65, cofins: 7.60, ipi: 0.00, iss: 0.00, sn: 0, cte: 1, nfse: 0 },
      { codigo: 'INF_003', descricao: 'Alíquotas Médias - NFS-e Serviços', icms: 0.00, pis: 0.65, cofins: 3.00, ipi: 0.00, iss: 5.00, sn: 0, cte: 0, nfse: 1 },
    ];

    const stmtInf = db.prepare(`
      INSERT OR REPLACE INTO parametros_inferencia (id, codigo, descricao, icms_medio, pis_medio, cofins_medio, ipi_medio, iss_medio, aplica_simples_nac, aplica_cte, aplica_nfse)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of parametrosInferencia) {
      stmtInf.run(uuid(), p.codigo, p.descricao, p.icms, p.pis, p.cofins, p.ipi, p.iss, p.sn, p.cte, p.nfse);
    }
  } catch (e) {
    console.error('Erro ao semear parametros_inferencia:', e);
  }
}
