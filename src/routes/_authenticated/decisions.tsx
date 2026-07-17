import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { decisions } from "@/lib/northstar-data";

export const Route = createFileRoute("/_authenticated/decisions")({
  component: DecisionsPage,
  head: () => ({
    meta: [
      { title: "Decisions — Northstar" },
      { name: "description", content: "Every open decision, its stakes, and who it's waiting on." },
    ],
  }),
});

function DecisionsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Decisions"
        title="Decisions waiting on you."
        description="Reversible or one-way door. Operator surfaces context. You decide."
      />
      <PageBody>
        <div className="-mx-2">
          {decisions.map((d) => (
            <article
              key={d.id}
              className="group rounded-xl px-6 py-7 hover:bg-secondary/30 border-b border-border/60 last:border-0"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
                    {d.venture} · raised {d.raised}
                  </div>
                  <h3 className="mt-3 font-display text-[22px] leading-snug text-foreground">
                    {d.title}
                  </h3>
                  <p className="mt-4 max-w-2xl text-[14px] leading-[1.7] text-muted-foreground">
                    {d.context}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-[10px] uppercase tracking-[0.2em] ${
                    d.stakes === "One-way door"
                      ? "text-[oklch(0.72_0.14_25)]"
                      : "text-muted-foreground/70"
                  }`}
                >
                  {d.stakes}
                </span>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[12.5px] text-muted-foreground">
                  Waiting on <span className="text-foreground">{d.waitingOn}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[12.5px]">
                  <button className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary/60 hover:text-foreground">
                    Defer
                  </button>
                  <button className="rounded-md bg-foreground px-3.5 py-1.5 text-background hover:opacity-90">
                    Decide
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </PageBody>
    </div>
  );
}