// Low-level Graph API v25.0 fetch wrapper. Never invoked without a token.
// All Meta HTTP goes through here so error classification is consistent.

import { META_GRAPH_VERSION } from "./config.server";
import { ProviderError } from "../errors";
import type { MetaFailureCode } from "./errors";

const GRAPH_BASE = "https://graph.facebook.com";

export interface GraphRequest {
  method: "GET" | "POST" | "DELETE";
  path: string; // "/me/accounts" - no version prefix
  accessToken: string;
  query?: Record<string, string | number | undefined>;
  body?: Record<string, unknown> | FormData;
  operation: string;
}

export interface GraphResponse<T = unknown> {
  ok: true;
  body: T;
  status: number;
}

export async function graphRequest<T = unknown>(req: GraphRequest): Promise<GraphResponse<T>> {
  const url = new URL(`${GRAPH_BASE}/${META_GRAPH_VERSION}${req.path}`);
  if (req.query) {
    for (const [k, v] of Object.entries(req.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  url.searchParams.set("access_token", req.accessToken);
  const init: RequestInit = { method: req.method };
  if (req.body instanceof FormData) {
    init.body = req.body;
  } else if (req.body) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(req.body);
  }
  let res: Response;
  try {
    res = await fetch(url.toString(), init);
  } catch (err) {
    throw new ProviderError("temporary_failure", `Meta network error: ${(err as Error).message}`, {
      providerKey: "meta",
      operation: req.operation,
      retryable: true,
    });
  }
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
  if (!res.ok) {
    throw classifyGraphError(res.status, parsed, req.operation);
  }
  return { ok: true, body: parsed as T, status: res.status };
}

interface MetaErrorBody {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number; fbtrace_id?: string };
}

function classifyGraphError(status: number, body: unknown, operation: string): ProviderError {
  const err = (body as MetaErrorBody | null)?.error ?? {};
  const code = err.code;
  const subcode = err.error_subcode;
  const message = err.message ?? `Meta returned HTTP ${status}`;
  let providerCode: import("../errors").ProviderErrorCode = "provider_error";
  let retryable = false;
  let failureCode: MetaFailureCode = "unknown_error";
  if (status === 429 || code === 4 || code === 17 || code === 32 || code === 613) {
    providerCode = "rate_limited"; retryable = true; failureCode = "rate_limit";
  } else if (status === 401 || code === 190) {
    providerCode = "unauthorized"; retryable = false;
    failureCode = subcode === 458 ? "authorization_revoked" : subcode === 463 ? "token_expired" : "token_expired";
  } else if (status === 403) {
    providerCode = "forbidden_scope"; retryable = false; failureCode = "missing_permission";
  } else if (status >= 500) {
    providerCode = "temporary_failure"; retryable = true; failureCode = "network_timeout";
  } else if (code === 100 || code === 200) {
    providerCode = "invalid_content"; retryable = false; failureCode = "provider_rejection";
  }
  return new ProviderError(providerCode, message, {
    providerKey: "meta",
    operation,
    httpStatus: status,
    providerCode: code ? String(code) : null,
    providerRaw: body,
    retryable,
    retryAfterSeconds: null,
    // @ts-expect-error - extend context with our taxonomy for downstream mapping
    metaFailureCode: failureCode,
  });
}
