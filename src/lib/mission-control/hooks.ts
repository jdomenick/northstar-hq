import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RevenueClient = Database["public"]["Tables"]["revenue_clients"]["Row"];
export type PipelineDeal = Database["public"]["Tables"]["revenue_pipeline"]["Row"];
export type Proposal = Database["public"]["Tables"]["revenue_proposals"]["Row"];
export type CashflowEntry = Database["public"]["Tables"]["revenue_cashflow_entries"]["Row"];
export type MrrSnapshot = Database["public"]["Tables"]["revenue_mrr_snapshots"]["Row"];
export type Referral = Database["public"]["Tables"]["revenue_referrals"]["Row"];
export type OperatorState = Database["public"]["Tables"]["operator_state"]["Row"];
export type OperatorTask = Database["public"]["Tables"]["operator_tasks"]["Row"];
export type OperatorAudit = Database["public"]["Tables"]["operator_audit"]["Row"];
export type OperatorKind = Database["public"]["Enums"]["operator_kind"];

// ───── Revenue reads
export function useRevenueClients(orgId: string | null) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["revenue.clients", orgId],
    queryFn: async (): Promise<RevenueClient[]> => {
      const { data, error } = await supabase
        .from("revenue_clients").select("*")
        .eq("organization_id", orgId!)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePipeline(orgId: string | null) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["revenue.pipeline", orgId],
    queryFn: async (): Promise<PipelineDeal[]> => {
      const { data, error } = await supabase
        .from("revenue_pipeline").select("*")
        .eq("organization_id", orgId!)
        .order("expected_close", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProposals(orgId: string | null) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["revenue.proposals", orgId],
    queryFn: async (): Promise<Proposal[]> => {
      const { data, error } = await supabase
        .from("revenue_proposals").select("*")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCashflow(orgId: string | null, days = 90) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["revenue.cashflow", orgId, days],
    queryFn: async (): Promise<CashflowEntry[]> => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("revenue_cashflow_entries").select("*")
        .eq("organization_id", orgId!)
        .gte("occurred_on", since)
        .order("occurred_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useReferrals(orgId: string | null) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["revenue.referrals", orgId],
    queryFn: async (): Promise<Referral[]> => {
      const { data, error } = await supabase
        .from("revenue_referrals").select("*")
        .eq("organization_id", orgId!)
        .order("occurred_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ───── Operators
export function useOperatorStates(orgId: string | null) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["operator.state", orgId],
    queryFn: async (): Promise<OperatorState[]> => {
      const { data, error } = await supabase
        .from("operator_state").select("*")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOperatorTasks(orgId: string | null, kind: OperatorKind | null) {
  return useQuery({
    enabled: !!orgId && !!kind,
    queryKey: ["operator.tasks", orgId, kind],
    queryFn: async (): Promise<OperatorTask[]> => {
      const { data, error } = await supabase
        .from("operator_tasks").select("*")
        .eq("organization_id", orgId!)
        .eq("kind", kind!)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOperatorAudit(orgId: string | null, kind: OperatorKind | null, limit = 25) {
  return useQuery({
    enabled: !!orgId && !!kind,
    queryKey: ["operator.audit", orgId, kind, limit],
    queryFn: async (): Promise<OperatorAudit[]> => {
      const { data, error } = await supabase
        .from("operator_audit").select("*")
        .eq("organization_id", orgId!)
        .eq("kind", kind!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ───── Mutations
async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function writeAudit(
  orgId: string,
  kind: OperatorKind,
  event: string,
  payload: Record<string, unknown> = {},
  taskId?: string | null,
) {
  const actor = await currentUserId();
  await supabase.from("operator_audit").insert({
    organization_id: orgId,
    kind,
    event,
    payload: payload as never,
    task_id: taskId ?? null,
    actor_user_id: actor,
  });
}

export function useCreateOperatorTask(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      kind: OperatorKind;
      title: string;
      description?: string;
      priority?: Database["public"]["Enums"]["operator_task_priority"];
      requires_approval?: boolean;
      due_at?: string | null;
    }) => {
      if (!orgId) throw new Error("No active organization");
      const uid = await currentUserId();
      const { data, error } = await supabase.from("operator_tasks").insert({
        organization_id: orgId,
        kind: input.kind,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? "normal",
        requires_approval: !!input.requires_approval,
        due_at: input.due_at ?? null,
        source: "manual",
        created_by: uid,
      }).select().single();
      if (error) throw error;
      await writeAudit(orgId, input.kind, "task.created", { title: input.title }, data.id);
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["operator.tasks", orgId, v.kind] });
      qc.invalidateQueries({ queryKey: ["operator.audit", orgId, v.kind] });
    },
  });
}

export function useUpdateOperatorTaskStatus(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; kind: OperatorKind; status: Database["public"]["Enums"]["operator_task_status"] }) => {
      if (!orgId) throw new Error("No active organization");
      const patch: Database["public"]["Tables"]["operator_tasks"]["Update"] = { status: input.status };
      if (input.status === "done") patch.completed_at = new Date().toISOString();
      const { error } = await supabase.from("operator_tasks").update(patch).eq("id", input.id);
      if (error) throw error;
      await writeAudit(orgId, input.kind, "task.status_changed", { status: input.status }, input.id);
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["operator.tasks", orgId, v.kind] });
      qc.invalidateQueries({ queryKey: ["operator.audit", orgId, v.kind] });
    },
  });
}

export function useApproveOperatorTask(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; kind: OperatorKind }) => {
      if (!orgId) throw new Error("No active organization");
      const uid = await currentUserId();
      const { error } = await supabase.from("operator_tasks").update({
        approved_by: uid,
        approved_at: new Date().toISOString(),
        status: "in_progress",
      }).eq("id", input.id);
      if (error) throw error;
      await writeAudit(orgId, input.kind, "task.approved", {}, input.id);
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["operator.tasks", orgId, v.kind] });
      qc.invalidateQueries({ queryKey: ["operator.audit", orgId, v.kind] });
    },
  });
}

