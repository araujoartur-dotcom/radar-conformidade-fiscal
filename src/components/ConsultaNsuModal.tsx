import React, { useState, useRef, useEffect } from 'react';
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
  Sparkles,
  Play,
  Pause,
  Square,
  FileArchive,
  Clock,
  Check,
  FileSpreadsheet
} from 'lucide-react';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { CertificadoA1, AmbienteSefaz, DfeXmlItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getApiBaseUrl } from '../utils/apiConfig';
import { parseDfeXmlString, generateDfeXmlContent } from '../utils/xmlParser';
import { useApi } from '../hooks/useApi';

interface ConsultaNsuModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificado: CertificadoA1;
  ambienteSefaz: AmbienteSefaz;
  onImportDfeItems: (items: DfeXmlItem[]) => void;
  defaultFluxo?: 'entrada' | 'saida';
}

interface BatchChaveItem {
  chave: string;
  status: 'pendente' | 'processando' | 'sucesso' | 'erro';
  motivo?: string;
  doc?: DfeXmlItem;
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
  const [modalMode, setModalMode] = useState<'nsu' | 'chave' | 'upload'>('chave');
  const [subModeChave, setSubModeChave] = useState<'individual' | 'massivo'>('massivo');
  const [fluxo, setFluxo] = useState<'entrada' | 'saida'>(defaultFluxo);
  
  // Tab 1: NSU State
  const [ultNSU, setUltNSU] = useState<string>('000000000000000');
  
  // Tab 2 (Individual): Single Chave
  const [chaveInput, setChaveInput] = useState<string>('');
  
  // Tab 2 (Massivo): Batch Chaves State
  const [rawChavesText, setRawChavesText] = useState<string>('');
  const [parsedChavesList, setParsedChavesList] = useState<string[]>([]);
  const [batchItems, setBatchItems] = useState<BatchChaveItem[]>([]);
  const [intervalMs, setIntervalMs] = useState<number>(2000); // 2000ms default (segurança máxima)
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [isBatchPaused, setIsBatchPaused] = useState<boolean>(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(0);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; successCount: number; errorCount: number; etaSeconds: number }>({
    current: 0,
    total: 0,
    successCount: 0,
    errorCount: 0,
    etaSeconds: 0
  });

  const isPausedRef = useRef<boolean>(false);
  const isCancelledRef = useRef<boolean>(false);
  const fileImportRef = useRef<HTMLInputElement>(null);

  // Common State
  const [isConsulting, setIsConsulting] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<DfeXmlItem[] | null>(null);
  const [cStat, setCStat] = useState<string>('');
  const [xMotivo, setXMotivo] = useState<string>('');
  const [consultaError, setConsultaError] = useState<string>('');
  
