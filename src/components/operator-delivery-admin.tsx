import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  deleteMilestoneFn,
  getOperatorDeliveryFn,
  saveDeliveryVisibilityFn,
  shareDeliverableFn,
  upsertMilestoneFn,
} from "@/lib/delivery/delivery.functions";
import {
  DELIVERABLE_STATUS_LABEL,
  DELIVERY_STAGES,
  DELIVERY_STAGE_LABEL,
  MILESTONE_STATUSES,
  MILESTONE_STATUS_LABEL,
  type DeliveryStage,
  type MilestoneStatus,
} from "@/lib/delivery/client-delivery";

export function OperatorDeliveryAdmin({ orgId, clientId }: { orgId: string; clientId: string }) {
  const load = useServerFn(getOperatorDeliveryFn);
  const queryClient = useQueryClient();
  const queryKey = ["operator-delivery", orgId, clientId];
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => load({ data: { organizationId: orgId, clientId } }),
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  if (isLoading) {
    return <p className="text-[13px] text-foreground/60">Loading delivery…</p>;
  }
  if (isError || !data) {
    return <p className="text-[13px] text-destructive">We could not load delivery for this client.</p>;
  }

  return (
    <section className="space-y-6">
      <h2 className="text-[11px] uppercase tracking-[0.2em] text-foreground/55">Delivery visibility</h2>

      {data.projects.length === 0 ? (
        <p className="text-[13px] italic text-foreground/55">
          No delivery project exists for this client yet. A project is created automatically once the
          setup balance is paid.
        </p>
      ) : (
        data.projects.map((project) => (
          <ProjectPanel
            key={project.id}
            orgId={orgId}
            clientId={clientId}
            project={project}
            milestones={data.milestones.filter((m) => m.project_id === project.id)}
            deliverables={data.deliverables.filter((d) => d.project_id === project.id)}
            candidates={data.candidate_documents}
            onChanged={refresh}
          />
        ))
      )}
    </section>
  );
}

type LoadedData = Awaited<ReturnType<typeof getOperatorDeliveryFn>>;

function ProjectPanel({
  orgId,
  clientId,
  project,
  milestones,
  deliverables,
  candidates,
  onChanged,
}: {
  orgId: string;
  clientId: string;
  project: LoadedData["projects"][number];
  milestones: LoadedData["milestones"];
  deliverables: LoadedData["deliverables"];
  candidates: LoadedData["candidate_documents"];
  onChanged: () => void;
}) {
  const save = useServerFn(saveDeliveryVisibilityFn);
  const [visible, setVisible] = useState(project.client_visible);
  const [title, setTitle] = useState(project.client_title);
  const [summary, setSummary] = useState(project.client_summary);
  const [stage, setStage] = useState<DeliveryStage>(project.client_stage);
  const [stageLabel, setStageLabel] = useState(project.client_stage_label);
  const [nextAction, setNextAction] = useState(project.client_next_action);
  const [busy, setBusy] = useState(false);

  async function persist() {
    setBusy(true);
    try {
      await save({
        data: {
          organizationId: orgId,
          projectId: project.id,
          clientId,
          client_visible: visible,
          client_title: title.trim(),
          client_summary: summary.trim(),
          client_stage: stage,
          client_stage_label: stageLabel.trim(),
          client_next_action: nextAction.trim(),
        },
      });
      onChanged();
      toast.success("Delivery visibility saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 border border-border/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[14px]">{project.name}</div>
          <div className="mt-1 text-[11.5px] text-foreground/55">
            Internal status: {project.status}
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase">
          {project.client_visible ? "Visible to client" : "Internal only"}
        </Badge>
      </div>

      <label className="flex items-center gap-2 text-[12px] text-foreground/70">
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
        Show this implementation in the client workspace
      </label>

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Client-facing title (defaults to the internal name)"
      />
      <Textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={2}
        placeholder="Plain-language summary the client will read"
      />
      <div className="flex flex-wrap gap-2">
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value as DeliveryStage)}
          className="border border-border/60 bg-background px-2 py-1.5 text-[12.5px]"
        >
          {DELIVERY_STAGES.map((s) => (
            <option key={s} value={s}>
              {DELIVERY_STAGE_LABEL[s]}
            </option>
          ))}
        </select>
        <Input
          value={stageLabel}
          onChange={(e) => setStageLabel(e.target.value)}
          placeholder="Custom stage name (optional)"
          className="max-w-xs"
        />
      </div>
      <Textarea
        value={nextAction}
        onChange={(e) => setNextAction(e.target.value)}
        rows={2}
        placeholder="What NorthStar Labs is doing next (shown to the client)"
      />
      <Button size="sm" disabled={busy} onClick={() => void persist()}>
        Save delivery visibility
      </Button>

      <MilestoneAdmin
        orgId={orgId}
        clientId={clientId}
        projectId={project.id}
        milestones={milestones}
        onChanged={onChanged}
      />

      <DeliverableAdmin
        orgId={orgId}
        clientId={clientId}
        projectId={project.id}
        milestones={milestones}
        deliverables={deliverables}
        candidates={candidates}
        onChanged={onChanged}
      />
    </div>
  );
}

