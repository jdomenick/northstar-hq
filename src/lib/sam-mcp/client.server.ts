// Server-only MCP client for the deployed SAM Intelligent Operating Platform.
//
// Transport: Streamable HTTP (single POST endpoint, JSON body)
// Protocol:  Model Context Protocol 2025-06-18, JSON-RPC 2.0
//
// Every request:
//   - carries the SAM API key ONLY in the server-side Authorization header
//   - carries organization + actor identity in X-NorthStar Labs-* headers so SAM
//     preserves boundaries
//   - has a hard AbortController timeout
//   - passes through a tiny in-process token bucket to prevent hammering SAM
//
// The API key is read only from process.env.SAM_MCP_API_KEY and is never
// logged, echoed, returned, or persisted. Do not import this module from any
// route file, component, or client-safe module - only from *.server.ts files
// or the `.handler()` body of a createServerFn.

import { SamMcpError, type SamMcpErrorCode } from "./errors";

export const SAM_MCP_SERVER_URL =
  "https://sam-intelligent-operating-platform.lovable.app/api/public/mcp/v1";
export const SAM_MCP_PROTOCOL_VERSION = "2025-06-18";

const DEFAULT_TIMEOUT_MS = 15_000;

// Very small in-process token bucket, keyed by organization. Enough to stop
// a runaway loop; not a substitute for server-side rate limits inside SAM.
const RATE_BURST = 8;
const RATE_REFILL_PER_SEC = 4;
const rateBuckets = new Map<string, { tokens: number; updatedAt: number }>();

function consumeRate(orgId: string): boolean {
  const now = Date.now();
  const b = rateBuckets.get(orgId) ?? { tokens: RATE_BURST, updatedAt: now };
  const elapsed = (now - b.updatedAt) / 1000;
  b.tokens = Math.min(RATE_BURST, b.tokens + elapsed * RATE_REFILL_PER_SEC);
  b.updatedAt = now;
  if (b.tokens < 1) {
    rateBuckets.set(orgId, b);
    return false;
  }
  b.tokens -= 1;
  rateBuckets.set(orgId, b);
  return true;
}

export interface SamMcpCallContext {
  organizationId: string;
  actorUserId: string;
  /** Optional correlation id propagated to SAM in X-Request-Id. */
  requestId?: string;
  /** Override the default timeout for a single call. */
  timeoutMs?: number;
}

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

function requireApiKey(): string {
  const k = process.env.SAM_MCP_API_KEY;
  if (!k || k.trim().length < 8) {
    throw new SamMcpError("missing_sam_mcp_api_key", "SAM MCP API key is not configured on this server.");
  }
  return k;
}

function mapHttpStatus(status: number): SamMcpErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "tool_not_found";
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "protocol_error";
}

async function rpc<T>(
  method: string,
  params: Record<string, unknown> | undefined,
  ctx: SamMcpCallContext,
): Promise<{ result: T; operationId?: string }> {
  if (!consumeRate(ctx.organizationId)) {
    throw new SamMcpError("rate_limited", "NorthStar Labs rate-limited this SAM connection.");
  }
  const apiKey = requireApiKey();
  const abort = new AbortController();
  const timeoutMs = ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  const requestId = ctx.requestId ?? crypto.randomUUID();
  const body = {
    jsonrpc: "2.0" as const,
    id: requestId,
    method,
    params: params ?? {},
  };
  let response: Response;
  try {
    response = await fetch(SAM_MCP_SERVER_URL, {
      method: "POST",
      signal: abort.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${apiKey}`,
        "X-NorthStar Labs-Organization-Id": ctx.organizationId,
        "X-NorthStar Labs-Actor-User-Id": ctx.actorUserId,
        "X-NorthStar Labs-Client": "northstar-mcp-client/0.1.0",
        "X-Request-Id": requestId,
        "MCP-Protocol-Version": SAM_MCP_PROTOCOL_VERSION,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error)?.name === "AbortError") {
      throw new SamMcpError("timeout", `SAM did not respond within ${timeoutMs}ms.`);
    }
    throw new SamMcpError("network_error", "Network error reaching SAM.");
  }
  clearTimeout(timer);

  const operationId =
    response.headers.get("x-sam-operation-id") ?? response.headers.get("x-operation-id") ?? undefined;

  const contentType = response.headers.get("content-type") ?? "";
  let payload: unknown;
  try {
    if (contentType.includes("text/event-stream")) {
      const text = await response.text();
      // Parse the last `data:` line as JSON.
      const dataLines = text.split(/\r?\n/).filter((l) => l.startsWith("data:"));
      const last = dataLines[dataLines.length - 1]?.slice(5).trim();
      payload = last ? JSON.parse(last) : null;
    } else {
      payload = await response.json();
    }
  } catch {
    throw new SamMcpError("invalid_response", "SAM returned an unparseable response body.", {
      status: response.status,
      operationId,
    });
  }

  if (!response.ok) {
    throw new SamMcpError(mapHttpStatus(response.status), `SAM HTTP ${response.status}.`, {
      status: response.status,
      operationId,
    });
  }

  if (!payload || typeof payload !== "object" || (payload as { jsonrpc?: unknown }).jsonrpc !== "2.0") {
    throw new SamMcpError("invalid_response", "SAM response is not JSON-RPC 2.0.", { operationId });
  }
  const rpcRes = payload as JsonRpcResponse<T>;
  if (rpcRes.error) {
    throw new SamMcpError("protocol_error", `SAM JSON-RPC error ${rpcRes.error.code}.`, { operationId });
  }
  if (rpcRes.result === undefined) {
    throw new SamMcpError("invalid_response", "SAM response missing result.", { operationId });
  }
  return { result: rpcRes.result, operationId };
}

// ---- Typed MCP methods ----

export interface McpInitializeResult {
  protocolVersion: string;
  serverInfo?: { name?: string; version?: string };
  capabilities?: Record<string, unknown>;
}

export interface McpToolDescriptor {
  name: string;
  description?: string;
}

export async function mcpInitialize(ctx: SamMcpCallContext) {
  return rpc<McpInitializeResult>(
    "initialize",
    {
      protocolVersion: SAM_MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "northstar", version: "0.1.0" },
    },
    ctx,
  );
}

export async function mcpListTools(ctx: SamMcpCallContext) {
  return rpc<{ tools: McpToolDescriptor[] }>("tools/list", {}, ctx);
}

export interface McpToolCallResult {
  content?: Array<{ type: string; text?: string; [k: string]: unknown }>;
  structuredContent?: unknown;
  isError?: boolean;
}

export async function mcpCallTool(
  ctx: SamMcpCallContext,
  toolName: string,
  args: Record<string, unknown>,
) {
  return rpc<McpToolCallResult>("tools/call", { name: toolName, arguments: args }, ctx);
}