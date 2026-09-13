/**
 * ============================================================
 * HOOK useBatchProcessing — PROCESSAMENTO EM LOTE DE CNPJs
 * ============================================================
 * Encapsula todo o estado, temporizador, controle de taxa (rate-limit),
 * leitura de planilhas e iteração assíncrona de consultas na SEFAZ.
 * Desonera o App.tsx e isola os re-renders periódicos do lote.
 * ============================================================
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CnpjLookupItem, BatchStats } from '../types';
import { queryCnpjsData, formatCNPJ, onlyNumbers } from '../utils/cnpj';
import { parseExcelFile, exportToExcel } from '../utils/excel';

interface UseBatchProcessingOptions {
  rateLimit?: number;
  onNavigateToLote?: () => void;
}

export function useBatchProcessing(options: UseBatchProcessingOptions = {}) {
  const { rateLimit = 8, onNavigateToLote } = options;

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

  // Quick Instant Search Input (Aba Detalhada)
  const [quickInput, setQuickInput] = useState<string>('');
  const [quickUf, setQuickUf] = useState<string>('');
  const [isQuickLoading, setIsQuickLoading] = useState<boolean>(false);

  // Refs for loop controls and timer
  const timerRef = useRef<any>(null);
  const processingRef = useRef<boolean>(false);
  const pausedRef = useRef<boolean>(false);

  // Stopwatch effect
  useEffect(() => {
    if (isProcessing && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isProcessing, isPaused]);

  // Keep refs synced with state
  useEffect(() => {
    processingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  // Main Batch Processing Engine Loop
  const startBatchProcessing = useCallback(async () => {
    if (items.length === 0) return;

    // Check if there are any non-completed items
    const hasPending = items.some(it => it.statusConsulta === 'pendente' || it.statusConsulta === 'erro');
    if (!hasPending) {
      // Reset pending status to allow re-running if all completed
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
  }, [items, rateLimit]);

  const handlePause = useCallback(() => {
    setIsPaused(prev => {
      const next = !prev;
      pausedRef.current = next;
      return next;
    });
  }, []);

  const handleCancel = useCallback(() => {
    setIsProcessing(false);
    setIsPaused(false);
    processingRef.current = false;
    pausedRef.current = false;
    setCurrentProcessingCnpj('');
  }, []);

  const handleClear = useCallback(() => {
    handleCancel();
    setItems([]);
    setSelectedFileName('');
    setCurrentCnpjIndex(0);
    setElapsedSeconds(0);
  }, [handleCancel]);

  const handleFileUpload = useCallback(async (file: File) => {
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
  }, []);

  const handleAddItemsFromAvulsa = useCallback((newRows: Array<{ cnpj: string; uf: string }>) => {
    const formattedNewItems: CnpjLookupItem[] = newRows.map((r, idx) => ({
      id: `avulsa-${idx + 1}-${Date.now()}`,
      cnpj: r.cnpj,
      uf: r.uf,
      statusConsulta: 'pendente'
    }));

    setItems(prev => [...prev, ...formattedNewItems]);
    if (onNavigateToLote) {
      onNavigateToLote();
    }
  }, [onNavigateToLote]);

  const handleExecuteSingleInstant = useCallback(async (cnpj: string, uf: string) => {
    const clean = onlyNumbers(cnpj);
    if (clean.length < 14) return;

    setIsQuickLoading(true);
    try {
      const formatted = formatCNPJ(clean);
      const result = await queryCnpjsData(formatted, uf);

      const fullItem: CnpjLookupItem = {
        id: `instant-${Date.now()}`,
        cnpj: formatted,
        uf,
        ...result,
        statusConsulta: 'sucesso'
      } as CnpjLookupItem;

      setItems(prev => [fullItem, ...prev]);
      setSelectedItem(fullItem);
    } finally {
      setIsQuickLoading(false);
    }
  }, []);

  const handleRefreshSingleItem = useCallback(async (id: string) => {
    const target = items.find(it => it.id === id);
    if (!target) return;

    setItems(prev => prev.map(it => it.id === id ? { ...it, statusConsulta: 'processando' } : it));
    try {
      const result = await queryCnpjsData(target.cnpj, target.uf);
      setItems(prev => prev.map(it => it.id === id ? { ...it, ...result, statusConsulta: 'sucesso' } : it));
    } catch {
      setItems(prev => prev.map(it => it.id === id ? {
        ...it,
        statusConsulta: 'erro',
        mensagemErro: 'Falha de comunicação com SEFAZ'
      } : it));
    }
  }, [items]);

  const handleExportToExcel = useCallback(() => {
    exportToExcel(items);
  }, [items]);

  // Compute stats
  const stats: BatchStats = useMemo(() => ({
    total: items.length,
    sucesso: items.filter(i => i.statusConsulta === 'sucesso').length,
    erro: items.filter(i => i.statusConsulta === 'erro').length,
    pendente: items.filter(i => i.statusConsulta === 'pendente').length,
    processando: items.filter(i => i.statusConsulta === 'processando').length
  }), [items]);

  return {
    items,
    setItems,
    selectedFileName,
    setSelectedFileName,
    isProcessing,
    isPaused,
    currentCnpjIndex,
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
    handleAddItemsFromAvulsa,
    handleExecuteSingleInstant,
    handleRefreshSingleItem,
    handleExportToExcel,
  };
}
