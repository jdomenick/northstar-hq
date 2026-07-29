import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { CLIENT_SAFE_UNAVAILABLE } from "@/lib/proposals/client-billing";
import {
  BillingPanel,
  NextStepPanel,
  SectionHeading,
  fetchProposalStatus,
  type PublicPayload,
} from "@/components/proposal-public";

export const Route = createFileRoute("/proposal/$token/payment-return")({
  component: PaymentReturnPage,
  head: () => ({
    meta: [
      { title: "Payment status  -  NorthStar Labs" },
      { name: "description", content: "Confirm the status of your NorthStar Labs payment." },
      { property: "og:title", content: "Payment status  -  NorthStar Labs" },
      { property: "og:description", content: "Confirm the status of your NorthStar Labs payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function PaymentReturnPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [payload, setPayload] = useState<PublicPayload | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setPayload(await fetchProposalStatus(token));
      setState("ready");
    } catch {
      setState("unavailable");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "loading") {
    return <div className="mx-auto max-w-2xl p-10 text-sm text-foreground/60">Checking payment status…</div>;
  }
  if (state === "unavailable" || !payload) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <h1 className="font-display text-3xl">Payment status unavailable</h1>
        <p className="mt-3 text-sm text-foreground/70">{CLIENT_SAFE_UNAVAILABLE}</p>
      </div>
    );
  }

  // Reconciled state only. Query parameters are never treated as proof of payment.
  const anyPaid = payload.billing.invoices.some((i) => i.status === "paid" || i.status === "partially_refunded");
  const anyOpen = payload.billing.invoices.some((i) => i.status === "open");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-12">
        <h1 className="font-display text-3xl">Payment status</h1>

        {anyPaid && !anyOpen ? (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-4 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Payment received. Thank you.
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-4 text-sm text-foreground/80">
            <Clock className="h-4 w-4" /> Payment is still processing. This page updates once your bank and Stripe
            confirm the payment.
          </div>
        )}

        <section>
          <SectionHeading>Invoices</SectionHeading>
          <BillingPanel billing={payload.billing} />
        </section>

        <NextStepPanel step={payload.next_step} contactEmail={payload.contact_email} />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await load();
              setBusy(false);
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Link to="/proposal/$token" params={{ token }}>
            <Button size="sm" variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to your proposal
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
