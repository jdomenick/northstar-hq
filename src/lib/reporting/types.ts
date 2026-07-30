// Browser-safe Executive Reporting V1 models.
// Pure shapes and formatters. No data access, no calculation of business
// outcomes: every number displayed comes from a real recorded source.

export const METRIC_UNITS = ["count", "currency", "percent", "minutes"] as const;
export type MetricUnit = (typeof METRIC_UNITS)[number];

export const METRIC_UNIT_LABEL: Record<MetricUnit, string> = {
  count: "Count",
  currency: "Currency (USD)",
  percent: "Percent",
  minutes: "Minutes",
};

/** Suggested keys only. Operators may record any metric that truly exists. */
export const SUGGESTED_METRICS: ReadonlyArray<{ key: string; label: string; unit: MetricUnit }> = [
  { key: "qualified_leads", label: "Qualified Leads", unit: "count" },
  { key: "appointments_booked", label: "Appointments Booked", unit: "count" },
  { key: "customers_closed", label: "Customers Closed", unit: "count" },
  { key: "revenue_generated", label: "Revenue Generated", unit: "currency" },
  { key: "conversion_rate", label: "Conversion Rate", unit: "percent" },
  { key: "cost_per_lead", label: "Cost Per Lead", unit: "currency" },
  { key: "cost_per_acquisition", label: "Cost Per Acquisition", unit: "currency" },
  { key: "average_response_time", label: "Average Response Time", unit: "minutes" },
  { key: "missed_calls_recovered", label: "Missed Calls Recovered", unit: "count" },
];

export interface OutcomeMetric {
  id: string;
  metric_key: string;
  label: string;
  value: number;
  unit: MetricUnit;
  period_start: string | null;
  period_end: string | null;
  source_label: string;
  client_visible: boolean;
  sort_order: number;
}

export interface ExecutiveReportVersion {
  id: string;
  version: number;
  summary: string;
  business_notes: string;
  highlights: string[];
  created_at: string;
  created_by_name: string | null;
}

export interface ReportEngagement {
  stage_label: string;
  status_label: string;
  progress_percent: number | null;
  progress_complete: number;
  progress_total: number;
  next_client_action: string | null;
  next_northstar_action: string | null;
}

export interface ReportDeliverable {
  id: string;
  title: string;
  version_label: string;
  status_label: string;
  shared_at: string | null;
  has_file: boolean;
}

export interface ReportActivityItem {
  id: string;
  title: string;
  occurred_at: string;
}

export interface ReportInvoice {
  id: string;
  label: string;
  status: string;
  amount_cents: number;
  amount_remaining_cents: number;
  currency: string;
  due_at: string | null;
  paid_at: string | null;
}

export interface ReportBilling {
  status_label: string;
  currency: string;
  invoices: ReportInvoice[];
  outstanding_cents: number;
  last_payment: { amount_cents: number; paid_at: string; label: string } | null;
  next_invoice: { label: string; due_at: string; amount_cents: number } | null;
}

export interface ClientExecutiveReportView {
  client_name: string;
  published: ExecutiveReportVersion | null;
  outcomes: OutcomeMetric[];
  engagement: ReportEngagement | null;
  activity: ReportActivityItem[];
  deliverables: ReportDeliverable[];
  billing: ReportBilling;
  /** False for a brand new client with nothing truthful to report yet. */
  has_content: boolean;
}

export interface OperatorExecutiveReportView {
  client_name: string;
  current: ExecutiveReportVersion | null;
  history: ExecutiveReportVersion[];
  outcomes: OutcomeMetric[];
}

/** Event types that are meaningful to a client in an executive report. */
export const REPORT_ACTIVITY_TYPES: readonly string[] = [
  "proposal_accepted",
  "payment_received",
  "implementation_ready",
  "service_activated",
  "delivery_visible",
  "delivery_stage_changed",
  "milestone_completed",
  "deliverable_shared",
  "deliverable_approved",
  "deliverable_revision_requested",
];

export function isReportActivity(eventType: string): boolean {
  return REPORT_ACTIVITY_TYPES.includes(eventType);
}

export function isMetricUnit(value: string): value is MetricUnit {
  return (METRIC_UNITS as readonly string[]).includes(value);
}

export function formatMetricValue(value: number, unit: MetricUnit): string {
  switch (unit) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: value % 1 === 0 ? 0 : 2,
      }).format(value);
    case "percent":
      return `${Number(value.toFixed(1))}%`;
    case "minutes": {
      if (value < 60) return `${Number(value.toFixed(1))} min`;
      const hours = Math.floor(value / 60);
      const mins = Math.round(value % 60);
      return mins === 0 ? `${hours} hr` : `${hours} hr ${mins} min`;
    }
    default:
      return new Intl.NumberFormat("en-US").format(value);
  }
}

export function formatMetricPeriod(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (v: string) =>
    new Date(`${v}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  if (start && end) return `${fmt(start)} to ${fmt(end)}`;
  return fmt((start ?? end) as string);
}

export const REPORT_COPY = {
  noReport: "Your Executive Report will become available as implementation progresses.",
  noMetrics: "Not enough data is available yet.",
  noSummary: "Your NorthStar Labs team has not published an Executive Summary yet.",
} as const;