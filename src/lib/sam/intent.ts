// Deterministic intent classification. Falls back to a general executive
// question when nothing matches. Provider-based classification is a Phase 3B
// upgrade.

export type SamIntent =
  | "organization_overview"
  | "venture_overview"
  | "priority_review"
  | "commitment_review"
  | "project_review"
  | "goal_review"
  | "decision_review"
  | "knowledge_lookup"
  | "activity_summary"
  | "general_executive_question"
  | "unsupported_action_request";

const RULES: Array<{ intent: SamIntent; patterns: RegExp[] }> = [
  {
    intent: "unsupported_action_request",
    patterns: [
      /\b(create|add|delete|remove|archive|update|change|set|assign|email|send|schedule|invite|approve|reject|mark|move)\b/i,
    ],
  },
  {
    intent: "commitment_review",
    patterns: [/\bcommit(ment)?s?\b/i, /\boverdue\b/i, /\bfalling behind\b/i, /\baccountab/i],
  },
  {
    intent: "project_review",
    patterns: [/\bprojects?\b/i, /\bstalled?\b/i, /\bat risk\b/i],
  },
  {
    intent: "goal_review",
    patterns: [/\bgoals?\b/i, /\btargets?\b/i, /\bokrs?\b/i],
  },
  {
    intent: "decision_review",
    patterns: [/\bdecisions?\b/i, /\bdecide\b/i, /\bwaiting on me\b/i],
  },
  {
    intent: "knowledge_lookup",
    patterns: [/\bknowledge\b/i, /\bwhat do we know\b/i, /\baccording to\b/i],
  },
  {
    intent: "activity_summary",
    patterns: [/\bactivity\b/i, /\brecent(ly)?\b/i, /\bthis week\b/i, /\btoday\b/i],
  },
  {
    intent: "venture_overview",
    patterns: [/\bventures?\b/i, /\bcompare\b.*\bventures?\b/i],
  },
  {
    intent: "priority_review",
    patterns: [
      /\bpriorit/i,
      /\bwhat should i (do|focus)\b/i,
      /\bwhat deserves my attention\b/i,
      /\bfocus on\b/i,
    ],
  },
  {
    intent: "organization_overview",
    patterns: [/\borganization\b/i, /\boverall\b/i, /\bhow are we doing\b/i, /\bstate of\b/i],
  },
];

export function classifyIntent(message: string): SamIntent {
  const trimmed = message.trim();
  if (!trimmed) return "general_executive_question";
  for (const { intent, patterns } of RULES) {
    if (patterns.some((r) => r.test(trimmed))) return intent;
  }
  return "general_executive_question";
}