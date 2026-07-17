import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Plus, Trash2, Archive } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/page-header";
import {
  EditorialSkeleton,
  ErrorLine,
  HairlineSection,
  Ledger,
  MetadataRow,
  SectionLabel,
  StatusLine,
  type StatusTone,
} from "@/components/editorial";
import { useOrg } from "@/lib/org-context";
import {
  useActivity,
  useArchiveDecision,
  useDecision,
  useOrgMembers,
  useUpdateDecision,
  useVentures,
  useProjects,
  type Decision,
  type DecisionStatus,
} from "@/lib/data-hooks";
import { can } from "@/lib/permissions";
import {
  EVIDENCE_TYPES,
  newEvidence,
  newOption,
  newRisk,
  parseEvidence,
  parseOptions,
  parseRisks,
  type EvidenceItem,
  type OptionItem,
  type RiskItem,
} from "@/lib/decision-structured";

export const Route = createFileRoute("/_authenticated/decisions/$id")({
  component: DecisionDetail,
  head: () => ({ meta: [{ title: "Decision - Northstar" }] }),
});

const STATUS_LABEL: Record<DecisionStatus, string> = {
  draft: "Draft",
  under_review: "Under review",
  waiting_for_founder: "Waiting on founder",
  decided: "Decided",
  revisit_later: "Revisit later",
  closed: "Closed",
};

const STATUS_TONE: Record<DecisionStatus, StatusTone> = {
  draft: "neutral",
  under_review: "attention",
  waiting_for_founder: "critical",
  decided: "positive",
  revisit_later: "attention",
  closed: "muted",
};

function DecisionDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { activeOrgId, activeMembership } = useOrg();
  const q = useDecision(id);
  const ventures = useVentures(activeOrgId);
  const projects = useProjects(activeOrgId);
  const members = useOrgMembers(activeOrgId);
  const activity = useActivity(activeOrgId, 40);
  const update = useUpdateDecision(activeOrgId);
  const archive = useArchiveDecision(activeOrgId);
  const canWrite = can.writeContent(activeMembership?.role);
  const canArchive = can.archiveContent(activeMembership?.role);

  if (q.isLoading) {
    return (
      <PageBody>
        <EditorialSkeleton rows={4} />
      </PageBody>
    );
  }
  if (q.error) {
    return (
      <PageBody>
        <ErrorLine message={(q.error as Error).message} />
      </PageBody>
    );
  }
  const d = q.data;
  if (!d) {
    return (
      <PageBody>
        <p className="text-[14px] italic text-foreground/70">Decision not found.</p>
      </PageBody>
    );
  }

  async function patch(next: Partial<Decision>) {
    try {
      await update.mutateAsync({ id: d!.id, patch: next, prev: d });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function onArchive() {
    if (!confirm("Archive this decision? It remains on record.")) return;
    try {
      await archive.mutateAsync(d!.id);
      toast.success("Archived");
      nav({ to: "/decisions" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onStatusChange(next: DecisionStatus) {
    if (d!.status === "decided" && next !== "decided") {
      if (!confirm("Reopen this decided record? Prior context will be preserved.")) return;
    }
    try {
      await update.mutateAsync({ id: d!.id, patch: { status: next }, prev: d });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status change failed");
    }
  }

  const venture = (ventures.data ?? []).find((v) => v.id === d.venture_id);
  const project = (projects.data ?? []).find((p) => p.id === d.project_id);
  const memberOptions = (members.data ?? []).map((m) => ({
    value: m.user_id,
    label:
      m.profile?.preferred_name ??
      m.profile?.full_name ??
      m.profile?.email ??
      m.user_id.slice(0, 8),
  }));
  const ownerLabel = d.owner_user_id
    ? memberOptions.find((o) => o.value === d.owner_user_id)?.label ?? "Assigned"
    : "Unassigned";
  const relatedActivity = (activity.data ?? []).filter(
    (a) => a.entity_type === "decision" && a.entity_id === d.id,
  );
  const options = parseOptions(d.options_considered);
  const evidence = parseEvidence(d.evidence);
  const risks = parseRisks(d.risks);

  return (
    <div>
      <div className="px-6 pt-10 md:px-14">
        <div className="mx-auto max-w-6xl">
          <Link
            to="/decisions"
            className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.22em] text-foreground/60 hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Decisions
          </Link>
        </div>
      </div>
      <PageHeader
        eyebrow="Decision memorandum"
        title={d.title}
        description={d.question ?? undefined}
        actions={
          canArchive &&
          d.status !== "closed" && (
            <button
              onClick={onArchive}
              className="inline-flex items-center gap-1.5 border border-foreground/25 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-foreground/70 hover:border-foreground hover:text-foreground"
            >
              <Archive className="h-3.5 w-3.5" strokeWidth={1.5} /> Archive
            </button>
          )
        }
      />
      <PageBody>
        <div className="mb-10 flex flex-wrap items-center gap-x-5 gap-y-2">
          <StatusLine tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</StatusLine>
          <span className="text-[11px] uppercase tracking-[0.22em] text-foreground/55">
            {venture?.name ?? "Organization-wide"}
          </span>
          {d.review_date && (
            <span className="text-[11px] uppercase tracking-[0.22em] text-foreground/55 tabular-nums">
              Review {d.review_date}
            </span>
          )}
          {d.decision_date && (
            <span className="text-[11px] uppercase tracking-[0.22em] text-foreground/55 tabular-nums">
              Decided {d.decision_date}
            </span>
          )}
          <span className="text-[11px] uppercase tracking-[0.22em] text-foreground/55">
            Owner - {ownerLabel}
          </span>
        </div>

        <HairlineSection label="Standing">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <PaperSelect
              label="Status"
              value={d.status}
              disabled={!canWrite}
              onChange={(v) => onStatusChange(v as DecisionStatus)}
              options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            />
            <PaperSelect
              label="Owner"
              value={d.owner_user_id ?? ""}
              disabled={!canWrite}
              onChange={(v) => patch({ owner_user_id: v || null })}
              options={[{ value: "", label: "Unassigned" }, ...memberOptions]}
            />
            <PaperDate
              label="Review date"
              value={d.review_date}
              disabled={!canWrite}
              onCommit={(v) => patch({ review_date: v })}
            />
          </div>
        </HairlineSection>

        <HairlineSection label="Frame">
          <PaperText
            label="Question"
            value={d.question ?? ""}
            disabled={!canWrite}
            onCommit={(v) => patch({ question: v || null })}
          />
          <PaperText
            label="Context"
            value={d.context ?? ""}
            disabled={!canWrite}
            multiline
            onCommit={(v) => patch({ context: v || null })}
          />
          <PaperText
            label="Opportunity cost"
            value={d.opportunity_cost ?? ""}
            disabled={!canWrite}
            multiline
            onCommit={(v) => patch({ opportunity_cost: v || null })}
          />
        </HairlineSection>

        <HairlineSection
          label="Options considered"
          action={<span>{options.length}</span>}
        >
          <OptionsEditor
            value={options}
            disabled={!canWrite}
            onChange={(next) =>
              patch({ options_considered: next as unknown as Decision["options_considered"] })
            }
          />
        </HairlineSection>

        <HairlineSection label="Evidence" action={<span>{evidence.length}</span>}>
          <EvidenceEditor
            value={evidence}
            disabled={!canWrite}
            onChange={(next) =>
              patch({ evidence: next as unknown as Decision["evidence"] })
            }
          />
        </HairlineSection>

        <HairlineSection label="Risks" action={<span>{risks.length}</span>}>
          <RisksEditor
            value={risks}
            disabled={!canWrite}
            onChange={(next) =>
              patch({ risks: next as unknown as Decision["risks"] })
            }
          />
        </HairlineSection>

        <HairlineSection label="Decision">
          <PaperText
            label="Final decision"
            value={d.final_decision ?? ""}
            disabled={!canWrite}
            multiline
            onCommit={(v) => patch({ final_decision: v || null })}
          />
          <PaperText
            label="Rationale"
            value={d.rationale ?? ""}
            disabled={!canWrite}
            multiline
            onCommit={(v) => patch({ rationale: v || null })}
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <PaperDate
              label="Decision date"
              value={d.decision_date}
              disabled={!canWrite}
              onCommit={(v) => patch({ decision_date: v })}
            />
            <PaperText
              label="Outcome"
              value={d.outcome ?? ""}
              disabled={!canWrite}
              multiline
              onCommit={(v) => patch({ outcome: v || null })}
            />
          </div>
          {d.status !== "decided" && canWrite && (
            <button
              onClick={() => onStatusChange("decided")}
              className="mt-6 inline-flex items-center gap-2 border border-foreground bg-foreground px-5 py-2 text-[11.5px] uppercase tracking-[0.2em] text-background hover:bg-foreground/90"
            >
              Mark as decided
            </button>
          )}
        </HairlineSection>

        {project && (
          <HairlineSection label="Related project">
            <MetadataRow
              items={[
                {
                  label: "Project",
                  value: (
                    <Link
                      to="/projects/$id"
                      params={{ id: project.id }}
                      className="underline-offset-4 hover:underline"
                    >
                      {project.name}
                    </Link>
                  ),
                },
                { label: "Status", value: project.status.replaceAll("_", " ") },
                { label: "Priority", value: project.priority },
                {
                  label: "Progress",
                  value: <span className="tabular-nums">{project.progress_percentage}%</span>,
                },
              ]}
            />
          </HairlineSection>
        )}

        <HairlineSection label="Activity history">
          {relatedActivity.length === 0 ? (
            <p className="text-[13.5px] italic text-foreground/60">No activity yet.</p>
          ) : (
            <Ledger>
              {relatedActivity.map((a) => (
                <li key={a.id} className="py-3">
                  <div className="text-[14px] text-foreground/85">{a.summary ?? a.action}</div>
                  <div className="mt-1 text-[10.5px] uppercase tracking-[0.22em] text-foreground/55 tabular-nums">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </Ledger>
          )}
        </HairlineSection>
      </PageBody>
    </div>
  );
}

function PaperSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/60">
        {label}
      </div>
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-b border-foreground/30 bg-transparent px-1 py-2 text-[14px] text-foreground focus:border-foreground focus:outline-none disabled:opacity-60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PaperDate({
  label,
  value,
  onCommit,
  disabled,
}: {
  label: string;
  value: string | null;
  onCommit: (v: string | null) => void;
  disabled?: boolean;
}) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  return (
    <label className="block">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/60">
        {label}
      </div>
      <input
        type="date"
        disabled={disabled}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if ((v || null) !== value) onCommit(v || null);
        }}
        className="w-full border-b border-foreground/30 bg-transparent px-1 py-2 text-[14px] tabular-nums text-foreground focus:border-foreground focus:outline-none disabled:opacity-60"
      />
    </label>
  );
}

function PaperText({
  label,
  value,
  onCommit,
  disabled,
  multiline,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  disabled?: boolean;
  multiline?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => {
    if (v !== value) onCommit(v);
  };
  return (
    <label className="mb-6 block last:mb-0 border-b border-foreground/25 pb-3 focus-within:border-foreground">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/60">
        {label}
      </div>
      {multiline ? (
        <textarea
          disabled={disabled}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          rows={3}
          className="w-full resize-y bg-transparent text-[14px] leading-[1.7] text-foreground focus:outline-none placeholder:italic placeholder:text-foreground/40 disabled:opacity-60"
          placeholder="Not recorded"
        />
      ) : (
        <input
          disabled={disabled}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          className="w-full bg-transparent text-[14px] text-foreground focus:outline-none placeholder:italic placeholder:text-foreground/40 disabled:opacity-60"
          placeholder="Not recorded"
        />
      )}
    </label>
  );
}

function ItemBlock({
  index,
  onRemove,
  disabled,
  children,
}: {
  index: number;
  onRemove: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative border-t border-foreground/15 py-6 first:border-t-0 first:pt-2">
      <div className="mb-3 flex items-baseline justify-between">
        <SectionLabel>Item {String(index + 1).padStart(2, "0")}</SectionLabel>
        {!disabled && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove item"
            className="text-foreground/50 hover:text-[oklch(0.5_0.18_27)]"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-6 inline-flex items-center gap-1.5 border border-foreground/25 px-3 py-2 text-[10.5px] uppercase tracking-[0.2em] text-foreground/70 hover:border-foreground hover:text-foreground"
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> {label}
    </button>
  );
}

function SubField({
  label,
  value,
  onChange,
  disabled,
  textarea,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  disabled?: boolean;
  textarea?: boolean;
}) {
  return (
    <label className="block border-b border-foreground/20 pb-2 focus-within:border-foreground">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
        {label}
      </div>
      {textarea ? (
        <textarea
          disabled={disabled}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full resize-none bg-transparent py-1 text-[13.5px] leading-relaxed text-foreground focus:outline-none disabled:opacity-60"
        />
      ) : (
        <input
          disabled={disabled}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent py-1 text-[13.5px] text-foreground focus:outline-none disabled:opacity-60"
        />
      )}
    </label>
  );
}

function SubSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="block border-b border-foreground/20 pb-2 focus-within:border-foreground">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
        {label}
      </div>
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent py-1 text-[13.5px] text-foreground focus:outline-none disabled:opacity-60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function OptionsEditor({
  value,
  onChange,
  disabled,
}: {
  value: OptionItem[];
  onChange: (v: OptionItem[]) => void;
  disabled?: boolean;
}) {
  const update = (id: string, patch: Partial<OptionItem>) =>
    onChange(value.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const remove = (id: string) => onChange(value.filter((o) => o.id !== id));
  return (
    <div>
      {value.length === 0 && (
        <p className="text-[13px] italic text-foreground/60">No options recorded.</p>
      )}
      {value.map((o, i) => (
        <ItemBlock key={o.id} index={i} onRemove={() => remove(o.id)} disabled={disabled}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SubField
              label="Name"
              value={o.name}
              onChange={(v) => update(o.id, { name: v })}
              disabled={disabled}
            />
            <SubField
              label="Description"
              value={o.description}
              onChange={(v) => update(o.id, { description: v })}
              disabled={disabled}
            />
            <SubField
              label="Advantages"
              value={o.advantages}
              onChange={(v) => update(o.id, { advantages: v })}
              disabled={disabled}
              textarea
            />
            <SubField
              label="Disadvantages"
              value={o.disadvantages}
              onChange={(v) => update(o.id, { disadvantages: v })}
              disabled={disabled}
              textarea
            />
            <SubField
              label="Effort"
              value={o.effort}
              onChange={(v) => update(o.id, { effort: v })}
              disabled={disabled}
            />
            <SubField
              label="Cost"
              value={o.cost}
              onChange={(v) => update(o.id, { cost: v })}
              disabled={disabled}
            />
            <SubField
              label="Expected upside"
              value={o.upside}
              onChange={(v) => update(o.id, { upside: v })}
              disabled={disabled}
            />
            <SubField
              label="Notes"
              value={o.notes}
              onChange={(v) => update(o.id, { notes: v })}
              disabled={disabled}
            />
          </div>
        </ItemBlock>
      ))}
      {!disabled && <AddButton onClick={() => onChange([...value, newOption()])} label="Add option" />}
    </div>
  );
}

function EvidenceEditor({
  value,
  onChange,
  disabled,
}: {
  value: EvidenceItem[];
  onChange: (v: EvidenceItem[]) => void;
  disabled?: boolean;
}) {
  const update = (id: string, patch: Partial<EvidenceItem>) =>
    onChange(value.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const remove = (id: string) => onChange(value.filter((o) => o.id !== id));
  return (
    <div>
      {value.length === 0 && (
        <p className="text-[13px] italic text-foreground/60">No evidence recorded.</p>
      )}
      {value.map((e, i) => (
        <ItemBlock key={e.id} index={i} onRemove={() => remove(e.id)} disabled={disabled}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SubField
              label="Title"
              value={e.title}
              onChange={(v) => update(e.id, { title: v })}
              disabled={disabled}
            />
            <SubField
              label="Source"
              value={e.source}
              onChange={(v) => update(e.id, { source: v })}
              disabled={disabled}
            />
            <SubField
              label="Description"
              value={e.description}
              onChange={(v) => update(e.id, { description: v })}
              disabled={disabled}
              textarea
            />
            <SubField
              label="Source URL"
              value={e.source_url}
              onChange={(v) => update(e.id, { source_url: v })}
              disabled={disabled}
            />
            <SubSelect
              label="Type"
              value={e.type ?? ""}
              onChange={(v) => update(e.id, { type: v })}
              disabled={disabled}
              options={[
                { value: "", label: "Not set" },
                ...EVIDENCE_TYPES.map((t) => ({ value: t, label: t.replaceAll("_", " ") })),
              ]}
            />
            <SubSelect
              label="Reliability"
              value={e.reliability ?? ""}
              onChange={(v) =>
                update(e.id, { reliability: (v || undefined) as EvidenceItem["reliability"] })
              }
              disabled={disabled}
              options={[
                { value: "", label: "Not set" },
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
              ]}
            />
            <SubField
              label="Notes"
              value={e.notes}
              onChange={(v) => update(e.id, { notes: v })}
              disabled={disabled}
              textarea
            />
          </div>
        </ItemBlock>
      ))}
      {!disabled && <AddButton onClick={() => onChange([...value, newEvidence()])} label="Add evidence" />}
    </div>
  );
}

function RisksEditor({
  value,
  onChange,
  disabled,
}: {
  value: RiskItem[];
  onChange: (v: RiskItem[]) => void;
  disabled?: boolean;
}) {
  const update = (id: string, patch: Partial<RiskItem>) =>
    onChange(value.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const remove = (id: string) => onChange(value.filter((o) => o.id !== id));
  return (
    <div>
      {value.length === 0 && (
        <p className="text-[13px] italic text-foreground/60">No risks recorded.</p>
      )}
      {value.map((r, i) => (
        <ItemBlock key={r.id} index={i} onRemove={() => remove(r.id)} disabled={disabled}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SubField
              label="Risk"
              value={r.risk}
              onChange={(v) => update(r.id, { risk: v })}
              disabled={disabled}
            />
            <SubField
              label="Owner"
              value={r.owner}
              onChange={(v) => update(r.id, { owner: v })}
              disabled={disabled}
            />
            <SubField
              label="Description"
              value={r.description}
              onChange={(v) => update(r.id, { description: v })}
              disabled={disabled}
              textarea
            />
            <SubField
              label="Mitigation"
              value={r.mitigation}
              onChange={(v) => update(r.id, { mitigation: v })}
              disabled={disabled}
              textarea
            />
            <SubSelect
              label="Likelihood"
              value={r.likelihood ?? ""}
              onChange={(v) =>
                update(r.id, { likelihood: (v || undefined) as RiskItem["likelihood"] })
              }
              disabled={disabled}
              options={[
                { value: "", label: "Not set" },
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
              ]}
            />
            <SubSelect
              label="Impact"
              value={r.impact ?? ""}
              onChange={(v) => update(r.id, { impact: (v || undefined) as RiskItem["impact"] })}
              disabled={disabled}
              options={[
                { value: "", label: "Not set" },
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
                { value: "critical", label: "Critical" },
              ]}
            />
            <SubField
              label="Notes"
              value={r.notes}
              onChange={(v) => update(r.id, { notes: v })}
              disabled={disabled}
              textarea
            />
          </div>
        </ItemBlock>
      ))}
      {!disabled && <AddButton onClick={() => onChange([...value, newRisk()])} label="Add risk" />}
    </div>
  );
}