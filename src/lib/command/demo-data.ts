/**
 * DEMO DATA - NOT PRODUCTION TRUTH.
 *
 * Every value exported from this module is illustrative sample data used to
 * render the Command Center layout while the underlying sources (CAM, CCM,
 * NorthStar CRM, Operations Center, SAM Core telemetry) are not yet wired into
 * this project.
 *
 * Rules for replacing this file:
 *  - Every export is shaped exactly like the props the presentation components
 *    consume, so a real query can be swapped in per-export without touching UI.
 *  - Anything rendered from here MUST pass through `DEMO` marking in the UI
 *    (see `DemoBadge` in src/components/command/dash-ui.tsx) so an operator is
 *    never shown sample numbers as if they were live.
 *  - Real sources that already exist in this project (clients, invoices, jobs,
 *    approvals, missions) are read through src/lib/command/hooks.ts instead and
 *    must never be replaced by anything in this file.
 */

export const DEMO_NOTICE =
  "Sample data. This panel is not wired to a live source yet.";

export type Series = number[];

export type DemoKpi = {
  key: string;
  label: string;
  value: string;
  delta: number;
  series: Series;
  tone?: "default" | "alert";
};

export const DEMO_COMMAND_KPIS: DemoKpi[] = [
  { key: "revenue", label: "Total Revenue (MTD)", value: "$248,420", delta: 12.4, series: [32, 38, 35, 44, 48, 52, 61, 58, 66, 72, 78, 84] },
  { key: "leads", label: "New Leads (MTD)", value: "1,284", delta: 8.1, series: [18, 22, 21, 27, 25, 31, 34, 33, 38, 41, 44, 47] },
  { key: "appointments", label: "Appointments (MTD)", value: "412", delta: 5.6, series: [12, 14, 13, 16, 18, 17, 21, 22, 24, 23, 27, 29] },
  { key: "customers", label: "Customers (MTD)", value: "168", delta: 3.2, series: [8, 9, 11, 10, 13, 14, 13, 16, 17, 18, 20, 21] },
];

export const DEMO_REVENUE_TREND: { label: string; value: number }[] = [
  { label: "Jan", value: 118000 },
  { label: "Feb", value: 132000 },
  { label: "Mar", value: 127000 },
  { label: "Apr", value: 154000 },
  { label: "May", value: 171000 },
  { label: "Jun", value: 166000 },
  { label: "Jul", value: 189000 },
  { label: "Aug", value: 204000 },
  { label: "Sep", value: 213000 },
  { label: "Oct", value: 228000 },
  { label: "Nov", value: 241000 },
  { label: "Dec", value: 248420 },
];

export const DEMO_REVENUE_BY_SOURCE: { name: string; value: number }[] = [
  { name: "Paid Search", value: 92000 },
  { name: "Organic", value: 61000 },
  { name: "Referral", value: 48000 },
  { name: "Outbound", value: 30000 },
  { name: "Other", value: 17420 },
];

export const DEMO_OPERATIONAL_CARDS: {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: "ok" | "warn" | "alert";
}[] = [
  { key: "health", label: "System Health", value: "Nominal", detail: "All probes responding", tone: "ok" },
  { key: "automations", label: "Automations", value: "38", detail: "Active definitions", tone: "ok" },
  { key: "approvals", label: "Approvals", value: "6", detail: "Awaiting operator", tone: "warn" },
  { key: "failed", label: "Failed Workflows", value: "2", detail: "Last 24 hours", tone: "alert" },
  { key: "unassigned", label: "Unassigned Leads", value: "11", detail: "No owner set", tone: "warn" },
];

/* ---------------------------- Client Workspace ---------------------------- */

export const DEMO_JOURNEY: { key: string; label: string; value: string }[] = [
  { key: "acquisition", label: "Acquisition", value: "$18.4k spend" },
  { key: "leads", label: "Leads", value: "318" },
  { key: "conversations", label: "Conversations", value: "241" },
  { key: "appointments", label: "Appointments", value: "96" },
  { key: "sales", label: "Sales", value: "44" },
  { key: "revenue", label: "Revenue", value: "$62.4k" },
];

