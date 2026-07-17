import type { Commitment, Decision, Goal, Project } from "./data-hooks";
import { STALLED_PROJECT_DAYS } from "./constants";

export const GOAL_AT_RISK_DAYS = 14;
export const GOAL_AT_RISK_PCT = 75;
export const REPEATED_POSTPONEMENTS = 2;
export const COMMITMENT_DUE_SOON_DAYS = 7;

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(a: string | Date, b: string | Date): number {
  const ad = typeof a === "string" ? new Date(a) : a;
  const bd = typeof b === "string" ? new Date(b) : b;
  return Math.floor((bd.getTime() - ad.getTime()) / 86400000);
}

export function isCommitmentOverdue(c: Commitment): boolean {
  if (!c.due_date) return false;
  if (c.status === "completed" || c.status === "canceled") return false;
  return c.due_date < isoToday();
}

export function isCommitmentDueSoon(c: Commitment, days = COMMITMENT_DUE_SOON_DAYS): boolean {
  if (!c.due_date) return false;
  if (c.status === "completed" || c.status === "canceled") return false;
  const today = isoToday();
  if (c.due_date < today) return false;
  return daysBetween(today, c.due_date) <= days;
}

export function isProjectStalled(p: Project): boolean {
  const active: Project["status"][] = ["planned", "active", "at_risk", "blocked"];
  if (!active.includes(p.status)) return false;
  return daysBetween(p.updated_at, new Date()) >= STALLED_PROJECT_DAYS;
}

export function goalProgressPct(g: Goal): number | null {
  if (g.target_value == null || g.current_value == null) return null;
  if (g.target_value === 0) return null;
  return Math.round((g.current_value / g.target_value) * 100);
}

export function isGoalAtRisk(g: Goal): boolean {
  if (g.status === "achieved" || g.status === "archived" || g.status === "missed") return false;
  if (g.status === "at_risk") return true;
  if (!g.target_date) return false;
  const days = daysBetween(isoToday(), g.target_date);
  if (days < 0 || days > GOAL_AT_RISK_DAYS) return false;
  const pct = goalProgressPct(g);
  return pct == null ? false : pct < GOAL_AT_RISK_PCT;
}

export function isDecisionWaiting(d: Decision, userId?: string | null): boolean {
  if (d.status === "closed" || d.status === "decided") {
    // still surface if review date passed for a decided one?
    if (d.status === "closed") return false;
  }
  if (d.status === "waiting_for_founder") return true;
  if (d.status === "under_review" && userId && d.owner_user_id === userId) return true;
  if (d.review_date && d.review_date <= isoToday() && d.status !== "closed") return true;
  return false;
}

/** Rule-based executive statements — never AI-generated. */
export type AccountabilityStatement = {
  id: string;
  text: string;
  link?: { to: string; params?: Record<string, string> };
  weight: number;
};

