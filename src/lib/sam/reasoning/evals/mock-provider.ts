// Mock CompletionProvider used only by the reasoning eval harness. Returns
// per-fixture, per-pass canned structured outputs so that all 12 fixtures can
// be run through the REAL router + dispatcher + strategy modules (single_pass,
// plan_then_critique, multi_actor, deterministic_only) without incurring
// provider cost or non-determinism.
//
// The mock inspects the request's metadata.intent suffix to distinguish
// passes ("<intent>:analyst", ":critic", ":executive", ":<role>",
// ":synthesis"). A fixture id is threaded through metadata.workflow so the
// mock can return the right canned data.

import type {
  CompletionProvider,
  CompletionRequest,
  CompletionResponse,
  ProviderCapabilities,
  ProviderId,
} from "@/lib/sam/providers/types";
import type { SamResponse } from "@/lib/sam/schema";
import type {
  AnalystOutput,
  CriticOutput,
  ExecutiveExtension,
  SpecialistOutput,
  SpecialistRole,
} from "../trace";

export type MockPass =
  | "analyst"
  | "critic"
  | "executive"
  | "synthesis"
  | SpecialistRole
  | "single";

export interface FixturePlan {
  fixtureId: string;
  analyst?: AnalystOutput;
  critic?: CriticOutput;
  executive?: SamResponse & { executive_extension: ExecutiveExtension };
  synthesis?: SamResponse & { executive_extension: ExecutiveExtension };
  specialists?: Partial<Record<SpecialistRole, SpecialistOutput>>;
  single?: SamResponse;
  // When true the request throws (simulates provider failure).
  failOn?: MockPass[];
  // When true the response returns malformed content that will not parse.
  invalidOn?: MockPass[];
}

const CAPABILITIES: ProviderCapabilities = {
  maxContextTokens: 128_000,
  supportsJsonMode: true,
  supportsToolCalls: false,
  supportsStreaming: false,
};

function detectPass(req: CompletionRequest): MockPass {
  const intent = req.metadata.intent || "";
  const suffix = intent.includes(":") ? intent.split(":").pop()! : "";
  if (
    suffix === "analyst" ||
    suffix === "critic" ||
    suffix === "executive" ||
    suffix === "synthesis"
  )
    return suffix as MockPass;
  if (
    suffix === "operations" ||
    suffix === "revenue" ||
    suffix === "financial_risk" ||
    suffix === "strategic_alignment"
  )
    return suffix as SpecialistRole;
  return "single";
}

export function createFixtureMockProvider(
  plans: Record<string, FixturePlan>,
  currentFixtureRef: { current: string },
): CompletionProvider {
  const routeRequest = <T>(req: CompletionRequest): CompletionResponse<T> => {
    const plan = plans[currentFixtureRef.current];
    if (!plan) {
      throw new Error(`no mock plan for fixture ${currentFixtureRef.current}`);
    }
    const pass = detectPass(req);
    if (plan.failOn?.includes(pass)) {
      throw new Error(`mock provider failure on ${pass}`);
    }
    let content: unknown;
    if (plan.invalidOn?.includes(pass)) {
      content = { not: "valid" };
    } else {
      switch (pass) {
        case "analyst":
          content = plan.analyst;
          break;
        case "critic":
          content = plan.critic;
          break;
        case "executive":
          content = plan.executive;
          break;
        case "synthesis":
          content = plan.synthesis;
          break;
        case "operations":
        case "revenue":
        case "financial_risk":
        case "strategic_alignment":
          content = plan.specialists?.[pass];
          break;
        default:
          content = plan.single;
      }
    }
    if (content === undefined) {
      throw new Error(`fixture ${plan.fixtureId} missing pass ${pass}`);
    }
    return {
      content: content as T,
      providerId: "local" as ProviderId,
      modelId: "mock-fixture-provider",
      usage: { inputTokens: 100, outputTokens: 100, latencyMs: 1 },
    };
  };

  return {
    id: "local",
    modelId: "mock-fixture-provider",
    capabilities: CAPABILITIES,
    async generateStructuredResponse<T>(req: CompletionRequest) {
      return routeRequest<T>(req);
    },
    async generateTextResponse(req: CompletionRequest) {
      return routeRequest<string>(req) as CompletionResponse<string>;
    },
    async healthCheck() {
      return { ok: true };
    },
    getModelMetadata() {
      return { providerId: "local", modelId: "mock-fixture-provider", capabilities: CAPABILITIES };
    },
  };
}