import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ventures } from "@/lib/northstar-data";

export const Route = createFileRoute("/ventures/$id")({
  component: VentureDetail,
  loader: ({ params }) => {
    const v = ventures.find((x) => x.id === params.id);
    if (!v) throw notFound();
    return v;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.name} — Northstar` : "Venture — Northstar" },
      { name: "description", content: loaderData?.description ?? "" },
    ],
  }),
  notFoundComponent: () => (
    <PageBody>
      <p className="text-muted-foreground">Venture not found.</p>
    </PageBody>
  ),
  errorComponent: ({ error }) => (
    <PageBody>
      <p className="text-muted-foreground">Something went wrong: {error.message}</p>
    </PageBody>
  ),
});

function VentureDetail() {
  const v = Route.useLoaderData();

  return (
    <div>
      <div className="border-b border-border/60 px-4 pt-6 md:px-10">
        <div className="mx-auto max-w-6xl">
          <Link
            to="/ventures"
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Ventures
          </Link>
        </div>
      </div>
      <PageHeader
        eyebrow={v.status}
        title={v.name}
        description={v.description}
      />
      <PageBody>
        <Tabs defaultValue="overview">
          <TabsList className="mb-8 h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {["overview", "projects", "goals", "decisions", "knowledge", "activity", "metrics", "settings"].map(
              (t) => (
                <TabsTrigger
                  key={t}
                  value={t}
                  className="rounded-md border border-transparent bg-transparent px-3 py-1.5 text-[12px] capitalize text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  {t}
                </TabsTrigger>
              ),
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-10">
            <Section title="Current focus">
              <p className="text-[15px] text-foreground/90">{v.focus}</p>
            </Section>
            <Section title="Priorities">
              <ul className="divide-y divide-border rounded-lg border border-border">
                {v.priorities.map((p, i) => (
                  <li key={i} className="flex items-center gap-4 px-5 py-4 text-[14px]">
                    <span className="text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Key metrics">
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
                {v.metrics.map((m) => (
                  <div key={m.label} className="bg-background px-5 py-4">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {m.label}
                    </div>
                    <div className="mt-2 font-display text-3xl text-foreground">{m.value}</div>
                    {m.delta && (
                      <div className="mt-1 text-[11px] text-muted-foreground">{m.delta}</div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          </TabsContent>

          <TabsContent value="projects">
            <p className="text-[14px] text-muted-foreground">
              {v.activeProjects} active projects. Open the Projects screen for detail.
            </p>
          </TabsContent>
          <TabsContent value="goals">
            <p className="text-[14px] text-muted-foreground">Quarterly goals will live here.</p>
          </TabsContent>
          <TabsContent value="decisions">
            <ul className="divide-y divide-border rounded-lg border border-border">
              {v.recentDecisions.map((d, i) => (
                <li key={i} className="flex items-center justify-between px-5 py-4 text-[14px]">
                  <span>{d.title}</span>
                  <span className="text-[12px] text-muted-foreground">{d.when}</span>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="knowledge">
            <p className="text-[14px] text-muted-foreground">Documents, notes, and playbooks live here.</p>
          </TabsContent>
          <TabsContent value="activity">
            <ul className="space-y-3">
              {v.activity.map((a, i) => (
                <li key={i} className="flex items-start gap-3 text-[13px]">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  <div>
                    <div className="text-foreground">{a.text}</div>
                    <div className="text-muted-foreground">{a.at}</div>
                  </div>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="metrics">
            <p className="text-[14px] text-muted-foreground">Detailed metric explorer will appear here.</p>
          </TabsContent>
          <TabsContent value="settings">
            <p className="text-[14px] text-muted-foreground">Venture configuration.</p>
          </TabsContent>
        </Tabs>
      </PageBody>
    </div>
  );
}