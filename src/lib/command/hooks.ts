// Command Center data layer.
//
// Command is the primary internal operating view. It reads ONLY sources that
// already exist in this project through the browser Supabase client (RLS
// enforced). Any source that errors, or that has no connected system of
// record, is reported as an explicit unavailable state. Nothing here
// fabricates metrics.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SourceStatus = "ok" | "unavailable" | "not_connected";

export interface Source<T> {
  status: SourceStatus;
  /** Present only when status is "ok". */
  data: T | null;
  /** Truthful reason shown in the UI when data cannot be displayed. */
  reason: string | null;
}

function ok<T>(data: T): Source<T> {
  return { status: "ok", data, reason: null };
}

function unavailable<T>(reason: string): Source<T> {
  return { status: "unavailable", data: null, reason };
}

export function notConnected<T>(reason: string): Source<T> {
  return { status: "not_connected", data: null, reason };
}

async function read<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<Source<T>> {
  try {
    return ok(await fn());
  } catch (err) {
    return unavailable<T>(
      err instanceof Error ? `${label}: ${err.message}` : `${label}: read failed`,
    );
  }
}

type ClientRow = Pick<
  Database["public"]["Tables"]["revenue_clients"]["Row"],
  "id" | "name" | "status" | "mrr_cents" | "started_at" | "activation_project_id"
>;

type LeadRow = Pick<
  Database["public"]["Tables"]["nsl_assessment_requests"]["Row"],
  "id" | "full_name" | "company" | "status" | "created_at" | "revenue_client_id"
>;

type InvoiceRow = Pick<
  Database["public"]["Tables"]["billing_invoices"]["Row"],
  "id" | "client_id" | "status" | "amount_cents" | "amount_paid_cents" | "currency" | "due_at" | "paid_at"
>;

type JobRow = Pick<
  Database["public"]["Tables"]["automation_jobs"]["Row"],
  "id" | "status" | "job_type" | "error_code" | "created_at"
>;

type MissionRow = Pick<
  Database["public"]["Tables"]["sam_missions"]["Row"],
  "id" | "title" | "status" | "priority" | "updated_at"
>;

type ConnectionRow = Pick<
  Database["public"]["Tables"]["integration_connections"]["Row"],
  "id" | "display_name" | "provider" | "status" | "last_error_code" | "last_error_at" | "last_successful_sync_at"
>;

type TaskRow = Pick<
  Database["public"]["Tables"]["operator_tasks"]["Row"],
  "id" | "title" | "kind" | "status" | "priority" | "due_at" | "requires_approval" | "approved_at"
>;

type MilestoneRow = Pick<
  Database["public"]["Tables"]["client_delivery_milestones"]["Row"],
  "id" | "client_id" | "title" | "status" | "target_date" | "requires_client_action"
>;

type PipelineRow = Pick<
  Database["public"]["Tables"]["revenue_pipeline"]["Row"],
  "id" | "client_id" | "name" | "stage" | "value_cents" | "expected_close" | "next_action" | "source"
>;

type EventRow = Pick<
  Database["public"]["Tables"]["client_workspace_events"]["Row"],
  "id" | "client_id" | "title" | "event_type" | "occurred_at"
>;

export interface CommandOverview {
  clients: Source<ClientRow[]>;
  leads: Source<LeadRow[]>;
  invoices: Source<InvoiceRow[]>;
  jobs24h: Source<JobRow[]>;
  missions: Source<MissionRow[]>;
  connections: Source<ConnectionRow[]>;
  approvals: Source<TaskRow[]>;
  milestones: Source<MilestoneRow[]>;
  pipeline: Source<PipelineRow[]>;
  events: Source<EventRow[]>;
  /** No calls/messaging system of record is wired into this project yet. */
  conversations: Source<never>;
  /** No scheduling system of record is wired into this project yet. */
  appointments: Source<never>;
}

/**
 * Standalone NorthStar products that are not wired into this project's data
 * layer. They are declared here as adapter boundaries so Command can report a
 * truthful Not Connected state instead of guessing.
 */
