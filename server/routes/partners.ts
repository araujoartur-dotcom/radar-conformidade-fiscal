/**
 * ============================================================
 * ROTAS DE PARCEIROS DE NEGÓCIO (MDM FISCAL)
 * ============================================================
 * Gerencia Clientes, Fornecedores e Prestadores com suporte a:
 * - CNPJ Alfanumérico (Portaria RFB nº 439/2024)
 * - SPED Fiscal (Registro 0150/0175/C100), SPED Contribuições e SCANC
 * - Persistência híbrida Supabase / SQLite
 * ============================================================
 */

import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDatabase } from '../db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';
import { AuthenticatedRequest, requireAuth, logAuditAction } from '../middleware/auth';
import { getBrasiliaTimestamp } from '../utils/timezone';

const router = Router();

// ============================================================
// VALIDADOR UNIVERSAL CPF / CNPJ (NUMÉRICO E ALFANUMÉRICO)
// ============================================================

/**
 * Validação de CNPJ Alfanumérico (Portaria RFB nº 439/2024)
 * Regra: 12 posições alfanuméricas + 2 dígitos verificadores numéricos.
 * Valor = ASCII - 48 ('0'=0, 'A'=17, 'B'=18... 'Z'=42)
 */
export function validarCnpjAlfaOuNumerico(cnpjRaw: string): boolean {
  const clean = cnpjRaw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 14) return false;

  // Rejeitar sequências inválidas conhecidas
  if (/^0{14}$|^1{14}$|^A{14}$/.test(clean)) return false;

  const charValues = clean.split('').map(c => {
    const code = c.charCodeAt(0);
    return code - 48; // '0' (48) -> 0, '9' (57) -> 9, 'A' (65) -> 17, 'Z' (90) -> 42
  });

  // 1º Dígito Verificador (pesos: 5,4,3,2,9,8,7,6,5,4,3,2)
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum1 = 0;
  for (let i = 0; i < 12; i++) {
    sum1 += charValues[i] * weights1[i];
  }
  const rest1 = sum1 % 11;
  const dv1 = rest1 < 2 ? 0 : 11 - rest1;
  if (charValues[12] !== dv1) return false;

  // 2º Dígito Verificador (pesos: 6,5,4,3,2,9,8,7,6,5,4,3,2)
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum2 = 0;
  for (let i = 0; i < 13; i++) {
    sum2 += (i === 12 ? dv1 : charValues[i]) * weights2[i];
  }
  const rest2 = sum2 % 11;
  const dv2 = rest2 < 2 ? 0 : 11 - rest2;
  return charValues[13] === dv2;
}

/**
 * Validação de CPF (11 dígitos)
 */
export function validarCpf(cpfRaw: string): boolean {
  const clean = cpfRaw.replace(/\D/g, '');
  if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i), 10) * (10 - i);
  let rest = 11 - (sum % 11);
  let dv1 = rest >= 10 ? 0 : rest;
  if (dv1 !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i), 10) * (11 - i);
  rest = 11 - (sum % 11);
  let dv2 = rest >= 10 ? 0 : rest;
  return dv2 === parseInt(clean.charAt(10), 10);
}

export function validarDocumento(tipo: 'PF' | 'PJ' | 'EX', doc: string): boolean {
  if (tipo === 'EX') return Boolean(doc && doc.trim().length >= 3);
  if (tipo === 'PF') return validarCpf(doc);
  return validarCnpjAlfaOuNumerico(doc);
}

