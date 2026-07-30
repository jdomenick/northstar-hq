// Pure billing snapshot projection for the executive report.
// Reads only invoices the client can already see. Never estimates.
import type { ReportBilling } from "./types";

export interface SnapshotInvoice {
  id: string;
  label: string;
  status: string;
  amount_cents: number;
  amount_remaining_cents: number;
  currency: string;
  due_at: string | null;
  paid_at: string | null;
}

export function buildBillingSnapshot(
  stageLabel: string,
  invoices: ReadonlyArray<SnapshotInvoice>,
): ReportBilling {
  const outstanding = invoices
    .filter((i) => i.status === "open" || i.status === "past_due" || i.status === "uncollectible")
    .reduce((sum, i) => sum + i.amount_remaining_cents, 0);

  const paid = invoices
    .filter((i): i is SnapshotInvoice & { paid_at: string } => Boolean(i.paid_at))
    .sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1));
  const lastPaid = paid[0];

  const upcoming = invoices
    .filter((i): i is SnapshotInvoice & { due_at: string } => i.status === "open" && Boolean(i.due_at))
    .sort((a, b) => (a.due_at > b.due_at ? 1 : -1));
  const next = upcoming[0];

  return {
    status_label: stageLabel,
    currency: invoices[0]?.currency ?? "usd",
    invoices: invoices.map((i) => ({
      id: i.id,
      label: i.label,
      status: i.status,
      amount_cents: i.amount_cents,
      amount_remaining_cents: i.amount_remaining_cents,
      currency: i.currency,
      due_at: i.due_at,
      paid_at: i.paid_at,
    })),
    outstanding_cents: outstanding,
    last_payment: lastPaid
      ? {
          amount_cents: lastPaid.amount_cents - lastPaid.amount_remaining_cents,
          paid_at: lastPaid.paid_at,
          label: lastPaid.label,
        }
      : null,
    next_invoice: next
      ? {
          label: next.label,
          due_at: next.due_at,
          amount_cents: next.amount_remaining_cents,
        }
      : null,
  };
}