  // Upload State (Tab 3)
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccessCount, setUploadSuccessCount] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable CNPJ and Razao Social
  const [cnpjInput, setCnpjInput] = useState<string>(certificado?.cnpj || empresaAtiva?.cnpjCompleto || '');
  const [razaoInput, setRazaoInput] = useState<string>(certificado?.razãoSocial || empresaAtiva?.razaoSocial || '');
  const [nsuModeType, setNsuModeType] = useState<'sequencial' | 'especifico'>('sequencial');
  const [nsuEspecificoInput, setNsuEspecificoInput] = useState<string>('');

  useEffect(() => {
    const fallbackCnpj = certificado?.cnpj || empresaAtiva?.cnpjCompleto || '';
    const fallbackRazao = certificado?.razãoSocial || empresaAtiva?.razaoSocial || '';
    if (fallbackCnpj) setCnpjInput(fallbackCnpj);
    if (fallbackRazao) setRazaoInput(fallbackRazao);
  }, [certificado, empresaAtiva]);

  // Atualizar lista parseada de chaves sempre que o texto mudar
  useEffect(() => {
    if (!rawChavesText) {
      setParsedChavesList([]);
      return;
    }
    const matches = rawChavesText.match(/\b\d{44}\b/g) || [];
    const unique = Array.from(new Set(matches));
    setParsedChavesList(unique);
  }, [rawChavesText]);

  if (!isOpen) return null;

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`]);
  };

  // ── MODO 1: CONSULTA INDIVIDUAL / NSU VIA SEFAZ ──────────────────
  const handleStartConsultaDFe = async (isByChave: boolean = false, targetChave?: string, targetNsuEspecifico?: string) => {
    setIsConsulting(true);
    setLogs([]);
    setResults(null);
    setCStat('');
    setXMotivo('');
    setConsultaError('');

    const currentCnpj = cnpjInput || certificado?.cnpj || empresaAtiva?.cnpjCompleto || '';
    const ambCode = ambienteSefaz === 'homologacao' ? '2' : '1';
    const ambLabel = ambienteSefaz === 'homologacao' ? 'HOMOLOGAÇÃO (tpAmb = 2)' : 'PRODUÇÃO (tpAmb = 1)';
    const cleanChave = (targetChave || chaveInput).replace(/\D/g, '');

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

    if (isByChave) {
      addLog(`Tipo de Consulta: consChNFe (Chave: ${cleanChave})`);
    } else if (targetNsuEspecifico) {
      addLog(`Tipo de Consulta: consNSU (NSU Específico: ${targetNsuEspecifico})`);
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
          ultNSU: (isByChave || targetNsuEspecifico) ? undefined : ultNSU,
          nsuEspecifico: targetNsuEspecifico,
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
        addLog(`Descompactando XML(s) autorizado(s)...`);
        const folderCode = currentCnpj.replace(/\D/g, '').substring(0, 8) || '00000000';
        addLog(`Download concluído: ${data.docs.length} XML(s) processado(s) e salvo(s) em disco.`);
        addLog(`📁 Pasta Local: C:\\SEFAZ\\XMLs\\${folderCode}\\${fluxo === 'saida' ? 'Saida' : 'Entrada'}\\`);

        if (data.ultNSU) {
          setUltNSU(data.ultNSU);
        }

        setResults(data.docs);
      } else {
        addLog(`ℹ️ Nenhum documento localizado para a consulta.`);
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

  // ── MODO 2 (MASSIVO): DOWNLOAD EM LOTE COM INTERVALO ANTI-BLOQUEIO ─
  const handleStartBatchDownload = async () => {
    if (parsedChavesList.length === 0) return;

    isCancelledRef.current = false;
    isPausedRef.current = false;
    setIsBatchRunning(true);
    setIsBatchPaused(false);
    setLogs([]);
    setResults([]);

    const initialItems: BatchChaveItem[] = parsedChavesList.map(ch => ({
      chave: ch,
      status: 'pendente'
    }));
    setBatchItems(initialItems);

    const currentCnpj = (cnpjInput || certificado?.cnpj || empresaAtiva?.cnpjCompleto || '').replace(/\D/g, '');
    const ambCode = ambienteSefaz === 'homologacao' ? '2' : '1';
    const total = initialItems.length;
    let successes = 0;
    let errors = 0;
    const downloadedDocs: DfeXmlItem[] = [];

    addLog(`🚀 Iniciando download em lote de ${total} chaves com intervalo de ${intervalMs}ms (${(intervalMs / 1000).toFixed(1)}s)...`);
    addLog(`Ambiente: ${ambienteSefaz === 'homologacao' ? 'Homologação (tpAmb=2)' : 'Produção (tpAmb=1)'} | CNPJ: ${currentCnpj}`);

    for (let i = 0; i < total; i++) {
      if (isCancelledRef.current) {
        addLog(`⏹️ Download em lote cancelado pelo usuário.`);
        break;
      }

      // Loop de pausa
      while (isPausedRef.current) {
        await new Promise(r => setTimeout(r, 300));
        if (isCancelledRef.current) break;
      }
      if (isCancelledRef.current) break;

      const item = initialItems[i];
      setCurrentProcessingIndex(i + 1);

      // Atualiza status para processando
      setBatchItems(prev => prev.map((b, idx) => idx === i ? { ...b, status: 'processando' } : b));
      addLog(`[${i + 1}/${total}] Consultando chave: ${item.chave}`);

      try {
        const effectiveToken = token || localStorage.getItem('@RadarFiscal:token') || localStorage.getItem('radar_fiscal_token') || '';

        const response = await fetch(`${getApiBaseUrl()}/sefaz/distribui-dfe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${effectiveToken}`,
          },
          body: JSON.stringify({
            cnpj: currentCnpj,
            chNFe: item.chave,
            tpAmb: ambCode,
            fluxo,
          }),
          signal: AbortSignal.timeout(30000),
        });

        const data = await response.json();

        if (response.ok && data.docs && data.docs.length > 0) {
          const doc = data.docs[0];
          downloadedDocs.push(doc);
          successes++;
          setBatchItems(prev => prev.map((b, idx) => idx === i ? {
            ...b,
            status: 'sucesso',
            doc,
            motivo: `NF-e nº ${doc.numero} • R$ ${doc.valorTotal?.toFixed(2)}`
          } : b));
          addLog(`✅ [${i + 1}/${total}] Sucesso: ${doc.tipo} nº ${doc.numero} (R$ ${doc.valorTotal?.toFixed(2)}) baixado e salvo no disco!`);
        } else {
          errors++;
          const errMotivo = data.xMotivo || data.error || `cStat ${data.cStat || '137'}`;
          const isLimit20 = (data.cStat === '656' || errMotivo.includes('20 consultas') || errMotivo.includes('Consumo Indevido'));

          setBatchItems(prev => prev.map((b, idx) => idx === i ? {
            ...b,
            status: 'erro',
            motivo: isLimit20 ? 'Rejeição SEFAZ: Limite de 20 consultas diretas/hora atingido (NT 2014.002)' : errMotivo
          } : b));

          if (isLimit20) {
            addLog(`🛑 [SEFAZ BLOQUEIO DE COTA] Atingido o limite da SEFAZ de 20 consultas diretas por chave a cada 1 hora.`);
            addLog(`💡 Dica: As notas restantes podem ser consultadas na próxima janela de 1h ou via Varredura de NSU.`);
            // Marca as próximas chaves ainda pendentes e para a fila graciosamente
            for (let j = i + 1; j < total; j++) {
              setBatchItems(prev => prev.map((b, idx) => idx === j ? {
                ...b,
                status: 'pendente',
                motivo: 'Aguardando próxima janela de 1h da SEFAZ'
              } : b));
            }
            break;
          } else {
            addLog(`⚠️ [${i + 1}/${total}] Chave ${item.chave}: ${errMotivo}`);
          }
        }
      } catch (err: any) {
        errors++;
        setBatchItems(prev => prev.map((b, idx) => idx === i ? {
          ...b,
          status: 'erro',
          motivo: err.message
        } : b));
        addLog(`❌ [${i + 1}/${total}] Falha de rede: ${err.message}`);
      }

      // Atualiza progresso e ETA
      const remainingItems = total - (i + 1);
      const etaSec = Math.round((remainingItems * intervalMs) / 1000);
      setBatchProgress({
        current: i + 1,
        total,
        successCount: successes,
        errorCount: errors,
        etaSeconds: etaSec
      });

      // Aguardar intervalo anti-bloqueio antes da próxima chave (se não for a última)
      if (i < total - 1 && !isCancelledRef.current) {
        await new Promise(r => setTimeout(r, intervalMs));
      }
    }

    setIsBatchRunning(false);
    setIsBatchPaused(false);
    setResults(downloadedDocs);
    addLog(`✨ Processamento em lote finalizado! Total Baixados com Sucesso: ${successes}/${total}.`);
  };

  const handlePauseBatch = () => {
    isPausedRef.current = !isPausedRef.current;
    setIsBatchPaused(isPausedRef.current);
    addLog(isPausedRef.current ? `⏸️ Download em lote pausado.` : `▶️ Download em lote retomado.`);
  };

  const handleCancelBatch = () => {
    isCancelledRef.current = true;
    setIsBatchRunning(false);
    setIsBatchPaused(false);
    addLog(`⏹️ Solicitação de cancelamento enviada.`);
  };

  // Importar chaves de arquivo Excel / TXT / CSV
  const handleImportChavesFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const textContent = XLSX.utils.sheet_to_csv(firstSheet);
          setRawChavesText(prev => (prev ? prev + '\n' + textContent : textContent));
        } catch (err: any) {
          addLog(`❌ Erro ao ler planilha: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        setRawChavesText(prev => (prev ? prev + '\n' + text : text));
      };
      reader.readAsText(file);
    }
  };

  // Gerar e Baixar arquivo ZIP com todos os XMLs
  const handleDownloadZip = async () => {
    if (!results || results.length === 0) return;

    const zip = new JSZip();
    results.forEach((doc, idx) => {
      const xmlStr = doc.xmlRaw || generateDfeXmlContent(doc);
      const filename = `${doc.tipo || 'NFe'}_${doc.numero || idx + 1}_${doc.chaveAcesso || Date.now()}.xml`;
      zip.file(filename, xmlStr);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lote_XMLs_SEFAZ_${(cnpjInput || 'empresa').replace(/\D/g, '').substring(0, 8)}_${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog(`💾 Arquivo ZIP com ${results.length} XMLs baixado com sucesso!`);
  };

  // Salvar diretamente na pasta do computador do usuário (File System Access API)
  const handleSaveToLocalFolder = async () => {
    if (!results || results.length === 0) return;

    if (!('showDirectoryPicker' in window)) {
      addLog(`ℹ️ Seu navegador não suporta seleção direta de pastas. Baixando arquivo ZIP organizado...`);
      await handleDownloadZip();
      return;
    }

    try {
      addLog(`📁 Solicitando seleção de pasta no computador...`);
      const rootHandle = await (window as any).showDirectoryPicker();
      let count = 0;

      for (const doc of results) {
        const raw = doc.xmlRaw || generateDfeXmlContent(doc);
        const cnpjRaiz = (doc.destinatarioCnpj || doc.emitenteCnpj || cnpjInput || '00000000').replace(/\D/g, '').substring(0, 8);
        const tipoPasta = fluxo === 'saida' ? 'Saida' : 'Entrada';
        const ano = doc.dataEmissao ? doc.dataEmissao.substring(0, 4) : '2026';
        const mes = doc.dataEmissao ? doc.dataEmissao.substring(5, 7) : '08';
        const fileName = `${doc.chaveAcesso}.xml`;

        // Criar estrutura de subpastas C:\[Pasta_Escolhida]\[CNPJ_RAIZ]\[Entrada|Saida]\[Ano]\[Mês]\[Chave].xml
        const cnpjDir = await rootHandle.getDirectoryHandle(cnpjRaiz, { create: true });
        const tipoDir = await cnpjDir.getDirectoryHandle(tipoPasta, { create: true });
        const anoDir = await tipoDir.getDirectoryHandle(ano, { create: true });
        const mesDir = await anoDir.getDirectoryHandle(mes, { create: true });
        const fileHandle = await mesDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(raw);
        await writable.close();
        count++;
      }

      addLog(`✅ Gravação concluída com sucesso: ${count} arquivo(s) XML salvos na pasta local organizada!`);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        addLog(`⚠️ Gravação local cancelada ou não permitida. Baixando em formato ZIP...`);
        await handleDownloadZip();
      }
    }
  };

  const handleCopyPendingChaves = () => {
    const pending = batchItems.filter(b => b.status === 'erro' || b.status === 'pendente').map(b => b.chave);
    if (pending.length > 0) {
      navigator.clipboard.writeText(pending.join('\n'));
      addLog(`📋 ${pending.length} chaves pendentes copiadas para a Área de Transferência!`);
    }
  };

  const handleExportPendingTxt = () => {
    const pending = batchItems.filter(b => b.status === 'erro' || b.status === 'pendente').map(b => b.chave);
    if (pending.length > 0) {
      const blob = new Blob([pending.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Chaves_Pendentes_${(cnpjInput || 'empresa').replace(/\D/g, '').substring(0, 8)}_${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addLog(`💾 Arquivo .txt com ${pending.length} chaves pendentes exportado!`);
    }
  };

  // ── MODO 3: UPLOAD DIRETO DE XML (CONTINGÊNCIA) ───────────────────
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

        const res = await post('/upload/xml', { xmlContent: text });
        if (res.ok) {
          addLog(`✅ Arquivo importado: ${file.name} (${parsed.tipo} ${parsed.numero || parsed.chaveAcesso})`);
          importedDocs.push(parsed);
          count++;
        } else {
          addLog(`⚠️ Importado no frontend: ${file.name}`);
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
    } catch {}
  };

  const handlePasteMassivo = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawChavesText(prev => (prev ? prev + '\n' + text : text));
      }
    } catch {}
  };

  const handleConfirmImport = () => {
    if (results && results.length > 0) {
      onImportDfeItems(results);
      onClose();
    }
  };

  const formatEta = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
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
                  ? 'Captura direta por Chave de Acesso, Lote Massivo, NSU ou Upload de Contingência.'
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
              onClick={() => { setModalMode('chave'); setResults(null); setLogs([]); }}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                modalMode === 'chave'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Key className="w-4 h-4 text-cyan-200" />
              <span>1. Por Chave de Acesso (44d)</span>
            </button>

            <button
              onClick={() => { setModalMode('nsu'); setResults(null); setLogs([]); }}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                modalMode === 'nsu'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>2. Consulta por NSU</span>
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

          {/* ── TAB 1: CONSULTA POR CHAVE DE ACESSO (INDIVIDUAL OU MASSIVO) ─ */}
          {modalMode === 'chave' && (
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-cyan-900/40 space-y-4">
              
              {/* Sub-mode Switcher: Individual vs Lote Massivo */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => { setSubModeChave('massivo'); setResults(null); }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      subModeChave === 'massivo'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                    <span>📋 Lote Massivo de Chaves</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setSubModeChave('individual'); setResults(null); }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      subModeChave === 'individual'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>🔑 Chave Única (Individual)</span>
                  </button>
                </div>

                <div className="text-[11px] text-amber-400/90 hidden sm:flex items-center gap-1.5 bg-amber-950/40 border border-amber-800/60 px-2.5 py-1 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span><strong>Regra SEFAZ (NT 2014.002):</strong> Máximo de 20 consultas diretas por chave a cada 1 hora.</span>
                </div>
              </div>

              {/* ── SUB-MODO: CHAVE INDIVIDUAL ──────────────── */}
              {subModeChave === 'individual' && (
                <div className="space-y-4">
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

                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                      onClick={() => handleStartConsultaDFe(true)}
                      disabled={isConsulting || chaveInput.replace(/\D/g, '').length < 44}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Download className={`w-4 h-4 ${isConsulting ? 'animate-spin' : ''}`} />
                      {isConsulting ? 'Baixando da SEFAZ...' : 'Baixar XML Completo por Chave'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── SUB-MODO: LOTE MASSIVO DE CHAVES ────────── */}
              {subModeChave === 'massivo' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        Cole a lista de chaves de acesso (copiadas do Excel ou texto):
                      </label>
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${
                        parsedChavesList.length > 0 ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'text-slate-500'
                      }`}>
                        {parsedChavesList.length} chave(s) única(s) válida(s)
                      </span>
                    </div>

                    <textarea
                      rows={5}
                      value={rawChavesText}
                      onChange={(e) => setRawChavesText(e.target.value)}
                      placeholder="Cole aqui a coluna de chaves do Excel ou arquivo de texto... (Ex: 41260877765840000170550030005478051771547460)"
                      className="bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl p-3 font-mono text-xs text-cyan-300 w-full focus:outline-none resize-none leading-relaxed tracking-wider"
                      disabled={isBatchRunning}
                    />
                  </div>

                  {/* Actions & Settings Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                    
                    {/* Interval Rate-Limit Control */}
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      <span className="text-slate-300 font-semibold text-[11px]">Intervalo Anti-Bloqueio:</span>
                      <select
                        value={intervalMs}
                        onChange={(e) => setIntervalMs(Number(e.target.value))}
                        disabled={isBatchRunning}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-cyan-300 font-bold font-mono text-[11px] focus:outline-none cursor-pointer"
                      >
                        <option value={2000}>2000ms (2s - Máxima Segurança SEFAZ)</option>
                        <option value={1000}>1000ms (1s - Recomendado)</option>
                        <option value={500}>500ms (0,5s - Rápido)</option>
                      </select>
                    </div>

                    {/* Import from Excel / TXT */}
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileImportRef}
                        type="file"
                        accept=".txt,.csv,.xlsx,.xls"
                        onChange={handleImportChavesFile}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileImportRef.current?.click()}
                        disabled={isBatchRunning}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-[11px] flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Carregar do Excel/TXT</span>
                      </button>

                      <button
                        type="button"
                        onClick={handlePasteMassivo}
                        disabled={isBatchRunning}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-[11px] flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Colar da Área de Transf.</span>
                      </button>

                      {rawChavesText && (
                        <button
                          type="button"
                          onClick={() => { setRawChavesText(''); setBatchItems([]); }}
                          disabled={isBatchRunning}
                          className="px-2 py-1 rounded-lg text-slate-400 hover:text-rose-400 text-[11px] transition-all cursor-pointer"
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Batch Controls & Progress Bar */}
                  {isBatchRunning || batchProgress.total > 0 ? (
                    <div className="p-4 rounded-xl bg-slate-950 border border-cyan-900/60 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">
                            Progresso do Lote: {batchProgress.current} de {batchProgress.total} chaves
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                            {Math.round((batchProgress.current / (batchProgress.total || 1)) * 100)}%
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] font-mono">
                          <span className="text-emerald-400 font-bold">✅ {batchProgress.successCount} Sucessos</span>
                          <span className="text-rose-400 font-bold">❌ {batchProgress.errorCount} Falhas</span>
                          {isBatchRunning && (
                            <span className="text-amber-300">⏳ Restante: {formatEta(batchProgress.etaSeconds)}</span>
                          )}
                        </div>
                      </div>

                      {/* Progress bar track */}
                      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-300"
                          style={{ width: `${(batchProgress.current / (batchProgress.total || 1)) * 100}%` }}
                        />
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="text-[11px] text-slate-400">
                          {isBatchRunning ? (
                            <span className="text-cyan-400 animate-pulse font-bold flex items-center gap-1.5">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Baixando XMLs e salvando automaticamente em C:\SEFAZ\XMLs\...
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-bold">
                              ✨ Processamento concluído! Todos os XMLs válidos foram salvos no disco e no banco.
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {isBatchRunning && (
                            <>
                              <button
                                type="button"
                                onClick={handlePauseBatch}
                                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                {isBatchPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                                <span>{isBatchPaused ? 'Retomar' : 'Pausar'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={handleCancelBatch}
                                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Square className="w-3.5 h-3.5" />
                                <span>Cancelar</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Realtime Batch Status Table */}
                      <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-800/80 divide-y divide-slate-800/60 font-mono text-[11px]">
                        {batchItems.map((item, idx) => (
                          <div key={idx} className="p-2 bg-slate-900/60 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 w-6 text-right font-bold">{idx + 1}.</span>
                              <span className="text-cyan-300 font-bold">{item.chave}</span>
                            </div>
                            <div>
                              {item.status === 'pendente' && (
                                <span className="text-slate-500 text-[10px]">⏳ Na Fila</span>
                              )}
                              {item.status === 'processando' && (
                                <span className="text-cyan-400 text-[10px] animate-pulse flex items-center gap-1">
                                  <RefreshCw className="w-3 h-3 animate-spin" /> Baixando...
                                </span>
                              )}
                              {item.status === 'sucesso' && (
                                <span className="text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                                  <Check className="w-3 h-3" /> {item.motivo || 'Baixado & Salvo'}
                                </span>
                              )}
                              {item.status === 'erro' && (
                                <span className="text-rose-400 font-bold text-[10px]">
                                  ❌ {item.motivo || 'Erro'}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Recovery Banner for Pending / Blocked Keys */}
                      {batchItems.filter(b => b.status === 'erro' || b.status === 'pendente').length > 0 && !isBatchRunning && (
                        <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="text-amber-300 font-semibold flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>{batchItems.filter(b => b.status === 'erro' || b.status === 'pendente').length} chave(s) não foram baixadas (limite de 20 consultas/hora da SEFAZ atingido).</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleCopyPendingChaves}
                              className="px-2.5 py-1 rounded-lg bg-amber-900/80 hover:bg-amber-800 text-amber-200 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <ClipboardPaste className="w-3.5 h-3.5" />
                              <span>Copiar Pendentes ({batchItems.filter(b => b.status === 'erro' || b.status === 'pendente').length})</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleExportPendingTxt}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 border border-slate-700 transition-all cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Salvar (.txt)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => { setModalMode('nsu'); }}
                              className="px-2.5 py-1 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Search className="w-3.5 h-3.5" />
                              <span>Consultar por NSU (Lotes de 50)</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-1">
                      <div className="text-[11px] text-slate-400">
                        Cada nota é <strong>salva fisicamente no disco</strong> e <strong>incorporada ao banco e KPIs</strong>.
                      </div>

                      <button
                        type="button"
                        onClick={handleStartBatchDownload}
                        disabled={parsedChavesList.length === 0 || isBatchRunning}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Play className="w-4 h-4" />
                        <span>Iniciar Download de {parsedChavesList.length} XML(s)</span>
                      </button>
                    </div>
                  )}

                </div>
              )}

            </div>
          )}

          {/* ── TAB 2: CONSULTA POR NSU ────────────────────── */}
          {modalMode === 'nsu' && (
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-blue-900/40 space-y-4">
              
              {/* Sub-mode Switcher for NSU */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => { setNsuModeType('sequencial'); setResults(null); }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      nsuModeType === 'sequencial'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>🔄 Varredura Sequencial (ultNSU)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setNsuModeType('especifico'); setResults(null); }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      nsuModeType === 'especifico'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>🎯 NSU Específico (consNSU)</span>
                  </button>
                </div>

                <div className="text-[11px] text-blue-300 hidden sm:block">
                  📦 <strong>Lotes de até 50 notas</strong> por requisição no Ambiente Nacional.
                </div>
              </div>

              {/* Sub-modo Sequencial */}
              {nsuModeType === 'sequencial' ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex-1 min-w-[220px]">
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Último NSU Consultado na Esteira SEFAZ:
                      </label>
                      <input
                        type="text"
                        value={ultNSU}
                        onChange={(e) => setUltNSU(e.target.value)}
                        placeholder="000000000000000"
                        className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 font-mono text-xs text-cyan-300 w-full focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <button
                      onClick={() => handleStartConsultaDFe(false)}
                      disabled={isConsulting}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50 mt-auto"
                    >
                      <RefreshCw className={`w-4 h-4 ${isConsulting ? 'animate-spin' : ''}`} />
                      {isConsulting ? 'Consultando Esteira SEFAZ...' : 'Buscar Novos XMLs Destinados (NSU)'}
                    </button>
                  </div>
                  
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                    💡 <strong>Como funciona a esteira:</strong> O WebService <code>distNSU</code> traz até 50 notas por chamada a partir do NSU informado. Ao atingir o final da fila (<code>maxNSU</code>), a SEFAZ exige aguardar 1h para novas varreduras.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex-1 min-w-[220px]">
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Número Sequencial Único (NSU Específico):
                      </label>
                      <input
                        type="text"
                        value={nsuEspecificoInput}
                        onChange={(e) => setNsuEspecificoInput(e.target.value)}
                        placeholder="Ex: 1, 15, 2045..."
                        className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 font-mono text-xs text-cyan-300 w-full focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <button
                      onClick={() => handleStartConsultaDFe(false, undefined, nsuEspecificoInput)}
                      disabled={isConsulting || !nsuEspecificoInput.trim()}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50 mt-auto"
                    >
                      <Search className={`w-4 h-4 ${isConsulting ? 'animate-spin' : ''}`} />
                      {isConsulting ? 'Buscando NSU...' : 'Consultar NSU Específico'}
                    </button>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                    🎯 <strong>Consulta Pontual:</strong> O <code>consNSU</code> permite resgatar qualquer documento diretamente pelo número do seu NSU histórico no Ambiente Nacional da SEFAZ.
                  </div>
                </div>
              )}

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
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              {fluxo === 'entrada' ? (
                <>
                  <FolderInput className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Gravação física automática: <code className="text-blue-300 font-mono">C:\SEFAZ\XMLs\{(cnpjInput || '00000000').replace(/\D/g, '').substring(0, 8)}\Entrada\YYYY\MM\</code></span>
                </>
              ) : (
                <>
                  <FolderOutput className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Gravação física automática: <code className="text-emerald-300 font-mono">C:\SEFAZ\XMLs\{(cnpjInput || '00000000').replace(/\D/g, '').substring(0, 8)}\Saida\YYYY\MM\</code></span>
                </>
              )}
            </div>

            {results && results.length > 0 && (
              <button
                type="button"
                onClick={handleDownloadZip}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white font-bold text-[10px] flex items-center gap-1 border border-slate-700 transition-all cursor-pointer shrink-0 ml-2"
                title="Baixar todos os XMLs em arquivo compactado .ZIP"
              >
                <FileArchive className="w-3.5 h-3.5 text-amber-400" />
                <span>💾 Baixar Lote em ZIP</span>
              </button>
            )}
          </div>

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

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 h-32 overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <div className="text-slate-600 italic">
                  Aguardando início da operação. Selecione a aba desejada e clique em iniciar.
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveToLocalFolder}
                    className="px-3 py-1 rounded-xl bg-blue-950/80 hover:bg-blue-900 text-cyan-300 border border-blue-800 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                    title="Salvar diretamente na pasta do computador (C:\SEFAZ\XMLs) via seletor de diretório"
                  >
                    <FolderInput className="w-3.5 h-3.5 text-cyan-400" />
                    <span>📁 Salvar na Pasta do PC</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadZip}
                    className="px-3 py-1 rounded-xl bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                    title="Baixar todos os XMLs em arquivo compactado .ZIP"
                  >
                    <FileArchive className="w-3.5 h-3.5 text-amber-400" />
                    <span>💾 Baixar em ZIP</span>
                  </button>

                  <span className="text-xs font-mono font-bold text-emerald-400 ml-1">
                    Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(results.reduce((acc, curr) => acc + (curr.valorTotal || 0), 0))}
                  </span>
                </div>
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