export const MODULE_ADAPTERS: { name: string; reason: string }[] = [
  {
    name: "CAM",
    reason:
      "CAM runs as a standalone product. No acquisition data source is connected to Command yet.",
  },
  {
    name: "CCM",
    reason:
      "CCM runs as a standalone product. No calls or messaging data source is connected to Command yet.",
  },
  {
    name: "CRM",
    reason:
      "Standalone CRM is not connected. Pipeline shown in Command comes from NorthStar revenue records only.",
  },
];

const NO_COMMS =
  "No calls or messaging system is connected to Command. Connect a communications source to report here.";
const NO_SCHEDULING =
  "No scheduling system is connected to Command. Connect a calendar or booking source to report here.";


export function useCommandOverview(orgId: string | null) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["command.overview", orgId],
    queryFn: async (): Promise<CommandOverview> => {
      const org = orgId as string;
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [
        clients,
        leads,
        invoices,
        jobs24h,
        missions,
        connections,
        approvals,
        milestones,
        pipeline,
        events,
      ] = await Promise.all([

        read("Clients", async () => {
          // Archived records (E2E and phase-validation runs) stay in the
          // database for audit but never enter the operating roster.
          const { data, error } = await supabase
            .from("revenue_clients")
            .select("id,name,status,mrr_cents,started_at,activation_project_id")
            .eq("organization_id", org)
            .is("archived_at", null)
            .order("created_at", { ascending: false });
          if (error) throw error;
          return (data ?? []) as ClientRow[];
        }),
        read("Leads", async () => {
          const { data, error } = await supabase
            .from("nsl_assessment_requests")
            .select("id,full_name,company,status,created_at,revenue_client_id")
            .eq("organization_id", org)
            .is("archived_at", null)
            .order("created_at", { ascending: false })
            .limit(50);
          if (error) throw error;
          return (data ?? []) as LeadRow[];
        }),
        read("Revenue", async () => {
          const { data, error } = await supabase
            .from("billing_invoices")
            .select(
              "id,client_id,status,amount_cents,amount_paid_cents,currency,due_at,paid_at",
            )
            .eq("organization_id", org)
            .order("created_at", { ascending: false })
            .limit(200);
          if (error) throw error;
          return (data ?? []) as InvoiceRow[];
        }),
        read("Automation", async () => {
          const { data, error } = await supabase
            .from("automation_jobs")
            .select("id,status,job_type,error_code,created_at")
            .eq("organization_id", org)
            .gte("created_at", since24h)
            .order("created_at", { ascending: false })
            .limit(300);
          if (error) throw error;
          return (data ?? []) as JobRow[];
        }),
        read("SAM missions", async () => {
          const { data, error } = await supabase
            .from("sam_missions")
            .select("id,title,status,priority,updated_at")
            .eq("organization_id", org)
            .order("updated_at", { ascending: false })
            .limit(25);
          if (error) throw error;
          return (data ?? []) as MissionRow[];
        }),
        read("Integrations", async () => {
          const { data, error } = await supabase
            .from("integration_connections")
            .select(
              "id,display_name,provider,status,last_error_code,last_error_at,last_successful_sync_at",
            )
            .eq("organization_id", org)
            .is("deleted_at", null);
          if (error) throw error;
          return (data ?? []) as ConnectionRow[];
        }),
        read("Approvals", async () => {
          const { data, error } = await supabase
            .from("operator_tasks")
            .select(
              "id,title,kind,status,priority,due_at,requires_approval,approved_at",
            )
            .eq("organization_id", org)
            .neq("status", "done")
            .order("due_at", { ascending: true, nullsFirst: false })
            .limit(50);
          if (error) throw error;
          return (data ?? []) as TaskRow[];
        }),
        read("Delivery", async () => {
          const { data, error } = await supabase
            .from("client_delivery_milestones")
            .select("id,client_id,title,status,target_date,requires_client_action")
            .eq("organization_id", org)
            .limit(200);
          if (error) throw error;
          return (data ?? []) as MilestoneRow[];
        }),
        read("Pipeline", async () => {
          const { data, error } = await supabase
            .from("revenue_pipeline")
            .select(
              "id,client_id,name,stage,value_cents,expected_close,next_action,source",
            )
            .eq("organization_id", org)
            .limit(200);
          if (error) throw error;
          return (data ?? []) as PipelineRow[];
        }),
        read("Client activity", async () => {
          const { data, error } = await supabase
            .from("client_workspace_events")
            .select("id,client_id,title,event_type,occurred_at")
            .eq("organization_id", org)
            .order("occurred_at", { ascending: false })
            .limit(200);
          if (error) throw error;
          return (data ?? []) as EventRow[];
        }),
      ]);

      return {
        clients,
        leads,
        invoices,
        jobs24h,
        missions,
        connections,
        approvals,
        milestones,
        pipeline,
        events,
        conversations: notConnected<never>(NO_COMMS),
        appointments: notConnected<never>(NO_SCHEDULING),
      };

    },
  });
}

