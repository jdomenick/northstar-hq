// Minimal robots.txt parser for the User-agent: * group.
// Fetches robots.txt once per host and caches within a discovery run.
// If robots.txt is missing (404), we assume "allow all". If it fails for
// other reasons, we err on the side of caution and disallow crawling.

import { safeFetchText } from "./fetch.server";
import { validatePublicUrl } from "./url-safety.server";
import { IntegrationError, isIntegrationError } from "../../errors";

export interface RobotsPolicy {
  allowed: (path: string) => boolean;
  crawlDelayMs: number;
  sitemaps: string[];
}

function parseRobots(text: string): { disallows: string[]; allows: string[]; crawlDelay: number; sitemaps: string[] } {
  const lines = text.split(/\r?\n/);
  let inStarGroup = false;
  let anyGroupSeen = false;
  const disallows: string[] = [];
  const allows: string[] = [];
  const sitemaps: string[] = [];
  let crawlDelay = 0;

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "sitemap" && value) {
      sitemaps.push(value);
      continue;
    }
    if (field === "user-agent") {
      inStarGroup = value === "*";
      anyGroupSeen = true;
      continue;
    }
    if (!anyGroupSeen || !inStarGroup) continue;
    if (field === "disallow") {
      if (value === "") continue; // Empty disallow means allow all in RFC.
      disallows.push(value);
    } else if (field === "allow") {
      allows.push(value);
    } else if (field === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) crawlDelay = Math.min(n, 30);
    }
  }
  return { disallows, allows, crawlDelay, sitemaps };
}

function matches(path: string, rule: string): boolean {
  if (!rule) return false;
  // Simple prefix match; support trailing $ and * wildcard in a basic way.
  if (rule.includes("*") || rule.endsWith("$")) {
    const escaped = rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const rx = new RegExp("^" + (escaped.endsWith("$") ? escaped : escaped));
    return rx.test(path);
  }
  return path.startsWith(rule);
}

export async function fetchRobotsPolicy(origin: string): Promise<RobotsPolicy> {
  const robotsUrl = `${origin.replace(/\/$/, "")}/robots.txt`;
  try {
    validatePublicUrl(robotsUrl);
  } catch {
    return { allowed: () => false, crawlDelayMs: 0, sitemaps: [] };
  }
  try {
    const res = await safeFetchText(robotsUrl, { maxBytes: 256 * 1024, acceptContentTypes: [] });
    const parsed = parseRobots(res.text);
    return {
      allowed: (path) => {
        const allowMatch = parsed.allows.find((r) => matches(path, r));
        const disMatch = parsed.disallows.find((r) => matches(path, r));
        if (allowMatch && disMatch) return allowMatch.length >= disMatch.length;
        if (disMatch) return false;
        return true;
      },
      crawlDelayMs: parsed.crawlDelay * 1000,
      sitemaps: parsed.sitemaps,
    };
  } catch (err) {
    if (isIntegrationError(err) && err.code === "http_client_error") {
      // 404 or similar - treat as no robots.txt (allow all).
      return { allowed: () => true, crawlDelayMs: 0, sitemaps: [] };
    }
    throw new IntegrationError("blocked_by_robots", "robots.txt could not be verified");
  }
}