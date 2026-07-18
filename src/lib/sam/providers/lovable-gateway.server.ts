import { generateText, generateObject, NoObjectGeneratedError } from "ai";
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
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (generateObject as any)({
          model,
          system: req.system,
          messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
          schema: req.responseSchema,
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
      } catch (err) {
        // Gemini through json_object mode is not strict-schema-enforced;
        // if the model returns extra text or an incomplete object the SDK
        // throws AI_NoObjectGeneratedError with the raw text attached.
        // Salvage it: parse the JSON out of error.text and re-validate through
        // the (now defaulted) schema so partial answers still render.
        if (NoObjectGeneratedError.isInstance(err)) {
          const raw = (err as unknown as { text?: string }).text ?? "";
          const salvaged = salvageJson(raw);
          if (salvaged !== null) {
            const parsed = (req.responseSchema as { safeParse: (v: unknown) => { success: boolean; data?: unknown } }).safeParse(salvaged);
            if (parsed.success) {
              const usage = (err as unknown as { usage?: { inputTokens?: number; outputTokens?: number } }).usage;
              return {
                content: parsed.data as T,
                providerId: "lovable",
                modelId,
                usage: {
                  inputTokens: usage?.inputTokens,
                  outputTokens: usage?.outputTokens,
                  latencyMs: Date.now() - started,
                },
              };
            }
          }
          // Final fallback: return the raw text as the answer so the user sees
          // something instead of "Response failed."
          if (raw.trim()) {
            return {
              content: { answer: raw.trim(), executive_summary: null, observations: [], risks: [], opportunities: [], recommendations: [], missing_information: [], assumptions: [], next_question: null, model_confidence_hint: null, citations: [], unsupported_action: null } as unknown as T,
              providerId: "lovable",
              modelId,
              usage: { latencyMs: Date.now() - started },
            };
          }
        }
        throw err;
      }
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