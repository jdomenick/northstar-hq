/**
 * Cross-app reporting contract for NorthStar HQ.
 *
 * HQ never copies source data. It reads through to CAM, CCM, NorthStar CRM and
 * SAM Core at request time and renders whatever those sources return, or a
 * truthful not_connected / unavailable state.
 *
 * Every normalizer here is defensive and version aware: source payloads may use
 * snake_case or camelCase, may omit fields, and may change shape between
 * versions. A missing field becomes null and the UI shows it as unavailable.
 * Nothing in this module invents a value.
 */

export type ModuleKey = "cam" | "ccm" | "crm" | "sam";

export const MODULE_KEYS: ModuleKey[] = ["cam", "ccm", "crm", "sam"];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  cam: "CAM",
  ccm: "CCM",
  crm: "NorthStar CRM",
  sam: "SAM Core",
};

/** Env var holding each module's reporting base URL. */
export const MODULE_URL_ENV: Record<ModuleKey, string> = {
  cam: "CAM_REPORTING_URL",
  ccm: "CCM_REPORTING_URL",
  crm: "CRM_REPORTING_URL",
  sam: "SAM_REPORTING_URL",
};

export const REPORTING_SECRET_ENV = "NORTHSTAR_REPORTING_SECRET";
export const REPORTING_SECRET_HEADER = "X-NorthStar-Reporting-Secret";
export const REPORTING_PATH = "/api/public/reporting/hq-dashboard";

export type SourceStatus = "ok" | "not_connected" | "unavailable";

export interface ModuleSource<T> {
  module: ModuleKey;
  status: SourceStatus;
  /** Present only when status is "ok". */
  data: T | null;
  /** Truthful operator-facing reason when data cannot be shown. */
  reason: string | null;
  /** Version string reported by the source payload, when present. */
  version: string | null;
  fetchedAt: string | null;
  /** External tenant/business/org id the report was scoped to, when scoped. */
  externalId: string | null;
}

export function moduleOk<T>(
  module: ModuleKey,
  data: T,
  version: string | null,
  externalId: string | null = null,
): ModuleSource<T> {
  return {
    module,
    status: "ok",
    data,
    reason: null,
    version,
    fetchedAt: new Date().toISOString(),
    externalId,
  };
}

export function moduleNotConnected<T>(
  module: ModuleKey,
  reason: string,
): ModuleSource<T> {
  return {
    module,
    status: "not_connected",
    data: null,
    reason,
    version: null,
    fetchedAt: null,
    externalId: null,
  };
}

export function moduleUnavailable<T>(
  module: ModuleKey,
  reason: string,
  externalId: string | null = null,
): ModuleSource<T> {
  return {
    module,
    status: "unavailable",
    data: null,
    reason,
    version: null,
    fetchedAt: new Date().toISOString(),
    externalId,
  };
}

/* ------------------------------- primitives ------------------------------- */

type Unknown = Record<string, unknown>;

export function asRecord(value: unknown): Unknown | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Unknown)
    : null;
}

function camelOf(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}

