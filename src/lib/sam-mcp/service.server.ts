// Reusable typed NorthStar Labs → SAM MCP service. All future SAM MCP calls
// MUST go through this service - no UI component or shared client-safe
// module may call the raw client. The service owns:
//   - persistence of connection status into public.sam_mcp_connections
//   - sanitized audit events (activity_events)
//   - typed helpers for the specific SAM tools NorthStar Labs consumes

import {
  mcpCallTool,
  mcpInitialize,
  mcpListTools,
  SAM_MCP_PROTOCOL_VERSION,
  SAM_MCP_SERVER_URL,
  type SamMcpCallContext,
} from "./client.server";
import { SamMcpError, safeMessage, type SamMcpErrorCode } from "./errors";

export type ConnectionStatus = "disconnected" | "testing" | "connected" | "failed" | "blocked";

export interface ConnectionRecord {
  status: ConnectionStatus;
  serverUrl: string;
  protocolVersion: string | null;
  lastTestedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastOperationId: string | null;
  discoveredTools: string[];
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function writeAudit(
  organizationId: string,
  actorUserId: string,
  action: string,
  metadata: Record<string, unknown>,
) {
  const sb = await admin();
  await sb
    .from("activity_events")
    .insert({
      organization_id: organizationId,
      actor_user_id: actorUserId,
      action,
      entity_type: "sam_mcp_connection",
      metadata: metadata as never,
    })
    .then(() => undefined, () => undefined);
}

async function upsertConnection(
  organizationId: string,
  patch: Partial<{
    status: ConnectionStatus;
    protocol_version: string | null;
    last_tested_at: string | null;
    last_success_at: string | null;
    last_error_code: string | null;
    last_error_message: string | null;
    last_operation_id: string | null;
    discovered_tools: string[];
  }>,
) {
  const sb = await admin();
  await sb
    .from("sam_mcp_connections")
    .upsert(
      {
        organization_id: organizationId,
        server_url: SAM_MCP_SERVER_URL,
        ...patch,
      } as never,
      { onConflict: "organization_id" },
    );
}

export async function readConnection(
  organizationId: string,
): Promise<ConnectionRecord> {
  const sb = await admin();
  const { data } = await sb
    .from("sam_mcp_connections")
    .select(
      "status, server_url, protocol_version, last_tested_at, last_success_at, last_error_code, last_error_message, last_operation_id, discovered_tools",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();
  const row = data as {
    status: ConnectionStatus;
    server_url: string;
    protocol_version: string | null;
    last_tested_at: string | null;
    last_success_at: string | null;
    last_error_code: string | null;
    last_error_message: string | null;
    last_operation_id: string | null;
    discovered_tools: unknown;
  } | null;
  if (!row) {
    return {
      status: "disconnected",
      serverUrl: SAM_MCP_SERVER_URL,
      protocolVersion: null,
      lastTestedAt: null,
      lastSuccessAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastOperationId: null,
      discoveredTools: [],
    };
  }
  return {
    status: row.status,
    serverUrl: row.server_url,
    protocolVersion: row.protocol_version,
    lastTestedAt: row.last_tested_at,
    lastSuccessAt: row.last_success_at,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    lastOperationId: row.last_operation_id,
    discoveredTools: Array.isArray(row.discovered_tools) ? (row.discovered_tools as string[]) : [],
  };
}

export interface TestConnectionOutcome {
  status: ConnectionStatus;
  errorCode: SamMcpErrorCode | null;
  errorMessage: string | null;
  protocolVersion: string | null;
  discoveredTools: string[];
  operationId: string | null;
  pendingApprovalsCount: number | null;
}

/**
 * Run the full three-step live proof:
 *   1. initialize
 *   2. tools/list
 *   3. tools/call sam.list_pending_approvals
 *
 * The connection is only marked `connected` if step 3 succeeds.
 */
export async function testConnection(ctx: SamMcpCallContext): Promise<TestConnectionOutcome> {
  const now = new Date().toISOString();
  await upsertConnection(ctx.organizationId, {
    status: "testing",
    last_tested_at: now,
    last_error_code: null,
    last_error_message: null,
  });
  await writeAudit(ctx.organizationId, ctx.actorUserId, "sam_mcp_test_started", {
    server_url: SAM_MCP_SERVER_URL,
    protocol_version: SAM_MCP_PROTOCOL_VERSION,
  });

  const fail = async (code: SamMcpErrorCode, opId?: string): Promise<TestConnectionOutcome> => {
    const blocked = code === "missing_sam_mcp_api_key";
    await upsertConnection(ctx.organizationId, {
      status: blocked ? "blocked" : "failed",
      last_error_code: code,
      last_error_message: safeMessage(code),
      last_operation_id: opId ?? null,
    });
    await writeAudit(ctx.organizationId, ctx.actorUserId, "sam_mcp_test_failed", {
      error_code: code,
      operation_id: opId ?? null,
    });
    return {
      status: blocked ? "blocked" : "failed",
      errorCode: code,
      errorMessage: safeMessage(code),
      protocolVersion: null,
      discoveredTools: [],
      operationId: opId ?? null,
      pendingApprovalsCount: null,
    };
  };

  // 1. initialize
  let initResult;
  try {
    initResult = await mcpInitialize(ctx);
  } catch (err) {
    const e = err as SamMcpError;
    return fail(e.code ?? "initialize_failed", e.operationId);
  }

  // 2. tools/list
  let toolsResult;
  try {
    toolsResult = await mcpListTools(ctx);
  } catch (err) {
    const e = err as SamMcpError;
    return fail(e.code ?? "tools_list_failed", e.operationId);
  }
  const toolNames = (toolsResult.result.tools ?? []).map((t) => t.name).filter(Boolean);

  // 3. real tool call: sam.list_pending_approvals
  let callResult;
  try {
    callResult = await mcpCallTool(ctx, "sam.list_pending_approvals", {
      organization_id: ctx.organizationId,
    });
  } catch (err) {
    const e = err as SamMcpError;
    return fail(e.code ?? "tool_call_failed", e.operationId);
  }

  if (callResult.result.isError) {
    return fail("tool_call_failed", callResult.operationId);
  }

  // Count pending approvals from either structured content or the first text block.
  let pendingCount: number | null = null;
  const sc = callResult.result.structuredContent as { items?: unknown[] } | undefined;
  if (sc && Array.isArray(sc.items)) pendingCount = sc.items.length;
  if (pendingCount == null) {
    const firstText = (callResult.result.content ?? []).find((c) => c.type === "text")?.text;
    if (firstText) {
      try {
        const parsed = JSON.parse(firstText) as { items?: unknown[] } | unknown[];
        if (Array.isArray(parsed)) pendingCount = parsed.length;
        else if (parsed && Array.isArray((parsed as { items?: unknown[] }).items))
          pendingCount = (parsed as { items: unknown[] }).items.length;
      } catch {
        /* leave pendingCount null */
      }
    }
  }

  const successAt = new Date().toISOString();
  await upsertConnection(ctx.organizationId, {
    status: "connected",
    protocol_version: initResult.result.protocolVersion ?? SAM_MCP_PROTOCOL_VERSION,
    last_success_at: successAt,
    last_error_code: null,
    last_error_message: null,
    last_operation_id: callResult.operationId ?? null,
    discovered_tools: toolNames,
  });
  await writeAudit(ctx.organizationId, ctx.actorUserId, "sam_mcp_test_succeeded", {
    protocol_version: initResult.result.protocolVersion ?? SAM_MCP_PROTOCOL_VERSION,
    tool_count: toolNames.length,
    operation_id: callResult.operationId ?? null,
    pending_approvals_count: pendingCount,
  });

  return {
    status: "connected",
    errorCode: null,
    errorMessage: null,
    protocolVersion: initResult.result.protocolVersion ?? SAM_MCP_PROTOCOL_VERSION,
    discoveredTools: toolNames,
    operationId: callResult.operationId ?? null,
    pendingApprovalsCount: pendingCount,
  };
}

/**
 * Reusable typed helper. All future consumers of sam.list_pending_approvals
 * MUST go through this function, not the raw client.
 */
export async function listPendingApprovals(ctx: SamMcpCallContext): Promise<{
  operationId: string | null;
  raw: unknown;
}> {
  const res = await mcpCallTool(ctx, "sam.list_pending_approvals", {
    organization_id: ctx.organizationId,
  });
  await writeAudit(ctx.organizationId, ctx.actorUserId, "sam_mcp_tool_called", {
    tool: "sam.list_pending_approvals",
    operation_id: res.operationId ?? null,
    is_error: res.result.isError ?? false,
  });
  if (res.result.isError) {
    throw new SamMcpError("tool_call_failed", "sam.list_pending_approvals returned an error result.", {
      operationId: res.operationId,
    });
  }
  return { operationId: res.operationId ?? null, raw: res.result.structuredContent ?? res.result.content ?? null };
}