# 09 — Provider Abstraction Layer

SAM must never bind to a single vendor. The Provider Abstraction Layer
(PAL) is the only place in the codebase that speaks to a model. Every
other stage speaks to PAL through typed contracts.

## Interfaces

```ts
interface CompletionProvider {
  id: string                        // 'openai', 'anthropic', 'google', 'local:llama3', ...
  capabilities: {
    maxContextTokens: number
    supportsJsonMode: boolean
    supportsToolCalls: boolean
    supportsStreaming: boolean
  }
  complete(req: CompletionRequest): Promise<CompletionResponse>
}

interface EmbeddingProvider {
  id: string
  dimensions: number
  embed(input: string[]): Promise<number[][]>
}

interface RetrievalStrategy {
  id: 'filter' | 'bm25' | 'vector' | 'hybrid'
  retrieve(req: RetrievalRequest): Promise<RetrievalResponse>
}

interface ProviderRegistry {
  register(p: CompletionProvider | EmbeddingProvider): void
  select(intent: IntentType, policy: ProviderPolicy): CompletionProvider
  fallback(order: string[]): CompletionProvider
}
```

`CompletionRequest` is provider-agnostic:

```
CompletionRequest {
  promptVersion: string
  system: string
  messages: Message[]
  responseSchema?: JsonSchema        // enforced client-side even if provider lacks JSON mode
  temperature?: number
  maxOutputTokens?: number
  metadata: { orgId, intent, workflow, invocationId }
}

CompletionResponse {
  content: string | Json             // Json when responseSchema was set
  providerId: string
  modelId: string
  usage: { inputTokens, outputTokens, latencyMs, costEstimate? }
  raw?: unknown                      // debug-mode only
}
```

## Selection policy

`ProviderPolicy` per intent/workflow decides primary + fallback provider,
privacy tier (`shared_cloud | enterprise_cloud | local_only`), token
budget, and a deterministic-only override.

Resolution order:

1. Org-level Preference memory override.
2. Workflow default in the WorkflowRegistry.
3. Global default in `sam_provider_defaults`.

## Isolation rules

1. **Only PAL imports vendor SDKs.** Nothing outside `src/lib/sam/providers/**` may import `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`, etc.
2. **Prompts live in a registry** (`src/lib/sam/prompts/*`) keyed by `promptVersion`. Providers never author prompts.
3. **Response schemas are enforced client-side** with Zod.
4. **Secrets are read only inside handlers.** Keys are added via the secrets tool when a provider is first enabled.
5. **Local models** implement the same `CompletionProvider` interface.
6. **Provider health** (error rate, latency, cost) feeds selection so PAL can degrade to a fallback under load.

## Phase gating

- **Phase 2.5 (this doc).** Interfaces defined. No adapters shipped.
- **Phase 3.** First adapter behind PAL, wired to Daily Briefing end-to-end.
- **Phase 4.** Second provider + fallback/policy engine.
- **Phase 5+.** Local-model tier for strict-privacy orgs.

## What PAL is NOT

- Not a router that rewrites prompts.
- Not a caching layer (caching is a separate optional wrapper).
- Not a place for business logic. It's an I/O boundary.