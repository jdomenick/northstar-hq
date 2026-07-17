import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ventures, type Venture } from "@/lib/northstar-data";

export const Route = createFileRoute("/_authenticated/ventures/$id")({
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
  const v = Route.useLoaderData() as Venture;

  return (
    <div>
      <div className="px-6 pt-10 md:px-14">
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
          <TabsList className="mb-12 h-auto flex-wrap justify-start gap-1 border-b border-border bg-transparent p-0 -mx-2">
            {["overview", "projects", "goals", "decisions", "knowledge", "activity", "metrics", "settings"].map(
              (t) => (
                <TabsTrigger
                  key={t}
                  value={t}
                  className="relative rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-[12.5px] capitalize text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
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
              <ul>
                {v.priorities.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-6 border-b border-border/60 py-5 text-[14.5px] last:border-0"
                  >
                    <span className="font-display text-[15px] text-muted-foreground/70">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-foreground">{p}</span>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Key metrics">
              <div className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-4">
                {v.metrics.map((m) => (
                  <div key={m.label}>
                    <div className="font-display text-[36px] leading-none tabular-nums text-foreground">
                      {m.value}
                    </div>
                    <div className="mt-3 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">
                      {m.label}
                    </div>
                    {m.delta && (
                      <div className="mt-1 text-[12px] text-muted-foreground">{m.delta}</div>
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
            <ul>
              {v.recentDecisions.map((d, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between border-b border-border/60 py-5 text-[14.5px] last:border-0"
                >
                  <span className="text-foreground">{d.title}</span>
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