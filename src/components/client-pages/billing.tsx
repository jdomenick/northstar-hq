import { createFileRoute } from "@tanstack/react-router";
import { ClientWorkspace } from "@/components/client-shell";
import {
  EmptyState,
  LoadingRows,
  PageHeading,
  Pill,
  WorkspaceError,
  formatDate,
  useClientWorkspace,
} from "@/components/client-workspace-ui";
import { formatMoney } from "@/lib/client-workspace/types";

export function BillingBody() {
  const { data, isLoading, isError } = useClientWorkspace();
  if (isLoading) return <LoadingRows />;
  if (isError || !data) {
    return <WorkspaceError message="We could not load your billing history. Refresh to try again." />;
  }

  const open = data.invoices.filter((i) => i.status === "open");

  return (
    <div className="space-y-10">
      <PageHeading
        label="Billing"
        title="Invoices and payments"
        lead="Payments are processed securely by Stripe. NorthStar Labs never stores your card details."
      />

      {open.length > 0 ? (
        <section className="border border-foreground/20 bg-foreground/[0.03] p-5">
          <div className="text-[10px] font-medium uppercase tracking-[0.26em] text-foreground/55">
            Payment due
          </div>
          <div className="mt-3 space-y-3">
            {open.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[15px] text-foreground">{inv.label}</div>
                  <div className="mt-1 text-[12px] text-foreground/60">
                    {formatMoney(inv.amount_remaining_cents, inv.currency)} due
                    {inv.due_at ? ` by ${formatDate(inv.due_at)}` : ""}
                  </div>
                </div>
                {inv.hosted_invoice_url ? (
                  <a
                    href={inv.hosted_invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-foreground px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-background transition hover:opacity-90"
                  >
                    Pay invoice
                  </a>
                ) : (
                  <span className="text-[12px] text-foreground/55">
                    Payment link is being prepared. Contact NorthStar Labs if this persists.
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-4 text-[10px] font-medium uppercase tracking-[0.26em] text-foreground/55">
          History
        </h2>
        {data.invoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            detail="Your invoices appear here as soon as NorthStar Labs issues them."
          />
        ) : (
          <ul className="divide-y divide-foreground/10 border-y border-foreground/10">
            {data.invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <div className="text-[13.5px] text-foreground">{inv.label}</div>
                  <div className="mt-1 text-[11.5px] text-foreground/55">
                    {inv.paid_at
                      ? `Paid ${formatDate(inv.paid_at)}`
                      : inv.due_at
                        ? `Due ${formatDate(inv.due_at)}`
                        : "No due date"}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[13.5px] text-foreground">
                    {formatMoney(inv.amount_cents, inv.currency)}
                  </span>
                  <Pill
                    tone={
                      inv.status === "paid"
                        ? "ok"
                        : inv.status === "open"
                          ? "warn"
                          : inv.status === "uncollectible"
                            ? "danger"
                            : "neutral"
                    }
                  >
                    {inv.status.replaceAll("_", " ")}
                  </Pill>
                  {inv.invoice_pdf_url ? (
                    <a
                      href={inv.invoice_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] underline underline-offset-4 text-foreground/75 hover:text-foreground"
                    >
                      Receipt
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}