// ============================================================
// BASE DE DADOS IN-MEMORY SEED PARA DEMONSTRAÇÃO
// ============================================================
let inMemoryPartners: any[] = [
  {
    id: 'partner-ind-lucro-real-001',
    tipoPessoa: 'PJ',
    papel: 'fornecedor',
    cpfCnpj: '02.456.789/0001-30',
    cnpjRaiz: '02456789',
    cnpjOrdem: '0001',
    cnpjDv: '30',
    razaoSocial: 'METALURGICA BRASIL S/A',
    nomeFantasia: 'METALBRAS INDUSTRIAL',
    naturezaJuridica: '2054', // S/A Fechada
    regimeTributario: '04', // Lucro Real
    esferaPublica: 'NA',
    segmento: 'IND',
    cnaePrincipal: '2511000',
    statusCadastro: 'A',
    endereco: {
      cep: '04571000',
      logradouro: 'Avenida das Nações Unidas',
      numero: '12901',
      complemento: 'Torre Oeste 14º Andar',
      bairro: 'Brooklin Paulista',
      codMunicipioIbge: '3550308',
      municipio: 'São Paulo',
      uf: 'SP',
      codPaisBacen: '1058',
      nomePais: 'Brasil'
    },
    fiscal: {
      inscricaoEstadual: '110293847115',
      indIeDestinatario: '1',
      inscricaoMunicipal: '9876543-2',
      indContribuinteIpi: true,
      indSubstitutoTrib: true,
      indProdutorRural: false,
      indCooperativa: false,
      indOptanteSimples: false,
      suframa: ''
    },
    retencoes: {
      retemIrrf: true,
      aliquotaIrrf: 1.5,
      codigoReceitaIrrf: '1708',
      retemCrf: true,
      aliquotaCrf: 4.65,
      retemInss: false,
      retemIss: false
    },
    contabil: {
      contaContabilFornecedor: '2.01.01.01.0025',
      centroCustoDefault: 'CC_FABRICA_SP',
      condicaoPagamentoDias: 30,
      limiteCredito: 500000,
      dadosBancarios: {
        bancoCodigo: '001',
        bancoNome: 'Banco do Brasil',
        agencia: '3300-1',
        contaCorrente: '45890-2',
        chavePix: '02456789000130',
        tipoChavePix: 'CNPJ'
      },
      contatoFiscal: {
        nome: 'Mariana Souza (Contadora)',
        email: 'fiscal@metalbras.com.br',
        telefone: '(11) 3456-7890',
        crcContador: 'SP-123456/O-0'
      }
    },
    situacaoCadastralSefaz: 'Habilitado',
    dataUltimaConsultaSefaz: '2026-08-15T14:30:00Z',
    createdAt: '2026-08-10T10:00:00Z',
    updatedAt: '2026-08-15T14:30:00Z'
  },
  {
    id: 'partner-com-simples-002',
    tipoPessoa: 'PJ',
    papel: 'cliente',
    cpfCnpj: '14.890.123/0001-45',
    cnpjRaiz: '14890123',
    cnpjOrdem: '0001',
    cnpjDv: '45',
    razaoSocial: 'MERCADO POPULAR DE ALIMENTOS LTDA',
    nomeFantasia: 'MERCADINHO DA VILA',
    naturezaJuridica: '2062', // LTDA
    regimeTributario: '01', // Simples Nacional
    esferaPublica: 'NA',
    segmento: 'COM',
    cnaePrincipal: '4711302',
    statusCadastro: 'A',
    endereco: {
      cep: '80010000',
      logradouro: 'Rua XV de Novembro',
      numero: '450',
      bairro: 'Centro',
      codMunicipioIbge: '4106902',
      municipio: 'Curitiba',
      uf: 'PR',
      codPaisBacen: '1058',
      nomePais: 'Brasil'
    },
    fiscal: {
      inscricaoEstadual: '9018273645',
      indIeDestinatario: '1',
      indContribuinteIpi: false,
      indSubstitutoTrib: false,
      indProdutorRural: false,
      indCooperativa: false,
      indOptanteSimples: true,
      aliquotaIcmsSimples: 3.12
    },
    retencoes: {
      retemIrrf: false,
      retemCrf: false, // Isento Lei 10.833
      retemInss: false,
      retemIss: false
    },
    contabil: {
      contaContabilCliente: '1.01.02.01.0089',
      centroCustoDefault: 'CC_COMERCIAL_SUL',
      condicaoPagamentoDias: 28,
      limiteCredito: 80000
    },
    situacaoCadastralSefaz: 'Habilitado',
    dataUltimaConsultaSefaz: '2026-08-16T08:00:00Z',
    createdAt: '2026-08-12T11:20:00Z',
    updatedAt: '2026-08-16T08:00:00Z'
  },
  {
    id: 'partner-orgao-publico-003',
    tipoPessoa: 'PJ',
    papel: 'cliente',
    cpfCnpj: '46.395.000/0001-39',
    cnpjRaiz: '46395000',
    cnpjOrdem: '0001',
    cnpjDv: '39',
    razaoSocial: 'MUNICIPIO DE SAO PAULO',
    nomeFantasia: 'PREFEITURA DE SAO PAULO',
    naturezaJuridica: '1031', // Órgão Público Municipal
    regimeTributario: '05', // Imune/Isento
    esferaPublica: 'MU',
    segmento: 'SER',
    cnaePrincipal: '8411600',
    statusCadastro: 'A',
    endereco: {
      cep: '01002020',
      logradouro: 'Viaduto do Chá',
      numero: '15',
      bairro: 'Centro',
      codMunicipioIbge: '3550308',
      municipio: 'São Paulo',
      uf: 'SP',
      codPaisBacen: '1058',
      nomePais: 'Brasil'
    },
    fiscal: {
      inscricaoEstadual: 'ISENTO',
      indIeDestinatario: '9', // Não Contribuinte
      indContribuinteIpi: false,
      indSubstitutoTrib: false,
      indProdutorRural: false,
      indCooperativa: false,
      indOptanteSimples: false
    },
    retencoes: {
      retemIrrf: true,
      retemCrf: true,
      regimeRetencaoPublica: 'IN_1234_AMPLA',
      retemInss: false,
      retemIss: true,
      aliquotaIss: 5.0
    },
    contabil: {
      contaContabilCliente: '1.01.02.02.0010',
      centroCustoDefault: 'CC_SETOR_PUBLICO',
      condicaoPagamentoDias: 60
    },
    situacaoCadastralSefaz: 'Isento',
    dataUltimaConsultaSefaz: '2026-08-16T09:00:00Z',
    createdAt: '2026-08-01T09:00:00Z',
    updatedAt: '2026-08-16T09:00:00Z'
  },
  {
    id: 'partner-cnpj-alfa-004',
    tipoPessoa: 'PJ',
    papel: 'fornecedor',
    cpfCnpj: '12.ABC.345/0001-30', // Exemplo de CNPJ Alfanumérico Portaria RFB 439/2024
    cnpjRaiz: '12ABC345',
    cnpjOrdem: '0001',
    cnpjDv: '30',
    razaoSocial: 'TECH NOVA INOVAÇÃO DIGITAL LTDA',
    nomeFantasia: 'TECH NOVA CLOUD',
    naturezaJuridica: '2062',
    regimeTributario: '04', // Lucro Real
    esferaPublica: 'NA',
    segmento: 'SER',
    cnaePrincipal: '6201501',
    statusCadastro: 'A',
    endereco: {
      cep: '30130000',
      logradouro: 'Avenida Afonso Pena',
      numero: '2000',
      bairro: 'Funcionários',
      codMunicipioIbge: '3106200',
      municipio: 'Belo Horizonte',
      uf: 'MG',
      codPaisBacen: '1058',
      nomePais: 'Brasil'
    },
    fiscal: {
      inscricaoMunicipal: '789123/001-4',
      indIeDestinatario: '9',
      indContribuinteIpi: false,
      indSubstitutoTrib: false,
      indProdutorRural: false,
      indCooperativa: false,
      indOptanteSimples: false
    },
    retencoes: {
      retemIrrf: true,
      aliquotaIrrf: 1.5,
      codigoReceitaIrrf: '1708',
      retemCrf: true,
      aliquotaCrf: 4.65,
      retemInss: false,
      retemIss: false
    },
    contabil: {
      contaContabilFornecedor: '2.01.01.02.0078',
      centroCustoDefault: 'CC_TI_SISTEMAS'
    },
    situacaoCadastralSefaz: 'Não Contribuinte',
    dataUltimaConsultaSefaz: '2026-08-16T10:00:00Z',
    createdAt: '2026-08-15T15:00:00Z',
    updatedAt: '2026-08-16T10:00:00Z'
  }
];

