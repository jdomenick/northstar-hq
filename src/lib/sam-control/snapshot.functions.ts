// Read-only aggregation server function that powers the SAM Mega Control
// Panel. All reads run through the caller's Supabase client so RLS applies;
// this file adds NO runtime logic - only visualization data.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({ organizationId: z.string().uuid() });

type SB = { from: (t: string) => any };

async function safeList<T = any>(sb: SB, table: string, build: (q: any) => any): Promise<T[]> {
  try {
    const { data } = await build(sb.from(table));
    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

export const getSamControlSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as SB;
    const orgId = data.organizationId;

    const [
      jobs,
      operatorTasks,
      approvals,
      integrations,
      ventures,
      pipeline,
      insights,
      health,
      activity,
      killSwitches,
      autonomy,
      workflowRuns,
      invocations,
    ] = await Promise.all([
      safeList(sb, "automation_jobs", (q) =>
        q
          .select(
            "id, job_type, status, priority, attempt_number, max_attempts, scheduled_for, started_at, completed_at, error_code, trigger_type, created_at",
          )
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(60),
      ),
      safeList(sb, "operator_tasks", (q) =>
        q
          .select("id, kind, title, status, priority, created_at, updated_at, venture_id")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(50),
      ),
      safeList(sb, "content_ops_approvals", (q) =>
        q
          .select("id, content_item_id, status, requested_at, decided_at, notes")
          .eq("organization_id", orgId)
          .order("requested_at", { ascending: false })
          .limit(40),
      ),
      safeList(sb, "integration_connections", (q) =>
        q
          .select("id, provider, status, display_name, last_sync_at, last_error, created_at")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(40),
      ),
      safeList(sb, "ventures", (q) =>
        q
          .select("id, name, status, stage, created_at")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: true }),
      ),
      safeList(sb, "revenue_pipeline", (q) =>
        q
          .select("id, title, stage, value_amount, owner_operator, updated_at")
          .eq("organization_id", orgId)
          .order("updated_at", { ascending: false })
          .limit(40),
      ),
      safeList(sb, "executive_insights", (q) =>
        q
          .select("id, kind, title, severity, status, created_at")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(30),
      ),
      safeList(sb, "sam_health_snapshots", (q) =>
        q
          .select("id, score, breakdown, computed_at")
          .eq("organization_id", orgId)
          .order("computed_at", { ascending: false })
          .limit(1),
      ),
      safeList(sb, "activity_events", (q) =>
        q
          .select("id, action, entity_type, actor_user_id, metadata, created_at")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(40),
      ),
      safeList(sb, "content_ops_kill_switches", (q) =>
        q
          .select("id, scope, target, engaged, reason, engaged_at")
          .eq("organization_id", orgId)
          .order("engaged_at", { ascending: false }),
      ),
      safeList(sb, "content_ops_autonomy", (q) =>
        q
          .select("id, scope, mode, updated_at")
          .eq("organization_id", orgId)
          .order("updated_at", { ascending: false }),
      ),
      safeList(sb, "sam_workflow_runs", (q) =>
        q
          .select("id, workflow, status, started_at, completed_at, error_code")
          .eq("organization_id", orgId)
          .order("started_at", { ascending: false })
          .limit(20),
      ),
      safeList(sb, "sam_invocations", (q) =>
        q
          .select("id, status, model, latency_ms, tokens_input, tokens_output, created_at")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(20),
      ),
    ]);

    const jobCounts = jobs.reduce<Record<string, number>>((acc, j: any) => {
      acc[j.status] = (acc[j.status] ?? 0) + 1;
      return acc;
    }, {});
    const operatorCounts = operatorTasks.reduce<Record<string, number>>((acc, t: any) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      generatedAt: new Date().toISOString(),
      counts: {
        jobs: jobCounts,
        operatorTasks: operatorCounts,
        pendingApprovals: approvals.filter((a: any) => a.status === "pending").length,
        blockedConnections: integrations.filter((c: any) => c.status === "error" || c.status === "blocked").length,
        activeKillSwitches: killSwitches.filter((k: any) => k.engaged).length,
        openInsights: insights.filter((i: any) => i.status !== "resolved").length,
        ventures: ventures.length,
      },
      jobs,
      operatorTasks,
      approvals,
      integrations,
      ventures,
      pipeline,
      insights,
      health: health[0] ?? null,
      activity,
      killSwitches,
      autonomy,
      workflowRuns,
      invocations,
    };
  });

export type SamControlSnapshot = Awaited<ReturnType<typeof getSamControlSnapshot>>;