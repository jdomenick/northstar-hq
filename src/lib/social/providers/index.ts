// Provider adapter registry stubs. No real provider is registered in
// 3D.2c-iii. Live provider adapters must:
//   - never approve content
//   - never transition authoritative state
//   - never enable master switch or emergency stop
//   - be invoked only from server code, under an active connector

export interface SocialProviderAdapter {
  readonly key: string;
  readonly implementationStatus: "not_implemented" | "implemented";
  readonly connectorVersion: string;
}

export const SOCIAL_PROVIDERS: Record<string, SocialProviderAdapter> = {};

export function getSocialProvider(key: string): SocialProviderAdapter | null {
  return SOCIAL_PROVIDERS[key] ?? null;
}