export function useSetOperatorPaused(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { kind: OperatorKind; paused: boolean; reason?: string }) => {
      if (!orgId) throw new Error("No active organization");
      const uid = await currentUserId();
      const now = new Date().toISOString();
      const row = {
        organization_id: orgId,
        kind: input.kind,
        paused: input.paused,
        auto_enabled: false,
        paused_reason: input.paused ? (input.reason ?? null) : null,
        paused_by: input.paused ? uid : null,
        paused_at: input.paused ? now : null,
        resumed_at: input.paused ? null : now,
      };
      const { error } = await supabase
        .from("operator_state")
        .upsert(row, { onConflict: "organization_id,kind" });
      if (error) throw error;
      await writeAudit(orgId, input.kind, input.paused ? "operator.paused" : "operator.resumed", {
        reason: input.reason ?? null,
      });
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["operator.state", orgId] });
      qc.invalidateQueries({ queryKey: ["operator.audit", orgId, v.kind] });
    },
  });
}

// ───── Revenue mutations (thin)
export function useCreatePipelineDeal(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PipelineDeal> & { name: string }) => {
      if (!orgId) throw new Error("No active organization");
      const uid = await currentUserId();
      const { error } = await supabase.from("revenue_pipeline").insert({
        organization_id: orgId,
        created_by: uid,
        ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["revenue.pipeline", orgId] }),
  });
}

export function useCreateClient(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RevenueClient> & { name: string }) => {
      if (!orgId) throw new Error("No active organization");
      const uid = await currentUserId();
      const { data, error } = await supabase
        .from("revenue_clients")
        .insert({
          organization_id: orgId,
          created_by: uid,
          ...input,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["revenue.clients", orgId] }),
  });
}

export function useCreateCashflowEntry(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CashflowEntry> & { occurred_on: string; direction: Database["public"]["Enums"]["cashflow_direction"]; category: string; amount_cents: number }) => {
      if (!orgId) throw new Error("No active organization");
      const uid = await currentUserId();
      const { error } = await supabase.from("revenue_cashflow_entries").insert({
        organization_id: orgId,
        created_by: uid,
        ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["revenue.cashflow", orgId] }),
  });
}

export function useCreateProposal(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Proposal> & { client_name: string; amount_cents: number }) => {
      if (!orgId) throw new Error("No active organization");
      const uid = await currentUserId();
      const { error } = await supabase.from("revenue_proposals").insert({
        organization_id: orgId,
        created_by: uid,
        ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["revenue.proposals", orgId] }),
  });
}

export function useCreateReferral(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Referral> & { referrer_name: string; referred_name: string }) => {
      if (!orgId) throw new Error("No active organization");
      const uid = await currentUserId();
      const { error } = await supabase.from("revenue_referrals").insert({
        organization_id: orgId,
        created_by: uid,
        ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["revenue.referrals", orgId] }),
  });
}

// ───── Aggregations
export function summarizeRevenue(
  clients: RevenueClient[],
  pipeline: PipelineDeal[],
  cash: CashflowEntry[],
  proposals: Proposal[],
) {
  const active = clients.filter((c) => c.status === "active");
  const mrrCents = active.reduce((s, c) => s + (c.mrr_cents ?? 0), 0);
  const churnedThisQuarter = clients.filter((c) => {
    if (c.status !== "churned" || !c.churned_at) return false;
    return Date.now() - new Date(c.churned_at).getTime() < 92 * 86_400_000;
  }).length;
  const openDeals = pipeline.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const pipelineValue = openDeals.reduce((s, d) => s + (d.value_cents ?? 0), 0);
  const weightedForecast = openDeals.reduce(
    (s, d) => s + Math.round(((d.value_cents ?? 0) * (d.probability ?? 0)) / 100),
    0,
  );
  const wonThisMonth = pipeline.filter((d) => {
    if (d.stage !== "won" || !d.closed_at) return false;
    return new Date(d.closed_at).getMonth() === new Date().getMonth()
      && new Date(d.closed_at).getFullYear() === new Date().getFullYear();
  }).reduce((s, d) => s + (d.value_cents ?? 0), 0);
  const inflow30 = cash.filter((e) => e.direction === "inflow"
    && Date.now() - new Date(e.occurred_on).getTime() < 30 * 86_400_000)
    .reduce((s, e) => s + (e.amount_cents ?? 0), 0);
  const outflow30 = cash.filter((e) => e.direction === "outflow"
    && Date.now() - new Date(e.occurred_on).getTime() < 30 * 86_400_000)
    .reduce((s, e) => s + (e.amount_cents ?? 0), 0);
  const openProposals = proposals.filter((p) => p.status === "sent" || p.status === "draft");
  const proposalValue = openProposals.reduce((s, p) => s + (p.amount_cents ?? 0), 0);
  return {
    mrrCents,
    activeClients: active.length,
    churnedThisQuarter,
    pipelineValueCents: pipelineValue,
    weightedForecastCents: weightedForecast,
    wonThisMonthCents: wonThisMonth,
    inflow30Cents: inflow30,
    outflow30Cents: outflow30,
    netCash30Cents: inflow30 - outflow30,
    openProposals: openProposals.length,
    proposalValueCents: proposalValue,
  };
}

export function formatMoney(cents: number, opts: { compact?: boolean } = {}) {
  const dollars = Math.round(cents) / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: opts.compact ? 1 : 0,
  }).format(dollars);
}