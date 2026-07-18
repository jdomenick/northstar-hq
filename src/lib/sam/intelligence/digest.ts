// Pure Executive Digest assembler. Consumes already-computed inputs.

import {
  DIGEST_METHOD_VERSION,
  type DigestReport,
  type DigestSection,
  type DigestItem,
  type HealthReport,
} from "./types";
import type {
  DsCommitment,
  DsDecision,
  DsGoal,
  DsProject,
  IntelligenceDataset,
} from "./detectors";

export interface DigestInputs {
  dataset: IntelligenceDataset;
  insights: Array<{
    id: string;
    pattern_key: string | null;
    title: string;
    summary: string | null;
    priority: string;
    entity_ref: string | null;
  }>;
  recommendations: Array<{
    id: string;
    kind: string;
    title: string;
    rationale: string;
    priority: string;
  }>;
  health: HealthReport | null;
  healthSnapshotId: string | null;
  recentlyLearned: Array<{ id: string; title: string; summary: string | null }>;
  recentWins: Array<{ id: string; kind: "goal" | "project" | "commitment"; title: string }>;
}

function projectHref(id: string): string {
  return `/projects/${id}`;
}
function commitmentHref(id: string): string {
  return `/commitments/${id}`;
}
function decisionHref(id: string): string {
  return `/decisions/${id}`;
}
function goalHref(id: string): string {
  return `/goals/${id}`;
}

export function assembleDigest(input: DigestInputs): DigestReport {
  const { dataset: ds } = input;
  const now = ds.now;
  const in7Days = new Date(now.getTime() + 7 * 86_400_000);

  // Today's priorities: overdue commitments + open decisions past review + at-risk projects
  const todaysItems: DigestItem[] = [];
  const overdueCommitments = ds.commitments
    .filter((c) => !c.deleted_at && c.status !== "completed" && c.status !== "canceled")
    .filter((c) => c.due_date && new Date(c.due_date) <= now)
    .slice(0, 6);
  for (const c of overdueCommitments) {
    todaysItems.push({
      ref: { type: "commitment", id: c.id, title: c.title },
      headline: c.title,
      detail: `Due ${c.due_date} - ${c.status}`,
      href: commitmentHref(c.id),
    });
  }
  const atRiskProjects = ds.projects
    .filter((p) => !p.deleted_at && (p.status === "at_risk" || p.status === "blocked"))
    .slice(0, 4);
  for (const p of atRiskProjects) {
    todaysItems.push({
      ref: { type: "project", id: p.id, title: p.name },
      headline: p.name,
      detail: `${p.status.replaceAll("_", " ")} - ${p.progress_percentage}%`,
      href: projectHref(p.id),
    });
  }

  // Critical risks: critical/high insights
  const critical = input.insights
    .filter((i) => i.priority === "critical" || i.priority === "high")
    .slice(0, 6);

  // Projects needing attention: stalled/long-running insights
  const attention = input.insights
    .filter((i) => i.pattern_key === "stalled_project" || i.pattern_key === "long_running_project")
    .slice(0, 6);

  // Upcoming commitments (next 7d)
  const upcoming = ds.commitments
    .filter((c) => !c.deleted_at && c.status !== "completed" && c.status !== "canceled")
    .filter((c) => c.due_date && new Date(c.due_date) > now && new Date(c.due_date) <= in7Days)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 8);

  // Decisions waiting: past review_date or in review status
  const decisionsWaiting = ds.decisions
    .filter((d) => !d.deleted_at)
    .filter(
      (d) =>
        d.status === "under_review" ||
        d.status === "waiting_for_founder" ||
        (d.review_date && new Date(d.review_date) <= now && d.status !== "decided" && d.status !== "closed"),
    )
    .slice(0, 6);

  const sections: DigestSection[] = [
    section("todays_priorities", "Today's priorities", todaysItems),
    section(
      "critical_risks",
      "Critical risks",
      critical.map<DigestItem>((i) => ({
        ref: null,
        headline: i.title,
        detail: i.summary ?? "",
        href: null,
        meta: { priority: i.priority },
      })),
    ),
    section(
      "projects_attention",
      "Projects needing attention",
      attention.map<DigestItem>((i) => ({
        ref: null,
        headline: i.title,
        detail: i.summary ?? "",
        href: null,
      })),
    ),
    section(
      "upcoming_commitments",
      "Upcoming commitments",
      upcoming.map<DigestItem>((c: DsCommitment) => ({
        ref: { type: "commitment", id: c.id, title: c.title },
        headline: c.title,
        detail: `Due ${c.due_date}`,
        href: commitmentHref(c.id),
      })),
    ),
    section(
      "decisions_waiting",
      "Decisions waiting",
      decisionsWaiting.map<DigestItem>((d: DsDecision) => ({
        ref: { type: "decision", id: d.id, title: d.title },
        headline: d.title,
        detail: d.status.replaceAll("_", " "),
        href: decisionHref(d.id),
      })),
    ),
    section(
      "recently_learned",
      "Recently learned",
      input.recentlyLearned.slice(0, 5).map<DigestItem>((m) => ({
        ref: null,
        headline: m.title,
        detail: m.summary ?? "",
        href: null,
      })),
    ),
    section(
      "recommended_actions",
      "Recommended actions",
      input.recommendations.slice(0, 5).map<DigestItem>((r) => ({
        ref: null,
        headline: r.title,
        detail: r.rationale,
        href: null,
        meta: { priority: r.priority, kind: r.kind },
      })),
    ),
    section(
      "recent_wins",
      "Recent wins",
      input.recentWins.slice(0, 5).map<DigestItem>((w) => ({
        ref: { type: w.kind === "goal" ? "goal" : w.kind === "project" ? "project" : "commitment", id: w.id, title: w.title },
        headline: w.title,
        detail: `Completed`,
        href:
          w.kind === "goal"
            ? goalHref(w.id)
            : w.kind === "project"
              ? projectHref(w.id)
              : commitmentHref(w.id),
      })),
    ),
  ];

  return {
    sections,
    insightIds: input.insights.map((i) => i.id),
    recommendationIds: input.recommendations.map((r) => r.id),
    healthSnapshotId: input.healthSnapshotId,
    methodVersion: DIGEST_METHOD_VERSION,
    generatedAt: now.toISOString(),
  };
}

function section(key: DigestSection["key"], title: string, items: DigestItem[]): DigestSection {
  return { key, title, items };
}

// re-export for downstream typing
export type { DsGoal, DsProject };