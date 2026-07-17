import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, AlertTriangle, GitBranch, Sparkles, TrendingUp } from "lucide-react";
import { PageBody, Section } from "@/components/page-header";
import { decisions, projects } from "@/lib/northstar-data";

export const Route = createFileRoute("/_authenticated/")({
  component: Command,
});

function Command() {
  const atRisk = projects.filter((p) => p.status === "At risk" || p.status === "Blocked");
  const priorities = [
    { venture: "Healing Path", task: "Approve Mercy Health MSA before Friday", meta: "One-way door" },
    { venture: "Elite Fleet Rides", task: "Decide dispatch vendor — 5 days open", meta: "Reversible" },
    { venture: "Personal Brand", task: "Final read of essay before Thursday send", meta: "Reversible" },
  ];

  const now = new Date();
  const dateLine = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      {/* Executive briefing header */}
      <div className="px-6 pb-14 pt-16 md:px-14 md:pb-20 md:pt-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-muted-foreground/80">
            {dateLine} · Briefing
          </div>
          <h1 className="mt-6 font-display text-[44px] leading-[1.02] text-foreground md:text-[64px]">
            Good morning, Jeff.
          </h1>
          <p className="mt-8 max-w-2xl text-[17px] leading-[1.7] text-foreground/85 md:text-[19px]">
            Operator reviewed everything across your ventures overnight.
            <span className="text-muted-foreground">
              {" "}Three decisions require your attention, two projects have slipped into risk,
              and one opportunity is worth reading before your first call.
            </span>
          </p>

          <dl className="mt-14 grid grid-cols-2 gap-x-10 gap-y-8 md:grid-cols-4">
            {[
              { label: "Decisions waiting", value: decisions.length },
              { label: "Projects at risk", value: atRisk.length },
              { label: "Ventures active", value: 4 },
              { label: "Bottlenecked on you", value: 3 },
            ].map((s) => (
              <div key={s.label}>
                <dd className="font-display text-[44px] leading-none text-foreground">
                  {s.value}
                </dd>
                <dt className="mt-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                  {s.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <PageBody>
        <Section title="Today's priorities" hint="What Operator recommends you touch first.">
          <ul className="-mx-2">
            {priorities.map((p, i) => (
              <li key={i}>
                <button className="group flex w-full items-center gap-6 rounded-lg px-2 py-5 text-left hover:bg-secondary/40">
                  <span className="w-6 font-display text-[15px] text-muted-foreground/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] text-foreground">{p.task}</div>
                    <div className="mt-1 text-[12px] text-muted-foreground">
                      {p.venture} · {p.meta}
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </button>
                {i < priorities.length - 1 && (
                  <div className="mx-2 h-px bg-border/60" />
                )}
              </li>
            ))}
          </ul>
        </Section>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <Section
            title="Decisions waiting"
            action={
              <Link to="/decisions" className="text-[12px] text-muted-foreground hover:text-foreground">
                All decisions →
              </Link>
            }
          >
            <div className="space-y-1">
              {decisions.slice(0, 3).map((d) => (
                <Link
                  key={d.id}
                  to="/decisions"
                  className="group block rounded-lg px-4 py-4 -mx-4 hover:bg-secondary/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[14.5px] leading-snug text-foreground">{d.title}</div>
                      <div className="mt-1.5 text-[12px] text-muted-foreground">
                        {d.venture} · raised {d.raised}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] uppercase tracking-[0.16em] ${
                        d.stakes === "One-way door"
                          ? "text-[oklch(0.72_0.14_25)]"
                          : "text-muted-foreground/70"
                      }`}
                    >
                      {d.stakes}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </Section>

          <Section
            title="Projects at risk"
            action={
              <Link to="/projects" className="text-[12px] text-muted-foreground hover:text-foreground">
                All projects →
              </Link>
            }
          >
            <div className="space-y-1">
              {atRisk.map((p) => (
                <div key={p.id} className="rounded-lg px-4 py-4 -mx-4 hover:bg-secondary/40">
                  <div className="text-[14.5px] leading-snug text-foreground">{p.name}</div>
                  <div className="mt-1.5 text-[12px] text-muted-foreground">
                    {p.venture} · {p.owner} · due {p.due}
                  </div>
                  <div className="mt-2.5 flex items-start gap-2 text-[12.5px] text-muted-foreground">
                    <AlertTriangle
                      className="mt-0.5 h-3 w-3 shrink-0 text-[oklch(0.78_0.14_75)]"
                      strokeWidth={2}
                    />
                    {p.nextStep}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <Section title="Opportunity">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card/80 via-card/40 to-transparent p-8 md:p-10">
            <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-foreground/[0.04] blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
                <Sparkles className="h-3 w-3" strokeWidth={2} />
                Operator · High signal
              </div>
              <h3 className="mt-5 max-w-2xl font-display text-[28px] leading-[1.15] text-foreground md:text-[34px]">
                A second Fortune 500 travel account is asking for terms.
              </h3>
              <p className="mt-5 max-w-2xl text-[14.5px] leading-[1.7] text-muted-foreground">
                Elite Fleet Rides is one call away from doubling its enterprise pipeline. The
                contact referenced your Mercy Health work — that positioning is compounding.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-2 text-[13px]">
                <button className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-2 text-background hover:opacity-90">
                  Open opportunity
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
                <button className="rounded-md px-3.5 py-2 text-muted-foreground hover:bg-secondary/60 hover:text-foreground">
                  Ask Operator to draft response
                </button>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Recent activity">
          <ul className="space-y-5">
            {[
              { icon: GitBranch, text: "Decision logged — Delay EV fleet addition to Q3", meta: "Elite Fleet Rides · 1w ago" },
              { icon: TrendingUp, text: "Healing Path MRR crossed $48K", meta: "2d ago" },
              { icon: Sparkles, text: "Operator summarized 14 unread threads into 3 decisions", meta: "This morning" },
            ].map((a, i) => (
              <li key={i} className="flex items-start gap-4 text-[13.5px]">
                <a.icon className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" strokeWidth={2} />
                <div className="min-w-0">
                  <div className="text-foreground">{a.text}</div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">{a.meta}</div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </PageBody>
    </div>
  );
}
