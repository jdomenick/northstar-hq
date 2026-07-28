// Central strategy dispatcher. The pipeline calls runStrategy() and never
// speaks to individual strategy modules directly.

import type { AssembledContext } from "@/lib/sam/context-builder.server";
import type { SamIntent } from "@/lib/sam/intent";
import type { RouterDecision } from "../router";
import { selectStrategy } from "../router";
import { runDeterministicOnly } from "./deterministic-only.server";
import { runSinglePass } from "./single-pass.server";
import { runPlanThenCritique } from "./plan-then-critique.server";
import { runMultiActor } from "./multi-actor.server";
import type { StrategyResult } from "./types";

export interface DispatchInput {
  orgId: string;
  intent: SamIntent;
  message: string;
  system: string;
  contextBlock: string;
  context: AssembledContext;
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
}

export interface DispatchResult extends StrategyResult {
  decision: RouterDecision;
}

function hasAnyContext(ctx: AssembledContext): boolean {
  return (
    ctx.projects.length +
      ctx.tasks.length +
      ctx.goals.length +
      ctx.commitments.length +
      ctx.decisions.length +
      ctx.knowledge.length +
      ctx.activity.length >
    0
  );
}

export async function runStrategy(input: DispatchInput): Promise<DispatchResult> {
  const decision = selectStrategy({
    intent: input.intent,
    message: input.message,
    hasAnyContext: hasAnyContext(input.context),
  });

  switch (decision.strategy) {
    case "deterministic_only": {
      const r = runDeterministicOnly({
        intent: input.intent,
        context: input.context,
        reason: decision.reason,
      });
      return { ...r, decision };
    }
    case "plan_then_critique": {
      const r = await runPlanThenCritique({
        orgId: input.orgId,
        intent: input.intent,
        system: input.system,
        contextBlock: input.contextBlock,
        history: input.history,
        message: input.message,
      });
      return { ...r, decision };
    }
    case "multi_actor": {
      const r = await runMultiActor({
        orgId: input.orgId,
        intent: input.intent,
        system: input.system,
        contextBlock: input.contextBlock,
        history: input.history,
        message: input.message,
        specialists: decision.specialists,
      });
      return { ...r, decision };
    }
    case "single_pass":
    default: {
      const r = await runSinglePass({
        orgId: input.orgId,
        intent: input.intent,
        system: input.system,
        contextBlock: input.contextBlock,
        history: input.history,
        message: input.message,
      });
      return { ...r, decision };
    }
  }
}