// Server-only Executive Reporting V1 assembly.
//
// Nothing in this module calculates a business outcome. Delivery, billing,
// activity, and deliverables are read through the existing client workspace
// and delivery loaders so there is exactly one interpretation of state.
// Business outcome numbers are read from recorded rows only. When a value has
// not been recorded, the metric is omitted rather than shown as zero.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ClientIdentityError } from "@/lib/client-identity/errors";
import {
  resolveClientAccount,
  requireOrgMember,
  loadClientWorkspace,
} from "@/lib/client-workspace/workspace.server";
import { loadClientDelivery } from "@/lib/delivery/client-delivery.server";
import {
  DELIVERABLE_STATUS_LABEL,
  DELIVERY_STAGE_LABEL,
  DELIVERY_HEALTH_LABEL,
} from "@/lib/delivery/client-delivery";
import { actorName } from "@/lib/actor-names";
import {
  isMetricUnit,
  isReportActivity,
  type ClientExecutiveReportView,
  type ExecutiveReportVersion,
  type MetricUnit,
  type OperatorExecutiveReportView,
  type OutcomeMetric,
  type ReportBilling,
  type ReportEngagement,
} from "./types";

type SB = SupabaseClient<Database>;
type ReportRow = Database["public"]["Tables"]["client_executive_reports"]["Row"];
type MetricRow = Database["public"]["Tables"]["client_outcome_metrics"]["Row"];

const REPORT_FIELDS = "id, version, summary, business_notes, highlights, created_at, created_by";
const METRIC_FIELDS =
  "id, metric_key, label, value_numeric, value_unit, period_start, period_end, source_label, client_visible, sort_order";

