// Structured item shapes stored inside decisions.options_considered / evidence / risks JSONB fields.
// Users never see raw JSON  -  these helpers normalize legacy shapes into typed lists.

export type OptionItem = {
  id: string;
  name: string;
  description?: string;
  advantages?: string;
  disadvantages?: string;
  effort?: string;
  cost?: string;
  upside?: string;
  notes?: string;
};

export type EvidenceItem = {
  id: string;
  title: string;
  description?: string;
  source?: string;
  source_url?: string;
  type?: string;
  reliability?: "low" | "medium" | "high";
  notes?: string;
};

export const EVIDENCE_TYPES = [
  "customer_feedback",
  "financial",
  "operational",
  "market",
  "product",
  "team",
  "research",
  "founder_judgment",
  "other",
] as const;

export type RiskItem = {
  id: string;
  risk: string;
  description?: string;
  likelihood?: "low" | "medium" | "high";
  impact?: "low" | "medium" | "high" | "critical";
  mitigation?: string;
  owner?: string;
  notes?: string;
};

function ensureArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  return [];
}
function withId<T extends { id?: string }>(items: T[]): (T & { id: string })[] {
  return items.map((it, i) => ({ ...it, id: it.id ?? `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}` }));
}

export const parseOptions = (v: unknown): OptionItem[] => withId(ensureArray<OptionItem>(v));
export const parseEvidence = (v: unknown): EvidenceItem[] => withId(ensureArray<EvidenceItem>(v));
export const parseRisks = (v: unknown): RiskItem[] => withId(ensureArray<RiskItem>(v));

export function newOption(): OptionItem {
  return { id: crypto.randomUUID(), name: "" };
}
export function newEvidence(): EvidenceItem {
  return { id: crypto.randomUUID(), title: "" };
}
export function newRisk(): RiskItem {
  return { id: crypto.randomUUID(), risk: "" };
}