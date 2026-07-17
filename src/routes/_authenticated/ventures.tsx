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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {ventures.map((v) => (
            <Link
              key={v.id}
              to="/ventures/$id"
              params={{ id: v.id }}
              className="group relative overflow-hidden rounded-2xl bg-card/40 p-7 hover:bg-card/70 hover:-translate-y-0.5"
            >
              <div
                className="absolute left-0 top-6 h-8 w-[2px] rounded-r-full transition-all duration-300 group-hover:h-14"
                style={{ backgroundColor: v.color }}
              />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
                    {v.status}
                  </div>
                  <h3 className="mt-3 font-display text-[26px] leading-tight text-foreground">
                    {v.name}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                    {v.description}
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
              </div>

              <div className="mt-7 grid grid-cols-4 gap-4 border-t border-border/60 pt-5">
                {[
                  { l: "Projects", v: v.activeProjects },
                  { l: "Decisions", v: v.openDecisions },
                  { l: "Risks", v: v.risks },
                  { l: v.mrr ? "MRR" : "Focus", v: v.mrr ?? "—" },
                ].map((s, i) => (
                  <div key={i}>
                    <div className="text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground/70">
                      {s.l}
                    </div>
                    <div className="mt-1.5 text-[15px] tabular-nums text-foreground">{s.v}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 text-[12.5px] text-muted-foreground/90">{v.focus}</div>
            </Link>
          ))}
        </div>
      </PageBody>
    </div>
  );
}