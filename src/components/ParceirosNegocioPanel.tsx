import React, { useState, useEffect } from 'react';
import {
  Users, Building2, ShieldCheck, Key, FileCheck, Layers, Plus, Search,
  CheckCircle2, AlertTriangle, Lock, RefreshCw, Upload, Sparkles, Filter,
  Trash2, ArrowUpRight, Database, FolderCheck, Check, Edit3, Eye, EyeOff,
  FileSpreadsheet, Sliders, ShieldAlert, FileCode, Send, HelpCircle,
  ExternalLink, Calculator, Landmark, MapPin, Receipt, ArrowRight, Download
} from 'lucide-react';
import {
  ParceiroNegocio, TipoPessoaParceiro, PapelParceiro, RegimeTributarioParceiro,
  EsferaPublica, SegmentoMercadologico, SimulacaoFiscalParceiro
} from '../types';
import { useApi } from '../hooks/useApi';

export const ParceirosNegocioPanel: React.FC = () => {
  const { get, post, put, del } = useApi();

  // Estados principais
  const [partners, setPartners] = useState<ParceiroNegocio[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPapel, setFilterPapel] = useState<string>('todos');
  const [filterRegime, setFilterRegime] = useState<string>('todos');
  const [filterSegmento, setFilterSegmento] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Modais
  const [showModal, setShowModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<ParceiroNegocio | null>(null);
  const [activeTab, setActiveTab] = useState<'identificacao' | 'fiscal' | 'retencoes' | 'endereco' | 'contabil' | 'sped_simulador'>('identificacao');
  const [simulacaoResult, setSimulacaoResult] = useState<SimulacaoFiscalParceiro | null>(null);
  const [simulacaoTipoOp, setSimulacaoTipoOp] = useState<'venda_mercadoria' | 'compra_insumo' | 'prestacao_servico'>('venda_mercadoria');
  const [simulacaoUfDestino, setSimulacaoUfDestino] = useState('RJ');

  // Estado do Formulário
  const [formData, setFormData] = useState<Partial<ParceiroNegocio>>({
    tipoPessoa: 'PJ',
    papel: 'fornecedor',
    cpfCnpj: '',
    razaoSocial: '',
    nomeFantasia: '',
    naturezaJuridica: '2062', // Sociedade Empresária Limitada
    regimeTributario: '04', // Lucro Real
    esferaPublica: 'NA',
    segmento: 'IND',
    cnaePrincipal: '2511000',
    cnaesSecundarios: [],
    statusCadastro: 'A',
    endereco: {
      cep: '01310100',
      logradouro: 'Avenida Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      codMunicipioIbge: '3550308',
      municipio: 'São Paulo',
      uf: 'SP',
      codPaisBacen: '1058',
      nomePais: 'Brasil'
    },
    fiscal: {
      inscricaoEstadual: '',
      indIeDestinatario: '1',
      inscricaoMunicipal: '',
      indContribuinteIpi: false,
      indSubstitutoTrib: false,
      indProdutorRural: false,
      indCooperativa: false,
      indOptanteSimples: false,
      aliquotaIcmsSimples: 0
    },
    retencoes: {
      retemIrrf: true,
      aliquotaIrrf: 1.5,
      codigoReceitaIrrf: '1708',
      retemCrf: true,
      aliquotaCrf: 4.65,
      retemInss: false,
      aliquotaInss: 11,
      indicadorCprb: false,
      retemIss: false,
      aliquotaIss: 5
    },
    contabil: {
      contaContabilFornecedor: '2.01.01.01.0001',
      centroCustoDefault: 'CC_GERAL',
      condicaoPagamentoDias: 30,
      limiteCredito: 100000,
      dadosBancarios: {
        bancoCodigo: '001',
        bancoNome: 'Banco do Brasil',
        agencia: '1234-5',
        contaCorrente: '98765-4',
        chavePix: '',
        tipoChavePix: 'CNPJ'
      }
    }
  });

  // ── CARREGAR PARCEIROS ─────────────────────────────────────
  const loadPartners = async () => {
    setIsLoading(true);
    const queryParams = new URLSearchParams();
    if (search) queryParams.append('search', search);
    if (filterPapel !== 'todos') queryParams.append('papel', filterPapel);
    if (filterRegime !== 'todos') queryParams.append('regime', filterRegime);
    if (filterSegmento !== 'todos') queryParams.append('segmento', filterSegmento);

    const res = await get<{ success: boolean; data: ParceiroNegocio[] }>(`/partners?${queryParams.toString()}`);
    if (res.ok && res.data?.data) {
      setPartners(res.data.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPartners();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, filterPapel, filterRegime, filterSegmento]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPartners();
  };

  // ── ABRIR MODAL NOVO / EDITAR ─────────────────────────────
  const handleOpenNew = () => {
    setEditingPartner(null);
    setFormData({
      tipoPessoa: 'PJ',
      papel: 'fornecedor',
      cpfCnpj: '',
      razaoSocial: '',
      nomeFantasia: '',
      naturezaJuridica: '2062',
      regimeTributario: '04',
      esferaPublica: 'NA',
      segmento: 'IND',
      cnaePrincipal: '2511000',
      statusCadastro: 'A',
      endereco: {
        cep: '',
        logradouro: '',
        numero: '',
        bairro: '',
        codMunicipioIbge: '3550308',
        municipio: 'São Paulo',
        uf: 'SP',
        codPaisBacen: '1058',
        nomePais: 'Brasil'
      },
      fiscal: {
        inscricaoEstadual: '',
        indIeDestinatario: '1',
        inscricaoMunicipal: '',
        indContribuinteIpi: false,
        indSubstitutoTrib: false,
        indProdutorRural: false,
        indCooperativa: false,
        indOptanteSimples: false,
        aliquotaIcmsSimples: 0
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
        contaContabilFornecedor: '2.01.01.01.0001',
        centroCustoDefault: 'CC_GERAL',
        condicaoPagamentoDias: 30
      }
    });
    setActiveTab('identificacao');
    setSimulacaoResult(null);
    setShowModal(true);
  };

  const handleOpenEdit = (partner: ParceiroNegocio) => {
    setEditingPartner(partner);
    setFormData(JSON.parse(JSON.stringify(partner)));
    setActiveTab('identificacao');
    setSimulacaoResult(null);
    setShowModal(true);
  };

  const handleDelete = async (id: string, razao: string) => {
    if (!confirm(`Tem certeza que deseja inativar/remover o parceiro ${razao}?`)) return;
    const res = await del(`/partners/${id}`);
    if (res.ok) {
      setPartners(prev => prev.filter(p => p.id !== id));
      alert('Parceiro de negócio removido com sucesso.');
    }
  };

  // ── SELETORES INTELIGENTES & REGRAS CONDICIONAIS ──────────
  const handleNaturezaJuridicaChange = (nj: string) => {
    const isOrgaoPub = nj.startsWith('1');
    const isMei = nj === '2135';

    setFormData(prev => {
      const nextRegime = isMei ? '06' : (isOrgaoPub ? '05' : prev.regimeTributario);
      const nextEsfera = isOrgaoPub ? (prev.esferaPublica === 'NA' ? 'MU' : prev.esferaPublica) : 'NA';

      return {
        ...prev,
        naturezaJuridica: nj,
        regimeTributario: nextRegime,
        esferaPublica: nextEsfera,
        fiscal: {
          ...prev.fiscal!,
          indOptanteSimples: isMei || prev.regimeTributario === '01',
          indIeDestinatario: isOrgaoPub ? '9' : prev.fiscal?.indIeDestinatario || '1'
        },
        retencoes: {
          ...prev.retencoes!,
          retemCrf: !isMei && nextRegime !== '01',
          regimeRetencaoPublica: isOrgaoPub ? 'IN_1234_AMPLA' : 'NA'
        }
      };
    });
  };

  const handleRegimeChange = (regime: RegimeTributarioParceiro) => {
    const isSimples = regime === '01' || regime === '06';

    setFormData(prev => ({
      ...prev,
      regimeTributario: regime,
      fiscal: {
        ...prev.fiscal!,
        indOptanteSimples: isSimples
      },
      retencoes: {
        ...prev.retencoes!,
        retemCrf: !isSimples, // Simples e MEI dispensam CRF Lei 10.833
        retemIrrf: !isSimples ? prev.retencoes?.retemIrrf || false : false
      }
    }));
  };

  // ── SALVAR PARCEIRO ────────────────────────────────────────
  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cpfCnpj || !formData.razaoSocial) {
      alert('Por favor, informe CPF/CNPJ e Razão Social.');
      return;
    }

    if (editingPartner) {
      const res = await put(`/partners/${editingPartner.id}`, formData);
      if (res.ok && res.data?.data) {
        setPartners(prev => prev.map(p => p.id === editingPartner.id ? res.data!.data : p));
        setShowModal(false);
        alert('Cadastro do parceiro atualizado com sucesso!');
      } else {
        alert(res.error || 'Erro ao atualizar parceiro.');
      }
    } else {
      const res = await post('/partners', formData);
      if (res.ok && res.data?.data) {
        setPartners(prev => [res.data!.data, ...prev]);
        setShowModal(false);
        alert('Parceiro de negócio cadastrado com sucesso!');
      } else {
        alert(res.error || 'Erro ao cadastrar parceiro.');
      }
    }
  };

  // ── EXECUTAR SIMULAÇÃO FISCAL & SPED ───────────────────────
  const handleRunSimulacao = async () => {
    const res = await post<{ success: boolean; simulation: SimulacaoFiscalParceiro }>('/partners/simulate-tax', {
      partnerData: formData,
      tipoOperacao: simulacaoTipoOp,
      ufOrigem: 'SP',
      ufDestino: simulacaoUfDestino
    });

    if (res.ok && res.data?.simulation) {
      setSimulacaoResult(res.data.simulation);
    }
  };

  // ── GERAR REGISTRO 0150 SPED EM TEMPO REAL ─────────────────
  const gerarLinhaSped0150 = () => {
    const p = formData;
    const cleanDoc = (p.cpfCnpj || '').replace(/[.\-\/]/g, '').toUpperCase();
    const isCnpj = cleanDoc.length === 14;
    const codPart = `PART_${cleanDoc || '00000000000000'}`;
    const nome = (p.razaoSocial || 'NOME_DO_PARTICIPANTE').toUpperCase().slice(0, 100);
    const codPais = p.endereco?.codPaisBacen || '1058';
    const cnpj = isCnpj ? cleanDoc : '';
    const cpf = !isCnpj ? cleanDoc : '';
    const ie = p.fiscal?.inscricaoEstadual?.replace(/[.\-\/]/g, '') || '';
    const codMun = p.endereco?.codMunicipioIbge || '3550308';
    const suframa = p.fiscal?.suframa || '';
    const end = (p.endereco?.logradouro || '').toUpperCase();
    const num = p.endereco?.numero || 'S/N';
    const compl = (p.endereco?.complemento || '').toUpperCase();
    const bairro = (p.endereco?.bairro || '').toUpperCase();

    return `|0150|${codPart}|${nome}|${codPais}|${cnpj}|${cpf}|${ie}|${codMun}|${suframa}|${end}|${num}|${compl}|${bairro}|`;
  };

  // Exportar para JSON
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(partners, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Parceiros_Negocio_MDM_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Dashboard */}
      <div className="glass-panel-glow rounded-3xl p-6 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Dados Mestres & Cadastro Fiscal de Parceiros
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleExportJson}
              className="px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Exportar JSON</span>
            </button>
            <button
              onClick={handleOpenNew}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Parceiro de Negócio</span>
            </button>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-slate-800/80">
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Total Parceiros</span>
              <div className="text-xl font-black text-white font-mono">{partners.length}</div>
            </div>
            <Users className="w-6 h-6 text-indigo-400" />
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Contribuintes ICMS</span>
              <div className="text-xl font-black text-emerald-400 font-mono">
                {partners.filter(p => p.fiscal?.indIeDestinatario === '1').length}
              </div>
            </div>
            <Building2 className="w-6 h-6 text-emerald-400" />
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Retenções Ativas</span>
              <div className="text-xl font-black text-amber-400 font-mono">
                {partners.filter(p => p.retencoes?.retemCrf || p.retencoes?.retemIrrf || p.retencoes?.retemInss).length}
              </div>
            </div>
            <Receipt className="w-6 h-6 text-amber-400" />
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Conformidade SEFAZ</span>
              <div className="text-xl font-black text-cyan-400 font-mono">100%</div>
            </div>
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
          </div>
        </div>
      </div>

      {/* Action & Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por CNPJ, Razão Social, Fantasia ou Cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Filter Papel */}
          <select
            value={filterPapel}
            onChange={(e) => setFilterPapel(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
          >
            <option value="todos">Todos os Papéis</option>
            <option value="cliente">Clientes</option>
            <option value="fornecedor">Fornecedores</option>
            <option value="prestador">Prestadores</option>
            <option value="transportador">Transportadores</option>
          </select>

          {/* Filter Regime */}
          <select
            value={filterRegime}
            onChange={(e) => setFilterRegime(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
          >
            <option value="todos">Todos os Regimes</option>
            <option value="01">Simples Nacional</option>
            <option value="03">Lucro Presumido</option>
            <option value="04">Lucro Real</option>
            <option value="05">Imune / Isento</option>
            <option value="06">MEI</option>
          </select>

          {/* Filter Segmento */}
          <select
            value={filterSegmento}
            onChange={(e) => setFilterSegmento(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
          >
            <option value="todos">Todos os Segmentos</option>
            <option value="IND">Indústria</option>
            <option value="COM">Comércio</option>
            <option value="SER">Serviços</option>
            <option value="CON">Construção Civil</option>
            <option value="RUR">Produtor Rural</option>
          </select>

          {/* Alternador de visualização */}
          <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tabela
            </button>
          </div>
        </div>
      </div>

      {/* Partners List Rendering */}
      {isLoading ? (
        <div className="glass-panel p-12 text-center text-slate-400 flex flex-col items-center gap-3">
          <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin" />
          <span className="text-xs font-bold">Carregando catálogo de parceiros de negócio...</span>
        </div>
      ) : partners.length === 0 ? (
        <div className="glass-panel p-12 text-center text-slate-400 rounded-2xl flex flex-col items-center gap-3">
          <Users className="w-10 h-10 text-slate-600" />
          <span className="text-sm font-bold text-white">Nenhum parceiro de negócio encontrado</span>
          <p className="text-xs text-slate-400">Tente ajustar seus filtros ou cadastre um novo parceiro no botão acima.</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {partners.map(partner => {
            const isAlfaCnpj = /[A-Z]/.test(partner.cpfCnpj);
            const isSimples = partner.regimeTributario === '01' || partner.regimeTributario === '06';

            return (
              <div
                key={partner.id}
                className="glass-panel p-5 rounded-2xl flex flex-col justify-between gap-4 border border-slate-800 hover:border-slate-700 hover:shadow-xl transition-all relative overflow-hidden group"
              >
                {/* Header Card */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase font-mono ${
                        partner.papel === 'cliente'
                          ? 'bg-blue-950 text-blue-300 border border-blue-800'
                          : partner.papel === 'fornecedor'
                          ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}>
                        {partner.papel}
                      </span>
                      {isAlfaCnpj && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase font-mono bg-purple-950 text-purple-300 border border-purple-800">
                          CNPJ ALFA
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                        UF: {partner.endereco?.uf}
                      </span>
                      <button
                        onClick={() => handleOpenEdit(partner)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                        title="Editar Parceiro"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(partner.id, partner.razaoSocial)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 transition-all cursor-pointer"
                        title="Remover Parceiro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-extrabold text-white text-sm line-clamp-1 group-hover:text-cyan-300 transition-colors">
                    {partner.razaoSocial}
                  </h3>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    {partner.cpfCnpj} {partner.nomeFantasia && partner.nomeFantasia !== partner.razaoSocial && `• ${partner.nomeFantasia}`}
                  </div>
                </div>

                {/* Fiscal Badges & Segment */}
                <div className="space-y-2 text-xs">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-700 text-slate-300">
                      Regime: {partner.regimeTributario === '04' ? 'Lucro Real' : partner.regimeTributario === '03' ? 'Lucro Presumido' : partner.regimeTributario === '01' ? 'Simples Nacional' : partner.regimeTributario === '06' ? 'MEI' : 'Imune/Isento'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-700 text-slate-300">
                      Seg: {partner.segmento}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      partner.fiscal?.indIeDestinatario === '1'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}>
                      {partner.fiscal?.indIeDestinatario === '1' ? 'Contribuinte ICMS' : 'Não Contribuinte (DIFAL)'}
                    </span>
                  </div>

                  {/* Retenções Badges */}
                  <div className="flex flex-wrap gap-1">
                    {partner.retencoes?.retemIrrf && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
                        IRRF 1,5%
                      </span>
                    )}
                    {partner.retencoes?.retemCrf && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-800">
                        CRF 4,65%
                      </span>
                    )}
                    {partner.retencoes?.retemInss && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-950/80 text-blue-300 border border-blue-800">
                        INSS Reinf
                      </span>
                    )}
                    {partner.retencoes?.regimeRetencaoPublica === 'IN_1234_AMPLA' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800">
                        IN 1.234 Órgão Público
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Address & Action */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{partner.endereco?.municipio} - {partner.endereco?.uf}</span>
                  </div>

                  <button
                    onClick={() => {
                      handleOpenEdit(partner);
                      setActiveTab('sped_simulador');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer shrink-0"
                  >
                    <Calculator className="w-3 h-3 text-cyan-400" />
                    <span>Simular SPED</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Parceiro / Razão Social</th>
                  <th className="p-3.5">CPF / CNPJ</th>
                  <th className="p-3.5">Papel</th>
                  <th className="p-3.5">Regime / Segmento</th>
                  <th className="p-3.5">Inscrição Estadual</th>
                  <th className="p-3.5">Retenções</th>
                  <th className="p-3.5">Município / UF</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {partners.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-bold text-white">{p.razaoSocial}</td>
                    <td className="p-3.5 font-mono text-cyan-300">{p.cpfCnpj}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-900 border border-slate-700">
                        {p.papel}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-[11px]">
                      {p.regimeTributario === '04' ? 'Lucro Real' : p.regimeTributario === '01' ? 'Simples' : 'Outro'} ({p.segmento})
                    </td>
                    <td className="p-3.5 font-mono text-[11px]">{p.fiscal?.inscricaoEstadual || 'ISENTO'}</td>
                    <td className="p-3.5">
                      <div className="flex gap-1">
                        {p.retencoes?.retemIrrf && <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 text-[9px] font-bold">IRRF</span>}
                        {p.retencoes?.retemCrf && <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 text-[9px] font-bold">CRF</span>}
                        {p.retencoes?.retemInss && <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 text-[9px] font-bold">INSS</span>}
                      </div>
                    </td>
                    <td className="p-3.5">{p.endereco?.municipio} - {p.endereco?.uf}</td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 mr-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.razaoSocial)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL CADASTRO / EDIÇÃO MULTI-ABAS ────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-cyan-950 border border-cyan-800 text-cyan-400">
                  <Landmark className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white">
                    {editingPartner ? 'Editar Dados Mestres do Parceiro' : 'Novo Parceiro de Negócio (Tax Business Partner)'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Conformidade total com SPED Fiscal, EFD-Contribuições, SCANC e Portaria RFB nº 439/2024.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('identificacao')}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'identificacao' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>1. Identificação</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('fiscal')}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'fiscal' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>2. Fiscal & Tributário</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('retencoes')}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'retencoes' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>3. Retenções na Fonte</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('endereco')}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'endereco' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>4. Endereçamento</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('contabil')}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'contabil' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>5. Contabilidade / ERP</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('sped_simulador');
                  handleRunSimulacao();
                }}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sped_simulador' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'text-cyan-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>6. Simulador SPED / SCANC</span>
              </button>
            </div>

            {/* Form Content Area */}
            <form onSubmit={handleSavePartner} className="space-y-4 text-xs overflow-y-auto flex-1 pr-1 custom-scrollbar">
              {/* TAB 1: IDENTIFICAÇÃO */}
              {activeTab === 'identificacao' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Tipo de Pessoa *</label>
                      <select
                        value={formData.tipoPessoa}
                        onChange={(e) => setFormData({ ...formData, tipoPessoa: e.target.value as TipoPessoaParceiro })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      >
                        <option value="PJ">Pessoa Jurídica (PJ)</option>
                        <option value="PF">Pessoa Física (PF)</option>
                        <option value="EX">Estrangeiro (EX)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Papel do Parceiro *</label>
                      <select
                        value={formData.papel}
                        onChange={(e) => setFormData({ ...formData, papel: e.target.value as PapelParceiro })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      >
                        <option value="cliente">Cliente (Vendas / Faturamento)</option>
                        <option value="fornecedor">Fornecedor (Insumos / Mercadorias)</option>
                        <option value="prestador">Prestador de Serviços</option>
                        <option value="transportador">Transportador (CT-e)</option>
                        <option value="ambos">Ambos (Cliente & Fornecedor)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1 flex items-center justify-between">
                        <span>CPF / CNPJ (Alfa ou Numérico) *</span>
                        {/[A-Z]/.test(formData.cpfCnpj || '') && (
                          <span className="text-[10px] text-purple-400 font-mono font-bold">ALFANUMÉRICO</span>
                        )}
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 02.456.789/0001-30 ou 12.ABC.345/0001-30"
                        value={formData.cpfCnpj}
                        onChange={(e) => setFormData({ ...formData, cpfCnpj: e.target.value.toUpperCase() })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Razão Social Oficial *</label>
                      <input
                        type="text"
                        value={formData.razaoSocial}
                        onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Nome Fantasia</label>
                      <input
                        type="text"
                        value={formData.nomeFantasia || ''}
                        onChange={(e) => setFormData({ ...formData, nomeFantasia: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Natureza Jurídica (CONCLA/RFB)</label>
                      <select
                        value={formData.naturezaJuridica}
                        onChange={(e) => handleNaturezaJuridicaChange(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      >
                        <option value="2062">2062 - Sociedade Empresária Limitada (LTDA)</option>
                        <option value="2054">2054 - Sociedade Anônima Fechada (S/A)</option>
                        <option value="2046">2046 - Sociedade Anônima Aberta (S/A)</option>
                        <option value="2135">2135 - Empresário Individual (MEI/EI)</option>
                        <option value="1031">1031 - Órgão Público do Poder Executivo Municipal</option>
                        <option value="1023">1023 - Órgão Público do Poder Executivo Estadual</option>
                        <option value="1015">1015 - Órgão Público do Poder Executivo Federal</option>
                        <option value="3999">3999 - Associação Privada / Sem Fins Lucrativos</option>
                        <option value="2143">2143 - Cooperativa</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Regime Tributário Federal *</label>
                      <select
                        value={formData.regimeTributario}
                        onChange={(e) => handleRegimeChange(e.target.value as RegimeTributarioParceiro)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      >
                        <option value="04">04 - Lucro Real (Não Cumulativo)</option>
                        <option value="03">03 - Lucro Presumido (Cumulativo)</option>
                        <option value="01">01 - Simples Nacional (LC 123/2006)</option>
                        <option value="06">06 - Microempreendedor Individual (MEI)</option>
                        <option value="05">05 - Imune / Isento</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Segmento Econômico *</label>
                      <select
                        value={formData.segmento}
                        onChange={(e) => setFormData({ ...formData, segmento: e.target.value as SegmentoMercadologico })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      >
                        <option value="IND">Indústria / Transformação</option>
                        <option value="COM">Comércio / Atacado / Varejo</option>
                        <option value="SER">Serviços / Consultoria / TI</option>
                        <option value="CON">Construção Civil / Engenharia</option>
                        <option value="RUR">Produtor Rural / Agronegócio</option>
                        <option value="FIN">Instituição Financeira</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">CNAE Principal Fiscal</label>
                      <input
                        type="text"
                        placeholder="Ex: 6201501, 2511000"
                        value={formData.cnaePrincipal}
                        onChange={(e) => setFormData({ ...formData, cnaePrincipal: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Inscrição SUFRAMA (Se aplicável)</label>
                      <input
                        type="text"
                        placeholder="9 dígitos"
                        value={formData.fiscal?.suframa || ''}
                        onChange={(e) => setFormData({ ...formData, fiscal: { ...formData.fiscal!, suframa: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: FISCAL & TRIBUTÁRIO */}
              {activeTab === 'fiscal' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Inscrição Estadual (IE)</label>
                      <input
                        type="text"
                        placeholder="Ex: 110293847115 ou ISENTO"
                        value={formData.fiscal?.inscricaoEstadual || ''}
                        onChange={(e) => setFormData({ ...formData, fiscal: { ...formData.fiscal!, inscricaoEstadual: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Indicador da IE do Destinatário *</label>
                      <select
                        value={formData.fiscal?.indIeDestinatario}
                        onChange={(e) => setFormData({ ...formData, fiscal: { ...formData.fiscal!, indIeDestinatario: e.target.value as any } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      >
                        <option value="1">1 - Contribuinte de ICMS (Possui IE ativa)</option>
                        <option value="2">2 - Contribuinte Isento de Inscrição</option>
                        <option value="9">9 - Não Contribuinte (Aplica DIFAL Partilha EC 87)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Inscrição Municipal (IM)</label>
                      <input
                        type="text"
                        placeholder="Ex: 9876543-2"
                        value={formData.fiscal?.inscricaoMunicipal || ''}
                        onChange={(e) => setFormData({ ...formData, fiscal: { ...formData.fiscal!, inscricaoMunicipal: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                    <span className="font-bold text-cyan-300 block text-xs">Parâmetros & Enquadramentos Especiais</span>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={formData.fiscal?.indContribuinteIpi}
                          onChange={(e) => setFormData({ ...formData, fiscal: { ...formData.fiscal!, indContribuinteIpi: e.target.checked } })}
                          className="rounded border-slate-700"
                        />
                        <span>Contribuinte de IPI</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={formData.fiscal?.indSubstitutoTrib}
                          onChange={(e) => setFormData({ ...formData, fiscal: { ...formData.fiscal!, indSubstitutoTrib: e.target.checked } })}
                          className="rounded border-slate-700"
                        />
                        <span>Substituto Tributário (ST)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={formData.fiscal?.indProdutorRural}
                          onChange={(e) => setFormData({ ...formData, fiscal: { ...formData.fiscal!, indProdutorRural: e.target.checked } })}
                          className="rounded border-slate-700"
                        />
                        <span>Produtor Rural</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={formData.fiscal?.indCooperativa}
                          onChange={(e) => setFormData({ ...formData, fiscal: { ...formData.fiscal!, indCooperativa: e.target.checked } })}
                          className="rounded border-slate-700"
                        />
                        <span>Ato Cooperativo</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={formData.fiscal?.indOptanteSimples}
                          onChange={(e) => setFormData({ ...formData, fiscal: { ...formData.fiscal!, indOptanteSimples: e.target.checked } })}
                          className="rounded border-slate-700"
                        />
                        <span>Optante Simples Nacional</span>
                      </label>
                    </div>

                    {formData.fiscal?.indOptanteSimples && (
                      <div className="pt-2 border-t border-slate-800 flex items-center gap-3">
                        <label className="font-bold text-slate-300">Alíquota ICMS Simples para Crédito (%):</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.fiscal?.aliquotaIcmsSimples || 0}
                          onChange={(e) => setFormData({ ...formData, fiscal: { ...formData.fiscal!, aliquotaIcmsSimples: parseFloat(e.target.value) || 0 } })}
                          className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 font-mono"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: RETENÇÕES NA FONTE */}
              {activeTab === 'retencoes' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/60 text-indigo-300 flex items-center gap-2">
                    <Receipt className="w-5 h-5 shrink-0" />
                    <span>Configuração de retenções automáticas nos pagamentos/recebimentos com este parceiro.</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* IRRF */}
                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="font-bold text-white">Retenção de IRRF (Serviços)</span>
                        <input
                          type="checkbox"
                          checked={formData.retencoes?.retemIrrf}
                          onChange={(e) => setFormData({ ...formData, retencoes: { ...formData.retencoes!, retemIrrf: e.target.checked } })}
                          className="rounded border-slate-700"
                        />
                      </label>
                      <p className="text-[11px] text-slate-400">RIR/2018 Arts. 647 e 714 (Dispensa valor &lt; R$ 10,00).</p>
                      {formData.retencoes?.retemIrrf && (
                        <div className="flex items-center gap-2 pt-2">
                          <span className="text-slate-300">Alíquota:</span>
                          <input
                            type="number"
                            step="0.1"
                            value={formData.retencoes?.aliquotaIrrf || 1.5}
                            onChange={(e) => setFormData({ ...formData, retencoes: { ...formData.retencoes!, aliquotaIrrf: parseFloat(e.target.value) || 0 } })}
                            className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 font-mono"
                          />
                          <span className="text-slate-400 font-mono">%</span>
                        </div>
                      )}
                    </div>

                    {/* CRF */}
                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="font-bold text-white">Retenção CRF - PIS/COFINS/CSLL</span>
                        <input
                          type="checkbox"
                          checked={formData.retencoes?.retemCrf}
                          onChange={(e) => setFormData({ ...formData, retencoes: { ...formData.retencoes!, retemCrf: e.target.checked } })}
                          className="rounded border-slate-700"
                        />
                      </label>
                      <p className="text-[11px] text-slate-400">Lei 10.833/2003 Art. 30 (Alíquota padrão: 4,65%). Isento para Simples.</p>
                      {formData.retencoes?.retemCrf && (
                        <div className="flex items-center gap-2 pt-2">
                          <span className="text-slate-300">Alíquota CRF:</span>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.retencoes?.aliquotaCrf || 4.65}
                            onChange={(e) => setFormData({ ...formData, retencoes: { ...formData.retencoes!, aliquotaCrf: parseFloat(e.target.value) || 0 } })}
                            className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 font-mono"
                          />
                          <span className="text-slate-400 font-mono">%</span>
                        </div>
                      )}
                    </div>

                    {/* INSS */}
                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="font-bold text-white">Retenção INSS (Cessão Mão de Obra)</span>
                        <input
                          type="checkbox"
                          checked={formData.retencoes?.retemInss}
                          onChange={(e) => setFormData({ ...formData, retencoes: { ...formData.retencoes!, retemInss: e.target.checked } })}
                          className="rounded border-slate-700"
                        />
                      </label>
                      <p className="text-[11px] text-slate-400">Lei 8.212/91 Art. 31 / EFD-Reinf Evento R-2010.</p>
                      {formData.retencoes?.retemInss && (
                        <div className="flex items-center gap-3 pt-2">
                          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                            <input
                              type="checkbox"
                              checked={formData.retencoes?.indicadorCprb}
                              onChange={(e) => setFormData({ ...formData, retencoes: { ...formData.retencoes!, indicadorCprb: e.target.checked } })}
                            />
                            <span>Desoneração Folha (3,5%)</span>
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Órgãos Públicos */}
                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                      <span className="font-bold text-white block">Regime Especial Órgãos Públicos</span>
                      <p className="text-[11px] text-slate-400">IN RFB nº 1.234/2012 (Retenção ampla de tributos federais).</p>
                      <select
                        value={formData.retencoes?.regimeRetencaoPublica || 'NA'}
                        onChange={(e) => setFormData({ ...formData, retencoes: { ...formData.retencoes!, regimeRetencaoPublica: e.target.value as any } })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none"
                      >
                        <option value="NA">Não Aplicável (Empresa Privada)</option>
                        <option value="IN_1234_AMPLA">IN RFB 1.234/2012 - Retenção Integral</option>
                        <option value="LEI_9430">Lei 9.430/1996 - Retenção Básica</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: ENDEREÇAMENTO */}
              {activeTab === 'endereco' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">CEP</label>
                      <input
                        type="text"
                        placeholder="Ex: 01310-100"
                        value={formData.endereco?.cep || ''}
                        onChange={(e) => setFormData({ ...formData, endereco: { ...formData.endereco!, cep: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-300 block mb-1">Logradouro / Endereço Fiscal *</label>
                      <input
                        type="text"
                        value={formData.endereco?.logradouro || ''}
                        onChange={(e) => setFormData({ ...formData, endereco: { ...formData.endereco!, logradouro: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Número</label>
                      <input
                        type="text"
                        value={formData.endereco?.numero || ''}
                        onChange={(e) => setFormData({ ...formData, endereco: { ...formData.endereco!, numero: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Complemento</label>
                      <input
                        type="text"
                        value={formData.endereco?.complemento || ''}
                        onChange={(e) => setFormData({ ...formData, endereco: { ...formData.endereco!, complemento: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Bairro</label>
                      <input
                        type="text"
                        value={formData.endereco?.bairro || ''}
                        onChange={(e) => setFormData({ ...formData, endereco: { ...formData.endereco!, bairro: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Município *</label>
                      <input
                        type="text"
                        value={formData.endereco?.municipio || ''}
                        onChange={(e) => setFormData({ ...formData, endereco: { ...formData.endereco!, municipio: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">UF *</label>
                      <select
                        value={formData.endereco?.uf || 'SP'}
                        onChange={(e) => setFormData({ ...formData, endereco: { ...formData.endereco!, uf: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      >
                        {['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'DF', 'PE', 'CE', 'AM', 'GO', 'ES', 'MT', 'MS', 'PA'].map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Código IBGE (7 Dígitos)</label>
                      <input
                        type="text"
                        value={formData.endereco?.codMunicipioIbge || '3550308'}
                        onChange={(e) => setFormData({ ...formData, endereco: { ...formData.endereco!, codMunicipioIbge: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: CONTABILIDADE / ERP */}
              {activeTab === 'contabil' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Conta Contábil Fornecedor / Cliente (SPED Reg 0500)</label>
                      <input
                        type="text"
                        placeholder="Ex: 2.01.01.01.0025"
                        value={formData.contabil?.contaContabilFornecedor || formData.contabil?.contaContabilCliente || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          contabil: { ...formData.contabil!, contaContabilFornecedor: e.target.value, contaContabilCliente: e.target.value }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Centro de Custo Default</label>
                      <input
                        type="text"
                        placeholder="Ex: CC_FABRICA_SP"
                        value={formData.contabil?.centroCustoDefault || ''}
                        onChange={(e) => setFormData({ ...formData, contabil: { ...formData.contabil!, centroCustoDefault: e.target.value } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Condição de Pagamento (Dias)</label>
                      <input
                        type="number"
                        value={formData.contabil?.condicaoPagamentoDias || 30}
                        onChange={(e) => setFormData({ ...formData, contabil: { ...formData.contabil!, condicaoPagamentoDias: parseInt(e.target.value, 10) || 0 } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Limite de Crédito Aprovado (R$)</label>
                      <input
                        type="number"
                        value={formData.contabil?.limiteCredito || 0}
                        onChange={(e) => setFormData({ ...formData, contabil: { ...formData.contabil!, limiteCredito: parseFloat(e.target.value) || 0 } })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Dados Bancários & PIX */}
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                    <span className="font-bold text-cyan-300 block text-xs">Dados Bancários & Chave PIX</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="font-bold text-slate-300 block mb-1">Banco FEBRABAN</label>
                        <input
                          type="text"
                          placeholder="Ex: 001 - Banco do Brasil"
                          value={formData.contabil?.dadosBancarios?.bancoNome || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            contabil: {
                              ...formData.contabil!,
                              dadosBancarios: { ...formData.contabil?.dadosBancarios!, bancoNome: e.target.value, bancoCodigo: '001', agencia: '', contaCorrente: '' }
                            }
                          })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-300 block mb-1">Agência</label>
                        <input
                          type="text"
                          value={formData.contabil?.dadosBancarios?.agencia || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            contabil: {
                              ...formData.contabil!,
                              dadosBancarios: { ...formData.contabil?.dadosBancarios!, agencia: e.target.value, bancoCodigo: '001', bancoNome: 'BB', contaCorrente: '' }
                            }
                          })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-300 block mb-1">Conta Corrente</label>
                        <input
                          type="text"
                          value={formData.contabil?.dadosBancarios?.contaCorrente || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            contabil: {
                              ...formData.contabil!,
                              dadosBancarios: { ...formData.contabil?.dadosBancarios!, contaCorrente: e.target.value, bancoCodigo: '001', bancoNome: 'BB', agencia: '' }
                            }
                          })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: SIMULADOR SPED & SCANC */}
              {activeTab === 'sped_simulador' && (
                <div className="space-y-4">
                  {/* Visualizador do Registro 0150 SPED */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300 text-xs flex items-center gap-2">
                        <FileCode className="w-4 h-4" />
                        Registro Oficial EFD ICMS/IPI e EFD Contribuições: |0150|
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Layout Guia Prático SPED</span>
                    </div>

                    <div className="p-3 rounded-xl bg-black border border-slate-800 text-cyan-400 font-mono text-[11px] overflow-x-auto select-all">
                      {gerarLinhaSped0150()}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Este registro é injetado automaticamente na geração das obrigações acessórias mensais, garantindo amarração com os registros C100, C170 e C190.
                    </p>
                  </div>

                  {/* Simulador Interativo */}
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-indigo-400" />
                        Simulador em Tempo Real do Motor de Regras Tributárias
                      </span>

                      <div className="flex items-center gap-2">
                        <select
                          value={simulacaoTipoOp}
                          onChange={(e) => setSimulacaoTipoOp(e.target.value as any)}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-slate-200"
                        >
                          <option value="venda_mercadoria">Venda de Mercadoria</option>
                          <option value="compra_insumo">Compra de Insumo</option>
                          <option value="prestacao_servico">Prestação de Serviço</option>
                        </select>

                        <select
                          value={simulacaoUfDestino}
                          onChange={(e) => setSimulacaoUfDestino(e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 font-mono"
                        >
                          {['SP', 'RJ', 'MG', 'PR', 'RS', 'BA', 'DF', 'PE', 'CE', 'AM'].map(u => (
                            <option key={u} value={u}>Destino: {u}</option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={handleRunSimulacao}
                          className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] cursor-pointer"
                        >
                          Recalcular
                        </button>
                      </div>
                    </div>

                    {simulacaoResult && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800">
                        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">CFOP Sugerido</span>
                          <span className="text-base font-black text-cyan-300 font-mono">{simulacaoResult.cfopSugerido}</span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">CST / CSOSN ICMS</span>
                          <span className="text-base font-black text-emerald-300 font-mono">
                            {simulacaoResult.csosnSugerido ? `CSOSN ${simulacaoResult.csosnSugerido}` : `CST ${simulacaoResult.cstIcmsSugerido}`}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Alíquota ICMS</span>
                          <span className="text-base font-black text-white font-mono">{simulacaoResult.aliquotaIcms}%</span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">DIFAL Partilha</span>
                          <span className={`text-base font-black font-mono ${simulacaoResult.exigeDifalPartilha ? 'text-amber-400' : 'text-slate-500'}`}>
                            {simulacaoResult.exigeDifalPartilha ? 'SIM (EC 87)' : 'NÃO'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons Modal */}
              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-extrabold text-xs shadow-lg shadow-cyan-600/30 transition-all cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-cyan-300" />
                  <span>{editingPartner ? 'Salvar Alterações' : 'Cadastrar Parceiro'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
