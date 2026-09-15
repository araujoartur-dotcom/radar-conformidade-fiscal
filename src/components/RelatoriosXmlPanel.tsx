import React, { useState, useEffect, useMemo } from 'react';
import { XmlItemDetailReport, ReportFilterState, ReportTabType, DfeXmlItem } from '../types';
import { exportReportToExcel } from '../utils/reportsData';
import { useAuth } from '../contexts/AuthContext';
import { useKpis } from '../contexts/KpiContext';
import { getApiBaseUrl } from '../utils/apiConfig';
import { FiscalVerticalBarChart } from './FiscalVerticalBarChart';
import { RelatorioRazaoEntradas } from './relatorios/RelatorioRazaoEntradas';
import { RelatorioMatrizElegibilidade } from './relatorios/RelatorioMatrizElegibilidade';
import { RelatorioCalculoCreditoEsperado } from './relatorios/RelatorioCalculoCreditoEsperado';
import { RelatorioExcecoesPendencias } from './relatorios/RelatorioExcecoesPendencias';
import { RelatorioEstornosAjustes } from './relatorios/RelatorioEstornosAjustes';
import { RelatorioMapaCfop } from './relatorios/RelatorioMapaCfop';
import { RelatorioMapaCClassTrib } from './relatorios/RelatorioMapaCClassTrib';
import { RelatorioOnerosidade } from './relatorios/RelatorioOnerosidade';
import { RelatorioRetencoesFonte } from './relatorios/RelatorioRetencoesFonte';
import { RelatorioConsolidadoMercadorias } from './relatorios/RelatorioConsolidadoMercadorias';
import { RelatorioConsolidadoServicos } from './relatorios/RelatorioConsolidadoServicos';
import { 
  FileBarChart, Filter, Download, RefreshCw, Search, ShieldAlert,
  Layers, CheckCircle2, FileText, ShieldCheck, Calculator, AlertTriangle,
  RotateCcw, BookOpen, Tag, Scale, X, Building2, MapPin, Receipt,
  Sparkles, Clock, ChevronDown, ChevronUp, ExternalLink, Check, Copy,
  Calendar, Key, Hash
} from 'lucide-react';

interface RelatoriosXmlPanelProps {
  dfeList?: DfeXmlItem[];
}

