/**
 * ============================================================
 * UTILITÁRIO DE TIMEZONE — FRONTEND (HORÁRIO OFICIAL DE BRASÍLIA)
 * ============================================================
 * Padroniza a exibição de datas, horários e carimbos de auditoria
 * para o fuso America/Sao_Paulo (UTC-03:00).
 * ============================================================
 */

export const BRASILIA_TIMEZONE = 'America/Sao_Paulo';
export const BRASILIA_OFFSET_STR = '-03:00';

export function toBrasiliaDate(input?: Date | string | number | null): Date {
  if (!input) return new Date();
  if (input instanceof Date) return isNaN(input.getTime()) ? new Date() : input;
  
  if (typeof input === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
      const [y, m, d] = input.trim().split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d, 3, 0, 0));
    }
  }
  
  const d = new Date(input);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function formatBrasiliaDateTime(input?: Date | string | number | null): string {
  if (!input) return '—';
  const d = toBrasiliaDate(input);
  try {
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
  } catch {
    return String(input);
  }
}

export function formatBrasiliaDate(input?: Date | string | number | null): string {
  if (!input) return '—';
  const d = toBrasiliaDate(input);
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: BRASILIA_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return String(input);
  }
}

export function formatBrasiliaTime(input?: Date | string | number | null): string {
  if (!input) return '—';
  const d = toBrasiliaDate(input);
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: BRASILIA_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return String(input);
  }
}

export function getBrasiliaTimestamp(input?: Date | string | number | null): string {
  const d = toBrasiliaDate(input);
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

export default {
  BRASILIA_TIMEZONE,
  BRASILIA_OFFSET_STR,
  toBrasiliaDate,
  formatBrasiliaDateTime,
  formatBrasiliaDate,
  formatBrasiliaTime,
  getBrasiliaTimestamp,
};
