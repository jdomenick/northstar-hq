import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { CLIENT_SAFE_UNAVAILABLE } from "@/lib/proposals/client-billing";
import {
  BillingPanel,
  ContactNote,
  DetailRow,
  NextStepPanel,
  SectionHeading,
  fetchProposalStatus,
  fmtDate,
  fmtMoney,
  type PublicPayload,
} from "@/components/proposal-public";

export const Route = createFileRoute("/proposal/$token/")({
  component: PublicProposalPage,
  head: () => ({
    meta: [
      { title: "Your NorthStar Labs Proposal" },
      { name: "description", content: "Review, accept, or decline your NorthStar Labs engagement proposal." },
      { property: "og:title", content: "Your NorthStar Labs Proposal" },
      { property: "og:description", content: "Review, accept, or decline your NorthStar Labs engagement proposal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function PublicProposalPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [proposal, setProposal] = useState<PublicPayload | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/public/proposals/view", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          setState("unavailable");
          return;
        }
        setProposal((await res.json()) as PublicPayload);
        setState("ready");
      } catch {
        setState("unavailable");
      }
    })();
  }, [token]);

  const refresh = useCallback(async () => {
    try {
      setProposal(await fetchProposalStatus(token));
    } catch {
      /* keep the last known good state */
    }
  }, [token]);

  if (state === "loading") {
    return <div className="mx-auto max-w-3xl p-10 text-sm text-foreground/60">Loading proposal…</div>;
  }
  if (state === "unavailable" || !proposal) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <h1 className="font-display text-3xl">Proposal unavailable</h1>
        <p className="mt-3 text-sm text-foreground/70">{CLIENT_SAFE_UNAVAILABLE}</p>
      </div>
    );
  }

  const accepted = proposal.status === "accepted";
  const declined = proposal.status === "declined";
  const depositCents = Math.round(proposal.setup_fee_cents / 2);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-[#0f1218] px-6 py-14 text-white md:px-16">
        <div className="mx-auto max-w-4xl">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.28em] text-white/70">NorthStar Labs</div>
          <h1 className="mt-3 font-display text-3xl leading-tight md:text-5xl">{proposal.title}</h1>
          <div className="mt-4 text-sm text-white/70">
            {proposal.proposal_number} · Prepared for {proposal.client_name} · {fmtDate(proposal.prepared_date)}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-8 px-6 py-10 md:px-16">
        {accepted && (
          <AcceptedStatus
            proposal={proposal}
            token={token}
            depositCents={depositCents}
            onRefresh={refresh}
          />
        )}

        <Section title="Executive Summary" body={proposal.executive_summary} />
        <Section title="Business Overview" body={proposal.business_overview} />
        <Section title="Current Business Challenges" body={proposal.current_challenges} />
        <Section title="Executive Assessment Summary" body={proposal.assessment_summary} />
        <Section title="Growth Opportunities" body={proposal.growth_opportunities} />
        <Section title="Recommended Strategy" body={proposal.recommended_strategy} />
        <Section title="Recommended Services" body={proposal.recommended_services} />
        <Section title="Deliverables" body={proposal.deliverables} />
        <Section title="Implementation Timeline" body={proposal.implementation_timeline} />

        <section>
          <SectionHeading>Investment</SectionHeading>
          <div className="rounded-lg border border-foreground/15 p-5">
            <DetailRow label="Total engagement value" value={fmtMoney(proposal.total_value_cents)} />
            <DetailRow label="One-time setup fee" value={fmtMoney(proposal.setup_fee_cents)} />
            <DetailRow label="Recurring monthly" value={fmtMoney(proposal.recurring_fee_cents)} />
            {proposal.investment_summary && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/70">{proposal.investment_summary}</p>
            )}
          </div>
        </section>
        <Section title="Payment Schedule" body={proposal.payment_schedule} />
        <Section title="Terms and Conditions" body={proposal.terms} />

        {!accepted && (
          <section className="rounded-lg border border-foreground/15 p-5">
            <SectionHeading>Acceptance</SectionHeading>
            {declined ? (
              <DeclinedNotice contactEmail={proposal.contact_email} />
            ) : (
              <AcceptForm token={token} onUpdated={(p) => setProposal(p)} />
            )}
            <div className="mt-4">
              <a href={`/api/public/proposals/pdf?token=${encodeURIComponent(token)}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" /> Download PDF
                </Button>
              </a>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function AcceptedStatus({
  proposal,
  token,
  depositCents,
  onRefresh,
}: {
  proposal: PublicPayload;
  token: string;
  depositCents: number;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const remainingSetup = Math.max(0, proposal.setup_fee_cents - depositCents);

  return (
    <section className="space-y-5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5">
      <div>
        <div className="flex items-center gap-2 text-[15px] font-semibold text-emerald-700">
          <CheckCircle2 className="h-4.5 w-4.5" /> Proposal accepted
        </div>
        {proposal.acceptance && (
          <div className="mt-2 text-sm text-foreground/75">
            Accepted by {proposal.acceptance.signer_name} ({proposal.acceptance.signer_email}) on{" "}
            {new Date(proposal.acceptance.signed_at).toLocaleString()} · {proposal.proposal_number} · v
            {proposal.acceptance.proposal_version}
          </div>
        )}
        <div className="mt-3">
          <a href={`/api/public/proposals/pdf?token=${encodeURIComponent(token)}`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">
              <Download className="mr-2 h-4 w-4" /> Accepted proposal PDF
            </Button>
          </a>
        </div>
      </div>

      <div className="rounded-lg border border-foreground/15 bg-background p-4">
        <DetailRow label="Total setup fee" value={fmtMoney(proposal.setup_fee_cents)} />
        <DetailRow label="Deposit" value={fmtMoney(depositCents)} />
        <DetailRow label="Remaining setup balance" value={fmtMoney(remainingSetup)} />
        {proposal.recurring_fee_cents > 0 && (
          <DetailRow label="Recurring monthly" value={fmtMoney(proposal.recurring_fee_cents)} />
        )}
      </div>

      <div>
        <SectionHeading>Payment status</SectionHeading>
        <BillingPanel billing={proposal.billing} />
        <div className="mt-3 flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onRefresh();
              setBusy(false);
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh status
          </Button>
          <Link to="/proposal/$token/payment-return" params={{ token }} className="text-xs underline text-foreground/60">
            Just paid? Check payment status
          </Link>
        </div>
      </div>

      <NextStepPanel step={proposal.next_step} contactEmail={proposal.contact_email} />
    </section>
  );
}

function DeclinedNotice({ contactEmail }: { contactEmail: string | null }) {
  return (
    <div className="rounded bg-destructive/10 p-4 text-sm">
      <div className="flex items-center gap-2 font-medium text-destructive">
        <XCircle className="h-4 w-4" /> Proposal declined
      </div>
      <p className="mt-2 text-foreground/70">
        This proposal link is no longer active. If this was a mistake, NorthStar Labs can issue a new proposal link.
      </p>
      <div className="mt-2">
        <ContactNote contactEmail={contactEmail} />
      </div>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <SectionHeading>{title}</SectionHeading>
      <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">{body || "[Needs input]"}</div>
    </section>
  );
}

function AcceptForm({ token, onUpdated }: { token: string; onUpdated: (p: PublicPayload) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ack, setAck] = useState("I confirm authority to accept this proposal on behalf of the client organization.");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");

  const accept = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/public/proposals/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, signer_name: name, signer_email: email, acknowledgement: ack }),
      });
      if (!res.ok) {
        setMsg("We could not record your acceptance. Please try again or contact NorthStar Labs.");
        return;
      }
      onUpdated((await res.json()) as PublicPayload);
    } catch {
      setMsg("We could not record your acceptance. Please try again or contact NorthStar Labs.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDecline = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/public/proposals/decline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, reason: reason.trim() || undefined }),
      });
      if (!res.ok) {
        setMsg("We could not record your response. Please contact NorthStar Labs.");
        return;
      }
      setDeclineOpen(false);
      try {
        onUpdated(await fetchProposalStatus(token));
      } catch {
        location.reload();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-foreground/60">Full name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-foreground/60">Email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-foreground/60">Acknowledgement</label>
        <Textarea rows={3} value={ack} onChange={(e) => setAck(e.target.value)} maxLength={500} />
      </div>
      {msg && <div className="rounded bg-destructive/10 p-2 text-xs text-destructive">{msg}</div>}
      <div className="flex gap-2">
        <Button onClick={accept} disabled={busy || name.trim().length < 2 || !email.includes("@") || ack.trim().length < 3}>
          <CheckCircle2 className="mr-2 h-4 w-4" /> Accept proposal
        </Button>
        <Button variant="outline" onClick={() => setDeclineOpen(true)} disabled={busy}>
          <XCircle className="mr-2 h-4 w-4" /> Decline
        </Button>
      </div>
      <p className="text-[11px] text-foreground/50">
        By accepting, you confirm you have authority to bind the client organization. Acceptance is captured as
        electronic evidence with timestamp and IP address. This is not a handwritten or cryptographic signature.
      </p>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline this proposal</DialogTitle>
            <DialogDescription>
              Declining closes this proposal and deactivates this link. You can share an optional reason.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={reason}
            maxLength={1000}
            placeholder="Optional reason (not required)"
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDecline} disabled={busy}>
              Confirm decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
