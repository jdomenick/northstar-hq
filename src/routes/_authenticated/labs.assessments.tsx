import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Inbox } from "lucide-react";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ASSESSMENT_STATUSES,
  listAssessmentRequests,
  updateAssessmentRequest,
  type AssessmentStatus,
} from "@/lib/marketing/assessments.functions";

export const Route = createFileRoute("/_authenticated/labs/assessments")({
  component: AssessmentsPage,
  head: () => ({
    meta: [
      { title: "Assessment Requests | NorthStar Labs" },
      {
        name: "description",
        content: "Review and qualify Assessment requests submitted from the NorthStar Labs website.",
      },
      { property: "og:title", content: "Assessment Requests | NorthStar Labs" },
      {
        property: "og:description",
        content: "Review and qualify Assessment requests submitted from the NorthStar Labs website.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUS_TONE: Record<string, string> = {
  new: "bg-primary/10 text-primary",
  contacted: "bg-sky-500/10 text-sky-600",
  scheduled: "bg-sky-500/15 text-sky-700",
  qualified: "bg-emerald-500/10 text-emerald-600",
  disqualified: "bg-destructive/10 text-destructive",
  archived: "bg-muted text-muted-foreground",
};

function fmt(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AssessmentsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAssessmentRequests);
  const updateFn = useServerFn(updateAssessmentRequest);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const list = useQuery({
    queryKey: ["nsl-assessments"],
    queryFn: () => listFn(),
  });

  const update = useMutation({
    mutationFn: (input: { id: string; status?: AssessmentStatus; operatorNotes?: string }) =>
      updateFn({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["nsl-assessments"] });
      toast.success("Request updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = list.data ?? [];
  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status !== "archived" && r.status !== "disqualified")),
    [rows, filter],
  );
  const newCount = rows.filter((r) => r.status === "new").length;

  return (
    <>
      <PageHeader
        eyebrow="Pipeline intake"
        title="Assessment Requests"
        description="Every request submitted from the public website, in the order it arrived."
        actions={
          <Button variant="outline" size="sm" onClick={() => setFilter(filter === "open" ? "all" : "open")}>
            {filter === "open" ? "Show all" : "Show open only"}
          </Button>
        }
      />
      <PageBody>
        <Section
          title="Requests"
          hint={list.isLoading ? "Loading" : `${visible.length} shown · ${newCount} new`}
        >
          {list.isError && (
            <p className="text-[13px] text-destructive">
              Could not load requests. {(list.error as Error).message}
            </p>
          )}
          {!list.isLoading && !list.isError && visible.length === 0 && (
            <div className="flex flex-col items-start gap-2 border border-dashed border-border p-8">
              <Inbox className="h-5 w-5 text-muted-foreground" />
              <p className="text-[14px] text-foreground">No requests to review.</p>
              <p className="text-[13px] text-muted-foreground">
                New submissions from the website appear here immediately.
              </p>
            </div>
          )}
          <div className="space-y-4">
            {visible.map((r) => (
              <RequestCard
                key={r.id}
                row={r}
                saving={update.isPending}
                onUpdate={(input) => update.mutate({ id: r.id, ...input })}
              />
            ))}
          </div>
        </Section>
      </PageBody>
    </>
  );
}

type Row = {
  id: string;
  created_at: string;
  full_name: string;
  company: string;
  email: string;
  phone: string | null;
  website: string | null;
  industry: string | null;
  business_size: string | null;
  biggest_challenge: string;
  referral_source: string | null;
  status: string;
  operator_notes: string | null;
};

function RequestCard({
  row,
  saving,
  onUpdate,
}: {
  row: Row;
  saving: boolean;
  onUpdate: (input: { status?: AssessmentStatus; operatorNotes?: string }) => void;
}) {
  const [notes, setNotes] = useState(row.operator_notes ?? "");
  const notesDirty = notes !== (row.operator_notes ?? "");

  return (
    <article className="surface-elevated p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display text-[17px] font-semibold text-foreground">{row.company}</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {row.full_name} · {fmt(row.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={STATUS_TONE[row.status] ?? "bg-muted text-muted-foreground"} variant="secondary">
            {row.status}
          </Badge>
          <Select
            value={row.status}
            onValueChange={(v) => onUpdate({ status: v as AssessmentStatus })}
            disabled={saving}
          >
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSESSMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Email" value={<a className="underline underline-offset-4" href={`mailto:${row.email}`}>{row.email}</a>} />
        <Detail label="Phone" value={row.phone ?? "Not provided"} />
        <Detail label="Industry" value={row.industry ?? "Not provided"} />
        <Detail label="Business size" value={row.business_size ?? "Not provided"} />
        <Detail label="Website" value={row.website ?? "Not provided"} />
        <Detail label="Referral source" value={row.referral_source ?? "Not provided"} />
      </dl>

      <div className="mt-4">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Biggest challenge
        </div>
        <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-[1.7] text-foreground">
          {row.biggest_challenge}
        </p>
      </div>

      <div className="mt-4">
        <label
          htmlFor={`notes-${row.id}`}
          className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
        >
          Operator notes
        </label>
        <Textarea
          id={`notes-${row.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={4000}
          className="mt-2"
          placeholder="Context, next action, or why this was disqualified."
        />
        <Button
          className="mt-3"
          size="sm"
          disabled={!notesDirty || saving}
          onClick={() => onUpdate({ operatorNotes: notes })}
        >
          Save notes
        </Button>
      </div>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-foreground">{value}</dd>
    </div>
  );
}