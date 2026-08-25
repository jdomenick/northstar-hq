// Truthful activation progress for the Founder Activation workflow.
// Every count below is read live from the organization's real records.
// Nothing here seeds, fabricates, or estimates.

import { Link } from "@tanstack/react-router";
import { Section } from "@/components/page-header";
import { useAuth } from "@/lib/auth-context";
import {
  useCommitments,
  useDecisions,
  useGoals,
  useOrganization,
  useProfile,
  useProjects,
  useVentures,
} from "@/lib/data-hooks";

type StepStatus = "complete" | "empty" | "loading" | "unavailable";

function StepRow({
  label,
  hint,
  count,
  status,
  to,
  cta,
}: {
  label: string;
  hint: string;
  count: number | null;
  status: StepStatus;
  to: string;
  cta: string;
}) {
  return (
    <li className="flex items-center gap-4 border-b border-border/50 py-3 last:border-0">
      <span
        aria-hidden
        className={
          "h-1.5 w-1.5 shrink-0 rounded-full " +
           (status === "complete" ? "bg-primary" : status === "unavailable" ? "bg-destructive" : status === "loading" ? "bg-muted-foreground/40" : "bg-muted-foreground/25")
        }
      />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] text-foreground">{label}</div>
        <div className="truncate text-[11.5px] text-muted-foreground">{hint}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[13.5px] tabular-nums text-foreground">
          {status === "loading" ? "…" : status === "unavailable" ? "-" : count ?? 0}
        </div>
        <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/70">
           {status === "complete" ? "on record" : status === "loading" ? "reading" : status === "unavailable" ? "unavailable" : "none yet"}
        </div>
      </div>
      <Link
        to={to}
        className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11.5px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      >
        {cta}
      </Link>
    </li>
  );
}

export function FounderActivationStatus({ organizationId }: { organizationId: string }) {
  const { user } = useAuth();
  const ventures = useVentures(organizationId);
  const projects = useProjects(organizationId);
  const goals = useGoals(organizationId);
  const decisions = useDecisions(organizationId);
  const commitments = useCommitments(organizationId);
  const profile = useProfile(user?.id);
  const org = useOrganization(organizationId);

  const st = (q: { isLoading: boolean; isError: boolean }, n: number): StepStatus =>
    q.isLoading ? "loading" : q.isError ? "unavailable" : n > 0 ? "complete" : "empty";

  const vN = ventures.data?.length ?? 0;
  const pN = projects.data?.length ?? 0;
  const gN = goals.data?.length ?? 0;
  const dN = decisions.data?.length ?? 0;
  const cN = commitments.data?.length ?? 0;

  const profileComplete = Boolean(profile.data?.full_name && (profile.data?.title || profile.data?.bio));
  const orgComplete = Boolean(org.data?.name && org.data?.description);

  const steps = [vN > 0, pN > 0, gN > 0, dN > 0, cN > 0, profileComplete, orgComplete];
  const done = steps.filter(Boolean).length;
  const pct = Math.round((done / steps.length) * 100);

  return (
    <Section
      title="Activation status"
      hint="Live counts from your organization. Import below only fills the gaps."
      action={<span>{done}/{steps.length} complete</span>}
    >
      <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-secondary/60">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul>
        <StepRow label="Ventures" hint="Businesses SAM reasons across" count={vN} status={st(ventures, vN)} to="/labs/ventures" cta="Open" />
        <StepRow label="Projects" hint="Active work with objectives and status" count={pN} status={st(projects, pN)} to="/labs/projects" cta="Open" />
        <StepRow label="Goals" hint="Outcomes with a definition of success" count={gN} status={st(goals, gN)} to="/labs/goals" cta="Open" />
        <StepRow label="Decisions" hint="Decision history and rationale" count={dN} status={st(decisions, dN)} to="/labs/decisions" cta="Open" />
        <StepRow label="Commitments" hint="Accountability items you owe or are owed" count={cN} status={st(commitments, cN)} to="/labs/accountability" cta="Open" />
        <li className="flex items-center gap-4 border-b border-border/50 py-3">
          <span aria-hidden className={"h-1.5 w-1.5 shrink-0 rounded-full " + (profileComplete ? "bg-primary" : "bg-muted-foreground/25")} />
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] text-foreground">Founder profile</div>
            <div className="truncate text-[11.5px] text-muted-foreground">Name plus a title or bio so SAM knows who it works for</div>
          </div>
          <div className="shrink-0 text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/70">
            {profileComplete ? "on record" : "incomplete"}
          </div>
           <Link to="/settings" search={{ tab: "profile" }} className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11.5px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground">Edit</Link>
        </li>
        <li className="flex items-center gap-4 py-3">
          <span aria-hidden className={"h-1.5 w-1.5 shrink-0 rounded-full " + (orgComplete ? "bg-primary" : "bg-muted-foreground/25")} />
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] text-foreground">Organization context</div>
            <div className="truncate text-[11.5px] text-muted-foreground">Organization name and description</div>
          </div>
          <div className="shrink-0 text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/70">
            {orgComplete ? "on record" : "incomplete"}
          </div>
           <Link to="/settings" search={{ tab: "organization" }} className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11.5px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground">Edit</Link>
        </li>
      </ul>
    </Section>
  );
}
