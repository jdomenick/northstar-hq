// Deterministic content classification. Given normalized content plus its
// URL-based ScoredPage, decide the final ContentCategory + confidence with
// pure logic. Provider output must never override these values.

import type { ContentCategory } from "@/lib/constants";
import type { ScoredPage } from "./connectors/website/scoring";

export interface ClassificationInput {
  urlScore: ScoredPage;
  title: string;
  text: string | null;
}

export interface ClassificationResult {
  category: ContentCategory;
  pageType: string;
  confidence: number;             // 0..1
  signals: Record<string, unknown>;
}

// Small deterministic keyword table per category. Case-insensitive substring
// match; the URL-based score is the primary signal and always wins ties.
const KEYWORD_BOOSTS: Array<{ category: ContentCategory; keywords: RegExp }> = [
  { category: "pricing",          keywords: /\b(pricing|price|plans?|subscribe|checkout)\b/i },
  { category: "product",          keywords: /\b(product|feature|platform|capabilit(y|ies))\b/i },
  { category: "service",          keywords: /\b(service|solution|offering)\b/i },
  { category: "documentation",    keywords: /\b(documentation|docs|guide|reference|api)\b/i },
  { category: "legal",            keywords: /\b(terms|privacy|policy|gdpr|dpa|imprint)\b/i },
  { category: "team",             keywords: /\b(team|leadership|founder|about us)\b/i },
  { category: "blog",             keywords: /\b(blog|article|post|news)\b/i },
  { category: "help",             keywords: /\b(help|support|faq|contact)\b/i },
  { category: "company_overview", keywords: /\b(company|mission|vision|who we are)\b/i },
];

export function classifyContent(input: ClassificationInput): ClassificationResult {
  const baseline: ContentCategory = input.urlScore.category;
  const text = (input.text ?? "").slice(0, 20000).toLowerCase();
  const title = input.title.toLowerCase();
  const combined = `${title}\n${text}`;

  const matched: ContentCategory[] = [];
  for (const rule of KEYWORD_BOOSTS) {
    if (rule.keywords.test(combined)) matched.push(rule.category);
  }

  // Confidence: start from URL score, add small boost when the baseline
  // category also appears in the keyword matches. Clamp to [0,1].
  let confidence = input.urlScore.relevanceScore;
  const baselineAgrees = matched.includes(baseline);
  if (baselineAgrees) confidence = Math.min(1, confidence + 0.1);
  if (matched.length >= 2 && baselineAgrees) confidence = Math.min(1, confidence + 0.05);
  if (!baselineAgrees && matched.length === 0) confidence = Math.max(0, confidence - 0.1);

  return {
    category: baseline,
    pageType: input.urlScore.pageType,
    confidence: Number(confidence.toFixed(4)),
    signals: {
      url_score: input.urlScore.relevanceScore,
      url_signals: input.urlScore.matchedSignals,
      keyword_matches: matched,
      baseline_agrees: baselineAgrees,
    },
  };
}