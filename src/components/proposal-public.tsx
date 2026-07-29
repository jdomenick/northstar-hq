// Shared presentation pieces for the public (client-facing) proposal surface.
// No internal navigation, no internal identifiers.

import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, CreditCard, Download, ExternalLink } from "lucide-react";
import type { PublicBilling, PublicInvoice, ClientNextStep } from "@/lib/proposals/client-billing";

export type PublicPayload = {
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
  contact_email: string | null;
  billing: PublicBilling;
  next_step: ClientNextStep | null;
  acceptance?: {
    signer_name: string;
    signer_email: string;
    acknowledgement: string;
    signed_at: string;
    proposal_version: number;
  } | null;
};

export function fmtMoney(cents: number) {
  return `$${((cents ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export async function fetchProposalStatus(token: string): Promise<PublicPayload> {
  const res = await fetch("/api/public/proposals/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error("unavailable");
  return (await res.json()) as PublicPayload;
}

const STATUS_LABEL: Record<string, string> = {
  open: "Awaiting payment",
  paid: "Paid",
  partially_refunded: "Paid (partially refunded)",
  refunded: "Refunded",
  uncollectible: "Needs attention",
};

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-[10.5px] font-medium uppercase tracking-[0.28em] text-primary">{children}</div>
      <div className="mt-1 h-[2px] w-10 bg-primary" />
    </div>
  );
}

export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-foreground/10 py-2 last:border-b-0">
      <span className="text-sm text-foreground/70">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function InvoiceCard({ invoice }: { invoice: PublicInvoice }) {
  const paid = invoice.status === "paid" || invoice.status === "partially_refunded" || invoice.status === "refunded";
  const open = invoice.status === "open";
  return (
    <div className="rounded-lg border border-foreground/15 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{invoice.label}</div>
          <div className="mt-0.5 text-xs text-foreground/60">
            {STATUS_LABEL[invoice.status] ?? invoice.status}
            {paid && invoice.paid_at ? ` on ${fmtDate(invoice.paid_at)}` : ""}
            {open && invoice.due_at ? ` · Due ${fmtDate(invoice.due_at)}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums">{fmtMoney(invoice.amount_cents)}</div>
          {invoice.amount_remaining_cents > 0 && invoice.amount_paid_cents > 0 && (
            <div className="text-xs text-foreground/60">{fmtMoney(invoice.amount_remaining_cents)} remaining</div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {open && invoice.payment_url && (
          <a href={invoice.payment_url} target="_blank" rel="noopener noreferrer">
            <Button size="sm">
              <CreditCard className="mr-2 h-4 w-4" /> Pay invoice
            </Button>
          </a>
        )}
        {open && !invoice.payment_url && (
          <span className="inline-flex items-center gap-2 rounded bg-secondary/50 px-3 py-1.5 text-xs text-foreground/70">
            <Clock className="h-3.5 w-3.5" /> Payment link is being prepared
          </span>
        )}
        {paid && (
          <span className="inline-flex items-center gap-2 rounded bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Paid
          </span>
        )}
        {paid && invoice.receipt_url && (
          <a href={invoice.receipt_url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">
              <Download className="mr-2 h-4 w-4" /> Download receipt
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

export function BillingPanel({ billing }: { billing: PublicBilling }) {
  if (!billing.invoices.length && !billing.subscription) {
    return (
      <div className="rounded-lg border border-dashed border-foreground/20 p-4 text-sm text-foreground/70">
        No invoice has been issued yet. NorthStar Labs is preparing it and you will receive an email when it is ready.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {billing.invoices.map((inv, i) => (
        <InvoiceCard key={`${inv.purpose}-${i}`} invoice={inv} />
      ))}
      {billing.subscription && (
        <div className="rounded-lg border border-foreground/15 p-4 text-sm">
          <div className="font-semibold">Monthly service</div>
          <div className="mt-0.5 text-xs text-foreground/60">
            Status: {billing.subscription.status}
            {billing.subscription.current_period_end
              ? ` · Renews ${fmtDate(billing.subscription.current_period_end)}`
              : ""}
          </div>
          <div className="mt-2 tabular-nums">
            {fmtMoney(billing.subscription.amount_cents)} per {billing.subscription.interval}
          </div>
        </div>
      )}
    </div>
  );
}

export function NextStepPanel({ step, contactEmail }: { step: ClientNextStep | null; contactEmail: string | null }) {
  if (!step) return null;
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
      <SectionHeading>What happens next</SectionHeading>
      <p className="text-[15px] font-medium leading-relaxed">{step.headline}</p>
      <p className="mt-1.5 text-sm text-foreground/70">{step.detail}</p>
      {contactEmail && (
        <p className="mt-3 text-xs text-foreground/60">
          Questions? Contact NorthStar Labs at{" "}
          <a className="underline" href={`mailto:${contactEmail}`}>
            {contactEmail}
          </a>
          .
        </p>
      )}
    </div>
  );
}

export function ContactNote({ contactEmail }: { contactEmail: string | null }) {
  if (!contactEmail) return null;
  return (
    <p className="text-xs text-foreground/60">
      Contact NorthStar Labs at{" "}
      <a className="underline" href={`mailto:${contactEmail}`}>
        {contactEmail}
      </a>
      .
    </p>
  );
}

export function ExternalHint() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-foreground/50">
      <ExternalLink className="h-3 w-3" /> Opens Stripe secure payment page
    </span>
  );
}
