import { generateText, generateObject } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type {
  CompletionProvider,
  CompletionRequest,
  CompletionResponse,
  ProviderCapabilities,
} from "./types";

const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const CAPABILITIES: ProviderCapabilities = {
  maxContextTokens: 1_000_000,
  supportsJsonMode: true,
  supportsToolCalls: true,
  supportsStreaming: true,
};

export function createLovableGatewayCompletionProvider(
  modelId: string = DEFAULT_MODEL,
): CompletionProvider {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }
  const gateway = createLovableAiGatewayProvider(key);
  const model = gateway(modelId);

  return {
    id: "lovable",
    modelId,
    capabilities: CAPABILITIES,

    async generateStructuredResponse<T>(req: CompletionRequest): Promise<CompletionResponse<T>> {
      if (!req.responseSchema) throw new Error("responseSchema required for structured response");
      const started = Date.now();
      const result = await generateObject({
        model,
        system: req.system,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        // Cast: AI SDK accepts a Zod schema even when the provider is untyped.
        schema: req.responseSchema as never,
        temperature: req.temperature ?? 0.2,
        maxOutputTokens: req.maxOutputTokens ?? 2048,
      });
      return {
        content: result.object as T,
        providerId: "lovable",
        modelId,
        usage: {
          inputTokens: result.usage?.inputTokens,
          outputTokens: result.usage?.outputTokens,
          latencyMs: Date.now() - started,
        },
      };
    },

    async generateTextResponse(req: CompletionRequest): Promise<CompletionResponse<string>> {
      const started = Date.now();
      const result = await generateText({
        model,
        system: req.system,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: req.temperature ?? 0.2,
        maxOutputTokens: req.maxOutputTokens ?? 1024,
      });
      return {
        content: result.text,
        providerId: "lovable",
        modelId,
        usage: {
          inputTokens: result.usage?.inputTokens,
          outputTokens: result.usage?.outputTokens,
          latencyMs: Date.now() - started,
        },
      };
    },

    async healthCheck() {
      try {
        await generateText({ model, prompt: "ping", maxOutputTokens: 4 });
        return { ok: true };
      } catch (e) {
        return { ok: false, message: (e as Error).message };
      }
    },

    getModelMetadata() {
      return { providerId: "lovable", modelId, capabilities: CAPABILITIES };
    },
  };
}