// ============================================================
// ENDPOINTS
// ============================================================

/**
 * GET /api/partners - Listar parceiros com filtros
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, papel, regime, segmento, status } = req.query;

    let list = inMemoryPartners;

    // Se Supabase estiver configurado e com tabela criada, consulta do Supabase
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('parceiros_negocio')
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && data && data.length > 0) {
            list = data.map((d: any) => ({
              ...d,
              endereco: typeof d.endereco === 'string' ? JSON.parse(d.endereco) : d.endereco,
              fiscal: typeof d.fiscal === 'string' ? JSON.parse(d.fiscal) : d.fiscal,
              retencoes: typeof d.retencoes === 'string' ? JSON.parse(d.retencoes) : d.retencoes,
              contabil: typeof d.contabil === 'string' ? JSON.parse(d.contabil) : d.contabil,
            }));
          }
        } catch (supErr) {
          console.warn('⚠️ Tabela parceiros_negocio no Supabase ainda não inicializada. Usando store local.');
        }
      }
    }

    // Filtros de memória/busca
    if (search) {
      const s = (search as string).toLowerCase().replace(/[.\-\/]/g, '');
      list = list.filter(p => 
        p.razaoSocial.toLowerCase().includes(s) ||
        (p.nomeFantasia && p.nomeFantasia.toLowerCase().includes(s)) ||
        p.cpfCnpj.toLowerCase().replace(/[.\-\/]/g, '').includes(s) ||
        p.endereco.municipio.toLowerCase().includes(s)
      );
    }

    if (papel && papel !== 'todos') {
      list = list.filter(p => p.papel === papel || p.papel === 'ambos');
    }

    if (regime && regime !== 'todos') {
      list = list.filter(p => p.regimeTributario === regime);
    }

    if (segmento && segmento !== 'todos') {
      list = list.filter(p => p.segmento === segmento);
    }

    if (status && status !== 'todos') {
      list = list.filter(p => p.statusCadastro === status);
    }

    res.json({
      success: true,
      total: list.length,
      data: list
    });
  } catch (err: any) {
    console.error('❌ Erro ao listar parceiros:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar parceiros de negócio.' });
  }
});

/**
 * GET /api/partners/:id - Obter detalhes de um parceiro
 */
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const partner = inMemoryPartners.find(p => p.id === id);

    if (!partner) {
      res.status(404).json({ success: false, error: 'Parceiro não encontrado.' });
      return;
    }

    res.json({ success: true, data: partner });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Erro ao obter parceiro.' });
  }
});

