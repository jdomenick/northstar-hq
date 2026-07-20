# NorthStar Labs → SAM MCP Connection

NorthStar Labs talks to the deployed SAM Intelligent Operating Platform through the
official SAM MCP server. This document describes the one-time setup, the live
proof, and the exact evidence that confirms the connection.

## Endpoint

- SAM host: `https://sam-intelligent-operating-platform.lovable.app`
- Inbound MCP endpoint: `https://sam-intelligent-operating-platform.lovable.app/api/public/mcp/v1`
- Transport: Streamable HTTP (JSON-RPC 2.0)
- MCP protocol version: `2025-06-18`

All requests originate from NorthStar Labs' server runtime. The browser never sees
the endpoint, the API key, or any raw SAM payload.

## Secret configuration (one-time, manual)

SAM issues a per-tenant API key. NorthStar Labs stores it as a server-side secret
named exactly:

```
SAM_MCP_API_KEY
```

To install it:

1. In the SAM host, generate a NorthStar Labs-scoped API key.
2. In NorthStar Labs, open **Project Settings → Secrets**.
3. Add a new secret with the exact name `SAM_MCP_API_KEY` and paste the value
   from step 1. No prefix, no quotes, no trailing whitespace.
4. Wait for the server to pick up the new secret (a redeploy or the next
   server-function invocation).

The key is read only inside `src/lib/sam-mcp/client.server.ts` via
`process.env.SAM_MCP_API_KEY`. It is never bundled into the browser, never
logged, never returned in a server function response, never written into
`activity_events`, and never written into `sam_mcp_connections`.

If the key is missing when a Test Connection runs, the connection is marked
`blocked` with error code `missing_sam_mcp_api_key` and the setup instructions
are shown in the panel.

## First-call test

The Test Connection button in **Integrations → SAM → SAM MCP Server** runs
three steps against SAM, in order:

1. `initialize` (JSON-RPC method `initialize`, protocol `2025-06-18`).
2. `tools/list`.
3. `tools/call` for `sam.list_pending_approvals` with
   `{"organization_id": "<active org id>"}`.

The connection is marked `connected` **only** after step 3 returns a
non-error JSON-RPC result with a real HTTP 200 from SAM. Any earlier step
failing leaves the status at `failed` (or `blocked` for
`missing_sam_mcp_api_key`) and stores the sanitized error code and message.

## What is persisted

`public.sam_mcp_connections` (one row per organization) stores:

- `status` — one of `disconnected | testing | connected | failed | blocked`
- `server_url`, `protocol_version`
- `last_tested_at`, `last_success_at`
- `last_error_code`, `last_error_message` (sanitized, from the fixed taxonomy)
- `last_operation_id` — the SAM operation ID from the `x-sam-operation-id`
  response header when SAM returns one
- `discovered_tools` — the tool names from `tools/list`

Row-level security allows only organization admins to read the row. Only the
server (service role) writes to it.

## Audit events

Every Test Connection call writes activity events into `activity_events`:

- `sam_mcp_test_started`
- `sam_mcp_test_succeeded` (with tool count, protocol version, operation id,
  and pending approvals count)
- `sam_mcp_test_failed` (with sanitized error code and operation id)

Every tool call through the shared service also writes `sam_mcp_tool_called`.
No raw payloads, headers, or credentials are stored in audit metadata.

## Reusable client

All future SAM MCP calls MUST go through
`src/lib/sam-mcp/service.server.ts`. No UI component, route file, or
client-safe module may import `client.server.ts` directly.

Every call is executed with:

- server-only `Authorization: Bearer $SAM_MCP_API_KEY`
- `X-NorthStar Labs-Organization-Id` and `X-NorthStar Labs-Actor-User-Id` headers to
  preserve organization boundaries and actor identity inside SAM
- a hard `AbortController` timeout (default 15s)
- an in-process token bucket per organization to prevent runaway loops

## Evidence that NorthStar Labs and SAM are connected

After a successful Test Connection, all of the following are true and are the
exact evidence to check:

1. `sam_mcp_connections` row for the active organization shows
   `status = 'connected'`, a non-null `last_success_at`, and a
   non-empty `discovered_tools` array containing at least
   `sam.list_pending_approvals`.
2. `activity_events` for the org contains one `sam_mcp_test_started` row and
   one `sam_mcp_test_succeeded` row within the same second, with
   `metadata.tool_count > 0` and `metadata.pending_approvals_count` present.
3. The Integrations → SAM panel shows the green **Connected** dot, the MCP
   protocol version, the last success time, the discovered tool count, and
   (when SAM returned one) the SAM operation id.
4. The panel's success banner reports the actual number of pending approvals
   SAM returned from `sam.list_pending_approvals`, proving a real tool call
   round-tripped, not just a health check.