import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { SidebarCertificado } from './components/SidebarCertificado';
import { ConsultaLotePanel } from './components/ConsultaLotePanel';
import { ResultadosTable } from './components/ResultadosTable';
import { DetalhesModal } from './components/DetalhesModal';
import { StatusBar } from './components/StatusBar';
import { DfeManagerPanel } from './components/DfeManagerPanel';
import { EventosDfePanel } from './components/EventosDfePanel';
import { AuditoriaFiscalPanel } from './components/AuditoriaFiscalPanel';
import { RelatoriosXmlPanel } from './components/RelatoriosXmlPanel';
import { AcessoCorporativoModal } from './components/AcessoCorporativoModal';
import { CarteiraCnpjsPanel, INITIAL_TENANTS } from './components/CarteiraCnpjsPanel';
import { ObservabilidadeDlqPanel } from './components/ObservabilidadeDlqPanel';
import { TabelasFiscaisPanel } from './components/TabelasFiscaisPanel';
import { CentralKpisPanel } from './components/CentralKpisPanel';
import { ExportacaoFiscalModal } from './components/ExportacaoFiscalModal';
import { ConectoresMunicipaisPanel } from './components/ConectoresMunicipaisPanel';
import { ApuracaoAssistidaPanel } from './components/ApuracaoAssistidaPanel';
import { SimuladorRegimesPanel } from './components/SimuladorRegimesPanel';
import { CertificadoModal } from './components/CertificadoModal';
import { QueryMode, CertificadoA1, DfeXmlItem, AmbienteSefaz } from './types';
import { formatCNPJ, onlyNumbers } from './utils/cnpj';
import { Search } from 'lucide-react';

import { useAuth } from './contexts/AuthContext';
import { useApi } from './hooks/useApi';
import { useKpis } from './contexts/KpiContext';
import { useBatchProcessing } from './hooks/useBatchProcessing';
import { Login } from './components/Login';
import { hasModuleAccess } from './utils/permissions';

