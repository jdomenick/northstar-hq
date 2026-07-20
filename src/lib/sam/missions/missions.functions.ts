import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type MissionRow = {
  id: string; title: string;
  status: "draft" | "active" | "blocked" | "completed" | "cancelled";
  priority: number;
  source: "chat" | "directive" | "manual" | "proof";
  venture_id: string | null;
  created_by: string | null;
  created_at: string; updated_at: string;
  completed_at: string | null;
};
export type WorkItemRow = {
  id: string; mission_id: string;
  title: string; description: string | null;
  status: "pending" | "queued" | "running" | "blocked" | "completed" | "failed" | "cancelled";
  automation_job_id: string | null;
  artifact: Record<string, unknown>;
  error_code: string | null; error_message: string | null;
  started_at: string | null; completed_at: string | null;
  created_at: string; updated_at: string;
};
export type JobRow = {
  id: string; job_type: string; status: string;
  error_code: string | null;
  started_at: string | null; completed_at: string | null;
  output_summary: Record<string, unknown>;
  attempt_number: number;
};
export type ActivityRow = {
  id: string; action: string; summary: string | null;
  metadata: Record<string, unknown> | null; created_at: string;
};
export type MissionDetail = {
  mission: MissionRow | null;
  workItems: WorkItemRow[];
  jobs: JobRow[];
  activity: ActivityRow[];
};

const OrgOnly = z.object({ organizationId: z.string().uuid() });

export const listMissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => OrgOnly.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("sam_missions" as never)
      .select("id, title, status, priority, source, venture_id, created_by, created_at, updated_at, completed_at" as never)
      .eq("organization_id", data.organizationId)
      .order("updated_at", { ascending: false })
      .limit(50);
    return (rows ?? []) as unknown as MissionRow[];
  });

const GetInput = z.object({ organizationId: z.string().uuid(), missionId: z.string().uuid() });
export const getMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => GetInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: mission } = await context.supabase
      .from("sam_missions" as never)
      .select("*" as never)
      .eq("id", data.missionId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (!mission) throw new Error("Mission not found");
    const { data: items } = await context.supabase
      .from("sam_mission_work_items" as never)
      .select("*" as never)
      .eq("mission_id", data.missionId)
      .order("created_at", { ascending: true });
    const workItems = (items ?? []) as unknown as Array<{ automation_job_id: string | null }>;
    const jobIds = workItems.map((w) => w.automation_job_id).filter((x): x is string => !!x);
    let jobs: JobRow[] = [];
    if (jobIds.length) {
      const { data: jobRows } = await context.supabase
        .from("automation_jobs")
        .select("id, job_type, status, error_code, started_at, completed_at, output_summary, attempt_number")
        .in("id", jobIds);
      jobs = (jobRows ?? []) as unknown as JobRow[];
    }
    const { data: activity } = await context.supabase
      .from("activity_events")
      .select("id, action, summary, metadata, created_at")
      .eq("organization_id", data.organizationId)
      .eq("entity_type", "sam_mission")
      .eq("entity_id", data.missionId)
      .order("created_at", { ascending: false })
      .limit(20);
    const detail: MissionDetail = {
      mission: (mission ?? null) as unknown as MissionRow | null,
      workItems: workItems as unknown as WorkItemRow[],
      jobs,
      activity: (activity ?? []) as unknown as ActivityRow[],
    };
    return detail;
  });