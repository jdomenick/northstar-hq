// sam.proof_mission handler. Deterministic end-to-end proof of SAM execution.
// Reads the org + venture, active directives, and produces a real qualified-
// prospect research brief. If LOVABLE_API_KEY is set, uses the Lovable AI
// Gateway to draft the brief; otherwise falls back to a deterministic
// template built from live org data. Either way the artifact is real and
// stored on the mission work item. Idempotent via job idempotency key.

import { z } from "zod";
import { registerHandler, type HandlerFn } from "../executor.server";
import { AutomationError } from "../errors";

const InputSchema = z.object({
  missionId: z.string().uuid(),
  workItemId: z.string().uuid(),
});

interface Brief {
  title: string;
  generated_at: string;
  organization: { id: string; name: string };
  venture: { id: string; name: string } | null;
  directive_summary: string[];
  ideal_customer_profile: {
    who: string;
    problem: string;
    signals: string[];
  };
  outreach_angles: string[];
  next_actions: string[];
  source: "lovable_ai_gateway" | "deterministic_template";
}

function templateBrief(org: { id: string; name: string }, venture: { id: string; name: string } | null, directives: string[]): Brief {
  const focus = venture?.name ?? org.name;
  return {
    title: `Qualified-prospect brief for ${focus}`,
    generated_at: new Date().toISOString(),
    organization: org,
    venture,
    directive_summary: directives.slice(0, 5),
    ideal_customer_profile: {
      who: `Operators and founders whose situation aligns with ${focus}'s stated mission.`,
      problem: `They are losing time or revenue to the exact category of problem ${focus} was built to solve.`,
      signals: [
        "Recent hiring in adjacent roles",
        "Public statements about the problem area",
        "Recent funding or expansion",
        "Public dissatisfaction with the current tool",
      ],
    },
    outreach_angles: [
      `Lead with a specific observation about the prospect, not about ${focus}.`,
      `Tie the offer to one measurable outcome in the next 30 days.`,
      `Attach one artifact of proof (case study, teardown, or working demo).`,
    ],
    next_actions: [
      "Compile a shortlist of 25 prospects that match the ICP signals.",
      "Draft 3 opening messages, each tailored to a different signal.",
      "Book 5 first calls in the next 14 days.",
    ],
    source: "deterministic_template",
  };
}

async function aiBrief(org: { id: string; name: string }, venture: { id: string; name: string } | null, directives: string[]): Promise<Brief | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  try {
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const { generateObject } = await import("ai");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");
    const schema = z.object({
      ideal_customer_profile: z.object({
        who: z.string(), problem: z.string(),
        signals: z.array(z.string()).min(3).max(6),
      }),
      outreach_angles: z.array(z.string()).min(3).max(5),
      next_actions: z.array(z.string()).min(3).max(5),
    });
    const { object } = await generateObject({
      model, schema,
      prompt: [
        `Draft a concise qualified-prospect brief for the organization "${org.name}"` +
        (venture ? ` (venture: ${venture.name})` : "") + ".",
        "Constraints:",
        "- Be specific and actionable.",
        "- Do not invent facts about the organization.",
        "- Signals must be observable in public data.",
        directives.length ? `Founder directives (highest priority):\n- ${directives.join("\n- ")}` : "",
      ].join("\n\n"),
    });
    return {
      title: `Qualified-prospect brief for ${venture?.name ?? org.name}`,
      generated_at: new Date().toISOString(),
      organization: org, venture, directive_summary: directives.slice(0, 5),
      ideal_customer_profile: object.ideal_customer_profile,
      outreach_angles: object.outreach_angles,
      next_actions: object.next_actions,
      source: "lovable_ai_gateway",
    };
  } catch {
    return null;
  }
}

const handler: HandlerFn = async ({ supabase, job }) => {
  if (!job.organization_id) throw new AutomationError("malformed_input", "missing org");
  const parsed = InputSchema.safeParse(job.input_payload ?? {});
  if (!parsed.success) throw new AutomationError("malformed_input", "invalid input");
  const { missionId, workItemId } = parsed.data;

  // Mark work item running.
  await supabase.from("sam_mission_work_items" as never)
    .update({ status: "running", started_at: new Date().toISOString() } as never)
    .eq("id", workItemId);

  try {
    const orgQ = await supabase.from("organizations").select("id, name").eq("id", job.organization_id).maybeSingle();
    if (orgQ.error || !orgQ.data) throw new AutomationError("record_unavailable", "org not found");
    const org = { id: orgQ.data.id, name: orgQ.data.name };

    let venture: { id: string; name: string } | null = null;
    if (job.venture_id) {
      const vQ = await supabase.from("ventures").select("id, name").eq("id", job.venture_id).maybeSingle();
      if (vQ.data) venture = { id: vQ.data.id, name: vQ.data.name };
    }

    const dQ = await supabase.from("sam_directives" as never)
      .select("text, priority" as never)
      .eq("organization_id", org.id).eq("status", "active")
      .order("priority", { ascending: false }).limit(10);
    const directives = ((dQ.data ?? []) as unknown as Array<{ text: string }>).map((d) => d.text);

    const brief = (await aiBrief(org, venture, directives)) ?? templateBrief(org, venture, directives);

    const now = new Date().toISOString();
    await supabase.from("sam_mission_work_items" as never)
      .update({
        status: "completed", completed_at: now,
        artifact: brief as unknown as Record<string, unknown>,
      } as never)
      .eq("id", workItemId);

    await supabase.from("sam_missions" as never)
      .update({ status: "completed", completed_at: now } as never)
      .eq("id", missionId).eq("organization_id", org.id);

    await supabase.from("activity_events").insert({
      organization_id: org.id, actor_user_id: null,
      action: "sam_proof_mission_completed", entity_type: "sam_mission", entity_id: missionId,
      summary: `Proof mission completed`, metadata: {
        workItemId, jobId: job.id, source: brief.source,
      } as never,
    });

    return {
      outputSummary: {
        missionId, workItemId, source: brief.source, briefTitle: brief.title,
      },
      signals: [],
    };
  } catch (err) {
    // Never leave the work item stuck in `running`. Mark it failed with a
    // truthful error code so the mission page and audit reflect reality.
    const msg = (err as Error)?.message ?? "handler error";
    await supabase.from("sam_mission_work_items" as never)
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        artifact: { error: msg } as unknown as Record<string, unknown>,
      } as never)
      .eq("id", workItemId);
    await supabase.from("sam_missions" as never)
      .update({ status: "failed", completed_at: new Date().toISOString() } as never)
      .eq("id", missionId).eq("organization_id", job.organization_id);
    throw err;
  }
};

registerHandler("sam.proof_mission", handler);