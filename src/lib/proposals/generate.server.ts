// Assembles a proposal draft from existing NorthStar Labs data. Missing
// sections stay as sentinel placeholders rather than fabricated content.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { NEEDS_INPUT } from "./content";

type DB = SupabaseClient<Database>;

function textOrNeeds(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  return s.length > 0 ? s : NEEDS_INPUT;
}

function bulletJoin(items: string[] | null | undefined, fallback: string): string {
  if (!items || items.length === 0) return fallback;
  return items.map((t) => `- ${t}`).join("\n");
}

export interface GeneratedDraft {
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

const DEFAULT_TERMS = `1. Acceptance of this proposal constitutes agreement to the scope, timeline, and investment described above.
2. Work begins after acceptance and completion of the setup workflow.
3. Either party may pause the engagement in writing with reasonable notice; work already delivered remains billable.
4. Confidentiality applies to all business information exchanged during the engagement.
5. NorthStar Labs may reference the engagement in case studies unless the client opts out in writing.`;

export async function assembleDraft(
  supabase: DB,
  orgId: string,
  clientId: string,
  pipelineId: string | null,
): Promise<GeneratedDraft> {
  const { data: client } = await supabase
    .from("revenue_clients").select("*").eq("id", clientId).eq("organization_id", orgId).maybeSingle();
  if (!client) throw new Error("client_not_found");

  const pipelineRes = pipelineId
    ? await supabase.from("revenue_pipeline").select("*").eq("id", pipelineId).eq("organization_id", orgId).maybeSingle()
    : { data: null as unknown };
  const pipeline = pipelineRes.data as Record<string, unknown> | null;

  const discoveryRes = pipelineId
    ? await supabase.from("revenue_discovery_briefs").select("*")
        .eq("organization_id", orgId).eq("deal_id", pipelineId).maybeSingle()
    : { data: null as unknown };
  const discovery = discoveryRes.data as Record<string, unknown> | null;

  const launchRes = pipelineId
    ? await supabase.from("revenue_launch_docs").select("*")
        .eq("organization_id", orgId).eq("deal_id", pipelineId).maybeSingle()
    : { data: null as unknown };
  const launch = launchRes.data as Record<string, unknown> | null;

  const { data: orgCtx } = await supabase.from("organization_operating_context").select("*")
    .eq("organization_id", orgId).maybeSingle();

  const clientName = (client as { name?: string }).name ?? "Client";
  const pipelineValueCents = Number((pipeline?.value_cents as number | null | undefined) ?? 0);
  const mrrCents = Number((client as { mrr_cents?: number }).mrr_cents ?? 0);

  const painPoints = toStringArray(discovery?.pain_points);
  const goals = toStringArray(discovery?.goals);
  const research = (discovery?.research_summary as string | null | undefined) ?? "";
  const budgetRange = (discovery?.budget_range as string | null | undefined) ?? "";

  const deliverables = toStringArray(launch?.deliverables);
  const timeline = (launch?.summary as string | null | undefined) ?? "";

  const companySummary = (orgCtx as { company_summary?: string } | null)?.company_summary ?? "";

  return {
    title: `Engagement Proposal for ${clientName}`,
    executive_summary: textOrNeeds(
      research || `NorthStar Labs proposes a focused engagement with ${clientName} to address the priorities surfaced in discovery and unlock the growth opportunities identified in our assessment.`,
    ),
    business_overview: textOrNeeds(companySummary),
    current_challenges: bulletJoin(painPoints, NEEDS_INPUT),
    assessment_summary: textOrNeeds(research),
    growth_opportunities: bulletJoin(goals, NEEDS_INPUT),
    recommended_strategy: NEEDS_INPUT,
    recommended_services: NEEDS_INPUT,
    deliverables: bulletJoin(deliverables, NEEDS_INPUT),
    implementation_timeline: textOrNeeds(timeline),
    investment_summary: budgetRange
      ? `Budget range indicated in discovery: ${budgetRange}. Detailed investment to be confirmed below.`
      : NEEDS_INPUT,
    payment_schedule: NEEDS_INPUT,
    terms: DEFAULT_TERMS,
    total_value_cents: pipelineValueCents,
    setup_fee_cents: 0,
    recurring_fee_cents: mrrCents,
  };
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter((s) => s.length > 0);
  return [];
}