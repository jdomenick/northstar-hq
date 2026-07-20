import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
    return (rows ?? []) as unknown as Array<Record<string, unknown>>;
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
    let jobs: Array<Record<string, unknown>> = [];
    if (jobIds.length) {
      const { data: jobRows } = await context.supabase
        .from("automation_jobs")
        .select("id, job_type, status, error_code, started_at, completed_at, output_summary, attempt_number")
        .in("id", jobIds);
      jobs = (jobRows ?? []) as Array<Record<string, unknown>>;
    }
    const { data: activity } = await context.supabase
      .from("activity_events")
      .select("id, action, summary, metadata, created_at")
      .eq("organization_id", data.organizationId)
      .eq("entity_type", "sam_mission")
      .eq("entity_id", data.missionId)
      .order("created_at", { ascending: false })
      .limit(20);
    return { mission, workItems, jobs, activity: activity ?? [] };
  });