function MilestoneAdmin({
  orgId,
  clientId,
  projectId,
  milestones,
  onChanged,
}: {
  orgId: string;
  clientId: string;
  projectId: string;
  milestones: LoadedData["milestones"];
  onChanged: () => void;
}) {
  const upsert = useServerFn(upsertMilestoneFn);
  const remove = useServerFn(deleteMilestoneFn);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      onChanged();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/55">Milestones</div>

      {milestones.length === 0 ? (
        <p className="text-[13px] italic text-foreground/55">
          No milestones yet. The client sees an unpublished plan until you add them.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 border-y border-border/60">
          {milestones.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <div className="text-[13.5px]">{m.title}</div>
                <div className="mt-1 text-[11.5px] text-foreground/55">
                  {m.client_visible ? "Client visible" : "Internal only"}
                  {m.target_date ? ` · target ${m.target_date}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={m.status}
                  disabled={busy}
                  onChange={(e) =>
                    void run(
                      () =>
                        upsert({
                          data: {
                            organizationId: orgId,
                            id: m.id,
                            projectId,
                            clientId,
                            title: m.title,
                            description: m.description,
                            status: e.target.value as MilestoneStatus,
                            target_date: m.target_date,
                            requires_client_action: m.requires_client_action,
                            client_visible: m.client_visible,
                            sort_order: m.sort_order,
                          },
                        }),
                      "Milestone updated",
                    )
                  }
                  className="border border-border/60 bg-background px-2 py-1 text-[12px]"
                >
                  {MILESTONE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {MILESTONE_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        upsert({
                          data: {
                            organizationId: orgId,
                            id: m.id,
                            projectId,
                            clientId,
                            title: m.title,
                            description: m.description,
                            status: m.status,
                            target_date: m.target_date,
                            requires_client_action: m.requires_client_action,
                            client_visible: !m.client_visible,
                            sort_order: m.sort_order,
                          },
                        }),
                      "Visibility updated",
                    )
                  }
                >
                  {m.client_visible ? "Hide" : "Show"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => remove({ data: { organizationId: orgId, milestoneId: m.id } }),
                      "Milestone removed",
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Milestone title" />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What the client should understand about this milestone"
        />
        <Input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="max-w-[200px]"
        />
        <Button
          size="sm"
          disabled={busy || title.trim().length === 0}
          onClick={() =>
            void run(async () => {
              await upsert({
                data: {
                  organizationId: orgId,
                  projectId,
                  clientId,
                  title: title.trim(),
                  description: description.trim(),
                  status: "upcoming",
                  target_date: targetDate || null,
                  requires_client_action: false,
                  client_visible: true,
                  sort_order: milestones.length,
                },
              });
              setTitle("");
              setDescription("");
              setTargetDate("");
            }, "Milestone added")
          }
        >
          Add milestone
        </Button>
      </div>
    </div>
  );
}

function DeliverableAdmin({
  orgId,
  clientId,
  projectId,
  milestones,
  deliverables,
  candidates,
  onChanged,
}: {
  orgId: string;
  clientId: string;
  projectId: string;
  milestones: LoadedData["milestones"];
  deliverables: LoadedData["deliverables"];
  candidates: LoadedData["candidate_documents"];
  onChanged: () => void;
}) {
  const share = useServerFn(shareDeliverableFn);
  const [documentId, setDocumentId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [requiresReview, setRequiresReview] = useState(true);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      onChanged();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/55">Deliverables</div>

      {deliverables.length === 0 ? (
        <p className="text-[13px] italic text-foreground/55">Nothing shared as a deliverable yet.</p>
      ) : (
        <ul className="divide-y divide-border/60 border-y border-border/60">
          {deliverables.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <div className="text-[13.5px]">
                  {d.title}
                  {d.version_label ? (
                    <span className="ml-2 text-[11.5px] text-foreground/50">{d.version_label}</span>
                  ) : null}
                </div>
                {d.status === "revision_requested" && d.revision_reason ? (
                  <p className="mt-1 text-[12px] text-foreground/70">
                    Client asked for: {d.revision_reason}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px] uppercase">
                  {DELIVERABLE_STATUS_LABEL[d.status]}
                </Badge>
                {d.status !== "final" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          share({
                            data: {
                              organizationId: orgId,
                              documentId: d.id,
                              clientId,
                              projectId,
                              milestoneId: d.milestone_id,
                              versionLabel: d.version_label,
                              requiresClientReview: true,
                              finalize: false,
                            },
                          }),
                        "Re-shared for review",
                      )
                    }
                  >
                    Re-share for review
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <select
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
          className="w-full border border-border/60 bg-background px-2 py-1.5 text-[12.5px]"
        >
          <option value="">Select an uploaded document to share as a deliverable</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
              {c.file_name ? ` (${c.file_name})` : ""}
            </option>
          ))}
        </select>
        <select
          value={milestoneId}
          onChange={(e) => setMilestoneId(e.target.value)}
          className="w-full border border-border/60 bg-background px-2 py-1.5 text-[12.5px]"
        >
          <option value="">No milestone</option>
          {milestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        <Input
          value={versionLabel}
          onChange={(e) => setVersionLabel(e.target.value)}
          placeholder="Version label (for example v1)"
          className="max-w-[220px]"
        />
        <label className="flex items-center gap-2 text-[12px] text-foreground/70">
          <input
            type="checkbox"
            checked={requiresReview}
            onChange={(e) => setRequiresReview(e.target.checked)}
          />
          Request client review and approval
        </label>
        <Button
          size="sm"
          disabled={busy || documentId.length === 0}
          onClick={() =>
            void run(async () => {
              await share({
                data: {
                  organizationId: orgId,
                  documentId,
                  clientId,
                  projectId,
                  milestoneId: milestoneId || null,
                  versionLabel: versionLabel.trim(),
                  requiresClientReview: requiresReview,
                  finalize: false,
                },
              });
              setDocumentId("");
              setMilestoneId("");
              setVersionLabel("");
            }, "Deliverable shared")
          }
        >
          Share deliverable
        </Button>
        {candidates.length === 0 ? (
          <p className="text-[12px] italic text-foreground/55">
            Upload a file in the Documents section above before sharing it as a deliverable.
          </p>
        ) : null}
      </div>
    </div>
  );
}