// Client-callable workflow server functions. All routed through
// requireSupabaseAuth. The client MUST NEVER send an authoritative
// organization_id — scope is resolved server-side. No UI exists yet in
// this milestone; these functions exist so later phases can integrate.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { SamError, toSamError } from "@/lib/errors";
import { WorkflowRunInput, WorkflowFeedbackType } from "./types";
import { listWorkflowDefinitions } from "./registry.server";

// ── runWorkflow ───────────────────────────────────────────────
export const runWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => WorkflowRunInput.parse(input))
  .handler(async ({ data, context }) => {
    const { runWorkflow: run } = await import("./runner.server");
    try {
      return await run(context.supabase, context.userId, data);
    } catch (err) {
      throw toSamError(err);
    }
  });

// ── getWorkflowRun ────────────────────────────────────────────
const GetInput = z.object({ runId: z.string().uuid() });
export const getWorkflowRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GetInput.parse(input))
  .handler(async ({ data, context }) => {
    const { loadRun, loadFindings, loadCitations } = await import("./persistence.server");
    const run = await loadRun(context.supabase, data.runId);
    const [findings, citations] = await Promise.all([
      loadFindings(context.supabase, data.runId),
      loadCitations(context.supabase, data.runId),
    ]);
    return { run, findings, citations };
  });

// ── listWorkflowRuns ──────────────────────────────────────────
const ListInput = z.object({
  workflowType: z
    .enum([
      "daily_briefing",
      "weekly_review",
      "decision_review",
      "commitment_review",
      "priority_planning",
      "risk_review",
      "goal_alignment",
      "venture_health",
      "organization_health",
    ])
    .optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
export const listWorkflowRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async ({ data, context }) => {
    // Resolve org from membership so the client cannot forge it.
    const { data: membership } = await context.supabase
      .from("organization_members")
      .select("organization_id, status")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1);
    const orgId = membership?.[0]?.organization_id;
    if (!orgId) throw new SamError("membership_unavailable");
    const { listRuns } = await import("./persistence.server");
    return listRuns(context.supabase, orgId, data);
  });

// ── archiveWorkflowRun ────────────────────────────────────────
export const archiveWorkflowRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GetInput.parse(input))
  .handler(async ({ data, context }) => {
    const { archiveRun } = await import("./persistence.server");
    await archiveRun(context.supabase, data.runId, context.userId);
    return { ok: true };
  });

// ── submitWorkflowFeedback ────────────────────────────────────
const FeedbackInput = z.object({
  runId: z.string().uuid(),
  feedback_type: WorkflowFeedbackType,
  feedback_text: z.string().max(2000).optional(),
});
export const submitWorkflowFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FeedbackInput.parse(input))
  .handler(async ({ data, context }) => {
    // Verify the run exists and is in-org; RLS also enforces this.
    const { data: run, error } = await context.supabase
      .from("sam_workflow_runs")
      .select("id, organization_id")
      .eq("id", data.runId)
      .maybeSingle();
    if (error) throw new SamError("workflow_persistence_failed", error.message);
    if (!run) throw new SamError("workflow_not_found");
    const { upsertFeedback } = await import("./persistence.server");
    await upsertFeedback(context.supabase, {
      orgId: run.organization_id,
      userId: context.userId,
      runId: data.runId,
      feedback_type: data.feedback_type,
      feedback_text: data.feedback_text ?? null,
    });
    // Also record a corresponding learning event.
    const eventType =
      data.feedback_type === "useful"
        ? "recommendation_accepted"
        : data.feedback_type === "not_useful"
          ? "recommendation_rejected"
          : data.feedback_type === "incorrect"
            ? "memory_corrected"
            : "recommendation_edited";
    await context.supabase.from("sam_learning_events").insert({
      organization_id: run.organization_id,
      user_id: context.userId,
      event_type: eventType,
      original_payload: { workflow_run_id: data.runId } as never,
      feedback_text: data.feedback_text ?? null,
    });
    return { ok: true };
  });

// ── listAvailableWorkflows ────────────────────────────────────
export const listAvailableWorkflows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return listWorkflowDefinitions().map((d) => ({
      key: d.key,
      displayName: d.displayName,
      description: d.description,
      version: d.version,
      registryVersion: d.registryVersion,
      active: d.active,
      ventureRequired: d.ventureRequired,
      supportedScopes: d.supportedScopes,
      supportsDateRange: d.supportsDateRange,
      minRole: d.minRole,
      // Deliberately expose that these are not yet implemented so callers
      // can't accidentally treat a scaffolded workflow as ready.
      implementationStatus:
        d.deterministicAnalyzer === "not_implemented" ? "not_implemented" : "ready",
    }));
  });