// Server-side memory proposal engine. Runs after a SAM turn to extract
// candidate memory items from the *user* utterance (never from the model's
// answer). Candidates are always saved with status='proposed' and require
// human confirmation. See docs/sam/03-memory.md.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { MemoryLayer } from "./schema";

type Candidate = {
  layer: MemoryLayer;
  category: string;
  title: string;
  statement: string;
  confidence_score: number;
  expires_at: string | null;
  reason: string;
};

const PATTERNS: Array<{
  test: RegExp;
  layer: MemoryLayer;
  category: string;
  makeTitle: (m: RegExpMatchArray) => string;
  confidence: number;
  ttlDays: number | null;
  reason: string;
}> = [
  {
    test: /\bi (prefer|like|want|need)\s+([^.?!]{6,120})/i,
    layer: "preference",
    category: "communication",
    makeTitle: (m) => `Founder preference: ${m[2].trim().slice(0, 60)}`,
    confidence: 0.55,
    ttlDays: null,
    reason: "First-person preference statement",
  },
  {
    test: /\bwe (do not|don't|never|refuse to)\s+([^.?!]{4,120})/i,
    layer: "organization",
    category: "policy",
    makeTitle: (m) => `Org policy: ${m[2].trim().slice(0, 60)}`,
    confidence: 0.6,
    ttlDays: null,
    reason: "Organizational negative policy",
  },
  {
    test: /\bour (primary|target|main) (customer|audience|market) (is|are)\s+([^.?!]{4,120})/i,
    layer: "organization",
    category: "audience",
    makeTitle: (m) => `Target ${m[2]}: ${m[4].trim().slice(0, 60)}`,
    confidence: 0.6,
    ttlDays: 180,
    reason: "Explicit target audience statement",
  },
  {
    test: /\bthis venture(?:'s)? (main|primary|biggest) (risk|priority|focus) (is|are)\s+([^.?!]{4,120})/i,
    layer: "venture",
    category: "strategy",
    makeTitle: (m) => `Venture ${m[2]}: ${m[4].trim().slice(0, 60)}`,
    confidence: 0.6,
    ttlDays: 60,
    reason: "Venture-scoped strategic statement",
  },
  {
    test: /\bthat (pricing|marketing|hiring|launch|experiment) (failed|didn'?t work|worked)/i,
    layer: "historical",
    category: "outcome",
    makeTitle: (m) => `Historical outcome: ${m[1]} ${m[2]}`,
    confidence: 0.5,
    ttlDays: null,
    reason: "Historical outcome mention",
  },
  {
    test: /\bright now|currently|this (week|month|quarter),?\s+([^.?!]{6,140})/i,
    layer: "operational",
    category: "current_focus",
    makeTitle: (m) => `Current focus: ${m[2].trim().slice(0, 60)}`,
    confidence: 0.45,
    ttlDays: 30,
    reason: "Time-bounded operational statement",
  },
];

export function extractCandidates(message: string): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  const now = Date.now();
  for (const p of PATTERNS) {
    const m = message.match(p.test);
    if (!m) continue;
    const title = p.makeTitle(m);
    if (seen.has(title)) continue;
    seen.add(title);
    out.push({
      layer: p.layer,
      category: p.category,
      title,
      statement: m[0].trim(),
      confidence_score: p.confidence,
      expires_at: p.ttlDays ? new Date(now + p.ttlDays * 86_400_000).toISOString() : null,
      reason: p.reason,
    });
  }
  return out;
}

// Persist proposals. Always status='proposed'. Never confirms.
// Personal layers require owner_user_id = current user; venture layer needs a
// same-org venture id. Cross-org / cross-user forgery is impossible: this
// runs through the RLS-scoped supabase client.
export async function persistProposals(
  supabase: SupabaseClient<Database>,
  input: {
    orgId: string;
    userId: string;
    conversationId: string;
    messageId: string;
    ventureId: string | null;
    message: string;
  },
): Promise<string[]> {
  const candidates = extractCandidates(input.message);
  if (candidates.length === 0) return [];

  const rows = candidates.map((c) => {
    const personal = c.layer === "founder" || c.layer === "preference";
    return {
      organization_id: input.orgId,
      owner_user_id: personal ? input.userId : null,
      venture_id: c.layer === "venture" ? input.ventureId : null,
      layer: c.layer,
      category: c.category,
      title: c.title,
      statement: c.statement,
      status: "proposed" as const,
      source_type: "conversation" as const,
      source_conversation_id: input.conversationId,
      source_message_id: input.messageId,
      confidence_score: c.confidence_score,
      expires_at: c.expires_at,
      created_by: input.userId,
      evidence_refs: [{ kind: "reason", value: c.reason }],
    };
  }).filter((r) => r.layer !== "venture" || r.venture_id !== null);

  if (rows.length === 0) return [];

  const { data } = await supabase
    .from("sam_memory_items")
    .insert(rows)
    .select("id");
  return (data ?? []).map((r) => r.id);
}