export default function App() {
  const { user, empresaAtiva } = useAuth();
  const { get } = useApi();
  const { kpis, totalGeral } = useKpis();
  const currentKpis = totalGeral || kpis;

  // Initialize activeMode with persistent localStorage state or fallback to central_kpis
  const [activeMode, setActiveMode] = useState<QueryMode>(() => {
    const saved = localStorage.getItem('@RadarFiscal:activeMode') as QueryMode;
    return saved || 'central_kpis';
  });

  // Persist activeMode on navigation (sem recarregar documentos massivos desnecessariamente)
  useEffect(() => {
    if (activeMode) {
      localStorage.setItem('@RadarFiscal:activeMode', activeMode);
    }
  }, [activeMode]);

  // Safeguard: if activeMode is restricted for current user, redirect to first permitted module
  useEffect(() => {
    if (user && !hasModuleAccess(activeMode, user, empresaAtiva)) {
      const fallbackModes: QueryMode[] = [
        'central_kpis', 'dfe_xml', 'relatorios_xml', 'lote', 'apuracao_assistida', 'detalhada'
      ];
      const allowedFallback = fallbackModes.find(m => hasModuleAccess(m, user, empresaAtiva)) || 'central_kpis';
      setActiveMode(allowedFallback);
    }
  }, [user?.id, user?.perfil, empresaAtiva?.id, empresaAtiva?.modulosPermitidos, activeMode]);

  // Persistent Sidebar Collapse State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('@RadarFiscal:sidebarCollapsed') === 'true';
  });

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('@RadarFiscal:sidebarCollapsed', String(next));
      return next;
    });
  };

  // Corporate Access & User State
  const [selectedTenantCnpj, setSelectedTenantCnpj] = useState<string>('');

  // SEFAZ Environment State (Homologação = tpAmb 2, Produção = tpAmb 1)
  const [ambienteSefaz, setAmbienteSefaz] = useState<AmbienteSefaz>('producao');

  // Certificate State (starts empty until user registers company and activates .PFX)
  const [certificado, setCertificado] = useState<CertificadoA1>({
    fileName: '',
    cnpj: '',
    razãoSocial: '',
    tipo: 'e-CNPJ A1',
    validade: '',
    status: 'pendente'
  });

  // DFe XML List State (starts clean without fictitious demo items)
  const [dfeList, setDfeList] = useState<DfeXmlItem[]>([]);
  const [selectedDfeForEvents, setSelectedDfeForEvents] = useState<DfeXmlItem | null>(null);

  // Limpa seleção e lista quando a empresa ativa mudar para garantir isolamento multi-tenant
  useEffect(() => {
    setDfeList([]);
    setSelectedDfeForEvents(null);
  }, [empresaAtiva?.id]);

  // Modal State for Turbo Fiscal .ZIP Export
  const [isExportFiscalModalOpen, setIsExportFiscalModalOpen] = useState(false);

  // Modal State for Digital Certificate (e-CNPJ A1)
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  // Settings
  const [rateLimit, setRateLimit] = useState<number>(8); // 8 req/s default

  // Batch Processing Hook (encapsula motor de lotes, temporizador, estados e consultas instantâneas)
  const {
    items,
    selectedFileName,
    isProcessing,
    isPaused,
    currentProcessingCnpj,
    elapsedSeconds,
    selectedItem,
    setSelectedItem,
    quickInput,
    setQuickInput,
    quickUf,
    setQuickUf,
    isQuickLoading,
    stats,
    startBatchProcessing,
    handlePause,
    handleCancel,
    handleClear,
    handleFileUpload,
    handleExecuteSingleInstant,
    handleRefreshSingleItem,
    handleExportToExcel,
  } = useBatchProcessing({
    rateLimit,
    onNavigateToLote: () => setActiveMode('lote'),
  });

  // Sincronização unificada do certificado da empresa ativa
  const syncCertificado = useCallback(async () => {
    if (!empresaAtiva) {
      setCertificado({
        fileName: '',
        cnpj: '',
        razãoSocial: '',
        tipo: 'e-CNPJ A1',
        validade: '',
        status: 'pendente',
        valido: false
      });
      return;
    }

    try {
      const res = await get<{ success: boolean; data: any[] }>('/tenants');
      if (res.ok && res.data?.data) {
        const tenant = res.data.data.find((t: any) =>
          t.id === empresaAtiva.id || t.cnpjCompleto === empresaAtiva.cnpjCompleto
        );
        if (tenant && tenant.certificadoA1) {
          const isValido = tenant.certificadoA1.status === 'valido' ||
            (tenant.certificadoA1.validade && new Date(tenant.certificadoA1.validade) >= new Date());
          setCertificado({
            fileName: tenant.certificadoA1.fileName,
            cnpj: tenant.cnpjCompleto,
            razãoSocial: tenant.razaoSocial,
            tipo: 'e-CNPJ A1',
            validade: tenant.certificadoA1.validade,
            status: isValido ? 'valido' : 'pendente',
            valido: isValido,
            emissor: tenant.certificadoA1.emissor,
            impressaoDigital: tenant.certificadoA1.impressaoDigital
          });
          return;
        }
      }
      setCertificado({
        fileName: '',
        cnpj: empresaAtiva.cnpjCompleto || '',
        razãoSocial: empresaAtiva.razaoSocial || '',
        tipo: 'e-CNPJ A1',
        validade: '',
        status: 'pendente',
        valido: false
      });
    } catch (err) {
      console.error('Erro ao sincronizar certificado:', err);
    }
  }, [empresaAtiva?.id, empresaAtiva?.cnpjCompleto, get]);

  // Carregamento paginado/otimizado de documentos (limite padrão seguro: 1000)
  const loadDocumentos = useCallback(async () => {
    if (!empresaAtiva) return;
    const res = await get<{ success: boolean; data: any[]; total?: number }>('/upload/documentos?limit=1000');
    if (res.ok && res.data?.data) {
      const mappedList: DfeXmlItem[] = res.data.data.map(doc => {
        const docTotal = Number(doc.valor_total) || 0;
        const cbsVal = doc.valor_cbs !== null && doc.valor_cbs !== undefined ? Number(doc.valor_cbs) : 0;
        const ibsVal = doc.valor_ibs !== null && doc.valor_ibs !== undefined ? Number(doc.valor_ibs) : 0;
        const numSerieParts = (doc.numero_serie || '').split(' / ');
        
        const rawTipo = (doc.tipo_doc || '').toString();
        const tipoCanonico: any = rawTipo.toUpperCase().includes('NFS') ? 'NFSe' : (rawTipo === 'CTe' || rawTipo === 'CT-e' ? 'CTe' : (rawTipo === 'NFe' || rawTipo === 'NF-e' ? 'NFe' : rawTipo || 'NFe'));

        return {
          id: doc.id,
          chaveAcesso: doc.chave_acesso,
          tipo: tipoCanonico,
          numero: numSerieParts[0] || (doc.chave_acesso ? doc.chave_acesso.substring(25, 34) : '1'),
          serie: numSerieParts[1] || '1',
          dataEmissao: doc.data_emissao ? String(doc.data_emissao).split('T')[0] : new Date().toISOString().split('T')[0],
          emitenteCnpj: doc.fornecedor_cnpj || '00000000000000',
          emitenteNome: doc.fornecedor_razao || 'FORNECEDOR',
          emitenteUf: doc.fornecedor_uf || 'SP',
          destinatarioCnpj: doc.cliente_cnpj || '00000000000000',
          destinatarioNome: doc.cliente_razao || 'CLIENTE',
          destinatarioUf: doc.cliente_uf || 'SP',
          valorTotal: docTotal,
          valorIcms: Number(doc.valor_icms) || 0,
          valorIpi: Number(doc.valor_ipi) || 0,
          valorPis: Number(doc.valor_pis) || 0,
          valorCofins: Number(doc.valor_cofins) || 0,
          aliquotaCbs: docTotal > 0 && cbsVal > 0 ? Number(((cbsVal / docTotal) * 100).toFixed(2)) : 0,
          valorCbs: cbsVal,
          aliquotaIbs: docTotal > 0 && ibsVal > 0 ? Number(((ibsVal / docTotal) * 100).toFixed(2)) : 0,
          valorIbs: ibsVal,
          valorImpostoSeletivo: Number(doc.valor_is) || 0,
          valorIrrf: Number(doc.valor_irrf) || 0,
          valorInssRetido: Number(doc.valor_inss) || 0,
          valorIssRetido: Number(doc.valor_iss) || 0,
          valorCsllRetido: Number(doc.valor_csll) || 0,
          valorPisRetido: Number(doc.valor_pis) || 0,
          valorCofinsRetido: Number(doc.valor_cofins) || 0,
          eventoUltimo: doc.evento_ultimo || 'Autorizado o uso do DF-e',
          situacaoManifestacao: doc.situacao_manifestacao || 'sem_manifestacao',
          alertaFraude: Boolean(doc.alerta_fraude),
          statusAuditoria: doc.alerta_fraude ? 'inconsistente' : 'conforme',
          alertasAuditoria: doc.alerta_fraude ? ['🚨 ALERTA CRÍTICO: Cliente manifestou Desconhecimento da Operação (210220)'] : [],
          statusSincronizacaoErp: 'pendente',
          xmlRaw: doc.xml_raw || '',
          downloadAt: doc.download_at || '',
        };
      });
      setDfeList(mappedList);
    }
  }, [empresaAtiva, get]);

  // Efeito único de sincronização quando a empresa ativa mudar
  useEffect(() => {
    if (empresaAtiva?.cnpjCompleto) {
      setSelectedTenantCnpj(empresaAtiva.cnpjCompleto);
    } else {
      setSelectedTenantCnpj('');
    }

    if (empresaAtiva?.id || empresaAtiva?.cnpjCompleto) {
      syncCertificado();
      loadDocumentos();
    } else {
      setCertificado({
        fileName: '',
        cnpj: '',
        razãoSocial: '',
        tipo: 'e-CNPJ A1',
        validade: '',
        status: 'pendente',
        valido: false
      });
    }
  }, [empresaAtiva?.id, empresaAtiva?.cnpjCompleto, syncCertificado, loadDocumentos]);

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen h-dvh w-screen overflow-hidden bg-[#0a0f18] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Top Header (Fixed at top) */}
      <Header
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        certificado={certificado}
        totalItems={items.length}
        onOpenExportFiscal={() => setIsExportFiscalModalOpen(true)}
        ambienteSefaz={ambienteSefaz}
        setAmbienteSefaz={setAmbienteSefaz}
        onOpenCertModal={() => setIsCertModalOpen(true)}
      />

      {/* Main Body Workspace Container (fills remaining viewport height) */}
      <div className="flex-1 w-full max-w-[1800px] mx-auto px-4 lg:px-6 pt-4 pb-2 flex flex-col overflow-hidden min-h-0 min-w-0">
        
        {/* Content Layout: Independent Scrollable Sidebar + Independent Scrollable Main Workspace */}
        <div className="flex flex-col lg:flex-row gap-6 w-full flex-1 min-h-0 min-w-0 overflow-hidden">
          
          {/* Left Config Sidebar with Module Menu (Independent Scroll & Collapsible) */}
          <div className={`transition-all duration-300 ease-in-out flex-shrink-0 h-full overflow-y-auto custom-scrollbar pr-1 pb-4 ${
            isSidebarCollapsed ? 'w-full lg:w-20' : 'w-full lg:w-80'
          }`}>
            <SidebarCertificado
              activeMode={activeMode}
              setActiveMode={setActiveMode}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={handleToggleSidebar}
              certificado={certificado}
              setCertificado={setCertificado}
              rateLimit={rateLimit}
              setRateLimit={setRateLimit}
              isProcessing={isProcessing}
              isPaused={isPaused}
              stats={stats}
              onStart={startBatchProcessing}
              onPause={handlePause}
              onCancel={handleCancel}
              onClear={handleClear}
              onExport={handleExportToExcel}
            />
          </div>

          {/* Right Main Panels Area (Independent Scroll) */}
          <main className="flex-1 w-full h-full overflow-y-auto custom-scrollbar pr-2 pb-6 min-w-0 flex flex-col gap-6">
            
            {/* Mode 1: Lote Excel */}
            {activeMode === 'lote' && (
              <div className="flex flex-col gap-4">
                <ConsultaLotePanel
                  onFileUpload={handleFileUpload}
                  fileName={selectedFileName}
                  stats={stats}
                  rateLimit={rateLimit}
                  setRateLimit={setRateLimit}
                  isProcessing={isProcessing}
                  isPaused={isPaused}
                  onStart={startBatchProcessing}
                  onPause={handlePause}
                  onCancel={handleCancel}
                  onClear={handleClear}
                  onExport={handleExportToExcel}
                />

                {/* Barra de Progresso, Tempo e ETA exclusiva de Consulta em Lote */}
                <StatusBar
                  isProcessing={isProcessing}
                  isPaused={isPaused}
                  stats={stats}
                  currentProcessingCnpj={currentProcessingCnpj}
                  elapsedSeconds={elapsedSeconds}
                  rateLimit={rateLimit}
                />
              </div>
            )}

            {/* Mode 4: XML DF-e Captura & Reforma Tributária */}
            {activeMode === 'dfe_xml' && (
              <DfeManagerPanel
                dfeList={dfeList}
                setDfeList={setDfeList}
                onOpenEvents={(item) => {
                  setSelectedDfeForEvents(item);
                  setActiveMode('eventos_dfe');
                }}
                certificado={certificado}
                ambienteSefaz={ambienteSefaz}
              />
            )}

            {/* Mode 5: Eventos de DF-e */}
            {activeMode === 'eventos_dfe' && (
              <EventosDfePanel
                selectedDfe={selectedDfeForEvents}
                dfeList={dfeList}
                onEventProcessed={(chave, evt) => {
                  setDfeList(prev => prev.map(d => d.chaveAcesso === chave ? { ...d, eventoUltimo: evt as any } : d));
                }}
              />
            )}


            {/* Mode: Conectores Municipais (Prefeituras) */}
            {activeMode === 'conectores_municipais' && (
              <ConectoresMunicipaisPanel />
            )}

            {/* Mode 0: Central de KPIs & Dashboards Executivos (BI Fiscal) */}
            {activeMode === 'central_kpis' && (
              <CentralKpisPanel
                dfeList={dfeList}
                selectedTenantCnpj={selectedTenantCnpj}
                empresaAtiva={empresaAtiva}
              />
            )}

            {/* Mode 7: Auditoria Fiscal & Cruzamento Cadastral */}
            {activeMode === 'auditoria_fiscal' && (
              <AuditoriaFiscalPanel dfeList={dfeList} lookupItems={items} />
            )}

            {/* Mode 11: Observabilidade Técnica, Filas & Dead Letter Queue (DLQ) */}
            {activeMode === 'observabilidade_dlq' && (
              <ObservabilidadeDlqPanel />
            )}

            {/* Mode 8: Relatórios Múltiplos com Base nos XMLs de Entradas */}
            {activeMode === 'relatorios_xml' && (
              <RelatoriosXmlPanel dfeList={dfeList} />
            )}

            {/* Mode: Apuração Assistida IBS / CBS & Conta Corrente Fiscal (CGIBS / RTC) */}
            {activeMode === 'apuracao_assistida' && (
              <ApuracaoAssistidaPanel empresaAtiva={empresaAtiva} />
            )}

            {/* Mode: Modelador Estratégico de Regimes & Ponto de Equilíbrio CPP */}
            {activeMode === 'simulador_regimes' && (
              <SimuladorRegimesPanel empresaAtiva={empresaAtiva} />
            )}

            {/* Mode 12: Parâmetros & Tabelas Fiscais */}
            {activeMode === 'tabelas_fiscais' && (
              <TabelasFiscaisPanel />
            )}

            {/* Mode 9: Acesso Corporativo & 2FA / Perfis Admin */}
            {activeMode === 'acesso_corporativo' && (
              <AcessoCorporativoModal />
            )}

            {/* Mode 10: Carteira Multi-Tenant de CNPJs e Certificados A1 */}
            {activeMode === 'carteira_cnpjs' && (
              <CarteiraCnpjsPanel
                selectedTenantCnpj={selectedTenantCnpj}
                onSelectTenantCnpj={(cnpj) => {
                  setSelectedTenantCnpj(cnpj);
                  // Update current active certificate display
                  setCertificado(prev => ({
                    ...prev,
                    cnpj: cnpj,
                    razãoSocial: `CLIENTE ALOCADO (${cnpj})`
                  }));
                }}
                certificado={certificado}
                setCertificado={setCertificado}
              />
            )}


            {/* Mode 3: Quick Single Search Bar */}
            {activeMode === 'detalhada' && (
              <div className="glass-panel-glow rounded-2xl p-6 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-cyan-400" />
                  Consulta Rápida Direta de CNPJ / IE
                </h3>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex-1 relative w-full">
                    <input
                      type="text"
                      placeholder="Digite o CNPJ (ex: 01.001.001/0001-91)"
                      value={quickInput}
                      onChange={(e) => setQuickInput(formatCNPJ(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-cyan-500 placeholder-slate-600"
                    />
                  </div>

                  <select
                    value={quickUf}
                    onChange={(e) => setQuickUf(e.target.value)}
                    className="w-full sm:w-24 shrink-0 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-3 text-sm text-center font-bold text-cyan-300 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="">UF</option>
                    {['SP', 'RJ', 'MG', 'RS', 'PR', 'DF', 'BA', 'SC', 'GO', 'PE', 'CE', 'ES', 'MT', 'MS', 'PA', 'AM', 'MA', 'PB', 'RN', 'AL', 'SE', 'PI', 'RO', 'TO', 'AC', 'AP', 'RR'].map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleExecuteSingleInstant(quickInput, quickUf)}
                    disabled={isQuickLoading || onlyNumbers(quickInput).length < 14}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 transition-all cursor-pointer disabled:opacity-40 shrink-0"
                  >
                    {isQuickLoading ? 'Consultando...' : 'Consultar Agora'}
                  </button>
                </div>
              </div>
            )}

            {/* Results Grid Table (for Lote, Avulsa, Detalhada) */}
            {(activeMode === 'lote' || activeMode === 'avulsa' || activeMode === 'detalhada') && (
              <ResultadosTable
                items={items}
                onSelectItem={(item) => setSelectedItem(item)}
                onRefreshItem={handleRefreshSingleItem}
              />
            )}

          </main>
        </div>



      </div>

      {/* Ficha Cadastral Detailed Modal */}
      <DetalhesModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />

      {/* Turbo Fiscal .ZIP Exporter Modal */}
      <ExportacaoFiscalModal
        isOpen={isExportFiscalModalOpen}
        onClose={() => setIsExportFiscalModalOpen(false)}
        totalDocsAvailable={currentKpis?.totalDocs || dfeList.length || 21345}
      />

      {/* Certificado Digital A1 Modal */}
      <CertificadoModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        empresa={empresaAtiva}
        certificado={certificado}
        onCertificadoUpdated={(novoCert) => {
          setCertificado(novoCert);
        }}
      />

    </div>
  );
}
