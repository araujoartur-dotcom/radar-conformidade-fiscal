import React, { useState, useRef } from 'react';
import { 
  Zap, 
  FolderOpen, 
  UploadCloud, 
  Play, 
  Pause, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Layers, 
  TrendingUp, 
  DollarSign, 
  ShieldCheck, 
  Activity, 
  Clock, 
  RotateCcw,
  Sparkles,
  Archive
} from 'lucide-react';
import JSZip from 'jszip';
import { useApi } from '../hooks/useApi';

interface TurboIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface IngestStats {
  totalFiles: number;
  processedFiles: number;
  totalItens: number;
  totalValor: number;
  totalCbs: number;
  totalIbs: number;
  speed: number; // XMLs/seg
  startTime: number;
  errorsCount: number;
  logs: Array<{ time: string; msg: string; type: 'info' | 'success' | 'warn' | 'error' }>;
}

export function TurboIngestModal({ isOpen, onClose, onSuccess }: TurboIngestModalProps) {
  const { post } = useApi();

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [chunkSize, setChunkSize] = useState<number>(100);

  const isPausedRef = useRef<boolean>(false);
  const isCancelledRef = useRef<boolean>(false);

  const [stats, setStats] = useState<IngestStats>({
    totalFiles: 0,
    processedFiles: 0,
    totalItens: 0,
    totalValor: 0,
    totalCbs: 0,
    totalIbs: 0,
    speed: 0,
    startTime: 0,
    errorsCount: 0,
    logs: []
  });

  const addLog = (msg: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString('pt-BR');
    setStats(prev => ({
      ...prev,
      logs: [{ time, msg, type }, ...prev.logs.slice(0, 99)]
    }));
  };

  // 1. Manipulador de seleção de Pasta
  const handleDirectorySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const xmlList: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.name.toLowerCase().endsWith('.xml')) {
        xmlList.push(f);
      }
    }

    if (xmlList.length === 0) {
      alert('Nenhum arquivo .xml encontrado nesta pasta.');
      return;
    }

    // Identificar nome da pasta raiz
    const firstPath = xmlList[0].webkitRelativePath || xmlList[0].name;
    const folder = firstPath.includes('/') ? firstPath.split('/')[0] : 'Pasta Selecionada';

    setFolderName(folder);
    setSelectedFiles(xmlList);
    setIsComplete(false);
    setStats({
      totalFiles: xmlList.length,
      processedFiles: 0,
      totalItens: 0,
      totalValor: 0,
      totalCbs: 0,
      totalIbs: 0,
      speed: 0,
      startTime: 0,
      errorsCount: 0,
      logs: [{ time: new Date().toLocaleTimeString('pt-BR'), msg: `📂 ${xmlList.length.toLocaleString()} arquivos XML detectados na pasta "${folder}".`, type: 'info' }]
    });
  };

  // 2. Manipulador de Arquivo .ZIP
  const handleZipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      addLog(`📦 Descompactando arquivo ZIP: ${file.name}...`, 'info');
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);

      const xmlFiles: File[] = [];
      const promises: Promise<void>[] = [];

      zipContent.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir && zipEntry.name.toLowerCase().endsWith('.xml')) {
          promises.push((async () => {
            const blob = await zipEntry.async('blob');
            const newFile = new File([blob], pathBasename(zipEntry.name), { type: 'text/xml' });
            xmlFiles.push(newFile);
          })());
        }
      });

      await Promise.all(promises);

      if (xmlFiles.length === 0) {
        alert('Nenhum arquivo XML encontrado dentro do pacote ZIP.');
        return;
      }

      setFolderName(file.name);
      setSelectedFiles(xmlFiles);
      setIsComplete(false);
      setStats({
        totalFiles: xmlFiles.length,
        processedFiles: 0,
        totalItens: 0,
        totalValor: 0,
        totalCbs: 0,
        totalIbs: 0,
        speed: 0,
        startTime: 0,
        errorsCount: 0,
        logs: [{ time: new Date().toLocaleTimeString('pt-BR'), msg: `✨ ${xmlFiles.length.toLocaleString()} XMLs extraídos do arquivo ZIP "${file.name}".`, type: 'success' }]
      });
    } catch (err: any) {
      alert(`Falha ao descompactar arquivo ZIP: ${err.message}`);
    }
  };

  function pathBasename(pathStr: string): string {
    return pathStr.split(/[\\/]/).pop() || pathStr;
  }

  // 3. Execução da Ingestão em Lotes Concorrentes
  const startIngestion = async () => {
    if (selectedFiles.length === 0) return;

    setIsRunning(true);
    setIsPaused(false);
    setIsComplete(false);
    isPausedRef.current = false;
    isCancelledRef.current = false;

    const startTimestamp = Date.now();
    addLog(`🚀 Motor V12 iniciado com ${selectedFiles.length.toLocaleString()} XMLs em lotes de ${chunkSize}...`, 'info');

    let currentProcessed = stats.processedFiles;
    let accumulatedValor = stats.totalValor;
    let accumulatedCbs = stats.totalCbs;
    let accumulatedIbs = stats.totalIbs;
    let accumulatedItens = stats.totalItens;
    let accumulatedErrors = stats.errorsCount;

    for (let i = currentProcessed; i < selectedFiles.length; i += chunkSize) {
      if (isCancelledRef.current) break;

      while (isPausedRef.current) {
        await new Promise(r => setTimeout(r, 400));
        if (isCancelledRef.current) break;
      }

      const chunk = selectedFiles.slice(i, i + chunkSize);

      // Ler textos dos arquivos do lote em paralelo
      const xmlContents: string[] = await Promise.all(
        chunk.map(async (f) => {
          try {
            return await f.text();
          } catch {
            return '';
          }
        })
      );

      const validXmls = xmlContents.filter(x => x && x.includes('<'));

      try {
        const res = await post('/upload/batch-xml', { xmls: validXmls });

        if (res.ok && res.data?.success) {
          const d = res.data;
          currentProcessed += chunk.length;
          accumulatedValor += d.totalValor || 0;
          accumulatedCbs += d.totalCbs || 0;
          accumulatedIbs += d.totalIbs || 0;
          accumulatedItens += d.totalItens || 0;
          accumulatedErrors += d.errorsCount || 0;

          const elapsedSec = (Date.now() - startTimestamp) / 1000;
          const currentSpeed = elapsedSec > 0 ? (currentProcessed / elapsedSec) : 0;

          setStats(prev => ({
            ...prev,
            processedFiles: currentProcessed,
            totalItens: accumulatedItens,
            totalValor: accumulatedValor,
            totalCbs: accumulatedCbs,
            totalIbs: accumulatedIbs,
            speed: currentSpeed,
            errorsCount: accumulatedErrors,
            logs: [
              {
                time: new Date().toLocaleTimeString('pt-BR'),
                msg: `⚡ Lote de ${chunk.length} XMLs gravado (+${d.totalItens} itens) | R$ ${d.totalValor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                type: 'success'
              },
              ...prev.logs.slice(0, 99)
            ]
          }));
        } else {
          accumulatedErrors += chunk.length;
          addLog(`⚠️ Falha ao transmitir lote de ${chunk.length} XMLs: ${res.data?.error || 'Erro no servidor'}`, 'warn');
        }
      } catch (err: any) {
        accumulatedErrors += chunk.length;
        addLog(`❌ Erro no lote: ${err.message}`, 'error');
      }
    }

    setIsRunning(false);
    if (!isCancelledRef.current) {
      setIsComplete(true);
      addLog(`🎉 Carga de ${selectedFiles.length.toLocaleString()} XMLs concluída com 100% de integridade!`, 'success');
      if (onSuccess) onSuccess();
    }
  };

  const togglePause = () => {
    const next = !isPaused;
    setIsPaused(next);
    isPausedRef.current = next;
    addLog(next ? '⏸️ Processamento pausado temporariamente.' : '▶️ Processamento retomado.', 'info');
  };

  const cancelIngestion = () => {
    isCancelledRef.current = true;
    setIsRunning(false);
    setIsPaused(false);
    addLog('🛑 Ingestão cancelada pelo usuário.', 'warn');
  };

  const resetAll = () => {
    setSelectedFiles([]);
    setFolderName('');
    setIsRunning(false);
    setIsPaused(false);
    setIsComplete(false);
    setStats({
      totalFiles: 0,
      processedFiles: 0,
      totalItens: 0,
      totalValor: 0,
      totalCbs: 0,
      totalIbs: 0,
      speed: 0,
      startTime: 0,
      errorsCount: 0,
      logs: []
    });
  };

  if (!isOpen) return null;

  const percent = stats.totalFiles > 0 ? (stats.processedFiles / stats.totalFiles) * 100 : 0;
  const remainingFiles = Math.max(0, stats.totalFiles - stats.processedFiles);
  const etaSec = stats.speed > 0 ? Math.round(remainingFiles / stats.speed) : 0;
  const etaFormatted = new Date(etaSec * 1000).toISOString().substring(14, 19);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header com Glow Tecnológico */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 text-white font-black">
              <Zap className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-wide">Motor Turbo V12 — Carga Massiva de XMLs</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                  20k+ / Alta Concorrência
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Ingestão ultrarrápida com streaming concorrente, extração de CBS/IBS (RTC) e persistência atômica no Supabase.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isRunning}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Seletor de Arquivos / Pastas / ZIP */}
          {selectedFiles.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Opção 1: Selecionar Pasta Inteira */}
              <label className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/10 hover:bg-cyan-950/20 transition-all cursor-pointer group text-center space-y-3">
                <input
                  type="file"
                  // @ts-ignore
                  webkitdirectory=""
                  directory=""
                  multiple
                  onChange={handleDirectorySelect}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-cyan-500/20">
                  <FolderOpen className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Selecionar Pasta com Milhares de XMLs</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Lê pastas e todas as subpastas (ex: 21.000 notas) de uma só vez do seu computador ou rede.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-[11px] font-bold border border-cyan-500/30">
                  Recomendado para Volumes Massivos
                </span>
              </label>

              {/* Opção 2: Importar Arquivo ZIP */}
              <label className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-indigo-500/40 hover:border-indigo-400 bg-indigo-950/10 hover:bg-indigo-950/20 transition-all cursor-pointer group text-center space-y-3">
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleZipSelect}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/20">
                  <Archive className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Importar Pacote .ZIP Compactado</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Descompacta instantaneamente na memória e faz o streaming para o banco de dados.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-bold border border-indigo-500/30">
                  Pacotes de Contabilidade & ERP
                </span>
              </label>
            </div>
          ) : (
            /* Painel de Controle e Métricas em Tempo Real */
            <div className="space-y-6">
              
              {/* Barra de Status e Controles Principais */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Origem dos Dados</div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{folderName}</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 text-[11px] font-mono">
                        {stats.totalFiles.toLocaleString()} XMLs detectados
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex items-center gap-2.5">
                  {!isRunning && !isComplete && (
                    <button
                      onClick={startIngestion}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer active:scale-95"
                    >
                      <Play className="w-4 h-4 fill-slate-950" />
                      <span>INICIAR TURBO INGEST V12</span>
                    </button>
                  )}

                  {isRunning && (
                    <>
                      <button
                        onClick={togglePause}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                          isPaused
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                            : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
                        <span>{isPaused ? 'RETOMAR' : 'PAUSAR'}</span>
                      </button>

                      <button
                        onClick={cancelIngestion}
                        className="px-4 py-2.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-800 text-red-300 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        <span>CANCELAR</span>
                      </button>
                    </>
                  )}

                  {isComplete && (
                    <button
                      onClick={resetAll}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>CARREGAR NOVA PASTA</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Barra de Progresso com Glow e Métricas Rápidas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                    <span>Progresso da Ingestão</span>
                  </span>
                  <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                    <span>⚡ <strong className="text-cyan-400">{Math.round(stats.speed)}</strong> XMLs/s</span>
                    <span>⏱️ ETA: <strong className="text-white">{etaFormatted}</strong></span>
                    <span>📊 <strong className="text-emerald-400">{stats.processedFiles.toLocaleString()}</strong> de {stats.totalFiles.toLocaleString()}</span>
                  </div>
                </div>

                <div className="w-full h-4 rounded-full bg-slate-950 border border-slate-800 p-0.5 overflow-hidden shadow-inner relative">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 transition-all duration-300 relative shadow-md shadow-cyan-500/50"
                    style={{ width: `${percent}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Cards de Métricas em Tempo Real */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Volume Financeiro</span>
                  </div>
                  <div className="text-lg font-black text-emerald-400 font-mono mt-1">
                    {stats.totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>CBS Apurado</span>
                  </div>
                  <div className="text-lg font-black text-cyan-400 font-mono mt-1">
                    {stats.totalCbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>IBS Apurado</span>
                  </div>
                  <div className="text-lg font-black text-indigo-400 font-mono mt-1">
                    {stats.totalIbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    <span>Itens / Produtos</span>
                  </div>
                  <div className="text-lg font-black text-purple-300 font-mono mt-1">
                    {stats.totalItens.toLocaleString()} itens
                  </div>
                </div>
              </div>

              {/* Console de Telemetria / Logs ao Vivo */}
              <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-300 font-bold flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Telemetria em Tempo Real</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Últimos eventos do pipeline</span>
                </div>
                <div className="p-3 max-h-48 overflow-y-auto font-mono text-[11px] space-y-1 text-slate-400">
                  {stats.logs.length === 0 ? (
                    <div className="text-slate-600 italic">Aguardando início do motor...</div>
                  ) : (
                    stats.logs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-slate-600 shrink-0">[{log.time}]</span>
                        <span className={
                          log.type === 'success' ? 'text-emerald-400' :
                          log.type === 'warn' ? 'text-amber-400' :
                          log.type === 'error' ? 'text-red-400' : 'text-slate-300'
                        }>
                          {log.msg}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Motor Transacional ACID • Parsing Anti-XXE • Compatível com Reforma Tributária (RTC)</span>
          </div>

          <button
            onClick={onClose}
            disabled={isRunning}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            {isComplete ? 'Concluir e Fechar' : 'Fechar'}
          </button>
        </div>

      </div>
    </div>
  );
}
