// Website discovery orchestrator for 3D.2a.
// Given a homepage URL, this module:
//   1. Validates + fetches the homepage (single hop, revalidated redirects).
//   2. Loads and honours robots.txt for User-agent: *.
//   3. Attempts sitemap discovery (/sitemap.xml + robots Sitemap: lines).
//   4. Falls back to a bounded same-domain crawl seeded from homepage links.
//   5. Deterministically scores each URL for relevance + page_type.
//   6. Persists candidate integration_sources (dedup by connection + URL).
//
// No change detection, versioning, classification beyond page type/category,
// or provider synthesis. Provider output MUST NOT influence any score.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { INTEGRATION_LIMITS } from "@/lib/constants";
import { IntegrationError, isIntegrationError, toIntegrationErrorCode } from "../../errors";
import { safeFetchText } from "./fetch.server";
import { fetchRobotsPolicy } from "./robots.server";
import { discoverSitemapUrls } from "./sitemap.server";
import { extractHtml } from "./html.server";
import { scorePath, type ScoredPage } from "./scoring";
import { resolveSameOriginLink, validatePublicUrl, type SafeUrl } from "./url-safety.server";

type SB = SupabaseClient<Database>;

const HTML_ACCEPTS = ["text/html", "application/xhtml+xml"];
const MAX_DISCOVERED = INTEGRATION_LIMITS.maxPagesPerSync;

interface Candidate {
  url: SafeUrl;
  title: string;
  depth: number;
  score: ScoredPage;
  httpStatus: number | null;
}

export interface DiscoveryResult {
  connectionId: string;
  runId: string;
  homepageUrl: string;
  totalCandidates: number;
  totalKept: number;
  totalCreated: number;
  totalSkipped: number;
  sitemapsFetched: number;
  crawlPagesFetched: number;
  robotsAllowed: boolean;
  errorCode?: string;
}

export interface DiscoveryContext {
  organizationId: string;
  ventureId: string | null;
  connectionId: string;
  runId: string;
  homepageUrl: string;
}

export async function runWebsiteDiscovery(supabase: SB, ctx: DiscoveryContext): Promise<DiscoveryResult> {
  const home = validatePublicUrl(ctx.homepageUrl);
  // Step 1: robots.txt
  const robots = await fetchRobotsPolicy(home.origin);

  if (!robots.allowed(home.pathname)) {
    throw new IntegrationError("blocked_by_robots", "Homepage is disallowed by robots.txt");
  }

  // Step 2: homepage fetch
  const homepage = await safeFetchText(home.href, { acceptContentTypes: HTML_ACCEPTS });
  const homeHtml = extractHtml(homepage.text);
  const homeCandidate: Candidate = {
    url: homepage.finalUrl,
    title: homeHtml.title || home.hostname,
    depth: 0,
    score: scorePath(homepage.finalUrl.pathname, homeHtml.title),
    httpStatus: homepage.status,
  };

  const candidates = new Map<string, Candidate>();
  candidates.set(homepage.finalUrl.href, homeCandidate);

  // Step 3: sitemap discovery
  const sitemap = await discoverSitemapUrls(home.origin, robots.sitemaps);
  for (const u of sitemap.urls) {
    if (candidates.size >= MAX_DISCOVERED) break;
    if (!robots.allowed(u.pathname)) continue;
    if (candidates.has(u.href)) continue;
    candidates.set(u.href, {
      url: u,
      title: "",
      depth: 1,
      score: scorePath(u.pathname),
      httpStatus: null,
    });
  }

  // Step 4: bounded same-domain crawl seeded from homepage links.
  const crawlQueue: SafeUrl[] = [];
  for (const raw of homeHtml.links) {
    if (crawlQueue.length + candidates.size >= MAX_DISCOVERED * 2) break;
    const linked = resolveSameOriginLink(homepage.finalUrl, raw);
    if (!linked) continue;
    if (!robots.allowed(linked.pathname)) continue;
    if (candidates.has(linked.href)) continue;
    crawlQueue.push(linked);
  }

  let crawlFetched = 0;
  // Only fetch when we don't have enough via sitemap. Cap by remaining budget.
  const CRAWL_BUDGET = Math.max(0, Math.min(15, MAX_DISCOVERED - candidates.size));
  for (const link of crawlQueue) {
    if (crawlFetched >= CRAWL_BUDGET) break;
    if (candidates.size >= MAX_DISCOVERED) break;
    // Skip clearly noisy paths early.
    const preScore = scorePath(link.pathname);
    if (preScore.relevanceScore <= 0.15) {
      candidates.set(link.href, { url: link, title: "", depth: 1, score: preScore, httpStatus: null });
      continue;
    }
    try {
      const page = await safeFetchText(link.href, { acceptContentTypes: HTML_ACCEPTS });
      crawlFetched += 1;
      const parsed = extractHtml(page.text);
      const scored = scorePath(page.finalUrl.pathname, parsed.title);
      candidates.set(page.finalUrl.href, {
        url: page.finalUrl,
        title: parsed.title,
        depth: 1,
        score: scored,
        httpStatus: page.status,
      });
    } catch (err) {
      if (isIntegrationError(err)) continue;
      continue;
    }
  }

  // Step 5: rank + trim
  const ranked = Array.from(candidates.values())
    .sort((a, b) => b.score.relevanceScore - a.score.relevanceScore)
    .slice(0, MAX_DISCOVERED);

  // Step 6: persist as integration_sources (dedup by (connection_id, source_url))
  let created = 0;
  let skipped = 0;
  for (const c of ranked) {
    if (c.score.pageType === "excluded") { skipped += 1; continue; }
    const metadata = {
      matched_signals: c.score.matchedSignals,
      depth: c.depth,
      title: c.title || null,
      hostname: c.url.hostname,
    } as Record<string, unknown>;
    const { error } = await supabase
      .from("integration_sources")
      .upsert(
        {
          organization_id: ctx.organizationId,
          venture_id: ctx.ventureId,
          connection_id: ctx.connectionId,
          source_type: c.score.pageType === "home" ? "webpage" : c.score.pageType.startsWith("blog") ? "blog" : "webpage",
          source_url: c.url.href,
          title: (c.title || c.url.pathname).slice(0, 500),
          category: c.score.category,
          trust_level: "unverified",
          sync_enabled: false, // 3D.2a does not schedule syncs
          sync_frequency: "manual",
          page_type: c.score.pageType,
          relevance_score: c.score.relevanceScore,
          discovered_at: new Date().toISOString(),
          discovery_run_id: ctx.runId,
          http_status: c.httpStatus,
          metadata: metadata as unknown as Json,
        },
        { onConflict: "connection_id,source_url", ignoreDuplicates: false },
      );
    if (error) { skipped += 1; continue; }
    created += 1;
  }

  return {
    connectionId: ctx.connectionId,
    runId: ctx.runId,
    homepageUrl: home.href,
    totalCandidates: candidates.size,
    totalKept: ranked.length,
    totalCreated: created,
    totalSkipped: skipped,
    sitemapsFetched: sitemap.sitemapsFetched.length,
    crawlPagesFetched: crawlFetched,
    robotsAllowed: true,
  };
}

export function discoveryErrorCode(err: unknown): string {
  return toIntegrationErrorCode(err);
}