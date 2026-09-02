/**
 * ============================================================
 * SERVIÇO DE HOT CACHE — RADAR DE CONFORMIDADE FISCAL
 * ============================================================
 * Mantém em memória de alta performance os documentos e KPIs
 * dos últimos 60 dias por empresa/tenant.
 * Responde a consultas frequentes em < 5 milissegundos.
 * ============================================================
 */

interface CachedData {
  documents: any[];
  totalCount: number;
  stats?: any;
  cachedAt: number;
  periodCutoff: string;
}

class HotCacheService {
  private cache: Map<string, CachedData> = new Map();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutos de TTL
  private stats = {
    hits: 0,
    misses: 0,
    invalidations: 0,
  };

  /**
   * Calcula a data limite dos últimos 60 dias (AAAA-MM-DD)
   */
  public getCutoffDate(days: number = 60): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  }

  /**
   * Verifica se a consulta é elegível para o Hot Cache (ex: sem filtro antigo ou últimos 60 dias)
   */
  public isHotQuery(filters: { dataInicio?: string; dataFim?: string; tipoDoc?: string; searchTerm?: string }): boolean {
    if (filters.searchTerm) return false;
    
    const cutoff = this.getCutoffDate(60);
    if (!filters.dataInicio) {
      // Se não especificou início, a consulta padrão traz os mais recentes
      return true;
    }
    // Se o dataInicio for maior ou igual ao cutoff dos 60 dias
    return filters.dataInicio >= cutoff;
  }

  /**
   * Retorna dados quentes se válidos no cache
   */
  public getHotData(tenantKey: string): { data: any[]; total: number; stats?: any; isHit: boolean; ageMs: number } | null {
    const entry = this.cache.get(tenantKey);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    const ageMs = now - entry.cachedAt;

    if (ageMs > this.TTL_MS) {
      this.cache.delete(tenantKey);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return {
      data: entry.documents,
      total: entry.totalCount,
      stats: entry.stats,
      isHit: true,
      ageMs,
    };
  }

  /**
   * Grava documentos no Hot Cache
   */
  public setHotData(tenantKey: string, documents: any[], totalCount: number, stats?: any): void {
    this.cache.set(tenantKey, {
      documents,
      totalCount,
      stats,
      cachedAt: Date.now(),
      periodCutoff: this.getCutoffDate(60),
    });
  }

  /**
   * Invalida o cache de uma empresa específica ou de todas
   */
  public invalidate(tenantKey?: string): void {
    this.stats.invalidations++;
    if (tenantKey) {
      this.cache.delete(tenantKey);
      console.log(`⚡ HotCache: Cache invalidado para a empresa/tenant: ${tenantKey}`);
    } else {
      this.cache.clear();
      console.log('⚡ HotCache: Cache global totalmente liberado.');
    }
  }

  /**
   * Retorna métricas do cache
   */
  public getMetrics() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
      : 0;

    return {
      activeTenantsInCache: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: `${hitRate.toFixed(1)}%`,
      invalidations: this.stats.invalidations,
      ttlMinutes: this.TTL_MS / 60000,
    };
  }
}

export const hotCache = new HotCacheService();
