import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ClientWorkspace } from "@/components/client-shell";
import {
  EmptyState,
  LoadingRows,
  PageHeading,
  Pill,
  WorkspaceError,
  formatDate,
} from "@/components/client-workspace-ui";
import {
  decideDeliverableFn,
  getClientDeliveryFn,
  getDeliverableUrlFn,
} from "@/lib/delivery/delivery.functions";
import {
  DELIVERABLE_STATUS_LABEL,
  DELIVERY_HEALTH_LABEL,
  DELIVERY_STAGES,
  MILESTONE_STATUS_LABEL,
  type ClientDeliverable,
  type ClientDeliveryView,
  type ClientMilestone,
  type DeliveryHealth,
} from "@/lib/delivery/client-delivery";

export const DELIVERY_QUERY_KEY = ["client-delivery"] as const;

export const Route = createFileRoute("/client/delivery")({
  ssr: false,
  component: DeliveryPage,
  head: () => ({
    meta: [
      { title: "Delivery status  -  NorthStar Labs" },
      {
        name: "description",
        content: "Track your NorthStar Labs implementation, milestones, and deliverables.",
      },
      { property: "og:title", content: "Delivery status  -  NorthStar Labs" },
      {
        property: "og:description",
        content: "Track your NorthStar Labs implementation, milestones, and deliverables.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function DeliveryPage() {
  return <ClientWorkspace>{() => <Delivery />}</ClientWorkspace>;
}

function healthTone(health: DeliveryHealth): "neutral" | "ok" | "warn" | "danger" {
  if (health === "blocked" || health === "at_risk") return "danger";
  if (health === "waiting_on_client") return "warn";
  if (health === "complete" || health === "on_track") return "ok";
  return "neutral";
}

function Delivery() {
  const load = useServerFn(getClientDeliveryFn);
  const { data, isLoading, isError } = useQuery<ClientDeliveryView>({
    queryKey: DELIVERY_QUERY_KEY,
    queryFn: () => load(),
    retry: false,
  });

  if (isLoading) return <LoadingRows />;
  if (isError || !data) {
    return <WorkspaceError message="We could not load your delivery status. Refresh to try again." />;
  }

  if (!data.project) {
    return (
      <div className="space-y-8">
        <PageHeading
          label="Delivery"
          title="Delivery has not started yet"
          lead="Your implementation plan appears here once NorthStar Labs opens it."
        />
        <EmptyState
          title="Nothing to show yet"
          detail="Completing onboarding and your initial payment is what moves delivery forward. We will post the plan here as soon as it is ready."
        />
      </div>
    );
  }

  const { project, milestones, deliverables, progress, next_step } = data;

  return (
    <div className="space-y-10">
      <PageHeading
        label={project.stage_label}
        title={project.title}
        lead={project.summary || undefined}
      />

      <section className="border border-foreground/12 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[10px] font-medium uppercase tracking-[0.26em] text-foreground/55">
            Your next step
          </span>
          <Pill tone={healthTone(project.health)}>{DELIVERY_HEALTH_LABEL[project.health]}</Pill>
        </div>
        <h2 className="mt-3 font-display text-[22px] leading-tight text-foreground">
          {next_step.headline}
        </h2>
        <p className="mt-2 text-[13.5px] leading-[1.7] text-foreground/70">{next_step.detail}</p>
      </section>

      <StageRail stage={project.stage} />

      <dl className="grid gap-px border border-foreground/12 bg-foreground/12 sm:grid-cols-3">
        <Cell
          label="Milestones"
          value={
            progress.total === 0
              ? "Not published yet"
              : `${progress.complete} of ${progress.total} complete`
          }
        />
        <Cell label="Progress" value={progress.percent === null ? "Not measurable yet" : `${progress.percent}%`} />
        <Cell label="Started" value={formatDate(project.started_at)} />
      </dl>

      <section>
        <h2 className="mb-4 text-[10px] font-medium uppercase tracking-[0.26em] text-foreground/55">
          Milestones
        </h2>
        {milestones.length === 0 ? (
          <EmptyState
            title="No milestones published"
            detail="NorthStar Labs has not published the milestone plan for this implementation yet."
          />
        ) : (
          <ul className="divide-y divide-foreground/10 border-y border-foreground/10">
            {milestones.map((m) => (
              <MilestoneRow key={m.id} milestone={m} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-[10px] font-medium uppercase tracking-[0.26em] text-foreground/55">
          Deliverables
        </h2>
        {deliverables.length === 0 ? (
          <EmptyState
            title="No deliverables shared yet"
            detail="Finished work is shared here for you to open, review, and approve."
          />
        ) : (
          <ul className="space-y-3">
            {deliverables.map((d) => (
              <DeliverableCard key={d.id} deliverable={d} />
            ))}
          </ul>
        )}
      </section>

      <p className="text-[12.5px] leading-[1.7] text-foreground/60">
        This page shows only your own implementation. Internal NorthStar Labs notes and other client
        work are never shown here.
      </p>
    </div>
  );
}

function StageRail({ stage }: { stage: (typeof DELIVERY_STAGES)[number] }) {
  const index = DELIVERY_STAGES.indexOf(stage);
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Delivery stage">
      {DELIVERY_STAGES.map((s, i) => {
        const done = i < index;
        const current = i === index;
        return (
          <li
            key={s}
            aria-current={current ? "step" : undefined}
            className={`border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${
              current
                ? "border-foreground bg-foreground text-background"
                : done
                  ? "border-foreground/35 text-foreground/75"
                  : "border-foreground/15 text-foreground/40"
            }`}
          >
            {s}
          </li>
        );
      })}
    </ol>
  );
}

function MilestoneRow({ milestone }: { milestone: ClientMilestone }) {
  const tone =
    milestone.status === "complete"
      ? "ok"
      : milestone.status === "waiting_on_client"
        ? "warn"
        : "neutral";
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] text-foreground">{milestone.title}</div>
          {milestone.description ? (
            <p className="mt-1.5 text-[13px] leading-[1.7] text-foreground/70">
              {milestone.description}
            </p>
          ) : null}
          <div className="mt-2 text-[11.5px] text-foreground/50">
            {milestone.status === "complete"
              ? `Completed ${formatDate(milestone.completed_at)}`
              : milestone.target_date
                ? `Target ${formatDate(milestone.target_date)}`
                : "No target date set"}
          </div>
        </div>
        <Pill tone={tone}>{MILESTONE_STATUS_LABEL[milestone.status]}</Pill>
      </div>
    </li>
  );
}

function DeliverableCard({ deliverable }: { deliverable: ClientDeliverable }) {
  const queryClient = useQueryClient();
  const getUrl = useServerFn(getDeliverableUrlFn);
  const decide = useServerFn(decideDeliverableFn);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const open = deliverable.requires_client_review && deliverable.status === "ready_for_review";

  async function submit(decision: "approved" | "revision_requested") {
    if (decision === "revision_requested" && reason.trim().length === 0) {
      toast.error("Tell us what needs to change.");
      return;
    }
    setBusy(true);
    try {
      await decide({ data: { documentId: deliverable.id, decision, reason: reason.trim() } });
      await queryClient.invalidateQueries({ queryKey: DELIVERY_QUERY_KEY });
      toast.success(decision === "approved" ? "Approved. Thank you." : "Revision requested.");
      setReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We could not record that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="border border-foreground/12 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] text-foreground">
            {deliverable.title}
            {deliverable.version_label ? (
              <span className="ml-2 text-[11.5px] text-foreground/50">
                {deliverable.version_label}
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[11.5px] text-foreground/50">
            {deliverable.file_name ?? "No file attached"} · shared{" "}
            {formatDate(deliverable.shared_at)}
          </div>
          {deliverable.status === "revision_requested" && deliverable.revision_reason ? (
            <p className="mt-2 text-[13px] leading-[1.7] text-foreground/70">
              You asked for: {deliverable.revision_reason}
            </p>
          ) : null}
        </div>
        <Pill tone={open ? "warn" : deliverable.status === "preparing" ? "neutral" : "ok"}>
          {DELIVERABLE_STATUS_LABEL[deliverable.status]}
        </Pill>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {deliverable.has_file ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              try {
                const { url } = await getUrl({ data: { documentId: deliverable.id } });
                window.open(url, "_blank", "noopener,noreferrer");
              } catch {
                toast.error("That file is not available right now.");
              }
            }}
            className="text-[12px] underline underline-offset-4 text-foreground/75 hover:text-foreground disabled:opacity-50"
          >
            Open file
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-4 space-y-2 border-t border-foreground/10 pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit("approved")}
            className="bg-foreground px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-background transition hover:opacity-90 disabled:opacity-50"
          >
            Approve
          </button>
          <label className="block pt-2 text-[11px] uppercase tracking-[0.18em] text-foreground/55">
            Or request a revision
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="What needs to change?"
            className="w-full border border-foreground/20 bg-background p-2.5 text-[13px] text-foreground"
          />
          <button
            type="button"
            disabled={busy || reason.trim().length === 0}
            onClick={() => void submit("revision_requested")}
            className="border border-foreground/25 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-foreground transition hover:bg-foreground hover:text-background disabled:opacity-50"
          >
            Request revision
          </button>
        </div>
      ) : null}
    </li>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-5">
      <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
        {label}
      </dt>
      <dd className="mt-2 break-words text-[14px] text-foreground">{value}</dd>
    </div>
  );
}