import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, AlertTriangle, GitBranch, Sparkles, CircleDot, TrendingUp } from "lucide-react";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { decisions, projects, ventures } from "@/lib/northstar-data";

export const Route = createFileRoute("/")({
  component: Command,
});

function Command() {
  const atRisk = projects.filter((p) => p.status === "At risk" || p.status === "Blocked");
  const priorities = [
    { venture: "Healing Path", task: "Approve Mercy Health MSA before Friday" },
    { venture: "Elite Fleet Rides", task: "Decide dispatch vendor — 5 days open" },
    { venture: "Personal Brand", task: "Final read of essay before Thursday send" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Command"
        title="Good morning, Jeff."
        description="Operator reviewed everything across your ventures. Three decisions require your attention. Two projects are at risk. One opportunity deserves immediate review."
      />

      <PageBody>
        <div className="mb-14 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
          {[
            { label: "Decisions waiting", value: decisions.length, tone: "text-foreground" },
            { label: "Projects at risk", value: atRisk.length, tone: "text-[oklch(0.78_0.14_75)]" },
            { label: "Ventures active", value: ventures.length, tone: "text-foreground" },
            { label: "Bottlenecked on you", value: 3, tone: "text-[oklch(0.62_0.19_25)]" },
          ].map((s) => (
            <div key={s.label} className="bg-background px-6 py-5">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {s.label}
              </div>
              <div className={`mt-2 font-display text-4xl ${s.tone}`}>{s.value}</div>
            </div>
          ))}
        </div>

        <Section
          title="Today's Priorities"
          hint="What Operator recommends you touch first."
        >
          <ul className="divide-y divide-border rounded-lg border border-border">
            {priorities.map((p, i) => (
              <li key={i} className="flex items-center gap-4 px-5 py-4">
                <CircleDot className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] text-foreground">{p.task}</div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">{p.venture}</div>
                </div>
                <button className="text-[12px] text-muted-foreground hover:text-foreground">
                  Open
                </button>
              </li>
            ))}
          </ul>
        </Section>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <Section
            title="Decisions Waiting"
            action={
              <Link to="/decisions" className="text-[12px] text-muted-foreground hover:text-foreground">
                All decisions →
              </Link>
            }
          >
            <div className="space-y-2">
              {decisions.slice(0, 3).map((d) => (
                <div
                  key={d.id}
                  className="rounded-lg border border-border bg-card/40 p-5 transition-colors hover:bg-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[14px] text-foreground">{d.title}</div>
                      <div className="mt-1 text-[12px] text-muted-foreground">
                        {d.venture} · raised {d.raised}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                        d.stakes === "One-way door"
                          ? "text-[oklch(0.62_0.19_25)]"
                          : "text-muted-foreground"
                      }`}
                    >
                      {d.stakes}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Projects at Risk"
            action={
              <Link to="/projects" className="text-[12px] text-muted-foreground hover:text-foreground">
                All projects →
              </Link>
            }
          >
            <div className="space-y-2">
              {atRisk.map((p) => (
                <div key={p.id} className="rounded-lg border border-border bg-card/40 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] text-foreground">{p.name}</div>
                      <div className="mt-1 text-[12px] text-muted-foreground">
                        {p.venture} · owner {p.owner} · due {p.due}
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
                        <AlertTriangle className="h-3 w-3 text-[oklch(0.78_0.14_75)]" strokeWidth={2} />
                        {p.nextStep}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <Section title="Opportunities">
          <div className="rounded-lg border border-border bg-gradient-to-b from-card/60 to-card/20 p-6">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                <Sparkles className="h-4 w-4 text-foreground" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Operator · High signal
                </div>
                <div className="mt-2 font-display text-2xl leading-tight text-foreground">
                  A second Fortune 500 travel account is asking for terms.
                </div>
                <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
                  Elite Fleet Rides is one call away from doubling its enterprise pipeline. The
                  contact referenced your Mercy Health work — that positioning is compounding.
                </p>
                <div className="mt-5 flex items-center gap-2 text-[13px]">
                  <button className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-background hover:opacity-90">
                    Open opportunity
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                  <button className="rounded-md border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground">
                    Ask Operator to draft response
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Recent Activity">
          <ul className="space-y-3">
            {[
              { icon: GitBranch, text: "Decision logged — Delay EV fleet addition to Q3", meta: "Elite Fleet Rides · 1w ago" },
              { icon: TrendingUp, text: "Healing Path MRR crossed $48K", meta: "2d ago" },
              { icon: Sparkles, text: "Operator summarized 14 unread threads into 3 decisions", meta: "This morning" },
            ].map((a, i) => (
              <li key={i} className="flex items-start gap-3 text-[13px]">
                <a.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                <div className="min-w-0">
                  <div className="text-foreground">{a.text}</div>
                  <div className="text-muted-foreground">{a.meta}</div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </PageBody>
    </div>
  );
}