// ───── Per-client outcome chain

export interface ClientOutcomeChain {
  client: ClientRow | null;
  acquisition: Source<LeadRow[]>;
  leads: Source<PipelineRow[]>;
  conversations: Source<never>;
  appointments: Source<never>;
  sales: Source<
    Pick<
      Database["public"]["Tables"]["nsl_proposals"]["Row"],
      "id" | "title" | "status" | "total_value_cents" | "sent_at" | "accepted_at"
    >[]
  >;
  revenue: Source<InvoiceRow[]>;
  delivery: Source<MilestoneRow[]>;
  automation: Source<JobRow[]>;
  events: Source<
    Pick<
      Database["public"]["Tables"]["client_workspace_events"]["Row"],
      "id" | "title" | "event_type" | "occurred_at" | "is_notice"
    >[]
  >;
  accounts: Source<
    Pick<
      Database["public"]["Tables"]["client_accounts"]["Row"],
      "id" | "email" | "role" | "status" | "last_login_at"
    >[]
  >;
}

export function useClientOutcomeChain(orgId: string | null, clientId: string) {
  return useQuery({
    enabled: !!orgId && !!clientId,
    queryKey: ["command.client", orgId, clientId],
    queryFn: async (): Promise<ClientOutcomeChain> => {
      const org = orgId as string;

      const clientRes = await supabase
        .from("revenue_clients")
        .select("id,name,status,mrr_cents,started_at,activation_project_id")
        .eq("organization_id", org)
        .eq("id", clientId)
        .maybeSingle();
      if (clientRes.error) throw clientRes.error;

      const [acquisition, leads, sales, revenue, delivery, automation, events, accounts] =
        await Promise.all([
          read("Acquisition", async () => {
            const { data, error } = await supabase
              .from("nsl_assessment_requests")
              .select("id,full_name,company,status,created_at,revenue_client_id")
              .eq("organization_id", org)
              .eq("revenue_client_id", clientId)
              .order("created_at", { ascending: false });
            if (error) throw error;
            return (data ?? []) as LeadRow[];
          }),
          read("Pipeline", async () => {
            const { data, error } = await supabase
              .from("revenue_pipeline")
              .select(
                "id,client_id,name,stage,value_cents,expected_close,next_action,source",
              )
              .eq("organization_id", org)
              .eq("client_id", clientId)
              .order("stage_entered_at", { ascending: false });
            if (error) throw error;
            return (data ?? []) as PipelineRow[];
          }),
          read("Proposals", async () => {
            const { data, error } = await supabase
              .from("nsl_proposals")
              .select("id,title,status,total_value_cents,sent_at,accepted_at")
              .eq("organization_id", org)
              .eq("client_id", clientId)
              .order("created_at", { ascending: false });
            if (error) throw error;
            return data ?? [];
          }),
          read("Revenue", async () => {
            const { data, error } = await supabase
              .from("billing_invoices")
              .select(
                "id,client_id,status,amount_cents,amount_paid_cents,currency,due_at,paid_at",
              )
              .eq("organization_id", org)
              .eq("client_id", clientId)
              .order("created_at", { ascending: false });
            if (error) throw error;
            return (data ?? []) as InvoiceRow[];
          }),
          read("Delivery", async () => {
            const { data, error } = await supabase
              .from("client_delivery_milestones")
              .select("id,client_id,title,status,target_date,requires_client_action")
              .eq("organization_id", org)
              .eq("client_id", clientId)
              .order("sort_order", { ascending: true });
            if (error) throw error;
            return (data ?? []) as MilestoneRow[];
          }),
          read("Automation", async () => {
            const { data, error } = await supabase
              .from("automation_jobs")
              .select("id,status,job_type,error_code,created_at")
              .eq("organization_id", org)
              .order("created_at", { ascending: false })
              .limit(10);
            if (error) throw error;
            return (data ?? []) as JobRow[];
          }),
          read("Activity", async () => {
            const { data, error } = await supabase
              .from("client_workspace_events")
              .select("id,title,event_type,occurred_at,is_notice")
              .eq("organization_id", org)
              .eq("client_id", clientId)
              .order("occurred_at", { ascending: false })
              .limit(20);
            if (error) throw error;
            return data ?? [];
          }),
          read("Client access", async () => {
            const { data, error } = await supabase
              .from("client_accounts")
              .select("id,email,role,status,last_login_at")
              .eq("organization_id", org)
              .eq("client_id", clientId);
            if (error) throw error;
            return data ?? [];
          }),
        ]);

      return {
        client: (clientRes.data as ClientRow | null) ?? null,
        acquisition,
        leads,
        conversations: notConnected<never>(NO_COMMS),
        appointments: notConnected<never>(NO_SCHEDULING),
        sales,
        revenue,
        delivery,
        automation,
        events,
        accounts,
      };
    },
  });
}

