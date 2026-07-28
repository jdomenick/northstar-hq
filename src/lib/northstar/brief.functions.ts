// NorthStar Labs Executive Brief (NSL Brief).
//
// One server function assembles the five-section brief that greets the founder
// every morning: Business Status, Key Signals, What Changed, Priority Insights,
// and Recommended Focus. All values are derived from real DB state. The client
// renders the result unchanged - the server owns ranking, summarization, and RLS.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NslBriefTone = "strong" | "stable" | "attention" | "critical";

export interface NslBriefSignal {
  value: string;
  subtext: string;
  tone: "ok" | "warn" | "danger";
}

export interface NslBriefChange {
  id: string;
  title: string;
  detail: string;
  occurredAt: string;
  href: string | null;
}

export interface NslBriefInsight {
  id: string;
  rank: 1 | 2 | 3;
  title: string;
  summary: string | null;
  priority: string;
  href: string | null;
}

export interface NslBriefFocus {
  id: string;
  title: string;
  rationale: string;
  href: string | null;
}

export interface NslBrief {
  generatedAt: string;
  businessStatus: {
    sentence: string;
    tone: NslBriefTone;
  };
  keySignals: {
    revenue: NslBriefSignal;
    pipeline: NslBriefSignal;
    delivery: NslBriefSignal;
    risk: NslBriefSignal;
  };
  whatChanged: NslBriefChange[];
  priorityInsights: NslBriefInsight[];
  recommendedFocus: NslBriefFocus | null;
}

const Input = z.object({ organizationId: z.string().uuid() });

function fmtMoney(cents: number): string {
  const dollars = Math.round(cents) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(dollars);
}

function signalTone(value: number, warn: number, danger: number): "ok" | "warn" | "danger" {
  if (value >= danger) return "danger";
  if (value >= warn) return "warn";
  return "ok";
}

function healthTone(overall: number): NslBriefTone {
  if (overall >= 0.85) return "strong";
  if (overall >= 0.65) return "stable";
  if (overall >= 0.4) return "attention";
  return "critical";
}

function healthStatusWord(overall: number): string {
  if (overall >= 0.85) return "strong";
  if (overall >= 0.65) return "stable";
  if (overall >= 0.4) return "under pressure";
  return "critical";
}

function businessStatusSentence(
  revenue: { mrrCents: number; netCash30Cents: number; pipelineValueCents: number },
  delivery: { atRiskProjects: number; overdueCommitments: number; waitingDecisions: number },
  risk: { healthOverall: number | null; criticalInsights: number },
): { sentence: string; tone: NslBriefTone } {
  const health = risk.healthOverall ?? null;
  const tone = health !== null ? healthTone(health) : "stable";

  // Cash is the loudest signal.
  if (revenue.netCash30Cents < 0) {
    return {
      sentence: `Cash is negative this month (${fmtMoney(revenue.netCash30Cents)}). Revenue needs attention before delivery risk compounds.`,
      tone: "critical",
    };
  }

  // Critical operational blockers come next.
  if (criticalInsights > 0 || delivery.atRiskProjects > 0 || delivery.overdueCommitments > 0) {
    const parts: string[] = [];
    if (criticalInsights > 0) parts.push(`${criticalInsights} critical issue${criticalInsights === 1 ? "" : "s"}`);
    if (delivery.atRiskProjects > 0) parts.push(`${delivery.atRiskProjects} project${delivery.atRiskProjects === 1 ? "" : "s"} at risk`);
    if (delivery.overdueCommitments > 0) parts.push(`${delivery.overdueCommitments} overdue commitment${delivery.overdueCommitments === 1 ? "" : "s"}`);
    return {
      sentence: `Operations are ${health !== null ? healthStatusWord(health) : "under pressure"}: ${parts.join(", ")}.`,
      tone: tone === "strong" ? "attention" : tone,
    };
  }

  // Pipeline without delivery trouble.
  if (revenue.pipelineValueCents > 0 && revenue.mrrCents > 0) {
    return {
      sentence: `Revenue engine is stable with ${fmtMoney(revenue.pipelineValueCents)} in pipeline and ${fmtMoney(revenue.mrrCents)} MRR.`,
      tone: tone === "critical" || tone === "attention" ? "stable" : tone,
    };
  }

  if (revenue.mrrCents > 0) {
    return {
      sentence: `Core revenue is ${fmtMoney(revenue.mrrCents)} MRR. Pipeline is the next gap to close.`,
      tone: "stable",
    };
  }

  if (revenue.pipelineValueCents > 0) {
    return {
      sentence: `No active MRR yet, but ${fmtMoney(revenue.pipelineValueCents)} is in motion.`,
      tone: "attention",
    };
  }

  return {
    sentence: "NorthStar Labs is running. Add revenue data and active projects to complete the picture.",
    tone: "stable",
  };
}

