import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { SidebarCertificado } from './components/SidebarCertificado';
import { ConsultaLotePanel } from './components/ConsultaLotePanel';
import { ResultadosTable } from './components/ResultadosTable';
import { DetalhesModal } from './components/DetalhesModal';
import { StatusBar } from './components/StatusBar';
import { DfeManagerPanel } from './components/DfeManagerPanel';
import { EventosDfePanel } from './components/EventosDfePanel';
import { ErpIntegrationPanel } from './components/ErpIntegrationPanel';
import { AuditoriaFiscalPanel } from './components/AuditoriaFiscalPanel';
import { RelatoriosXmlPanel } from './components/RelatoriosXmlPanel';
import { ConfigDiretorioModal } from './components/ConfigDiretorioModal';
import { AcessoCorporativoModal } from './components/AcessoCorporativoModal';
import { CarteiraCnpjsPanel, INITIAL_TENANTS } from './components/CarteiraCnpjsPanel';
import { ParceirosNegocioPanel } from './components/ParceirosNegocioPanel';
import { ObservabilidadeDlqPanel } from './components/ObservabilidadeDlqPanel';
import { TabelasFiscaisPanel } from './components/TabelasFiscaisPanel';
import { QueryMode, CertificadoA1, CnpjLookupItem, BatchStats, DfeXmlItem, CnpjRaizDirectoryConfig, AmbienteSefaz, UsuarioCorporativo } from './types';
import { DEMO_CNPJS, queryCnpjsData, formatCNPJ, onlyNumbers } from './utils/cnpj';
import { DEMO_DFE_ITEMS } from './utils/xmlParser';
import { parseExcelFile, exportToExcel } from './utils/excel';
import { Search, ShieldCheck, Globe, AlertTriangle } from 'lucide-react';

import { useAuth } from './contexts/AuthContext';
import { useApi } from './hooks/useApi';
import { Login } from './components/Login';

