/**
 * ============================================================
 * SEED — DADOS INICIAIS DO BANCO DE DADOS
 * ============================================================
 * Popula tabelas com dados essenciais para o funcionamento
 * inicial do sistema: admin padrão, alíquotas de referência,
 * mapa CFOP e mapa cClassTrib.
 * ============================================================
 */

import { getDatabase } from './database';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { AUTH } from '../config';

export function seedDatabase(): void {
  const db = getDatabase();

  // Sempre garantir que parametros_inferencia estejam populados
  seedParametrosInferencia(db);

  // Verificar se já foi populado
  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM usuarios').get() as any;
  if (existingUsers.count > 0) {
    console.log('ℹ️  Banco já possui dados de usuários/empresas.');
    return;
  }

  console.log('🌱 Populando banco de dados com dados iniciais...');

  // =========================================================
  // USUÁRIO ADMIN PADRÃO
  // =========================================================
  const adminId = uuid();
  const senhaHash = bcrypt.hashSync('Admin@RadarFiscal2026!', AUTH.BCRYPT_ROUNDS);

  db.prepare(`
    INSERT INTO usuarios (id, nome, email, senha_hash, perfil, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(adminId, 'Administrador Master', 'admin@radarfiscal.com.br', senhaHash, 'admin_master', 'ativo');

  // =========================================================
  // EMPRESA PADRÃO INICIAL
  // =========================================================
  const empresaId = uuid();
  db.prepare(`
    INSERT OR IGNORE INTO empresas (id, cnpj_raiz, cnpj_completo, razao_social, nome_fantasia, uf, regime_tributario, status)
    VALUES (?, '19791896', '19.791.896/0001-00', 'SUPERGASBRAS ENERGIA LTDA', 'SUPERGASBRAS ENERGIA LTDA', 'SP', 'Lucro Real', 'ativo')
  `).run(empresaId);

  // Vincular admin à empresa padrão
  db.prepare(`
    INSERT OR IGNORE INTO usuario_empresa (id, usuario_id, empresa_id, permissao, modulos_permitidos)
    VALUES (?, ?, ?, 'total', '*')
  `).run(uuid(), adminId, empresaId);

  // =========================================================
  // ALÍQUOTAS DE REFERÊNCIA CBS / IBS (Transição 2026–2033)
  // =========================================================
  const aliquotas = [
    // 2026 — Fase teste (CBS Test 0.9%)
    { inicio: '2026-01-01', fim: '2026-12-31', tipo: 'CBS', aliq: 0.9, fase: 'teste_2026', desc: 'CBS Teste (Art. 342 LC 214/25) — Alíquota de teste do período de adaptação', base: 'LC 214/2025, Art. 342' },
    { inicio: '2026-01-01', fim: '2026-12-31', tipo: 'IBS', aliq: 0.1, fase: 'teste_2026', desc: 'IBS Teste (Art. 342 LC 214/25) — Alíquota de teste do período de adaptação', base: 'LC 214/2025, Art. 342' },

    // 2027 — Início transição
    { inicio: '2027-01-01', fim: '2027-12-31', tipo: 'CBS', aliq: 9.21, fase: 'transicao_2027', desc: 'CBS Referência — Substituição integral de PIS/COFINS (9,21%)', base: 'LC 214/2025' },
    { inicio: '2027-01-01', fim: '2027-12-31', tipo: 'IBS', aliq: 0.0, fase: 'transicao_2027', desc: 'IBS Referência — Período de Transição Inicial', base: 'LC 214/2025' },

    // 2029–2032 — Transição progressiva
    { inicio: '2029-01-01', fim: '2032-12-31', tipo: 'CBS', aliq: 9.21, fase: 'transicao_progressiva', desc: 'CBS durante período de transição (9,21%)', base: 'LC 214/2025, Art. 343-348' },
    { inicio: '2029-01-01', fim: '2032-12-31', tipo: 'IBS', aliq: 18.7, fase: 'transicao_progressiva', desc: 'IBS durante período de transição (13,70% Estadual + 5,00% Municipal = 18,70%)', base: 'LC 214/2025, Art. 343-348' },

    // 2033+ — Regime definitivo
    { inicio: '2033-01-01', fim: null, tipo: 'CBS', aliq: 9.21, fase: 'definitiva', desc: 'CBS definitiva — Alíquota de Referência Comitê Gestor (9,21%)', base: 'LC 214/2025' },
    { inicio: '2033-01-01', fim: null, tipo: 'IBS', aliq: 18.7, fase: 'definitiva', desc: 'IBS definitiva — Alíquota de Referência Comitê Gestor (13,70% Estadual + 5,00% Municipal = 18,70%)', base: 'LC 214/2025' },

    // Imposto Seletivo
    { inicio: '2027-01-01', fim: null, tipo: 'IS', aliq: 0, fase: 'definitiva', desc: 'Imposto Seletivo — Alíquota específica por produto (bebidas, fumo, etc.)', base: 'LC 214/2025, Art. 393-406' },
  ];

  const stmtAliq = db.prepare(`
    INSERT OR REPLACE INTO aliquotas_referencia (id, competencia_inicio, competencia_fim, tipo_tributo, aliquota_referencia, descricao, base_legal, fase_transicao)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const a of aliquotas) {
    stmtAliq.run(uuid(), a.inicio, a.fim, a.tipo, a.aliq, a.desc, a.base, a.fase);
  }

  // =========================================================
  // MAPA CFOP x TRATAMENTO (Regras Globais)
  // =========================================================
  const cfops = [
    { cfop: '1102', desc: 'Compra para comercialização (Estado)', cat: 'Compra', trat: 'Elegível', oner: 1, valid: 1, evid: 'XML NF-e com Chave Válida + GRN Recebimento' },
    { cfop: '2102', desc: 'Compra para comercialização (Outro Estado)', cat: 'Compra', trat: 'Elegível', oner: 1, valid: 1, evid: 'XML NF-e com Chave Válida + Conhecimento de Frete CT-e' },
    { cfop: '1551', desc: 'Compra de bem para o ativo imobilizado', cat: 'Compra', trat: 'Elegível', oner: 1, valid: 1, evid: 'Fatura de Ativo + Laudo de CIAP/Apropriação' },
    { cfop: '1910', desc: 'Entrada de bonificação, doação ou brinde', cat: 'Remessa', trat: 'Não elegível', oner: 1, valid: 1, evid: 'Nota Fiscal de Bonificação (Verificar Regra Específica)' },
    { cfop: '1915', desc: 'Entrada de mercadoria em conserto ou reparo', cat: 'Remessa', trat: 'Não elegível', oner: 1, valid: 0, evid: 'Ordem de Serviço / Remessa para Conserto' },
    { cfop: '1202', desc: 'Devolução de venda de mercadoria adquirida', cat: 'Devolução', trat: 'Depende', oner: 1, valid: 1, evid: 'NF-e de Devolução Espelho com Chave da Origem' },
    { cfop: '1352', desc: 'Aquisição de serviço de transporte por estabelecimento industrial', cat: 'Compra', trat: 'Elegível', oner: 1, valid: 1, evid: 'CT-e Vinculado à Nota Fiscal de Mercadoria' },
    { cfop: '5102', desc: 'Venda de mercadoria adquirida de terceiros', cat: 'Outros', trat: 'Não elegível', oner: 0, valid: 1, evid: 'NF-e de Saída' },
    { cfop: '6102', desc: 'Venda interestadual de mercadoria adquirida', cat: 'Outros', trat: 'Não elegível', oner: 0, valid: 1, evid: 'NF-e de Saída Interestadual' },
    { cfop: '5101', desc: 'Venda de produção do estabelecimento', cat: 'Outros', trat: 'Não elegível', oner: 0, valid: 1, evid: 'NF-e de Saída' },
    { cfop: '6352', desc: 'Prestação de serviço de transporte interestadual', cat: 'Compra', trat: 'Elegível', oner: 1, valid: 1, evid: 'CT-e autorizado e vinculado ao DACTE' },
    { cfop: '3102', desc: 'Compra para comercialização (Importação)', cat: 'Compra', trat: 'Elegível', oner: 1, valid: 1, evid: 'DI + NF-e de Entrada de Importação' },
  ];

  const stmtCfop = db.prepare(`
    INSERT INTO cfop_tratamento (id, empresa_id, cfop, descricao, categoria, tratamento_padrao, exige_onerosidade, exige_validacao_cclasstrib, evidencia_minima)
    VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const c of cfops) {
    stmtCfop.run(uuid(), c.cfop, c.desc, c.cat, c.trat, c.oner, c.valid, c.evid);
  }

  // =========================================================
  // MAPA cClassTrib x ALÍQUOTA / REGRA (6 Dígitos)
  // =========================================================
  const cclasstrib = [
    { code: '000001', desc: 'Operação Tributada Integralmente IBS/CBS', trat: 'tributado', cred: 'Sim', aliq: 'Alíquota Padrão Vigente', alertas: 'Verificar se houver destaque zerado em documento tributado.' },
    { code: '100001', desc: 'Alíquota Reduzida de Cesta Básica / Saúde', trat: 'aliquota_reduzida', cred: 'Sim', aliq: '10.6% (60% de Redução IBS/CBS)', alertas: 'Conferir enquadramento NCM na lista anexa do regulamento.' },
    { code: '200001', desc: 'Isenção / Imunidade Constitucional', trat: 'isento', cred: 'Não', aliq: '0.00%', alertas: 'Crédito bloqueado por ausência de incidência na entrada.' },
    { code: '300001', desc: 'Não Incidência / Exportação', trat: 'nao_incidencia', cred: 'Não', aliq: '0.00%', alertas: 'Não gera crédito de entrada.' },
    { code: '900001', desc: 'Regime Específico Monofásico (Combustíveis/Bebidas)', trat: 'monofasico', cred: 'Depende', aliq: 'Alíquota Ad Valorem Específica', alertas: 'Exige regra de diferimento e retenção na origem.' },
    { code: '100002', desc: 'Alíquota Reduzida 30% — Educação', trat: 'aliquota_reduzida', cred: 'Sim', aliq: '18.55% (30% de Redução IBS/CBS)', alertas: 'Aplicável a serviços educacionais conforme Art. 262 LC 214/25.' },
    { code: '400001', desc: 'Suspensão — Regime Drawback', trat: 'isento', cred: 'Depende', aliq: '0.00% (Suspensão)', alertas: 'Tributação suspensa conforme regime aduaneiro especial.' },
  ];

  const stmtCClass = db.prepare(`
    INSERT INTO cclasstrib_regras (id, empresa_id, cclasstrib, descricao_interna, tratamento_esperado, permite_credito, aliquota_esperada, alertas)
    VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
  `);

  for (const c of cclasstrib) {
    stmtCClass.run(uuid(), c.code, c.desc, c.trat, c.cred, c.aliq, c.alertas);
  }

  // =========================================================
  // REGRAS DE ELEGIBILIDADE
  // =========================================================
  const regras = [
    { codigo: 'ELEG_001', nome: 'Compra de insumo com documento idôneo e oneroso', desc: 'Aquisição de insumo vinculada à atividade produtiva com NF-e válida e evidência de pagamento', tipo: 'insumo', cfops: '["1102","2102"]', result: 'Elegível', evid: 'XML NFe válido + GRN + Fatura', base: 'LC 214/2025, Art. 28-32' },
    { codigo: 'ELEG_002', nome: 'Frete sobre aquisição creditável', desc: 'CT-e vinculado a NF-e de aquisição elegível ao crédito', tipo: 'frete', cfops: '["1352","6352"]', result: 'Elegível', evid: 'CT-e autorizado + vinculação à NF-e de entrada', base: 'LC 214/2025, Art. 28' },
    { codigo: 'ELEG_004', nome: 'Serviço tomado com retenção CBS/IBS', desc: 'NFS-e de serviço tomado com retenção obrigatória na fonte', tipo: 'servico', cfops: '[]', result: 'Pendente', evid: 'NFS-e + Comprovante de retenção ISS/CBS', base: 'LC 214/2025 + NT 009 NFS-e' },
    { codigo: 'ELEG_015', nome: 'Ativo imobilizado — crédito em 1/48 avos', desc: 'Aquisição de bem para ativo imobilizado com crédito proporcional mensal', tipo: 'imobilizado', cfops: '["1551"]', result: 'Elegível', evid: 'Laudo CIAP + Fatura + Contrato', base: 'LC 214/2025, Art. 40' },
    { codigo: 'ELEG_050', nome: 'Devolução gera estorno de crédito', desc: 'NF-e de devolução é espelho para estorno, não gera crédito novo', tipo: 'revenda', cfops: '["1202"]', result: 'Não elegível', evid: 'NF-e de origem vinculada na tag refNFe', base: 'LC 214/2025, Art. 36' },
    { codigo: 'ELEG_099', nome: 'Bonificação/Brinde — Operação não onerosa', desc: 'CFOP de remessa não onerosa — crédito vedado', tipo: 'revenda', cfops: '["1910"]', result: 'Não elegível', evid: 'NF-e de bonificação sem contraprestação financeira', base: 'LC 214/2025, Art. 28, §2º' },
  ];

  // =========================================================
  // TABELAS DE ALÍQUOTAS (AD VALOREM % E AD REM R$)
  // =========================================================
  const tabelasAliquotas = [
    // Ad Valorem (%)
    { cod: '00001', mod: 'ad_valorem', cbs: 0.9000, ibs_est: 0.0500, ibs_mun: 0.0500, is_fed: 0.0000, unid: null, ini: '2026-01-01', fim: '2026-12-31', desc: 'Ano de Teste e Calibração Operacional (Art. 342 LC 214/2025)' },
    { cod: '00002', mod: 'ad_valorem', cbs: 9.2100, ibs_est: 0.0000, ibs_mun: 0.0000, is_fed: 0.0000, unid: null, ini: '2027-01-01', fim: '2027-12-31', desc: 'Início Vigência CBS Plena e IBS Transição' },
    { cod: '00003', mod: 'ad_valorem', cbs: 9.2100, ibs_est: 13.7000, ibs_mun: 5.0000, is_fed: 0.0000, unid: null, ini: '2033-01-01', fim: '2099-12-31', desc: 'Vigência Plena e Definitiva do IVA Dual (27,91%) — Comitê Gestor IBS' },

    // Ad Rem (R$ / Unidade)
    { cod: '00001', mod: 'ad_rem', cbs: 0.0000, ibs_est: 0.0000, ibs_mun: 0.0000, is_fed: 0.0000, unid: 'kg', ini: '2026-01-01', fim: '2026-12-31', desc: 'Ano de Teste Ad Rem (Combustíveis e GLP)' },
    { cod: '00002', mod: 'ad_rem', cbs: 176.7000, ibs_est: 1.4700, ibs_mun: 0.0000, is_fed: 0.0000, unid: 'kg', ini: '2027-01-01', fim: '2027-12-31', desc: 'Ad Rem Combustíveis / GLP — LC 214/2025' },
  ];

  const stmtTabAliq = db.prepare(`
    INSERT OR REPLACE INTO aliquotas_tabelas (id, codigo_cadastro, modalidade, cbs_federal, ibs_estadual, ibs_municipal, is_federal, unidade_medida, inicio_vigencia, final_vigencia, descricao)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const t of tabelasAliquotas) {
    stmtTabAliq.run(uuid(), t.cod, t.mod, t.cbs, t.ibs_est, t.ibs_mun, t.is_fed, t.unid, t.ini, t.fim, t.desc);
  }

  // =========================================================
  // CATÁLOGO DE ANEXOS & REGIMES ESPECIAIS (NCM / NBS / cClassTrib)
  // =========================================================
  const ncmRegras = [
    { ncm: '2711.19.10', nbs: '', cclasstrib: '900001', desc: 'Gás Liquefeito de Petróleo (GLP)', tipo: 'ad_rem', red: 0, anexo: 'Art. 350 LC 214/25', base: 'LC 214/2025' },
    { ncm: '1006.10.92', nbs: '', cclasstrib: '030001', desc: 'Arroz em grãos não parboilizado', tipo: 'cesta_basica_zero', red: 100, anexo: 'Anexo I Cesta Básica Nacional', base: 'Art. 8º LC 214/2025' },
    { ncm: '0401.20.10', nbs: '', cclasstrib: '030001', desc: 'Leite pasteurizado integral', tipo: 'cesta_basica_zero', red: 100, anexo: 'Anexo I Cesta Básica Nacional', base: 'Art. 8º LC 214/2025' },
    { ncm: '0713.33.19', nbs: '', cclasstrib: '030001', desc: 'Feijão preto e feijão carioca', tipo: 'cesta_basica_zero', red: 100, anexo: 'Anexo I Cesta Básica Nacional', base: 'Art. 8º LC 214/2025' },
    { ncm: '3004.90.99', nbs: '', cclasstrib: '010001', desc: 'Medicamentos de uso humano essenciais', tipo: 'reducao_60', red: 60, anexo: 'Anexo VII Produtos de Saúde', base: 'Art. 132 LC 214/2025' },
    { ncm: '8504.40.21', nbs: '', cclasstrib: '000001', desc: 'Equipamentos e conversores estáticos', tipo: 'padrao', red: 0, anexo: 'Regime Geral', base: 'LC 214/2025' },
  ];

  const stmtNcm = db.prepare(`
    INSERT OR REPLACE INTO ncm_regras_anexos (id, ncm, nbs, cclasstrib, descricao, tipo_tratamento, percentual_reducao, anexo_lei, base_legal, vigencia_inicio, vigencia_fim, ativo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-01-01', '2033-12-31', 1)
  `);

  for (const n of ncmRegras) {
    stmtNcm.run(uuid(), n.ncm, n.nbs, n.cclasstrib, n.desc, n.tipo, n.red, n.anexo, n.base);
  }

  console.log('✅ Seed concluído: Admin, Empresa Homologação, Alíquotas Ad Valorem/Ad Rem, Anexos NCM, CFOP, cClassTrib, Parâmetros de Inferência.');
}

export function seedParametrosInferencia(db: any): void {
  try {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM parametros_inferencia').get() as any;
    if (countRow && countRow.count > 0) return;

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
    console.log('✅ Parâmetros de inferência populados com sucesso (INF_001, INF_002, INF_003).');
  } catch (err: any) {
    console.warn('⚠️ Erro ao verificar/popular parametros_inferencia:', err.message);
  }
}

