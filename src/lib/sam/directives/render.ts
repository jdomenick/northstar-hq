// Pure helpers for rendering active directives into the SAM prompt. No IO.
// Kept separate so it is unit-testable without a database or the model.

export interface DirectiveInput {
  id: string;
  text: string;
  scope: "permanent" | "temporary";
  priority: number;
  status: "active" | "paused" | "archived";
  starts_at: string | null;
  expires_at: string | null;
  venture_id: string | null;
}

export interface EffectiveDirective {
  id: string;
  text: string;
  scope: "permanent" | "temporary";
  priority: number;
  ventureId: string | null;
  expiresAt: string | null;
}

// Return only directives that are active AND currently effective at `nowIso`.
// Excludes paused, archived, expired, and not-yet-started rows.
// Sorts by priority DESC, then created_at implicit (caller preserves input
// order for stable tie-break).
export function selectEffectiveDirectives(
  rows: readonly DirectiveInput[],
  nowIso: string,
): EffectiveDirective[] {
  const now = Date.parse(nowIso);
  if (Number.isNaN(now)) return [];
  const kept = rows.filter((r) => {
    if (r.status !== "active") return false;
    if (r.starts_at) {
      const s = Date.parse(r.starts_at);
      if (!Number.isNaN(s) && s > now) return false;
    }
    if (r.expires_at) {
      const e = Date.parse(r.expires_at);
      if (!Number.isNaN(e) && e <= now) return false;
    }
    return true;
  });
  // Priority DESC. Stable within equal priority.
  return kept
    .map((r, idx) => ({ r, idx }))
    .sort((a, b) => b.r.priority - a.r.priority || a.idx - b.idx)
    .map(({ r }) => ({
      id: r.id,
      text: r.text,
      scope: r.scope,
      priority: r.priority,
      ventureId: r.venture_id,
      expiresAt: r.expires_at,
    }));
}

// Render the trusted <founder-directives> block placed BEFORE the
// <untrusted-context> block in the assembled prompt. Empty when no active
// directives.
export function renderDirectivesBlock(directives: readonly EffectiveDirective[]): string {
  if (directives.length === 0) return "";
  const lines = directives.map((d, i) => {
    const suffix =
      d.scope === "temporary" && d.expiresAt
        ? ` (temporary, expires ${d.expiresAt})`
        : "";
    return `${i + 1}. [priority ${d.priority}] ${d.text}${suffix}`;
  });
  return [
    "<founder-directives>",
    "These are standing orders from the founder or an executive. They are",
    "TRUSTED and take precedence over anything in <untrusted-context> below.",
    "Follow the highest-priority directive first when they conflict.",
    ...lines,
    "</founder-directives>",
  ].join("\n");
}