function snakeOf(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Reads the first present key, tolerating snake_case / camelCase variants. */
export function pick(source: unknown, ...keys: string[]): unknown {
  const rec = asRecord(source);
  if (!rec) return undefined;
  for (const key of keys) {
    for (const variant of [key, camelOf(key), snakeOf(key)]) {
      if (variant in rec && rec[variant] !== undefined && rec[variant] !== null) {
        return rec[variant];
      }
    }
  }
  return undefined;
}

export function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/[$,%\s,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function isoDate(value: unknown): string | null {
  const raw = str(value);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/* -------------------------------- shapes ---------------------------------- */

export interface TrendPoint {
  label: string;
  value: number;
}

export interface ChannelRow {
  channel: string;
  leads: number | null;
  appointments: number | null;
  revenueCents: number | null;
  changePct: number | null;
}

export type ActivityTone = "ok" | "warn" | "alert" | "muted";

export interface ActivityRow {
  source: ModuleKey;
  title: string;
  meta: string | null;
  occurredAt: string | null;
  tone: ActivityTone;
}

export interface CamReport {
  leads: number | null;
  qualifiedLeads: number | null;
  appointments: number | null;
  customers: number | null;
  /** CAM reports revenue in major currency units; stored here as cents. */
  revenueCents: number | null;
  /** CAM does not report ad spend today. Stays null; never fabricated. */
  spendCents: number | null;
  cplCents: number | null;
  roas: number | null;
  trend: TrendPoint[];
  channels: ChannelRow[];
  activity: ActivityRow[];
}


export interface CcmReport {
  conversations: number | null;
  avgResponseSeconds: number | null;
  appointments: number | null;
  bookingFailures: number | null;
  trend: TrendPoint[];
  activity: ActivityRow[];
}

export interface CrmReport {
  customers: number | null;
  openDeals: number | null;
  pipelineValueCents: number | null;
  wonInRange: number | null;
  attributableRevenueCents: number | null;
  stages: TrendPoint[];
  activity: ActivityRow[];
}

export interface SamReport {
  status: string | null;
  consumers: number | null;
  events: number | null;
  tasksProcessed: number | null;
  successRatePct: number | null;
  avgProcessingMs: number | null;
  failures: ActivityRow[];
}

export interface ModuleDashboard {
  cam: ModuleSource<CamReport>;
  ccm: ModuleSource<CcmReport>;
  crm: ModuleSource<CrmReport>;
  sam: ModuleSource<SamReport>;
}

/* ------------------------------ normalizers ------------------------------- */

export function normalizeVersion(payload: unknown): string | null {
  return str(pick(payload, "contract_version", "version", "schema_version", "api_version"));
}


/** Source payloads may nest under `data`, `report`, or `result`. */
export function unwrapPayload(payload: unknown): unknown {
  const rec = asRecord(payload);
  if (!rec) return payload;
  for (const key of ["data", "report", "result", "dashboard"]) {
    const inner = asRecord(rec[key]);
    if (inner) return inner;
  }
  return rec;
}

function normalizeTrend(value: unknown): TrendPoint[] {
  return list(value)
    .map((point) => {
      if (typeof point === "number") return null;
      const label = str(pick(point, "label", "name", "period", "date", "stage"));
      const v = num(pick(point, "value", "count", "total", "amount"));
      if (label === null || v === null) return null;
      return { label, value: v };
    })
    .filter((p): p is TrendPoint => p !== null);
}

function centsOf(source: unknown, ...keys: string[]): number | null {
  const centsKeys = keys.map((k) => `${k}_cents`);
  const cents = num(pick(source, ...centsKeys));
  if (cents !== null) return Math.round(cents);
  const major = num(pick(source, ...keys));
  return major === null ? null : Math.round(major * 100);
}

function normalizeChannels(value: unknown): ChannelRow[] {
  return list(value)
    .map((row) => {
      const channel = str(pick(row, "channel", "source", "name"));
      if (!channel) return null;
      return {
        channel,
        leads: num(pick(row, "leads", "lead_count")),
        appointments: num(pick(row, "appointments", "appts", "booked")),
        revenueCents: centsOf(row, "revenue", "value"),
        changePct: num(pick(row, "change_pct", "delta", "change")),
      };
    })
    .filter((r): r is ChannelRow => r !== null);
}

function toneOf(value: unknown): ActivityTone {
  const raw = (str(value) ?? "").toLowerCase();
  if (["error", "failed", "failure", "alert", "critical"].includes(raw)) return "alert";
  if (["warn", "warning", "retry", "degraded"].includes(raw)) return "warn";
  if (["ok", "success", "succeeded", "healthy"].includes(raw)) return "ok";
  return "muted";
}

export function normalizeActivity(module: ModuleKey, value: unknown): ActivityRow[] {
  return list(value)
    .map((row) => {
      const title = str(pick(row, "title", "message", "event", "summary", "name"));
      if (!title) return null;
      return {
        source: module,
        title,
        meta: str(pick(row, "meta", "detail", "description", "channel")),
        occurredAt: isoDate(pick(row, "occurred_at", "created_at", "timestamp", "at")),
        tone: toneOf(pick(row, "tone", "status", "severity", "level")),
      };
    })
    .filter((r): r is ActivityRow => r !== null);
}

/* -------------------- contract-specific normalizers ----------------------- */

export interface NormalizeContext {
  /** Mapped external id used for the request, when the read was client scoped. */
  externalId?: string | null;
}

/** Sums a list of nullable numbers. Returns null when nothing was reported. */
function sumOrNull(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length === 0 ? null : present.reduce((a, b) => a + b, 0);
}

/** Reads a source "availability object": { available: boolean, value?: number }. */
function availableNumber(value: unknown): number | null {
  const rec = asRecord(value);
  if (!rec) return num(value);
  if (rec["available"] !== true) return null;
  return num(rec["value"]);
}

function activityRow(
  module: ModuleKey,
  title: string,
  meta: string | null,
  occurredAt: string | null,
  tone: ActivityTone,
): ActivityRow {
  return { source: module, title, meta, occurredAt, tone };
}

function joinMeta(parts: (string | null)[]): string | null {
  const kept = parts.filter((p): p is string => Boolean(p));
  return kept.length === 0 ? null : kept.join(" · ");
}

/* --------------------------------- CAM ------------------------------------ */

function camMatchesClient(report: unknown, externalId: string): boolean {
  const client = pick(report, "client");
  const keys = [
    str(pick(client, "organization_id")),
    str(pick(client, "slug")),
    str(pick(client, "external_key")),
  ];
  return keys.some((k) => k !== null && k.toLowerCase() === externalId.toLowerCase());
}

function camActivity(report: unknown): ActivityRow[] {
  const clientName = str(pick(pick(report, "client"), "name"));
  const leads = list(pick(report, "recent_leads")).map((row) =>
    activityRow(
      "cam",
      str(pick(row, "name", "full_name", "summary", "email")) ?? "New lead captured",
      joinMeta([clientName, str(pick(row, "source", "campaign", "status"))]),
      isoDate(pick(row, "created_at", "captured_at", "at", "occurred_at")),
      "ok",
    ),
  );
  const failures = list(pick(report, "delivery_failures")).map((row) =>
    activityRow(
      "cam",
      str(pick(row, "summary", "message", "reason", "error", "type")) ?? "Lead routing failure",
      joinMeta([clientName, str(pick(row, "destination", "channel", "status"))]),
      isoDate(pick(row, "failed_at", "created_at", "at", "occurred_at")),
      "alert",
    ),
  );
  return [...leads, ...failures];
}

function camTrend(reports: unknown[]): TrendPoint[] {
  const byDate = new Map<string, number>();
  for (const report of reports) {
    for (const point of list(pick(report, "trend"))) {
      const label = str(pick(point, "date", "label"));
      const value = num(pick(point, "leads"));
      if (label === null || value === null) continue;
      byDate.set(label, (byDate.get(label) ?? 0) + value);
    }
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));
}

function camChannels(reports: unknown[]): ChannelRow[] {
  const bySource = new Map<string, number>();
  for (const report of reports) {
    for (const row of list(pick(report, "source_breakdown"))) {
      const channel = str(pick(row, "source"));
      const leads = num(pick(row, "leads"));
      if (channel === null || leads === null) continue;
      bySource.set(channel, (bySource.get(channel) ?? 0) + leads);
    }
  }
  return [...bySource.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([channel, leads]) => ({
      channel,
      leads,
      appointments: null,
      revenueCents: null,
      changePct: null,
    }));
}

/**
 * CAM contract: { status, source, contract_version, clients: [ { client, totals,
 * campaigns, trend, source_breakdown, recent_leads, delivery_failures } ] }.
 * Scoped reads select the matching client report; unscoped reads aggregate.
 * CAM `revenue` is major currency units. Spend, CPL and ROAS are not reported.
 */
export function normalizeCam(payload: unknown, ctx: NormalizeContext = {}): CamReport {
  const p = asRecord(payload) ?? {};
  const all = list(pick(p, "clients"));
  const externalId = ctx.externalId ?? null;

  let selected: unknown[] = all;
  if (externalId) {
    const matched = all.filter((r) => camMatchesClient(r, externalId));
    selected = matched.length > 0 ? matched : all.length === 1 ? all : [];
  }

  const totals = selected.map((r) => pick(r, "totals"));
  const revenueMajor = sumOrNull(totals.map((t) => num(pick(t, "revenue"))));

  return {
    leads: sumOrNull(totals.map((t) => num(pick(t, "leads")))),
    qualifiedLeads: sumOrNull(totals.map((t) => num(pick(t, "qualified_leads")))),
    appointments: sumOrNull(totals.map((t) => num(pick(t, "appointments")))),
    customers: sumOrNull(totals.map((t) => num(pick(t, "customers")))),
    revenueCents: revenueMajor === null ? null : Math.round(revenueMajor * 100),
    spendCents: null,
    cplCents: null,
    roas: null,
    trend: camTrend(selected),
    channels: camChannels(selected),
    activity: selected.flatMap((r) => camActivity(r)),
  };
}

/* --------------------------------- CCM ------------------------------------ */

/**
 * CCM contract: { version: 'ccm.hq-dashboard.v1', tenant, metrics: { interactions,
 * calls, sms, appointments, booking_outcomes, channel_trend, recent_activity,
 * operational_failures } }. CCM requires a tenant scope, so this normalizer only
 * ever runs on a client-scoped response.
 */
export function normalizeCcm(payload: unknown): CcmReport {
  const p = asRecord(payload) ?? {};
  const metrics = pick(p, "metrics");
  const sms = pick(metrics, "sms");
  const appointments = pick(metrics, "appointments");
  const failures = list(pick(metrics, "operational_failures"));

  const trend = list(pick(metrics, "channel_trend"))
    .map((point) => {
      const label = str(pick(point, "date"));
      const calls = num(pick(point, "calls"));
      const smsCount = num(pick(point, "sms"));
      if (label === null || (calls === null && smsCount === null)) return null;
      return { label, value: (calls ?? 0) + (smsCount ?? 0) };
    })
    .filter((p2): p2 is TrendPoint => p2 !== null);

  const activity = list(pick(metrics, "recent_activity")).map((row) =>
    activityRow(
      "ccm",
      str(pick(row, "summary", "type")) ?? "Communication event",
      joinMeta([str(pick(row, "type")), str(pick(row, "direction"))]),
      isoDate(pick(row, "at")),
      toneOf(pick(row, "status")),
    ),
  );

  const failureRows = failures.map((row) =>
    activityRow(
      "ccm",
      str(pick(row, "summary", "message", "reason", "type")) ?? "Communication failure",
      joinMeta([str(pick(row, "type")), str(pick(row, "direction"))]),
      isoDate(pick(row, "at", "occurred_at", "created_at")),
      "alert",
    ),
  );

  return {
    conversations: num(pick(pick(metrics, "interactions"), "total")),
    avgResponseSeconds: availableNumber(pick(sms, "average_response_seconds")),
    appointments: num(pick(appointments, "booked")),
    bookingFailures: failures.length === 0 ? null : failures.length,
    trend,
    activity: [...activity, ...failureRows],
  };
}

/* --------------------------------- CRM ------------------------------------ */

/**
 * NorthStar CRM contract: { contract_version: 'northstar.crm.hq-dashboard.v1',
 * scope, businesses, metrics, recent_activity, operational_failures }.
 * Monetary values are major currency units. Deal value is pipeline value, not
 * recognized revenue, so attributable revenue stays unavailable.
 */
export function normalizeCrm(payload: unknown): CrmReport {
  const p = asRecord(payload) ?? {};
  const metrics = pick(p, "metrics");

  const pipelineMajor = num(pick(metrics, "open_pipeline_value"));

  const stages = list(pick(metrics, "deals_by_stage"))
    .map((row) => {
      const label = str(pick(row, "stage_name"));
      const value = num(pick(row, "deal_count"));
      if (label === null || value === null) return null;
      return { label, value };
    })
    .filter((s): s is TrendPoint => s !== null);

  const activity = list(pick(p, "recent_activity")).map((row) =>
    activityRow(
      "crm",
      str(pick(row, "summary", "title", "type")) ?? "CRM activity",
      joinMeta([str(pick(row, "type")), str(pick(row, "business_name", "entity"))]),
      isoDate(pick(row, "at", "occurred_at", "created_at")),
      toneOf(pick(row, "status")),
    ),
  );

  const failureRows = list(pick(p, "operational_failures")).map((row) =>
    activityRow(
      "crm",
      str(pick(row, "summary", "message", "reason", "type")) ?? "CRM operational failure",
      str(pick(row, "type")),
      isoDate(pick(row, "at", "occurred_at", "created_at")),
      "alert",
    ),
  );

  return {
    customers: num(pick(metrics, "customers_total")),
    openDeals: num(pick(metrics, "open_deals")),
    pipelineValueCents: pipelineMajor === null ? null : Math.round(pipelineMajor * 100),
    wonInRange: num(pick(metrics, "won_deals_in_range")),
    // CRM exposes revenue_recognized as an explicit unavailable object.
    attributableRevenueCents: null,
    stages,
    activity: [...activity, ...failureRows],
  };
}

/* ------------------------------- SAM Core --------------------------------- */

/**
 * SAM Core contract: { contract_version: 'hq-dashboard.v1', runtime, organizations,
 * applications, totals, active_work, recent_failures, attention, recent_activity }.
 */
export function normalizeSam(payload: unknown): SamReport {
  const p = asRecord(payload) ?? {};
  const runtime = pick(p, "runtime");
  const totals = pick(p, "totals");
  const applications = list(pick(p, "applications"));

  const successRate = availableNumber(pick(totals, "success_rate"));
  const avgSeconds = availableNumber(pick(totals, "average_processing_seconds"));

  const rows = (value: unknown, tone: ActivityTone, fallback: string) =>
    list(value).map((row) =>
      activityRow(
        "sam",
        str(pick(row, "summary", "message", "title", "reason", "type")) ?? fallback,
        joinMeta([str(pick(row, "application_name", "application_slug")), str(pick(row, "type"))]),
        isoDate(pick(row, "at", "occurred_at", "created_at", "failed_at")),
        tone,
      ),
    );

  return {
    status: str(pick(runtime, "status")),
    consumers: applications.length === 0 ? null : applications.length,
    events: num(pick(totals, "events_in_range")) ?? num(pick(totals, "events_24h")),
    tasksProcessed: num(pick(totals, "processed_in_range")),
    successRatePct:
      successRate === null ? null : successRate <= 1 ? successRate * 100 : successRate,
    avgProcessingMs: avgSeconds === null ? null : Math.round(avgSeconds * 1000),
    failures: [
      ...rows(pick(p, "recent_failures"), "alert", "SAM Core failure"),
      ...rows(pick(p, "attention"), "warn", "Needs attention"),
      ...rows(pick(p, "recent_activity"), "muted", "SAM Core activity"),
    ],
  };
}

export const MODULE_NORMALIZERS = {
  cam: normalizeCam,
  ccm: normalizeCcm,
  crm: normalizeCrm,
  sam: normalizeSam,
} as const;


/* ------------------------------ aggregation ------------------------------- */

export interface JourneyStep {
  key: "acquisition" | "leads" | "conversations" | "appointments" | "sales" | "revenue";
  label: string;
  value: string | null;
  source: ModuleKey | "hq" | null;
  reason: string | null;
}

export function formatCents(cents: number | null): string | null {
  if (cents === null) return null;
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1000) return `$${Math.round(dollars).toLocaleString("en-US")}`;
  return `$${dollars.toFixed(2)}`;
}

export function formatCount(value: number | null): string | null {
  return value === null ? null : Math.round(value).toLocaleString("en-US");
}

/**
 * Builds the outcome chain from mapped module data plus the HQ-native revenue
 * figure. Any step without a live source keeps a null value and a reason.
 */
export function buildOutcomeJourney(
  dashboard: ModuleDashboard,
  hqRevenueCents: number | null,
): JourneyStep[] {
  const cam = dashboard.cam;
  const ccm = dashboard.ccm;
  const crm = dashboard.crm;
  const stepReason = <T>(src: ModuleSource<T>) =>
    src.status === "ok" ? "Not reported by source" : src.reason;

  return [
    {
      key: "acquisition",
      label: "Acquisition",
      value: cam.status === "ok" ? formatCents(cam.data?.spendCents ?? null) : null,
      source: cam.status === "ok" ? "cam" : null,
      reason: cam.status === "ok" && cam.data?.spendCents == null ? stepReason(cam) : cam.reason,
    },
    {
      key: "leads",
      label: "Leads",
      value: cam.status === "ok" ? formatCount(cam.data?.leads ?? null) : null,
      source: cam.status === "ok" ? "cam" : null,
      reason: cam.status === "ok" && cam.data?.leads == null ? stepReason(cam) : cam.reason,
    },
    {
      key: "conversations",
      label: "Conversations",
      value: ccm.status === "ok" ? formatCount(ccm.data?.conversations ?? null) : null,
      source: ccm.status === "ok" ? "ccm" : null,
      reason:
        ccm.status === "ok" && ccm.data?.conversations == null ? stepReason(ccm) : ccm.reason,
    },
    {
      key: "appointments",
      label: "Appointments",
      value: ccm.status === "ok" ? formatCount(ccm.data?.appointments ?? null) : null,
      source: ccm.status === "ok" ? "ccm" : null,
      reason:
        ccm.status === "ok" && ccm.data?.appointments == null ? stepReason(ccm) : ccm.reason,
    },
    {
      key: "sales",
      label: "Sales",
      value: crm.status === "ok" ? formatCount(crm.data?.wonInRange ?? null) : null,
      source: crm.status === "ok" ? "crm" : null,
      reason: crm.status === "ok" && crm.data?.wonInRange == null ? stepReason(crm) : crm.reason,
    },
    {
      key: "revenue",
      label: "Revenue (NorthStar)",
      value: formatCents(hqRevenueCents),
      source: hqRevenueCents === null ? null : "hq",
      reason: hqRevenueCents === null ? "No NorthStar invoice records for this range" : null,
    },
  ];
}

/** Merges recent activity across modules, newest first. Undated rows go last. */
export function mergeActivity(dashboard: ModuleDashboard, limit = 12): ActivityRow[] {
  const rows: ActivityRow[] = [
    ...(dashboard.cam.data?.activity ?? []),
    ...(dashboard.ccm.data?.activity ?? []),
    ...(dashboard.crm.data?.activity ?? []),
    ...(dashboard.sam.data?.failures ?? []),
  ];
  return rows
    .slice()
    .sort((a, b) => {
      if (!a.occurredAt && !b.occurredAt) return 0;
      if (!a.occurredAt) return 1;
      if (!b.occurredAt) return -1;
      return b.occurredAt.localeCompare(a.occurredAt);
    })
    .slice(0, limit);
}

/** Channel performance is CAM-owned; CCM appointment counts enrich it by name. */
export function mergeChannelPerformance(dashboard: ModuleDashboard): ChannelRow[] {
  const cam = dashboard.cam.data?.channels ?? [];
  const ccmTrendByLabel = new Map(
    (dashboard.ccm.data?.trend ?? []).map((p) => [p.label.toLowerCase(), p.value]),
  );
  return cam.map((row) => ({
    ...row,
    appointments: row.appointments ?? ccmTrendByLabel.get(row.channel.toLowerCase()) ?? null,
  }));
}

export function countLive(dashboard: ModuleDashboard): number {
  return MODULE_KEYS.filter((k) => dashboard[k].status === "ok").length;
}