/**
 * POST /api/partners - Criar novo parceiro com motor de regras fiscais
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = req.body;

    if (!payload.cpfCnpj || !payload.razaoSocial || !payload.tipoPessoa) {
      res.status(400).json({ success: false, error: 'Tipo de Pessoa, CPF/CNPJ e Razão Social são obrigatórios.' });
      return;
    }

    // Validação de Dígitos Verificadores do Documento
    const isValid = validarDocumento(payload.tipoPessoa, payload.cpfCnpj);
    if (!isValid) {
      res.status(400).json({
        success: false,
        error: `O documento ${payload.cpfCnpj} é inválido para o tipo ${payload.tipoPessoa} (Falha no cálculo do Módulo 11 oficial).`
      });
      return;
    }

    // Regras automáticas de integridade
    if (payload.naturezaJuridica === '2135') {
      payload.regimeTributario = '06'; // MEI
      if (payload.retencoes) {
        payload.retencoes.retemCrf = false;
        payload.retencoes.retemIrrf = false;
      }
    }

    if (payload.regimeTributario === '01' || payload.regimeTributario === '06') {
      if (payload.retencoes) {
        payload.retencoes.retemCrf = false; // Isento Lei 10.833
      }
    }

    const cleanDoc = payload.cpfCnpj.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const newPartner = {
      id: `partner-${uuid()}`,
      ...payload,
      cnpjRaiz: cleanDoc.length === 14 ? cleanDoc.slice(0, 8) : undefined,
      cnpjOrdem: cleanDoc.length === 14 ? cleanDoc.slice(8, 12) : undefined,
      cnpjDv: cleanDoc.length === 14 ? cleanDoc.slice(12, 14) : undefined,
      statusCadastro: payload.statusCadastro || 'A',
      situacaoCadastralSefaz: payload.situacaoCadastralSefaz || 'Habilitado',
      createdAt: getBrasiliaTimestamp(),
      updatedAt: getBrasiliaTimestamp()
    };

    inMemoryPartners.unshift(newPartner);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          await supabase.from('parceiros_negocio').insert({
            id: newPartner.id,
            tipo_pessoa: newPartner.tipoPessoa,
            papel: newPartner.papel,
            cpf_cnpj: newPartner.cpfCnpj,
            cnpj_raiz: newPartner.cnpjRaiz,
            cnpj_ordem: newPartner.cnpjOrdem,
            cnpj_dv: newPartner.cnpjDv,
            id_estrangeiro: newPartner.idEstrangeiro,
            razao_social: newPartner.razaoSocial,
            nome_fantasia: newPartner.nomeFantasia,
            natureza_juridica: newPartner.naturezaJuridica,
            regime_tributario: newPartner.regimeTributario,
            esfera_publica: newPartner.esferaPublica,
            segmento: newPartner.segmento,
            cnae_principal: newPartner.cnaePrincipal,
            cnaes_secundarios: newPartner.cnaesSecundarios || [],
            status_cadastro: newPartner.statusCadastro,
            endereco: newPartner.endereco,
            fiscal: newPartner.fiscal,
            retencoes: newPartner.retencoes,
            contabil: newPartner.contabil,
            situacao_cadastral_sefaz: newPartner.situacaoCadastralSefaz
          });
        } catch (supErr) {
          console.warn('⚠️ Supabase sync fallback:', supErr);
        }
      }
    }

    logAuditAction(req, 'PARCEIRO_CRIAR', `Parceiro ${newPartner.razaoSocial} (${newPartner.cpfCnpj}) cadastrado com sucesso.`);

    res.status(201).json({
      success: true,
      message: 'Parceiro de negócio cadastrado com sucesso!',
      data: newPartner
    });
  } catch (err: any) {
    console.error('❌ Erro ao criar parceiro:', err);
    res.status(500).json({ success: false, error: err.message || 'Erro interno ao cadastrar parceiro.' });
  }
});

/**
 * PUT /api/partners/:id - Atualizar parceiro
 */
