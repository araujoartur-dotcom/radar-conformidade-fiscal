import { getSupabaseAdmin } from '../server/db/supabase';

export const CONECTORES_SEEDS = [
  // Capitais e Grandes Metrópoles
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

  // Rede GINFES: Polos Industriais e Logísticos
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
  { id: 'con-4118204', ibge: '4118204', municipio: 'Paranaguá', uf: 'PR', provedor: 'IPM (AtendeNet)', tecnologia: 'REST', endpoint_producao: 'https://ws-paranagua.atende.net:7443/?pg=rest&service=WNERestServiceNFSe', endpoint_homologacao: '', tipo_autenticacao: 'usuario_senha', status: 'ativo' },
  { id: 'con-1500800', ibge: '1500800', municipio: 'Ananindeua', uf: 'PA', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },

  // Rede DSF: Grandes Cidades e Polos Econômicos
  { id: 'con-3509502', ibge: '3509502', municipio: 'Campinas', uf: 'SP', provedor: 'ISSONLINE (DSF)', tecnologia: 'REST', endpoint_producao: 'https://issonline.campinas.sp.gov.br/ws/v1', endpoint_homologacao: '', tipo_autenticacao: 'token_api', status: 'configuracao_pendente' },
  { id: 'con-3303500', ibge: '3303500', municipio: 'Nova Iguaçu', uf: 'RJ', provedor: 'ISSONLINE (DSF)', tecnologia: 'SOAP', endpoint_producao: 'https://iss.novaiguacu.rj.gov.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3170206', ibge: '3170206', municipio: 'Uberlândia', uf: 'MG', provedor: 'ISSONLINE (DSF)', tecnologia: 'SOAP', endpoint_producao: 'https://udf.uberlandia.mg.gov.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3549904', ibge: '3549904', municipio: 'São José dos Campos', uf: 'SP', provedor: 'ISSONLINE (DSF)', tecnologia: 'SOAP', endpoint_producao: 'https://iss.sjc.sp.gov.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3552205', ibge: '3552205', municipio: 'Sorocaba', uf: 'SP', provedor: 'ISSONLINE (DSF)', tecnologia: 'SOAP', endpoint_producao: 'https://iss.sorocaba.sp.gov.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },

  // Polos de Refinarias e Terminais Operacionais de Petróleo e Gás
  { id: 'con-3301702', ibge: '3301702', municipio: 'Duque de Caxias', uf: 'RJ', provedor: 'SMARAPD / IPM', tecnologia: 'SOAP', endpoint_producao: 'https://nfse.duquedecaxias.rj.gov.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3536505', ibge: '3536505', municipio: 'Paulínia', uf: 'SP', provedor: 'SIGCORP (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://paulinia.sigcorp.com.br/ws/nfse.asmx', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-4304606', ibge: '4304606', municipio: 'Canoas', uf: 'RS', provedor: 'IPM Saúde e Gestão', tecnologia: 'SOAP', endpoint_producao: 'https://canoas.atende.net/ws', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-4101804', ibge: '4101804', municipio: 'Araucária', uf: 'PR', provedor: 'IPM Saúde e Gestão', tecnologia: 'SOAP', endpoint_producao: 'https://araucaria.atende.net/ws', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },

  // Rodada 2 de Investigação: Simpliss, Tiplan, WebISS e GINFES Confirmados
  { id: 'con-4202404', ibge: '4202404', municipio: 'Blumenau', uf: 'SC', provedor: 'Simpliss (NFS-e Nacional/DPS)', tecnologia: 'REST', endpoint_producao: 'https://blumenau.simplissweb.com.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3538709', ibge: '3538709', municipio: 'Piracicaba', uf: 'SP', provedor: 'Simpliss', tecnologia: 'SOAP', endpoint_producao: 'https://piracicaba.simplissweb.com.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3547304', ibge: '3547304', municipio: 'Santana de Parnaíba', uf: 'SP', provedor: 'Simpliss', tecnologia: 'SOAP', endpoint_producao: 'https://santanadeparnaiba.simplissweb.com.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3170107', ibge: '3170107', municipio: 'Uberaba', uf: 'MG', provedor: 'WebISS', tecnologia: 'SOAP', endpoint_producao: 'https://uberabamg.webiss.com.br/ws/nfse.asmx', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3501608', ibge: '3501608', municipio: 'Americana', uf: 'SP', provedor: 'Tiplan (ABRASF 2.03)', tecnologia: 'SOAP', endpoint_producao: 'https://nfse.americana.sp.gov.br/nfse/wsnacional2/nfse.asmx', endpoint_homologacao: 'https://americanahomologacao.nfe.com.br/nfse/wsnacional2/nfse.asmx', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3549805', ibge: '3549805', municipio: 'São José do Rio Preto', uf: 'SP', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-2914906', ibge: '2914906', municipio: 'Itacaré', uf: 'BA', provedor: 'WebISS', tecnologia: 'SOAP', endpoint_producao: 'https://itacareba.webiss.com.br/ws/nfse.asmx', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-1702109', ibge: '1702109', municipio: 'Araguatins', uf: 'TO', provedor: 'WebISS', tecnologia: 'SOAP', endpoint_producao: 'https://araguatinsto.webiss.com.br/ws/nfse.asmx', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },

  // Cluster Tinus (PE / PB) — Grande Recife, Suape e Litoral PB
  { id: 'con-2607901', ibge: '2607901', municipio: 'Jaboatão dos Guararapes', uf: 'PE', provedor: 'Tinus (ABRASF 1.0)', tecnologia: 'SOAP', endpoint_producao: 'https://www.tinus.com.br/csp/JABOATAO/portal/index.csp', endpoint_homologacao: 'http://www2.tinus.com.br/csp/testejab/WSNFSE.RecepcionarLoteRps.CLS?WSDL=1', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-2602902', ibge: '2602902', municipio: 'Cabo de Santo Agostinho', uf: 'PE', provedor: 'Tinus (ABRASF 1.0)', tecnologia: 'SOAP', endpoint_producao: 'https://www.tinus.com.br/csp/cabo/portal/index.csp', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-2603454', ibge: '2603454', municipio: 'Camaragibe', uf: 'PE', provedor: 'Tinus (ABRASF 1.0)', tecnologia: 'SOAP', endpoint_producao: 'https://www.tinus.com.br/csp/CAMARAGIBE/portal/index.csp', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-2606200', ibge: '2606200', municipio: 'Goiana', uf: 'PE', provedor: 'Tinus (ABRASF 1.0)', tecnologia: 'SOAP', endpoint_producao: 'https://www.tinus.com.br/csp/GOIANA/portal/index.csp', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-2503209', ibge: '2503209', municipio: 'Cabedelo', uf: 'PB', provedor: 'Tinus (ABRASF 1.0)', tecnologia: 'SOAP', endpoint_producao: 'https://www.tinus.com.br/csp/cabedelo/portal/index.csp', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },

  // Cluster IPM / AtendeNet (SC / PR / RS) — Polos Industriais e Metropolitanos
  { id: 'con-4104808', ibge: '4104808', municipio: 'Cascavel', uf: 'PR', provedor: 'IPM (AtendeNet)', tecnologia: 'REST', endpoint_producao: 'https://ws-cascavel.atende.net:7443/?pg=rest&service=WNERestServiceNFSe', endpoint_homologacao: '', tipo_autenticacao: 'usuario_senha', status: 'ativo' },
  { id: 'con-4211900', ibge: '4211900', municipio: 'Palhoça', uf: 'SC', provedor: 'IPM (AtendeNet)', tecnologia: 'REST', endpoint_producao: 'https://palhoca.atende.net/?pg=rest&service=WNERestServiceNFSe', endpoint_homologacao: '', tipo_autenticacao: 'usuario_senha', status: 'ativo' },
  { id: 'con-4105508', ibge: '4105508', municipio: 'Colombo', uf: 'PR', provedor: 'IPM (AtendeNet)', tecnologia: 'REST', endpoint_producao: 'https://ws-colombo.atende.net:7443/?pg=rest&service=WNERestServiceNFSe', endpoint_homologacao: '', tipo_autenticacao: 'usuario_senha', status: 'ativo' },
  { id: 'con-4212650', ibge: '4212650', municipio: 'Porto Belo', uf: 'SC', provedor: 'IPM (AtendeNet)', tecnologia: 'REST', endpoint_producao: 'https://portobelo.atende.net/?pg=rest&service=WNERestServiceNFSe', endpoint_homologacao: '', tipo_autenticacao: 'usuario_senha', status: 'ativo' },
  { id: 'con-4303103', ibge: '4303103', municipio: 'Cachoeirinha', uf: 'RS', provedor: 'IPM (AtendeNet 2.0)', tecnologia: 'REST', endpoint_producao: 'https://cachoeirinha.atende.net/atende.php?pg=rest&service=WNERestServiceNFSe&cidade=padrao', endpoint_homologacao: 'https://cachoeirinha.atende.net/atende.php?pg=rest&service=WNERestServiceNFSe&cidade=padrao', tipo_autenticacao: 'usuario_senha', status: 'ativo' },
  { id: 'con-4202008', ibge: '4202008', municipio: 'Biguaçu', uf: 'SC', provedor: 'IPM (AtendeNet)', tecnologia: 'SOAP', endpoint_producao: 'https://bigua.atende.net/?pg=services&service=WNENotaFiscalEletronicaNfe&wsdl', endpoint_homologacao: '', tipo_autenticacao: 'usuario_senha', status: 'ativo' },

  // Cluster IssNet e E&L (MT / ES / RJ / PE) — Capitais e Polos de Mineração/Agro
  { id: 'con-5103403', ibge: '5103403', municipio: 'Cuiabá', uf: 'MT', provedor: 'IssNet (ABRASF 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://wscuiaba.issnetonline.com.br/webservicenfse204/nfse.asmx', endpoint_homologacao: 'https://www.issnetonline.com.br/homologaabrasf/webservicenfse204/nfse.asmx', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-2611101', ibge: '2611101', municipio: 'Petrolina', uf: 'PE', provedor: 'E&L (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://pe-petrolina-pm-nfs-backend.cloud.el.com.br/nfse/NfseWSService?wsdl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3201209', ibge: '3201209', municipio: 'Cachoeiro de Itapemirim', uf: 'ES', provedor: 'E&L (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'http://notafse.cachoeiro.es.gov.br:8189/paginas/sistema/autenticacao.jsf', endpoint_homologacao: 'http://nfsehomologacao.cachoeiro.es.gov.br:8188/nfse-cachoeirodeitapemirim-es/paginas/sistema/autenticacao.jsf', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3202207', ibge: '3202207', municipio: 'Fundão', uf: 'ES', provedor: 'E&L (ABRASF 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://es-fundao-pm-nfs.cloud.el.com.br/', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3303401', ibge: '3303401', municipio: 'Nova Friburgo', uf: 'RJ', provedor: 'E&L (ABRASF 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://rj-novafriburgo-pm-nfs.cloud.el.com.br/paginas/sistema/login.jsf', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },

  // Cluster Futurize (MG) — Polos Regionais Mineiros
  { id: 'con-3101201', ibge: '3101201', municipio: 'Aiuruoca', uf: 'MG', provedor: 'Futurize (ABRASF 2.02)', tecnologia: 'SOAP', endpoint_producao: 'https://aiuruocamg.nfse-futurize.com.br/webservice/prod', endpoint_homologacao: 'https://aiuruocamg.nfse-futurize.com.br/webservice/homo', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3140803', ibge: '3140803', municipio: 'Matias Barbosa', uf: 'MG', provedor: 'Futurize (ABRASF 2.02)', tecnologia: 'SOAP', endpoint_producao: 'https://matiasbarbosamg.nfse-futurize.com.br/webservice/prod', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3117405', ibge: '3117405', municipio: 'Conceição de Ipanema', uf: 'MG', provedor: 'Futurize (ABRASF 2.02)', tecnologia: 'SOAP', endpoint_producao: 'https://conceicaodeipanemamg.nfse-futurize.com.br/webservice/prod', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3148301', ibge: '3148301', municipio: 'Paula Cândido', uf: 'MG', provedor: 'Futurize (ABRASF 2.02)', tecnologia: 'SOAP', endpoint_producao: 'https://paulacandidomg.nfse-futurize.com.br/webservice/prod', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },

  // Cluster eReceita (MG) — Sul de Minas e Zona da Mata
  { id: 'con-3139003', ibge: '3139003', municipio: 'Machado', uf: 'MG', provedor: 'eReceita (ABRASF 2.03)', tecnologia: 'SOAP', endpoint_producao: 'https://machado.ereceita.net.br', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3163805', ibge: '3163805', municipio: 'São Miguel do Anta', uf: 'MG', provedor: 'eReceita (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://webservice.ereceita.net.br/ws/saomigueldoantamg/wsProducao.php', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },

  // Cluster SigISS / meumunicipio.online (MG / SP / SC) — Grandes Polos Industriais e Agropecuários
  { id: 'con-3131307', ibge: '3131307', municipio: 'Ipatinga', uf: 'MG', provedor: 'SigISS (ABRASF 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://abrasfipatinga.meumunicipio.online/ws/servico.asmx', endpoint_homologacao: 'https://testeipatinga.meumunicipio.online/ISS/', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3530805', ibge: '3530805', municipio: 'Mogi Mirim', uf: 'SP', provedor: 'SigISS (ABRASF 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://mogimirim.meumunicipio.online/abrasf/ws/nfs?wsdl', endpoint_homologacao: 'https://testemogimirim.meumunicipio.online/abrasf/ws/nfs?wsdl', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3152501', ibge: '3152501', municipio: 'Pouso Alegre', uf: 'MG', provedor: 'SigISS (ABRASF 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://abrasfpousoalegre.meumunicipio.online/ws/nfs?wsdl', endpoint_homologacao: 'https://testepousoalegre.meumunicipio.online/abrasf/ws/nfs?wsdl', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-4204202', ibge: '4204202', municipio: 'Chapecó', uf: 'SC', provedor: 'SigISS (ABRASF 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://chapeco.meumunicipio.online/abrasf/ws/nfs?wsdl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
  { id: 'con-3554102', ibge: '3554102', municipio: 'Taubaté', uf: 'SP', provedor: 'SigISS (ABRASF 2.04)', tecnologia: 'SOAP', endpoint_producao: 'https://taubate.meumunicipio.online/abrasf/ws?wsdl', endpoint_homologacao: 'https://testetaubate.meumunicipio.online/abrasf/ws?wsdl', tipo_autenticacao: 'certificado_a1', status: 'ativo' },

  // GINFES / GissOnline (MG) — Polo Têxtil Zona da Mata
  { id: 'con-3143906', ibge: '3143906', municipio: 'Muriaé', uf: 'MG', provedor: 'GINFES (ABRASF 1.0)', tecnologia: 'SOAP', endpoint_producao: 'https://muriae.giss.com.br/portal/home#/login-portal', endpoint_homologacao: 'http://muriae.ginfesh.com.br/', tipo_autenticacao: 'certificado_a1', status: 'ativo' }
];

async function seed() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error('Supabase admin não configurado');
    return;
  }

  console.log(`Populando ${CONECTORES_SEEDS.length} conectores municipais no Supabase...`);
  const { data, error } = await supabase
    .from('conectores_municipais')
    .upsert(CONECTORES_SEEDS, { onConflict: 'ibge' })
    .select();

  if (error) {
    console.error('❌ Erro no upsert Supabase:', error);
  } else {
    console.log(`✅ Sucesso! ${data?.length || CONECTORES_SEEDS.length} conectores populados no Supabase.`);
  }
}

seed();
