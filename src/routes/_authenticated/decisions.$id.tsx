import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Plus, Trash2, Archive, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader, Section } from "@/components/page-header";
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
  head: () => ({ meta: [{ title: "Decision — Northstar" }] }),
});

const STATUS_LABEL: Record<DecisionStatus, string> = {
  draft: "Draft",
  under_review: "Under review",
  waiting_for_founder: "Waiting on founder",
  decided: "Decided",
  revisit_later: "Revisit later",
  closed: "Closed",
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

  if (q.isLoading) return <PageBody><div className="h-40 animate-pulse rounded-2xl bg-card/30" /></PageBody>;
  if (q.error) return <PageBody><p className="text-muted-foreground">Couldn't load this decision.</p></PageBody>;
  const d = q.data;
  if (!d) return <PageBody><p className="text-muted-foreground">Decision not found.</p></PageBody>;

  async function patch(next: Partial<Decision>) {
    try {
      await update.mutateAsync({ id: d!.id, patch: next, prev: d });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function onArchive() {
    if (!confirm("Archive this decision?")) return;
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
    label: m.profile?.preferred_name ?? m.profile?.full_name ?? m.profile?.email ?? m.user_id.slice(0, 8),
  }));
  const relatedActivity = (activity.data ?? []).filter((a) => a.entity_type === "decision" && a.entity_id === d.id);

  return (
    <div>
      <div className="px-6 pt-10 md:px-14">
        <div className="mx-auto max-w-6xl">
          <Link to="/decisions" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" /> Decisions
          </Link>
        </div>
      </div>
      <PageHeader
        eyebrow={`${venture?.name ?? "Organization"} · ${STATUS_LABEL[d.status]}`}
        title={d.title}
        description={d.question ?? undefined}
        actions={
          canArchive && d.status !== "closed" && (
            <button onClick={onArchive} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[12.5px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground">
              <Archive className="h-3.5 w-3.5" /> Archive
            </button>
          )
        }
      />
      <PageBody>
        <Section title="Status">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <MetaSelect label="Status" value={d.status} disabled={!canWrite}
              onChange={(v) => onStatusChange(v as DecisionStatus)}
              options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
            <MetaSelect label="Owner" value={d.owner_user_id ?? ""} disabled={!canWrite}
              onChange={(v) => patch({ owner_user_id: v || null })}
              options={[{ value: "", label: "Unassigned" }, ...memberOptions]} />
            <MetaDate label="Review date" value={d.review_date} disabled={!canWrite}
              onCommit={(v) => patch({ review_date: v })} />
          </div>
        </Section>

        <Section title="Frame">
          <EditableText label="Question" value={d.question ?? ""} disabled={!canWrite}
            onCommit={(v) => patch({ question: v || null })} />
          <EditableText label="Context" value={d.context ?? ""} disabled={!canWrite} multiline
            onCommit={(v) => patch({ context: v || null })} />
          <EditableText label="Opportunity cost" value={d.opportunity_cost ?? ""} disabled={!canWrite}
            onCommit={(v) => patch({ opportunity_cost: v || null })} />
        </Section>

        <Section title="Options considered">
          <OptionsEditor value={parseOptions(d.options_considered)} disabled={!canWrite}
            onChange={(next) => patch({ options_considered: next as unknown as Decision["options_considered"] })} />
        </Section>

        <Section title="Evidence">
          <EvidenceEditor value={parseEvidence(d.evidence)} disabled={!canWrite}
            onChange={(next) => patch({ evidence: next as unknown as Decision["evidence"] })} />
        </Section>

        <Section title="Risks">
          <RisksEditor value={parseRisks(d.risks)} disabled={!canWrite}
            onChange={(next) => patch({ risks: next as unknown as Decision["risks"] })} />
        </Section>

        <Section title="Operator recommendation">
          <div className="rounded-2xl bg-card/40 p-6">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
              <Sparkles className="h-3.5 w-3.5" /> Analyze with Operator
            </div>
            <p className="mt-3 text-[13.5px] text-muted-foreground">
              Operator intelligence will be activated in Phase 3.
            </p>
            <button disabled className="mt-4 rounded-md bg-secondary/60 px-3.5 py-1.5 text-[12px] text-muted-foreground/70">
              Analyze — disabled
            </button>
          </div>
        </Section>

        <Section title="Decision">
          <EditableText label="Final decision" value={d.final_decision ?? ""} disabled={!canWrite} multiline
            onCommit={(v) => patch({ final_decision: v || null })} />
          <EditableText label="Rationale" value={d.rationale ?? ""} disabled={!canWrite} multiline
            onCommit={(v) => patch({ rationale: v || null })} />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <MetaDate label="Decision date" value={d.decision_date} disabled={!canWrite}
              onCommit={(v) => patch({ decision_date: v })} />
            <EditableText label="Outcome" value={d.outcome ?? ""} disabled={!canWrite} multiline
              onCommit={(v) => patch({ outcome: v || null })} />
          </div>
          {d.status !== "decided" && canWrite && (
            <button
              onClick={() => onStatusChange("decided")}
              className="mt-4 rounded-md bg-foreground px-4 py-2 text-[12.5px] font-medium text-background hover:opacity-90"
            >
              Mark as decided
            </button>
          )}
        </Section>

        {project && (
          <Section title="Related project">
            <Link to="/projects/$id" params={{ id: project.id }} className="text-[13.5px] text-foreground hover:underline">
              {project.name}
            </Link>
          </Section>
        )}

        <Section title="Recent activity">
          {relatedActivity.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-4">
              {relatedActivity.map((a) => (
                <li key={a.id} className="text-[13.5px]">
                  <div className="text-foreground">{a.summary ?? a.action}</div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </PageBody>
    </div>
  );
}

function MetaSelect({ label, value, onChange, options, disabled }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">{label}</div>
      <select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md bg-secondary/40 px-3 py-2 text-[13.5px] text-foreground outline-none hover:bg-secondary/60 disabled:opacity-60">
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </label>
  );
}

function MetaDate({ label, value, onCommit, disabled }: { label: string; value: string | null; onCommit: (v: string | null) => void; disabled?: boolean }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  return (
    <label className="block">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">{label}</div>
      <input type="date" disabled={disabled} value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if ((v || null) !== value) onCommit(v || null); }}
        className="w-full rounded-md bg-secondary/40 px-3 py-2 text-[13.5px] text-foreground outline-none hover:bg-secondary/60 disabled:opacity-60" />
    </label>
  );
}

function EditableText({ label, value, onCommit, disabled, multiline }: {
  label: string; value: string; onCommit: (v: string) => void; disabled?: boolean; multiline?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => { if (v !== value) onCommit(v); };
  return (
    <label className="mb-6 block last:mb-0">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">{label}</div>
      {multiline ? (
        <textarea disabled={disabled} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} rows={3}
          className="w-full resize-y rounded-md bg-secondary/40 px-3 py-2 text-[13.5px] leading-relaxed text-foreground outline-none hover:bg-secondary/60 disabled:opacity-60" />
      ) : (
        <input disabled={disabled} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit}
          className="w-full rounded-md bg-secondary/40 px-3 py-2 text-[13.5px] text-foreground outline-none hover:bg-secondary/60 disabled:opacity-60" />
      )}
    </label>
  );
}

function ItemBox({ children, onRemove, disabled }: { children: React.ReactNode; onRemove: () => void; disabled?: boolean }) {
  return (
    <div className="relative rounded-xl bg-card/40 p-5">
      {!disabled && (
        <button onClick={onRemove} className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      {children}
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-secondary/60 px-3 py-1.5 text-[12.5px] text-foreground hover:bg-secondary">
      <Plus className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function SubField({ label, value, onChange, disabled, textarea }: {
  label: string; value: string | undefined; onChange: (v: string) => void; disabled?: boolean; textarea?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">{label}</div>
      {textarea ? (
        <textarea disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={2}
          className="w-full resize-none rounded-md bg-background/50 px-2.5 py-2 text-[13px] text-foreground outline-none disabled:opacity-60" />
      ) : (
        <input disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md bg-background/50 px-2.5 py-2 text-[13px] text-foreground outline-none disabled:opacity-60" />
      )}
    </label>
  );
}

function OptionsEditor({ value, onChange, disabled }: { value: OptionItem[]; onChange: (v: OptionItem[]) => void; disabled?: boolean }) {
  const update = (id: string, patch: Partial<OptionItem>) => onChange(value.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const remove = (id: string) => onChange(value.filter((o) => o.id !== id));
  return (
    <div className="space-y-3">
      {value.length === 0 && <p className="text-[13px] text-muted-foreground">No options yet.</p>}
      {value.map((o) => (
        <ItemBox key={o.id} onRemove={() => remove(o.id)} disabled={disabled}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SubField label="Name" value={o.name} onChange={(v) => update(o.id, { name: v })} disabled={disabled} />
            <SubField label="Description" value={o.description} onChange={(v) => update(o.id, { description: v })} disabled={disabled} />
            <SubField label="Advantages" value={o.advantages} onChange={(v) => update(o.id, { advantages: v })} disabled={disabled} textarea />
            <SubField label="Disadvantages" value={o.disadvantages} onChange={(v) => update(o.id, { disadvantages: v })} disabled={disabled} textarea />
            <SubField label="Effort" value={o.effort} onChange={(v) => update(o.id, { effort: v })} disabled={disabled} />
            <SubField label="Cost" value={o.cost} onChange={(v) => update(o.id, { cost: v })} disabled={disabled} />
            <SubField label="Expected upside" value={o.upside} onChange={(v) => update(o.id, { upside: v })} disabled={disabled} />
            <SubField label="Notes" value={o.notes} onChange={(v) => update(o.id, { notes: v })} disabled={disabled} />
          </div>
        </ItemBox>
      ))}
      {!disabled && <AddButton onClick={() => onChange([...value, newOption()])} label="Add option" />}
    </div>
  );
}

function EvidenceEditor({ value, onChange, disabled }: { value: EvidenceItem[]; onChange: (v: EvidenceItem[]) => void; disabled?: boolean }) {
  const update = (id: string, patch: Partial<EvidenceItem>) => onChange(value.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const remove = (id: string) => onChange(value.filter((o) => o.id !== id));
  return (
    <div className="space-y-3">
      {value.length === 0 && <p className="text-[13px] text-muted-foreground">No evidence recorded.</p>}
      {value.map((e) => (
        <ItemBox key={e.id} onRemove={() => remove(e.id)} disabled={disabled}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SubField label="Title" value={e.title} onChange={(v) => update(e.id, { title: v })} disabled={disabled} />
            <SubField label="Source" value={e.source} onChange={(v) => update(e.id, { source: v })} disabled={disabled} />
            <SubField label="Description" value={e.description} onChange={(v) => update(e.id, { description: v })} disabled={disabled} textarea />
            <SubField label="Source URL" value={e.source_url} onChange={(v) => update(e.id, { source_url: v })} disabled={disabled} />
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Type</div>
              <select disabled={disabled} value={e.type ?? ""} onChange={(ev) => update(e.id, { type: ev.target.value })}
                className="w-full rounded-md bg-background/50 px-2.5 py-2 text-[13px] text-foreground outline-none disabled:opacity-60">
                <option value="">—</option>
                {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Reliability</div>
              <select disabled={disabled} value={e.reliability ?? ""} onChange={(ev) => update(e.id, { reliability: (ev.target.value || undefined) as EvidenceItem["reliability"] })}
                className="w-full rounded-md bg-background/50 px-2.5 py-2 text-[13px] text-foreground outline-none disabled:opacity-60">
                <option value="">—</option>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </label>
            <SubField label="Notes" value={e.notes} onChange={(v) => update(e.id, { notes: v })} disabled={disabled} textarea />
          </div>
        </ItemBox>
      ))}
      {!disabled && <AddButton onClick={() => onChange([...value, newEvidence()])} label="Add evidence" />}
    </div>
  );
}

function RisksEditor({ value, onChange, disabled }: { value: RiskItem[]; onChange: (v: RiskItem[]) => void; disabled?: boolean }) {
  const update = (id: string, patch: Partial<RiskItem>) => onChange(value.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const remove = (id: string) => onChange(value.filter((o) => o.id !== id));
  return (
    <div className="space-y-3">
      {value.length === 0 && <p className="text-[13px] text-muted-foreground">No risks recorded.</p>}
      {value.map((r) => (
        <ItemBox key={r.id} onRemove={() => remove(r.id)} disabled={disabled}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SubField label="Risk" value={r.risk} onChange={(v) => update(r.id, { risk: v })} disabled={disabled} />
            <SubField label="Owner" value={r.owner} onChange={(v) => update(r.id, { owner: v })} disabled={disabled} />
            <SubField label="Description" value={r.description} onChange={(v) => update(r.id, { description: v })} disabled={disabled} textarea />
            <SubField label="Mitigation" value={r.mitigation} onChange={(v) => update(r.id, { mitigation: v })} disabled={disabled} textarea />
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Likelihood</div>
              <select disabled={disabled} value={r.likelihood ?? ""} onChange={(ev) => update(r.id, { likelihood: (ev.target.value || undefined) as RiskItem["likelihood"] })}
                className="w-full rounded-md bg-background/50 px-2.5 py-2 text-[13px] text-foreground outline-none disabled:opacity-60">
                <option value="">—</option>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </label>
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Impact</div>
              <select disabled={disabled} value={r.impact ?? ""} onChange={(ev) => update(r.id, { impact: (ev.target.value || undefined) as RiskItem["impact"] })}
                className="w-full rounded-md bg-background/50 px-2.5 py-2 text-[13px] text-foreground outline-none disabled:opacity-60">
                <option value="">—</option>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
              </select>
            </label>
            <SubField label="Notes" value={r.notes} onChange={(v) => update(r.id, { notes: v })} disabled={disabled} textarea />
          </div>
        </ItemBox>
      ))}
      {!disabled && <AddButton onClick={() => onChange([...value, newRisk()])} label="Add risk" />}
    </div>
  );
}