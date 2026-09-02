import { createFileRoute, Link } from "@tanstack/react-router";
import { useOrg } from "@/lib/org-context";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import {
  DrillLink,
  EmptyLine,
  ListRow,
  NotAvailable,
  RowList,
  SourceView,
  StatTile,
} from "@/components/command-ui";
import { money, useClientOutcomeChain } from "@/lib/command/hooks";
import { useModuleDashboard } from "@/lib/command/module-hooks";
import { StatusChip } from "@/components/command/source-state";
import { ClientDeploymentPanel } from "@/components/command/client-deployment-panel";
import {
  MODULE_KEYS,
  MODULE_LABELS,
  formatCents,
  formatCount,
  type ModuleDashboard,
} from "@/lib/module-reporting/types";

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  component: ClientWorkspacePage,
  head: () => ({
    meta: [
      { title: "Client workspace | NorthStar Command" },
      {
        name: "description",
        content:
          "Unified client workspace: acquisition, leads, conversations, appointments, sales, revenue, delivery, and recommendations.",
      },
      { property: "og:title", content: "Client workspace | NorthStar Command" },
      {
        property: "og:description",
        content:
          "Unified client workspace: acquisition, leads, conversations, appointments, sales, revenue, delivery, and recommendations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ClientWorkspacePage() {
  const { clientId } = Route.useParams();
  const { activeOrgId } = useOrg();
  const q = useClientOutcomeChain(activeOrgId, clientId);
  // Read-through reporting from CAM, CCM, NorthStar CRM and SAM Core.
  const modulesQ = useModuleDashboard(activeOrgId, clientId, "30d");

  if (!activeOrgId) return <PageBody>Select an organization.</PageBody>;
  if (q.isLoading || !q.data) {
    return (
      <PageBody>
        <EmptyLine>Loading client workspace…</EmptyLine>
      </PageBody>
    );
  }
  if (q.isError || !q.data.client) {
    return (
      <PageBody>
        <NotAvailable reason="This client could not be read in the active organization." />
      </PageBody>
    );
  }

  const d = q.data;
  const client = d.client;
  if (!client) return null;
  const invoices = d.revenue.data ?? [];
  const collected = invoices.reduce((n, i) => n + i.amount_paid_cents, 0);
  const outstanding = invoices
    .filter((i) => i.status === "open")
    .reduce((n, i) => n + (i.amount_cents - i.amount_paid_cents), 0);
  const deals = d.leads.data ?? [];
  const proposals = d.sales.data ?? [];
  const accepted = proposals.filter((p) => p.accepted_at);
  const milestones = d.delivery.data ?? [];
  const doneMilestones = milestones.filter((m) => m.status === "complete");

  return (
    <>
      <PageHeader
        eyebrow="Client workspace"
        title={client.name}
        description={`Status ${client.status}. Outcome chain: acquisition, leads, conversations, appointments, sales, revenue.`}
        actions={
          <div className="flex flex-wrap items-center gap-4">
            <DrillLink to="/clients">All clients</DrillLink>
            <DrillLink to={`/labs/clients/${client.id}/workspace`}>Client admin</DrillLink>
          </div>
        }
      />
      <PageBody>
        <Section title="Outcome chain" hint="Only stages with a connected system of record report numbers">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile
              label="Acquisition"
              value={
                d.acquisition.status === "ok"
                  ? d.acquisition.data && d.acquisition.data.length > 0
                    ? (d.acquisition.data[0].company || d.acquisition.data[0].full_name)
                    : "No inbound record"
                  : "Unavailable"
              }
              hint="Source of this client"
            />
            <StatTile
              label="Leads"
              value={d.leads.status === "ok" ? String(deals.length) : "Unavailable"}
              hint="Pipeline records for this client"
            />
            <StatTile label="Conversations" value="Not connected" tone="muted" />
            <StatTile label="Appointments" value="Not connected" tone="muted" />
            <StatTile
              label="Sales"
              value={d.sales.status === "ok" ? `${accepted.length} of ${proposals.length}` : "Unavailable"}
              hint="Proposals accepted"
            />
            <StatTile
              label="Revenue"
              value={d.revenue.status === "ok" ? money(collected) : "Unavailable"}
              hint={d.revenue.status === "ok" ? `${money(outstanding)} outstanding` : undefined}
              tone={outstanding > 0 ? "warn" : "default"}
            />
          </div>
        </Section>

        {activeOrgId && (
          <ClientDeploymentPanel organizationId={activeOrgId} northstarClientId={client.id} />
        )}

        <Section title="Acquisition" hint="Where this client came from">
          <SourceView source={d.acquisition} empty="No inbound assessment request is linked to this client.">
            {(rows) => (
              <RowList>
                {rows.map((r) => (
                  <ListRow
                    key={r.id}
                    title={r.company || r.full_name}
                    meta={`${r.status} · ${new Date(r.created_at).toLocaleDateString()}`}
                    to={`/labs/assessment/${r.id}`}
                    right="Open request"
                  />
                ))}
              </RowList>
            )}
          </SourceView>
        </Section>

        <Section title="Pipeline" action={<DrillLink to="/labs/revenue">Revenue module</DrillLink>}>
          <SourceView source={d.leads} empty="No pipeline records for this client.">
            {(rows) => (
              <RowList>
                {rows.map((r) => (
                  <ListRow
                    key={r.id}
                    title={r.name}
                    meta={`${r.stage}${r.source ? ` · ${r.source}` : ""}${r.next_action ? ` · next: ${r.next_action}` : ""}`}
                    right={r.value_cents ? money(r.value_cents) : undefined}
                  />
                ))}
              </RowList>
            )}
          </SourceView>
        </Section>

        <Section title="Communications" hint="Calls, messages, appointments">
          <div className="space-y-4">
            <NotAvailable reason={d.conversations.reason ?? "Not connected."} />
            <NotAvailable reason={d.appointments.reason ?? "Not connected."} />
          </div>
        </Section>

        <Section title="Sales" action={<DrillLink to="/labs/proposals">Proposals module</DrillLink>}>
          <SourceView source={d.sales} empty="No proposals for this client.">
            {(rows) => (
              <RowList>
                {rows.map((p) => (
                  <ListRow
                    key={p.id}
                    title={p.title}
                    meta={`${p.status}${p.sent_at ? ` · sent ${new Date(p.sent_at).toLocaleDateString()}` : ""}`}
                    to={`/labs/proposals/${p.id}`}
                    right={p.total_value_cents ? money(p.total_value_cents) : undefined}
                  />
                ))}
              </RowList>
            )}
          </SourceView>
        </Section>

        <Section title="Revenue" action={<DrillLink to="/labs/billing">Billing module</DrillLink>}>
          <SourceView source={d.revenue} empty="No invoices for this client.">
            {(rows) => (
              <RowList>
                {rows.map((i) => (
                  <ListRow
                    key={i.id}
                    title={money(i.amount_cents, i.currency)}
                    meta={`${i.status}${i.due_at ? ` · due ${new Date(i.due_at).toLocaleDateString()}` : ""}`}
                    right={i.paid_at ? "Paid" : money(i.amount_cents - i.amount_paid_cents, i.currency)}
                  />
                ))}
              </RowList>
            )}
          </SourceView>
        </Section>

        <Section
          title="Delivery"
          hint={
            d.delivery.status === "ok" && milestones.length > 0
              ? `${doneMilestones.length} of ${milestones.length} milestones complete`
              : undefined
          }
          action={<DrillLink to="/labs/projects">Projects module</DrillLink>}
        >
          <SourceView source={d.delivery} empty="No delivery milestones defined yet.">
            {(rows) => (
              <RowList>
                {rows.map((m) => (
                  <ListRow
                    key={m.id}
                    title={m.title}
                    meta={`${m.status}${m.target_date ? ` · target ${new Date(m.target_date).toLocaleDateString()}` : ""}`}
                    right={m.requires_client_action ? "Client action" : undefined}
                  />
                ))}
              </RowList>
            )}
          </SourceView>
        </Section>

        <Section title="Automation activity" hint="Most recent organization jobs" action={<DrillLink to="/sam/control">SAM control</DrillLink>}>
          <SourceView source={d.automation} empty="No automation jobs recorded.">
            {(rows) => (
              <RowList>
                {rows.map((j) => (
                  <ListRow
                    key={j.id}
                    title={j.job_type}
                    meta={`${j.status}${j.error_code ? ` · ${j.error_code}` : ""} · ${new Date(j.created_at).toLocaleDateString()}`}
                  />
                ))}
              </RowList>
            )}
          </SourceView>
        </Section>

        <Section title="Client access">
          <SourceView source={d.accounts} empty="No client logins have been invited yet.">
            {(rows) => (
              <RowList>
                {rows.map((a) => (
                  <ListRow
                    key={a.id}
                    title={a.email}
                    meta={`${a.role} · ${a.status}`}
                    right={a.last_login_at ? `last login ${new Date(a.last_login_at).toLocaleDateString()}` : "never signed in"}
                  />
                ))}
              </RowList>
            )}
          </SourceView>
        </Section>

        <Section title="Activity">
          <SourceView source={d.events} empty="No client-visible activity yet.">
            {(rows) => (
              <RowList>
                {rows.map((e) => (
                  <ListRow
                    key={e.id}
                    title={e.title}
                    meta={e.event_type}
                    right={new Date(e.occurred_at).toLocaleDateString()}
                  />
                ))}
              </RowList>
            )}
          </SourceView>
        </Section>

        <Section
          title="Module reporting"
          hint="Live read-through from CAM, CCM, NorthStar CRM and SAM Core, last 30 days"
        >
          {modulesQ.isLoading ? (
            <EmptyLine>Reading connected modules…</EmptyLine>
          ) : modulesQ.isError || !modulesQ.data ? (
            <NotAvailable reason="Module reporting could not be read right now." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {MODULE_KEYS.map((key) => {
                const source = modulesQ.data.dashboard[key];
                return (
                  <div
                    key={key}
                    className="rounded-[7px] border border-border/70 bg-card/40 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        {MODULE_LABELS[key]}
                      </span>
                      <StatusChip status={source.status} />
                    </div>
                    {source.status === "ok" ? (
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                        {moduleMetrics(modulesQ.data.dashboard, key).map((m) => (
                          <div key={m.label} className="flex items-baseline justify-between gap-2">
                            <dt className="truncate text-muted-foreground">{m.label}</dt>
                            <dd className="tabular-nums text-foreground">{m.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-[12px] text-muted-foreground">
                        {source.reason ?? "No data reported."}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-[12.5px] text-muted-foreground">
            Organization-level intelligence lives in{" "}
            <Link to="/labs" className="underline underline-offset-4 hover:text-foreground">
              The Brief
            </Link>
            .
          </p>
        </Section>
      </PageBody>
    </>
  );
}

type Metric = { label: string; value: string };

/** Only values the module actually reported are shown. Nulls read as "n/a". */
function moduleMetrics(dashboard: ModuleDashboard, key: (typeof MODULE_KEYS)[number]): Metric[] {
  const na = (v: string | null) => v ?? "n/a";
  if (key === "cam") {
    const r = dashboard.cam.data;
    if (!r) return [];
    return [
      { label: "Leads", value: na(formatCount(r.leads)) },
      { label: "Qualified", value: na(formatCount(r.qualifiedLeads)) },
      { label: "Appointments", value: na(formatCount(r.appointments)) },
      { label: "Revenue", value: na(formatCents(r.revenueCents)) },
    ];
  }
  if (key === "ccm") {
    const r = dashboard.ccm.data;
    if (!r) return [];
    return [
      { label: "Conversations", value: na(formatCount(r.conversations)) },
      { label: "Appointments", value: na(formatCount(r.appointments)) },
      {
        label: "Avg response",
        value: r.avgResponseSeconds === null ? "n/a" : `${Math.round(r.avgResponseSeconds)}s`,
      },
      { label: "Booking failures", value: na(formatCount(r.bookingFailures)) },
    ];
  }
  if (key === "crm") {
    const r = dashboard.crm.data;
    if (!r) return [];
    return [
      { label: "Customers", value: na(formatCount(r.customers)) },
      { label: "Open deals", value: na(formatCount(r.openDeals)) },
      { label: "Pipeline", value: na(formatCents(r.pipelineValueCents)) },
      { label: "Won in range", value: na(formatCount(r.wonInRange)) },
    ];
  }
  const r = dashboard.sam.data;
  if (!r) return [];
  return [
    { label: "Status", value: r.status ?? "n/a" },
    { label: "Consumers", value: na(formatCount(r.consumers)) },
    { label: "Tasks", value: na(formatCount(r.tasksProcessed)) },
    {
      label: "Success rate",
      value: r.successRatePct === null ? "n/a" : `${r.successRatePct.toFixed(1)}%`,
    },
  ];
}