export function buildAccountabilityStatements(input: {
  userId?: string | null;
  commitments: Commitment[];
  decisions: Decision[];
  projects: Project[];
  goals: Goal[];
}): AccountabilityStatement[] {
  const out: AccountabilityStatement[] = [];
  const { userId, commitments, decisions, projects, goals } = input;

  const myOverdue = commitments.filter(
    (c) => c.owner_user_id === userId && isCommitmentOverdue(c),
  );
  if (myOverdue.length) {
    out.push({
      id: "overdue-mine",
      text: `${myOverdue.length} overdue commitment${myOverdue.length === 1 ? "" : "s"} belong${myOverdue.length === 1 ? "s" : ""} to you.`,
      link: { to: "/accountability" },
      weight: 100,
    });
  }

  const dueSoon = commitments.filter(
    (c) => c.owner_user_id === userId && isCommitmentDueSoon(c),
  );
  if (dueSoon.length) {
    out.push({
      id: "due-soon",
      text: `${dueSoon.length} commitment${dueSoon.length === 1 ? "" : "s"} due within seven days.`,
      link: { to: "/accountability" },
      weight: 60,
    });
  }

  const repeated = commitments.filter(
    (c) =>
      (c.postponement_count ?? 0) >= REPEATED_POSTPONEMENTS &&
      c.status !== "completed" &&
      c.status !== "canceled",
  );
  if (repeated.length) {
    out.push({
      id: "repeated",
      text: `${repeated.length} commitment${repeated.length === 1 ? " has" : "s have"} been postponed multiple times.`,
      link: { to: "/accountability" },
      weight: 80,
    });
  }

  const decisionsWaiting = decisions.filter((d) => isDecisionWaiting(d, userId));
  if (decisionsWaiting.length) {
    out.push({
      id: "decisions-waiting",
      text: `${decisionsWaiting.length} decision${decisionsWaiting.length === 1 ? " is" : "s are"} waiting for your response.`,
      link: { to: "/decisions" },
      weight: 90,
    });
  }

  const reviewDue = decisions.filter(
    (d) => d.review_date && d.review_date <= isoToday() && d.status !== "closed",
  );
  reviewDue.slice(0, 2).forEach((d) => {
    const days = -daysBetween(isoToday(), d.review_date!);
    out.push({
      id: `review-${d.id}`,
      text:
        days === 0
          ? `"${d.title}" is scheduled for review today.`
          : `"${d.title}" was scheduled for review ${days} day${days === 1 ? "" : "s"} ago.`,
      link: { to: "/decisions/$id", params: { id: d.id } },
      weight: 55,
    });
  });

  const stalled = projects.filter((p) => isProjectStalled(p));
  stalled.slice(0, 2).forEach((p) => {
    const days = daysBetween(p.updated_at, new Date());
    out.push({
      id: `stalled-${p.id}`,
      text: `"${p.name}" hasn't moved in ${days} days.`,
      link: { to: "/projects/$id", params: { id: p.id } },
      weight: 40,
    });
  });

  const myBlocked = projects.filter(
    (p) =>
      p.owner_user_id === userId && (p.status === "blocked" || p.status === "at_risk"),
  );
  if (myBlocked.length) {
    out.push({
      id: "blocked-mine",
      text: `You own ${myBlocked.length} ${myBlocked.length === 1 ? "project" : "projects"} that ${myBlocked.length === 1 ? "is" : "are"} blocked or at risk.`,
      link: { to: "/projects" },
      weight: 70,
    });
  }

  const goalsAtRisk = goals.filter(isGoalAtRisk);
  if (goalsAtRisk.length) {
    out.push({
      id: "goals-at-risk",
      text: `${goalsAtRisk.length} goal${goalsAtRisk.length === 1 ? "" : "s"} at risk of missing target.`,
      link: { to: "/goals" },
      weight: 65,
    });
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, 6);
}

/** Priority scoring for Today's Priorities on Command. */
export function scorePriority(input: {
  userId?: string | null;
  commitment?: Commitment;
  decision?: Decision;
  project?: Project;
}): number {
  let score = 0;
  const { commitment: c, decision: d, project: p, userId } = input;
  if (c) {
    if (c.owner_user_id === userId) score += 20;
    if (isCommitmentOverdue(c)) score += 60;
    else if (isCommitmentDueSoon(c)) score += 30;
    if (c.priority === "critical") score += 25;
    else if (c.priority === "high") score += 12;
    if ((c.postponement_count ?? 0) >= REPEATED_POSTPONEMENTS) score += 15;
  }
  if (d) {
    if (d.owner_user_id === userId) score += 20;
    if (d.status === "waiting_for_founder") score += 45;
    if (d.review_date && d.review_date <= isoToday()) score += 30;
  }
  if (p) {
    if (p.owner_user_id === userId) score += 15;
    if (p.status === "blocked") score += 35;
    else if (p.status === "at_risk") score += 20;
    if (isProjectStalled(p)) score += 15;
  }
  return score;
}