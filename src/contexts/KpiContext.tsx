import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useApi } from '../hooks/useApi';

export interface KpiTotals {
  totalDocs: number;
  totalValor: number;
  totalBaseCbs: number;
  totalBaseIbs: number;
  totalCbs: number;
  totalIbs: number;
  totalIbsUf: number;
  totalIbsMun: number;
  totalIvaDual?: number;
  nfeCount?: number;
  nfceCount?: number;
  cteCount?: number;
  nfseCount?: number;
  nfeValor?: number;
  nfceValor?: number;
  cteValor?: number;
  nfseValor?: number;
  totalIcms?: number;
  totalPis?: number;
  totalCofins?: number;
  totalIpi?: number;
  totalIrrf?: number;
  totalInss?: number;
  totalIss?: number;
  totalBaseLiquida?: number;
  totalRegimeAtual?: number;
  totalRegimeReforma?: number;
  deltaTransicao?: number;
  simplesNacDocsCount?: number;
  cteInferidosCount?: number;
  icmsInferido?: number;
  pisInferido?: number;
  cofinsInferido?: number;
  issInferido?: number;
  [key: string]: any;
}

export interface KpiFilters {
  empresaId?: string;
  tipoOperacao?: string;
  tipoDoc?: string;
  dataInicio?: string;
  dataFim?: string;
}

interface KpiContextType {
  kpis: KpiTotals | null;
  totalGeral: KpiTotals | null;
  totalFiltrado: KpiTotals | null;
  isLoadingKpis: boolean;
  kpiError: string | null;
  refreshKpis: (filters?: KpiFilters) => Promise<void>;
}

const KpiContext = createContext<KpiContextType | undefined>(undefined);

const getCacheKey = (empresaId?: string) => (empresaId ? `@RadarFiscal:kpis_${empresaId}` : '');

export const KpiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { empresaAtiva, token } = useAuth();
  const { get } = useApi();
  const getRef = useRef(get);
  getRef.current = get;

  const [totalGeral, setTotalGeral] = useState<KpiTotals | null>(() => {
    try {
      if (empresaAtiva?.id) {
        const key = getCacheKey(empresaAtiva.id);
        const saved = key ? localStorage.getItem(key) : null;
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.totalGeral || parsed;
        }
      }
    } catch {}
    return null;
  });

  const [totalFiltrado, setTotalFiltrado] = useState<KpiTotals | null>(() => {
    try {
      if (empresaAtiva?.id) {
        const key = getCacheKey(empresaAtiva.id);
        const saved = key ? localStorage.getItem(key) : null;
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.totalFiltrado || parsed.totalGeral || parsed;
        }
      }
    } catch {}
    return null;
  });

  const [isLoadingKpis, setIsLoadingKpis] = useState<boolean>(false);
  const [kpiError, setKpiError] = useState<string | null>(null);

  const refreshKpis = useCallback(async (filters?: KpiFilters) => {
    if (!token) return;
    setIsLoadingKpis(true);
    try {
      const q = new URLSearchParams();
      const empId = filters?.empresaId || empresaAtiva?.id;
      if (empId) q.set('empresaId', empId);
      if (filters?.tipoOperacao && filters.tipoOperacao !== 'TODOS') q.set('tipoOperacao', filters.tipoOperacao);
      if (filters?.tipoDoc && filters.tipoDoc !== 'TODOS') q.set('tipoDoc', filters.tipoDoc);
      if (filters?.dataInicio) q.set('dataInicio', filters.dataInicio);
      if (filters?.dataFim) q.set('dataFim', filters.dataFim);

      const res = await getRef.current<{ success: boolean; totalGeral: KpiTotals; totalFiltrado: KpiTotals }>(`/upload/kpis?${q.toString()}`);
      const payload = (res as any)?.data || res;
      if (payload?.success && payload.totalGeral) {
        setTotalGeral(payload.totalGeral);
        setTotalFiltrado(payload.totalFiltrado || payload.totalGeral);
        setKpiError(null);
        try {
          if (empId) {
            const cacheData = JSON.stringify({
              totalGeral: payload.totalGeral,
              totalFiltrado: payload.totalFiltrado || payload.totalGeral
            });
            const key = getCacheKey(empId);
            if (key) localStorage.setItem(key, cacheData);
          }
          // Remove cache global para garantir que nenhum tenant contamine outro
          localStorage.removeItem('@RadarFiscal:kpis_global');
        } catch {}
      } else {
        const errMsg = (res as any)?.error || 'Resposta inválida do servidor de KPIs.';
        console.warn('⚠️ Falha ao obter KPIs:', errMsg);
        setKpiError(errMsg);
      }
    } catch (err: any) {
      console.warn('⚠️ Erro de rede ao atualizar KPIs globais:', err);
      setKpiError(err?.message || 'Erro de conexão com o servidor de indicadores.');
    } finally {
      setIsLoadingKpis(false);
    }
  }, [empresaAtiva?.id, token]);

  // Carrega ao montar ou quando a empresa ativa mudar.
  useEffect(() => {
    // Resetar imediatamente para evitar vazamento visual de dados da empresa anterior
    if (empresaAtiva?.id) {
      const key = getCacheKey(empresaAtiva.id);
      const cached = key ? localStorage.getItem(key) : null;
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setTotalGeral(parsed.totalGeral || parsed);
          setTotalFiltrado(parsed.totalFiltrado || parsed.totalGeral || parsed);
        } catch {
          setTotalGeral(null);
          setTotalFiltrado(null);
        }
      } else {
        setTotalGeral(null);
        setTotalFiltrado(null);
      }
    } else {
      setTotalGeral(null);
      setTotalFiltrado(null);
    }

    if (token) {
      refreshKpis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id, token]);

  return (
    <KpiContext.Provider value={{
      kpis: totalFiltrado || totalGeral,
      totalGeral,
      totalFiltrado,
      isLoadingKpis,
      kpiError,
      refreshKpis,
    }}>
      {children}
    </KpiContext.Provider>
  );
};

export function useKpis() {
  const context = useContext(KpiContext);
  if (!context) {
    throw new Error('useKpis deve ser usado dentro de um KpiProvider');
  }
  return context;
}
