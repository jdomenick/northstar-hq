// Sanitized error taxonomy for the Northstar → SAM MCP client. Codes are
// stable strings safe to expose in UI, activity_events, and audit rows.
// The client never surfaces raw provider messages, headers, or tokens.

export const SAM_MCP_ERROR_CODES = [
  "missing_sam_mcp_api_key",
  "invalid_response",
  "protocol_error",
  "unauthorized",
  "forbidden",
  "rate_limited",
  "timeout",
  "network_error",
  "tool_not_found",
  "tool_call_failed",
  "initialize_failed",
  "tools_list_failed",
  "server_error",
] as const;

export type SamMcpErrorCode = (typeof SAM_MCP_ERROR_CODES)[number];

export class SamMcpError extends Error {
  code: SamMcpErrorCode;
  status?: number;
  operationId?: string;
  constructor(code: SamMcpErrorCode, message: string, opts?: { status?: number; operationId?: string }) {
    super(message);
    this.name = "SamMcpError";
    this.code = code;
    this.status = opts?.status;
    this.operationId = opts?.operationId;
  }
}

/** Produce a UI-safe short message for a given code. Never includes raw provider text. */
export function safeMessage(code: SamMcpErrorCode): string {
  switch (code) {
    case "missing_sam_mcp_api_key":
      return "SAM MCP API key is not configured on this server.";
    case "invalid_response":
      return "SAM returned an invalid response body.";
    case "protocol_error":
      return "SAM returned a JSON-RPC protocol error.";
    case "unauthorized":
      return "SAM rejected the API key (unauthorized).";
    case "forbidden":
      return "SAM rejected the request (forbidden).";
    case "rate_limited":
      return "SAM rate-limited this connection.";
    case "timeout":
      return "SAM did not respond within the timeout window.";
    case "network_error":
      return "Network error reaching SAM.";
    case "tool_not_found":
      return "SAM does not expose the requested tool.";
    case "tool_call_failed":
      return "SAM reported the tool call as failed.";
    case "initialize_failed":
      return "SAM rejected the initialize handshake.";
    case "tools_list_failed":
      return "SAM rejected tools/list.";
    case "server_error":
      return "SAM returned a server error.";
  }
}