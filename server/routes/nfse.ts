/**
 * ============================================================
 * ROTAS DE NFS-E (SERVIÇOS) — RADAR FISCAL
 * ============================================================
 * Endpoints para busca, sincronização e auditoria de NFS-e
 * integrados ao Ambiente de Dados Nacional (ADN) e Prefeituras.
 * ============================================================
 */

import crypto from 'crypto';
import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { getDatabase } from '../db/database';
import { isSupabaseConfigured, getSupabaseAdmin } from '../db/supabase';
import { sincronizarNfseNacional, sincronizarNfseUnificada, sincronizarNfsePMSP, obterStatusNfse, obterDanfseNacionalPdf } from '../services/nfseService';

const router = Router();

/**
 * GET /api/nfse/status
 * Retorna o painel de status e estatísticas de NFS-e do tenant ativo.
 */
router.get('/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activeEmpresaId = req.user?.empresaAtivaId;
    const empresaId = (req.query.empresaId as string) || activeEmpresaId;
    const db = getDatabase();

    let cleanCnpj = '';
    if (empresaId) {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseAdmin();
        const { data: emp } = await supabase.from('empresas').select('cnpj_completo').eq('id', empresaId).maybeSingle();
        if (emp?.cnpj_completo) cleanCnpj = emp.cnpj_completo.replace(/\D/g, '');
      } else {
        try {
          const emp = db.prepare('SELECT cnpj_completo FROM empresas WHERE id = ?').get(empresaId) as any;
          if (emp?.cnpj_completo) cleanCnpj = emp.cnpj_completo.replace(/\D/g, '');
        } catch {
          // fallback
        }
      }
    }
    if (!cleanCnpj && req.user?.empresaCnpj) {
      cleanCnpj = req.user.empresaCnpj.replace(/\D/g, '');
    }

    if (!empresaId || !cleanCnpj) {
      res.status(400).json({ success: false, error: 'Empresa ativa ou CNPJ não identificado.' });
      return;
    }

    const resumo = await obterStatusNfse(empresaId, cleanCnpj);
    res.json({ success: true, ...resumo });
  } catch (err: any) {
    console.error('❌ Erro ao obter status de NFS-e:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/nfse/sincronizar
 * Dispara varredura automática unificada no Ambiente de Dados Nacional (ADN) e Prefeituras.
 */
router.post('/sincronizar', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activeEmpresaId = req.user?.empresaAtivaId;
    const { empresaId: bodyEmpresaId, tpAmb = '1', ultNSU = '0', conector = 'unificado' } = req.body;
    const empresaId = bodyEmpresaId || activeEmpresaId;
    const db = getDatabase();

    let cleanCnpj = '';
    if (empresaId) {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseAdmin();
        const { data: emp } = await supabase.from('empresas').select('cnpj_completo').eq('id', empresaId).maybeSingle();
        if (emp?.cnpj_completo) cleanCnpj = emp.cnpj_completo.replace(/\D/g, '');
      } else {
        try {
          const emp = db.prepare('SELECT cnpj_completo FROM empresas WHERE id = ?').get(empresaId) as any;
          if (emp?.cnpj_completo) cleanCnpj = emp.cnpj_completo.replace(/\D/g, '');
        } catch {
          // fallback
        }
      }
    }
    if (!cleanCnpj && req.user?.empresaCnpj) {
      cleanCnpj = req.user.empresaCnpj.replace(/\D/g, '');
    }

    if (!empresaId || !cleanCnpj) {
      res.status(400).json({ success: false, error: 'Empresa ativa ou CNPJ não identificado.' });
      return;
    }

    let syncResult;
    if (conector === 'unificado' || conector === 'todos' || !conector) {
      // Modo Topo de Linha: Varredura Automática Completa (ADN Nacional Matriz + Filiais + Prefeituras)
      syncResult = await sincronizarNfseUnificada({
        empresaId,
        tpAmb,
        incluirPrefeituras: true
      });
    } else if (conector === 'pmsp') {
      syncResult = await sincronizarNfsePMSP({
        empresaId,
        cnpj: cleanCnpj,
        tpAmb
      });
    } else {
      syncResult = await sincronizarNfseNacional({
        empresaId,
        cnpj: cleanCnpj,
        tpAmb,
        ultNSU
      });
    }

    res.json(syncResult);
  } catch (err: any) {
    console.error('❌ Erro na rota de sincronização de NFS-e:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/nfse/conectores
 * Lista todos os conectores municipais cadastrados no banco de dados.
 */
router.get('/conectores', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let rows: any[] = [];
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const { data, error } = await supabase
            .from('conectores_municipais')
            .select('*')
            .order('uf', { ascending: true })
            .order('municipio', { ascending: true });
          if (!error && data && data.length > 0) {
            rows = data;
          }
        }
      } catch (e: any) {
        console.warn('Aviso Supabase conectores:', e.message);
      }
    }

    if (rows.length === 0) {
      try {
        const db = getDatabase();
        rows = db.prepare(`
          SELECT 
            id,
            ibge,
            municipio,
            uf,
            provedor,
            tecnologia,
            endpoint_producao,
            endpoint_homologacao,
            tipo_autenticacao,
            token_api,
            usuario,
            status,
            created_at,
            updated_at
          FROM conectores_municipais
          ORDER BY uf ASC, municipio ASC
        `).all() as any[];
      } catch (e: any) {
        console.warn('Aviso SQLite conectores:', e.message);
      }
    }

    if (rows.length === 0) {
      rows = [
        { id: 'con-3550308', ibge: '3550308', municipio: 'São Paulo', uf: 'SP', provedor: 'PMSP (Nota do Milhão)', tecnologia: 'SOAP', endpoint_producao: 'https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx', endpoint_homologacao: 'https://nfehomologacao.prefeitura.sp.gov.br/ws/lotenfe.asmx', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3304557', ibge: '3304557', municipio: 'Rio de Janeiro', uf: 'RJ', provedor: 'Nota Carioca (ABRASF 1.0)', tecnologia: 'SOAP', endpoint_producao: 'https://notacarioca.rio.gov.br/WSNacional/nfse.asmx', endpoint_homologacao: 'https://homologacao.notacarioca.rio.gov.br/WSNacional/nfse.asmx', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3106200', ibge: '3106200', municipio: 'Belo Horizonte', uf: 'MG', provedor: 'BHISS (ABRASF 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://bhissdigitalws.pbh.gov.br/bhiss-ws/nfse', endpoint_homologacao: 'https://bhisshomologaws.pbh.gov.br/bhiss-ws/nfse', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-2611606', ibge: '2611606', municipio: 'Recife', uf: 'PE', provedor: 'Recife (ABRASF 1.1 / 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://nfse.recife.pe.gov.br/WS/nfse_v03.asmx', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-4314902', ibge: '4314902', municipio: 'Porto Alegre', uf: 'RS', provedor: 'NFSE POA (ABRASF 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://nfse.portoalegre.rs.gov.br/bhiss-ws/nfse', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-4106902', ibge: '4106902', municipio: 'Curitiba', uf: 'PR', provedor: 'Curitiba (ABRASF 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://isscuritiba.curitiba.pr.gov.br/Iss.NfseWebService/Nfsews.asmx', endpoint_homologacao: '', tipo_autenticacao: 'certificado_token', status: 'configuracao_pendente' },
        { id: 'con-1302603', ibge: '1302603', municipio: 'Manaus', uf: 'AM', provedor: 'Ábaco (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://nfse-prd.manaus.am.gov.br/nfse', endpoint_homologacao: 'https://nfsev-prd.manaus.am.gov.br/nfsev', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-2927408', ibge: '2927408', municipio: 'Salvador', uf: 'BA', provedor: 'Salvador (ABRASF 1.0)', tecnologia: 'SOAP', endpoint_producao: 'https://nfse.salvador.ba.gov.br/rps/service.asmx', endpoint_homologacao: '', tipo_autenticacao: 'token_api', status: 'configuracao_pendente' },
        { id: 'con-5300108', ibge: '5300108', municipio: 'Brasília', uf: 'DF', provedor: 'ISSNET (ABRASF 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://www.issnetonline.com.br/webservice/df/servicos.asmx', endpoint_homologacao: '', tipo_autenticacao: 'usuario_senha', status: 'configuracao_pendente' },
        { id: 'con-3136702', ibge: '3136702', municipio: 'Juiz de Fora', uf: 'MG', provedor: 'ISS-e JF (ABRASF 2.02)', tecnologia: 'SOAP', endpoint_producao: 'https://nfse.pjf.mg.gov.br:4431/WebService.asmx', endpoint_homologacao: 'https://nfse.homologacao.pjf.mg.gov.br:4432/WebService.asmx', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-2704302', ibge: '2704302', municipio: 'Maceió', uf: 'AL', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-1501402', ibge: '1501402', municipio: 'Belém', uf: 'PA', provedor: 'ISSONLINE (DSF)', tecnologia: 'SOAP', endpoint_producao: 'https://iss.belem.pa.gov.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-2111300', ibge: '2111300', municipio: 'São Luís', uf: 'MA', provedor: 'ISSONLINE (DSF)', tecnologia: 'SOAP', endpoint_producao: 'https://iss.saoluis.ma.gov.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-2211001', ibge: '2211001', municipio: 'Teresina', uf: 'PI', provedor: 'ISSONLINE (DSF)', tecnologia: 'SOAP', endpoint_producao: 'https://iss.teresina.pi.gov.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-5002704', ibge: '5002704', municipio: 'Campo Grande', uf: 'MS', provedor: 'ISSONLINE (DSF)', tecnologia: 'SOAP', endpoint_producao: 'https://issonline.pmcg.ms.gov.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-2800308', ibge: '2800308', municipio: 'Aracaju', uf: 'SE', provedor: 'WebISS', tecnologia: 'SOAP', endpoint_producao: 'https://aracaju.webiss.com.br/ws/nfse.asmx', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-1721000', ibge: '1721000', municipio: 'Palmas', uf: 'TO', provedor: 'WebISS', tecnologia: 'SOAP', endpoint_producao: 'https://palmas.webiss.com.br/ws/nfse.asmx', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-1200401', ibge: '1200401', municipio: 'Rio Branco', uf: 'AC', provedor: 'Ábaco (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://nota.riobranco.ac.gov.br', endpoint_homologacao: 'https://homologa.e-nfs.com.br/riobranco', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3518800', ibge: '3518800', municipio: 'Guarulhos', uf: 'SP', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3106705', ibge: '3106705', municipio: 'Betim', uf: 'MG', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3118601', ibge: '3118601', municipio: 'Contagem', uf: 'MG', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3548708', ibge: '3548708', municipio: 'São Bernardo do Campo', uf: 'SP', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3547809', ibge: '3547809', municipio: 'Santo André', uf: 'SP', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3513801', ibge: '3513801', municipio: 'Diadema', uf: 'SP', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3529400', ibge: '3529400', municipio: 'Mauá', uf: 'SP', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3548500', ibge: '3548500', municipio: 'Santos', uf: 'SP', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3525904', ibge: '3525904', municipio: 'Jundiaí', uf: 'SP', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3543402', ibge: '3543402', municipio: 'Ribeirão Preto', uf: 'SP', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3170701', ibge: '3170701', municipio: 'Varginha', uf: 'MG', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-2604106', ibge: '2604106', municipio: 'Caruaru', uf: 'PE', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-4118204', ibge: '4118204', municipio: 'Paranaguá', uf: 'PR', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-1500800', ibge: '1500800', municipio: 'Ananindeua', uf: 'PA', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3509502', ibge: '3509502', municipio: 'Campinas', uf: 'SP', provedor: 'ISSONLINE (DSF)', tecnologia: 'REST', endpoint_producao: 'https://issonline.campinas.sp.gov.br/ws/v1', endpoint_homologacao: '', tipo_autenticacao: 'token_api', status: 'configuracao_pendente' },
        { id: 'con-3303500', ibge: '3303500', municipio: 'Nova Iguaçu', uf: 'RJ', provedor: 'ISSONLINE (DSF)', tecnologia: 'SOAP', endpoint_producao: 'https://iss.novaiguacu.rj.gov.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3170206', ibge: '3170206', municipio: 'Uberlândia', uf: 'MG', provedor: 'ISSONLINE (DSF)', tecnologia: 'SOAP', endpoint_producao: 'https://udf.uberlandia.mg.gov.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3549904', ibge: '3549904', municipio: 'São José dos Campos', uf: 'SP', provedor: 'ISSONLINE (DSF)', tecnologia: 'SOAP', endpoint_producao: 'https://iss.sjc.sp.gov.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3552205', ibge: '3552205', municipio: 'Sorocaba', uf: 'SP', provedor: 'ISSONLINE (DSF)', tecnologia: 'SOAP', endpoint_producao: 'https://iss.sorocaba.sp.gov.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3301702', ibge: '3301702', municipio: 'Duque de Caxias', uf: 'RJ', provedor: 'SMARAPD / IPM', tecnologia: 'SOAP', endpoint_producao: 'https://nfse.duquedecaxias.rj.gov.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3536505', ibge: '3536505', municipio: 'Paulínia', uf: 'SP', provedor: 'SIGCORP (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://paulinia.sigcorp.com.br/ws/nfse.asmx', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-4304606', ibge: '4304606', municipio: 'Canoas', uf: 'RS', provedor: 'IPM Saúde e Gestão', tecnologia: 'SOAP', endpoint_producao: 'https://canoas.atende.net/ws', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-4101804', ibge: '4101804', municipio: 'Araucária', uf: 'PR', provedor: 'IPM Saúde e Gestão', tecnologia: 'SOAP', endpoint_producao: 'https://araucaria.atende.net/ws', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' }
      ];
    }

    const conectores = rows.map(r => ({
      id: r.id,
      ibge: r.ibge,
      municipio: r.municipio,
      uf: r.uf,
      provedor: r.provedor,
      tecnologia: r.tecnologia || 'SOAP',
      endpoint_producao: r.endpoint_producao || '',
      endpoint_homologacao: r.endpoint_homologacao || '',
      urlProducao: r.endpoint_producao || '',
      urlHomologacao: r.endpoint_homologacao || '',
      tipoAutenticacao: r.tipo_autenticacao || 'certificado_a1',
      token_api: r.token_api || '',
      usuario: r.usuario || '',
      status: r.status || 'ativo',
      credenciaisConfiguradas: !!(r.tipo_autenticacao === 'certificado_a1' || r.token_api || r.usuario)
    }));

    res.json({ success: true, conectores });
  } catch (err: any) {
    console.error('❌ Erro ao listar conectores municipais:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/nfse/conectores
 * Cadastra uma nova prefeitura / conector municipal.
 */
router.post('/conectores', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      ibge,
      municipio,
      uf,
      provedor,
      tecnologia = 'SOAP',
      endpoint_producao = '',
      endpoint_homologacao = '',
      tipo_autenticacao = 'certificado_a1',
      token_api = '',
      usuario = '',
      senha = '',
      status = 'ativo'
    } = req.body;

    if (!ibge || !municipio || !uf || !provedor) {
      res.status(400).json({ success: false, error: 'IBGE, Município, UF e Provedor são obrigatórios.' });
      return;
    }

    const cleanIbge = String(ibge).replace(/\D/g, '');
    if (cleanIbge.length !== 7) {
      res.status(400).json({ success: false, error: 'Código IBGE deve conter exatamente 7 dígitos numéricos.' });
      return;
    }

    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM conectores_municipais WHERE ibge = ?').get(cleanIbge) as any;
    if (existing) {
      res.status(409).json({ success: false, error: `Já existe um conector cadastrado para o código IBGE ${cleanIbge}.` });
      return;
    }

    const id = `con-${cleanIbge}-${crypto.randomUUID().substring(0, 8)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO conectores_municipais (
        id, ibge, municipio, uf, provedor, tecnologia,
        endpoint_producao, endpoint_homologacao,
        tipo_autenticacao, token_api, usuario, senha, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      cleanIbge,
      municipio.trim(),
      uf.toUpperCase().trim(),
      provedor.trim(),
      tecnologia,
      endpoint_producao.trim(),
      endpoint_homologacao.trim(),
      tipo_autenticacao,
      token_api.trim(),
      usuario.trim(),
      senha.trim(),
      status,
      now,
      now
    );

    res.status(201).json({
      success: true,
      message: 'Conector municipal cadastrado com sucesso.',
      conector: {
        id,
        ibge: cleanIbge,
        municipio,
        uf,
        provedor,
        tecnologia,
        endpoint_producao,
        endpoint_homologacao,
        tipoAutenticacao: tipo_autenticacao,
        status
      }
    });
  } catch (err: any) {
    console.error('❌ Erro ao cadastrar conector municipal:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/nfse/conectores/:id
 * Atualiza parâmetros, endpoints ou credenciais de um conector.
 */
router.put('/conectores/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      municipio,
      uf,
      provedor,
      tecnologia,
      endpoint_producao,
      endpoint_homologacao,
      tipo_autenticacao,
      token_api,
      usuario,
      senha,
      status
    } = req.body;

    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM conectores_municipais WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ success: false, error: 'Conector municipal não localizado.' });
      return;
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE conectores_municipais SET
        municipio = COALESCE(?, municipio),
        uf = COALESCE(?, uf),
        provedor = COALESCE(?, provedor),
        tecnologia = COALESCE(?, tecnologia),
        endpoint_producao = COALESCE(?, endpoint_producao),
        endpoint_homologacao = COALESCE(?, endpoint_homologacao),
        tipo_autenticacao = COALESCE(?, tipo_autenticacao),
        token_api = COALESCE(?, token_api),
        usuario = COALESCE(?, usuario),
        senha = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE senha END,
        status = COALESCE(?, status),
        updated_at = ?
      WHERE id = ?
    `).run(
      municipio ?? null,
      uf ?? null,
      provedor ?? null,
      tecnologia ?? null,
      endpoint_producao ?? null,
      endpoint_homologacao ?? null,
      tipo_autenticacao ?? null,
      token_api ?? null,
      usuario ?? null,
      senha ?? null,
      senha ?? null,
      senha ?? null,
      status ?? null,
      now,
      id
    );

    res.json({ success: true, message: 'Conector municipal atualizado com sucesso.' });
  } catch (err: any) {
    console.error('❌ Erro ao atualizar conector municipal:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/nfse/conectores/:id
 * Remove um conector municipal.
 */
router.delete('/conectores/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const result = db.prepare('DELETE FROM conectores_municipais WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ success: false, error: 'Conector não encontrado para exclusão.' });
      return;
    }
    res.json({ success: true, message: 'Conector municipal excluído com sucesso.' });
  } catch (err: any) {
    console.error('❌ Erro ao excluir conector municipal:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/nfse/danfse/:chave
 * Faz o download do DANFSe (PDF) oficial gerado pelo Ambiente de Dados Nacional (ADN).
 */
router.get('/danfse/:chave', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chave } = req.params;
    const activeEmpresaId = req.user?.empresaAtivaId;
    const empresaId = (req.query.empresaId as string) || activeEmpresaId;
    let cleanCnpj = (req.query.cnpj as string) || (req.user?.empresaCnpj ? req.user.empresaCnpj.replace(/\D/g, '') : '');

    if (!empresaId || !cleanCnpj) {
      res.status(400).json({ success: false, error: 'Empresa e CNPJ obrigatórios para emissão do DANFSe.' });
      return;
    }

    const pdfBuffer = await obterDanfseNacionalPdf(chave, empresaId, cleanCnpj);
    if (!pdfBuffer) {
      res.status(404).json({ success: false, error: 'DANFSe em PDF não retornado pelo ADN para esta chave.' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="DANFSE-${chave}.pdf"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    console.error('❌ Erro ao baixar DANFSe do ADN:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
