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
import {
  MODULE_ADAPTERS,
  deriveClientHealth,
  money,
  useCommandOverview,
} from "@/lib/command/hooks";


export const Route = createFileRoute("/_authenticated/command")({
  component: CommandPage,
  head: () => ({
    meta: [
      { title: "Command | NorthStar" },
      {
        name: "description",
        content:
          "The primary internal NorthStar operating view across clients, modules, agents, alerts, approvals, and revenue.",
      },
      { property: "og:title", content: "Command | NorthStar" },
      {
        property: "og:description",
        content:
          "The primary internal NorthStar operating view across clients, modules, agents, alerts, approvals, and revenue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

/** Product surfaces that live inside this Command Center. */
const INTERNAL_MODULES: { name: string; to: string; purpose: string }[] = [
  { name: "SAM", to: "/sam", purpose: "Reasoning, missions, memory" },
  { name: "Content Ops", to: "/sam/content", purpose: "Planning, approvals, publishing" },
  { name: "Integrations", to: "/sam/integrations", purpose: "Provider connections and health" },
  { name: "Proposals", to: "/labs/proposals", purpose: "Commercial documents" },
  { name: "Billing", to: "/labs/billing", purpose: "Invoices and payments" },
  { name: "Delivery", to: "/labs/projects", purpose: "Projects and milestones" },
  { name: "Assessments", to: "/labs/assessments", purpose: "Inbound assessment requests" },
];

/** Standalone NorthStar apps that stay independently operated. */
const EXTERNAL_APPS = ["CAM", "CCM", "CRM"];

function CommandPage() {
  const { activeOrgId, activeMembership } = useOrg();
  const q = useCommandOverview(activeOrgId);

  if (!activeOrgId) {
    return <PageBody>Select an organization to open Command.</PageBody>;
  }

  if (q.isLoading || !q.data) {
    return (
      <>
        <PageHeader eyebrow="NorthStar" title="Command" description="Loading live operating data." />
        <PageBody>
          <EmptyLine>Loading Command…</EmptyLine>
        </PageBody>
      </>
    );
  }

  if (q.isError) {
    return (
      <>
        <PageHeader eyebrow="NorthStar" title="Command" />
        <PageBody>
          <NotAvailable reason="Command could not read your operating data. Refresh to try again." />
        </PageBody>
      </>
    );
  }

  const d = q.data;
  const health = deriveClientHealth(d);
  const clients = d.clients.data ?? [];

  const activeClients = clients.filter((c) => c.status === "active");
  const invoices = d.invoices.data ?? [];
  const openInvoices = invoices.filter((i) => i.status === "open");
  const outstanding = openInvoices.reduce(
    (n, i) => n + (i.amount_cents - i.amount_paid_cents),
    0,
  );
  const paidCents = invoices
    .filter((i) => i.paid_at)
    .reduce((n, i) => n + i.amount_paid_cents, 0);
  const mrr = activeClients.reduce((n, c) => n + (c.mrr_cents ?? 0), 0);
  const jobs = d.jobs24h.data ?? [];
  const failedJobs = jobs.filter((j) => j.status === "failed");
  const runningJobs = jobs.filter((j) => j.status === "running" || j.status === "queued");
  const connections = d.connections.data ?? [];
  const brokenConnections = connections.filter(
    (c) => c.status === "error" || Boolean(c.last_error_at),
  );
  const approvals = (d.approvals.data ?? []).filter(
    (t) => t.requires_approval && !t.approved_at,
  );
  const leads = d.leads.data ?? [];
  const newLeads = leads.filter((l) => l.status === "new");
  const missions = (d.missions.data ?? []).filter(
    (m) => m.status !== "completed" && m.status !== "cancelled",
  );
  const clientActions = (d.milestones.data ?? []).filter(
    (m) => m.requires_client_action && m.status !== "complete",
  );
  const now = Date.now();
  const pastDue = openInvoices.filter(
    (i) => i.due_at && new Date(i.due_at).getTime() < now,
  );

  const attention: { label: string; detail: string; to: string }[] = [];
  if (brokenConnections.length)
    attention.push({
      label: `${brokenConnections.length} integration${brokenConnections.length === 1 ? "" : "s"} reporting errors`,
      detail: brokenConnections.map((c) => c.display_name || c.provider).slice(0, 3).join(", "),
      to: "/sam/integrations",
    });
  if (failedJobs.length)
    attention.push({
      label: `${failedJobs.length} workflow failure${failedJobs.length === 1 ? "" : "s"} in 24h`,
      detail: failedJobs.map((j) => j.error_code ?? j.job_type).slice(0, 3).join(", "),
      to: "/sam/control",
    });
  if (approvals.length)
    attention.push({
      label: `${approvals.length} approval${approvals.length === 1 ? "" : "s"} waiting`,
      detail: approvals.map((t) => t.title).slice(0, 3).join(", "),
      to: "/labs/mission-control",
    });
  if (newLeads.length)
    attention.push({
      label: `${newLeads.length} new lead${newLeads.length === 1 ? "" : "s"} unreviewed`,
      detail: newLeads.map((l) => l.company || l.full_name).slice(0, 3).join(", "),
      to: "/labs/assessments",
    });
  if (pastDue.length)
    attention.push({
      label: `${pastDue.length} invoice${pastDue.length === 1 ? "" : "s"} past due`,
      detail: money(
        pastDue.reduce((n, i) => n + (i.amount_cents - i.amount_paid_cents), 0),
      ),
      to: "/labs/billing",
    });

  return (
    <>
      <PageHeader
        eyebrow="NorthStar"
        title="Command"
        description={`Primary operating view for ${activeMembership?.organizations?.name ?? "NorthStar"}. Everything below is read from connected systems only.`}
        actions={<DrillLink to="/clients">All clients</DrillLink>}
      />
      <PageBody>
        <Section title="Now" hint="Live counts across connected systems">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Active clients"
              value={d.clients.status === "ok" ? String(activeClients.length) : "Unavailable"}
              hint={d.clients.status === "ok" ? `${clients.length} total on record` : undefined}
              tone={d.clients.status === "ok" ? "default" : "muted"}
            />
            <StatTile
              label="Recurring revenue"
              value={d.clients.status === "ok" ? money(mrr) : "Unavailable"}
              hint="Sum of active client MRR"
              tone={d.clients.status === "ok" ? "default" : "muted"}
            />
            <StatTile
              label="Outstanding"
              value={d.invoices.status === "ok" ? money(outstanding) : "Unavailable"}
              hint={d.invoices.status === "ok" ? `${money(paidCents)} collected to date` : undefined}
              tone={outstanding > 0 ? "warn" : "default"}
            />
            <StatTile
              label="Needs attention"
              value={String(attention.length)}
              hint="Items below require an operator decision"
              tone={attention.length > 0 ? "warn" : "default"}
            />
          </div>
        </Section>

        <Section title="Requires attention" hint="Alerts, failures, approvals, unreviewed demand">
          {attention.length === 0 ? (
            <EmptyLine>Nothing is waiting on you across connected systems.</EmptyLine>
          ) : (
            <RowList>
              {attention.map((a) => (
                <ListRow key={a.label} title={a.label} meta={a.detail} to={a.to} right="Open" />
              ))}
            </RowList>
          )}
        </Section>

        <Section
          title="Client health"
          hint="Modules holding records, current issue, last meaningful activity"
          action={<DrillLink to="/clients">View all</DrillLink>}
        >
          {d.clients.status !== "ok" ? (
            <NotAvailable reason={d.clients.reason ?? "Client records are unavailable."} />
          ) : health.length === 0 ? (
            <EmptyLine>No clients on record yet.</EmptyLine>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12.5px]">
                <thead className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="py-2 pr-4 font-medium">Client</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Modules</th>
                    <th className="py-2 pr-4 font-medium">Current issue</th>
                    <th className="py-2 pr-4 font-medium">Last activity</th>
                    <th className="py-2 font-medium">MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {health.slice(0, 12).map((c) => (
                    <tr key={c.id} className="border-b border-border/40 last:border-0">
                      <td className="py-2.5 pr-4">
                        <Link
                          to="/clients/$clientId"
                          params={{ clientId: c.id }}
                          className="text-foreground underline-offset-4 hover:underline"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{c.status}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {c.modules.length ? c.modules.join(", ") : "No module records"}
                      </td>
                      <td
                        className={
                          c.issue ? "py-2.5 pr-4 text-foreground" : "py-2.5 pr-4 text-muted-foreground"
                        }
                      >
                        {c.issue ?? "Nothing outstanding"}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {c.lastActivityAt
                          ? `${new Date(c.lastActivityAt).toLocaleDateString()}${c.lastActivityLabel ? ` · ${c.lastActivityLabel}` : ""}`
                          : "No recorded activity"}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {c.mrrCents ? money(c.mrrCents) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section
          title="Approvals and decisions"
          hint="Operator tasks explicitly waiting on a decision"
          action={<DrillLink to="/labs/mission-control">Mission Control</DrillLink>}
        >
          {d.approvals.status !== "ok" ? (
            <NotAvailable reason={d.approvals.reason ?? "Approvals are unavailable."} />
          ) : approvals.length === 0 ? (
            <EmptyLine>No approvals are waiting.</EmptyLine>
          ) : (
            <RowList>
              {approvals.slice(0, 8).map((t) => (
                <ListRow
                  key={t.id}
                  title={t.title}
                  meta={`${t.kind} · ${t.status}${t.due_at ? ` · due ${new Date(t.due_at).toLocaleDateString()}` : ""}`}
                  right={t.priority}
                />
              ))}
            </RowList>
          )}
        </Section>


        <Section title="Modules" hint="Product surfaces operated from Command">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INTERNAL_MODULES.map((m) => (
              <Link
                key={m.to}
                to={m.to}
                className="rounded-lg border border-border/70 bg-card/50 p-4 hover:border-primary/50"
              >
                <div className="text-[13px] text-foreground">{m.name}</div>
                <div className="mt-1 text-[11.5px] text-muted-foreground">{m.purpose}</div>
              </Link>
            ))}
          </div>
          <div className="mt-4">
            <NotAvailable
              reason={`Standalone apps (${EXTERNAL_APPS.join(", ")}) run independently and do not report data into Command. Their status is not shown here until a data source is connected.`}
            />
          </div>
        </Section>

        <Section
          title="Agents and automations"
          hint="Last 24 hours"
          action={<DrillLink to="/sam/control">SAM control</DrillLink>}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
              label="Jobs running or queued"
              value={d.jobs24h.status === "ok" ? String(runningJobs.length) : "Unavailable"}
            />
            <StatTile
              label="Failures 24h"
              value={d.jobs24h.status === "ok" ? String(failedJobs.length) : "Unavailable"}
              tone={failedJobs.length ? "warn" : "default"}
            />
            <StatTile
              label="Open SAM missions"
              value={d.missions.status === "ok" ? String(missions.length) : "Unavailable"}
            />
          </div>
          <div className="mt-4">
            <SourceView source={d.missions} empty="No SAM missions yet.">
              {(rows) => (
                <RowList>
                  {rows.slice(0, 5).map((m) => (
                    <ListRow
                      key={m.id}
                      title={m.title}
                      meta={`${m.status} · priority ${m.priority}`}
                      to={`/sam/missions/${m.id}`}
                      right="Open"
                    />
                  ))}
                </RowList>
              )}
            </SourceView>
          </div>
        </Section>

        <Section
          title="Demand"
          hint="Leads, conversations, appointments"
          action={<DrillLink to="/labs/assessments">Assessments</DrillLink>}
        >
          <div className="space-y-4">
            <SourceView source={d.leads} empty="No assessment requests yet.">
              {(rows) => (
                <RowList>
                  {rows.slice(0, 6).map((l) => (
                    <ListRow
                      key={l.id}
                      title={l.company || l.full_name}
                      meta={`${l.status} · ${new Date(l.created_at).toLocaleDateString()}`}
                      to={`/labs/assessment/${l.id}`}
                      right="Review"
                    />
                  ))}
                </RowList>
              )}
            </SourceView>
            <NotAvailable reason={d.conversations.reason ?? "Not connected."} />
            <NotAvailable reason={d.appointments.reason ?? "Not connected."} />
          </div>
        </Section>

        <Section
          title="Sales and revenue"
          hint="From billing records only"
          action={<DrillLink to="/labs/billing">Billing</DrillLink>}
        >
          <SourceView source={d.invoices} empty="No invoices issued yet.">
            {(rows) => (
              <RowList>
                {rows.slice(0, 6).map((i) => (
                  <ListRow
                    key={i.id}
                    title={money(i.amount_cents, i.currency)}
                    meta={`${i.status}${i.due_at ? ` · due ${new Date(i.due_at).toLocaleDateString()}` : ""}`}
                    to={i.client_id ? `/clients/${i.client_id}` : undefined}
                    right={i.paid_at ? "Paid" : money(i.amount_cents - i.amount_paid_cents, i.currency)}
                  />
                ))}
              </RowList>
            )}
          </SourceView>
        </Section>

        <Section title="Client actions outstanding" hint="Delivery milestones waiting on clients">
          {d.milestones.status !== "ok" ? (
            <NotAvailable reason={d.milestones.reason ?? "Not connected."} />
          ) : clientActions.length === 0 ? (
            <EmptyLine>No milestones are waiting on a client.</EmptyLine>
          ) : (
            <RowList>
              {clientActions.slice(0, 8).map((m) => (
                <ListRow
                  key={m.id}
                  title={m.title}
                  meta={m.target_date ? `target ${new Date(m.target_date).toLocaleDateString()}` : m.status}
                  to={m.client_id ? `/clients/${m.client_id}` : undefined}
                  right="Workspace"
                />
              ))}
            </RowList>
          )}
        </Section>
      </PageBody>
    </>
  );
}
