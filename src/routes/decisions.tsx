import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { decisions } from "@/lib/northstar-data";

export const Route = createFileRoute("/decisions")({
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
        <div className="space-y-3">
          {decisions.map((d) => (
            <article
              key={d.id}
              className="group rounded-xl border border-border bg-card/40 p-6 transition-colors hover:bg-card"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {d.venture} · raised {d.raised}
                  </div>
                  <h3 className="mt-2 font-display text-xl leading-snug text-foreground">
                    {d.title}
                  </h3>
                  <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                    {d.context}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${
                    d.stakes === "One-way door"
                      ? "text-[oklch(0.62_0.19_25)]"
                      : "text-muted-foreground"
                  }`}
                >
                  {d.stakes}
                </span>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                <div className="text-[12px] text-muted-foreground">
                  Waiting on <span className="text-foreground">{d.waitingOn}</span>
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  <button className="rounded-md border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground">
                    Defer
                  </button>
                  <button className="rounded-md bg-foreground px-3 py-1.5 text-background hover:opacity-90">
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