// ───── Cross-client health, derived only from records already read above.

export interface ClientHealth {
  id: string;
  name: string;
  status: string;
  mrrCents: number;
  /** Modules that actually hold records for this client. */
  modules: string[];
  /** Highest-priority real issue, or null when nothing is outstanding. */
  issue: string | null;
  outstandingCents: number;
  lastActivityAt: string | null;
  lastActivityLabel: string | null;
}

export function deriveClientHealth(d: CommandOverview): ClientHealth[] {
  const clients = d.clients.data ?? [];
  const invoices = d.invoices.data ?? [];
  const milestones = d.milestones.data ?? [];
  const pipeline = d.pipeline.data ?? [];
  const leads = d.leads.data ?? [];
  const events = d.events.data ?? [];
  const now = Date.now();

  return clients.map((c) => {
    const cInvoices = invoices.filter((i) => i.client_id === c.id);
    const cMilestones = milestones.filter((m) => m.client_id === c.id);
    const cPipeline = pipeline.filter((p) => p.client_id === c.id);
    const cLeads = leads.filter((l) => l.revenue_client_id === c.id);
    const cEvent = events.find((e) => e.client_id === c.id) ?? null;

    const open = cInvoices.filter((i) => i.status === "open");
    const outstandingCents = open.reduce(
      (n, i) => n + (i.amount_cents - i.amount_paid_cents),
      0,
    );
    const pastDue = open.filter((i) => i.due_at && new Date(i.due_at).getTime() < now);
    const clientAction = cMilestones.filter(
      (m) => m.requires_client_action && m.status !== "complete",
    );
    const overdueMilestones = cMilestones.filter(
      (m) =>
        m.status !== "complete" &&
        m.target_date &&
        new Date(m.target_date).getTime() < now,
    );

    let issue: string | null = null;
    if (pastDue.length) issue = `${pastDue.length} invoice past due`;
    else if (overdueMilestones.length) issue = `${overdueMilestones.length} milestone overdue`;
    else if (clientAction.length) issue = `${clientAction.length} item waiting on client`;
    else if (outstandingCents > 0) issue = `${money(outstandingCents)} outstanding`;

    const modules: string[] = [];
    if (cLeads.length) modules.push("Assessments");
    if (cPipeline.length) modules.push("Pipeline");
    if (cInvoices.length) modules.push("Billing");
    if (cMilestones.length) modules.push("Delivery");

    return {
      id: c.id,
      name: c.name,
      status: c.status,
      mrrCents: c.mrr_cents ?? 0,
      modules,
      issue,
      outstandingCents,
      lastActivityAt: cEvent?.occurred_at ?? null,
      lastActivityLabel: cEvent?.title ?? null,
    };
  });
}


export function money(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
