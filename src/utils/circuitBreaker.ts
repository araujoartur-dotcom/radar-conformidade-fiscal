/**
 * ============================================================
 * CIRCUIT BREAKER & DEAD-LETTER QUEUE (DLQ) RESILIENTE
 * ============================================================
 * Máquina de estados para proteção contra falhas da SEFAZ
 * e ERPs (CLOSED -> OPEN -> HALF_OPEN).
 * ============================================================
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number; // Quantidade de falhas para abrir o circuito (ex: 5)
  successThreshold: number; // Quantidade de sucessos no modo HALF_OPEN para fechar (ex: 2)
  resetTimeoutMs: number; // Tempo em OPEN antes de ir para HALF_OPEN (ex: 30000ms)
}

export interface CircuitBreakerMetrics {
  name: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: string | null;
  lastSuccessTime: string | null;
  totalCalls: number;
  totalRejected: number;
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private totalCalls: number = 0;
  private totalRejected: number = 0;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  public getState(): CircuitState {
    // Se estiver OPEN, verificar se expirou o timeout para transicionar para HALF_OPEN
    if (this.state === 'OPEN' && this.lastFailureTime) {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.config.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      }
    }
    return this.state;
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();
    this.totalCalls++;

    if (currentState === 'OPEN') {
      this.totalRejected++;
      throw new Error(`[CircuitBreaker:${this.config.name}] Circuito ABERTO. Chamada bloqueada para proteger o serviço.`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err: any) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }
    } else if (this.state === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  public getMetrics(): CircuitBreakerMetrics {
    return {
      name: this.config.name,
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      lastSuccessTime: this.lastSuccessTime ? new Date(this.lastSuccessTime).toISOString() : null,
      totalCalls: this.totalCalls,
      totalRejected: this.totalRejected,
    };
  }

  public forceReset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
  }
}

// Instâncias Globais de Circuit Breakers do Sistema
export const sefazCircuitBreaker = new CircuitBreaker({
  name: 'SEFAZ_WEBSERVICE',
  failureThreshold: 4,
  successThreshold: 2,
  resetTimeoutMs: 25000,
});

export const erpCircuitBreaker = new CircuitBreaker({
  name: 'ERP_INTEGRATION_GATEWAY',
  failureThreshold: 3,
  successThreshold: 2,
  resetTimeoutMs: 20000,
});
