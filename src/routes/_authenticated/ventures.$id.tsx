import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVenture } from "@/lib/data-hooks";

export const Route = createFileRoute("/_authenticated/ventures/$id")({
  component: VentureDetail,
  head: () => ({ meta: [{ title: "Venture — Northstar" }] }),
});

function VentureDetail() {
  const { id } = Route.useParams();
  const { data: v, isLoading, error } = useVenture(id);

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

      {isLoading ? (
        <PageBody>
          <div className="h-40 animate-pulse rounded-2xl bg-card/30" />
        </PageBody>
      ) : error ? (
        <PageBody>
          <p className="text-muted-foreground">Couldn't load this venture.</p>
        </PageBody>
      ) : !v ? (
        <PageBody>
          <p className="text-muted-foreground">Venture not found.</p>
        </PageBody>
      ) : (
        <>
          <PageHeader
            eyebrow={v.status.replaceAll("_", " ")}
            title={v.name}
            description={v.description ?? undefined}
          />
          <PageBody>
            <Tabs defaultValue="overview">
              <TabsList className="mb-12 -mx-2 h-auto flex-wrap justify-start gap-1 border-b border-border bg-transparent p-0">
                {[
                  "overview",
                  "projects",
                  "goals",
                  "decisions",
                  "knowledge",
                  "activity",
                  "metrics",
                  "settings",
                ].map((t) => (
                  <TabsTrigger
                    key={t}
                    value={t}
                    className="relative rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-[12.5px] capitalize text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    {t}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="space-y-10">
                {v.current_focus && (
                  <Section title="Current focus">
                    <p className="text-[15px] text-foreground/90">{v.current_focus}</p>
                  </Section>
                )}
                {v.mission && (
                  <Section title="Mission">
                    <p className="text-[14.5px] text-foreground/90">{v.mission}</p>
                  </Section>
                )}
                {!v.current_focus && !v.mission && (
                  <p className="text-[13.5px] text-muted-foreground">
                    Add a mission or current focus to enrich this venture.
                  </p>
                )}
              </TabsContent>

              {["projects", "goals", "decisions", "knowledge", "activity", "metrics", "settings"].map(
                (t) => (
                  <TabsContent key={t} value={t}>
                    <p className="text-[14px] text-muted-foreground">
                      {t.charAt(0).toUpperCase() + t.slice(1)} view connects next.
                    </p>
                  </TabsContent>
                ),
              )}
            </Tabs>
          </PageBody>
        </>
      )}
    </div>
  );
}