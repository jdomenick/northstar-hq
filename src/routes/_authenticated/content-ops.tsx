import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { PageBody, PageHeader } from "@/components/page-header";
import {
  EditorialSkeleton,
  EmptyEditorialState,
  ErrorLine,
  Ledger,
  LedgerRow,
  SectionLabel,
  StatusLine,
  QuietPanel,
} from "@/components/editorial";
import { useOrg } from "@/lib/org-context";
import { useVentures } from "@/lib/data-hooks";
import { getAutonomy } from "@/lib/content-ops/autonomy.functions";
import { listContentItems } from "@/lib/content-ops/content.functions";
import { listStrategies } from "@/lib/content-ops/strategy.functions";
import { listLearnings } from "@/lib/content-ops/learnings.functions";

export const Route = createFileRoute("/_authenticated/content-ops")({
  component: ContentOpsWorkspace,
  head: () => ({
    meta: [
      { title: "Content Operations - Northstar" },
      {
        name: "description",
        content:
          "Plan, approve, schedule, and learn from a venture's content operation. Approval-required by default.",
      },
    ],
  }),
});

function ContentOpsWorkspace() {
  const { activeOrgId } = useOrg();
  const organizationId = activeOrgId;
  const venturesQ = useVentures(organizationId);
  const ventureId = venturesQ.data?.[0]?.id ?? null;

  const getAutonomyFn = useServerFn(getAutonomy);
  const listStrategiesFn = useServerFn(listStrategies);
  const listContentFn = useServerFn(listContentItems);
  const listLearningsFn = useServerFn(listLearnings);

  const enabled = Boolean(organizationId && ventureId);

  const autonomyQ = useQuery({
    queryKey: ["content-ops", "autonomy", organizationId, ventureId],
    enabled,
    queryFn: () => getAutonomyFn({ data: { organizationId: organizationId!, ventureId: ventureId! } }),
  });
  const strategiesQ = useQuery({
    queryKey: ["content-ops", "strategies", organizationId, ventureId],
    enabled,
    queryFn: () => listStrategiesFn({ data: { organizationId: organizationId!, ventureId: ventureId! } }),
  });
  const pendingQ = useQuery({
    queryKey: ["content-ops", "content", "pending", organizationId, ventureId],
    enabled,
    queryFn: () =>
      listContentFn({
        data: {
          organizationId: organizationId!,
          ventureId: ventureId!,
          approvalStatus: "pending",
          limit: 50,
        },
      }),
  });
  const scheduledQ = useQuery({
    queryKey: ["content-ops", "content", "scheduled", organizationId, ventureId],
    enabled,
    queryFn: () =>
      listContentFn({
        data: { organizationId: organizationId!, ventureId: ventureId!, status: "scheduled", limit: 50 },
      }),
  });
  const learningsQ = useQuery({
    queryKey: ["content-ops", "learnings", organizationId, ventureId],
    enabled,
    queryFn: () => listLearningsFn({ data: { organizationId: organizationId!, ventureId: ventureId! } }),
  });

  const autonomy = autonomyQ.data;

  const autonomyLine = useMemo(() => {
    if (!autonomy) return "-";
    const parts = [autonomy.mode.replace("_", " ")];
    if (autonomy.emergencyPause) parts.push("emergency pause active");
    return parts.join(" - ");
  }, [autonomy]);

  if (!enabled) {
    return (
      <>
        <PageHeader
          eyebrow="Content Operations"
          title="Select a venture"
          description="Content Operations runs per venture. Choose a venture to begin."
        />
        <PageBody>
          <EmptyEditorialState
            title="No venture selected"
            description="Pick a venture from the switcher to open Content Operations."
          />
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Content Operations"
        title="The Operation"
        description="Plan, approve, schedule, and learn. Approval required for every post."
      />
      <PageBody>
        <QuietPanel>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <SectionLabel>Autonomy</SectionLabel>
              <div className="mt-1 text-lg">{autonomyLine}</div>
            </div>
            <div className="text-right">
              <SectionLabel>Policy version</SectionLabel>
              <div className="mt-1 font-mono text-sm">{autonomy?.policyVersion ?? "-"}</div>
            </div>
          </div>
        </QuietPanel>

        <section className="mt-10">
          <SectionLabel>Awaiting approval</SectionLabel>
          {pendingQ.isLoading ? (
            <EditorialSkeleton rows={3} />
          ) : pendingQ.isError ? (
            <ErrorLine message="Could not load pending items." />
          ) : (pendingQ.data ?? []).length === 0 ? (
            <EmptyEditorialState title="Nothing awaiting approval" description="New drafts will surface here." />
          ) : (
            <Ledger>
              {(pendingQ.data ?? []).map((it) => (
                <LedgerRow
                  key={it.id}
                  status={<StatusLine tone="attention">{it.platform}</StatusLine>}
                  title={it.title ?? it.body.slice(0, 80)}
                  meta={`${it.content_type} - v${it.content_version}`}
                />
              ))}
            </Ledger>
          )}
        </section>

        <section className="mt-10">
          <SectionLabel>Scheduled</SectionLabel>
          {scheduledQ.isLoading ? (
            <EditorialSkeleton rows={3} />
          ) : (scheduledQ.data ?? []).length === 0 ? (
            <EmptyEditorialState title="Nothing scheduled" />
          ) : (
            <Ledger>
              {(scheduledQ.data ?? []).map((it) => (
                <LedgerRow
                  key={it.id}
                  status={<StatusLine tone="neutral">{it.platform}</StatusLine>}
                  title={it.title ?? it.body.slice(0, 80)}
                  meta={it.scheduled_for ?? ""}
                />
              ))}
            </Ledger>
          )}
        </section>

        <section className="mt-10">
          <SectionLabel>Strategies</SectionLabel>
          {strategiesQ.isLoading ? (
            <EditorialSkeleton rows={2} />
          ) : (strategiesQ.data ?? []).length === 0 ? (
            <EmptyEditorialState title="No strategy yet" description="Create a strategy to unlock planning." />
          ) : (
            <Ledger>
              {(strategiesQ.data ?? []).map((s) => (
                <LedgerRow
                  key={s.id}
                  status={<StatusLine tone={s.superseded_by ? "muted" : "neutral"}>{s.status}</StatusLine>}
                  title={s.name}
                  meta={`${s.strategy_period_start ?? ""} - ${s.strategy_period_end ?? ""}`}
                />
              ))}
            </Ledger>
          )}
        </section>

        <section className="mt-10">
          <SectionLabel>Learnings</SectionLabel>
          {learningsQ.isLoading ? (
            <EditorialSkeleton rows={2} />
          ) : (learningsQ.data ?? []).length === 0 ? (
            <EmptyEditorialState title="No learnings yet" description="Learnings appear once metrics accumulate." />
          ) : (
            <Ledger>
              {(learningsQ.data ?? []).map((l) => (
                <LedgerRow
                  key={l.id}
                  status={<StatusLine tone="neutral">{l.platform ?? "learning"}</StatusLine>}
                  title={l.recommendation ?? l.topic ?? "Learning"}
                  meta={l.created_at ?? ""}
                />
              ))}
            </Ledger>
          )}
        </section>
      </PageBody>
    </>
  );
}