import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page-header";
import { ventures } from "@/lib/northstar-data";

export const Route = createFileRoute("/ventures")({
  component: VenturesLayout,
  head: () => ({
    meta: [
      { title: "Ventures — Northstar" },
      { name: "description", content: "Every venture you run, in one calm view." },
    ],
  }),
});

function VenturesLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/ventures") return <Outlet />;
  return <VenturesIndex />;
}

function VenturesIndex() {
  return (
    <div>
      <PageHeader
        eyebrow="Ventures"
        title="Every venture, in one view."
        description="Four organizations. One operating system. Operator keeps the signal loud and the noise silent."
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {ventures.map((v) => (
            <Link
              key={v.id}
              to="/ventures/$id"
              params={{ id: v.id }}
              className="group relative overflow-hidden rounded-xl border border-border bg-card/40 p-6 transition-colors hover:bg-card"
            >
              <div
                className="absolute left-0 top-0 h-full w-[3px]"
                style={{ backgroundColor: v.color }}
              />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {v.status}
                  </div>
                  <h3 className="mt-2 font-display text-2xl text-foreground">{v.name}</h3>
                  <p className="mt-1.5 text-[13px] text-muted-foreground">{v.description}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>

              <div className="mt-6 grid grid-cols-4 gap-4 border-t border-border/60 pt-4">
                {[
                  { l: "Projects", v: v.activeProjects },
                  { l: "Decisions", v: v.openDecisions },
                  { l: "Risks", v: v.risks },
                  { l: v.mrr ? "MRR" : "Focus", v: v.mrr ?? "—" },
                ].map((s, i) => (
                  <div key={i}>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {s.l}
                    </div>
                    <div className="mt-1 text-[14px] text-foreground">{s.v}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-[12px] italic text-muted-foreground">{v.focus}</div>
            </Link>
          ))}
        </div>
      </PageBody>
    </div>
  );
}