router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    const index = inMemoryPartners.findIndex(p => p.id === id);
    if (index === -1) {
      res.status(404).json({ success: false, error: 'Parceiro não encontrado.' });
      return;
    }

    const updated = {
      ...inMemoryPartners[index],
      ...payload,
      updatedAt: getBrasiliaTimestamp()
    };

    inMemoryPartners[index] = updated;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          await supabase.from('parceiros_negocio').update({
            tipo_pessoa: updated.tipoPessoa,
            papel: updated.papel,
            cpf_cnpj: updated.cpfCnpj,
            razao_social: updated.razaoSocial,
            nome_fantasia: updated.nomeFantasia,
            natureza_juridica: updated.naturezaJuridica,
            regime_tributario: updated.regimeTributario,
            esfera_publica: updated.esferaPublica,
            segmento: updated.segmento,
            cnae_principal: updated.cnaePrincipal,
            status_cadastro: updated.statusCadastro,
            endereco: updated.endereco,
            fiscal: updated.fiscal,
            retencoes: updated.retencoes,
            contabil: updated.contabil,
            updated_at: getBrasiliaTimestamp()
          }).eq('id', id);
        } catch (supErr) {
          console.warn('⚠️ Supabase update fallback:', supErr);
        }
      }
    }

    logAuditAction(req, 'PARCEIRO_ATUALIZAR', `Parceiro ${updated.razaoSocial} atualizado.`);

    res.json({
      success: true,
      message: 'Cadastro do parceiro atualizado com sucesso.',
      data: updated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Erro ao atualizar parceiro.' });
  }
});

/**
 * DELETE /api/partners/:id - Excluir / Inativar parceiro
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    inMemoryPartners = inMemoryPartners.filter(p => p.id !== id);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          await supabase.from('parceiros_negocio').delete().eq('id', id);
        } catch (supErr) {
          console.warn('⚠️ Supabase delete fallback:', supErr);
        }
      }
    }

    logAuditAction(req, 'PARCEIRO_EXCLUIR', `Parceiro ID ${id} removido da base.`);

    res.json({ success: true, message: 'Parceiro de negócio removido com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Erro ao remover parceiro.' });
  }
});

/**
 * POST /api/partners/simulate-tax - Motor de Simulação Fiscal Instantânea
 */
