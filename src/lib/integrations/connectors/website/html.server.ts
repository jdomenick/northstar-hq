// Minimal HTML text + link extraction. Deliberately simple - runs in the
// Cloudflare Worker runtime, which forbids headless browsers.

export interface HtmlSummary {
  title: string;
  metaDescription: string | null;
  headings: string[];
  text: string;
  links: string[];
}

function stripBlock(input: string, tag: string): string {
  const rx = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "gi");
  return input.replace(rx, " ");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return code > 0 && code < 0xffff ? String.fromCharCode(code) : "";
    });
}

export function extractHtml(html: string): HtmlSummary {
  let body = html;
  body = stripBlock(body, "script");
  body = stripBlock(body, "style");
  body = stripBlock(body, "noscript");
  body = stripBlock(body, "template");

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, " ").trim() : "";

  const descMatch = /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i.exec(html)
    ?? /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i.exec(html);
  const metaDescription = descMatch ? decodeEntities(descMatch[1]).trim() : null;

  const headings: string[] = [];
  const hRx = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hRx.exec(body))) {
    const text = decodeEntities(hm[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (text) headings.push(text);
    if (headings.length >= 50) break;
  }

  const links: string[] = [];
  const aRx = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let am: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((am = aRx.exec(html))) {
    const href = am[1];
    if (seen.has(href)) continue;
    seen.add(href);
    links.push(href);
    if (links.length >= 500) break;
  }

  const text = decodeEntities(body.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return { title, metaDescription, headings, text, links };
}