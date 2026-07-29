import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Download, CheckCircle2, XCircle } from "lucide-react";

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

type Payload = {
  proposal_number: string;
  title: string;
  status: string;
  version: number;
  client_name: string;
  prepared_date: string;
  executive_summary: string;
  business_overview: string;
  current_challenges: string;
  assessment_summary: string;
  growth_opportunities: string;
  recommended_strategy: string;
  recommended_services: string;
  deliverables: string;
  implementation_timeline: string;
  investment_summary: string;
  payment_schedule: string;
  terms: string;
  total_value_cents: number;
  setup_fee_cents: number;
  recurring_fee_cents: number;
  accepted_at: string | null;
  declined_at: string | null;
  acceptance?: {
    signer_name: string; signer_email: string; acknowledgement: string; signed_at: string; proposal_version: number;
  } | null;
};

function fmt(cents: number) {
  return `$${((cents ?? 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function PublicProposalPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<"loading" | "ready" | "not_available">("loading");
  const [proposal, setProposal] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/public/proposals/view", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) { setState("not_available"); setError(await res.text()); return; }
        setProposal(await res.json());
        setState("ready");
      } catch (e) {
        setState("not_available");
        setError(e instanceof Error ? e.message : "error");
      }
    })();
  }, [token]);

  if (state === "loading") return <div className="mx-auto max-w-3xl p-10 text-sm text-foreground/60">Loading proposal…</div>;
  if (state === "not_available" || !proposal) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <h1 className="font-display text-3xl">Proposal unavailable</h1>
        <p className="mt-3 text-sm text-foreground/70">
          This link is no longer valid. Reasons include: link expired, proposal was superseded, or acceptance is no longer available.
        </p>
        {error && <p className="mt-2 text-xs text-foreground/50">({error})</p>}
      </div>
    );
  }

  const locked = proposal.status === "accepted";
  const declined = proposal.status === "declined";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Cover */}
      <header className="bg-[#0f1218] px-6 py-14 text-white md:px-16">
        <div className="mx-auto max-w-4xl">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.28em] text-white/70">NorthStar Labs</div>
          <h1 className="mt-3 font-display text-3xl leading-tight md:text-5xl">{proposal.title}</h1>
          <div className="mt-4 text-sm text-white/70">
            {proposal.proposal_number} · Prepared for {proposal.client_name} ·{" "}
            {new Date(proposal.prepared_date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-8 px-6 py-10 md:px-16">
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
            <Row label="Total engagement value" value={fmt(proposal.total_value_cents)} />
            <Row label="One-time setup fee" value={fmt(proposal.setup_fee_cents)} />
            <Row label="Recurring monthly" value={fmt(proposal.recurring_fee_cents)} />
            {proposal.investment_summary && <p className="mt-3 text-sm text-foreground/70 whitespace-pre-wrap">{proposal.investment_summary}</p>}
          </div>
        </section>
        <Section title="Payment Schedule" body={proposal.payment_schedule} />
        <Section title="Terms and Conditions" body={proposal.terms} />

        <section className="rounded-lg border border-foreground/15 p-5">
          <SectionHeading>Acceptance</SectionHeading>
          {locked && proposal.acceptance ? (
            <div className="rounded bg-emerald-500/10 p-4 text-sm">
              <div className="flex items-center gap-2 font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Accepted on {new Date(proposal.acceptance.signed_at).toLocaleString()}
              </div>
              <div className="mt-2 text-foreground/70">
                Signed by {proposal.acceptance.signer_name} ({proposal.acceptance.signer_email}) · Proposal version v{proposal.acceptance.proposal_version}
              </div>
              <div className="mt-2 whitespace-pre-wrap text-foreground/70">Acknowledgement: {proposal.acceptance.acknowledgement}</div>
            </div>
          ) : declined ? (
            <div className="rounded bg-destructive/10 p-4 text-sm text-destructive"><XCircle className="mr-2 inline h-4 w-4" /> Declined</div>
          ) : (
            <AcceptForm token={token} onAccepted={(p) => setProposal(p)} />
          )}
          <div className="mt-4">
            <a href={`/api/public/proposals/pdf?token=${encodeURIComponent(token)}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-[10.5px] font-medium uppercase tracking-[0.28em] text-primary">{children}</div>
      <div className="mt-1 h-[2px] w-10 bg-primary" />
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-foreground/10 py-2 last:border-b-0">
      <span className="text-sm text-foreground/70">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function AcceptForm({ token, onAccepted }: { token: string; onAccepted: (p: Payload) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ack, setAck] = useState("I confirm authority to accept this proposal on behalf of the client organization.");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/public/proposals/accept", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, signer_name: name, signer_email: email, acknowledgement: ack }),
      });
      if (!res.ok) { setMsg((await res.text()) || "Acceptance failed"); return; }
      onAccepted(await res.json());
    } finally { setBusy(false); }
  };

  const decline = async () => {
    setBusy(true); setMsg(null);
    try {
      const reason = prompt("Optional reason for declining:") ?? undefined;
      const res = await fetch("/api/public/proposals/decline", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, reason }),
      });
      if (!res.ok) { setMsg((await res.text()) || "Decline failed"); return; }
      // Reload to get latest state
      const view = await fetch("/api/public/proposals/view", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      if (view.ok) onAccepted(await view.json());
      else location.reload();
    } finally { setBusy(false); }
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
        <Button variant="outline" onClick={decline} disabled={busy}><XCircle className="mr-2 h-4 w-4" /> Decline</Button>
      </div>
      <p className="text-[11px] text-foreground/50">By accepting, you confirm you have authority to bind the client organization. Acceptance is captured as electronic evidence with timestamp and IP address. This is not a handwritten or cryptographic signature.</p>
    </div>
  );
}