router.post('/simulate-tax', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { partnerId, partnerData, tipoOperacao, ufOrigem = 'SP', ufDestino } = req.body;

    let partner = partnerData;
    if (!partner && partnerId) {
      partner = inMemoryPartners.find(p => p.id === partnerId);
    }

    if (!partner) {
      res.status(400).json({ success: false, error: 'Dados do parceiro não informados.' });
      return;
    }

    const destUf = ufDestino || partner.endereco?.uf || 'SP';
    const isInterestadual = ufOrigem !== destUf;
    const isSimples = partner.regimeTributario === '01' || partner.regimeTributario === '06';
    const isNaoContribuinte = partner.fiscal?.indIeDestinatario === '9';
    const isOrgaoPublico = partner.naturezaJuridica?.startsWith('1') || partner.esferaPublica !== 'NA';

    let cfop = '5102';
    let cstIcms = '00';
    let csosn = isSimples ? '102' : undefined;
    let cstPis = '01';
    let cstCofins = '01';
    let aliquotaIcms = isInterestadual ? (['SP', 'RJ', 'MG', 'RS', 'PR', 'SC'].includes(destUf) ? 12 : 7) : 18;
    let exigeDifal = isInterestadual && isNaoContribuinte;
    let exigeFcp = exigeDifal && ['RJ', 'AL', 'SE', 'PE'].includes(destUf);

    const obs: string[] = [];

    if (tipoOperacao === 'venda_mercadoria') {
      cfop = isInterestadual ? (isNaoContribuinte ? '6108' : '6102') : '5102';
      if (isSimples) {
        csosn = '102';
        obs.push('Emitente ou Destinatário no Simples Nacional: CSOSN 102 sem aproveitamento de crédito básico.');
      } else {
        cstIcms = '00';
      }
      if (exigeDifal) {
        obs.push(`Operação interestadual (${ufOrigem} ➔ ${destUf}) para Não Contribuinte: Incidência de DIFAL Partilha (EC 87/2015).`);
      }
    } else if (tipoOperacao === 'prestacao_servico') {
      cfop = '0000'; // NFS-e Municipal
      cstPis = '01';
      cstCofins = '01';
      obs.push('Prestação de Serviços com incidência de ISSQN no município de prestação (LC 116/2003).');
    }

    let irrf = 0;
    let pis = 0;
    let cofins = 0;
    let csll = 0;
    let inss = 0;
    let iss = 0;

    if (partner.retencoes?.retemIrrf && !isSimples) irrf = 1.5;
    if (partner.retencoes?.retemCrf && !isSimples) {
      pis = 0.65;
      cofins = 3.0;
      csll = 1.0;
    }
    if (partner.retencoes?.retemInss) inss = partner.retencoes.indicadorCprb ? 3.5 : 11.0;
    if (partner.retencoes?.retemIss) iss = partner.retencoes.aliquotaIss || 5.0;

    if (isOrgaoPublico) {
      obs.push('Destinatário é Órgão Público: Aplicadas regras de retenção na fonte IN RFB nº 1.234/2012 e Imunidade Tributária Recíproca.');
    }

    res.json({
      success: true,
      simulation: {
        tipoOperacao,
        ufOrigem,
        ufDestino: destUf,
        cfopSugerido: cfop,
        cstIcmsSugerido: isSimples ? '90' : cstIcms,
        csosnSugerido: csosn,
        cstPisSugerido: cstPis,
        cstCofinsSugerido: cstCofins,
        aliquotaIcms,
        exigeDifalPartilha: exigeDifal,
        exigeFcp,
        retencoesAplicadas: {
          irrf,
          pis,
          cofins,
          csll,
          inss,
          iss,
          totalRetencoes: irrf + pis + cofins + csll + inss + iss
        },
        observacoesFiscais: obs
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Erro ao simular tributação.' });
  }
});

export default router;
