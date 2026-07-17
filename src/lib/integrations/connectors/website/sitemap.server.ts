// Sitemap discovery. Parses <sitemapindex> and <urlset> documents up to a
// bounded number of entries. Never follows nested sitemaps beyond one level.

import { safeFetchText } from "./fetch.server";
import { validatePublicUrl, sameRegistrableHost, type SafeUrl } from "./url-safety.server";
import { isIntegrationError } from "../../errors";

const MAX_SITEMAP_URLS = 500;
const MAX_NESTED_SITEMAPS = 5;
const XML_ACCEPTS = ["xml", "text/plain"];

function extractTagValues(xml: string, tag: string): string[] {
  const rx = new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*</${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(xml))) {
    const val = m[1]
      .replace(/<!\[CDATA\[/g, "")
      .replace(/\]\]>/g, "")
      .trim();
    if (val) out.push(val);
    if (out.length >= MAX_SITEMAP_URLS) break;
  }
  return out;
}

async function fetchXml(url: string): Promise<string | null> {
  try {
    const res = await safeFetchText(url, { acceptContentTypes: XML_ACCEPTS });
    return res.text;
  } catch (err) {
    if (isIntegrationError(err)) return null;
    return null;
  }
}

export interface SitemapDiscovery {
  urls: SafeUrl[];
  sitemapsFetched: string[];
}

export async function discoverSitemapUrls(origin: string, seedSitemaps: string[]): Promise<SitemapDiscovery> {
  const originHost = new URL(origin).hostname.toLowerCase();
  const candidates = new Set<string>([`${origin.replace(/\/$/, "")}/sitemap.xml`, ...seedSitemaps]);
  const fetched: string[] = [];
  const urls = new Map<string, SafeUrl>();
  const nested: string[] = [];

  for (const raw of candidates) {
    if (fetched.length >= MAX_NESTED_SITEMAPS) break;
    let safe: SafeUrl;
    try {
      safe = validatePublicUrl(raw);
    } catch {
      continue;
    }
    if (!sameRegistrableHost(safe.hostname, originHost)) continue;
    const xml = await fetchXml(safe.href);
    if (!xml) continue;
    fetched.push(safe.href);

    if (/<sitemapindex\b/i.test(xml)) {
      for (const loc of extractTagValues(xml, "loc")) {
        if (nested.length >= MAX_NESTED_SITEMAPS) break;
        nested.push(loc);
      }
      continue;
    }

    for (const loc of extractTagValues(xml, "loc")) {
      let sl: SafeUrl;
      try {
        sl = validatePublicUrl(loc);
      } catch {
        continue;
      }
      if (!sameRegistrableHost(sl.hostname, originHost)) continue;
      urls.set(sl.href, sl);
      if (urls.size >= MAX_SITEMAP_URLS) break;
    }
    if (urls.size >= MAX_SITEMAP_URLS) break;
  }

  for (const raw of nested) {
    if (urls.size >= MAX_SITEMAP_URLS) break;
    if (fetched.length >= MAX_NESTED_SITEMAPS * 2) break;
    let safe: SafeUrl;
    try {
      safe = validatePublicUrl(raw);
    } catch {
      continue;
    }
    if (!sameRegistrableHost(safe.hostname, originHost)) continue;
    const xml = await fetchXml(safe.href);
    if (!xml) continue;
    fetched.push(safe.href);
    for (const loc of extractTagValues(xml, "loc")) {
      let sl: SafeUrl;
      try {
        sl = validatePublicUrl(loc);
      } catch {
        continue;
      }
      if (!sameRegistrableHost(sl.hostname, originHost)) continue;
      urls.set(sl.href, sl);
      if (urls.size >= MAX_SITEMAP_URLS) break;
    }
  }

  return { urls: Array.from(urls.values()), sitemapsFetched: fetched };
}