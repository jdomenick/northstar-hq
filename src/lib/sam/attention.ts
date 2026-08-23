import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SamAttention {
  /** True only when a real, countable attention condition exists. */
  hasAttention: boolean;
  failedJobs24h: number;
  pendingApprovals: number;
  reasons: string[];
}

const EMPTY: SamAttention = {
  hasAttention: false,
  failedJobs24h: 0,
  pendingApprovals: 0,
  reasons: [],
};

/**
 * Real attention signals only. Any query failure resolves to "no attention"
 * rather than inventing a warning state.
 */
export function useSamAttention(orgId: string | null) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["sam.attention", orgId],
    refetchInterval: 120_000,
    queryFn: async (): Promise<SamAttention> => {
      const org = orgId as string;
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [jobs, approvals] = await Promise.all([
        supabase
          .from("automation_jobs")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org)
          .eq("status", "failed")
          .gte("created_at", since24h),
        supabase
          .from("operator_tasks")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org)
          .eq("status", "needs_approval"),

      ]);

      if (jobs.error && approvals.error) return EMPTY;

      const failedJobs24h = jobs.error ? 0 : (jobs.count ?? 0);
      const pendingApprovals = approvals.error ? 0 : (approvals.count ?? 0);
      const reasons: string[] = [];
      if (failedJobs24h > 0) {
        reasons.push(
          `${failedJobs24h} automation ${failedJobs24h === 1 ? "job" : "jobs"} failed in the last 24 hours`,
        );
      }
      if (pendingApprovals > 0) {
        reasons.push(
          `${pendingApprovals} ${pendingApprovals === 1 ? "item" : "items"} waiting on your approval`,
        );
      }

      return {
        hasAttention: reasons.length > 0,
        failedJobs24h,
        pendingApprovals,
        reasons,
      };
    },
  });
}
