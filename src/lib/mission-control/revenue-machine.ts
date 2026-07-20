import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { allowedNextStages, stageOwner, type PipelineStage } from "./labels";

export type StageEvent = Database["public"]["Tables"]["revenue_stage_events"]["Row"];
export type PlaybookStep = Database["public"]["Tables"]["revenue_playbook_steps"]["Row"];
export type DiscoveryBrief = Database["public"]["Tables"]["revenue_discovery_briefs"]["Row"];
export type LaunchDoc = Database["public"]["Tables"]["revenue_launch_docs"]["Row"];
export type CaseStudy = Database["public"]["Tables"]["revenue_case_studies"]["Row"];

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export function usePlaybookSteps(orgId: string | null) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["revenue.playbook", orgId],
    queryFn: async (): Promise<PlaybookStep[]> => {
      // Defaults live at organization_id IS NULL. Org-specific overrides may be added later.
      const { data, error } = await supabase
        .from("revenue_playbook_steps")
        .select("*")
        .or(`organization_id.is.null,organization_id.eq.${orgId!}`)
        .eq("active", true)
        .order("stage")
        .order("order_index");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDealTimeline(dealId: string | null) {
  return useQuery({
    enabled: !!dealId,
    queryKey: ["revenue.timeline", dealId],
    queryFn: async (): Promise<StageEvent[]> => {
      const { data, error } = await supabase
        .from("revenue_stage_events")
        .select("*")
        .eq("deal_id", dealId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDealTasks(dealId: string | null) {
  return useQuery({
    enabled: !!dealId,
    queryKey: ["revenue.dealTasks", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operator_tasks")
        .select("*")
        .eq("deal_id", dealId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDiscoveryBrief(dealId: string | null) {
  return useQuery({
    enabled: !!dealId,
    queryKey: ["revenue.brief", dealId],
    queryFn: async (): Promise<DiscoveryBrief | null> => {
      const { data, error } = await supabase
        .from("revenue_discovery_briefs")
        .select("*")
        .eq("deal_id", dealId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useLaunchDoc(dealId: string | null) {
  return useQuery({
    enabled: !!dealId,
    queryKey: ["revenue.launch", dealId],
    queryFn: async (): Promise<LaunchDoc | null> => {
      const { data, error } = await supabase
        .from("revenue_launch_docs")
        .select("*")
        .eq("deal_id", dealId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useCaseStudy(dealId: string | null) {
  return useQuery({
    enabled: !!dealId,
    queryKey: ["revenue.caseStudy", dealId],
    queryFn: async (): Promise<CaseStudy | null> => {
      const { data, error } = await supabase
        .from("revenue_case_studies")
        .select("*")
        .eq("deal_id", dealId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

/** Spawn playbook tasks for the given stage into the operator queue. */
async function spawnStagePlaybook(params: {
  orgId: string;
  dealId: string;
  stage: PipelineStage;
  steps: PlaybookStep[];
  userId: string | null;
}) {
  const stageSteps = params.steps
    .filter((s) => s.stage === params.stage && s.active)
    .sort((a, b) => a.order_index - b.order_index);
  if (stageSteps.length === 0) return { spawned: 0 };
  const rows = stageSteps.map((s) => ({
    organization_id: params.orgId,
    kind: s.operator_kind,
    title: s.title,
    description: s.description,
    priority: "normal" as const,
    status: (s.requires_approval ? "needs_approval" : "queued") as
      Database["public"]["Enums"]["operator_task_status"],
    requires_approval: s.requires_approval,
    approval_state: s.requires_approval ? "pending" : "not_required",
    blocks_stage_advance: s.blocks_stage_advance,
    deal_id: params.dealId,
    deal_stage: params.stage,
    playbook_step_id: s.id,
    due_at: new Date(Date.now() + s.default_due_offset_hours * 3600_000).toISOString(),
    source: "playbook",
    created_by: params.userId,
  }));
  const { error } = await supabase.from("operator_tasks").insert(rows);
  if (error) throw error;
  return { spawned: rows.length };
}

export function useAdvanceStage(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { dealId: string; toStage: PipelineStage; reason?: string; force?: boolean }) => {
      if (!orgId) throw new Error("No active organization");
      const uid = await currentUserId();

      // Load current deal
      const { data: deal, error: dealErr } = await supabase
        .from("revenue_pipeline")
        .select("id, stage, organization_id")
        .eq("id", input.dealId)
        .single();
      if (dealErr || !deal) throw dealErr ?? new Error("Deal not found");
      const from = deal.stage as PipelineStage;
      if (from === input.toStage) throw new Error("Deal is already in that stage");

      const allowed = allowedNextStages(from);
      if (!allowed.includes(input.toStage) && !input.force) {
        throw new Error(`Cannot advance from ${from} to ${input.toStage}. Allowed: ${allowed.join(", ") || "none"}`);
      }

      // Guard: any blocking task from the current stage must be done or cancelled
      const { data: blockers } = await supabase
        .from("operator_tasks")
        .select("id, title, status, blocks_stage_advance, deal_stage")
        .eq("deal_id", input.dealId)
        .eq("blocks_stage_advance", true)
        .not("status", "in", "(done,cancelled)");
      if (!input.force && blockers && blockers.length > 0) {
        throw new Error(
          `Blocked by ${blockers.length} required task${blockers.length === 1 ? "" : "s"}: ${blockers.map((b) => b.title).join(", ")}`,
        );
      }

      // Transition guards for terminal-ish stages
      if (input.toStage === "won" && !input.force) {
        const { data: brief } = await supabase
          .from("revenue_discovery_briefs").select("id").eq("deal_id", input.dealId).maybeSingle();
        if (!brief) throw new Error("Won requires a discovery brief. Save a brief before closing the deal.");
      }
      if (input.toStage === "launched" && !input.force) {
        const { data: doc } = await supabase
          .from("revenue_launch_docs").select("id").eq("deal_id", input.dealId).maybeSingle();
        if (!doc) throw new Error("Launched requires a launch doc. Publish the handover first.");
      }

      // Load playbook (once)
      const { data: playbookRows, error: pbErr } = await supabase
        .from("revenue_playbook_steps")
        .select("*")
        .or(`organization_id.is.null,organization_id.eq.${orgId}`)
        .eq("active", true);
      if (pbErr) throw pbErr;

      // Update deal
      const patch: Database["public"]["Tables"]["revenue_pipeline"]["Update"] = {
        stage: input.toStage,
        owner_operator: stageOwner(input.toStage),
        stage_entered_at: new Date().toISOString(),
      };
      if (input.toStage === "won") patch.closed_at = new Date().toISOString();
      if (input.toStage === "lost") {
        patch.closed_at = new Date().toISOString();
        patch.lost_reason = input.reason ?? null;
      }
      const { error: updErr } = await supabase.from("revenue_pipeline").update(patch).eq("id", input.dealId);
      if (updErr) throw updErr;

      // Append stage event
      const { error: evtErr } = await supabase.from("revenue_stage_events").insert({
        organization_id: orgId,
        deal_id: input.dealId,
        from_stage: from,
        to_stage: input.toStage,
        operator_kind: stageOwner(input.toStage),
        actor_user_id: uid,
        reason: input.reason ?? null,
        payload: { forced: !!input.force },
      });
      if (evtErr) throw evtErr;

      // Spawn playbook tasks for the new stage
      await spawnStagePlaybook({
        orgId,
        dealId: input.dealId,
        stage: input.toStage,
        steps: playbookRows ?? [],
        userId: uid,
      });

      // SAM learning event on terminal outcomes
      if (input.toStage === "won" || input.toStage === "launched" || input.toStage === "lost") {
        await supabase.from("sam_learning_events").insert({
          organization_id: orgId,
          event_type: input.toStage === "lost" ? "outcome_failed" : "outcome_completed",
          revised_payload: {
            source: "revenue_machine",
            deal_id: input.dealId,
            stage: input.toStage,
            reason: input.reason ?? null,
          } as never,
        });
      }

      return { from, to: input.toStage };
    },
    onSuccess: (_res, v) => {
      qc.invalidateQueries({ queryKey: ["revenue.pipeline", orgId] });
      qc.invalidateQueries({ queryKey: ["revenue.timeline", v.dealId] });
      qc.invalidateQueries({ queryKey: ["revenue.dealTasks", v.dealId] });
      qc.invalidateQueries({ queryKey: ["operator.tasks", orgId, "hunter"] });
      qc.invalidateQueries({ queryKey: ["operator.tasks", orgId, "builder"] });
      qc.invalidateQueries({ queryKey: ["operator.audit", orgId, "hunter"] });
      qc.invalidateQueries({ queryKey: ["operator.audit", orgId, "builder"] });
    },
  });
}

export function useSaveDiscoveryBrief(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      dealId: string;
      research_summary?: string;
      budget_range?: string;
      pain_points?: string[];
      goals?: string[];
      questions?: string[];
      status?: string;
    }) => {
      if (!orgId) throw new Error("No active organization");
      const uid = await currentUserId();
      const row = {
        organization_id: orgId,
        deal_id: input.dealId,
        research_summary: input.research_summary ?? null,
        budget_range: input.budget_range ?? null,
        pain_points: (input.pain_points ?? []) as never,
        goals: (input.goals ?? []) as never,
        questions: (input.questions ?? []) as never,
        prepared_by: uid,
        status: input.status ?? "ready",
      };
      const { error } = await supabase
        .from("revenue_discovery_briefs")
        .upsert(row, { onConflict: "deal_id" });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["revenue.brief", v.dealId] }),
  });
}

export function useSaveLaunchDoc(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { dealId: string; summary?: string; handover_url?: string; deliverables?: string[]; status?: string }) => {
      if (!orgId) throw new Error("No active organization");
      const row = {
        organization_id: orgId,
        deal_id: input.dealId,
        summary: input.summary ?? null,
        handover_url: input.handover_url ?? null,
        deliverables: (input.deliverables ?? []) as never,
        status: input.status ?? "ready",
      };
      const { error } = await supabase
        .from("revenue_launch_docs")
        .upsert(row, { onConflict: "deal_id" });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["revenue.launch", v.dealId] }),
  });
}

export function useSaveCaseStudy(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { dealId: string; headline?: string; quote?: string; metrics?: Record<string, unknown>; published_url?: string; status?: string }) => {
      if (!orgId) throw new Error("No active organization");
      const row = {
        organization_id: orgId,
        deal_id: input.dealId,
        headline: input.headline ?? null,
        quote: input.quote ?? null,
        metrics: (input.metrics ?? {}) as never,
        published_url: input.published_url ?? null,
        status: input.status ?? "collected",
      };
      const { error } = await supabase
        .from("revenue_case_studies")
        .upsert(row, { onConflict: "deal_id" });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["revenue.caseStudy", v.dealId] }),
  });
}