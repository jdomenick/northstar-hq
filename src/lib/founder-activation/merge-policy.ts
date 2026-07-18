// Pure helpers for the Founder Activation import path.
//
// The merge rule: only fill fields that are currently null / empty. Never
// overwrite populated data.

export function shouldFill(existing: unknown): boolean {
  if (existing === null || existing === undefined) return true;
  if (typeof existing === "string" && existing.trim().length === 0) return true;
  return false;
}

export function mergePatch<T extends Record<string, unknown>>(existing: T, incoming: Partial<T>): Partial<T> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || value === null) continue;
    if (shouldFill(existing[key])) patch[key] = value;
  }
  return patch as Partial<T>;
}

export function pickTopBy<T>(items: T[], score: (item: T) => number, n: number): T[] {
  return [...items].sort((a, b) => score(b) - score(a)).slice(0, n);
}

export function priorityRank(p: string | null | undefined): number {
  switch (p) {
    case "critical": return 4;
    case "high": return 3;
    case "normal": return 2;
    case "low": return 1;
    default: return 0;
  }
}
