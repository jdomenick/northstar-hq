// Operator surface for Executive Reporting V1.
//
// Operators write only three things: the executive summary, business notes,
// and highlighted accomplishments. Everything else on the client report is
// populated from delivery, billing, activity, and documents.
//
// Business outcome numbers are recorded here explicitly, with the source they
// came from, because this application does not own the systems that measure
// them. Nothing is estimated, forecast, or defaulted to zero.

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  deleteOutcomeMetricFn,
  getOperatorExecutiveReportFn,
  publishExecutiveReportFn,
  upsertOutcomeMetricFn,
} from "@/lib/reporting/reporting.functions";
import {
  METRIC_UNITS,
  METRIC_UNIT_LABEL,
  SUGGESTED_METRICS,
  formatMetricPeriod,
  formatMetricValue,
  isMetricUnit,
  type MetricUnit,
  type OperatorExecutiveReportView,
} from "@/lib/reporting/types";

function errorMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Something went wrong. Try again.";
}

export function OperatorExecutiveReport({ orgId, clientId }: { orgId: string; clientId: string }) {
  const load = useServerFn(getOperatorExecutiveReportFn);
  const queryClient = useQueryClient();
  const queryKey = ["operator-executive-report", orgId, clientId];

  const { data, isLoading, isError } = useQuery<OperatorExecutiveReportView>({
    queryKey,
    queryFn: () => load({ data: { organizationId: orgId, clientId } }),
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-foreground/55">Executive report</h2>
        <p className="mt-2 text-[12.5px] text-foreground/60">
          Publishing saves a new version. Previous versions are kept as history and are never
          overwritten.
        </p>
      </div>

      {isLoading ? (
        <p className="text-[13px] text-foreground/60">Loading report…</p>
      ) : isError || !data ? (
        <p className="text-[13px] text-destructive">We could not load this report.</p>
      ) : (
        <>
          <ReportEditor orgId={orgId} clientId={clientId} view={data} onChanged={refresh} />
          <OutcomeEditor orgId={orgId} clientId={clientId} view={data} onChanged={refresh} />
          <ReportHistory view={data} />
        </>
      )}
    </section>
  );
}

function ReportEditor({
  orgId,
  clientId,
  view,
  onChanged,
}: {
  orgId: string;
  clientId: string;
  view: OperatorExecutiveReportView;
  onChanged: () => void;
}) {
  const publish = useServerFn(publishExecutiveReportFn);
  const [summary, setSummary] = useState(view.current?.summary ?? "");
  const [notes, setNotes] = useState(view.current?.business_notes ?? "");
  const [highlights, setHighlights] = useState((view.current?.highlights ?? []).join("\n"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSummary(view.current?.summary ?? "");
    setNotes(view.current?.business_notes ?? "");
    setHighlights((view.current?.highlights ?? []).join("\n"));
  }, [view.current?.id]);

  const submit = async () => {
    const list = highlights
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 10);
    if (!summary.trim()) {
      toast.error("Write an executive summary before publishing.");
      return;
    }
    setSaving(true);
    try {
      const res = await publish({
        data: {
          organizationId: orgId,
          clientId,
          summary: summary.trim(),
          businessNotes: notes.trim(),
          highlights: list,
        },
      });
      toast.success(`Published version ${res.version}.`);
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 border border-border/60 p-4">
      <Field label="Executive summary">
        <Textarea
          rows={4}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="One short paragraph describing where this engagement stands."
        />
      </Field>
      <Field label="Business notes (optional)">
        <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Field label="Highlighted accomplishments (one per line, up to 10)">
        <Textarea rows={3} value={highlights} onChange={(e) => setHighlights(e.target.value)} />
      </Field>
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={saving}>
          {saving ? "Publishing…" : view.current ? "Publish new version" : "Publish first report"}
        </Button>
        {view.current ? (
          <span className="text-[11.5px] text-foreground/55">
            Current: v{view.current.version} by {view.current.created_by_name ?? "System"} on{" "}
            {new Date(view.current.created_at).toLocaleDateString()}
          </span>
        ) : null}
      </div>
    </div>
  );
}

const EMPTY_METRIC = {
  metricKey: "",
  label: "",
  value: "",
  unit: "count" as MetricUnit,
  periodStart: "",
  periodEnd: "",
  sourceLabel: "",
};

function OutcomeEditor({
  orgId,
  clientId,
  view,
  onChanged,
}: {
  orgId: string;
  clientId: string;
  view: OperatorExecutiveReportView;
  onChanged: () => void;
}) {
  const upsert = useServerFn(upsertOutcomeMetricFn);
  const remove = useServerFn(deleteOutcomeMetricFn);
  const [form, setForm] = useState(EMPTY_METRIC);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const value = Number(form.value);
    if (!form.metricKey.trim() || !form.label.trim() || !Number.isFinite(value)) {
      toast.error("A metric needs a key, a label, and a real recorded value.");
      return;
    }
    if (!form.sourceLabel.trim()) {
      toast.error("Record where this number came from.");
      return;
    }
    setSaving(true);
    try {
      await upsert({
        data: {
          organizationId: orgId,
          clientId,
          metricKey: form.metricKey.trim(),
          label: form.label.trim(),
          value,
          unit: form.unit,
          periodStart: form.periodStart || null,
          periodEnd: form.periodEnd || null,
          sourceLabel: form.sourceLabel.trim(),
          clientVisible: true,
          sortOrder: view.outcomes.length,
        },
      });
      toast.success("Outcome recorded.");
      setForm(EMPTY_METRIC);
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 border border-border/60 p-4">
      <div>
        <h3 className="text-[12.5px] font-medium">Recorded business outcomes</h3>
        <p className="mt-1 text-[12px] text-foreground/60">
          Only record values you can point to in a real source system. Metrics with no recorded value
          are hidden from the client instead of showing zero.
        </p>
      </div>

      {view.outcomes.length === 0 ? (
        <p className="text-[13px] italic text-foreground/55">No outcomes recorded yet.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {view.outcomes.map((m) => {
            const period = formatMetricPeriod(m.period_start, m.period_end);
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div>
                  <div className="text-[13px]">
                    {m.label}: <strong>{formatMetricValue(m.value, m.unit)}</strong>
                  </div>
                  <div className="mt-0.5 text-[11px] text-foreground/50">
                    {period ? `${period} · ` : ""}
                    {m.source_label || "No source recorded"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{m.metric_key}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        await remove({ data: { organizationId: orgId, metricId: m.id } });
                        toast.success("Outcome removed.");
                        onChanged();
                      } catch (e) {
                        toast.error(errorMessage(e));
                      }
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Metric">
          <select
            className="h-9 w-full border border-input bg-background px-2 text-[13px]"
            value={form.metricKey}
            onChange={(e) => {
              const preset = SUGGESTED_METRICS.find((s) => s.key === e.target.value);
              setForm((f) => ({
                ...f,
                metricKey: e.target.value,
                label: preset?.label ?? f.label,
                unit: preset?.unit ?? f.unit,
              }));
            }}
          >
            <option value="">Select a metric</option>
            {SUGGESTED_METRICS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Label shown to the client">
          <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
        </Field>
        <Field label="Recorded value">
          <Input
            inputMode="decimal"
            value={form.value}
            onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
          />
        </Field>
        <Field label="Unit">
          <select
            className="h-9 w-full border border-input bg-background px-2 text-[13px]"
            value={form.unit}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                unit: isMetricUnit(e.target.value) ? e.target.value : f.unit,
              }))
            }
          >
            {METRIC_UNITS.map((u) => (
              <option key={u} value={u}>
                {METRIC_UNIT_LABEL[u]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Period start (optional)">
          <Input
            type="date"
            value={form.periodStart}
            onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
          />
        </Field>
        <Field label="Period end (optional)">
          <Input
            type="date"
            value={form.periodEnd}
            onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
          />
        </Field>
        <Field label="Source of this number">
          <Input
            placeholder="For example: call tracking export, CRM report"
            value={form.sourceLabel}
            onChange={(e) => setForm((f) => ({ ...f, sourceLabel: e.target.value }))}
          />
        </Field>
      </div>
      <Button variant="secondary" onClick={submit} disabled={saving}>
        {saving ? "Saving…" : "Record outcome"}
      </Button>
    </div>
  );
}

function ReportHistory({ view }: { view: OperatorExecutiveReportView }) {
  if (view.history.length === 0) return null;
  return (
    <div className="border border-border/60 p-4">
      <h3 className="text-[12.5px] font-medium">Report history</h3>
      <ul className="mt-3 divide-y divide-border/60">
        {view.history.map((h) => (
          <li key={h.id} className="py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px]">
                v{h.version} · {h.created_by_name ?? "System"}
              </span>
              <span className="text-[11px] text-foreground/50">
                {new Date(h.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-[12px] text-foreground/60">{h.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] uppercase tracking-[0.16em] text-foreground/55">{label}</span>
      {children}
    </label>
  );
}