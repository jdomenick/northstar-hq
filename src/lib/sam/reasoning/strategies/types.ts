import type { SamResponse } from "@/lib/sam/schema";
import type { ReasoningTrace } from "../trace";
import type { ProviderId } from "@/lib/sam/providers/types";

export interface StrategyUsage {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface StrategyResult {
  response: SamResponse;
  trace: ReasoningTrace;
  usage: StrategyUsage;
  provider: { id: ProviderId; modelId: string } | null;
}

export interface StrategyProviderCall {
  systemSuffix: string;
  userContent: string;
  temperature?: number;
  maxOutputTokens?: number;
}