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
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';
import { sincronizarNfseNacional, sincronizarNfseUnificada, sincronizarPrefeituraIndividual, sincronizarNfsePMSP, obterStatusNfse, obterDanfseNacionalPdf } from '../services/nfseService';

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
        if (supabase) {
          const { data: emp } = await supabase.from('empresas').select('cnpj_completo').eq('id', empresaId).maybeSingle();
          if (emp?.cnpj_completo) cleanCnpj = emp.cnpj_completo.replace(/\D/g, '');
        }
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
        if (supabase) {
          const { data: emp } = await supabase.from('empresas').select('cnpj_completo').eq('id', empresaId).maybeSingle();
          if (emp?.cnpj_completo) cleanCnpj = emp.cnpj_completo.replace(/\D/g, '');
        }
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
    if (conector === 'individual' || conector === 'municipal_individual' || (req.body.municipioIbge && conector !== 'unificado')) {
      const targetIbge = req.body.municipioIbge || req.body.ibge || conector;
      syncResult = await sincronizarPrefeituraIndividual({
        empresaId,
        cnpj: cleanCnpj,
        ibge: targetIbge,
        tpAmb,
        dataInicio: req.body.dataInicio,
        dataFim: req.body.dataFim
      });
    } else if (conector === 'unificado' || conector === 'todos' || !conector) {
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
        { id: 'con-5300108', ibge: '5300108', municipio: 'Brasília', uf: 'DF', provedor: 'ISSNET (ABRASF 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://df.issnetonline.com.br/webservicenfse204/nfse.asmx', endpoint_homologacao: 'https://nfse.issnetonline.com.br/wsnfsenacional/homologacao/nfse.asmx', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
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
        { id: 'con-4101804', ibge: '4101804', municipio: 'Araucária', uf: 'PR', provedor: 'IPM Saúde e Gestão', tecnologia: 'SOAP', endpoint_producao: 'https://araucaria.atende.net/ws', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-4202404', ibge: '4202404', municipio: 'Blumenau', uf: 'SC', provedor: 'Simpliss (NFS-e Nacional/DPS)', tecnologia: 'REST', endpoint_producao: 'https://blumenau.simplissweb.com.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3538709', ibge: '3538709', municipio: 'Piracicaba', uf: 'SP', provedor: 'Simpliss', tecnologia: 'SOAP', endpoint_producao: 'https://piracicaba.simplissweb.com.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3547304', ibge: '3547304', municipio: 'Santana de Parnaíba', uf: 'SP', provedor: 'Simpliss', tecnologia: 'SOAP', endpoint_producao: 'https://santanadeparnaiba.simplissweb.com.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3170107', ibge: '3170107', municipio: 'Uberaba', uf: 'MG', provedor: 'WebISS', tecnologia: 'SOAP', endpoint_producao: 'https://uberabamg.webiss.com.br/ws/nfse.asmx', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3501608', ibge: '3501608', municipio: 'Americana', uf: 'SP', provedor: 'Tiplan (ABRASF 2.03)', tecnologia: 'SOAP', endpoint_producao: 'https://nfse.americana.sp.gov.br/nfse/wsnacional2/nfse.asmx', endpoint_homologacao: 'https://americanahomologacao.nfe.com.br/nfse/wsnacional2/nfse.asmx', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3549805', ibge: '3549805', municipio: 'São José do Rio Preto', uf: 'SP', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-2914906', ibge: '2914906', municipio: 'Itacaré', uf: 'BA', provedor: 'WebISS', tecnologia: 'SOAP', endpoint_producao: 'https://itacareba.webiss.com.br/ws/nfse.asmx', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-1702109', ibge: '1702109', municipio: 'Araguatins', uf: 'TO', provedor: 'WebISS', tecnologia: 'SOAP', endpoint_producao: 'https://araguatinsto.webiss.com.br/ws/nfse.asmx', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-2607901', ibge: '2607901', municipio: 'Jaboatão dos Guararapes', uf: 'PE', provedor: 'Tinus (ABRASF 1.0)', tecnologia: 'SOAP', endpoint_producao: 'https://www.tinus.com.br/csp/JABOATAO/portal/index.csp', endpoint_homologacao: 'http://www2.tinus.com.br/csp/testejab/WSNFSE.RecepcionarLoteRps.CLS?WSDL=1', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-2602902', ibge: '2602902', municipio: 'Cabo de Santo Agostinho', uf: 'PE', provedor: 'Tinus (ABRASF 1.0)', tecnologia: 'SOAP', endpoint_producao: 'https://www.tinus.com.br/csp/cabo/portal/index.csp', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-2603454', ibge: '2603454', municipio: 'Camaragibe', uf: 'PE', provedor: 'Tinus (ABRASF 1.0)', tecnologia: 'SOAP', endpoint_producao: 'https://www.tinus.com.br/csp/CAMARAGIBE/portal/index.csp', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-2606200', ibge: '2606200', municipio: 'Goiana', uf: 'PE', provedor: 'Tinus (ABRASF 1.0)', tecnologia: 'SOAP', endpoint_producao: 'https://www.tinus.com.br/csp/GOIANA/portal/index.csp', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-2503209', ibge: '2503209', municipio: 'Cabedelo', uf: 'PB', provedor: 'Tinus (ABRASF 1.0)', tecnologia: 'SOAP', endpoint_producao: 'https://www.tinus.com.br/csp/cabedelo/portal/index.csp', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-4104808', ibge: '4104808', municipio: 'Cascavel', uf: 'PR', provedor: 'IPM (AtendeNet)', tecnologia: 'REST', endpoint_producao: 'https://ws-cascavel.atende.net:7443/?pg=rest&service=WNERestServiceNFSe', endpoint_homologacao: '', tipo_autenticacao: 'usuario_senha', status: 'ativo' },
        { id: 'con-4211900', ibge: '4211900', municipio: 'Palhoça', uf: 'SC', provedor: 'IPM (AtendeNet)', tecnologia: 'REST', endpoint_producao: 'https://palhoca.atende.net/?pg=rest&service=WNERestServiceNFSe', endpoint_homologacao: '', tipo_autenticacao: 'usuario_senha', status: 'ativo' },
        { id: 'con-4105508', ibge: '4105508', municipio: 'Colombo', uf: 'PR', provedor: 'IPM (AtendeNet)', tecnologia: 'REST', endpoint_producao: 'https://ws-colombo.atende.net:7443/?pg=rest&service=WNERestServiceNFSe', endpoint_homologacao: '', tipo_autenticacao: 'usuario_senha', status: 'ativo' },
        { id: 'con-4212650', ibge: '4212650', municipio: 'Porto Belo', uf: 'SC', provedor: 'IPM (AtendeNet)', tecnologia: 'REST', endpoint_producao: 'https://portobelo.atende.net/?pg=rest&service=WNERestServiceNFSe', endpoint_homologacao: '', tipo_autenticacao: 'usuario_senha', status: 'ativo' },
        { id: 'con-4303103', ibge: '4303103', municipio: 'Cachoeirinha', uf: 'RS', provedor: 'IPM (AtendeNet 2.0)', tecnologia: 'REST', endpoint_producao: 'https://cachoeirinha.atende.net/atende.php?pg=rest&service=WNERestServiceNFSe&cidade=padrao', endpoint_homologacao: 'https://cachoeirinha.atende.net/atende.php?pg=rest&service=WNERestServiceNFSe&cidade=padrao', tipo_autenticacao: 'usuario_senha', status: 'ativo' },
        { id: 'con-4202008', ibge: '4202008', municipio: 'Biguaçu', uf: 'SC', provedor: 'IPM (AtendeNet)', tecnologia: 'SOAP', endpoint_producao: 'https://bigua.atende.net/?pg=services&service=WNENotaFiscalEletronicaNfe&wsdl', endpoint_homologacao: '', tipo_autenticacao: 'usuario_senha', status: 'ativo' },
        { id: 'con-5103403', ibge: '5103403', municipio: 'Cuiabá', uf: 'MT', provedor: 'IssNet (ABRASF 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://wscuiaba.issnetonline.com.br/webservicenfse204/nfse.asmx', endpoint_homologacao: 'https://www.issnetonline.com.br/homologaabrasf/webservicenfse204/nfse.asmx', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-2611101', ibge: '2611101', municipio: 'Petrolina', uf: 'PE', provedor: 'E&L (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://pe-petrolina-pm-nfs-backend.cloud.el.com.br/nfse/NfseWSService?wsdl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3201209', ibge: '3201209', municipio: 'Cachoeiro de Itapemirim', uf: 'ES', provedor: 'E&L (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'http://notafse.cachoeiro.es.gov.br:8189/paginas/sistema/autenticacao.jsf', endpoint_homologacao: 'http://nfsehomologacao.cachoeiro.es.gov.br:8188/nfse-cachoeirodeitapemirim-es/paginas/sistema/autenticacao.jsf', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3202207', ibge: '3202207', municipio: 'Fundão', uf: 'ES', provedor: 'E&L (ABRASF 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://es-fundao-pm-nfs.cloud.el.com.br/', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
        { id: 'con-3303401', ibge: '3303401', municipio: 'Nova Friburgo', uf: 'RJ', provedor: 'E&L (ABRASF 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://rj-novafriburgo-pm-nfs.cloud.el.com.br/paginas/sistema/login.jsf', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' }
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

    const id = `con-${cleanIbge}`;
    const now = new Date().toISOString();
    const conectorRecord = {
      id,
      ibge: cleanIbge,
      municipio: municipio.trim(),
      uf: uf.toUpperCase().trim(),
      provedor: provedor.trim(),
      tecnologia: tecnologia || 'SOAP',
      endpoint_producao: (endpoint_producao || '').trim(),
      endpoint_homologacao: (endpoint_homologacao || '').trim(),
      tipo_autenticacao: tipo_autenticacao || 'certificado_a1',
      token_api: (token_api || '').trim(),
      usuario: (usuario || '').trim(),
      senha: (senha || '').trim(),
      status: status || 'ativo',
      created_at: now,
      updated_at: now
    };

    // 1. Supabase (Primário)
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const { data: existingSupa } = await supabase
            .from('conectores_municipais')
            .select('id')
            .eq('ibge', cleanIbge)
            .maybeSingle();

          if (existingSupa) {
            res.status(409).json({ success: false, error: `Já existe um conector cadastrado para o código IBGE ${cleanIbge}.` });
            return;
          }

          const { error: supaErr } = await supabase
            .from('conectores_municipais')
            .insert([conectorRecord]);

          if (supaErr) {
            console.error('❌ Falha ao salvar conector no Supabase:', supaErr);
            throw new Error(`Erro Supabase: ${supaErr.message}`);
          }
        }
      } catch (err: any) {
        if (err.message?.includes('409') || err.message?.includes('Já existe')) {
          res.status(409).json({ success: false, error: err.message });
          return;
        }
        console.warn('Aviso Supabase conectores POST:', err.message);
      }
    }

    // 2. SQLite (Local / Fallback)
    try {
      const db = getDatabase();
      const existingSqlite = db.prepare('SELECT id FROM conectores_municipais WHERE ibge = ? OR id = ?').get(cleanIbge, id) as any;
      if (existingSqlite) {
        if (!isSupabaseConfigured()) {
          res.status(409).json({ success: false, error: `Já existe um conector cadastrado para o código IBGE ${cleanIbge}.` });
          return;
        }
      } else {
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
          conectorRecord.municipio,
          conectorRecord.uf,
          conectorRecord.provedor,
          conectorRecord.tecnologia,
          conectorRecord.endpoint_producao,
          conectorRecord.endpoint_homologacao,
          conectorRecord.tipo_autenticacao,
          conectorRecord.token_api,
          conectorRecord.usuario,
          conectorRecord.senha,
          conectorRecord.status,
          now,
          now
        );
      }
    } catch (dbErr: any) {
      console.warn('Aviso SQLite conectores POST:', dbErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Conector municipal cadastrado com sucesso.',
      conector: conectorRecord
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

    const now = new Date().toISOString();
    let updatedInSupabase = false;

    // 1. Atualizar no Supabase
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const updatePayload: any = { updated_at: now };
          if (municipio !== undefined) updatePayload.municipio = municipio.trim();
          if (uf !== undefined) updatePayload.uf = uf.toUpperCase().trim();
          if (provedor !== undefined) updatePayload.provedor = provedor.trim();
          if (tecnologia !== undefined) updatePayload.tecnologia = tecnologia;
          if (endpoint_producao !== undefined) updatePayload.endpoint_producao = endpoint_producao.trim();
          if (endpoint_homologacao !== undefined) updatePayload.endpoint_homologacao = endpoint_homologacao.trim();
          if (tipo_autenticacao !== undefined) updatePayload.tipo_autenticacao = tipo_autenticacao;
          if (token_api !== undefined) updatePayload.token_api = token_api.trim();
          if (usuario !== undefined) updatePayload.usuario = usuario.trim();
          if (senha !== undefined && senha !== '') updatePayload.senha = senha.trim();
          if (status !== undefined) updatePayload.status = status;

          const { error: supaErr } = await supabase
            .from('conectores_municipais')
            .update(updatePayload)
            .or(`id.eq.${id},ibge.eq.${id}`);

          if (!supaErr) {
            updatedInSupabase = true;
          } else {
            console.warn('Aviso Supabase conectores PUT:', supaErr.message);
          }
        }
      } catch (err: any) {
        console.warn('Erro ao atualizar conector no Supabase:', err.message);
      }
    }

    // 2. Atualizar no SQLite
    try {
      const db = getDatabase();
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
        WHERE id = ? OR ibge = ?
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
        id,
        id
      );
    } catch (dbErr: any) {
      console.warn('Aviso SQLite conectores PUT:', dbErr.message);
    }

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

    // 1. Remover do Supabase
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          await supabase
            .from('conectores_municipais')
            .delete()
            .or(`id.eq.${id},ibge.eq.${id}`);
        }
      } catch (err: any) {
        console.warn('Aviso Supabase conectores DELETE:', err.message);
      }
    }

    // 2. Remover do SQLite
    try {
      const db = getDatabase();
      db.prepare('DELETE FROM conectores_municipais WHERE id = ? OR ibge = ?').run(id, id);
    } catch (dbErr: any) {
      console.warn('Aviso SQLite conectores DELETE:', dbErr.message);
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
