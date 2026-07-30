import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Mail, RefreshCw } from "lucide-react";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOrg } from "@/lib/org-context";
import {
  convertAssessmentToClient,
  findAssessmentDuplicates,
  getAssessmentRequest,
  retryAssessmentNotification,
  startProposalFromAssessment,
  updateAssessmentRequest,
} from "@/lib/marketing/assessments.functions";

export const Route = createFileRoute("/_authenticated/labs/assessment/$id")({
  component: AssessmentDetailPage,
  head: () => ({
    meta: [
      { title: "Assessment Request | NorthStar Labs" },
      {
        name: "description",
        content: "Review one Assessment request and convert it into a revenue client and proposal.",
      },
      { property: "og:title", content: "Assessment Request | NorthStar Labs" },
      {
        property: "og:description",
        content: "Review one Assessment request and convert it into a revenue client and proposal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function fmt(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const NOTIFICATION_LABEL: Record<string, string> = {
  pending: "Not attempted yet",
  not_configured: "Email sending not configured",
  sent: "Sent to operator",
  failed: "Send failed",
};

function AssessmentDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeOrgId } = useOrg();

  const getFn = useServerFn(getAssessmentRequest);
  const updateFn = useServerFn(updateAssessmentRequest);
  const duplicatesFn = useServerFn(findAssessmentDuplicates);
  const convertFn = useServerFn(convertAssessmentToClient);
  const proposalFn = useServerFn(startProposalFromAssessment);
  const retryFn = useServerFn(retryAssessmentNotification);

  const [convertOpen, setConvertOpen] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["nsl-assessment", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const duplicates = useQuery({
    enabled: convertOpen && !!activeOrgId,
    queryKey: ["nsl-assessment-duplicates", id, activeOrgId],
    queryFn: () => duplicatesFn({ data: { id, organizationId: activeOrgId! } }),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["nsl-assessment", id] });
    void qc.invalidateQueries({ queryKey: ["nsl-assessments"] });
  };

  const update = useMutation({
    mutationFn: (input: { status?: "new" | "reviewed" | "archived"; operatorNotes?: string }) =>
      updateFn({ data: { id, ...input } }),
    onSuccess: () => {
      invalidate();
      setNotes(null);
      toast.success("Request updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convert = useMutation({
    mutationFn: (existingClientId: string | null) =>
      convertFn({ data: { id, organizationId: activeOrgId!, existingClientId } }),
    onSuccess: (res) => {
      invalidate();
      setConvertOpen(false);
      toast.success(
        res.idempotent
          ? "Already linked to a client."
          : res.created
            ? "Revenue client created."
            : "Linked to the existing client.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startProposal = useMutation({
    mutationFn: () => proposalFn({ data: { id, organizationId: activeOrgId! } }),
    onSuccess: (res) => {
      invalidate();
      void navigate({ to: "/labs/proposals/$id", params: { id: res.proposalId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const retry = useMutation({
    mutationFn: () => retryFn({ data: { id } }),
    onSuccess: (res) => {
      invalidate();
      if (res.status === "sent") toast.success("Notification sent.");
      else toast.error(res.error);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const row = detail.data?.request;
  const client = detail.data?.client;
  const proposal = detail.data?.proposal;

  const nextStep = !row
    ? null
    : row.status === "archived"
      ? { label: "Archived. Reopen it to continue.", action: "reopen" as const }
      : !row.revenue_client_id
        ? { label: "Convert this request into a revenue client.", action: "convert" as const }
        : !row.proposal_id
          ? { label: "Start the proposal for this client.", action: "proposal" as const }
          : { label: "Proposal started. Continue in the proposal workspace.", action: "open" as const };

  return (
    <>
      <PageHeader
        eyebrow="Pipeline intake"
        title={row?.company ?? "Assessment request"}
        description={row ? `${row.full_name} · submitted ${fmt(row.created_at)}` : "Loading request"}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/labs/assessments">
              <ArrowLeft className="mr-2 h-4 w-4" />
              All requests
            </Link>
          </Button>
        }
      />
      <PageBody>
        {detail.isError && (
          <p className="text-[13px] text-destructive">{(detail.error as Error).message}</p>
        )}
        {detail.isLoading && <p className="text-[13px] text-muted-foreground">Loading request.</p>}

        {row && (
          <>
            {nextStep && (
              <div className="surface-elevated flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Next step
                  </div>
                  <p className="mt-1 text-[15px] text-foreground">{nextStep.label}</p>
                  {!activeOrgId && (
                    <p className="mt-1 text-[13px] text-destructive">
                      Select an organization to continue.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {nextStep.action === "convert" && (
                    <Button
                      disabled={!activeOrgId || convert.isPending}
                      onClick={() => setConvertOpen(true)}
                    >
                      Convert to client
                    </Button>
                  )}
                  {nextStep.action === "proposal" && (
                    <Button
                      disabled={!activeOrgId || startProposal.isPending}
                      onClick={() => startProposal.mutate()}
                    >
                      {startProposal.isPending ? "Creating proposal" : "Start proposal"}
                    </Button>
                  )}
                  {nextStep.action === "open" && proposal && (
                    <Button asChild>
                      <Link to="/labs/proposals/$id" params={{ id: proposal.id }}>
                        Open {proposal.proposal_number}
                      </Link>
                    </Button>
                  )}
                  {nextStep.action === "reopen" && (
                    <Button
                      variant="outline"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ status: "new" })}
                    >
                      Reopen request
                    </Button>
                  )}
                  {row.status === "new" && (
                    <Button
                      variant="outline"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ status: "reviewed" })}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark reviewed
                    </Button>
                  )}
                  {row.status !== "archived" && row.status !== "converted" && (
                    <Button
                      variant="ghost"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ status: "archived" })}
                    >
                      Archive
                    </Button>
                  )}
                </div>
              </div>
            )}

            <Section title="Request" hint={row.status}>
              <dl className="grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
                <Detail
                  label="Email"
                  value={
                    <a className="underline underline-offset-4" href={`mailto:${row.email}`}>
                      {row.email}
                    </a>
                  }
                />
                <Detail label="Phone" value={row.phone ?? "Not provided"} />
                <Detail label="Website" value={row.website ?? "Not provided"} />
                <Detail label="Industry" value={row.industry ?? "Not provided"} />
                <Detail label="Business size" value={row.business_size ?? "Not provided"} />
                <Detail label="Referral source" value={row.referral_source ?? "Not provided"} />
                <Detail label="Reviewed" value={fmt(row.reviewed_at)} />
                <Detail label="Converted" value={fmt(row.converted_at)} />
                <Detail label="Client" value={client ? client.name : "Not converted"} />
              </dl>
              <div className="mt-5">
                <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Biggest challenge
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-[1.7] text-foreground">
                  {row.biggest_challenge}
                </p>
              </div>
            </Section>

            <Section title="Operator notification" hint={NOTIFICATION_LABEL[row.notification_status]}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-[13px] text-muted-foreground">
                  <p>
                    Last attempt: {fmt(row.notification_attempted_at)} · Sent:{" "}
                    {fmt(row.notification_sent_at)}
                  </p>
                  {row.notification_error && (
                    <p className="mt-1 text-destructive">{row.notification_error}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate()}
                >
                  {retry.isPending ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Retry notification
                </Button>
              </div>
            </Section>

            <Section title="Operator notes">
              <Textarea
                value={notes ?? row.operator_notes ?? ""}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Context, next action, or why this was archived."
              />
              <Button
                className="mt-3"
                size="sm"
                disabled={notes === null || update.isPending}
                onClick={() => update.mutate({ operatorNotes: notes ?? "" })}
              >
                Save notes
              </Button>
            </Section>
          </>
        )}
      </PageBody>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Convert to revenue client</DialogTitle>
            <DialogDescription>
              This creates a revenue client and prefills its company profile from the request. Nothing
              is sent to the prospect.
            </DialogDescription>
          </DialogHeader>

          {duplicates.isLoading && (
            <p className="text-[13px] text-muted-foreground">Checking for existing clients.</p>
          )}
          {duplicates.isError && (
            <p className="text-[13px] text-destructive">{(duplicates.error as Error).message}</p>
          )}
          {duplicates.data && duplicates.data.length > 0 && (
            <div className="space-y-2">
              <p className="text-[13px] text-foreground">
                Possible existing clients. Link instead of creating a duplicate.
              </p>
              {duplicates.data.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 border border-border p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[14px] text-foreground">{m.name}</div>
                    <div className="text-[12px] text-muted-foreground">{m.reasons.join(" · ")}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={convert.isPending}
                    onClick={() => convert.mutate(m.id)}
                  >
                    Link
                  </Button>
                </div>
              ))}
            </div>
          )}
          {duplicates.data && duplicates.data.length === 0 && (
            <p className="text-[13px] text-muted-foreground">No matching client found.</p>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setConvertOpen(false)}>
              Cancel
            </Button>
            <Button disabled={convert.isPending} onClick={() => convert.mutate(null)}>
              {convert.isPending ? "Converting" : "Create new client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 truncate text-foreground">{value}</dd>
    </div>
  );
}