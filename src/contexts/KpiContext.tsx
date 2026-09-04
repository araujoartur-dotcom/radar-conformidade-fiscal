import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  refreshKpis: (filters?: KpiFilters) => Promise<void>;
}

const KpiContext = createContext<KpiContextType | undefined>(undefined);

const getCacheKey = (empresaId?: string) => `@RadarFiscal:kpis_${empresaId || 'global'}`;

export const KpiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { empresaAtiva, token } = useAuth();
  const { get } = useApi();

  const [totalGeral, setTotalGeral] = useState<KpiTotals | null>(() => {
    try {
      const saved = localStorage.getItem(getCacheKey(empresaAtiva?.id)) || localStorage.getItem('@RadarFiscal:kpis_global');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.totalGeral || parsed;
      }
    } catch {}
    return null;
  });

  const [totalFiltrado, setTotalFiltrado] = useState<KpiTotals | null>(() => {
    try {
      const saved = localStorage.getItem(getCacheKey(empresaAtiva?.id)) || localStorage.getItem('@RadarFiscal:kpis_global');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.totalFiltrado || parsed.totalGeral || parsed;
      }
    } catch {}
    return null;
  });

  const [isLoadingKpis, setIsLoadingKpis] = useState<boolean>(false);

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

      const res = await get<{ success: boolean; totalGeral: KpiTotals; totalFiltrado: KpiTotals }>(`/upload/kpis?${q.toString()}`);
      const payload = (res as any)?.data || res;
      if (payload?.success && payload.totalGeral) {
        setTotalGeral(payload.totalGeral);
        setTotalFiltrado(payload.totalFiltrado || payload.totalGeral);
        try {
          const cacheData = JSON.stringify({
            totalGeral: payload.totalGeral,
            totalFiltrado: payload.totalFiltrado || payload.totalGeral
          });
          localStorage.setItem(getCacheKey(empId), cacheData);
          localStorage.setItem('@RadarFiscal:kpis_global', cacheData);
        } catch {}
      }
    } catch (err) {
      console.warn('⚠️ Erro ao atualizar KPIs globais:', err);
    } finally {
      setIsLoadingKpis(false);
    }
  }, [empresaAtiva?.id, token, get]);

  // Carrega ao montar ou quando a empresa ativa mudar
  useEffect(() => {
    if (token) {
      refreshKpis();
    }
  }, [empresaAtiva?.id, token, refreshKpis]);

  return (
    <KpiContext.Provider value={{
      kpis: totalFiltrado || totalGeral,
      totalGeral,
      totalFiltrado,
      isLoadingKpis,
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
