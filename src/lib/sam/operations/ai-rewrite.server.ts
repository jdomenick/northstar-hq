// Server-only AI rewrite helper. Used by editing operations to produce a
// candidate rewrite of an existing variant. NEVER persists the AI output
// directly - the caller runs the rewrite through validateVariant +
// saveVariant so the same rules any human save would trigger still apply.

import { selectProvider } from "@/lib/sam/providers/registry.server";

export type RewriteStyle =
  | "shorten"
  | "expand"
  | "tone"
  | "strengthen_hook"
  | "reduce_promotion"
  | "change_cta"
  | "suggest_hashtags"
  | "regenerate"
  | "generic";

export interface RewriteRequest {
  orgId: string;
  style: RewriteStyle;
  platform: string;
  currentBody: string;
  currentHook?: string | null;
  currentCta?: string | null;
  currentHashtags?: string[];
  instruction?: string | null;
  bodyCharLimit: number;
  brandVoiceNotes?: string | null;
}

export interface RewriteResult {
  ok: true;
  body: string;
  hook?: string | null;
  cta?: string | null;
  hashtags?: string[];
  modelId: string;
  latencyMs: number;
}

export interface RewriteFailure {
  ok: false;
  reason: "ai_unavailable" | "ai_output_invalid";
  detail?: string;
}

/**
 * Ask the SAM completion provider for a rewrite. The prompt is deterministic;
 * we never invent facts, only rework tone/length/structure of the operator's
 * existing text. Output is plain text; the caller re-validates it.
 */
export async function generateRewrite(req: RewriteRequest): Promise<RewriteResult | RewriteFailure> {
  const provider = selectProvider("content_edit");
  const system = [
    "You are SAM, the Strategic Advisory Manager, rewriting an existing social",
    "post at the operator's request. Rules:",
    "1. Never invent facts, statistics, quotes, dates, or claims not present",
    "   in the input body.",
    "2. Preserve the meaning; adjust only tone, length, or emphasis.",
    "3. Return ONLY the rewritten body text - no preamble, no quotes, no",
    "   markdown fences.",
    `4. Keep the body under ${req.bodyCharLimit} characters (hard limit).`,
    `5. Platform: ${req.platform}. Style: ${req.style}.`,
    req.brandVoiceNotes ? `Brand voice notes: ${req.brandVoiceNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const instruction = ((): string => {
    switch (req.style) {
      case "shorten":
        return "Shorten this post while keeping its core message intact.";
      case "expand":
        return "Expand this post with more useful detail. Do not invent facts.";
      case "tone":
        return req.instruction || "Rewrite in a warmer, more human tone.";
      case "strengthen_hook":
        return "Rewrite the opening sentence so it earns the reader's attention. Keep the rest of the post's substance.";
      case "reduce_promotion":
        return "Reduce promotional language. Make it feel value-first, not sales-first.";
      case "change_cta":
        return req.instruction || "Suggest a clearer, more inviting call-to-action.";
      case "suggest_hashtags":
        return "Suggest 3-8 relevant hashtags for this post. Return them as a comma-separated list on a single line, then the unchanged body.";
      case "regenerate":
        return req.instruction || "Rewrite this post from a different angle while keeping the underlying topic.";
      default:
        return req.instruction || "Rewrite this post.";
    }
  })();

  try {
    const response = await provider.generateTextResponse({
      promptVersion: "sam.operations.rewrite.v1",
      system,
      messages: [
        {
          role: "user" as const,
          content: [
            `Instruction: ${instruction}`,
            req.currentHook ? `Current hook: ${req.currentHook}` : "",
            `Current body:\n${req.currentBody}`,
            req.currentCta ? `Current CTA: ${req.currentCta}` : "",
            req.currentHashtags && req.currentHashtags.length
              ? `Current hashtags: ${req.currentHashtags.join(" ")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      metadata: { orgId: req.orgId, intent: "content_edit", workflow: "sam.rewrite" },
      maxOutputTokens: 800,
      temperature: 0.6,
    });
    const text = (response.content ?? "").trim();
    if (!text) return { ok: false, reason: "ai_output_invalid", detail: "empty output" };
    if (text.length > req.bodyCharLimit + 200) {
      // Truncate to hard limit; caller will still validate.
      const truncated = text.slice(0, req.bodyCharLimit);
      return {
        ok: true,
        body: truncated,
        modelId: response.modelId,
        latencyMs: response.usage.latencyMs,
      };
    }
    // suggest_hashtags returns "tag1, tag2, ...\n\nbody"
    if (req.style === "suggest_hashtags") {
      const lines = text.split(/\n/);
      const first = lines[0] ?? "";
      const rest = lines.slice(1).join("\n").trim();
      const tags = first
        .split(/[,\s]+/)
        .map((t) => t.replace(/^#/, "").trim())
        .filter((t) => t.length > 0 && t.length <= 60)
        .slice(0, 12);
      return {
        ok: true,
        body: rest || req.currentBody,
        hashtags: tags,
        modelId: response.modelId,
        latencyMs: response.usage.latencyMs,
      };
    }
    return {
      ok: true,
      body: text,
      modelId: response.modelId,
      latencyMs: response.usage.latencyMs,
    };
  } catch (err) {
    return {
      ok: false,
      reason: "ai_unavailable",
      detail: err instanceof Error ? err.message.slice(0, 200) : undefined,
    };
  }
}