export const DEMO_WORKSPACE_KPIS: DemoKpi[] = [
  { key: "leads", label: "Leads (MTD)", value: "318", delta: 14.2, series: [9, 12, 11, 15, 14, 18, 21, 20, 24, 26, 29, 31] },
  { key: "conversations", label: "Conversations (MTD)", value: "241", delta: 11.5, series: [7, 9, 10, 12, 11, 15, 16, 18, 19, 21, 23, 25] },
  { key: "appointments", label: "Appointments (MTD)", value: "96", delta: 6.8, series: [3, 4, 5, 5, 6, 7, 7, 8, 9, 9, 10, 11] },
  { key: "customers", label: "Customers (MTD)", value: "44", delta: 4.1, series: [2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7] },
  { key: "revenue", label: "Revenue (MTD)", value: "$62.4k", delta: 14.9, series: [11, 14, 13, 18, 20, 23, 26, 29, 33, 38, 44, 51] },
];

export const DEMO_CHANNEL_PERFORMANCE: {
  channel: string;
  leads: number;
  appts: number;
  revenue: string;
  delta: number;
}[] = [
  { channel: "Google Ads", leads: 128, appts: 41, revenue: "$26,800", delta: 12.1 },
  { channel: "Local Service Ads", leads: 74, appts: 26, revenue: "$15,400", delta: 8.4 },
  { channel: "Organic Search", leads: 52, appts: 14, revenue: "$9,900", delta: 3.7 },
  { channel: "Referral", leads: 38, appts: 10, revenue: "$6,600", delta: -1.9 },
  { channel: "Direct", leads: 26, appts: 5, revenue: "$3,700", delta: 2.2 },
];

export const DEMO_RECENT_ACTIVITY: {
  title: string;
  meta: string;
  tone: "ok" | "warn" | "alert" | "muted";
}[] = [
  { title: "New lead captured", meta: "Google Ads · 4 min ago", tone: "ok" },
  { title: "Appointment booked", meta: "CCM assistant · 22 min ago", tone: "ok" },
  { title: "Invoice paid", meta: "$4,200 · 1 hr ago", tone: "ok" },
  { title: "Workflow retry", meta: "Lead sync · 2 hrs ago", tone: "warn" },
  { title: "Call missed", meta: "Inbound · 3 hrs ago", tone: "alert" },
  { title: "Report delivered", meta: "Monthly summary · yesterday", tone: "muted" },
];

/* --------------------------- Module previews ------------------------------ */

export const DEMO_CAM = {
  stats: [
    { label: "Leads", value: "1,284" },
    { label: "CPL", value: "$41.20" },
    { label: "ROAS", value: "4.6x" },
  ],
  series: [42, 51, 47, 58, 63, 61, 72, 78, 74, 86, 91, 98],
};

export const DEMO_CCM = {
  stats: [
    { label: "Conversations", value: "3,412" },
    { label: "Avg. Response", value: "38s" },
    { label: "Appointments", value: "412" },
  ],
  series: [120, 138, 131, 152, 149, 168, 181, 176, 194, 208, 221, 236],
};

export const DEMO_CRM = {
  stats: [
    { label: "Open Deals", value: "86" },
    { label: "Pipeline Value", value: "$1.42M" },
    { label: "Won (MTD)", value: "24" },
  ],
  stages: [
    { label: "New", value: 34 },
    { label: "Qualified", value: 26 },
    { label: "Proposal", value: 15 },
    { label: "Negotiation", value: 8 },
    { label: "Won", value: 24 },
  ],
};

export const DEMO_OPERATIONS = {
  stats: [
    { label: "Automations", value: "38" },
    { label: "Workflows", value: "212" },
    { label: "API Calls (24h)", value: "48.2k" },
    { label: "Failed Workflows", value: "2" },
  ],
  series: [31, 36, 34, 41, 46, 43, 52, 49, 57, 61, 58, 64],
};

export const DEMO_SAM_CORE = {
  stats: [
    { label: "SAM Core Status", value: "Online" },
    { label: "Registered Consumers", value: "7" },
    { label: "Events (24h)", value: "12,480" },
    { label: "Tasks Processed (24h)", value: "3,164" },
    { label: "Success Rate (24h)", value: "99.2%" },
    { label: "Avg. Processing Time", value: "412ms" },
  ],
};
