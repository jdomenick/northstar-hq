import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, AlertTriangle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-context";
import { ExecutiveIntelligencePanel } from "@/components/executive-intelligence-panel";
import {
  useActivity,
  useCommitments,
  useDecisions,
  useGoals,
  useInsights,
  useProjects,
  useVentures,
} from "@/lib/data-hooks";
import {
  isCommitmentDueSoon,
  isCommitmentOverdue,
  isDecisionWaiting,
  isGoalAtRisk,
  scorePriority,
} from "@/lib/accountability";

export const Route = createFileRoute("/_authenticated/")({
  component: Command,
});

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function dayOfYear(d: Date) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

function greeting(hour: number) {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Command() {
  const { user } = useAuth();
  const { activeOrgId, activeMembership } = useOrg();
  const ventures = useVentures(activeOrgId);
  const projects = useProjects(activeOrgId);
  const decisions = useDecisions(activeOrgId);
  const commitments = useCommitments(activeOrgId);
  const goals = useGoals(activeOrgId);
  const insights = useInsights(activeOrgId);
  const activity = useActivity(activeOrgId, 6);
  const userId = user?.id ?? null;

  const [masthead, setMasthead] = useState<{
    date: string;
    edition: string;
    hello: string;
  }>({ date: "", edition: "", hello: "Hello" });
  useEffect(() => {
    const now = new Date();
    setMasthead({
      date: now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      edition: `No. ${dayOfYear(now).toString().padStart(3, "0")}`,
      hello: greeting(now.getHours()),
    });
  }, []);

  const activeVentures = (ventures.data ?? []).filter(
    (v) => v.status !== "archived" && v.status !== "closed",
  );
  const atRisk = (projects.data ?? []).filter(
    (p) => p.status === "at_risk" || p.status === "blocked",
  );
  const waiting = (decisions.data ?? []).filter((d) => isDecisionWaiting(d, userId));
  const myOverdue = (commitments.data ?? []).filter((c) => c.owner_user_id === userId && isCommitmentOverdue(c));
  const myDueSoon = (commitments.data ?? []).filter((c) => c.owner_user_id === userId && isCommitmentDueSoon(c));
  const goalsAtRisk = (goals.data ?? []).filter(isGoalAtRisk);
  const priorityItems = [
    ...(commitments.data ?? []).map((c) => ({ kind: "commitment" as const, id: c.id, title: c.title, sub: c.due_date ? `due ${c.due_date}` : c.status.replaceAll("_"," "), score: scorePriority({ commitment: c, userId }) })),
    ...(decisions.data ?? []).map((d) => ({ kind: "decision" as const, id: d.id, title: d.title, sub: d.status.replaceAll("_"," "), score: scorePriority({ decision: d, userId }) })),
    ...(projects.data ?? []).map((p) => ({ kind: "project" as const, id: p.id, title: p.name, sub: p.status.replaceAll("_"," "), score: scorePriority({ project: p, userId }) })),
  ].filter((x) => x.score >= 30).sort((a, b) => b.score - a.score).slice(0, 6);
  const opportunity = (insights.data ?? []).find((i) => i.severity === "opportunity");

  const firstName =
    ((user?.user_metadata?.full_name as string | undefined) ?? "").split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "there";

  const orgName = activeMembership?.organizations?.name ?? "Your workspace";

  return (
    <div className="animate-in fade-in duration-500">
      {/* Masthead */}
      <header className="border-b border-foreground/15 px-6 pt-10 md:px-14 md:pt-14">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-baseline justify-between gap-3 text-[10.5px] font-medium uppercase tracking-[0.28em] text-foreground/70">
            <span>{orgName}</span>
            <span className="hidden md:inline">The Daily Brief</span>
            <span>{masthead.edition || "Edition"}</span>
          </div>
          <div className="mt-6 flex items-end justify-between gap-6 border-t border-foreground/80 pt-3">
            <h1 className="font-display text-[52px] leading-[0.95] tracking-tight text-foreground md:text-[92px]">
              The Brief
            </h1>
            <div className="hidden text-right font-display text-[15px] italic text-foreground/70 md:block">
              {masthead.date}
            </div>
          </div>
          <div className="mt-2 pb-6 text-[12px] italic text-foreground/60 md:hidden">
            {masthead.date}
          </div>
          <div className="hidden pb-6 md:block" />
        </div>
      </header>

      {/* Lede */}
      <section className="px-6 py-12 md:px-14 md:py-16">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.4fr_1fr] md:gap-16">
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-foreground/60">
              {masthead.hello || "Hello"}
            </div>
            <h2 className="mt-4 font-display text-[40px] leading-[1.02] text-foreground md:text-[60px]">
              {firstName}, here is where things stand.
            </h2>
            <p className="mt-6 max-w-xl text-[15.5px] leading-[1.75] text-foreground/75">
              A single read across every venture. Priorities first, then what is waiting,
              at risk, or worth your attention today.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-6 self-end border-l border-foreground/15 pl-8 md:gap-y-8">
            {[
              { label: "Decisions waiting", value: waiting.length },
              { label: "Overdue on you", value: myOverdue.length },
              { label: "Projects at risk", value: atRisk.length },
              { label: "Goals at risk", value: goalsAtRisk.length },
            ].map((s) => (
              <div key={s.label}>
                <dd className="font-display text-[44px] leading-none tabular-nums text-foreground md:text-[52px]">
                  {s.value}
                </dd>
                <dt className="mt-3 text-[10.5px] uppercase tracking-[0.22em] text-foreground/60">
                  {s.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Body */}
      <div className="mx-auto max-w-6xl px-6 pb-24 md:px-14">
        {/* Front page */}
        <div className="border-t border-foreground/80 pt-3">
          <div className="flex items-baseline justify-between">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-foreground/70">
              Front page
            </div>
            <div className="text-[11px] italic text-foreground/50">
              Ranked by ownership, deadlines, risk
            </div>
          </div>
          <div className="mt-6">
            {priorityItems.length === 0 ? (
              <EmptyLine text="Nothing critical right now. A quiet paper is a good paper." />
            ) : (
              <ol className="divide-y divide-foreground/10">
                {priorityItems.map((it, i) => (
                  <li key={`${it.kind}-${it.id}`}>
                    <Link
                      to={it.kind === "decision" ? "/decisions/$id" : it.kind === "commitment" ? "/commitments/$id" : "/projects/$id"}
                      params={{ id: it.id }}
                      className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-5 md:grid-cols-[3rem_minmax(0,1fr)_auto] md:gap-6"
                    >
                      <span className="hidden font-display text-[22px] leading-none text-foreground/40 md:block">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
                          {it.kind}
                        </div>
                        <div className="mt-1.5 font-display text-[22px] leading-[1.2] text-foreground group-hover:italic md:text-[26px]">
                          {it.title}
                        </div>
                        <div className="mt-1.5 text-[12.5px] text-foreground/60">
                          {it.sub}
                        </div>
                      </div>
                      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* SAM whisper */}
        {opportunity && (
          <div className="mt-16 border-t border-foreground/15 pt-8">
            <div className="grid gap-8 md:grid-cols-[auto_minmax(0,1fr)] md:gap-12">
              <div className="flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.24em] text-foreground/60 md:flex-col md:items-start md:gap-3">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                <span>SAM notes</span>
              </div>
              <blockquote className="border-l border-foreground pl-6 md:pl-10">
                <p className="font-display text-[28px] italic leading-[1.25] text-foreground md:text-[36px]">
                  &ldquo;{opportunity.title}&rdquo;
                </p>
                {opportunity.summary && (
                  <p className="mt-5 max-w-2xl text-[14.5px] leading-[1.75] text-foreground/70">
                    {opportunity.summary}
                  </p>
                )}
              </blockquote>
            </div>
          </div>
        )}

        {/* Columns */}
        <div className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-x-14">
          <Column
            title="Waiting on a call"
            allHref="/decisions"
            allLabel="All decisions"
            empty="No decisions waiting on you."
          >
            {waiting.slice(0, 4).map((d) => (
              <ColumnRow
                key={d.id}
                to="/decisions/$id"
                id={d.id}
                title={d.title}
                meta={d.status.replaceAll("_", " ")}
              />
            ))}
          </Column>

          <Column
            title="On your plate"
            allHref="/accountability"
            allLabel="All commitments"
            empty="Nothing on your plate this week."
          >
            {[...myOverdue, ...myDueSoon].slice(0, 5).map((c) => {
              const overdue = myOverdue.includes(c);
              return (
                <ColumnRow
                  key={c.id}
                  to="/commitments/$id"
                  id={c.id}
                  title={c.title}
                  meta={`${overdue ? "Overdue" : "Due"} ${c.due_date ?? ""}`}
                  emphasis={overdue ? "warn" : "muted"}
                />
              );
            })}
          </Column>

          <Column
            title="Goals at risk"
            allHref="/goals"
            allLabel="All goals"
            empty="No goals at risk."
          >
            {goalsAtRisk.slice(0, 4).map((g) => (
              <ColumnRow
                key={g.id}
                to="/goals/$id"
                id={g.id}
                title={g.title}
                meta={`Target ${g.target_date ?? "unset"}`}
              />
            ))}
          </Column>

          <Column
            title="Projects at risk"
            allHref="/projects"
            allLabel="All projects"
            empty="Everything is on track."
          >
            {atRisk.slice(0, 4).map((p) => (
              <div key={p.id}>
                <ColumnRow
                  to="/projects/$id"
                  id={p.id}
                  title={p.name}
                  meta={`${p.status.replaceAll("_", " ")}${p.deadline ? ` , due ${p.deadline}` : ""}`}
                  emphasis="warn"
                />
                {p.risk_summary && (
                  <div className="mt-1 flex items-start gap-2 pl-1 text-[12.5px] italic text-foreground/60">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} />
                    <span>{p.risk_summary}</span>
                  </div>
                )}
              </div>
            ))}
          </Column>
        </div>

        {/* Ledger */}
        <div className="mt-20 border-t border-foreground/80 pt-3">
          <div className="flex items-baseline justify-between">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-foreground/70">
              The ledger
            </div>
            <div className="text-[11px] italic text-foreground/50">
              Recent activity across {orgName}
            </div>
          </div>
          <div className="mt-4">
            {(activity.data ?? []).length === 0 ? (
              <EmptyLine text="Activity from your organization will appear here." />
            ) : (
              <ul className="divide-y divide-foreground/10">
                {(activity.data ?? []).map((a) => (
                  <li key={a.id} className="grid grid-cols-[6rem_minmax(0,1fr)] items-baseline gap-4 py-3 text-[13.5px] md:grid-cols-[8rem_minmax(0,1fr)]">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-foreground/50 tabular-nums">
                      {timeAgo(a.created_at)}
                    </span>
                    <span className="text-foreground/85">{a.summary ?? a.action}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Colophon */}
        <div className="mt-16 flex flex-wrap items-baseline justify-between gap-3 border-t border-foreground/15 pt-5 text-[10.5px] uppercase tracking-[0.24em] text-foreground/50">
          <span>Northstar , Executive Operating System</span>
          <span>
            {activeVentures.length} active {activeVentures.length === 1 ? "venture" : "ventures"}
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="py-4 text-[13.5px] italic text-foreground/55">{text}</div>;
}

function Column({
  title,
  allHref,
  allLabel,
  empty,
  children,
}: {
  title: string;
  allHref: "/decisions" | "/accountability" | "/goals" | "/projects";
  allLabel: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-foreground/60 pb-2">
        <h3 className="font-display text-[22px] leading-none text-foreground">{title}</h3>
        <Link
          to={allHref}
          className="text-[11px] uppercase tracking-[0.2em] text-foreground/55 hover:text-foreground"
        >
          {allLabel}
        </Link>
      </div>
      <div className="mt-2">
        {items.length === 0 ? <EmptyLine text={empty} /> : <div className="divide-y divide-foreground/10">{children}</div>}
      </div>
    </section>
  );
}

function ColumnRow({
  to,
  id,
  title,
  meta,
  emphasis = "muted",
}: {
  to: "/decisions/$id" | "/commitments/$id" | "/goals/$id" | "/projects/$id";
  id: string;
  title: string;
  meta: string;
  emphasis?: "muted" | "warn";
}) {
  return (
    <Link
      to={to}
      params={{ id }}
      className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-3.5"
    >
      <div className="min-w-0">
        <div className="text-[15px] leading-snug text-foreground group-hover:italic">{title}</div>
        <div
          className={
            "mt-1 text-[12px] " +
            (emphasis === "warn" ? "text-[oklch(0.5_0.18_27)]" : "text-foreground/60")
          }
        >
          {meta}
        </div>
      </div>
      <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-foreground/30 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}