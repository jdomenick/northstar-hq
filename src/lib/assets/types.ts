// Asset abstraction. The Executive OS's primary object - every venture owns
// Assets. Asset types are extensible via the `asset_types` lookup table; do
// not hardcode the set here. Integrations connect to a specific Asset and
// produce Signals about it.

import type {
  AssetCriticality,
  AssetHealth,
  AssetStatus,
} from "@/lib/constants";

export interface AssetDescriptor {
  id: string;
  organizationId: string;
  ventureId: string | null;
  assetType: string;                 // key in public.asset_types
  displayName: string;
  description: string | null;
  status: AssetStatus;
  ownerUserId: string | null;
  criticality: AssetCriticality;
  trustLevel: string;
  health: AssetHealth;
  freshness: "fresh" | "aging" | "stale" | "inaccessible" | "unknown";
  automationMode: "suggest" | "auto_accept" | "off";
  lastActivityAt: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface AssetTypeDescriptor {
  key: string;
  label: string;
  description: string | null;
  category: string | null;
  isSystem: boolean;
}