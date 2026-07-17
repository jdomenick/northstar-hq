import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { useOrg } from "@/lib/org-context";
import { listWebsiteConnections } from "@/lib/integrations/website.functions";

export const Route = createFileRoute("/_authenticated/settings/integrations")({
  component: IntegrationsIndex,
  head: () => ({
    meta: [
      { title: "Integrations  -  Settings  -  Northstar" },
      { name: "description", content: "Connect websites and applications so SAM can read from them." },
    ],
  }),
});

function IntegrationsIndex() {
  const { activeOrgId } = useOrg();
  const list = useServerFn(listWebsiteConnections);
  const { data, isLoading } = useQuery({
    enabled: !!activeOrgId,
    queryKey: ["website-connections", activeOrgId],
    queryFn: () => list({ data: { organizationId: activeOrgId! } }),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Integrations."
        description="Register the websites SAM should learn from. Nothing runs on a schedule yet, and no operational records are created without your approval."
        actions={
          <Link
            to="/settings/integrations/new"
            className="rounded-md bg-foreground px-3 py-1.5 text-[12px] text-background hover:opacity-90"
          >
            New website
          </Link>
        }
      />
      <PageBody>
        <Section title="Website connections">
          {!activeOrgId || isLoading ? (
            <div className="rounded-xl bg-card/40 p-6 text-[13px] text-muted-foreground">Loading...</div>
          ) : !data || data.length === 0 ? (
            <div className="rounded-xl bg-card/40 p-6 text-[13px] text-muted-foreground">
              No connections yet. Add a website to begin discovering knowledge sources.
            </div>
          ) : (
            <div className="divide-y divide-border/40 overflow-hidden rounded-xl bg-card/40">
              {data.map((c) => (
                <Link
                  key={c.id}
                  to="/settings/integrations/$connectionId"
                  params={{ connectionId: c.id }}
                  className="flex items-center justify-between px-5 py-4 hover:bg-card/70"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] text-foreground">{c.display_name}</div>
                    <div className="mt-1 truncate text-[11.5px] text-muted-foreground">{c.homepage_url ?? " - "}</div>
                  </div>
                  <div className="flex items-center gap-3 text-[11.5px] text-muted-foreground">
                    <span className="rounded-md bg-secondary/60 px-2 py-0.5 uppercase tracking-wider">
                      {c.discovery_status}
                    </span>
                    <span className="rounded-md bg-secondary/60 px-2 py-0.5 uppercase tracking-wider">
                      {c.automation_mode}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Section>
      </PageBody>
    </div>
  );
}