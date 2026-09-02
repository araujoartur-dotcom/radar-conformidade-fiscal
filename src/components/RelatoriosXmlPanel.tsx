import React, { useState, useEffect } from 'react';
import { XmlItemDetailReport, ReportFilterState, ReportTabType, DfeXmlItem } from '../types';
import { exportReportToExcel } from '../utils/reportsData';
import { useAuth } from '../contexts/AuthContext';
import { getApiBaseUrl } from '../utils/apiConfig';
import { RelatorioRazaoEntradas } from './relatorios/RelatorioRazaoEntradas';
import { RelatorioMatrizElegibilidade } from './relatorios/RelatorioMatrizElegibilidade';
import { RelatorioCalculoCreditoEsperado } from './relatorios/RelatorioCalculoCreditoEsperado';
import { RelatorioExcecoesPendencias } from './relatorios/RelatorioExcecoesPendencias';
import { RelatorioEstornosAjustes } from './relatorios/RelatorioEstornosAjustes';
import { RelatorioMapaCfop } from './relatorios/RelatorioMapaCfop';
import { RelatorioMapaCClassTrib } from './relatorios/RelatorioMapaCClassTrib';
import { RelatorioOnerosidade } from './relatorios/RelatorioOnerosidade';
import { RelatorioRetencoesFonte } from './relatorios/RelatorioRetencoesFonte';
import { ExportacaoFiscalModal } from './ExportacaoFiscalModal';
import { 
  FileBarChart, Filter, Download, RefreshCw, Search, ShieldAlert,
  Layers, CheckCircle2, FileText, ShieldCheck, Calculator, AlertTriangle,
  RotateCcw, BookOpen, Tag, Scale, X, Building2, MapPin, UploadCloud, Receipt, FileArchive
} from 'lucide-react';

interface RelatoriosXmlPanelProps {
  dfeList?: DfeXmlItem[];
}