export const RelatoriosXmlPanel: React.FC<RelatoriosXmlPanelProps> = ({ dfeList = [] }) => {
  const { token, empresaAtiva } = useAuth();
  const { kpis: globalKpis, totalGeral: globalTotalGeral, totalFiltrado: globalTotalFiltrado } = useKpis();
  const [activeTab, setActiveTab] = useState<ReportTabType>('consolidado_mercadorias');
  const [items, setItems] = useState<XmlItemDetailReport[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [selectedItemForModal, setSelectedItemForModal] = useState<XmlItemDetailReport | null>(null);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState<boolean>(true);
  const [dbKpis, setDbKpis] = useState<any>(null);
  const [totalDbCount, setTotalDbCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 1000;

  // Estados de Integração em Tempo Real com Apuração Assistida & Modal do Ledger CGIBS
  const [syncingApuracao, setSyncingApuracao] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [selectedChaveLedger, setSelectedChaveLedger] = useState<string | null>(null);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [loadingLedger, setLoadingLedger] = useState<boolean>(false);

  const activeKpis = dbKpis?.totalFiltrado || globalTotalFiltrado || globalTotalGeral || globalKpis;
  const activeTotalGeral = dbKpis?.totalGeral || globalTotalGeral || activeKpis;

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
    searchTerm: '',
    visaoAnalitica: '360',
    statusRad: 'TODOS'
  });

  // Estados para o Localizador Rápido e Preview de DF-e & NFS-e Nacional
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<DfeXmlItem | null>(null);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState<boolean>(false);
  const [copiedChavePreview, setCopiedChavePreview] = useState<boolean>(false);

  const formatDocDate = (dt?: string) => {
    if (!dt) return '—';
    try {
      const d = new Date(dt);
      if (isNaN(d.getTime())) return dt;
      return d.toLocaleDateString('pt-BR');
    } catch {
      return dt;
    }
  };

  const formatCurrency = (val?: number) => {
    const num = Number(val) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Lista de documentos filtrados para o autocomplete inteligente
  const matchingDocs = useMemo(() => {
    if (!filters.searchTerm || filters.searchTerm.trim().length === 0) {
      return dfeList.slice(0, 12);
    }
    const q = filters.searchTerm.toLowerCase().trim();
    const qDigits = q.replace(/\D/g, '');
    return dfeList.filter(d => {
      const ch = d.chaveAcesso?.toLowerCase() || '';
      const num = d.numero?.toLowerCase() || '';
      const emit = d.emitenteNome?.toLowerCase() || '';
      const cnpj = d.emitenteCnpj?.replace(/\D/g, '') || '';

      return ch.includes(q) || 
             num.includes(q) || 
             emit.includes(q) || 
             (qDigits.length >= 3 && cnpj.includes(qDigits));
    }).slice(0, 25);
  }, [dfeList, filters.searchTerm]);

  // Sincroniza o preview se o usuário digitar/colar a chave exata (44 ou 50 dígitos)
  useEffect(() => {
    const term = filters.searchTerm?.trim();
    if (term && (term.length === 44 || term.length === 50)) {
      const found = dfeList.find(d => d.chaveAcesso?.trim() === term);
      if (found) {
        setSelectedPreviewDoc(found);
      }
    }
  }, [filters.searchTerm, dfeList]);

  const handleSelectDocForPreview = (doc: DfeXmlItem) => {
    setSelectedPreviewDoc(doc);
    setFilters(prev => ({ ...prev, searchTerm: doc.chaveAcesso }));
    setIsQuickSearchOpen(false);
  };

  const handleApplyDocFilter = (doc: DfeXmlItem) => {
    const updated = { ...filters, searchTerm: doc.chaveAcesso };
    setFilters(updated);
    setIsQuickSearchOpen(false);
    handleSearch(undefined, updated);
  };

  const handleClearPreviewDoc = () => {
    setSelectedPreviewDoc(null);
    setFilters(prev => ({ ...prev, searchTerm: '' }));
  };

  // Limpar preview de documento quando a empresa ativa mudar
  useEffect(() => {
    setSelectedPreviewDoc(null);
    setIsQuickSearchOpen(false);
  }, [empresaAtiva?.id, empresaAtiva?.cnpjCompleto]);

  // Filtro de itens com suporte a Status RAD e conciliação da Apuração Assistida
  const filteredItems = useMemo(() => {
    if (!filters.statusRad || filters.statusRad === 'TODOS') return items;
    return items.filter(it => {
      if (filters.statusRad === 'APTO') return it.impactoDecisorioRad === 'APTO_PARA_RAD';
      if (filters.statusRad === 'AGUARDAR') return it.impactoDecisorioRad === 'AGUARDAR_QUITACAO';
      if (filters.statusRad === 'NAO_CONCILIADO') return !it.impactoDecisorioRad || it.impactoDecisorioRad === 'NAO_CONCILIADO' || it.impactoDecisorioRad === 'INAPTO_PARA_RAD';
      return true;
    });
  }, [items, filters.statusRad]);

  // Cálculo consolidado das grandezas fiscais 100% fidedigno aos itens da busca
  const chartMetrics = useMemo(() => {
    // Se o backend retornou os KPIs (o que inclui todos os documentos sem limite de paginação), usamos eles.
    if (activeKpis && activeKpis.totalDocs > 0) {
      const icms = activeKpis.totalIcms || 0;
      const iss = activeKpis.totalIss || 0;
      const ipi = activeKpis.totalIpi || 0;
      const pis = activeKpis.totalPis || 0;
      const cofins = activeKpis.totalCofins || 0;
      const ibs = activeKpis.totalIbs || 0;
      const cbs = activeKpis.totalCbs || 0;
      const isVal = activeKpis.totalIs || 0;

      return {
        totalOperacoes: activeKpis.totalValor || 0,
        baseCalculo: activeKpis.totalBaseCbs || activeKpis.totalBaseIbs || 0,
        tributosAtuais: {
          total: icms + iss + ipi + pis + cofins,
          icms,
          iss,
          ipi,
          pis,
          cofins
        },
        tributosReforma: {
          total: ibs + cbs + isVal,
          ibs,
          cbs,
          is: isVal
        },
        creditoIbsCbs: ibs + cbs, // Aproximação baseada no valor dos tributos (que é a regra padrão atual)
        totalDocs: activeKpis.totalDocs,
        totalItens: activeKpis.totalDocs
      };
    }

    // Fallback para itens em memória caso não tenhamos o activeKpis
    const totalOperacoes = filteredItems.reduce((acc, it) => acc + (it.valorLiquidoItem || it.valorBrutoItem || 0), 0);
    const baseCalculo = filteredItems.reduce((acc, it) => acc + (it.baseIbs || it.baseCbs || 0), 0);
    const icms = filteredItems.reduce((acc, it) => acc + (it.valorIcms || 0), 0);
    const iss = filteredItems.reduce((acc, it) => acc + (it.valorIssRetido || (it as any).valorIss || 0), 0);
    const ipi = filteredItems.reduce((acc, it) => acc + (it.valorIpi || 0), 0);
    const pis = filteredItems.reduce((acc, it) => acc + (it.valorPis || 0), 0);
    const cofins = filteredItems.reduce((acc, it) => acc + (it.valorCofins || 0), 0);
    const ibs = filteredItems.reduce((acc, it) => acc + (it.valorIbs || 0), 0);
    const cbs = filteredItems.reduce((acc, it) => acc + (it.valorCbs || 0), 0);
    const isVal = filteredItems.reduce((acc, it) => acc + (it.valorIs || 0), 0);
    const creditoIbsCbs = filteredItems.reduce((acc, it) => acc + (it.creditoEsperadoIbs || it.valorIbs || 0) + (it.creditoEsperadoCbs || it.valorCbs || 0), 0);
    const distinctDocs = new Set(filteredItems.map(it => it.chaveAcesso).filter(Boolean)).size;

    return {
      totalOperacoes,
      baseCalculo,
      tributosAtuais: {
        total: icms + iss + ipi + pis + cofins,
        icms,
        iss,
        ipi,
        pis,
        cofins
      },
      tributosReforma: {
        total: ibs + cbs + isVal,
        ibs,
        cbs,
        is: isVal
      },
      creditoIbsCbs,
      totalDocs: distinctDocs || filteredItems.length,
      totalItens: filteredItems.length
    };
  }, [filteredItems, activeKpis]);

  const handleClearFilters = () => {
    const cleared: ReportFilterState = {
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
      searchTerm: '',
      visaoAnalitica: '360',
      statusRad: 'TODOS'
    };
    setFilters(cleared);
    setSelectedPreviewDoc(null);
    setIsQuickSearchOpen(false);
    setCurrentPage(1);
    handleSearch(activeTab, cleared, 1);
  };

  const handleSearch = async (tabOverride?: ReportTabType, customFilters?: ReportFilterState, pageOverride?: number) => {
    setLoading(true);
    try {
      const activeF = customFilters || filters;
      const currentTab = tabOverride || activeTab;
      const page = pageOverride || currentPage;
      const query = new URLSearchParams();
      if (activeF.cnpjEmitente) query.append('cnpjEmitente', activeF.cnpjEmitente);
      if (activeF.cnpjDestinatario) query.append('cnpjDestinatario', activeF.cnpjDestinatario);
      if (activeF.dataInicio) query.append('dataInicio', activeF.dataInicio);
      if (activeF.dataFim) query.append('dataFim', activeF.dataFim);
      if (activeF.uf && activeF.uf !== 'TODAS') query.append('uf', activeF.uf);

      // Filtros inteligentes por aba
      if ((currentTab === 'retencoes_fonte' || currentTab === 'consolidado_servicos') && (!activeF.tipoDoc || activeF.tipoDoc === 'TODOS')) {
        query.append('tipoDoc', 'NFSe');
        query.append('relatorio', 'retencoes_fonte');
      } else if (currentTab === 'consolidado_mercadorias' && (!activeF.tipoDoc || activeF.tipoDoc === 'TODOS')) {
        query.append('relatorio', 'consolidado_mercadorias');
      } else if (activeF.tipoDoc && activeF.tipoDoc !== 'TODOS') {
        query.append('tipoDoc', activeF.tipoDoc);
      }

      if (activeF.situacaoDoc && activeF.situacaoDoc !== 'TODAS') query.append('situacaoDoc', activeF.situacaoDoc);
      if (activeF.cfop) query.append('cfop', activeF.cfop);
      if (activeF.cClassTrib) query.append('cClassTrib', activeF.cClassTrib);
      if (activeF.indicadorOnerosidade && activeF.indicadorOnerosidade !== 'TODOS') query.append('indicadorOnerosidade', activeF.indicadorOnerosidade);
      if (activeF.resultadoElegibilidade && activeF.resultadoElegibilidade !== 'TODOS') query.append('resultadoElegibilidade', activeF.resultadoElegibilidade);
      if (activeF.apenasExcecoes) query.append('apenasExcecoes', 'true');
      if (activeF.searchTerm) query.append('searchTerm', activeF.searchTerm);
      if (empresaAtiva?.id) query.append('empresaId', empresaAtiva.id);
      
      query.append('limit', pageSize.toString());
      query.append('offset', ((page - 1) * pageSize).toString());
      
      const response = await fetch(`${getApiBaseUrl()}/relatorios/xml?${query.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      let fetchedItems: XmlItemDetailReport[] = [];
      if (response.ok) {
        const data = await response.json();
        fetchedItems = (data.data || []) as XmlItemDetailReport[];
        if (typeof data.total === 'number' && data.total > 0) {
          setTotalDbCount(data.total);
        }
        if (data.totaisBanco) {
          setDbKpis((prev: any) => ({
            ...prev,
            success: true,
            totalGeral: data.totaisBanco,
            totalFiltrado: data.totaisFiltrados || data.totaisBanco
          }));
        }
      }

      // Busca simultânea de KPIs agregados no banco (Total Geral + Filtrado)
      try {
        const kpiQuery = new URLSearchParams();
        if (empresaAtiva?.id) kpiQuery.append('empresaId', empresaAtiva.id);
        if (activeF.dataInicio) kpiQuery.append('dataInicio', activeF.dataInicio);
        if (activeF.dataFim) kpiQuery.append('dataFim', activeF.dataFim);
        if (activeF.tipoDoc && activeF.tipoDoc !== 'TODOS') kpiQuery.append('tipoDoc', activeF.tipoDoc);
        const kpiRes = await fetch(`${getApiBaseUrl()}/upload/kpis?${kpiQuery.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (kpiRes.ok) {
          const kpiJson = await kpiRes.json();
          if (kpiJson.success) setDbKpis(kpiJson);
        }
      } catch (kpiErr) {
        console.warn('⚠️ Erro ao carregar KPIs agregados:', kpiErr);
      }
      
      // Se a API retornar 0 itens, mantém a lista vazia factual sem gerar dados sintéticos em memória

      if (filters.apenasExcecoes) {
        fetchedItems = fetchedItems.filter(item => item.isExcecao);
      }
      
      setItems(fetchedItems);
      setHasSearched(true);
    } catch (error) {
      console.error('Erro na busca:', error);
      if (dfeList && dfeList.length > 0) {
        const mapped = dfeList.map((doc, idx) => {
          const docTotal = Number(doc.valorTotal) || 0;
          const valIbs = Number(doc.valorIbs) || 0;
          const valCbs = Number(doc.valorCbs) || 0;
          return {
            id: `mem-${doc.chaveAcesso}-${idx}`,
            empresaId: doc.empresaId || empresaAtiva?.id || 'empresa-ativa',
            empresaCnpj: doc.destinatarioCnpj || empresaAtiva?.cnpj || '00.000.000/0001-91',
            empresaNome: doc.destinatarioNome || empresaAtiva?.razaoSocial || 'EMPRESA REGISTRADA',
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
            clienteRazao: doc.destinatarioNome || empresaAtiva?.razaoSocial || 'EMPRESA REGISTRADA',
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
            baseIbs: Number(doc.baseIbs) || 0,
            aliquotaIbs: docTotal > 0 && valIbs > 0 ? Number(((valIbs / docTotal) * 100).toFixed(2)) : 0,
            valorIbs: valIbs,
            baseCbs: Number(doc.baseCbs) || 0,
            aliquotaCbs: docTotal > 0 && valCbs > 0 ? Number(((valCbs / docTotal) * 100).toFixed(2)) : 0,
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
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados automaticamente consolidando métricas na montagem e ao alternar a empresa ativa
  useEffect(() => {
    if (empresaAtiva?.id) {
      handleSearch();
    }
  }, [empresaAtiva?.id]);

  const handleExportExcel = () => {
    const query = new URLSearchParams();
    if (filters.cnpjEmitente) query.append('cnpjEmitente', filters.cnpjEmitente);
    if (filters.cnpjDestinatario) query.append('cnpjDestinatario', filters.cnpjDestinatario);
    if (filters.dataInicio) query.append('dataInicio', filters.dataInicio);
    if (filters.dataFim) query.append('dataFim', filters.dataFim);
    if (filters.uf && filters.uf !== 'TODAS') query.append('uf', filters.uf);
    if (filters.tipoDoc && filters.tipoDoc !== 'TODOS') query.append('tipoDoc', filters.tipoDoc);
    if (filters.situacaoDoc && filters.situacaoDoc !== 'TODAS') query.append('situacaoDoc', filters.situacaoDoc);
    if (filters.cfop) query.append('cfop', filters.cfop);
    if (filters.cClassTrib) query.append('cClassTrib', filters.cClassTrib);
    if (filters.indicadorOnerosidade && filters.indicadorOnerosidade !== 'TODOS') query.append('indicadorOnerosidade', filters.indicadorOnerosidade);
    if (filters.resultadoElegibilidade && filters.resultadoElegibilidade !== 'TODOS') query.append('resultadoElegibilidade', filters.resultadoElegibilidade);
    if (filters.apenasExcecoes) query.append('apenasExcecoes', 'true');
    if (filters.searchTerm) query.append('searchTerm', filters.searchTerm);
    if (empresaAtiva?.id) query.append('empresaId', empresaAtiva.id);
    
    // Anexa o token se puder (em produção idealmente usa cookie HTTPOnly para download)
    query.append('token', token);

    window.open(`${getApiBaseUrl()}/relatorios/xml/export?${query.toString()}`, '_blank');
  };

  // Ação de Sincronização em Tempo Real com Apuração Assistida (CGIBS / RTC)
  const handleSyncApuracao = async () => {
    setSyncingApuracao(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/relatorios/sincronizar-apuracao`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setSyncResult(json);
      }
      await handleSearch();
    } catch (e) {
      console.error('Erro ao sincronizar apuração assistida:', e);
    } finally {
      setSyncingApuracao(false);
    }
  };

  // Ação para abrir o Ledger Oficial da Apuração Assistida por Chave de Acesso
  const handleOpenLedger = async (chave: string) => {
    setSelectedChaveLedger(chave);
    setLoadingLedger(true);
    setLedgerData(null);
    try {
      const empId = empresaAtiva?.id || '';
      const listRes = await fetch(`${getApiBaseUrl()}/apuracao/operacoes?busca=${encodeURIComponent(chave)}&empresaId=${empId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (listRes.ok) {
        const listJson = await listRes.json();
        const found = (listJson.operacoes || []).find((op: any) => op.chave_acesso === chave) || listJson.operacoes?.[0];
        if (found?.id) {
          const detailRes = await fetch(`${getApiBaseUrl()}/apuracao/operacao/${found.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (detailRes.ok) {
            const detailJson = await detailRes.json();
            setLedgerData(detailJson);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao carregar ledger da operação:', err);
    } finally {
      setLoadingLedger(false);
    }
  };

  // Cálculo de filtros ativos para badge visual
  const activeFiltersCount = [
    Boolean(filters.searchTerm),
    Boolean(filters.cnpjEmitente),
    Boolean(filters.cnpjDestinatario),
    filters.uf !== 'TODAS',
    Boolean(filters.dataInicio),
    Boolean(filters.dataFim),
    filters.tipoDoc !== 'TODOS',
    filters.situacaoDoc !== 'TODAS',
    Boolean(filters.cfop),
    Boolean(filters.cClassTrib),
    filters.indicadorOnerosidade !== 'TODOS',
    filters.resultadoElegibilidade !== 'TODOS',
    filters.apenasExcecoes,
    filters.statusRad && filters.statusRad !== 'TODOS',
    filters.visaoAnalitica && filters.visaoAnalitica !== '360'
  ].filter(Boolean).length;

  const reportTabs = [
    { id: 'consolidado_mercadorias' as ReportTabType, label: '1) Mercadorias & Fretes (NF-e 55 & CT-e)', icon: FileText, badge: 'Consolidado Mestre' },
    { id: 'consolidado_servicos' as ReportTabType, label: '2) Serviços & Retenções (NFS-e ADN/Mun.)', icon: Receipt, badge: 'Consolidado Mestre' },
    { id: 'mapa_cfop' as ReportTabType, label: '3) Mapa CFOP', icon: BookOpen, badge: 'Apoio' },
    { id: 'mapa_cclasstrib' as ReportTabType, label: '4) Mapa cClassTrib', icon: Tag, badge: 'Apoio' },
    { id: 'razao_entradas' as ReportTabType, label: 'Razão de Entradas (#1)', icon: Layers, badge: 'Legado' },
    { id: 'matriz_elegibilidade' as ReportTabType, label: 'Matriz Elegibilidade (#2)', icon: ShieldCheck, badge: 'Legado' },
    { id: 'calculo_credito' as ReportTabType, label: 'Crédito Esperado x Apropriado (#3)', icon: Calculator, badge: 'Legado' },
    { id: 'excecoes_pendencias' as ReportTabType, label: 'Exceções & Pendências (#4)', icon: AlertTriangle, count: items.filter(i => i.isExcecao).length, badge: 'Legado' },
    { id: 'estornos_ajustes' as ReportTabType, label: 'Estornos / Ajustes (#5)', icon: RotateCcw, badge: 'Legado' },
    { id: 'onerosidade_auditoria' as ReportTabType, label: 'Onerosidade Auditoria (#8)', icon: Scale, badge: 'Legado' },
    { id: 'retencoes_fonte' as ReportTabType, label: 'Retenções Fonte Legado (#9)', icon: Receipt, badge: 'Legado' },
  ];

  return (
    <div className="space-y-6 w-full min-w-0 max-w-full">
      
      {/* Multi-Parameter Selection Filters Panel */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-4 w-full min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200 min-w-0 flex-wrap">
            <Filter className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Filtros Seletores de Extração Parametrizada</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleClearFilters}
              className="text-xs text-slate-400 hover:text-slate-200 underline font-mono cursor-pointer mr-1"
            >
              Limpar Filtros
            </button>

            {/* Botão de Expandir / Recolher Filtros */}
            <button
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border shadow-sm ${
                isFiltersExpanded
                  ? 'bg-slate-800/90 hover:bg-slate-700 text-cyan-300 border-cyan-500/40 hover:border-cyan-400'
                  : 'bg-gradient-to-r from-cyan-950/80 to-blue-950/80 hover:from-cyan-900 hover:to-blue-900 text-cyan-300 border-cyan-500/60 hover:border-cyan-400 shadow-cyan-950/40'
              }`}
              title={isFiltersExpanded ? 'Recolher bloco de filtros para ampliar a visualização dos relatórios' : 'Expandir bloco de filtros para ajustar parâmetros'}
            >
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isFiltersExpanded ? 'Recolher Filtros' : 'Expandir Filtros'}</span>
              {isFiltersExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {activeFiltersCount > 0 && !isFiltersExpanded && (
                <span className="px-1.5 py-0.2 text-[10px] bg-cyan-500 text-slate-950 font-black rounded-full ml-0.5">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => handleSearch()}
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
              onClick={handleExportExcel}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/25 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-100" />
              <span>Exportar (.XLSX)</span>
            </button>
          </div>
        </div>

        {/* Barra de resumo quando os filtros estiverem recolhidos */}
        {!isFiltersExpanded && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Filtros ativos:</span>
            <span className="bg-cyan-950/80 text-cyan-300 px-2.5 py-0.5 rounded-lg border border-cyan-700/60 font-bold">
              Relatório: {reportTabs.find(t => t.id === activeTab)?.label || activeTab}
            </span>
            {filters.visaoAnalitica && filters.visaoAnalitica !== '360' && (
              <span className="bg-purple-950/80 text-purple-300 px-2 py-0.5 rounded-lg border border-purple-800/60 font-medium">
                Visão: {filters.visaoAnalitica === 'regime_atual' ? 'Regime Atual' : filters.visaoAnalitica === 'reforma' ? 'Reforma' : filters.visaoAnalitica === 'governanca' ? 'Governança' : 'Apuração RAD'}
              </span>
            )}
            {filters.statusRad && filters.statusRad !== 'TODOS' && (
              <span className="bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-800/60 font-medium">
                RAD: {filters.statusRad}
              </span>
            )}
            {filters.dataInicio && (
              <span className="bg-slate-800 text-cyan-300 px-2 py-0.5 rounded-lg border border-slate-700 font-mono">
                De: {filters.dataInicio.split('-').reverse().join('/')}
              </span>
            )}
            {filters.dataFim && (
              <span className="bg-slate-800 text-cyan-300 px-2 py-0.5 rounded-lg border border-slate-700 font-mono">
                Até: {filters.dataFim.split('-').reverse().join('/')}
              </span>
            )}
            {filters.tipoDoc !== 'TODOS' && (
              <span className="bg-slate-800 text-cyan-300 px-2 py-0.5 rounded-lg border border-slate-700">
                Tipo: {filters.tipoDoc}
              </span>
            )}
            {filters.cfop && (
              <span className="bg-slate-800 text-amber-300 px-2 py-0.5 rounded-lg border border-slate-700 font-mono">
                CFOP: {filters.cfop}
              </span>
            )}
            {filters.uf !== 'TODAS' && (
              <span className="bg-slate-800 text-indigo-300 px-2 py-0.5 rounded-lg border border-slate-700">
                UF: {filters.uf}
              </span>
            )}
            {filters.searchTerm && (
              <span className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded-lg border border-slate-700 truncate max-w-[150px]">
                Busca: "{filters.searchTerm}"
              </span>
            )}
            {filters.apenasExcecoes && (
              <span className="bg-rose-950/60 text-rose-300 px-2 py-0.5 rounded-lg border border-rose-800/60">
                Apenas Exceções
              </span>
            )}
            {activeFiltersCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-rose-400 hover:text-rose-300 underline cursor-pointer ml-auto"
              >
                Limpar todos
              </button>
            )}
          </div>
        )}

        {isFiltersExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 text-xs w-full min-w-0">
            
            {/* Linha 1: Tipo de Relatório */}
            <div className="sm:col-span-2 md:col-span-2 xl:col-span-2 min-w-0">
              <label className="text-xs uppercase font-bold text-cyan-400 block mb-1.5 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Tipos de Relatórios:</span>
              </label>
              <select
                value={activeTab}
                onChange={(e) => {
                  const newTab = e.target.value as ReportTabType;
                  setActiveTab(newTab);
                  handleSearch(newTab);
                }}
                className="w-full bg-slate-950 border border-cyan-500/60 rounded-xl px-3.5 py-2 text-xs text-white font-bold focus:outline-none focus:border-cyan-400 shadow-lg shadow-cyan-950/40 cursor-pointer"
              >
                {reportTabs.map(tab => (
                  <option key={tab.id} value={tab.id} className="bg-slate-900 text-white py-1">
                    {tab.label} {tab.badge ? `[${tab.badge}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Linha 1: Visão Analítica de Colunas */}
            <div className="sm:col-span-2 md:col-span-2 xl:col-span-2 min-w-0">
              <label className="text-xs uppercase font-bold text-cyan-400 block mb-1.5 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Visão Analítica (Colunas):</span>
              </label>
              <select
                value={filters.visaoAnalitica || '360'}
                onChange={(e) => setFilters({ ...filters, visaoAnalitica: e.target.value as any })}
                className="w-full bg-slate-950 border border-cyan-500/60 rounded-xl px-3.5 py-2 text-xs text-white font-bold focus:outline-none focus:border-cyan-400 shadow-lg shadow-cyan-950/40 cursor-pointer"
              >
                <option value="360" className="bg-slate-900 text-white py-1">🌐 Visão Completa 360° (Todas as Colunas)</option>
                <option value="regime_atual" className="bg-slate-900 text-white py-1">🔶 Regime Atual (ICMS / IPI / PIS / COFINS)</option>
                <option value="reforma" className="bg-slate-900 text-white py-1">🔷 Reforma Tributária (IBS / CBS / Imposto Seletivo)</option>
                <option value="governanca" className="bg-slate-900 text-white py-1">🟣 Governança, NCM &amp; Elegibilidade</option>
                <option value="apuracao_rad" className="bg-slate-900 text-white py-1">🟢 Apuração Assistida &amp; RAD (CGIBS/RFB)</option>
              </select>
            </div>

            {/* Linha 2: Tipo de Documento (Modelos) */}
            <div className="sm:col-span-2 md:col-span-2 xl:col-span-2 min-w-0">
              <label className="text-xs uppercase font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Tipo de Documento (Modelos):</span>
              </label>
              <select
                value={filters.tipoDoc}
                onChange={(e) => setFilters({ ...filters, tipoDoc: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-cyan-500"
              >
                <option value="TODOS">Todos os Modelos (NF-e 55, CT-e 57/67, NFS-e)</option>
                <option value="NF-e">Apenas NF-e (Modelo 55 - Mercadorias)</option>
                <option value="CT-e">Apenas CT-e (Modelos 57 e 67 - Fretes)</option>
                <option value="NFS-e">Apenas NFS-e (Serviços)</option>
              </select>
            </div>

            {/* Linha 2: Status RAD & Conciliação */}
            <div className="sm:col-span-2 md:col-span-2 xl:col-span-2 min-w-0">
              <label className="text-xs uppercase font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Status RAD &amp; Conciliação (Apuração Assistida):</span>
              </label>
              <select
                value={filters.statusRad || 'TODOS'}
                onChange={(e) => setFilters({ ...filters, statusRad: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-cyan-500"
              >
                <option value="TODOS">Todos os Status RAD</option>
                <option value="APTO">🟢 Apto — Desnecessário RAD (Quitação Confirmada)</option>
                <option value="AGUARDAR">🟡 Aguardar Quitação Fornecedor (Risco Retenção)</option>
                <option value="NAO_CONCILIADO">⚪ Não Conciliado no Ledger / Pendente CGIBS</option>
              </select>
            </div>

            {/* Linha 3: Localizador Inteligente de DF-e & NFS-e Nacional com Autocomplete e Preview */}
            <div className="col-span-1 sm:col-span-2 md:col-span-3 xl:col-span-4 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1.5">
                <label className="text-xs uppercase font-bold text-cyan-300 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Busca Inteligente por Chave (44/50 posições), Nº de NF ou Fornecedor:</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800 font-mono">
                    ✓ NFS-e Nacional (50 posições)
                  </span>
                  <span className="text-[10px] text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800 font-mono">
                    ✓ NF-e / CT-e (44 posições)
                  </span>
                </div>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 z-10" />
                <input
                  type="text"
                  placeholder="Digite chave de 50 dígitos (NFS-e), 44 dígitos (NF-e/CT-e), Nº da NF ou Razão Social do fornecedor..."
                  value={filters.searchTerm}
                  onFocus={() => setIsQuickSearchOpen(true)}
                  onChange={(e) => {
                    setFilters({ ...filters, searchTerm: e.target.value });
                    setIsQuickSearchOpen(true);
                  }}
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter') {
                      setIsQuickSearchOpen(false);
                      handleSearch(); 
                    }
                  }}
                  className="w-full bg-slate-950 border border-cyan-500/60 rounded-xl pl-9 pr-24 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 shadow-lg shadow-cyan-950/30 font-medium"
                />
                
                <div className="absolute right-2 top-1.5 flex items-center gap-1.5 z-10">
                  {filters.searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilters({ ...filters, searchTerm: '' });
                        setSelectedPreviewDoc(null);
                      }}
                      className="text-slate-400 hover:text-white text-xs px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
                      title="Limpar campo de busca"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsQuickSearchOpen(!isQuickSearchOpen)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 transition cursor-pointer"
                    title={isQuickSearchOpen ? "Ocultar lista rápida" : "Ver lista de documentos"}
                  >
                    <span className="font-mono text-[10px]">{dfeList.length} notas</span>
                    {isQuickSearchOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* Dropdown de Autocomplete com os Documentos Encontrados */}
                {isQuickSearchOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-80 flex flex-col animate-in fade-in duration-150">
                    <div className="p-2.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Documentos Disponíveis ({matchingDocs.length} exibidos de {dfeList.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsQuickSearchOpen(false)}
                        className="text-slate-400 hover:text-white text-xs cursor-pointer font-bold"
                      >
                        Fechar ✕
                      </button>
                    </div>

                    <div className="overflow-y-auto divide-y divide-slate-800/60">
                      {matchingDocs.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          Nenhum documento encontrado com "{filters.searchTerm}". Pressione <strong>Enter</strong> ou clique em "Buscar" para consultar a base inteira no banco.
                        </div>
                      ) : (
                        matchingDocs.map((doc) => {
                          const isNfse = doc.tipo === 'NFSe' || (doc.tipo as string) === 'NFS-e' || doc.chaveAcesso?.length === 50;
                          return (
                            <button
                              key={doc.id || doc.chaveAcesso}
                              type="button"
                              onClick={() => handleSelectDocForPreview(doc)}
                              className="w-full text-left p-3 hover:bg-slate-800/80 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-black font-mono uppercase tracking-wider ${
                                    isNfse 
                                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                  }`}>
                                    {isNfse ? 'NFS-e Nacional (50D)' : `${doc.tipo || 'NF-e'} (44D)`}
                                  </span>
                                  <span className="font-bold text-white text-xs group-hover:text-cyan-300 transition-colors">
                                    Nº {doc.numero || '—'}
                                  </span>
                                  {doc.serie && (
                                    <span className="text-[10px] text-slate-400">
                                      Série {doc.serie}
                                    </span>
                                  )}
                                  {doc.dataEmissao && (
                                    <span className="text-[10px] text-slate-400">
                                      📅 {formatDocDate(doc.dataEmissao)}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-300 truncate">
                                  <strong className="text-slate-200">{doc.emitenteNome}</strong>
                                  <span className="text-slate-500 text-[11px] font-mono ml-1.5">
                                    ({doc.emitenteCnpj})
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono truncate">
                                  Chave: {doc.chaveAcesso}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div className="text-xs font-black text-emerald-400 font-mono">
                                  {formatCurrency(doc.valorTotal)}
                                </div>
                                <span className="text-[10px] text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1 mt-1">
                                  Ver Prévia →
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* CARD DE RESULTADO PRÉVIO DO DOCUMENTO SELECIONADO */}
              {selectedPreviewDoc && (
                <div className="mt-3 p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border-2 border-cyan-500/60 shadow-2xl shadow-cyan-950/40 space-y-3 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-black font-mono uppercase tracking-wider ${
                        selectedPreviewDoc.tipo === 'NFSe' || (selectedPreviewDoc.tipo as string) === 'NFS-e' || selectedPreviewDoc.chaveAcesso?.length === 50
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      }`}>
                        {selectedPreviewDoc.tipo === 'NFSe' || (selectedPreviewDoc.tipo as string) === 'NFS-e' || selectedPreviewDoc.chaveAcesso?.length === 50
                          ? '🏛️ NFS-e Nacional (50 Posições — CGNFSe / RFB)'
                          : `📄 ${selectedPreviewDoc.tipo || 'NF-e'} (44 Posições — SEFAZ)`}
                      </span>
                      <span className="text-white font-extrabold text-sm">
                        Nº {selectedPreviewDoc.numero || '—'}
                      </span>
                      <span className="text-xs text-slate-300 font-semibold px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700">
                        Série: {selectedPreviewDoc.serie || '1'}
                      </span>
                      <span className="text-xs text-slate-300 font-semibold px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-cyan-400" />
                        Emissão: {formatDocDate(selectedPreviewDoc.dataEmissao)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Valor Total</span>
                        <span className="text-base font-extrabold text-emerald-400 font-mono">
                          {formatCurrency(selectedPreviewDoc.valorTotal)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearPreviewDoc}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                        title="Fechar prévia"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Informações de Fornecedor e Destinatário */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                        <Building2 className="w-3 h-3 text-cyan-400" />
                        <span>Fornecedor / Prestador</span>
                      </div>
                      <div className="font-bold text-white text-sm truncate">{selectedPreviewDoc.emitenteNome}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        CNPJ: <strong className="text-slate-200">{selectedPreviewDoc.emitenteCnpj}</strong>
                        {selectedPreviewDoc.emitenteUf ? ` | UF: ${selectedPreviewDoc.emitenteUf}` : ''}
                      </div>
                    </div>

                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                        <MapPin className="w-3 h-3 text-indigo-400" />
                        <span>Destinatário / Tomador</span>
                      </div>
                      <div className="font-bold text-white text-sm truncate">{selectedPreviewDoc.destinatarioNome || empresaAtiva?.razaoSocial || 'EMPRESA REGISTRADA'}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        CNPJ: <strong className="text-slate-200">{selectedPreviewDoc.destinatarioCnpj || empresaAtiva?.cnpj || '—'}</strong>
                        {selectedPreviewDoc.destinatarioUf ? ` | UF: ${selectedPreviewDoc.destinatarioUf}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Chave de Acesso Completa com Botão de Copiar */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-amber-400" />
                        <span>Chave de Acesso Completa</span>
                      </span>
                      <span className="text-[10px] font-mono font-bold text-cyan-400">
                        {selectedPreviewDoc.chaveAcesso?.length === 50 
                          ? '✓ 50 Dígitos (Padrão NFS-e Nacional / CGNFSe)' 
                          : '✓ 44 Dígitos (Padrão NF-e/CT-e SEFAZ)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 font-mono text-xs text-amber-300 break-all select-all">
                        {selectedPreviewDoc.chaveAcesso}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedPreviewDoc.chaveAcesso);
                          setCopiedChavePreview(true);
                          setTimeout(() => setCopiedChavePreview(false), 2500);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold shrink-0 transition cursor-pointer"
                        title="Copiar chave de acesso completa"
                      >
                        {copiedChavePreview ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
                        <span>{copiedChavePreview ? 'Copiada!' : 'Copiar Chave'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Tributos da Reforma / Atuais destacados */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">CBS (Federal):</span>
                      <span className="font-bold text-cyan-300 font-mono text-xs">
                        {formatCurrency(selectedPreviewDoc.valorCbs)}
                      </span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">IBS (Est/Mun):</span>
                      <span className="font-bold text-indigo-300 font-mono text-xs">
                        {formatCurrency(selectedPreviewDoc.valorIbs)}
                      </span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">ICMS / ISS:</span>
                      <span className="font-bold text-slate-200 font-mono text-xs">
                        {formatCurrency(selectedPreviewDoc.valorIcms || (selectedPreviewDoc as any).valorIss)}
                      </span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">PIS / COFINS:</span>
                      <span className="font-bold text-slate-200 font-mono text-xs">
                        {formatCurrency((selectedPreviewDoc.valorPis || 0) + (selectedPreviewDoc.valorCofins || 0))}
                      </span>
                    </div>
                  </div>

                  {/* Botão de Ação: Filtrar os Itens no Relatório */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={handleClearPreviewDoc}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                    >
                      Limpar Prévia
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyDocFilter(selectedPreviewDoc)}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-900/40 transition cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Filtrar Itens Deste Documento no Relatório</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Linha 4: CNPJ Emitente */}
            <div className="min-w-0">
              <label className="text-xs uppercase font-semibold text-slate-400 block mb-1.5 truncate">
                CNPJ Emitente / Fornecedor:
              </label>
              <input
                type="text"
                placeholder="Ex: 01.001.001/0001-91"
                value={filters.cnpjEmitente}
                onChange={(e) => setFilters({ ...filters, cnpjEmitente: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Linha 4: CNPJ Destinatário */}
            <div className="min-w-0">
              <label className="text-xs uppercase font-semibold text-slate-400 block mb-1.5 truncate">
                CNPJ Destinatário / Filial:
              </label>
              <input
                type="text"
                placeholder="Ex: 02.002.002/0002-02"
                value={filters.cnpjDestinatario}
                onChange={(e) => setFilters({ ...filters, cnpjDestinatario: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-indigo-300 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Linha 4: UF */}
            <div className="min-w-0">
              <label className="text-xs uppercase font-semibold text-slate-400 block mb-1.5 truncate">
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

            {/* Linha 4: Data Início */}
            <div className="min-w-0">
              <label className="text-xs uppercase font-semibold text-slate-400 block mb-1.5 truncate">
                Data Inicial Emissão:
              </label>
              <input
                type="date"
                value={filters.dataInicio}
                onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Linha 4: Data Fim */}
            <div className="min-w-0">
              <label className="text-xs uppercase font-semibold text-slate-400 block mb-1.5 truncate">
                Data Final Emissão:
              </label>
              <input
                type="date"
                value={filters.dataFim}
                onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Linha 5: CFOP */}
            <div className="min-w-0">
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 truncate">
                CFOP (ex: 1102, 1551, 1910):
              </label>
              <input
                type="text"
                placeholder="Ex: 1102"
                value={filters.cfop}
                onChange={(e) => setFilters({ ...filters, cfop: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Linha 5: cClassTrib */}
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
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Linha 5: Indicador Onerosidade */}
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

            {/* Linha 5: Situação Doc */}
            <div className="min-w-0">
              <label className="text-xs uppercase font-semibold text-slate-400 block mb-1.5 truncate">
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

            {/* Linha 6: Checkbox Exceções */}
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



      {/* Estado Inicial: Tela Limpa sem busca realizada */}
      {!hasSearched && !loading && (
        <div className="glass-panel rounded-2xl p-12 border border-slate-800 text-center flex flex-col items-center justify-center gap-3 bg-slate-950/60 shadow-2xl">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-cyan-400">
            <FileBarChart className="w-10 h-10 text-cyan-400" />
          </div>
          <h3 className="text-base font-bold text-white">Nenhum relatório gerado no momento</h3>
          <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
            Selecione os parâmetros desejados nos filtros acima (período de emissão, tipo de documento, UF, etc.) e clique no botão <strong className="text-cyan-300">"Buscar Relatório"</strong> para processar e visualizar o gráfico fiscal consolidado e os relatórios analíticos.
          </p>
        </div>
      )}

      {/* Estado de Carregamento */}
      {loading && (
        <div className="glass-panel rounded-2xl p-12 border border-slate-800 text-center flex flex-col items-center justify-center gap-3 bg-slate-950/60 shadow-xl animate-pulse">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <h3 className="text-sm font-bold text-white">Processando extração parametrizada de XMLs...</h3>
          <p className="text-xs text-slate-400">
            Auditando regras de tributação, alíquotas RTC e elegibilidade de crédito.
          </p>
        </div>
      )}

      {/* Exibição dos Dados Apenas Após Busca Realizada */}
      {hasSearched && !loading && (
        <>
          {/* Único Bloco de KPI: Gráfico de Barras Verticais Fiscais */}
          <FiscalVerticalBarChart
            totalOperacoes={chartMetrics.totalOperacoes}
            baseCalculo={chartMetrics.baseCalculo}
            tributosAtuais={chartMetrics.tributosAtuais}
            tributosReforma={chartMetrics.tributosReforma}
            creditoIbsCbs={chartMetrics.creditoIbsCbs}
            totalDocs={totalDbCount > 0 ? totalDbCount : chartMetrics.totalDocs}
            totalItens={totalDbCount > 0 ? totalDbCount : chartMetrics.totalItens}
          />

          {filteredItems.length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 border border-slate-800 text-center flex flex-col items-center justify-center gap-2 bg-slate-950/60 shadow-xl">
              <Search className="w-8 h-8 text-slate-500" />
              <h3 className="text-sm font-bold text-white">Nenhum documento encontrado</h3>
              <p className="text-xs text-slate-400">
                Nenhum XML correspondeu aos filtros aplicados. Tente alterar o período ou limpar filtros restritivos.
              </p>
            </div>
          ) : (
            <>


              {/* Main Report View Content */}
              <div className="space-y-4 w-full min-w-0 max-w-full">
                {activeTab === 'consolidado_mercadorias' && (
                  <RelatorioConsolidadoMercadorias
                    items={filteredItems}
                    dbKpis={dbKpis}
                    onOpenDetail={(it) => setSelectedItemForModal(it)}
                    onOpenLedger={(chave) => handleOpenLedger(chave)}
                    onSyncApuracao={handleSyncApuracao}
                    syncingApuracao={syncingApuracao}
                    viewMode={filters.visaoAnalitica || '360'}
                  />
                )}

                {activeTab === 'consolidado_servicos' && (
                  <RelatorioConsolidadoServicos
                    items={filteredItems}
                    dbKpis={dbKpis}
                    onOpenDetail={(it) => setSelectedItemForModal(it)}
                    onOpenLedger={(chave) => handleOpenLedger(chave)}
                    onSyncApuracao={handleSyncApuracao}
                    syncingApuracao={syncingApuracao}
                  />
                )}

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
              
              {/* Controles de Paginação */}
              {totalDbCount > pageSize && (
                <div className="flex items-center justify-between p-4 mt-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                  <div className="text-xs text-slate-400">
                    Mostrando itens <strong className="text-white">{(currentPage - 1) * pageSize + 1}</strong> a <strong className="text-white">{Math.min(currentPage * pageSize, totalDbCount)}</strong> de <strong className="text-cyan-400">{totalDbCount.toLocaleString('pt-BR')}</strong> totais
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const newPage = Math.max(1, currentPage - 1);
                        setCurrentPage(newPage);
                        handleSearch(activeTab, filters, newPage);
                      }}
                      disabled={currentPage === 1 || loading}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currentPage === 1 || loading ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                    >
                      Anterior
                    </button>
                    <div className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-cyan-400 border border-slate-700">
                      Página {currentPage} de {Math.ceil(totalDbCount / pageSize)}
                    </div>
                    <button
                      onClick={() => {
                        const newPage = Math.min(Math.ceil(totalDbCount / pageSize), currentPage + 1);
                        setCurrentPage(newPage);
                        handleSearch(activeTab, filters, newPage);
                      }}
                      disabled={currentPage >= Math.ceil(totalDbCount / pageSize) || loading}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currentPage >= Math.ceil(totalDbCount / pageSize) || loading ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

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

              {/* Seção Conta Corrente Fiscal & Apuração Assistida: IBS (CGIBS) & CBS (RFB) */}
              <div className="md:col-span-2 p-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 rounded-xl border border-cyan-900/50 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] text-cyan-400 uppercase font-sans font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    Conta Corrente Fiscal & Apuração Assistida: IBS (CGIBS) & CBS (RFB)
                  </div>
                  {selectedItemForModal.statusCreditoCgibs === 'CONFIRMADO' ? (
                    <span className="px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                      🟢 Crédito Confirmado (Débito Fornecedor Extinto)
                    </span>
                  ) : selectedItemForModal.statusCreditoCgibs === 'PENDENTE_EXTINCAO' ? (
                    <span className="px-2.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold">
                      🟡 Pendente de Extinção pelo Fornecedor (Art. 27 LC 215)
                    </span>
                  ) : selectedItemForModal.statusCreditoCgibs === 'UTILIZADO' ? (
                    <span className="px-2.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-bold">
                      🔵 Crédito Já Utilizado na Apuração
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold">
                      ⚪ Aguardando Lote de Sincronismo CGIBS / RFB
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] pt-1.5 border-t border-slate-800/80">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Diagnóstico Oficial (CGIBS / RFB):</span>
                    <span className="text-slate-200 font-sans font-medium">
                      {selectedItemForModal.motivoCreditoCgibs || 'Documento apto para processamento na SEFIN Nacional / RTC'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Identificador da Operação:</span>
                    <span className="text-cyan-300 font-mono">
                      {selectedItemForModal.operacaoId || `OP-${selectedItemForModal.chaveAcesso.substring(25, 34)}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Hash SHA-1 de Integridade:</span>
                    <span className="text-purple-300 font-mono text-[10px] truncate block" title={selectedItemForModal.hashCgibs || 'Aguardando consolidação'}>
                      {selectedItemForModal.hashCgibs ? `${selectedItemForModal.hashCgibs.substring(0, 18)}...` : 'Gerado no MOC RTC (CGIBS/RFB)'}
                    </span>
                  </div>
                </div>
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

      {/* Modal de Detalhamento do Ledger / Apuração Assistida (IBS - CGIBS & CBS - RFB) */}
      {selectedChaveLedger && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-cyan-800/60 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Extrato de Conta-Corrente Fiscal — Apuração Assistida: IBS (CGIBS) & CBS (RFB)
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Chave: {selectedChaveLedger}
                  </p>
                </div>
              </div>

              <button
                onClick={() => { setSelectedChaveLedger(null); setLedgerData(null); }}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingLedger ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
                <span className="text-sm font-semibold text-slate-300">Consultando Conta Corrente Fiscal e Ledger RTC (CGIBS/RFB)...</span>
              </div>
            ) : !ledgerData ? (
              <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 text-center space-y-3">
                <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
                <div className="text-sm font-bold text-slate-200">Operação Ainda Não Sincronizada no Ledger Oficial RTC (CGIBS / RFB)</div>
                <p className="text-xs text-slate-400 max-w-lg mx-auto">
                  Esta chave de documento não possui lançamentos liquidados no extrato de conta corrente fiscal.
                  De acordo com a LC 215/2025 Art. 27, o crédito de IBS (CGIBS) e de CBS (RFB) só pode ser apropriado após a liquidação do imposto pelo fornecedor, split payment ou via recolhimento pelo adquirente (RAD).
                </p>
                <button
                  onClick={handleSyncApuracao}
                  disabled={syncingApuracao}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-lg shadow-cyan-900/30 inline-flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingApuracao ? 'animate-spin' : ''}`} />
                  {syncingApuracao ? 'Sincronizando...' : 'Executar Sincronismo Agora'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Cabeçalho da Operação & Status RAD */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Fornecedor / Tomador</span>
                    <span className="text-xs text-white font-bold block truncate">{ledgerData.operacao?.razao_social_contraparte || '—'}</span>
                    <span className="text-[10px] text-cyan-300 font-mono">{ledgerData.operacao?.cnpj_cpf_contraparte || '—'}</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Status da Operação</span>
                    <span className={`text-xs font-bold block ${
                      ledgerData.operacao?.status === 'LIQUIDADA' ? 'text-emerald-400' :
                      ledgerData.operacao?.status === 'RETIDA_PARCIAL' ? 'text-amber-400' : 'text-slate-300'
                    }`}>
                      {ledgerData.operacao?.status || 'EM PROCESSAMENTO'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Tipo: {ledgerData.operacao?.tipo_operacao || 'ENTRADA'} | Emissão: {ledgerData.operacao?.dth_emissao ? new Date(ledgerData.operacao.dth_emissao).toLocaleDateString('pt-BR') : '—'}
                    </span>
                  </div>
                  <div className={`p-3 rounded-xl border ${
                    ledgerData.operacao?.recurso_financeiro_disponivel_para_transferencia > 0 || ledgerData.operacao?.credito_nao_utilizado > 0
                      ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}>
                    <span className="text-[10px] uppercase font-bold block">Diagnóstico Decisório RAD (Recolhimento Adquirente)</span>
                    <span className="text-xs font-bold block">
                      {ledgerData.operacao?.recurso_financeiro_disponivel_para_transferencia > 0 || ledgerData.operacao?.credito_nao_utilizado > 0
                        ? '✅ Crédito Liberado (Débito Liquidado no CGIBS)'
                        : '⏳ Opção RAD: Débito em Aberto pelo Fornecedor'
                      }
                    </span>
                    <span className="text-[10px]">
                      {ledgerData.operacao?.recurso_financeiro_disponivel_para_transferencia > 0 || ledgerData.operacao?.credito_nao_utilizado > 0
                        ? `Disponível para Apropriação: R$ ${Number(ledgerData.operacao?.recurso_financeiro_disponivel_para_transferencia || ledgerData.operacao?.credito_nao_utilizado).toFixed(2)}`
                        : 'Adquirente pode emitir guia RAD para liquidar o débito e liberar o crédito'}
                    </span>
                  </div>
                </div>

                {/* 7 Campos Financeiros Oficiais do MOC RTC: CGIBS (IBS) & RFB (CBS) */}
                <div className="p-4 bg-slate-950/90 rounded-xl border border-cyan-900/40 space-y-2">
                  <div className="text-[11px] font-bold uppercase text-cyan-400 flex items-center justify-between">
                    <span>Saldos Acumulados no RTC — CGIBS (IBS) & RFB (CBS)</span>
                    <span className="text-[10px] font-mono text-slate-500">MOC Seção 5</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2 text-center">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-[9px] text-slate-400 block truncate" title="Recurso Disponível">Recurso Disp.</span>
                      <strong className="text-xs text-emerald-400 font-mono">
                        R$ {Number(ledgerData.operacao?.recurso_financeiro_disponivel_para_transferencia || 0).toFixed(2)}
                      </strong>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-[9px] text-slate-400 block truncate" title="Recurso a Transferir">A Transferir</span>
                      <strong className="text-xs text-teal-300 font-mono">
                        R$ {Number(ledgerData.operacao?.recurso_financeiro_a_transferir || 0).toFixed(2)}
                      </strong>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-[9px] text-slate-400 block truncate" title="Crédito a Propriar">Créd. a Propriar</span>
                      <strong className="text-xs text-amber-300 font-mono">
                        R$ {Number(ledgerData.operacao?.credito_a_propriar || 0).toFixed(2)}
                      </strong>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-[9px] text-slate-400 block truncate" title="Crédito Não Utilizado">Créd. Não Util.</span>
                      <strong className="text-xs text-cyan-300 font-mono">
                        R$ {Number(ledgerData.operacao?.credito_nao_utilizado || 0).toFixed(2)}
                      </strong>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-[9px] text-slate-400 block truncate" title="Crédito Utilizado">Créd. Utilizado</span>
                      <strong className="text-xs text-purple-300 font-mono">
                        R$ {Number(ledgerData.operacao?.credito_utilizado || 0).toFixed(2)}
                      </strong>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-[9px] text-slate-400 block truncate" title="Débito em Aberto">Déb. em Aberto</span>
                      <strong className="text-xs text-rose-400 font-mono">
                        R$ {Number(ledgerData.operacao?.debito_em_aberto || 0).toFixed(2)}
                      </strong>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-[9px] text-slate-400 block truncate" title="Débito Extinto">Déb. Extinto</span>
                      <strong className="text-xs text-emerald-300 font-mono">
                        R$ {Number(ledgerData.operacao?.debito_extinto || 0).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Tabela Cronológica de Lançamentos no Ledger */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase text-slate-300">
                    Histórico Cronológico do Ledger ({ledgerData.extrato?.length || 0} lançamentos)
                  </div>
                  <div className="border border-slate-800 rounded-xl overflow-x-auto max-h-56">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead className="bg-slate-900 text-slate-400 font-semibold sticky top-0">
                        <tr>
                          <th className="p-2 border-b border-slate-800">Data/Hora</th>
                          <th className="p-2 border-b border-slate-800">Movimentação</th>
                          <th className="p-2 border-b border-slate-800 text-right">Créd. Propriar</th>
                          <th className="p-2 border-b border-slate-800 text-right">Créd. Não Util.</th>
                          <th className="p-2 border-b border-slate-800 text-right">Déb. Extinto</th>
                          <th className="p-2 border-b border-slate-800 text-right">Saldo Disp.</th>
                          <th className="p-2 border-b border-slate-800">Origem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[10px]">
                        {(ledgerData.extrato || []).map((lancto: any, idx: number) => (
                          <tr key={lancto.id || idx} className="hover:bg-slate-900/40">
                            <td className="p-2 text-slate-300 whitespace-nowrap">
                              {lancto.dth_lancto ? new Date(lancto.dth_lancto).toLocaleString('pt-BR') : '—'}
                            </td>
                            <td className="p-2 text-white font-sans font-medium whitespace-nowrap">
                              {lancto.mov}
                            </td>
                            <td className="p-2 text-right text-amber-300">
                              {lancto.credito_a_propriar ? `R$ ${lancto.credito_a_propriar.toFixed(2)}` : '—'}
                            </td>
                            <td className="p-2 text-right text-cyan-300">
                              {lancto.credito_nao_utilizado ? `R$ ${lancto.credito_nao_utilizado.toFixed(2)}` : '—'}
                            </td>
                            <td className="p-2 text-right text-emerald-400">
                              {lancto.debito_extinto ? `R$ ${lancto.debito_extinto.toFixed(2)}` : '—'}
                            </td>
                            <td className="p-2 text-right text-emerald-300 font-bold">
                              R$ {(lancto.saldo_acumulado?.recurso_financeiro_disponivel_para_transferencia ?? 0).toFixed(2)}
                            </td>
                            <td className="p-2 text-slate-500 truncate max-w-[120px]" title={lancto.arquivo_origem}>
                              {lancto.arquivo_origem || 'CGIBS MOC'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => { setSelectedChaveLedger(null); setLedgerData(null); }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                Fechar Ledger
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