function toHighlights(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function toVersion(row: ReportRow, createdByName: string | null): ExecutiveReportVersion {
  return {
    id: row.id,
    version: row.version,
    summary: row.summary,
    business_notes: row.business_notes,
    highlights: toHighlights(row.highlights),
    created_at: row.created_at,
    created_by_name: createdByName,
  };
}

function toMetric(row: MetricRow): OutcomeMetric {
  const unit: MetricUnit = isMetricUnit(row.value_unit) ? row.value_unit : "count";
  return {
    id: row.id,
    metric_key: row.metric_key,
    label: row.label,
    value: Number(row.value_numeric),
    unit,
    period_start: row.period_start,
    period_end: row.period_end,
    source_label: row.source_label,
    client_visible: row.client_visible,
    sort_order: row.sort_order,
  };
}

/** Billing snapshot derived entirely from invoices already visible to the client. */
export function buildBillingSnapshot(
  stageLabel: string,
  invoices: ReadonlyArray<{
    id: string;
    label: string;
    status: string;
    amount_cents: number;
    amount_remaining_cents: number;
    currency: string;
    due_at: string | null;
    paid_at: string | null;
  }>,
): ReportBilling {
  const outstanding = invoices
    .filter((i) => i.status === "open" || i.status === "past_due" || i.status === "uncollectible")
    .reduce((sum, i) => sum + i.amount_remaining_cents, 0);

  const paid = invoices
    .filter((i) => i.paid_at)
    .sort((a, b) => (a.paid_at! < b.paid_at! ? 1 : -1));
  const lastPaid = paid[0];

  const upcoming = invoices
    .filter((i) => i.status === "open" && i.due_at)
    .sort((a, b) => (a.due_at! > b.due_at! ? 1 : -1));
  const next = upcoming[0];

  return {
    status_label: stageLabel,
    currency: invoices[0]?.currency ?? "usd",
    invoices: invoices.map((i) => ({
      id: i.id,
      label: i.label,
      status: i.status,
      amount_cents: i.amount_cents,
      amount_remaining_cents: i.amount_remaining_cents,
      currency: i.currency,
      due_at: i.due_at,
      paid_at: i.paid_at,
    })),
    outstanding_cents: outstanding,
    last_payment: lastPaid
      ? {
          amount_cents: lastPaid.amount_cents - lastPaid.amount_remaining_cents,
          paid_at: lastPaid.paid_at as string,
          label: lastPaid.label,
        }
      : null,
    next_invoice: next
      ? { label: next.label, due_at: next.due_at as string, amount_cents: next.amount_remaining_cents }
      : null,
  };
}

/* --------------------------------- client -------------------------------- */

export async function loadClientExecutiveReport(
  supabase: SB,
  userId: string,
): Promise<ClientExecutiveReportView> {
  const acct = await resolveClientAccount(supabase, userId);

  const [workspace, delivery, reportRes, metricRes] = await Promise.all([
    loadClientWorkspace(supabase, userId),
    loadClientDelivery(supabase, userId),
    supabase
      .from("client_executive_reports")
      .select(REPORT_FIELDS)
      .eq("client_id", acct.client_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("client_outcome_metrics")
      .select(METRIC_FIELDS)
      .eq("client_id", acct.client_id)
      .eq("client_visible", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (reportRes.error) throw new ClientIdentityError("internal_error", reportRes.error.message);
  if (metricRes.error) throw new ClientIdentityError("internal_error", metricRes.error.message);

  // The client never sees who inside NorthStar Labs authored the report.
  const published = reportRes.data ? toVersion(reportRes.data as ReportRow, null) : null;
  const outcomes = (metricRes.data ?? []).map((r) => toMetric(r as MetricRow));

  const engagement: ReportEngagement | null = delivery.project
    ? {
        stage_label: delivery.project.stage_label || DELIVERY_STAGE_LABEL[delivery.project.stage],
        status_label: DELIVERY_HEALTH_LABEL[delivery.project.health],
        progress_percent: delivery.progress.percent,
        progress_complete: delivery.progress.complete,
        progress_total: delivery.progress.total,
        next_client_action:
          delivery.next_step.action === "review_deliverable" ||
          delivery.next_step.action === "complete_milestone"
            ? delivery.next_step.headline
            : null,
        next_northstar_action: delivery.project.next_action.trim() || null,
      }
    : null;

  const activity = workspace.events
    .filter((e) => isReportActivity(e.event_type))
    .slice(0, 8)
    .map((e) => ({ id: e.id, title: e.title, occurred_at: e.occurred_at }));

  const deliverables = delivery.deliverables.map((d) => ({
    id: d.id,
    title: d.title,
    version_label: d.version_label,
    status_label: DELIVERABLE_STATUS_LABEL[d.status],
    shared_at: d.shared_at,
    has_file: d.has_file,
  }));

  const billing = buildBillingSnapshot(workspace.stage_label, workspace.invoices);

  return {
    client_name: workspace.company_profile.operating_name.trim() ||
      workspace.company_profile.legal_business_name.trim() ||
      "Your company",
    published,
    outcomes,
    engagement,
    activity,
    deliverables,
    billing,
    has_content: Boolean(
      published ||
        outcomes.length ||
        engagement ||
        activity.length ||
        deliverables.length ||
        billing.invoices.length,
    ),
  };
}

/* -------------------------------- operator ------------------------------- */

async function resolveAuthorNames(
  supabase: SB,
  ids: ReadonlyArray<string | null>,
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((v): v is string => Boolean(v))));
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const { data } = await supabase
    .from("profiles")
    .select("id, preferred_name, full_name, email")
    .in("id", unique);
  for (const p of data ?? []) out.set(p.id, actorName(p));
  return out;
}

export async function loadOperatorExecutiveReport(
  supabase: SB,
  organizationId: string,
  clientId: string,
  userId: string,
): Promise<OperatorExecutiveReportView> {
  await requireOrgMember(supabase, organizationId, userId);

  const [clientRes, reportRes, metricRes] = await Promise.all([
    supabase
      .from("revenue_clients")
      .select("id, name")
      .eq("id", clientId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("client_executive_reports")
      .select(REPORT_FIELDS)
      .eq("client_id", clientId)
      .eq("organization_id", organizationId)
      .order("version", { ascending: false })
      .limit(25),
    supabase
      .from("client_outcome_metrics")
      .select(METRIC_FIELDS)
      .eq("client_id", clientId)
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true }),
  ]);

  if (!clientRes.data) throw new ClientIdentityError("client_not_found");
  if (reportRes.error) throw new ClientIdentityError("internal_error", reportRes.error.message);
  if (metricRes.error) throw new ClientIdentityError("internal_error", metricRes.error.message);

  const rows = (reportRes.data ?? []) as ReportRow[];
  const names = await resolveAuthorNames(supabase, rows.map((r) => r.created_by));
  const versions = rows.map((r) => toVersion(r, r.created_by ? names.get(r.created_by) ?? null : null));

  return {
    client_name: clientRes.data.name,
    current: versions[0] ?? null,
    history: versions.slice(1),
    outcomes: (metricRes.data ?? []).map((r) => toMetric(r as MetricRow)),
  };
}

/** Every save publishes a new immutable version. History is never rewritten. */
export async function publishExecutiveReport(
  supabase: SB,
  organizationId: string,
  userId: string,
  input: { clientId: string; summary: string; businessNotes: string; highlights: string[] },
): Promise<{ version: number }> {
  await requireOrgMember(supabase, organizationId, userId);

  const { data: latest, error: latestError } = await supabase
    .from("client_executive_reports")
    .select("version")
    .eq("client_id", input.clientId)
    .eq("organization_id", organizationId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw new ClientIdentityError("internal_error", latestError.message);

  const version = (latest?.version ?? 0) + 1;
  const { error } = await supabase.from("client_executive_reports").insert({
    organization_id: organizationId,
    client_id: input.clientId,
    version,
    summary: input.summary,
    business_notes: input.businessNotes,
    highlights: input.highlights as unknown as Database["public"]["Tables"]["client_executive_reports"]["Insert"]["highlights"],
    created_by: userId,
  });
  if (error) throw new ClientIdentityError("internal_error", error.message);
  return { version };
}

export async function upsertOutcomeMetric(
  supabase: SB,
  organizationId: string,
  userId: string,
  input: {
    clientId: string;
    metricKey: string;
    label: string;
    value: number;
    unit: MetricUnit;
    periodStart: string | null;
    periodEnd: string | null;
    sourceLabel: string;
    clientVisible: boolean;
    sortOrder: number;
  },
): Promise<void> {
  await requireOrgMember(supabase, organizationId, userId);
  const { error } = await supabase.from("client_outcome_metrics").upsert(
    {
      organization_id: organizationId,
      client_id: input.clientId,
      metric_key: input.metricKey,
      label: input.label,
      value_numeric: input.value,
      value_unit: input.unit,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      source_label: input.sourceLabel,
      client_visible: input.clientVisible,
      sort_order: input.sortOrder,
      recorded_by: userId,
    },
    { onConflict: "client_id,metric_key" },
  );
  if (error) throw new ClientIdentityError("internal_error", error.message);
}

export async function deleteOutcomeMetric(
  supabase: SB,
  organizationId: string,
  userId: string,
  metricId: string,
): Promise<void> {
  await requireOrgMember(supabase, organizationId, userId);
  const { error } = await supabase
    .from("client_outcome_metrics")
    .delete()
    .eq("id", metricId)
    .eq("organization_id", organizationId);
  if (error) throw new ClientIdentityError("internal_error", error.message);
}