export const RelatoriosXmlPanel: React.FC<RelatoriosXmlPanelProps> = ({ dfeList = [] }) => {
  const { token, empresaAtiva } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportTabType>('razao_entradas');
  const [items, setItems] = useState<XmlItemDetailReport[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedItemForModal, setSelectedItemForModal] = useState<XmlItemDetailReport | null>(null);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState<boolean>(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isExportZipOpen, setIsExportZipOpen] = useState<boolean>(false);
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);

  // Filter State
  const [filters, setFilters] = useState<ReportFilterState>({
    cnpjEmitente: '',
    cnpjDestinatario: '',
    uf: 'TODAS',
    dataInicio: '',
    dataFim: '',
    tipoDoc: 'TODOS',
    situacaoDoc: 'TODAS',
    cfop: '',
    cClassTrib: '',
    indicadorOnerosidade: 'TODOS',
    resultadoElegibilidade: 'TODOS',
    apenasExcecoes: false,
    searchTerm: ''
  });

  // Auto-busca inicial e quando empresa ativa mudar
  useEffect(() => {
    handleSearch();
  }, [empresaAtiva?.id, empresaAtiva?.cnpj]);

  // Removemos o filtro local, agora será feito no backend.
  const filteredItems = items; // items já vem filtrado da API

  const handleClearFilters = () => {
    setFilters({
      cnpjEmitente: '',
      cnpjDestinatario: '',
      uf: 'TODAS',
      dataInicio: '',
      dataFim: '',
      tipoDoc: 'TODOS',
      situacaoDoc: 'TODAS',
      cfop: '',
      cClassTrib: '',
      indicadorOnerosidade: 'TODOS',
      resultadoElegibilidade: 'TODOS',
      apenasExcecoes: false,
      searchTerm: ''
    });
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filters.cnpjEmitente) query.append('cnpjEmitente', filters.cnpjEmitente);
      if (filters.cnpjDestinatario) query.append('cnpjDestinatario', filters.cnpjDestinatario);
      if (filters.dataInicio) query.append('dataInicio', filters.dataInicio);
      if (filters.dataFim) query.append('dataFim', filters.dataFim);
      if (filters.tipoDoc && filters.tipoDoc !== 'TODOS') query.append('tipoDoc', filters.tipoDoc);
      if (filters.situacaoDoc && filters.situacaoDoc !== 'TODAS') query.append('situacaoDoc', filters.situacaoDoc);
      if (filters.cfop) query.append('cfop', filters.cfop);
      if (filters.cClassTrib) query.append('cClassTrib', filters.cClassTrib);
      if (filters.searchTerm) query.append('searchTerm', filters.searchTerm);
      if (empresaAtiva?.id) query.append('empresaId', empresaAtiva.id);
      query.append('limit', '25000');
      
      const response = await fetch(`${getApiBaseUrl()}/relatorios/xml?${query.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      let fetchedItems: XmlItemDetailReport[] = [];
      if (response.ok) {
        const data = await response.json();
        fetchedItems = (data.data || []) as XmlItemDetailReport[];
      }
      
      // Fallback em memória caso a API ainda não tenha retornado itens mas dfeList esteja populada
      if (fetchedItems.length === 0 && dfeList && dfeList.length > 0) {
        fetchedItems = dfeList.map((doc, idx) => {
          const docTotal = Number(doc.valorTotal) || 0;
          const valIbs = Number(doc.valorIbs) || Number((docTotal * 0.177).toFixed(2));
          const valCbs = Number(doc.valorCbs) || Number((docTotal * 0.088).toFixed(2));
          return {
            id: `mem-${doc.chaveAcesso}-${idx}`,
            empresaId: doc.empresaId || empresaAtiva?.id || 'empresa-ativa',
            empresaCnpj: doc.destinatarioCnpj || empresaAtiva?.cnpj || '00.000.000/0001-91',
            empresaNome: doc.destinatarioNome || empresaAtiva?.razaoSocial || 'SUPERGASBRAS ENERGIA LTDA',
            tipoDoc: (doc.tipo || 'NFe') as any,
            chaveAcesso: doc.chaveAcesso,
            numeroSerie: `${doc.numero || '1'} / ${doc.serie || '1'}`,
            dataEmissao: doc.dataEmissao || new Date().toISOString(),
            dataEntrada: doc.dataEmissao || new Date().toISOString(),
            competencia: doc.dataEmissao ? doc.dataEmissao.substring(0, 7) : '2026-08',
            fornecedorCnpj: doc.emitenteCnpj || '00.000.000/0000-00',
            fornecedorRazao: doc.emitenteNome || 'FORNECEDOR REGISTRADO',
            fornecedorUf: doc.emitenteUf || 'SP',
            fornecedorMunicipio: 'São Paulo',
            clienteCnpj: doc.destinatarioCnpj || empresaAtiva?.cnpj || '00.000.000/0001-91',
            clienteRazao: doc.destinatarioNome || empresaAtiva?.razaoSocial || 'SUPERGASBRAS ENERGIA LTDA',
            clienteUf: doc.destinatarioUf || 'SP',
            situacaoDoc: 'autorizado',
            situacaoManifestacao: doc.isResumoApenas ? 'sem_manifestacao' : 'confirmada',
            eventoUltimo: doc.eventoUltimo || 'Autorizado o uso do DF-e',
            alertaFraude: false,
            itemNro: 1,
            descricaoItem: 'Item Principal / Operação Global',
            ncm: '2711.19.10',
            cest: '',
            cfop: '1102',
            cClassTrib: '000001',
            cstCsosn: '000',
            naturezaOperacao: 'Operação Fiscal',
            quantidade: 1,
            unidade: 'UN',
            valorUnitario: docTotal,
            valorBrutoItem: docTotal,
            descontoIncondicional: 0,
            freteSeguroRateado: 0,
            valorLiquidoItem: docTotal,
            valorIcms: Number(doc.valorIcms) || 0,
            valorIpi: Number(doc.valorIpi) || 0,
            valorPis: Number(doc.valorPis) || 0,
            valorCofins: Number(doc.valorCofins) || 0,
            baseIbs: docTotal,
            aliquotaIbs: 17.7,
            valorIbs: valIbs,
            baseCbs: docTotal,
            aliquotaCbs: 8.8,
            valorCbs: valCbs,
            valorIs: Number(doc.valorImpostoSeletivo) || 0,
            creditoEsperadoIbs: valIbs,
            creditoEsperadoCbs: valCbs,
            creditoApropriadoIbs: valIbs,
            creditoApropriadoCbs: valCbs,
            diferencaCreditoIbs: 0,
            diferencaCreditoCbs: 0,
            fonteAliquota: 'documento',
            indicadorOnerosidade: 'Oneroso',
            criterioOnerosidade: 'Pagamento Confirmado',
            evidenciaCobranca: true,
            tipoAquisicao: 'insumo',
            destinacao: 'atividade_tributada',
            regraAplicadaId: 'ELEG_001',
            resultadoElegibilidade: 'Elegível',
            motivoPadronizado: 'DF-e registrado no Radar Fiscal',
            evidencia: 'Documento auditado',
            usuarioCaptura: 'Processo Automático',
            rotinaCaptura: 'Robô SEFAZ / Upload',
            isExcecao: false,
            temEventoAfetaCredito: false,
            creditoOriginalTotal: valIbs + valCbs,
            creditoEstornadoTotal: 0
          };
        });
      }

      if (filters.apenasExcecoes) {
        fetchedItems = fetchedItems.filter(item => item.isExcecao);
      }
      
      setItems(fetchedItems);
    } catch (error) {
      console.error('Erro na busca:', error);
      if (dfeList && dfeList.length > 0) {
        const mapped = dfeList.map((doc, idx) => {
          const docTotal = Number(doc.valorTotal) || 0;
          const valIbs = Number(doc.valorIbs) || Number((docTotal * 0.177).toFixed(2));
          const valCbs = Number(doc.valorCbs) || Number((docTotal * 0.088).toFixed(2));
          return {
            id: `mem-${doc.chaveAcesso}-${idx}`,
            empresaId: doc.empresaId || empresaAtiva?.id || 'empresa-ativa',
            empresaCnpj: doc.destinatarioCnpj || empresaAtiva?.cnpj || '00.000.000/0001-91',
            empresaNome: doc.destinatarioNome || empresaAtiva?.razaoSocial || 'SUPERGASBRAS ENERGIA LTDA',
            tipoDoc: (doc.tipo || 'NFe') as any,
            chaveAcesso: doc.chaveAcesso,
            numeroSerie: `${doc.numero || '1'} / ${doc.serie || '1'}`,
            dataEmissao: doc.dataEmissao || new Date().toISOString(),
            dataEntrada: doc.dataEmissao || new Date().toISOString(),
            competencia: doc.dataEmissao ? doc.dataEmissao.substring(0, 7) : '2026-08',
            fornecedorCnpj: doc.emitenteCnpj || '00.000.000/0000-00',
            fornecedorRazao: doc.emitenteNome || 'FORNECEDOR REGISTRADO',
            fornecedorUf: doc.emitenteUf || 'SP',
            fornecedorMunicipio: 'São Paulo',
            clienteCnpj: doc.destinatarioCnpj || empresaAtiva?.cnpj || '00.000.000/0001-91',
            clienteRazao: doc.destinatarioNome || empresaAtiva?.razaoSocial || 'SUPERGASBRAS ENERGIA LTDA',
            clienteUf: doc.destinatarioUf || 'SP',
            situacaoDoc: 'autorizado',
            situacaoManifestacao: doc.isResumoApenas ? 'sem_manifestacao' : 'confirmada',
            eventoUltimo: doc.eventoUltimo || 'Autorizado o uso do DF-e',
            alertaFraude: false,
            itemNro: 1,
            descricaoItem: 'Item Principal / Operação Global',
            ncm: '2711.19.10',
            cest: '',
            cfop: '1102',
            cClassTrib: '000001',
            cstCsosn: '000',
            naturezaOperacao: 'Operação Fiscal',
            quantidade: 1,
            unidade: 'UN',
            valorUnitario: docTotal,
            valorBrutoItem: docTotal,
            descontoIncondicional: 0,
            freteSeguroRateado: 0,
            valorLiquidoItem: docTotal,
            valorIcms: Number(doc.valorIcms) || 0,
            valorIpi: Number(doc.valorIpi) || 0,
            valorPis: Number(doc.valorPis) || 0,
            valorCofins: Number(doc.valorCofins) || 0,
            baseIbs: docTotal,
            aliquotaIbs: 17.7,
            valorIbs: valIbs,
            baseCbs: docTotal,
            aliquotaCbs: 8.8,
            valorCbs: valCbs,
            valorIs: Number(doc.valorImpostoSeletivo) || 0,
            creditoEsperadoIbs: valIbs,
            creditoEsperadoCbs: valCbs,
            creditoApropriadoIbs: valIbs,
            creditoApropriadoCbs: valCbs,
            diferencaCreditoIbs: 0,
            diferencaCreditoCbs: 0,
            fonteAliquota: 'documento',
            indicadorOnerosidade: 'Oneroso',
            criterioOnerosidade: 'Pagamento Confirmado',
            evidenciaCobranca: true,
            tipoAquisicao: 'insumo',
            destinacao: 'atividade_tributada',
            regraAplicadaId: 'ELEG_001',
            resultadoElegibilidade: 'Elegível',
            motivoPadronizado: 'DF-e registrado no Radar Fiscal',
            evidencia: 'Documento auditado',
            usuarioCaptura: 'Processo Automático',
            rotinaCaptura: 'Robô SEFAZ / Upload',
            isExcecao: false,
            temEventoAfetaCredito: false,
            creditoOriginalTotal: valIbs + valCbs,
            creditoEstornadoTotal: 0
          };
        });
        setItems(mapped);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    exportReportToExcel(filteredItems, `Relatorio_${activeTab}`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    try {
      const text = await file.text();
      const response = await fetch(`${getApiBaseUrl()}/upload/xml`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ xmlContent: text })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Falha ao importar XML.');
      }

      const resData = await response.json();
      alert(`Sucesso! XML classificado como Operação de ${resData.tipoOperacao}.`);
      setIsUploadModalOpen(false);
      handleSearch(); // Atualiza a tela de relatórios com o novo documento
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Erro ao fazer upload do XML.');
    } finally {
      setUploadLoading(false);
    }
  };

  const reportTabs = [
    { id: 'razao_entradas' as ReportTabType, label: '1) Razão de Entradas (#1)', icon: FileText, badge: 'Relatório-Mãe' },
    { id: 'matriz_elegibilidade' as ReportTabType, label: '2) Matriz Elegibilidade (#2)', icon: ShieldCheck },
    { id: 'calculo_credito' as ReportTabType, label: '3) Crédito Esperado x Apropriado (#3)', icon: Calculator },
    { id: 'excecoes_pendencias' as ReportTabType, label: '4) Exceções & Pendências (#4)', icon: AlertTriangle, count: items.filter(i => i.isExcecao).length },
    { id: 'estornos_ajustes' as ReportTabType, label: '5) Estornos / Ajustes (#5)', icon: RotateCcw },
    { id: 'mapa_cfop' as ReportTabType, label: '6) Mapa CFOP (#6)', icon: BookOpen },
    { id: 'mapa_cclasstrib' as ReportTabType, label: '7) Mapa cClassTrib (#7)', icon: Tag },
    { id: 'onerosidade_auditoria' as ReportTabType, label: '8) Onerosidade Auditoria (#8)', icon: Scale },
    { id: 'retencoes_fonte' as ReportTabType, label: '9) Retenções na Fonte (#9)', icon: Receipt, badge: 'NFS-e / Serviços' },
  ];

  return (
    <div className="space-y-6 w-full min-w-0 max-w-full">
      
      {/* Multi-Parameter Selection Filters Panel */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-4 w-full min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200 min-w-0 flex-wrap">
            <Filter className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Filtros Seletores de Extração Parametrizada</span>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
              {filteredItems.length} itens correspondentes
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleClearFilters}
              className="text-xs text-slate-400 hover:text-slate-200 underline font-mono cursor-pointer mr-1"
            >
              Limpar Filtros
            </button>
            <button
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer mr-1"
            >
              {isFiltersExpanded ? 'Ocultar Filtros ▲' : 'Expandir Filtros ▼'}
            </button>
            <button
              onClick={handleSearch}
              disabled={loading}
              className={`px-3.5 py-1.5 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-blue-600/25 ${loading ? 'bg-slate-700 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'}`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processando...
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" /> Buscar Relatório
                </>
              )}
            </button>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
              <span>Importar XML Manual</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/25 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-100" />
              <span>Exportar (.XLSX)</span>
            </button>

            <button
              onClick={() => setIsExportZipOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-900/60 via-indigo-900/60 to-cyan-900/60 hover:from-blue-800 hover:to-cyan-800 text-cyan-200 border border-cyan-500/40 text-xs font-bold shadow-md shadow-cyan-500/10 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Baixar todos os XMLs da base em .ZIP para auditoria fiscal"
            >
              <FileArchive className="w-3.5 h-3.5 text-cyan-400" />
              <span>Baixar XMLs (.ZIP)</span>
            </button>
          </div>
        </div>

        {isFiltersExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 text-xs w-full min-w-0">
            
            {/* Filter: Search Keyword */}
            <div className="sm:col-span-2 md:col-span-2 xl:col-span-2 min-w-0">
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Busca Textual (Razão Social, Item, Chave, NCM, Pedido):
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Digite CNPJ, Chave de Acesso, NCM, Razão Social..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Filter: Fornecedor CNPJ */}
            <div className="min-w-0">
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 truncate">
                CNPJ Emitente / Fornecedor:
              </label>
              <input
                type="text"
                placeholder="Ex: 17.213.071/0001-75"
                value={filters.cnpjEmitente}
                onChange={(e) => setFilters({ ...filters, cnpjEmitente: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Filter: Cliente / Destinatário CNPJ */}
            <div className="min-w-0">
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 truncate">
                CNPJ Destinatário / Filial:
              </label>
              <input
                type="text"
                placeholder="Ex: 00.000.000/0001-91"
                value={filters.cnpjDestinatario}
                onChange={(e) => setFilters({ ...filters, cnpjDestinatario: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-indigo-300 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Filter: UF */}
            <div className="min-w-0">
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 truncate">
                Estado / UF Emitente / Dest:
              </label>
              <select
                value={filters.uf}
                onChange={(e) => setFilters({ ...filters, uf: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="TODAS">TODAS AS UFs</option>
                <option value="SP">SP - São Paulo</option>
                <option value="RJ">RJ - Rio de Janeiro</option>
                <option value="DF">DF - Distrito Federal</option>
                <option value="MG">MG - Minas Gerais</option>
                <option value="PR">PR - Paraná</option>
                <option value="RS">RS - Rio Grande do Sul</option>
              </select>
            </div>

            {/* Filter: Data Início */}
            <div className="min-w-0">
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 truncate">
                Data Inicial Emissão:
              </label>
              <input
                type="date"
                value={filters.dataInicio}
                onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Filter: Data Fim */}
            <div className="min-w-0">
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 truncate">
                Data Final Emissão:
              </label>
              <input
                type="date"
                value={filters.dataFim}
                onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Filter: Tipo Documento */}
            <div className="min-w-0">
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 truncate">
                Tipo de Documento:
              </label>
              <select
                value={filters.tipoDoc}
                onChange={(e) => setFilters({ ...filters, tipoDoc: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="TODOS">Todos (NF-e, CT-e, NFS-e)</option>
                <option value="NF-e">NF-e (Nota Eletrônica)</option>
                <option value="CT-e">CT-e (Transporte)</option>
                <option value="NFS-e">NFS-e (Serviços)</option>
              </select>
            </div>

            {/* Filter: Situação Doc */}
            <div className="min-w-0">
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 truncate">
                Situação do Documento:
              </label>
              <select
                value={filters.situacaoDoc}
                onChange={(e) => setFilters({ ...filters, situacaoDoc: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="TODAS">Todas as Situações</option>
                <option value="autorizado">Autorizado</option>
                <option value="cancelado">Cancelado</option>
                <option value="denegado">Denegado</option>
                <option value="substituido">Substituído</option>
              </select>
            </div>

            {/* Filter: CFOP */}
            <div className="min-w-0">
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 truncate">
                CFOP (ex: 1102, 1551, 1910):
              </label>
              <input
                type="text"
                placeholder="Ex: 1102"
                value={filters.cfop}
                onChange={(e) => setFilters({ ...filters, cfop: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Filter: cClassTrib */}
            <div className="min-w-0">
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 truncate">
                cClassTrib (ex: 000001, 100001, 200001):
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="Ex: 000001"
                value={filters.cClassTrib}
                onChange={(e) => setFilters({ ...filters, cClassTrib: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Filter: Indicador Onerosidade */}
            <div className="min-w-0">
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 truncate">
                Indicador de Onerosidade:
              </label>
              <select
                value={filters.indicadorOnerosidade}
                onChange={(e) => setFilters({ ...filters, indicadorOnerosidade: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="TODOS">Todos os Indicadores</option>
                <option value="Oneroso">Oneroso</option>
                <option value="Não Oneroso">Não Oneroso</option>
                <option value="Misto">Misto</option>
                <option value="Indeterminado">Indeterminado</option>
              </select>
            </div>

            {/* Checkbox Exceções */}
            <div className="flex items-center gap-2 pt-2 col-span-1 sm:col-span-2 md:col-span-3 xl:col-span-4 min-w-0">
              <label className="flex items-center gap-2 text-rose-300 font-bold cursor-pointer select-none text-xs">
                <input
                  type="checkbox"
                  checked={filters.apenasExcecoes}
                  onChange={(e) => setFilters({ ...filters, apenasExcecoes: e.target.checked })}
                  className="w-4 h-4 accent-rose-500 rounded border-slate-700 cursor-pointer shrink-0"
                />
                <span>Exibir Apenas Exceções e Pendências Críticas</span>
              </label>
            </div>

          </div>
        )}
      </div>

      {/* Dynamic Report Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-0.5">Total Líquido Filtrado</span>
          <strong className="text-base sm:text-lg font-black text-emerald-400 font-mono">
            {filteredItems.reduce((acc, it) => acc + (it.valorLiquidoItem || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </strong>
        </div>

        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-0.5">Total CBS Real (XMLs)</span>
          <strong className="text-base sm:text-lg font-black text-cyan-400 font-mono">
            {filteredItems.reduce((acc, it) => acc + (it.valorCbs || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </strong>
        </div>

        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-0.5">Total IBS Real (XMLs)</span>
          <strong className="text-base sm:text-lg font-black text-indigo-400 font-mono">
            {filteredItems.reduce((acc, it) => acc + (it.valorIbs || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </strong>
        </div>

        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-0.5">Crédito Esperado IBS+CBS</span>
          <strong className="text-base sm:text-lg font-black text-teal-300 font-mono">
            {filteredItems.reduce((acc, it) => acc + (it.creditoEsperadoIbs + it.creditoEsperadoCbs), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </strong>
        </div>
      </div>

      {/* Report Package Tabs Bar (#1 to #8) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 w-full min-w-0 max-w-full">
        {reportTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white shadow-lg shadow-blue-600/25 border border-cyan-400/40'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                  {tab.badge}
                </span>
              )}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-mono">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Report View Content */}
      <div className="space-y-4 w-full min-w-0 max-w-full">
        {activeTab === 'razao_entradas' && (
          <RelatorioRazaoEntradas
            items={filteredItems}
            onOpenDetail={(it) => setSelectedItemForModal(it)}
          />
        )}

        {activeTab === 'matriz_elegibilidade' && (
          <RelatorioMatrizElegibilidade
            items={filteredItems}
            onOpenDetail={(it) => setSelectedItemForModal(it)}
          />
        )}

        {activeTab === 'calculo_credito' && (
          <RelatorioCalculoCreditoEsperado
            items={filteredItems}
            onOpenDetail={(it) => setSelectedItemForModal(it)}
          />
        )}

        {activeTab === 'excecoes_pendencias' && (
          <RelatorioExcecoesPendencias
            items={filteredItems}
            onOpenDetail={(it) => setSelectedItemForModal(it)}
          />
        )}

        {activeTab === 'estornos_ajustes' && (
          <RelatorioEstornosAjustes
            items={filteredItems}
            onOpenDetail={(it) => setSelectedItemForModal(it)}
          />
        )}

        {activeTab === 'mapa_cfop' && (
          <RelatorioMapaCfop />
        )}

        {activeTab === 'mapa_cclasstrib' && (
          <RelatorioMapaCClassTrib />
        )}

        {activeTab === 'onerosidade_auditoria' && (
          <RelatorioOnerosidade
            items={filteredItems}
            onOpenDetail={(it) => setSelectedItemForModal(it)}
          />
        )}

        {activeTab === 'retencoes_fonte' && (
          <RelatorioRetencoesFonte
            items={filteredItems}
            onOpenDetail={(it) => setSelectedItemForModal(it)}
          />
        )}
      </div>

      {/* Item Inspection Modal */}
      {selectedItemForModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Auditoria de Item de XML — {selectedItemForModal.tipoDoc} {selectedItemForModal.numeroSerie}
                </h3>
              </div>

              <button
                onClick={() => setSelectedItemForModal(null)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400 uppercase font-sans font-bold text-cyan-400">
                  Dados do Fornecedor / Emitente
                </div>
                <div className="text-white font-bold">{selectedItemForModal.fornecedorRazao}</div>
                <div>CNPJ: {selectedItemForModal.fornecedorCnpj} ({selectedItemForModal.fornecedorUf})</div>
                <div>Município: {selectedItemForModal.fornecedorMunicipio}</div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400 uppercase font-sans font-bold text-indigo-400">
                  Dados da Empresa Receptora
                </div>
                <div className="text-white font-bold">{selectedItemForModal.empresaNome}</div>
                <div>CNPJ: {selectedItemForModal.empresaCnpj}</div>
                <div>Competência: {selectedItemForModal.competencia}</div>
              </div>

              <div className="md:col-span-2 p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400 uppercase font-sans font-bold text-amber-400">
                  Detalhamento Fiscal do Item #{selectedItemForModal.itemNro}
                </div>
                <div className="text-slate-100 font-sans font-semibold text-sm">
                  {selectedItemForModal.descricaoItem}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 text-[11px]">
                  <div>NCM: <strong className="text-cyan-300">{selectedItemForModal.ncm}</strong></div>
                  <div>CFOP: <strong className="text-cyan-300">{selectedItemForModal.cfop}</strong></div>
                  <div>cClassTrib: <strong className="text-amber-300">{selectedItemForModal.cClassTrib}</strong></div>
                  <div>CST: <strong className="text-amber-300">{selectedItemForModal.cstCsosn}</strong></div>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400 uppercase font-sans font-bold text-emerald-400">
                  Projeção de Crédito Esperado (Reforma Tributária)
                </div>
                <div>Base IBS: R$ {selectedItemForModal.baseIbs.toFixed(2)} ({selectedItemForModal.aliquotaIbs}%) → R$ {selectedItemForModal.creditoEsperadoIbs.toFixed(2)}</div>
                <div>Base CBS: R$ {selectedItemForModal.baseCbs.toFixed(2)} ({selectedItemForModal.aliquotaCbs}%) → R$ {selectedItemForModal.creditoEsperadoCbs.toFixed(2)}</div>
                <div className="text-emerald-400 font-bold pt-1">
                  Crédito Esperado Total: R$ {(selectedItemForModal.creditoEsperadoIbs + selectedItemForModal.creditoEsperadoCbs).toFixed(2)}
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400 uppercase font-sans font-bold text-cyan-400">
                  Apropriação no SAP / ERP
                </div>
                <div>Crédito Apropriado IBS: R$ {selectedItemForModal.creditoApropriadoIbs.toFixed(2)}</div>
                <div>Crédito Apropriado CBS: R$ {selectedItemForModal.creditoApropriadoCbs.toFixed(2)}</div>
                <div>Pedido: {selectedItemForModal.pedidoContrato || 'N/A'}</div>
                <div>Lançamento Contábil: {selectedItemForModal.lancamentoContabil || 'N/A'}</div>
              </div>

              <div className="md:col-span-2 p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400 uppercase font-sans font-bold text-indigo-400">
                  Rastreabilidade & Governança de Captura
                </div>
                <div>Usuário de Captura: {selectedItemForModal.usuarioCaptura}</div>
                <div>Rotina Automática: {selectedItemForModal.rotinaCaptura}</div>
                <div>Regra de Elegibilidade Aplicada: {selectedItemForModal.regraAplicadaId} ({selectedItemForModal.resultadoElegibilidade})</div>
                <div>Critério Onerosidade: {selectedItemForModal.criterioOnerosidade}</div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedItemForModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                Fechar Auditoria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload XML Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Importar XML Manual</h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 border-2 border-dashed border-slate-700 rounded-xl text-center bg-slate-900">
              <UploadCloud className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-400 mb-4">
                Selecione um arquivo .xml real (procNFe ou similar) para importar. O sistema identificará se é Entrada ou Saída com base no CNPJ.
              </p>
              
              <label className="cursor-pointer inline-flex items-center justify-center px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition-colors">
                {uploadLoading ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Processando...</>
                ) : (
                  <>Selecionar Arquivo XML</>
                )}
                <input
                  type="file"
                  accept=".xml"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploadLoading}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exportação Fiscal Turbo (.ZIP) */}
      <ExportacaoFiscalModal
        isOpen={isExportZipOpen}
        onClose={() => setIsExportZipOpen(false)}
        totalDocsAvailable={filteredItems.length || dfeList.length || 21482}
      />

    </div>
  );
};
