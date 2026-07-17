// Confidence decay by age since last confirmation. Version constant is
// stamped into audit rows so results are reproducible.
import { MEMORY_DECAY_VERSION } from "@/lib/constants";
export { MEMORY_DECAY_VERSION };

export function decayConfidence(
  baseScore: number,
  lastConfirmedIso: string | null | undefined,
): number {
  if (!lastConfirmedIso) return baseScore * 0.9;
  const days = (Date.now() - new Date(lastConfirmedIso).getTime()) / 86_400_000;
  if (days < 30) return baseScore;
  if (days < 90) return baseScore * 0.95;
  if (days < 180) return baseScore * 0.8;
  if (days < 365) return baseScore * 0.6;
  return baseScore * 0.4;
}