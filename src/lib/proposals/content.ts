// Fixed proposal section list (order matters). Shared between editor,
// preview, PDF renderer, and version-snapshot hashing.

export interface ProposalContent {
  title: string;
  executive_summary: string;
  business_overview: string;
  current_challenges: string;
  assessment_summary: string;
  growth_opportunities: string;
  recommended_strategy: string;
  recommended_services: string;
  deliverables: string;
  implementation_timeline: string;
  investment_summary: string;
  payment_schedule: string;
  terms: string;
  total_value_cents: number;
  setup_fee_cents: number;
  recurring_fee_cents: number;
}

export const SECTIONS: Array<{
  key: keyof ProposalContent;
  label: string;
  multiline: boolean;
}> = [
  { key: "executive_summary", label: "Executive Summary", multiline: true },
  { key: "business_overview", label: "Business Overview", multiline: true },
  { key: "current_challenges", label: "Current Business Challenges", multiline: true },
  { key: "assessment_summary", label: "Executive Assessment Summary", multiline: true },
  { key: "growth_opportunities", label: "Growth Opportunities", multiline: true },
  { key: "recommended_strategy", label: "Recommended Strategy", multiline: true },
  { key: "recommended_services", label: "Recommended Services", multiline: true },
  { key: "deliverables", label: "Deliverables", multiline: true },
  { key: "implementation_timeline", label: "Implementation Timeline", multiline: true },
  { key: "investment_summary", label: "Investment", multiline: true },
  { key: "payment_schedule", label: "Payment Schedule", multiline: true },
  { key: "terms", label: "Terms and Conditions", multiline: true },
];

export const NEEDS_INPUT = "[Needs input]";

export function contentHash(c: Partial<ProposalContent>): string {
  const parts = [
    c.title ?? "",
    c.executive_summary ?? "",
    c.business_overview ?? "",
    c.current_challenges ?? "",
    c.assessment_summary ?? "",
    c.growth_opportunities ?? "",
    c.recommended_strategy ?? "",
    c.recommended_services ?? "",
    c.deliverables ?? "",
    c.implementation_timeline ?? "",
    c.investment_summary ?? "",
    c.payment_schedule ?? "",
    c.terms ?? "",
    String(c.total_value_cents ?? 0),
    String(c.setup_fee_cents ?? 0),
    String(c.recurring_fee_cents ?? 0),
  ];
  // Fast non-crypto hash (djb2) - just needs to detect material change.
  let h = 5381;
  const s = parts.join("\u0001");
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

export function formatMoneyCents(cents: number | null | undefined): string {
  const n = (cents ?? 0) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}