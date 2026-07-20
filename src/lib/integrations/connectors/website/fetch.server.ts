// Safe outbound HTTP fetch for the website connector.
// Enforces timeout, response-size limit, redirect revalidation, and never
// follows redirects blindly - each redirected URL is validated again.

import { INTEGRATION_LIMITS } from "@/lib/constants";
import { IntegrationError } from "../../errors";
import { validatePublicUrl, type SafeUrl } from "./url-safety.server";

const MAX_REDIRECTS = 5;
const USER_AGENT = "NorthStar LabsBot/1.0 (+https://northstar-operator-core.lovable.app)";

export interface FetchTextResult {
  finalUrl: SafeUrl;
  status: number;
  contentType: string;
  text: string;
  bytes: number;
  truncated: boolean;
}

async function readWithLimit(res: Response, maxBytes: number): Promise<{ text: string; bytes: number; truncated: boolean }> {
  if (!res.body) {
    const text = await res.text();
    const buf = new TextEncoder().encode(text);
    if (buf.byteLength > maxBytes) {
      return { text: new TextDecoder().decode(buf.slice(0, maxBytes)), bytes: maxBytes, truncated: true };
    }
    return { text, bytes: buf.byteLength, truncated: false };
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (total + value.byteLength > maxBytes) {
      chunks.push(value.slice(0, Math.max(0, maxBytes - total)));
      total = maxBytes;
      truncated = true;
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return { text: new TextDecoder("utf-8", { fatal: false }).decode(merged), bytes: total, truncated };
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  acceptContentTypes?: string[]; // substrings; empty means any
  headers?: Record<string, string>;
}

export async function safeFetchText(rawUrl: string, opts: SafeFetchOptions = {}): Promise<FetchTextResult> {
  const timeoutMs = opts.timeoutMs ?? INTEGRATION_LIMITS.requestTimeoutMs;
  const maxBytes = opts.maxBytes ?? INTEGRATION_LIMITS.maxResponseBytes;
  const accepts = opts.acceptContentTypes ?? [];

  let current = validatePublicUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(current.href, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5",
          ...(opts.headers ?? {}),
        },
      });
    } catch (err) {
      clearTimeout(timer);
      const name = (err as { name?: string })?.name;
      if (name === "AbortError") throw new IntegrationError("request_timeout");
      throw new IntegrationError("network_error");
    }
    clearTimeout(timer);

    // Handle redirects manually so every hop is re-validated.
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      try { await res.body?.cancel(); } catch { /* ignore */ }
      if (!loc || hop === MAX_REDIRECTS) throw new IntegrationError("network_error", "too many redirects");
      let next: string;
      try {
        next = new URL(loc, current.href).toString();
      } catch {
        throw new IntegrationError("network_error", "invalid redirect");
      }
      current = validatePublicUrl(next);
      continue;
    }

    const contentLength = Number(res.headers.get("content-length") ?? "0");
    if (contentLength && contentLength > maxBytes) {
      try { await res.body?.cancel(); } catch { /* ignore */ }
      throw new IntegrationError("response_too_large");
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (accepts.length && !accepts.some((c) => contentType.includes(c))) {
      try { await res.body?.cancel(); } catch { /* ignore */ }
      throw new IntegrationError("unsupported_content_type", contentType || "unknown");
    }

    if (res.status >= 500) throw new IntegrationError("http_server_error", String(res.status));
    if (res.status >= 400) throw new IntegrationError("http_client_error", String(res.status));

    const body = await readWithLimit(res, maxBytes);
    return {
      finalUrl: current,
      status: res.status,
      contentType,
      text: body.text,
      bytes: body.bytes,
      truncated: body.truncated,
    };
  }
  throw new IntegrationError("network_error", "redirect loop");
}