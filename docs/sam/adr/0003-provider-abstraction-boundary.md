# ADR-0003: Provider Abstraction Layer is the only vendor boundary

- Status: Accepted
- Date: 2026-07-17
- Related: docs/sam/09-provider-abstraction.md

## Context
Vendor SDKs, prompts, and response quirks tend to leak across a codebase, making provider swaps painful.

## Decision
Only files under `src/lib/sam/providers/**` may import vendor SDKs. All other SAM code speaks to `CompletionProvider` / `EmbeddingProvider` interfaces. Prompts live in a versioned registry; response schemas are enforced client-side with Zod.

## Alternatives considered
- **Adopt one provider's SDK broadly.** Rejected  -  lock-in.
- **LangChain-style abstraction.** Rejected  -  heavy dependency for a small surface we can own.

## Rationale
A narrow, owned interface is easier to test, audit, and swap than a large third-party framework.

## Consequences
- Positive: swapping OpenAI ↔ Anthropic ↔ local is a config change.
- Negative: adapters must be written per provider.
- Follow-ups: ESLint rule to forbid vendor SDK imports outside `providers/`.