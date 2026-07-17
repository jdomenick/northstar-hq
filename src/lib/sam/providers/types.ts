// SAM Provider Abstraction Layer types (see docs/sam/09-provider-abstraction.md).
// The rest of the SAM pipeline speaks only to these interfaces.

import type { z } from "zod";

export type ProviderId = "lovable" | "openai" | "anthropic" | "google" | "local";

export interface CompletionRequest {
  promptVersion: string;
  system: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  responseSchema?: z.ZodTypeAny;
  temperature?: number;
  maxOutputTokens?: number;
  metadata: {
    orgId: string;
    intent: string;
    workflow?: string;
    invocationId?: string;
  };
}

export interface CompletionResponse<T = unknown> {
  content: T;
  raw?: string;
  providerId: ProviderId;
  modelId: string;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    latencyMs: number;
  };
}

export interface ProviderCapabilities {
  maxContextTokens: number;
  supportsJsonMode: boolean;
  supportsToolCalls: boolean;
  supportsStreaming: boolean;
}

export interface CompletionProvider {
  id: ProviderId;
  modelId: string;
  capabilities: ProviderCapabilities;
  generateStructuredResponse<T>(req: CompletionRequest): Promise<CompletionResponse<T>>;
  generateTextResponse(req: CompletionRequest): Promise<CompletionResponse<string>>;
  healthCheck(): Promise<{ ok: boolean; message?: string }>;
  getModelMetadata(): { providerId: ProviderId; modelId: string; capabilities: ProviderCapabilities };
}

export interface ProviderPolicy {
  primary: ProviderId;
  fallback?: ProviderId[];
  privacyTier?: "shared_cloud" | "enterprise_cloud" | "local_only";
}