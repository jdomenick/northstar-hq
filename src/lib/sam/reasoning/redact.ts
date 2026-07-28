// Redaction for private reasoning traces before persistence. Strings inside a
// ReasoningTrace are model-generated and may echo prompt-injection payloads,
// email addresses, or credential-shaped fragments (bearer tokens, API keys,
// long hex/uuid secrets). Applied server-side before writing to
// sam_reasoning_traces. Redaction is one-way: we replace matches with a
// bracketed tag naming the class removed.

import type { ReasoningTrace } from "./trace";

const PATTERNS: Array<{ tag: string; re: RegExp }> = [
  // Bearer tokens and Authorization headers.
  { tag: "[REDACTED:auth]", re: /(bearer|authorization)\s*[:=]?\s*[A-Za-z0-9._\-]{16,}/gi },
  // Common API key prefixes.
  { tag: "[REDACTED:api-key]", re: /\b(sk|pk|sb|xoxb|xoxp|ghp|ghs|glpat|AIza)[_-][A-Za-z0-9_-]{16,}\b/g },
  // Long hex secrets (>= 32 hex chars).
  { tag: "[REDACTED:hex]", re: /\b[a-f0-9]{32,}\b/gi },
  // JWT-shaped tokens.
  { tag: "[REDACTED:jwt]", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  // Email addresses. Personal data is unnecessary in a reasoning slot.
  { tag: "[REDACTED:email]", re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  // Phone numbers (E.164 or common US shapes).
  { tag: "[REDACTED:phone]", re: /\+?\d[\d\s().-]{9,}\d/g },
];

// Fenced-injection markers we do not want persisted verbatim.
const INJECTION_RE = /(ignore (all )?(previous|prior) instructions|reveal (the )?(system|hidden) prompt|you are (now )?dan\b)/gi;

export function redactString(input: string): string {
  if (!input) return input;
  let out = input;
  for (const { tag, re } of PATTERNS) {
    out = out.replace(re, tag);
  }
  out = out.replace(INJECTION_RE, "[REDACTED:injection]");
  return out;
}

function redactAny(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redactAny);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactAny(v);
    }
    return out;
  }
  return value;
}

// Redact every string field inside a ReasoningTrace. Citation entity ids are
// UUIDs and would trip the hex pattern; strip citations from the redaction
// pass and re-attach unmodified (they carry no user data on their own).
export function redactTrace(trace: ReasoningTrace): ReasoningTrace {
  const { source_citations, ...rest } = trace;
  const redacted = redactAny(rest) as Omit<ReasoningTrace, "source_citations">;
  return { ...redacted, source_citations } as ReasoningTrace;
}