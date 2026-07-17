// Shared date arithmetic for workflow analyzers. Deterministic, timezone-neutral.
// All comparisons use UTC to avoid clock drift; presentation layers can localize.

const DAY_MS = 24 * 60 * 60 * 1000;

export function now(): Date {
  return new Date();
}

export function parseDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export function daysUntil(target: string | null | undefined, from: Date = now()): number | null {
  const d = parseDate(target);
  if (!d) return null;
  return daysBetween(from, d);
}

export function daysSince(source: string | null | undefined, from: Date = now()): number | null {
  const d = parseDate(source);
  if (!d) return null;
  return daysBetween(d, from);
}

export function isOverdue(due: string | null | undefined, from: Date = now()): boolean {
  const n = daysUntil(due, from);
  return n !== null && n < 0;
}

export function isDueWithin(due: string | null | undefined, days: number, from: Date = now()): boolean {
  const n = daysUntil(due, from);
  return n !== null && n >= 0 && n <= days;
}

export function inRange(iso: string | null | undefined, start: string | null, end: string | null): boolean {
  if (!iso || !start || !end) return false;
  const t = new Date(iso).getTime();
  return t >= new Date(start).getTime() && t <= new Date(end).getTime();
}