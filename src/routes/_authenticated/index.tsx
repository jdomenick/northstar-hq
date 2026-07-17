import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, AlertTriangle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { PageBody, Section } from "@/components/page-header";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-context";
import {
  useActivity,
  useDecisions,
  useInsights,
  useProjects,
  useVentures,
} from "@/lib/data-hooks";

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

function Command() {
  const { user } = useAuth();
  const { activeOrgId, activeMembership } = useOrg();
  const ventures = useVentures(activeOrgId);
  const projects = useProjects(activeOrgId);
  const decisions = useDecisions(activeOrgId);
  const insights = useInsights(activeOrgId);
  const activity = useActivity(activeOrgId, 6);

  const [dateLine, setDateLine] = useState<string>("");
  useEffect(() => {
    setDateLine(
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    );
  }, []);

  const activeVentures = (ventures.data ?? []).filter(
    (v) => v.status !== "archived" && v.status !== "closed",
  );
  const atRisk = (projects.data ?? []).filter(
    (p) => p.status === "at_risk" || p.status === "blocked",
  );
  const waiting = (decisions.data ?? []).filter(
    (d) =>
      d.status === "under_review" ||
      d.status === "waiting_for_founder" ||
      d.status === "draft",
  );
  const opportunity = (insights.data ?? []).find((i) => i.severity === "opportunity");

  const firstName =
    ((user?.user_metadata?.full_name as string | undefined) ?? "").split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "there";

  return (
    <div>
      <div className="px-6 pb-14 pt-16 md:px-14 md:pb-20 md:pt-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-muted-foreground/80">
            {dateLine ? `${dateLine} · Briefing` : "Briefing"}
          </div>
          <h1 className="mt-6 font-display text-[44px] leading-[1.02] text-foreground md:text-[64px]">
            Good morning, {firstName}.
          </h1>
          <p className="mt-8 max-w-2xl text-[17px] leading-[1.7] text-foreground/85 md:text-[19px]">
            {activeMembership?.organizations?.name ?? "Your workspace"} — one operating system.
            <span className="text-muted-foreground">
              {" "}Operator intelligence connects next. Until then, this is your live picture
              across every venture.
            </span>
          </p>

          <dl className="mt-14 grid grid-cols-2 gap-x-10 gap-y-8 md:grid-cols-4">
            {[
              { label: "Decisions waiting", value: waiting.length },
              { label: "Projects at risk", value: atRisk.length },
              { label: "Ventures active", value: activeVentures.length },
              { label: "Signals", value: (insights.data ?? []).length },
            ].map((s) => (
              <div key={s.label}>
                <dd className="font-display text-[44px] leading-none tabular-nums text-foreground">
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
        <Section
          title="Today's priorities"
          hint="Draft priorities from your decisions. Operator curation connects next."
        >
          {waiting.length === 0 ? (
            <EmptyLine text="Nothing waiting on you. Add a decision to see it here." />
          ) : (
            <ul className="-mx-2">
              {waiting.slice(0, 5).map((d, i, arr) => (
                <li key={d.id}>
                  <Link
                    to="/decisions"
                    className="group flex w-full items-center gap-6 rounded-lg px-2 py-5 text-left hover:bg-secondary/40"
                  >
                    <span className="w-6 font-display text-[15px] text-muted-foreground/70">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] text-foreground">{d.title}</div>
                      <div className="mt-1 text-[12px] text-muted-foreground">
                        {d.status.replaceAll("_", " ")}
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </Link>
                  {i < arr.length - 1 && <div className="mx-2 h-px bg-border/60" />}
                </li>
              ))}
            </ul>
          )}
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
            {waiting.length === 0 ? (
              <EmptyLine text="No decisions waiting." />
            ) : (
              <div className="space-y-1">
                {waiting.slice(0, 3).map((d) => (
                  <Link
                    key={d.id}
                    to="/decisions"
                    className="group block -mx-4 rounded-lg px-4 py-4 hover:bg-secondary/40"
                  >
                    <div className="text-[14.5px] leading-snug text-foreground">{d.title}</div>
                    <div className="mt-1.5 text-[12px] text-muted-foreground">
                      {d.status.replaceAll("_", " ")}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Projects at risk"
            action={
              <Link to="/projects" className="text-[12px] text-muted-foreground hover:text-foreground">
                All projects →
              </Link>
            }
          >
            {atRisk.length === 0 ? (
              <EmptyLine text="Everything's on track." />
            ) : (
              <div className="space-y-1">
                {atRisk.map((p) => (
                  <div key={p.id} className="-mx-4 rounded-lg px-4 py-4 hover:bg-secondary/40">
                    <div className="text-[14.5px] leading-snug text-foreground">{p.name}</div>
                    <div className="mt-1.5 text-[12px] text-muted-foreground">
                      {p.status.replaceAll("_", " ")}
                      {p.deadline ? ` · due ${p.deadline}` : ""}
                    </div>
                    {p.risk_summary && (
                      <div className="mt-2.5 flex items-start gap-2 text-[12.5px] text-muted-foreground">
                        <AlertTriangle
                          className="mt-0.5 h-3 w-3 shrink-0 text-[oklch(0.78_0.14_75)]"
                          strokeWidth={2}
                        />
                        {p.risk_summary}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {opportunity && (
          <Section title="Opportunity">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card/80 via-card/40 to-transparent p-8 md:p-10">
              <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-foreground/[0.04] blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
                  <Sparkles className="h-3 w-3" strokeWidth={2} />
                  Operator · High signal
                </div>
                <h3 className="mt-5 max-w-2xl font-display text-[28px] leading-[1.15] text-foreground md:text-[34px]">
                  {opportunity.title}
                </h3>
                {opportunity.summary && (
                  <p className="mt-5 max-w-2xl text-[14.5px] leading-[1.7] text-muted-foreground">
                    {opportunity.summary}
                  </p>
                )}
              </div>
            </div>
          </Section>
        )}

        <Section title="Recent activity">
          {(activity.data ?? []).length === 0 ? (
            <EmptyLine text="Activity from your organization will appear here." />
          ) : (
            <ul className="space-y-5">
              {(activity.data ?? []).map((a) => (
                <li key={a.id} className="flex items-start gap-4 text-[13.5px]">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  <div className="min-w-0">
                    <div className="text-foreground">{a.summary ?? a.action}</div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">
                      {timeAgo(a.created_at)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </PageBody>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="text-[13px] text-muted-foreground">{text}</div>;
}