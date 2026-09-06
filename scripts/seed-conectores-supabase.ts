import { getSupabaseAdmin } from '../server/db/supabase';

const CONECTORES_SEEDS = [
  // Capitais e Grandes Metrópoles
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
  { id: 'con-4118204', ibge: '4118204', municipio: 'Paranaguá', uf: 'PR', provedor: 'GINFES (ABRASF)', tecnologia: 'SOAP', endpoint_producao: 'https://producao.ginfes.com.br/ServiceGinfesImpl', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' },
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
  { id: 'con-4101804', ibge: '4101804', municipio: 'Araucária', uf: 'PR', provedor: 'IPM Saúde e Gestão', tecnologia: 'SOAP', endpoint_producao: 'https://araucaria.atende.net/ws', endpoint_homologacao: '', tipo_autenticacao: 'certificado_a1', status: 'ativo' }
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
