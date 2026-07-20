import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMission } from "@/lib/sam/missions/missions.functions";
import { useOrg } from "@/lib/org-context";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sam/missions/$id")({
  head: () => ({ meta: [{ title: "Mission - SAM - NorthStar Labs" }] }),
  component: MissionPage,
});

function statusTone(s: string) {
  if (s === "completed" || s === "succeeded") return "text-[oklch(0.78_0.14_155)] bg-[oklch(0.72_0.14_155)]/15";
  if (s === "running") return "text-primary bg-primary/15";
  if (s === "failed" || s === "blocked" || s === "cancelled") return "text-[oklch(0.78_0.18_27)] bg-[oklch(0.5_0.18_27)]/15";
  return "text-[oklch(0.82_0.14_85)] bg-[oklch(0.78_0.14_85)]/15";
}

function MissionPage() {
  const { id } = Route.useParams();
  const { activeOrgId } = useOrg();
  const fn = useServerFn(getMission);
  const q = useQuery({
    enabled: !!activeOrgId,
    queryKey: ["sam.mission", id, activeOrgId],
    queryFn: () => fn({ data: { organizationId: activeOrgId!, missionId: id } }),
    refetchInterval: 5000,
  });
  const mission = q.data?.mission;
  return (
    <>
      <PageHeader eyebrow="SAM mission" title={mission?.title ?? "Mission"}
        description={mission ? `Status: ${mission.status} - Priority ${mission.priority} - Source ${mission.source}` : "Loading mission..."}
        actions={<Link to="/sam/control" className="rounded-md border border-border px-3 py-1.5 text-[12px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground">Control</Link>}
      />
      <div className="mx-auto max-w-4xl px-4 md:px-8 py-6 space-y-6">
        {q.isLoading && <div className="text-sm text-muted-foreground">Loading...</div>}
        {q.error && <div className="text-sm text-[oklch(0.78_0.18_27)]">{(q.error as Error).message}</div>}
        {q.data && (
          <>
            <section className="rounded-md border border-border bg-card p-4">
              <h2 className="font-display text-[16px] mb-3">Work items</h2>
              <ul className="space-y-2">
                {q.data.workItems.map((w) => (
                  <li key={w.id} className="rounded-md border border-border/50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13px] text-foreground">{w.title}</div>
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          {w.automation_job_id ? `Job ${w.automation_job_id.slice(0, 8)}` : "no job"}
                          {w.started_at ? ` - started ${new Date(w.started_at).toLocaleString()}` : ""}
                          {w.completed_at ? ` - completed ${new Date(w.completed_at).toLocaleString()}` : ""}
                        </div>
                      </div>
                      <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10.5px] uppercase tracking-[0.14em]", statusTone(w.status))}>{w.status}</span>
                    </div>
                    {w.artifact && Object.keys(w.artifact as object).length > 0 && (
                      <pre className="mt-3 max-h-96 overflow-auto rounded bg-muted/40 p-3 text-[11px] leading-relaxed text-foreground/85">
{JSON.stringify(w.artifact, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
                {q.data.workItems.length === 0 && <li className="text-sm italic text-muted-foreground">No work items yet.</li>}
              </ul>
            </section>
            <section className="rounded-md border border-border bg-card p-4">
              <h2 className="font-display text-[16px] mb-3">Automation jobs</h2>
              <ul className="space-y-1.5">
                {q.data.jobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between text-[12.5px]">
                    <span className="font-mono text-muted-foreground">{j.job_type} - attempt {j.attempt_number}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[10.5px] uppercase tracking-[0.14em]", statusTone(j.status))}>{j.status}</span>
                  </li>
                ))}
                {q.data.jobs.length === 0 && <li className="text-sm italic text-muted-foreground">No jobs enqueued.</li>}
              </ul>
            </section>
            <section className="rounded-md border border-border bg-card p-4">
              <h2 className="font-display text-[16px] mb-3">Audit trail</h2>
              <ul className="space-y-1.5">
                {q.data.activity.map((a) => (
                  <li key={a.id} className="text-[12px]">
                    <span className="text-foreground">{a.action.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground"> - {new Date(a.created_at).toLocaleString()}</span>
                    {a.summary && <div className="text-muted-foreground">{a.summary}</div>}
                  </li>
                ))}
                {q.data.activity.length === 0 && <li className="text-sm italic text-muted-foreground">No activity yet.</li>}
              </ul>
            </section>
          </>
        )}
      </div>
    </>
  );
}