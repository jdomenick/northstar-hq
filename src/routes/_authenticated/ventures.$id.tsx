import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCommitments,
  useDecisions,
  useGoals,
  useProjects,
  useVenture,
} from "@/lib/data-hooks";
import { useOrg } from "@/lib/org-context";
import {
  goalProgressPct,
  isCommitmentOverdue,
  isGoalAtRisk,
  isDecisionWaiting,
} from "@/lib/accountability";

export const Route = createFileRoute("/_authenticated/ventures/$id")({
  component: VentureDetail,
  head: () => ({ meta: [{ title: "Venture — Northstar" }] }),
});

function VentureDetail() {
  const { id } = Route.useParams();
  const { data: v, isLoading, error } = useVenture(id);
  const { activeOrgId } = useOrg();
  const projectsQ = useProjects(activeOrgId);
  const goalsQ = useGoals(activeOrgId);
  const decisionsQ = useDecisions(activeOrgId);
  const commitmentsQ = useCommitments(activeOrgId);

  const projects = (projectsQ.data ?? []).filter((p) => p.venture_id === id);
  const goals = (goalsQ.data ?? []).filter((g) => g.venture_id === id);
  const decisions = (decisionsQ.data ?? []).filter((d) => d.venture_id === id);
  const commitments = (commitmentsQ.data ?? []).filter((c) => c.venture_id === id);

  const activeGoals = goals.filter((g) => g.status === "active");
  const goalsRisk = goals.filter(isGoalAtRisk);
  const decisionsWaiting = decisions.filter((d) => isDecisionWaiting(d, null));
  const openCommitments = commitments.filter((c) => c.status !== "completed" && c.status !== "canceled");
  const overdueCommitments = commitments.filter(isCommitmentOverdue);

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
                  "commitments",
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
                <Section title="At a glance">
                  <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                    <Stat label="Active goals" value={activeGoals.length} />
                    <Stat label="At-risk goals" value={goalsRisk.length} />
                    <Stat label="Waiting decisions" value={decisionsWaiting.length} />
                    <Stat label="Open commitments" value={openCommitments.length} />
                    <Stat label="Overdue commitments" value={overdueCommitments.length} />
                  </div>
                </Section>
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
              </TabsContent>

              <TabsContent value="projects">
                <SimpleList items={projects.map((p) => ({ id: p.id, title: p.name, sub: p.status.replaceAll("_", " "), to: "/projects/$id" as const }))} empty="No projects yet." />
              </TabsContent>
              <TabsContent value="goals">
                <SimpleList items={goals.map((g) => {
                  const pct = goalProgressPct(g);
                  return { id: g.id, title: g.title, sub: `${g.status.replaceAll("_"," ")}${pct != null ? ` · ${pct}%` : ""}`, to: "/goals/$id" as const };
                })} empty="No goals yet." />
              </TabsContent>
              <TabsContent value="decisions">
                <SimpleList items={decisions.map((d) => ({ id: d.id, title: d.title, sub: d.status.replaceAll("_"," "), to: "/decisions/$id" as const }))} empty="No decisions yet." />
              </TabsContent>
              <TabsContent value="commitments">
                <SimpleList items={commitments.map((c) => ({ id: c.id, title: c.title, sub: (isCommitmentOverdue(c) ? "Overdue" : c.status.replaceAll("_"," ")) + (c.due_date ? ` · due ${c.due_date}` : ""), to: "/commitments/$id" as const }))} empty="No commitments yet." />
              </TabsContent>
              {["knowledge", "activity", "metrics", "settings"].map((t) => (
                <TabsContent key={t} value={t}>
                  <p className="text-[14px] text-muted-foreground">
                    {t.charAt(0).toUpperCase() + t.slice(1)} view connects next.
                  </p>
                </TabsContent>
              ))}
            </Tabs>
          </PageBody>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-display text-[28px] leading-none tabular-nums text-foreground">{value}</div>
      <div className="mt-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">{label}</div>
    </div>
  );
}

type LinkTo = "/projects/$id" | "/goals/$id" | "/decisions/$id" | "/commitments/$id";
function SimpleList({ items, empty }: { items: { id: string; title: string; sub: string; to: LinkTo }[]; empty: string }) {
  if (items.length === 0) return <p className="text-[13.5px] text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border/60">
      {items.map((it) => (
        <li key={it.id} className="py-4">
          <Link to={it.to} params={{ id: it.id }} className="text-[14px] text-foreground hover:underline">{it.title}</Link>
          <div className="text-[12px] text-muted-foreground">{it.sub}</div>
        </li>
      ))}
    </ul>
  );
}