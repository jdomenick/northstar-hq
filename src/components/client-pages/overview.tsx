import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClientWorkspace } from "@/components/client-shell";
import { roleLabel } from "@/lib/client-identity/types";
import {
  EmptyState,
  LoadingRows,
  Pill,
  WorkspaceError,
  formatDate,
  useClientWorkspace,
} from "@/components/client-workspace-ui";
import { formatMoney, onboardingProgress } from "@/lib/client-workspace/types";
import { getClientDeliveryFn } from "@/lib/delivery/delivery.functions";
import type { ClientDeliveryView } from "@/lib/delivery/client-delivery";

export function Overview({
  companyName,
  role,
  email,
}: {
  companyName: string;
  role: string;
  email: string;
}) {
  const { data, isLoading, isError } = useClientWorkspace();
  const loadDelivery = useServerFn(getClientDeliveryFn);
  const delivery = useQuery<ClientDeliveryView>({
    queryKey: ["client-delivery"],
    queryFn: () => loadDelivery(),
    retry: false,
  });

  if (isLoading) return <LoadingRows />;
  if (isError || !data) {
    return <WorkspaceError message="We could not load your workspace. Refresh to try again." />;
  }

  const progress = onboardingProgress(data.onboarding);
  const openInvoice = data.invoices.find((i) => i.status === "open");
  const actionTo =
    data.next_step.action === "pay"
      ? "/client/billing"
      : data.next_step.action === "documents"
        ? "/client/documents"
        : data.next_step.action === "onboarding"
          ? "/client/onboarding"
          : null;
  const deliveryValue = delivery.isLoading
    ? "Loading"
    : !delivery.data?.project
      ? "Not started"
      : delivery.data.progress.percent === null
        ? delivery.data.project.stage_label
        : `${delivery.data.progress.complete} of ${delivery.data.progress.total} milestones`;

  return (
    <div className="space-y-10">
      <section>
        <div className="text-[10px] font-medium uppercase tracking-[0.26em] text-foreground/55">
          {data.stage_label}
        </div>
        <h1 className="mt-3 font-display text-[34px] leading-[1.08] text-foreground">
          {data.next_step.headline}
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-[1.75] text-foreground/75">
          {data.next_step.detail}
        </p>
        {actionTo ? (
          <Link
            to={actionTo}
            className="mt-6 inline-block bg-foreground px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] text-background transition hover:opacity-90"
          >
            {data.next_step.action === "pay" ? "Review payment" : "Continue onboarding"}
          </Link>
        ) : null}
      </section>

      <dl className="grid gap-px border border-foreground/12 bg-foreground/12 sm:grid-cols-3">
        <Cell
          label="Onboarding"
          value={
            data.onboarding.length === 0
              ? "Not assigned yet"
              : `${progress.done} of ${progress.total} complete`
          }
        />
        <Cell
          label="Balance due"
          value={
            openInvoice
              ? formatMoney(openInvoice.amount_remaining_cents, openInvoice.currency)
              : "Nothing due"
          }
        />
        <Cell label="Implementation" value={deliveryValue} />
      </dl>

      {delivery.data?.project ? (
        <section className="border border-foreground/12 p-5">
          <div className="text-[10px] font-medium uppercase tracking-[0.26em] text-foreground/55">
            Delivery
          </div>
          <h2 className="mt-3 font-display text-[20px] leading-tight text-foreground">
            {delivery.data.next_step.headline}
          </h2>
          <p className="mt-2 text-[13.5px] leading-[1.7] text-foreground/70">
            {delivery.data.next_step.detail}
          </p>
          <Link
            to="/client/delivery"
            className="mt-4 inline-block text-[12px] underline underline-offset-4 text-foreground/75 hover:text-foreground"
          >
            View delivery status
          </Link>
        </section>
      ) : null}

      {data.notices.length > 0 ? (
        <section>
          <h2 className="mb-4 text-[10px] font-medium uppercase tracking-[0.26em] text-foreground/55">
            Needs your attention
          </h2>
          <ul className="space-y-3">
            {data.notices.slice(0, 4).map((n) => (
              <li key={n.id} className="border border-foreground/12 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[14px] text-foreground">{n.title}</span>
                  <Pill tone="warn">{formatDate(n.occurred_at)}</Pill>
                </div>
                {n.body ? (
                  <p className="mt-2 text-[13px] leading-[1.7] text-foreground/70">{n.body}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-4 text-[10px] font-medium uppercase tracking-[0.26em] text-foreground/55">
          Recent activity
        </h2>
        {data.events.length === 0 ? (
          <EmptyState
            title="No activity yet"
            detail="Payments, approvals, and document updates will appear here as they happen."
          />
        ) : (
          <ul className="divide-y divide-foreground/10 border-y border-foreground/10">
            {data.events.slice(0, 8).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="text-[13.5px] text-foreground/85">{e.title}</span>
                <span className="text-[11.5px] text-foreground/50">{formatDate(e.occurred_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <dl className="grid gap-px border border-foreground/12 bg-foreground/12 sm:grid-cols-3">
        <Cell label="Company" value={companyName} />
        <Cell label="Your access" value={role} />
        <Cell label="Signed in as" value={email} />
      </dl>

      <p className="text-[12.5px] leading-[1.7] text-foreground/60">
        Only your own company information is visible here. If something looks wrong, contact your
        NorthStar Labs representative.
      </p>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-5">
      <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
        {label}
      </dt>
      <dd className="mt-2 break-words text-[14px] text-foreground">{value}</dd>
    </div>
  );
}