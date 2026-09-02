// Boundary between SAM's machine-readable structured output and the
// user-facing conversation transcript.
//
// The backend keeps its structured response contract (other features depend on
// it). This module guarantees that nothing structured ever reaches a chat
// bubble: JSON blobs, schema keys, internal context objects, UUIDs, and trace
// metadata are converted into plain executive prose, or dropped.

/** Keys that are internal machine context and must never be shown. */
const INTERNAL_KEYS = new Set([
  "relevant_context",
  "context",
  "citations",
  "trace",
  "reasoning_trace",
  "metadata",
  "meta",
  "model_confidence_hint",
  "confidence",
  "model",
  "provider",
  "usage",
  "ids",
  "entity_ids",
  "venture_ids",
  "goal_ids",
  "project_ids",
  "ventures",
  "goals",
  "projects",
  "tasks",
  "strategy",
  "intent",
  "hrefs",
  "prompt_version",
  "pipeline_version",
  "schema",
  "tool_calls",
  "unsupported_action",
]);

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

const LEAD_KEYS = ["answer", "executive_summary", "summary", "response", "message", "overview"];

const SECTIONS: Array<{ keys: string[]; label: string | null; ordered?: boolean }> = [
  {
    keys: ["strategic_recommendations", "recommendations", "priorities", "next_steps", "actions"],
    label: null,
    ordered: true,
  },
  { keys: ["observations", "key_findings", "findings", "signals"], label: "What I am seeing" },
  { keys: ["opportunities"], label: "Opportunities" },
  { keys: ["risks", "concerns"], label: "Risks" },
  { keys: ["assumptions"], label: "Assumptions" },
  { keys: ["missing_information", "unknowns"], label: "What I do not have" },
  { keys: ["clarifying_questions", "questions"], label: "If you want me sharper" },
];

/** Remove UUIDs and other machine identifiers from a display string. */
export function stripInternalIdentifiers(text: string): string {
  return text
    .replace(UUID_RE, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\[\s*\]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,;:])/g, "$1")
    .trim();
}

function cleanString(value: string): string {
  return stripInternalIdentifiers(value.replace(/\s+/g, " ").trim());
}

/** Turn an unknown list item into a single readable line, or null if unusable. */
function itemToLine(item: unknown): string | null {
  if (typeof item === "string") {
    const s = cleanString(item);
    return s.length > 0 ? s : null;
  }
  if (typeof item === "number" || typeof item === "boolean") return String(item);
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const rec = item as Record<string, unknown>;
    const titleKey = ["title", "name", "venture", "action", "recommendation", "headline"].find(
      (k) => typeof rec[k] === "string" && (rec[k] as string).trim(),
    );
    const bodyKey = [
      "description",
      "detail",
      "details",
      "rationale",
      "why",
      "summary",
      "text",
      "note",
    ].find((k) => typeof rec[k] === "string" && (rec[k] as string).trim());
    const title = titleKey ? cleanString(rec[titleKey] as string) : "";
    const body = bodyKey ? cleanString(rec[bodyKey] as string) : "";
    if (title && body) return `${title}: ${body}`;
    const single = title || body;
    if (single) return single;
    // Unknown object shape: use the first plain string value that is not an id.
    for (const [k, v] of Object.entries(rec)) {
      if (INTERNAL_KEYS.has(k) || /_?id$/i.test(k)) continue;
      if (typeof v === "string" && v.trim()) return cleanString(v);
    }
    return null;
  }
  return null;
}

function listLines(value: unknown): string[] {
  if (!Array.isArray(value)) {
    const one = itemToLine(value);
    return one ? [one] : [];
  }
  return value.map(itemToLine).filter((l): l is string => !!l && l.length > 0);
}

function firstString(rec: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return cleanString(v);
  }
  return null;
}

/**
 * Convert a parsed structured payload into conversational prose.
 * Returns null when nothing safe and useful can be extracted.
 */
export function humanizeStructuredValue(value: unknown): string | null {
  if (typeof value === "string") {
    const s = cleanString(value);
    return s || null;
  }
  if (Array.isArray(value)) {
    // A top-level array of payload objects: humanize each and join.
    const parts = value
      .map((v) => humanizeStructuredValue(v))
      .filter((p): p is string => !!p && p.length > 0);
    return parts.length ? parts.join("\n\n") : null;
  }
  if (!value || typeof value !== "object") return null;

  const rec = value as Record<string, unknown>;
  const blocks: string[] = [];

  const lead = firstString(rec, LEAD_KEYS);
  if (lead) blocks.push(lead);

  for (const section of SECTIONS) {
    const key = section.keys.find((k) => k in rec);
    if (!key) continue;
    const lines = listLines(rec[key]);
    if (lines.length === 0) continue;
    const body = section.ordered
      ? lines.map((l, i) => `${i + 1}. ${l}`).join("\n")
      : lines.map((l) => `- ${l}`).join("\n");
    blocks.push(section.label ? `${section.label}:\n${body}` : body);
  }

  const tail = firstString(rec, ["next_question", "closing", "bottom_line"]);
  if (tail) blocks.push(tail);

  if (blocks.length === 0) {
    // Last resort: any non-internal string field.
    for (const [k, v] of Object.entries(rec)) {
      if (INTERNAL_KEYS.has(k) || /_?id$/i.test(k)) continue;
      if (typeof v === "string" && v.trim().length > 20) {
        blocks.push(cleanString(v));
        break;
      }
    }
  }

  const out = blocks.join("\n\n").trim();
  return out.length > 0 ? out : null;
}

function looksStructured(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.startsWith("{") || t.startsWith("[")) return true;
  return /```(?:json)?\s*[[{]/i.test(t);
}

/** Pull a JSON value out of a text blob that may be fenced or prose-wrapped. */
function extractJson(text: string): unknown | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence ? fence[1] : text).trim();
  const attempts: string[] = [candidate];
  for (const [open, close] of [
    ["[", "]"],
    ["{", "}"],
  ] as const) {
    const start = candidate.indexOf(open);
    const end = candidate.lastIndexOf(close);
    if (start !== -1 && end > start) attempts.push(candidate.slice(start, end + 1));
  }
  for (const a of attempts) {
    try {
      return JSON.parse(a) as unknown;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/**
 * Final safety net applied to any assistant text before it is rendered.
 * Never throws. Never returns raw JSON.
 */
export function toConversationalText(raw: string | null | undefined): string {
  const text = (raw ?? "").trim();
  if (!text) return "";

  if (looksStructured(text)) {
    const parsed = extractJson(text);
    if (parsed !== null) {
      const humanized = humanizeStructuredValue(parsed);
      if (humanized) return humanized;
    }
    // Malformed or unusable structured output: never show the payload.
    return "I hit a formatting problem generating that answer. Ask me again and I will give you a clean response.";
  }

  return stripInternalIdentifiers(text);
}
