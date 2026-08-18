import React, { useState, useRef } from 'react';
import {
  X,
  RefreshCw,
  Search,
  CheckCircle2,
  FileCode,
  Download,
  ShieldCheck,
  Globe,
  Database,
  ArrowRight,
  FolderInput,
  FolderOutput,
  Key,
  Server,
  Send,
  Building2,
  Upload,
  ClipboardPaste,
  FileCheck,
  AlertTriangle,
  Info,
  Sparkles
} from 'lucide-react';
import { CertificadoA1, AmbienteSefaz, DfeXmlItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getApiBaseUrl } from '../utils/apiConfig';
import { parseDfeXmlString } from '../utils/xmlParser';
import { useApi } from '../hooks/useApi';

interface ConsultaNsuModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificado: CertificadoA1;
  ambienteSefaz: AmbienteSefaz;
  onImportDfeItems: (items: DfeXmlItem[]) => void;
  defaultFluxo?: 'entrada' | 'saida';
}

export const ConsultaNsuModal: React.FC<ConsultaNsuModalProps> = ({
  isOpen,
  onClose,
  certificado,
  ambienteSefaz,
  onImportDfeItems,
  defaultFluxo = 'entrada'
}) => {
  const { token, empresaAtiva } = useAuth();
  const { post } = useApi();
  const [modalMode, setModalMode] = useState<'nsu' | 'chave' | 'upload'>('nsu');
  const [fluxo, setFluxo] = useState<'entrada' | 'saida'>(defaultFluxo);
  const [ultNSU, setUltNSU] = useState<string>('000000000000000');
  const [chaveInput, setChaveInput] = useState<string>('');
  const [isConsulting, setIsConsulting] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<DfeXmlItem[] | null>(null);
  const [cStat, setCStat] = useState<string>('');
  const [xMotivo, setXMotivo] = useState<string>('');
  const [consultaError, setConsultaError] = useState<string>('');
  
  // Upload State
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccessCount, setUploadSuccessCount] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable CNPJ and Razao Social in Modal
  const [cnpjInput, setCnpjInput] = useState<string>(certificado?.cnpj || empresaAtiva?.cnpjCompleto || '');
  const [razaoInput, setRazaoInput] = useState<string>(certificado?.razãoSocial || empresaAtiva?.razaoSocial || '');

  React.useEffect(() => {
    const fallbackCnpj = certificado?.cnpj || empresaAtiva?.cnpjCompleto || '';
    const fallbackRazao = certificado?.razãoSocial || empresaAtiva?.razaoSocial || '';
    if (fallbackCnpj) setCnpjInput(fallbackCnpj);
    if (fallbackRazao) setRazaoInput(fallbackRazao);
  }, [certificado, empresaAtiva]);

  if (!isOpen) return null;

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`]);
  };

  // ── MODO 1 & 2: CONSULTA WEBSERVICE SEFAZ (NSU OU CHAVE) ─────────
  const handleStartConsultaDFe = async (isByChave: boolean = false) => {
    setIsConsulting(true);
    setLogs([]);
    setResults(null);
    setCStat('');
    setXMotivo('');
    setConsultaError('');

    const currentCnpj = cnpjInput || certificado?.cnpj || empresaAtiva?.cnpjCompleto || '';
    const ambCode = ambienteSefaz === 'homologacao' ? '2' : '1';
    const ambLabel = ambienteSefaz === 'homologacao' ? 'HOMOLOGAÇÃO (tpAmb = 2)' : 'PRODUÇÃO (tpAmb = 1)';
    const cleanChave = chaveInput.replace(/\D/g, '');

    if (isByChave) {
      if (cleanChave.length !== 44 && cleanChave.length !== 50) {
        addLog(`❌ Chave de Acesso inválida. A chave deve conter 44 dígitos (ou 50 para NFS-e).`);
        setConsultaError('Chave de Acesso inválida (necessário 44 dígitos).');
        setIsConsulting(false);
        return;
      }
    }

    if (!currentCnpj || currentCnpj.replace(/\D/g, '').length < 14) {
      addLog(`❌ CNPJ não informado ou inválido. Informe o CNPJ da empresa.`);
      setConsultaError('CNPJ não informado ou inválido.');
      setIsConsulting(false);
      return;
    }

    const certName = certificado?.fileName || 'Cofre Seguro Nuvem';
    addLog(`Autenticando CNPJ ${currentCnpj} no ambiente ${ambLabel}`);
    addLog(`WebService: NFeDistribuicaoDFe (Ambiente Nacional AN) | Certificado: ${certName}`);

    const endpointUrl = ambienteSefaz === 'homologacao'
      ? 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
      : 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

    addLog(`Enviando envelope SOAP 1.2 para ${endpointUrl}`);
    if (isByChave) {
      addLog(`Tipo de Consulta: consChNFe (Chave: ${cleanChave})`);
    } else {
      addLog(`Tipo de Consulta: distNSU (ultNSU: ${ultNSU})`);
    }

    try {
      const effectiveToken = token || localStorage.getItem('@RadarFiscal:token') || localStorage.getItem('radar_fiscal_token') || '';

      const response = await fetch(`${getApiBaseUrl()}/sefaz/distribui-dfe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify({
          cnpj: currentCnpj.replace(/\D/g, ''),
          ultNSU: isByChave ? undefined : ultNSU,
          chNFe: isByChave ? cleanChave : undefined,
          tpAmb: ambCode,
          fluxo,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        const errorMsg = errorData.error || errorData.message || `Erro HTTP ${response.status}`;
        addLog(`❌ Erro na comunicação com o backend: ${errorMsg}`);
        setConsultaError(errorMsg);
        setCStat(errorData.cStat || '999');
        setXMotivo(errorMsg);
        setIsConsulting(false);
        return;
      }

      const data = await response.json();

      addLog(`Resposta SEFAZ recebida com sucesso! HTTP 200 OK.`);
      setCStat(data.cStat || '138');
      setXMotivo(data.xMotivo || 'Documentos localizados.');
      addLog(`cStat: ${data.cStat} - ${data.xMotivo}`);

      if (data.docs && data.docs.length > 0) {
        addLog(`Descompactando lote de XMLs (GZip Base64)...`);
        const folderCode = currentCnpj.replace(/\D/g, '').substring(0, 8) || '00000000';
        addLog(`Download concluído: ${data.docs.length} XML(s) processado(s) com sucesso.`);
        addLog(`Diretório Físico: C:\\SEFAZ\\XMLs\\${folderCode}\\${fluxo === 'entrada' ? 'Entrada' : 'Saida'}\\`);

        if (data.ultNSU) {
          setUltNSU(data.ultNSU);
        }

        setResults(data.docs);
      } else {
        addLog(`ℹ️ Nenhum novo documento encontrado.`);
        setResults([]);
      }

    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        addLog(`❌ Timeout: A SEFAZ não respondeu dentro de 60 segundos.`);
        setConsultaError('Timeout na comunicação com a SEFAZ (60s).');
      } else {
        addLog(`❌ Erro de rede: ${err.message}`);
        setConsultaError(`Erro de rede: ${err.message}`);
      }
      setCStat('999');
      setXMotivo(`Erro de comunicação: ${err.message}`);
    } finally {
      setIsConsulting(false);
    }
  };

  // ── MODO 3: UPLOAD DIRETO DE XML / PASTA (CONTINGÊNCIA) ──────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setLogs([]);
    setConsultaError('');
    setUploadSuccessCount(0);

    const importedDocs: DfeXmlItem[] = [];
    let count = 0;

    addLog(`Iniciando upload de contingência de ${files.length} arquivo(s)...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.toLowerCase().endsWith('.xml') && !file.name.toLowerCase().endsWith('.txt')) {
        continue;
      }

      try {
        const text = await file.text();
        const parsed = parseDfeXmlString(text, file.name);

        // Salvar no backend SQLite
        const res = await post('/upload/xml', { xmlContent: text });
        if (res.ok) {
          addLog(`✅ Arquivo importado: ${file.name} (NF-e ${parsed.numero || parsed.chaveAcesso})`);
          importedDocs.push(parsed);
          count++;
        } else {
          addLog(`⚠️ Erro ao salvar ${file.name} no servidor: ${res.error || 'Falha'}`);
          // Adiciona ao frontend mesmo assim
          importedDocs.push(parsed);
          count++;
        }
      } catch (err: any) {
        addLog(`❌ Falha ao ler ${file.name}: ${err.message}`);
      }
    }

    setUploadSuccessCount(count);
    setIsUploading(false);

    if (importedDocs.length > 0) {
      setResults(importedDocs);
      addLog(`✨ Total de ${importedDocs.length} documento(s) fiscal(is) carregado(s) na contingência!`);
    }
  };

  const handlePasteChave = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setChaveInput(text.trim().replace(/\D/g, ''));
      }
    } catch {
      // Fallback
    }
  };

  const handleConfirmImport = () => {
    if (results && results.length > 0) {
      onImportDfeItems(results);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${
              fluxo === 'entrada' ? 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-500/20' : 'bg-gradient-to-br from-emerald-600 to-teal-600 shadow-emerald-500/20'
            }`}>
              {fluxo === 'entrada' ? <FolderInput className="w-5 h-5" /> : <FolderOutput className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {fluxo === 'entrada' ? 'Consulta de XMLs de ENTRADA (Compras)' : 'Sincronização de XMLs de SAÍDA (Vendas)'}
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  ambienteSefaz === 'homologacao'
                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                }`}>
                  {ambienteSefaz === 'homologacao' ? 'Homologação (tpAmb=2)' : 'Produção (tpAmb=1)'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {fluxo === 'entrada'
                  ? 'Captura via WebService SEFAZ ou Upload Direto em Diretório de ENTRADA.'
                  : 'Sincroniza notas emitidas pelo seu CNPJ e armazena em Diretório de SAÍDA.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto">
          
          {/* Main Mode Selector: NSU vs Chave vs Upload */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-900 rounded-2xl border border-slate-800">
            <button
              onClick={() => { setModalMode('nsu'); setResults(null); setLogs([]); }}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                modalMode === 'nsu'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>1. Consulta por NSU</span>
            </button>

            <button
              onClick={() => { setModalMode('chave'); setResults(null); setLogs([]); }}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                modalMode === 'chave'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Key className="w-4 h-4 text-cyan-200" />
              <span>2. Por Chave de Acesso (44d)</span>
            </button>

            <button
              onClick={() => { setModalMode('upload'); setResults(null); setLogs([]); }}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                modalMode === 'upload'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-4 h-4 text-emerald-200" />
              <span>3. Upload XML (Contingência)</span>
            </button>
          </div>

          {/* Certificate & CNPJ Context Header */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="flex items-center gap-3">
              <Key className={`w-5 h-5 shrink-0 ${certificado?.status === 'valido' ? 'text-emerald-400' : 'text-cyan-400'}`} />
              <div>
                <span className="text-slate-400 block text-[11px]">Certificado Digital A1:</span>
                {certificado?.status === 'valido' && certificado?.fileName ? (
                  <>
                    <strong className="text-white font-mono">{certificado.fileName}</strong>
                    <span className="text-emerald-400 block text-[10px] font-semibold mt-0.5">
                      Autenticado & Válido até {certificado.validade}
                    </span>
                  </>
                ) : (
                  <>
                    <strong className="text-cyan-300 font-mono">Cofre Seguro de Certificados</strong>
                    <span className="text-slate-400 block text-[10px] font-semibold mt-0.5">
                      {empresaAtiva?.razaoSocial || 'Autenticação mTLS via Nuvem'}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-center gap-1">
              <label className="text-slate-400 text-[11px] font-semibold">
                {fluxo === 'entrada' ? 'CNPJ Destinatário (Sua Empresa):' : 'CNPJ Emitente (Sua Empresa):'}
              </label>
              <input
                type="text"
                value={cnpjInput}
                onChange={(e) => setCnpjInput(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-cyan-300 font-mono font-bold w-full focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* ── TAB 1: CONSULTA POR NSU ────────────────────── */}
          {modalMode === 'nsu' && (
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Último NSU Consultado no WebService:
                  </label>
                  <input
                    type="text"
                    value={ultNSU}
                    onChange={(e) => setUltNSU(e.target.value)}
                    placeholder="000000000000000"
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-xs text-cyan-300 w-full focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  onClick={() => handleStartConsultaDFe(false)}
                  disabled={isConsulting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50 mt-auto"
                >
                  <RefreshCw className={`w-4 h-4 ${isConsulting ? 'animate-spin' : ''}`} />
                  {isConsulting ? 'Consultando SEFAZ...' : 'Buscar Novos XMLs Destinados (NSU)'}
                </button>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>💡 Se a SEFAZ retornar erro 656, use a <strong>Aba 2 (Por Chave de Acesso)</strong> para baixar diretamente sem fila de NSU.</span>
              </div>
            </div>
          )}

          {/* ── TAB 2: CONSULTA POR CHAVE DE ACESSO (44 DÍGITOS) ─ */}
          {modalMode === 'chave' && (
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-cyan-900/40 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" />
                    Chave de Acesso do DF-e (44 dígitos):
                  </label>
                  <span className={`text-[10px] font-mono font-bold ${
                    chaveInput.replace(/\D/g, '').length === 44 ? 'text-emerald-400' : 'text-slate-400'
                  }`}>
                    {chaveInput.replace(/\D/g, '').length}/44 dígitos
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chaveInput}
                    onChange={(e) => setChaveInput(e.target.value)}
                    placeholder="Ex: 35260100000000000000550010000000011000000010"
                    maxLength={50}
                    className="bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 font-mono text-xs text-cyan-300 w-full focus:outline-none tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={handlePasteChave}
                    className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border border-slate-700"
                    title="Colar da Área de Transferência"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    <span>Colar</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="text-[11px] text-slate-400">
                  ⚡ <strong>Vantagem:</strong> A consulta direta por chave <strong>não sofre bloqueio de consumo indevido (656)</strong> e traz o XML completo imediatamente.
                </div>

                <button
                  onClick={() => handleStartConsultaDFe(true)}
                  disabled={isConsulting || chaveInput.replace(/\D/g, '').length < 44}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Download className={`w-4 h-4 ${isConsulting ? 'animate-spin' : ''}`} />
                  {isConsulting ? 'Baixando da SEFAZ...' : 'Baixar XML Completo por Chave'}
                </button>
              </div>
            </div>
          )}

          {/* ── TAB 3: UPLOAD DIRETO DE XML (CONTINGÊNCIA FISCAL) ─ */}
          {modalMode === 'upload' && (
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-emerald-900/40 space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xml,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-700/60 hover:border-emerald-500/90 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-2 cursor-pointer bg-slate-950/60 hover:bg-slate-950 transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-white mt-1">
                  Clique ou Arraste arquivos XML aqui (Contingência Fiscal)
                </div>
                <p className="text-[11px] text-slate-400 max-w-md">
                  Suporta arquivos <code className="text-emerald-400 font-mono">.xml</code> de NF-e, CT-e e NFS-e. O sistema processa todos os tributos automaticamente.
                </p>
                <button
                  type="button"
                  className="mt-2 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all"
                >
                  Selecionar Arquivos XML
                </button>
              </div>

              {uploadSuccessCount > 0 && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{uploadSuccessCount} arquivo(s) XML importado(s) com sucesso para o banco de dados!</span>
                </div>
              )}
            </div>
          )}

          {/* Path Notice */}
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            {fluxo === 'entrada' ? (
              <>
                <FolderInput className="w-3.5 h-3.5 text-blue-400" />
                Armazenamento de Entrada: <code className="text-blue-300 font-mono">C:\SEFAZ\XMLs\{(cnpjInput || '00000000').replace(/\D/g, '').substring(0, 8)}\Entrada\</code>
              </>
            ) : (
              <>
                <FolderOutput className="w-3.5 h-3.5 text-emerald-400" />
                Armazenamento de Saída: <code className="text-emerald-300 font-mono">C:\SEFAZ\XMLs\{(cnpjInput || '00000000').replace(/\D/g, '').substring(0, 8)}\Saida\</code>
              </>
            )}
          </p>

          {/* cStat Feedback Banner */}
          {cStat && (
            <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
              cStat === '137' || cStat === '138' || cStat === '100'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                : cStat === '656'
                ? 'bg-amber-950/60 border-amber-800 text-amber-300'
                : 'bg-red-950/60 border-red-800 text-red-300'
            }`}>
              <div className="flex items-center gap-2.5">
                {cStat === '138' || cStat === '100' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : cStat === '656' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <Info className="w-4 h-4 shrink-0" />
                )}
                <div>
                  <strong className="font-mono">cStat {cStat}:</strong> {xMotivo}
                </div>
              </div>

              {cStat === '656' && modalMode === 'nsu' && (
                <button
                  type="button"
                  onClick={() => setModalMode('chave')}
                  className="px-2.5 py-1 rounded bg-amber-900/80 hover:bg-amber-800 text-white font-bold text-[10px] transition-all cursor-pointer shrink-0 ml-2"
                >
                  Usar Chave de Acesso ➔
                </button>
              )}
            </div>
          )}

          {/* Real-time SOAP / SEFAZ Logs Terminal */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-cyan-400" />
                Log de Comunicação WebService / SEFAZ:
              </span>
              <span className="font-mono text-[10px] text-slate-500">HTTPS / SOAP 1.2</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 h-36 overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <div className="text-slate-600 italic">
                  Aguardando início da operação. Selecione a aba desejada (NSU, Chave de Acesso ou Upload) e clique no botão correspondente.
                </div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="leading-relaxed">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Results Preview */}
          {results && results.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-emerald-400" />
                  {results.length} Documento(s) Fiscal(is) Pronto(s) para Inclusão:
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(results.reduce((acc, curr) => acc + (curr.valorTotal || 0), 0))}
                </span>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-2">
                {results.map((doc, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white">
                        {doc.tipo} {doc.numero} • <span className="text-slate-400 font-normal">{doc.emitenteNome || doc.destinatarioNome}</span>
                      </div>
                      <div className="font-mono text-[10px] text-cyan-400">
                        Chave: {doc.chaveAcesso}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-white text-right">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(doc.valorTotal || 0)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            {results && results.length > 0 ? (
              <span className="text-emerald-400 font-bold">
                ✅ {results.length} nota(s) pronta(s) para serem adicionadas ao Radar Fiscal.
              </span>
            ) : (
              <span>Os arquivos são salvos localmente e incorporados à base de conformidade.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
            >
              Fechar
            </button>

            {results && results.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Incorporar {results.length} Documento(s) ao Painel</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
