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
  return str(pick(payload, "version", "schema_version", "api_version"));
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

export function normalizeCam(payload: unknown): CamReport {
  const p = unwrapPayload(payload);
  return {
    leads: num(pick(p, "leads", "total_leads", "lead_count")),
    qualifiedLeads: num(pick(p, "qualified_leads", "qualified")),
    spendCents: centsOf(p, "spend", "ad_spend"),
    cplCents: centsOf(p, "cpl", "cost_per_lead"),
    roas: num(pick(p, "roas", "return_on_ad_spend")),
    trend: normalizeTrend(pick(p, "trend", "leads_trend", "acquisition_trend", "series")),
    channels: normalizeChannels(pick(p, "channels", "sources", "channel_performance")),
    activity: normalizeActivity("cam", pick(p, "activity", "recent_activity", "events")),
  };
}

export function normalizeCcm(payload: unknown): CcmReport {
  const p = unwrapPayload(payload);
  const responseMinutes = num(pick(p, "avg_response_minutes", "response_minutes"));
  return {
    conversations: num(pick(p, "conversations", "conversation_count", "total_conversations")),
    avgResponseSeconds:
      num(pick(p, "avg_response_seconds", "response_seconds", "avg_response_time_seconds")) ??
      (responseMinutes === null ? null : Math.round(responseMinutes * 60)),
    appointments: num(pick(p, "appointments", "booked_appointments", "bookings")),
    bookingFailures: num(pick(p, "booking_failures", "failed_bookings", "errors")),
    trend: normalizeTrend(pick(p, "trend", "conversations_trend", "channel_trend", "series")),
    activity: normalizeActivity(
      "ccm",
      pick(p, "activity", "recent_activity", "communications", "recent_communications"),
    ),
  };
}

export function normalizeCrm(payload: unknown): CrmReport {
  const p = unwrapPayload(payload);
  return {
    customers: num(pick(p, "customers", "customer_count", "active_customers")),
    openDeals: num(pick(p, "open_deals", "deals_open", "open_opportunities")),
    pipelineValueCents: centsOf(p, "pipeline_value", "pipeline"),
    wonInRange: num(pick(p, "won", "won_mtd", "won_in_range", "closed_won")),
    attributableRevenueCents: centsOf(p, "attributable_revenue", "closed_won_value"),
    stages: normalizeTrend(pick(p, "stages", "deals_by_stage", "pipeline_stages")),
    activity: normalizeActivity("crm", pick(p, "activity", "recent_activity", "events")),
  };
}

export function normalizeSam(payload: unknown): SamReport {
  const p = unwrapPayload(payload);
  const successRate = num(pick(p, "success_rate_pct", "success_rate", "successRate"));
  return {
    status: str(pick(p, "status", "health", "system_status")),
    consumers: num(pick(p, "consumers", "registered_consumers")),
    events: num(pick(p, "events", "events_24h", "event_count")),
    tasksProcessed: num(pick(p, "tasks_processed", "tasks_processed_24h", "work_items")),
    successRatePct:
      successRate === null ? null : successRate <= 1 ? successRate * 100 : successRate,
    avgProcessingMs:
      num(pick(p, "avg_processing_ms", "processing_ms", "avg_latency_ms")) ??
      (() => {
        const seconds = num(pick(p, "avg_processing_seconds"));
        return seconds === null ? null : Math.round(seconds * 1000);
      })(),
    failures: normalizeActivity("sam", pick(p, "failures", "attention", "incidents")),
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
