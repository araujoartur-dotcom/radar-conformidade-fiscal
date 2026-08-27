/**
 * ============================================================
 * UTILITÁRIO DE TIMEZONE — HORÁRIO OFICIAL DE BRASÍLIA
 * ============================================================
 * Padronização temporal estrita para America/Sao_Paulo (UTC-03:00)
 * compatível com os padrões de schema da SEFAZ (YYYY-MM-DDThh:mm:ssTZD).
 * ============================================================
 */

export const BRASILIA_TIMEZONE = 'America/Sao_Paulo';
export const BRASILIA_OFFSET_STR = '-03:00';
export const BRASILIA_OFFSET_MINUTES = -180; // UTC - 3h

/**
 * Converte qualquer entrada de data (Date, string ISO, timestamp)
 * para um objeto Date correspondente ao fuso de Brasília.
 */
export function toBrasiliaDate(input?: Date | string | number | null): Date {
  if (!input) return new Date();
  if (input instanceof Date) return isNaN(input.getTime()) ? new Date() : input;
  
  if (typeof input === 'string') {
    // Se a string for apenas data YYYY-MM-DD, interpreta no fuso de Brasília
    if (/^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
      const [y, m, d] = input.trim().split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d, 3, 0, 0)); // UTC 03:00 -> 00:00 Brasília
    }
  }
  
  const d = new Date(input);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Retorna string timestamp compatível com SEFAZ no fuso de Brasília:
 * Formato: YYYY-MM-DDThh:mm:ss-03:00 (NT 2025.002 / Manual SEFAZ)
 */
export function getBrasiliaTimestamp(input?: Date | string | number | null): string {
  const d = toBrasiliaDate(input);
  
  // Obter partes no fuso America/Sao_Paulo via Intl
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRASILIA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  let hour = getPart('hour');
  if (hour === '24') hour = '00';
  const minute = getPart('minute');
  const second = getPart('second');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${BRASILIA_OFFSET_STR}`;
}

/**
 * Retorna apenas a data em Horário de Brasília (YYYY-MM-DD)
 */
export function getBrasiliaDate(input?: Date | string | number | null): string {
  const d = toBrasiliaDate(input);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRASILIA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

/**
 * Formata data/hora para exibição visual brasileira: DD/MM/YYYY HH:mm:ss
 */
export function formatBrasiliaDisplay(input?: Date | string | number | null): string {
  if (!input) return '—';
  const d = toBrasiliaDate(input);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRASILIA_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * Formata apenas data visual: DD/MM/YYYY
 */
export function formatBrasiliaDateDisplay(input?: Date | string | number | null): string {
  if (!input) return '—';
  const d = toBrasiliaDate(input);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRASILIA_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Retorna tag TDataHora no padrão estrito da SEFAZ
 */
export function formatSefazDh(input?: Date | string | number | null): string {
  return getBrasiliaTimestamp(input);
}

export default {
  BRASILIA_TIMEZONE,
  BRASILIA_OFFSET_STR,
  toBrasiliaDate,
  getBrasiliaTimestamp,
  getBrasiliaDate,
  formatBrasiliaDisplay,
  formatBrasiliaDateDisplay,
  formatSefazDh,
};
