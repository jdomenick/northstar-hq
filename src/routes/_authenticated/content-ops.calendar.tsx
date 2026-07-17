import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/page-header";
import { EditorialSkeleton, ErrorLine, StatusLine } from "@/components/editorial";
import { CalendarView } from "@/components/content-ops/calendar-view";
import { useOrg } from "@/lib/org-context";
import { useVentures } from "@/lib/data-hooks";
import {
  listScheduledContent,
  cancelPublication,
  emergencyPauseVenture,
  resumePublishing,
  manualRetryPublication,
} from "@/lib/content-ops/scheduling.functions";

export const Route = createFileRoute("/_authenticated/content-ops/calendar")({
  component: CalendarPage,
  head: () => ({
    meta: [
      { title: "Editorial calendar - Northstar" },
      { name: "description", content: "Editorial calendar and scheduler for Content Operations." },
    ],
  }),
});

function CalendarPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { activeOrgId } = useOrg();
  const venturesQ = useVentures(activeOrgId);
  const ventureId = venturesQ.data?.[0]?.id ?? null;
  const [window] = useState(() => {
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - 7);
    const to = new Date();
    to.setUTCDate(to.getUTCDate() + 60);
    return { fromUtc: from.toISOString(), toUtc: to.toISOString() };
  });

  const listFn = useServerFn(listScheduledContent);
  const cancelFn = useServerFn(cancelPublication);
  const pauseFn = useServerFn(emergencyPauseVenture);
  const resumeFn = useServerFn(resumePublishing);

  const q = useQuery({
    queryKey: ["content-ops", "calendar", activeOrgId, ventureId, window],
    enabled: Boolean(activeOrgId && ventureId),
    queryFn: () =>
      listFn({
        data: {
          organizationId: activeOrgId!,
          ventureId: ventureId!,
          fromUtc: window.fromUtc,
          toUtc: window.toUtc,
        },
      }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["content-ops", "calendar"] });

  return (
    <>
      <PageHeader
        eyebrow="Content Operations"
        title="Editorial Calendar"
        description="Every scheduled or published item across ventures. Executed server-side."
        actions={
          q.data && (
            <div className="flex items-center gap-2">
              {q.data.emergencyPause ? (
                <button
                  className="rule-ink px-3 py-1 text-xs uppercase tracking-wider hover:bg-ink/5"
                  onClick={async () => {
                    if (!activeOrgId || !ventureId) return;
                    try {
                      await resumeFn({ data: { organizationId: activeOrgId, ventureId } });
                      toast.success("Publishing resumed");
                      invalidate();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "resume failed");
                    }
                  }}
                >
                  Resume publishing
                </button>
              ) : (
                <button
                  className="rule-ink px-3 py-1 text-xs uppercase tracking-wider text-[oklch(0.5_0.18_27)] hover:bg-[oklch(0.95_0.05_27)]"
                  onClick={async () => {
                    if (!activeOrgId || !ventureId) return;
                    const reason = prompt("Emergency pause reason (required):");
                    if (!reason || reason.length < 3) return;
                    try {
                      const r = await pauseFn({
                        data: { organizationId: activeOrgId, ventureId, reason },
                      });
                      toast.success(`Paused. Blocked ${r.blockedJobs} queued job(s).`);
                      invalidate();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "pause failed");
                    }
                  }}
                >
                  Emergency pause
                </button>
              )}
            </div>
          )
        }
      />
      <PageBody>
        {!activeOrgId || !ventureId ? (
          <StatusLine tone="muted">No active venture</StatusLine>
        ) : q.isLoading ? (
          <EditorialSkeleton />
        ) : q.error ? (
          <ErrorLine message={(q.error as Error).message} />
        ) : q.data ? (
          <CalendarView
            timezone={q.data.timezone}
            emergencyPause={q.data.emergencyPause}
            publishingEnabled={q.data.publishingEnabled}
            items={q.data.items}
            onItemClick={(id) => nav({ to: "/content-ops/editor/$id", params: { id } })}
          />
        ) : null}
      </PageBody>
    </>
  );
}