function inferHrefFromActivity(action: string, entityType: string | null, entityId: string | null): string | null {
  if (!entityId) return null;
  switch (entityType) {
    case "project":
      return `/labs/projects/${entityId}`;
    case "decision":
      return `/labs/decisions/${entityId}`;
    case "commitment":
      return `/labs/commitments/${entityId}`;
    case "goal":
      return `/labs/goals/${entityId}`;
    case "venture":
      return `/labs/ventures/${entityId}`;
    case "knowledge_record":
      return `/labs/knowledge/${entityId}`;
    case "document":
      return `/labs/documents/${entityId}`;
    case "revenue_pipeline":
      return `/labs/revenue`;
    case "revenue_clients":
      return `/labs/revenue`;
    default:
      return null;
  }
}

function selectChanges(events: Array<{ id: string; action: string; entity_type: string | null; entity_id: string | null; summary: string | null; created_at: string }>): NslBriefChange[] {
  const meaningful = events.filter((e) => {
    const a = e.action ?? "";
    return (
      a.includes("completed") ||
      a.includes("created") ||
      a.includes("status_changed") ||
      a.includes("won") ||
      a.includes("launched") ||
      a.includes("approved") ||
      a.includes("published") ||
      a.includes("signed") ||
      a.includes("closed")
    );
  });

  const seen = new Set<string>();
  const out: NslBriefChange[] = [];
  for (const e of meaningful.slice(0, 12)) {
    const key = `${e.action}:${e.entity_type}:${e.entity_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: e.id,
      title: e.summary ?? e.action.replace(/\./g, " ").replace(/_/g, " ") ?? "Activity recorded",
      detail: e.summary ? e.action.replace(/\./g, " ").replace(/_/g, " ") : "",
      occurredAt: e.created_at,
      href: inferHrefFromActivity(e.action, e.entity_type, e.entity_id),
    });
    if (out.length >= 3) break;
  }
  return out;
}

export const getNSLBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { organizationId } = data;

    const { data: mem } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!mem) throw new Error("Not a member of this organization");

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

    const [
      clientsQ,
      pipelineQ,
      cashQ,
      proposalsQ,
      projectsQ,
      commitmentsQ,
      decisionsQ,
      insightsQ,
      recsQ,
      healthQ,
      activityQ,
    ] = await Promise.all([
      supabase.from("revenue_clients").select("id, status, mrr_cents, churned_at").eq("organization_id", organizationId),
      supabase.from("revenue_pipeline").select("id, name, stage, value_cents, probability, expected_close, closed_at").eq("organization_id", organizationId),
      supabase.from("revenue_cashflow_entries").select("id, direction, amount_cents, occurred_on").eq("organization_id", organizationId).gte("occurred_on", new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10)),
      supabase.from("revenue_proposals").select("id, status, amount_cents").eq("organization_id", organizationId),
      supabase.from("projects").select("id, name, status, deadline, progress_percentage, deleted_at").eq("organization_id", organizationId).is("deleted_at", null),
      supabase.from("commitments").select("id, title, status, due_date, deleted_at").eq("organization_id", organizationId).is("deleted_at", null),
      supabase.from("decisions").select("id, title, status, review_date, deleted_at").eq("organization_id", organizationId).is("deleted_at", null),
      supabase
        .from("executive_insights")
        .select("id, title, summary, priority, entity_ref")
        .eq("organization_id", organizationId)
        .is("dismissed_at", null)
        .order("priority", { ascending: true })
        .order("generated_at", { ascending: false })
        .limit(10),
      supabase
        .from("sam_recommendations")
        .select("id, title, rationale, priority")
        .eq("organization_id", organizationId)
        .in("status", ["pending"])
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("sam_health_snapshots")
        .select("id, overall, categories")
        .eq("organization_id", organizationId)
        .is("venture_id", null)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("activity_events")
        .select("id, action, entity_type, entity_id, summary, created_at")
        .eq("organization_id", organizationId)
        .gte("created_at", weekAgo)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const clients = (clientsQ.data ?? []) as Array<{ id: string; status: string; mrr_cents: number | null; churned_at: string | null }>;
    const activeClients = clients.filter((c) => c.status === "active");
    const mrrCents = activeClients.reduce((s, c) => s + (c.mrr_cents ?? 0), 0);
    const churnedThisQuarter = clients.filter((c) => {
      if (c.status !== "churned" || !c.churned_at) return false;
      return now.getTime() - new Date(c.churned_at).getTime() < 92 * 86_400_000;
    }).length;

    const pipeline = (pipelineQ.data ?? []) as Array<{
      id: string;
      name: string;
      stage: string;
      value_cents: number | null;
      probability: number | null;
      expected_close: string | null;
      closed_at: string | null;
    }>;
    const openDeals = pipeline.filter((d) => d.stage !== "won" && d.stage !== "lost");
    const pipelineValueCents = openDeals.reduce((s, d) => s + (d.value_cents ?? 0), 0);
    const weightedForecastCents = openDeals.reduce((s, d) => s + Math.round(((d.value_cents ?? 0) * (d.probability ?? 0)) / 100), 0);
    const soonestClose = openDeals
      .filter((d) => d.expected_close)
      .sort((a, b) => (a.expected_close! < b.expected_close! ? -1 : 1))[0]?.expected_close ?? null;

    const cash = (cashQ.data ?? []) as Array<{ id: string; direction: string; amount_cents: number | null; occurred_on: string }>;
    const inflow30 = cash.filter((e) => e.direction === "inflow").reduce((s, e) => s + (e.amount_cents ?? 0), 0);
    const outflow30 = cash.filter((e) => e.direction === "outflow").reduce((s, e) => s + (e.amount_cents ?? 0), 0);
    const netCash30Cents = inflow30 - outflow30;

    const proposals = (proposalsQ.data ?? []) as Array<{ id: string; status: string; amount_cents: number | null }>;
    const openProposals = proposals.filter((p) => p.status === "sent" || p.status === "draft");
    const proposalValueCents = openProposals.reduce((s, p) => s + (p.amount_cents ?? 0), 0);

    const projects = (projectsQ.data ?? []) as Array<{ id: string; name: string; status: string; deadline: string | null; progress_percentage: number | null; deleted_at: string | null }>;
    const atRiskProjects = projects.filter((p) => p.status === "at_risk" || p.status === "blocked");
    const inDelivery = projects.filter((p) => p.status === "in_progress" || p.status === "in_delivery");

    const commitments = (commitmentsQ.data ?? []) as Array<{ id: string; title: string; status: string; due_date: string | null; deleted_at: string | null }>;
    const overdueCommitments = commitments.filter((c) => c.status !== "completed" && c.status !== "canceled" && c.due_date && new Date(c.due_date) <= now);

    const decisions = (decisionsQ.data ?? []) as Array<{ id: string; title: string; status: string; review_date: string | null; deleted_at: string | null }>;
    const waitingDecisions = decisions.filter(
      (d) =>
        d.status === "under_review" ||
        d.status === "waiting_for_founder" ||
        (d.review_date && new Date(d.review_date) <= now && d.status !== "decided" && d.status !== "closed"),
    );

    const insights = (insightsQ.data ?? []) as Array<{ id: string; title: string; summary: string | null; priority: string; entity_ref: string | null }>;
    const criticalInsights = insights.filter((i) => i.priority === "critical").length;
    const highInsights = insights.filter((i) => i.priority === "high").length;
    const healthOverall = healthQ.data?.overall ?? null;

    const deliveryTone = signalTone(atRiskProjects.length + overdueCommitments.length, 1, 3);
    const riskTone = signalTone(
      (healthOverall !== null ? Math.round((1 - healthOverall) * 10) : 0) + criticalInsights * 3 + highInsights,
      3,
      6,
    );

    const businessStatus = businessStatusSentence(
      { mrrCents, netCash30Cents, pipelineValueCents },
      { atRiskProjects: atRiskProjects.length, overdueCommitments: overdueCommitments.length, waitingDecisions: waitingDecisions.length },
      { healthOverall, criticalInsights },
    );

    const revenueSignal: NslBriefSignal = {
      value: fmtMoney(mrrCents),
      subtext: `${activeClients.length} active client${activeClients.length === 1 ? "" : "s"}${churnedThisQuarter > 0 ? ` · ${churnedThisQuarter} churned this quarter` : ""}`,
      tone: netCash30Cents < 0 ? "danger" : activeClients.length === 0 ? "warn" : "ok",
    };

    const pipelineSignal: NslBriefSignal = {
      value: fmtMoney(pipelineValueCents),
      subtext: `${openDeals.length} open deal${openDeals.length === 1 ? "" : "s"}${openProposals.length > 0 ? ` · ${openProposals.length} open proposal${openProposals.length === 1 ? "" : "s"}` : ""}${soonestClose ? ` · next close ${new Date(soonestClose).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}`,
      tone: openDeals.length === 0 && pipelineValueCents === 0 ? "warn" : "ok",
    };

    const deliverySignal: NslBriefSignal = {
      value: `${atRiskProjects.length}`,
      subtext: `${inDelivery.length} in delivery · ${overdueCommitments.length} overdue · ${waitingDecisions.length} decisions waiting`,
      tone: deliveryTone,
    };

    const riskSignal: NslBriefSignal = {
      value: healthOverall !== null ? `${Math.round(healthOverall * 100)}` : "-",
      subtext: `${criticalInsights} critical · ${highInsights} high insight${highInsights === 1 ? "" : "s"}`,
      tone: riskTone,
    };

    const priorityInsights: NslBriefInsight[] = insights.slice(0, 3).map((i, idx) => ({
      id: i.id,
      rank: (idx + 1) as 1 | 2 | 3,
      title: i.title,
      summary: i.summary,
      priority: i.priority,
      href: i.entity_ref ? null : null, // href resolution kept for future use
    }));

    const topRec = (recsQ.data ?? [])[0] as { id: string; title: string; rationale: string; priority: string } | undefined;
    const recommendedFocus: NslBriefFocus | null = topRec
      ? {
          id: topRec.id,
          title: topRec.title,
          rationale: topRec.rationale,
          href: null,
        }
      : null;

    const whatChanged = selectChanges(
      (activityQ.data ?? []) as Array<{
        id: string;
        action: string;
        entity_type: string | null;
        entity_id: string | null;
        summary: string | null;
        created_at: string;
      }>,
    );

    return {
      generatedAt: now.toISOString(),
      businessStatus,
      keySignals: {
        revenue: revenueSignal,
        pipeline: pipelineSignal,
        delivery: deliverySignal,
        risk: riskSignal,
      },
      whatChanged,
      priorityInsights,
      recommendedFocus,
    } satisfies NslBrief;
  });
