import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, CreditCard, ExternalLink, RefreshCw, Repeat, Send, Undo2, Wallet } from "lucide-react";
import { useOrg } from "@/lib/org-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NextStepBanner, deriveLifecycle } from "@/components/client-lifecycle";
import {
  getBillingOverviewFn,
  getBillableProposalsFn,
  startBillingFromProposalFn,
  generateFinalInvoiceFn,
  activateSubscriptionFn,
  refundInvoiceFn,
  resendInvoiceFn,
} from "@/lib/billing/billing.functions";

export const Route = createFileRoute("/_authenticated/labs/billing")({
  component: BillingPage,
  head: () => ({
    meta: [
      { title: "Billing | NorthStar Labs" },
      { name: "description", content: "Manage Stripe customers, setup invoices, refunds, and recurring subscriptions for accepted proposals." },
      { property: "og:title", content: "Billing | NorthStar Labs" },
      { property: "og:description", content: "Manage Stripe customers, setup invoices, refunds, and recurring subscriptions for accepted proposals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents || 0) / 100);
}

function statusTone(status: string): string {
  switch (status) {
    case "paid":
    case "active":
    case "trialing":
      return "bg-primary/10 text-primary border-primary/30";
    case "open":
    case "incomplete":
      return "bg-amber-500/10 text-amber-600 border-amber-500/30";
    case "refunded":
    case "partially_refunded":
    case "canceled":
    case "past_due":
    case "unpaid":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function BillingPage() {
  const { activeOrgId } = useOrg();
  const qc = useQueryClient();
  const overviewFn = useServerFn(getBillingOverviewFn);
  const billableFn = useServerFn(getBillableProposalsFn);
  const startFn = useServerFn(startBillingFromProposalFn);
  const finalFn = useServerFn(generateFinalInvoiceFn);
  const activateFn = useServerFn(activateSubscriptionFn);
  const refundFn = useServerFn(refundInvoiceFn);
  const resendFn = useServerFn(resendInvoiceFn);

  const overviewQ = useQuery({
    queryKey: ["billing-overview", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: () => overviewFn({ data: { organization_id: activeOrgId! } }),
  });
  const billableQ = useQuery({
    queryKey: ["billing-billable", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: () => billableFn({ data: { organization_id: activeOrgId! } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["billing-overview"] });
    qc.invalidateQueries({ queryKey: ["billing-billable"] });
  };

  const startMut = useMutation({
    mutationFn: (proposal_id: string) =>
      startFn({ data: { organization_id: activeOrgId!, proposal_id } }),
    onSuccess: () => { toast.success("Setup deposit invoice created and sent to Stripe."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const finalMut = useMutation({
    mutationFn: (proposal_id: string) =>
      finalFn({ data: { organization_id: activeOrgId!, proposal_id } }),
    onSuccess: () => { toast.success("Final setup invoice created."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const activateMut = useMutation({
    mutationFn: (proposal_id: string) =>
      activateFn({ data: { organization_id: activeOrgId!, proposal_id } }),
    onSuccess: () => { toast.success("Recurring subscription activated."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const refundMut = useMutation({
    mutationFn: (invoice_id: string) =>
      refundFn({ data: { organization_id: activeOrgId!, invoice_id } }),
    onSuccess: () => { toast.success("Refund issued through Stripe."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const resendMut = useMutation({
    mutationFn: (invoice_id: string) =>
      resendFn({ data: { organization_id: activeOrgId!, invoice_id } }),
    onSuccess: () => toast.success("Invoice email resent."),
    onError: (e: Error) => toast.error(e.message),
  });

  const overview = overviewQ.data;
  const proposals = billableQ.data ?? [];

  const totals = useMemo(() => {
    const invs = overview?.invoices ?? [];
    const paid = invs.reduce((s, i) => s + Number(i.amount_paid_cents ?? 0), 0);
    const outstanding = invs.reduce(
      (s, i) => s + (i.status === "open" ? Number(i.amount_cents ?? 0) : 0),
      0,
    );
    const activeSubs = (overview?.subscriptions ?? []).filter(
      (s) => s.status === "active" || s.status === "trialing",
    );
    const mrr = activeSubs.reduce((s, x) => s + Number(x.amount_cents ?? 0), 0);
    return { paid, outstanding, mrr, activeCount: activeSubs.length };
  }, [overview]);

  const invoicesByProposal = useMemo(() => {
    const m = new Map<string, { deposit?: (typeof invs)[number]; final?: (typeof invs)[number] }>();
    const invs = overview?.invoices ?? [];
    for (const inv of invs) {
      if (!inv.proposal_id) continue;
      const cur = m.get(inv.proposal_id) ?? {};
      if (inv.type === "setup_deposit") cur.deposit = inv;
      if (inv.type === "setup_final") cur.final = inv;
      m.set(inv.proposal_id, cur);
    }
    return m;
  }, [overview]);

  const subsByProposal = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of overview?.subscriptions ?? []) {
      if (s.proposal_id) m.set(s.proposal_id, s.status);
    }
    return m;
  }, [overview]);

  const copy = (url: string) => {
    navigator.clipboard?.writeText(url).then(
      () => toast.success("Payment link copied. Send it to your client."),
      () => toast.error("Could not copy the link."),
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-2 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">NorthStar Labs</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Billing & Payments</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Stripe-backed invoicing, refunds, and recurring billing tied to accepted proposals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {overview && !overview.configured ? (
              <Badge variant="outline" className="border-destructive/40 text-destructive">
                Stripe not configured
              </Badge>
            ) : (
              <Badge variant="outline" className="border-primary/30 text-primary">Stripe connected</Badge>
            )}
            <Button size="sm" variant="outline" onClick={() => { overviewQ.refetch(); billableQ.refetch(); }}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </header>

        {/* KPIs */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={<Wallet className="h-4 w-4" />} label="Collected (all time)" value={money(totals.paid)} />
          <KpiCard icon={<CreditCard className="h-4 w-4" />} label="Outstanding" value={money(totals.outstanding)} />
          <KpiCard icon={<Repeat className="h-4 w-4" />} label="Active MRR" value={money(totals.mrr)} />
          <KpiCard icon={<Repeat className="h-4 w-4" />} label="Active subscriptions" value={String(totals.activeCount)} />
        </section>

        {/* Accepted proposals ready to bill */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Engagements</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-right">Setup</th>
                  <th className="px-4 py-3 text-right">Monthly</th>
                  <th className="px-4 py-3 text-left">Deposit</th>
                  <th className="px-4 py-3 text-left">Balance</th>
                  <th className="px-4 py-3 text-left">Next step</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {proposals.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center">
                    <div className="text-sm text-muted-foreground">Nothing to bill yet. Billing starts the moment a client signs a proposal.</div>
                    <Link to="/labs/proposals" className="mt-3 inline-block">
                      <Button size="sm" variant="outline">Go to proposals</Button>
                    </Link>
                  </td></tr>
                ) : proposals.map((p) => {
                  const pair = invoicesByProposal.get(p.id) ?? {};
                  const depositPaid = pair.deposit?.status === "paid";
                  const finalPaid = pair.final?.status === "paid";
                  const life = deriveLifecycle({
                    proposalStatus: p.status,
                    depositStatus: pair.deposit?.status,
                    finalStatus: pair.final?.status,
                    subscriptionStatus: subsByProposal.get(p.id),
                    recurringFeeCents: Number(p.recurring_fee_cents ?? 0),
                  });
                  const openInvoice = pair.deposit && pair.deposit.status === "open"
                    ? pair.deposit
                    : pair.final && pair.final.status === "open" ? pair.final : null;
                  return (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.client_name}</div>
                        <Link
                          to="/labs/proposals/$id"
                          params={{ id: p.id }}
                          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                        >
                          {p.proposal_number} · v{p.version}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(Number(p.setup_fee_cents ?? 0))}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(Number(p.recurring_fee_cents ?? 0))}</td>
                      <td className="px-4 py-3">
                        {pair.deposit ? (
                          <Badge variant="outline" className={statusTone(pair.deposit.status)}>{pair.deposit.status}</Badge>
                        ) : <span className="text-xs text-muted-foreground">Not started</span>}
                      </td>
                      <td className="px-4 py-3">
                        {pair.final ? (
                          <Badge variant="outline" className={statusTone(pair.final.status)}>{pair.final.status}</Badge>
                        ) : <span className="text-xs text-muted-foreground">Not generated</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{life.nextStep}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {!pair.deposit && (
                            <Button size="sm" onClick={() => startMut.mutate(p.id)} disabled={startMut.isPending}>
                              Start billing
                            </Button>
                          )}
                          {openInvoice?.hosted_invoice_url && (
                            <>
                              <Button size="sm" onClick={() => copy(openInvoice.hosted_invoice_url!)}>
                                <Copy className="mr-1 h-3 w-3" /> Payment link
                              </Button>
                              {openInvoice.collection_method === "send_invoice" && (
                                <Button size="sm" variant="outline" onClick={() => resendMut.mutate(openInvoice.id)} disabled={resendMut.isPending}>
                                  <Send className="mr-1 h-3 w-3" /> Resend
                                </Button>
                              )}
                            </>
                          )}
                          {depositPaid && !pair.final && (
                            <Button size="sm" onClick={() => finalMut.mutate(p.id)} disabled={finalMut.isPending}>
                              Generate balance invoice
                            </Button>
                          )}
                          {finalPaid && Number(p.recurring_fee_cents ?? 0) > 0 && !subsByProposal.get(p.id) && (
                            <Button size="sm" onClick={() => activateMut.mutate(p.id)} disabled={activateMut.isPending}>
                              Activate subscription
                            </Button>
                          )}
                          {life.complete && <span className="text-xs text-primary">Live</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Invoices */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Invoices</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Paid at</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(overview?.invoices ?? []).length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No invoices yet.</td></tr>
                ) : (overview?.invoices ?? []).map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 capitalize">{inv.type.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(Number(inv.amount_cents), inv.currency)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(Number(inv.amount_paid_cents), inv.currency)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusTone(inv.status)}>{inv.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {inv.paid_at ? new Date(inv.paid_at).toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {inv.hosted_invoice_url && (
                          <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline">
                              <ExternalLink className="mr-1 h-3 w-3" /> View
                            </Button>
                          </a>
                        )}
                        {inv.collection_method === "send_invoice" && inv.status === "open" && (
                          <Button size="sm" variant="outline" onClick={() => resendMut.mutate(inv.id)} disabled={resendMut.isPending}>
                            <Send className="mr-1 h-3 w-3" /> Resend
                          </Button>
                        )}
                        {(inv.status === "paid" || inv.status === "partially_refunded") && (
                          <Button size="sm" variant="outline" onClick={() => refundMut.mutate(inv.id)} disabled={refundMut.isPending}>
                            <Undo2 className="mr-1 h-3 w-3" /> Refund
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Subscriptions */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Subscriptions</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Stripe ID</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Next billing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(overview?.subscriptions ?? []).length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No subscriptions yet.</td></tr>
                ) : (overview?.subscriptions ?? []).map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-mono text-xs">{s.stripe_subscription_id}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusTone(s.status)}>{s.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(Number(s.amount_cents), s.currency)} / {s.interval}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent events */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Recent billing events</h2>
          <div className="rounded-lg border border-border">
            {(overview?.events ?? []).length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No events yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {(overview?.events ?? []).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <span className="font-mono text-xs">{e.event_type}</span>
                    <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}