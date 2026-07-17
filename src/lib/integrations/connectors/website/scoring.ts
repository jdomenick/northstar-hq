// Deterministic page-type classification + relevance scoring.
// Pure function - no I/O, no provider synthesis. Provider output must never
// override these values (per 3D architecture rules).

import type { ContentCategory } from "@/lib/constants";

export interface ScoredPage {
  pageType: string;
  category: ContentCategory;
  relevanceScore: number; // 0..1
  matchedSignals: string[];
}

interface Rule {
  pageType: string;
  category: ContentCategory;
  base: number;
  patterns: RegExp[];
  titleHints?: RegExp[];
}

const RULES: Rule[] = [
  { pageType: "home", category: "company_overview", base: 0.95, patterns: [/^\/$/, /^\/index(\.html?)?$/i] },
  { pageType: "about", category: "company_overview", base: 0.9, patterns: [/^\/about(\/|$)/i, /^\/company(\/|$)/i, /^\/who-we-are(\/|$)/i] },
  { pageType: "team", category: "team", base: 0.75, patterns: [/^\/team(\/|$)/i, /^\/people(\/|$)/i, /^\/leadership(\/|$)/i] },
  { pageType: "product", category: "product", base: 0.85, patterns: [/^\/product(s)?(\/|$)/i, /^\/features(\/|$)/i, /^\/platform(\/|$)/i] },
  { pageType: "service", category: "service", base: 0.85, patterns: [/^\/service(s)?(\/|$)/i, /^\/solutions?(\/|$)/i] },
  { pageType: "pricing", category: "pricing", base: 0.9, patterns: [/^\/pricing(\/|$)/i, /^\/plans(\/|$)/i] },
  { pageType: "docs", category: "documentation", base: 0.7, patterns: [/^\/docs?(\/|$)/i, /^\/documentation(\/|$)/i, /^\/guides?(\/|$)/i, /^\/reference(\/|$)/i] },
  { pageType: "help", category: "help", base: 0.55, patterns: [/^\/help(\/|$)/i, /^\/support(\/|$)/i, /^\/faq(\/|$)/i, /^\/contact(\/|$)/i] },
  { pageType: "blog_index", category: "blog", base: 0.6, patterns: [/^\/blog\/?$/i, /^\/news\/?$/i, /^\/articles?\/?$/i, /^\/insights\/?$/i] },
  { pageType: "blog_post", category: "blog", base: 0.45, patterns: [/^\/blog\/.+/i, /^\/news\/.+/i, /^\/articles?\/.+/i, /^\/insights\/.+/i, /^\/\d{4}\/\d{2}\//] },
  { pageType: "legal", category: "legal", base: 0.4, patterns: [/^\/(terms|privacy|legal|cookies?|gdpr|dpa|imprint)(\/|$)/i] },
  { pageType: "case_study", category: "marketing", base: 0.7, patterns: [/^\/(case-stud|customers?|success-stor)/i] },
  { pageType: "policy", category: "policy", base: 0.4, patterns: [/^\/(security|compliance|policies)(\/|$)/i] },
];

// Path patterns we actively deprioritize.
const NOISE_PATTERNS: RegExp[] = [
  /\/tag(s)?\//i,
  /\/category\//i,
  /\/page\/\d+/i,
  /\/author\//i,
  /\/search/i,
  /\/cart(\/|$)/i,
  /\/checkout(\/|$)/i,
  /\/account(\/|$)/i,
  /\/login(\/|$)/i,
  /\.(jpg|jpeg|png|gif|svg|webp|ico|css|js|pdf|zip|mp4|mp3)$/i,
];

export function scorePath(pathname: string, title = ""): ScoredPage {
  const path = pathname || "/";
  const signals: string[] = [];

  for (const noise of NOISE_PATTERNS) {
    if (noise.test(path)) {
      return { pageType: "excluded", category: "other", relevanceScore: 0, matchedSignals: ["noise"] };
    }
  }

  for (const rule of RULES) {
    for (const rx of rule.patterns) {
      if (rx.test(path)) {
        let score = rule.base;
        // Slight penalty for deep paths.
        const depth = path.split("/").filter(Boolean).length;
        if (depth >= 4) score -= 0.05 * Math.min(3, depth - 3);
        // Title hints can bump score slightly (deterministic - lowercase keyword match).
        const t = title.toLowerCase();
        if (t) {
          if (rule.category === "pricing" && /\bpricing|plans?\b/.test(t)) { score += 0.03; signals.push("title:pricing"); }
          if (rule.category === "company_overview" && /\babout|company|mission\b/.test(t)) { score += 0.03; signals.push("title:about"); }
        }
        score = Math.max(0, Math.min(1, score));
        signals.unshift(`path:${rule.pageType}`);
        return { pageType: rule.pageType, category: rule.category, relevanceScore: Number(score.toFixed(4)), matchedSignals: signals };
      }
    }
  }

  // Fallback: shallow paths get a modest score; deep paths get very little.
  const depth = path.split("/").filter(Boolean).length;
  const base = depth <= 1 ? 0.35 : depth === 2 ? 0.25 : 0.15;
  return { pageType: "other", category: "other", relevanceScore: base, matchedSignals: [`depth:${depth}`] };
}