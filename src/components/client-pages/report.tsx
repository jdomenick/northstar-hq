import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ClientWorkspace } from "@/components/client-shell";
import {
  EmptyState,
  LoadingRows,
  Pill,
  WorkspaceError,
  formatDate,
  useClientExecutiveReport,
} from "@/components/client-workspace-ui";
import { formatMoney } from "@/lib/client-workspace/types";
import {
  REPORT_COPY,
  formatMetricPeriod,
  formatMetricValue,
  type ClientExecutiveReportView,
} from "@/lib/reporting/types";
import { getDeliverableUrlFn } from "@/lib/delivery/delivery.functions";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-[10px] font-medium uppercase tracking-[0.26em] text-foreground/55">
      {children}
    </h2>
  );
}

export function ReportBody() {
  const { data, isLoading, isError } = useClientExecutiveReport();

  if (isLoading) return <LoadingRows />;
  if (isError || !data) {
    return <WorkspaceError message="We could not load your executive report. Refresh to try again." />;
  }

  if (!data.has_content) {
    return (
      <div className="space-y-8">
        <h1 className="font-display text-[34px] leading-[1.08] text-foreground">Executive report</h1>
        <EmptyState title="Not available yet" detail={REPORT_COPY.noReport} />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header>
        <div className="text-[10px] font-medium uppercase tracking-[0.26em] text-foreground/55">
          {data.client_name}
        </div>
        <h1 className="mt-3 font-display text-[34px] leading-[1.08] text-foreground">
          Executive report
        </h1>
        {data.published ? (
          <p className="mt-2 text-[11.5px] uppercase tracking-[0.18em] text-foreground/50">
            Version {data.published.version} · Published {formatDate(data.published.created_at)}
          </p>
        ) : null}
      </header>

      <ExecutiveSummary report={data} />
      <BusinessOutcomes report={data} />
      <CurrentEngagement report={data} />
      <RecentActivity report={data} />
      <Deliverables report={data} />
      <BillingSnapshot report={data} />
    </div>
  );
}

function ExecutiveSummary({ report }: { report: ClientExecutiveReportView }) {
  const published = report.published;
  const summary = published?.summary.trim() ?? "";
  return (
    <section>
      <SectionTitle>Executive summary</SectionTitle>
      {summary ? (
        <p className="max-w-2xl whitespace-pre-line text-[15px] leading-[1.75] text-foreground/85">
          {summary}
        </p>
      ) : (
        <p className="text-[13.5px] italic leading-[1.7] text-foreground/60">
          {REPORT_COPY.noSummary}
        </p>
      )}
      {published && published.highlights.length > 0 ? (
        <ul className="mt-5 space-y-2">
          {published.highlights.map((h, i) => (
            <li key={i} className="flex gap-3 text-[14px] leading-[1.7] text-foreground/80">
              <span aria-hidden className="mt-[9px] h-px w-4 shrink-0 bg-foreground/40" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {published && published.business_notes.trim() ? (
        <p className="mt-5 max-w-2xl whitespace-pre-line text-[13.5px] leading-[1.75] text-foreground/70">
          {published.business_notes}
        </p>
      ) : null}
    </section>
  );
}

function BusinessOutcomes({ report }: { report: ClientExecutiveReportView }) {
  return (
    <section>
      <SectionTitle>Business outcomes</SectionTitle>
      {report.outcomes.length === 0 ? (
        <p className="text-[13.5px] italic text-foreground/60">{REPORT_COPY.noMetrics}</p>
      ) : (
        <dl className="grid gap-px border border-foreground/12 bg-foreground/12 sm:grid-cols-3">
          {report.outcomes.map((m) => {
            const period = formatMetricPeriod(m.period_start, m.period_end);
            return (
              <div key={m.id} className="bg-background p-5">
                <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
                  {m.label}
                </dt>
                <dd className="mt-2 font-display text-[26px] leading-none text-foreground">
                  {formatMetricValue(m.value, m.unit)}
                </dd>
                {period ? (
                  <div className="mt-2 text-[11px] text-foreground/50">{period}</div>
                ) : null}
                {m.source_label ? (
                  <div className="mt-1 text-[11px] text-foreground/45">Source: {m.source_label}</div>
                ) : null}
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
}

function CurrentEngagement({ report }: { report: ClientExecutiveReportView }) {
  const e = report.engagement;
  return (
    <section>
      <SectionTitle>Current engagement</SectionTitle>
      {!e ? (
        <p className="text-[13.5px] italic text-foreground/60">{REPORT_COPY.noMetrics}</p>
      ) : (
        <div className="space-y-5">
          <dl className="grid gap-px border border-foreground/12 bg-foreground/12 sm:grid-cols-3">
            <Cell label="Stage" value={e.stage_label} />
            <Cell label="Status" value={e.status_label} />
            <Cell
              label="Implementation progress"
              value={
                e.progress_percent === null
                  ? "Not enough data yet"
                  : `${e.progress_percent}% (${e.progress_complete} of ${e.progress_total})`
              }
            />
          </dl>
          {e.progress_percent !== null ? (
            <div
              className="h-1 w-full bg-foreground/12"
              role="progressbar"
              aria-valuenow={e.progress_percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Implementation progress"
            >
              <div className="h-full bg-foreground" style={{ width: `${e.progress_percent}%` }} />
            </div>
          ) : null}
          <dl className="grid gap-px border border-foreground/12 bg-foreground/12 sm:grid-cols-2">
            <Cell label="Next action for you" value={e.next_client_action ?? "Nothing needed right now"} />
            <Cell
              label="Next action for NorthStar Labs"
              value={e.next_northstar_action ?? "Not published yet"}
            />
          </dl>
        </div>
      )}
    </section>
  );
}

function RecentActivity({ report }: { report: ClientExecutiveReportView }) {
  return (
    <section>
      <SectionTitle>Recent activity</SectionTitle>
      {report.activity.length === 0 ? (
        <p className="text-[13.5px] italic text-foreground/60">{REPORT_COPY.noMetrics}</p>
      ) : (
        <ul className="divide-y divide-foreground/10 border-y border-foreground/10">
          {report.activity.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="text-[13.5px] text-foreground/85">{a.title}</span>
              <span className="text-[11.5px] text-foreground/50">{formatDate(a.occurred_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Deliverables({ report }: { report: ClientExecutiveReportView }) {
  const download = useServerFn(getDeliverableUrlFn);
  return (
    <section>
      <SectionTitle>Deliverables</SectionTitle>
      {report.deliverables.length === 0 ? (
        <p className="text-[13.5px] italic text-foreground/60">{REPORT_COPY.noMetrics}</p>
      ) : (
        <ul className="divide-y divide-foreground/10 border-y border-foreground/10">
          {report.deliverables.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <div className="text-[14px] text-foreground">{d.title}</div>
                <div className="mt-1 text-[11.5px] text-foreground/50">
                  {d.version_label ? `Version ${d.version_label} · ` : ""}
                  {d.shared_at ? `Shared ${formatDate(d.shared_at)}` : "Not shared yet"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Pill tone="neutral">{d.status_label}</Pill>
                {d.has_file ? (
                  <button
                    type="button"
                    className="text-[12px] underline underline-offset-4 text-foreground/75 hover:text-foreground"
                    onClick={async () => {
                      try {
                        const res = await download({ data: { documentId: d.id } });
                        if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
                      } catch {
                        toast.error("We could not open that file. Try again.");
                      }
                    }}
                  >
                    Download
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BillingSnapshot({ report }: { report: ClientExecutiveReportView }) {
  const b = report.billing;
  return (
    <section>
      <SectionTitle>Billing snapshot</SectionTitle>
      <dl className="grid gap-px border border-foreground/12 bg-foreground/12 sm:grid-cols-2">
        <Cell label="Current status" value={b.status_label} />
        <Cell
          label="Outstanding balance"
          value={
            b.invoices.length === 0
              ? REPORT_COPY.noMetrics
              : b.outstanding_cents === 0
                ? "Nothing due"
                : formatMoney(b.outstanding_cents, b.currency)
          }
        />
        <Cell
          label="Last payment"
          value={
            b.last_payment
              ? `${formatMoney(b.last_payment.amount_cents, b.currency)} on ${formatDate(b.last_payment.paid_at)}`
              : "No payments recorded yet"
          }
        />
        <Cell
          label="Next invoice"
          value={
            b.next_invoice
              ? `${b.next_invoice.label}, ${formatMoney(b.next_invoice.amount_cents, b.currency)} due ${formatDate(b.next_invoice.due_at)}`
              : "None scheduled"
          }
        />
      </dl>
      {b.invoices.length > 0 ? (
        <ul className="mt-5 divide-y divide-foreground/10 border-y border-foreground/10">
          {b.invoices.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="text-[13.5px] text-foreground/85">{i.label}</span>
              <span className="flex items-center gap-3 text-[12px] text-foreground/60">
                {formatMoney(i.amount_cents, i.currency)}
                <Pill tone={i.status === "paid" ? "ok" : i.status === "open" ? "warn" : "neutral"}>
                  {i.status}
                </Pill>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-5">
      <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
        {label}
      </dt>
      <dd className="mt-2 break-words text-[14px] leading-[1.6] text-foreground">{value}</dd>
    </div>
  );
}