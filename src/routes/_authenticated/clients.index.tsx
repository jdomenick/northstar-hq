import { createFileRoute } from "@tanstack/react-router";
import { useOrg } from "@/lib/org-context";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { EmptyLine, ListRow, NotAvailable, RowList } from "@/components/command-ui";
import { deriveClientHealth, money, useCommandOverview } from "@/lib/command/hooks";


export const Route = createFileRoute("/_authenticated/clients/")({
  component: ClientsIndex,
  head: () => ({
    meta: [
      { title: "Clients | NorthStar Command" },
      {
        name: "description",
        content: "Every NorthStar client with a unified workspace covering acquisition through revenue.",
      },
      { property: "og:title", content: "Clients | NorthStar Command" },
      {
        property: "og:description",
        content: "Every NorthStar client with a unified workspace covering acquisition through revenue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ClientsIndex() {
  const { activeOrgId } = useOrg();
  const q = useCommandOverview(activeOrgId);

  if (!activeOrgId) return <PageBody>Select an organization.</PageBody>;

  return (
    <>
      <PageHeader
        eyebrow="Command"
        title="Clients"
        description="One workspace per client. Modules are reached from inside the client, not alongside it."
      />
      <PageBody>
        <Section title="All clients" hint="Status, active modules, current issue, last activity">
          {q.isLoading || !q.data ? (
            <EmptyLine>Loading clients…</EmptyLine>
          ) : q.isError ? (
            <NotAvailable reason="Client records could not be read. Refresh to try again." />
          ) : q.data.clients.status !== "ok" ? (
            <NotAvailable reason={q.data.clients.reason ?? "Client records are unavailable."} />
          ) : (
            (() => {
              const health = deriveClientHealth(q.data);
              if (health.length === 0) return <EmptyLine>No clients on record yet.</EmptyLine>;
              return (
                <RowList>
                  {health.map((c) => (
                    <ListRow
                      key={c.id}
                      title={c.name}

                      meta={[
                        c.status,
                        c.modules.length ? c.modules.join(", ") : "No module records",
                        c.issue ?? "Nothing outstanding",
                        c.lastActivityAt
                          ? `last activity ${new Date(c.lastActivityAt).toLocaleDateString()}`
                          : "no recorded activity",
                      ].join(" · ")}
                      to={`/clients/${c.id}`}
                      right={c.mrrCents ? `${money(c.mrrCents)} MRR` : "Workspace"}
                    />
                  ))}
                </RowList>
              );
            })()
          )}
        </Section>

      </PageBody>
    </>
  );
}