export default function App() {
  const { user, empresaAtiva } = useAuth();
  const { get } = useApi();
  const [activeMode, setActiveMode] = useState<QueryMode>('carteira_cnpjs');

  // Corporate Access & User State
  const [selectedTenantCnpj, setSelectedTenantCnpj] = useState<string>('');

  // SEFAZ Environment State (Homologação = tpAmb 2, Produção = tpAmb 1)
  const [ambienteSefaz, setAmbienteSefaz] = useState<AmbienteSefaz>('homologacao');

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

  // Directory Storage Configuration State by Root CNPJ (starts empty)
  const [isDirConfigOpen, setIsDirConfigOpen] = useState<boolean>(false);
  const [directoryConfigs, setDirectoryConfigs] = useState<CnpjRaizDirectoryConfig[]>([]);

  // Settings
  const [rateLimit, setRateLimit] = useState<number>(8); // 8 req/s default

  // Batch Items Data State
  const [items, setItems] = useState<CnpjLookupItem[]>([]);
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  // Execution Processing Controls
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentCnpjIndex, setCurrentCnpjIndex] = useState<number>(0);
  const [currentProcessingCnpj, setCurrentProcessingCnpj] = useState<string>('');

  // Stopwatch timer
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Selected Item for Detail Modal
  const [selectedItem, setSelectedItem] = useState<CnpjLookupItem | null>(null);

  // Quick Instant Search Input for Tab 3
  const [quickInput, setQuickInput] = useState<string>('');
  const [quickUf, setQuickUf] = useState<string>('SP');
  const [isQuickLoading, setIsQuickLoading] = useState<boolean>(false);

  // Ref for timer
  const timerRef = useRef<any>(null);
  const processingRef = useRef<boolean>(false);
  const pausedRef = useRef<boolean>(false);

  // Sync selected tenant with active empresa in context
  useEffect(() => {
    if (empresaAtiva?.cnpjCompleto) {
      setSelectedTenantCnpj(empresaAtiva.cnpjCompleto);
    } else {
      setSelectedTenantCnpj('');
    }
  }, [empresaAtiva?.cnpjCompleto]);

  const loadDocumentos = async () => {
    if (!empresaAtiva) return;
    const res = await get<{ success: boolean; data: any[] }>('/upload/documentos');
    if (res.ok && res.data?.data) {
      const mappedList: DfeXmlItem[] = res.data.data.map(doc => ({
        id: doc.id,
        chaveAcesso: doc.chave_acesso,
        tipo: doc.tipo_doc as any,
        numero: doc.numero_serie.split(' / ')[0] || '',
        serie: doc.numero_serie.split(' / ')[1] || '',
        dataEmissao: doc.data_emissao,
        emitenteCnpj: doc.fornecedor_cnpj,
        emitenteNome: doc.fornecedor_razao,
        emitenteUf: doc.fornecedor_uf,
        destinatarioCnpj: doc.cliente_cnpj,
        destinatarioNome: doc.cliente_razao,
        destinatarioUf: doc.cliente_uf,
        valorTotal: doc.valor_total,
        valorIcms: 0,
        valorIpi: 0,
        valorPis: 0,
        valorCofins: 0,
        aliquotaCbs: 8.8,
        valorCbs: doc.valor_total * 0.088,
        aliquotaIbs: 17.7,
        valorIbs: doc.valor_total * 0.177,
        valorImpostoSeletivo: 0,
        statusAuditoria: 'conforme',
        alertasAuditoria: [],
        statusSincronizacaoErp: 'pendente'
      }));
      setDfeList(mappedList);
    }
  };

  useEffect(() => {
    if (empresaAtiva?.id) {
      loadDocumentos();
    }
  }, [empresaAtiva?.id]);

  const loadDemoBatch = () => {
    const demoList: CnpjLookupItem[] = DEMO_CNPJS.map((item, idx) => ({
      id: `demo-${idx + 1}-${Date.now()}`,
      cnpj: item.cnpj,
      uf: item.uf,
      statusConsulta: 'pendente'
    }));

    setItems(demoList);
    setSelectedFileName('Lote_Exemplo_Demonstrativo.xlsx');
    setCurrentCnpjIndex(0);
    setElapsedSeconds(0);
  };

  // Stopwatch effect
  useEffect(() => {
    if (isProcessing && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isProcessing, isPaused]);

  // Keep refs synced with state
  useEffect(() => {
    processingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  // Main Batch Processing Engine Loop
  const startBatchProcessing = async () => {
    if (items.length === 0) return;

    // Check if there are any non-completed items
    const hasPending = items.some(it => it.statusConsulta === 'pendente' || it.statusConsulta === 'erro');
    if (!hasPending) {
      // If all items were completed, reset pending status to allow re-running
      setItems(prev => prev.map(it => ({ ...it, statusConsulta: 'pendente' })));
    }

    setIsProcessing(true);
    setIsPaused(false);
    processingRef.current = true;
    pausedRef.current = false;

    let idx = 0;

    while (idx < items.length && processingRef.current) {
      if (pausedRef.current) {
        await new Promise(res => setTimeout(res, 200));
        continue;
      }

      // Re-read current items array length
      const currentItem = items[idx];
      if (!currentItem) break;

      if (currentItem.statusConsulta === 'sucesso') {
        idx++;
        setCurrentCnpjIndex(idx);
        continue;
      }

      setCurrentProcessingCnpj(currentItem.cnpj);

      // Update item state to 'processando'
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, statusConsulta: 'processando' } : it));

      // Perform lookup query
      try {
        const result = await queryCnpjsData(currentItem.cnpj, currentItem.uf);

        // Update item with result
        setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...result, statusConsulta: 'sucesso' } : it));
      } catch (err) {
        setItems(prev => prev.map((it, i) => i === idx ? {
          ...it,
          statusConsulta: 'erro',
          mensagemErro: 'Falha de comunicação com SEFAZ'
        } : it));
      }

      idx++;
      setCurrentCnpjIndex(idx);

      // Respect rate limit delay (e.g. 1000ms / rateLimit)
      const delayMs = Math.max(40, Math.floor(1000 / rateLimit));
      await new Promise(res => setTimeout(res, delayMs));
    }

    setIsProcessing(false);
    processingRef.current = false;
    setCurrentProcessingCnpj('');
  };

  const handlePause = () => {
    setIsPaused(prev => {
      const next = !prev;
      pausedRef.current = next;
      return next;
    });
  };

  const handleCancel = () => {
    setIsProcessing(false);
    setIsPaused(false);
    processingRef.current = false;
    pausedRef.current = false;
    setCurrentProcessingCnpj('');
  };

  const handleClear = () => {
    handleCancel();
    setItems([]);
    setSelectedFileName('');
    setCurrentCnpjIndex(0);
    setElapsedSeconds(0);
  };

  const handleFileUpload = async (file: File) => {
    try {
      setSelectedFileName(file.name);
      const parsed = await parseExcelFile(file);

      const newItems: CnpjLookupItem[] = parsed.map((p, idx) => ({
        id: `file-${idx + 1}-${Date.now()}`,
        cnpj: p.cnpj,
        uf: p.uf,
        statusConsulta: 'pendente'
      }));

      setItems(newItems);
      setCurrentCnpjIndex(0);
      setElapsedSeconds(0);
    } catch (err) {
      alert('Erro ao carregar o arquivo Excel/CSV. Verifique o formato.');
    }
  };

  const handleAddItemsFromAvulsa = (newRows: Array<{ cnpj: string; uf: string }>) => {
    const formattedNewItems: CnpjLookupItem[] = newRows.map((r, idx) => ({
      id: `avulsa-${idx + 1}-${Date.now()}`,
      cnpj: r.cnpj,
      uf: r.uf,
      statusConsulta: 'pendente'
    }));

    setItems(prev => [...prev, ...formattedNewItems]);
    setActiveMode('lote');
  };

  const handleExecuteSingleInstant = async (cnpj: string, uf: string) => {
    const clean = onlyNumbers(cnpj);
    if (clean.length < 14) return;

    setIsQuickLoading(true);
    const formatted = formatCNPJ(clean);
    const result = await queryCnpjsData(formatted, uf);

    const fullItem: CnpjLookupItem = {
      id: `instant-${Date.now()}`,
      cnpj: formatted,
      uf,
      ...result,
      statusConsulta: 'sucesso'
    } as CnpjLookupItem;

    // Add to items list if not present
    setItems(prev => [fullItem, ...prev]);
    setSelectedItem(fullItem);
    setIsQuickLoading(false);
  };

  const handleRefreshSingleItem = async (id: string) => {
    const target = items.find(it => it.id === id);
    if (!target) return;

    setItems(prev => prev.map(it => it.id === id ? { ...it, statusConsulta: 'processando' } : it));
    const result = await queryCnpjsData(target.cnpj, target.uf);
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...result, statusConsulta: 'sucesso' } : it));
  };

  // Compute stats
  const stats: BatchStats = {
    total: items.length,
    sucesso: items.filter(i => i.statusConsulta === 'sucesso').length,
    erro: items.filter(i => i.statusConsulta === 'erro').length,
    pendente: items.filter(i => i.statusConsulta === 'pendente').length,
    processando: items.filter(i => i.statusConsulta === 'processando').length
  };

  if (!user) {
    return <Login />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0a0f18] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Top Header (Fixed at top) */}
      <Header
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        certificado={certificado}
        totalItems={items.length}
        onOpenDirConfig={() => setIsDirConfigOpen(true)}
        ambienteSefaz={ambienteSefaz}
        setAmbienteSefaz={setAmbienteSefaz}
      />

      {/* Main Body Workspace Container (fills remaining viewport height) */}
      <div className="flex-1 w-full max-w-[1800px] mx-auto px-4 lg:px-6 pt-4 pb-2 flex flex-col overflow-hidden min-h-0 min-w-0">
        
        {/* Content Layout: Independent Scrollable Sidebar + Independent Scrollable Main Workspace */}
        <div className="flex flex-col lg:flex-row gap-6 w-full flex-1 min-h-0 min-w-0 overflow-hidden">
          
          {/* Left Config Sidebar with Module Menu (Independent Scroll) */}
          <div className="w-full lg:w-80 flex-shrink-0 h-full overflow-y-auto custom-scrollbar pr-1 pb-4">
            <SidebarCertificado
              activeMode={activeMode}
              setActiveMode={setActiveMode}
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
              onExport={() => exportToExcel(items)}
            />
          </div>

          {/* Right Main Panels Area (Independent Scroll) */}
          <main className="flex-1 w-full h-full overflow-y-auto custom-scrollbar pr-2 pb-6 min-w-0 flex flex-col gap-6">
            
            {/* Mode 1: Lote Excel */}
            {activeMode === 'lote' && (
              <ConsultaLotePanel
                onFileUpload={handleFileUpload}
                fileName={selectedFileName}
                stats={stats}
                onLoadDemoBatch={loadDemoBatch}
                rateLimit={rateLimit}
                setRateLimit={setRateLimit}
                isProcessing={isProcessing}
                isPaused={isPaused}
                onStart={startBatchProcessing}
                onPause={handlePause}
                onCancel={handleCancel}
                onClear={handleClear}
                onExport={() => exportToExcel(items)}
              />
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
                onSyncErp={(item) => {
                  setActiveMode('integracao_erp');
                }}
                directoryConfigs={directoryConfigs}
                onOpenDirConfig={() => setIsDirConfigOpen(true)}
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

            {/* Mode 6: Integração ERP (SAP, Webhooks) */}
            {activeMode === 'integracao_erp' && (
              <ErpIntegrationPanel dfeList={dfeList} />
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

            {/* Mode: Dados Mestres & Cadastro Fiscal de Parceiros de Negócio (MDM) */}
            {activeMode === 'parceiros_negocio' && (
              <ParceirosNegocioPanel />
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
                      placeholder="Digite o CNPJ (ex: 00.000.000/0001-91)"
                      value={quickInput}
                      onChange={(e) => setQuickInput(formatCNPJ(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-cyan-500 placeholder-slate-600"
                    />
                  </div>

                  <select
                    value={quickUf}
                    onChange={(e) => setQuickUf(e.target.value)}
                    className="bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    {['SP', 'RJ', 'MG', 'RS', 'PR', 'DF', 'BA', 'SC', 'GO', 'PE', 'CE', 'ES', 'MT', 'MS', 'PA', 'AM', 'MA', 'PB', 'RN', 'AL', 'SE', 'PI', 'RO', 'TO', 'AC', 'AP', 'RR'].map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleExecuteSingleInstant(quickInput, quickUf)}
                    disabled={isQuickLoading || onlyNumbers(quickInput).length < 14}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 transition-all cursor-pointer disabled:opacity-40"
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

        {/* Footer Status Engine Bar */}
        <div className="shrink-0 pt-2">
          <StatusBar
            isProcessing={isProcessing}
            isPaused={isPaused}
            stats={stats}
            currentProcessingCnpj={currentProcessingCnpj}
            elapsedSeconds={elapsedSeconds}
            rateLimit={rateLimit}
          />
        </div>

      </div>

      {/* Ficha Cadastral Detailed Modal */}
      <DetalhesModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />

      {/* Directory Storage Configuration Modal by Root CNPJ */}
      <ConfigDiretorioModal
        isOpen={isDirConfigOpen}
        onClose={() => setIsDirConfigOpen(false)}
        configs={directoryConfigs}
        onSaveConfigs={(updated) => {
          setDirectoryConfigs(updated);
        }}
      />

    </div>
  );
}
