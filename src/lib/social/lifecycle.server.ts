// Lifecycle transition helpers. Deterministic; provider output cannot
// transition authoritative state.

import { SocialError } from "./errors";
import type {
  SocialBrandProfileStatus, SocialCampaignStatus, SocialContentStatus, SocialPlanStatus,
} from "@/lib/constants";

const BRAND: Readonly<Record<SocialBrandProfileStatus, readonly SocialBrandProfileStatus[]>> = {
  draft: ["pending_review","archived"],
  pending_review: ["draft","approved","archived"],
  approved: ["active","archived"],
  active: ["superseded","archived"],
  superseded: ["archived"],
  archived: [],
};

const CAMPAIGN: Readonly<Record<SocialCampaignStatus, readonly SocialCampaignStatus[]>> = {
  draft: ["pending_approval","cancelled","archived"],
  pending_approval: ["approved","draft","cancelled"],
  approved: ["active","paused","cancelled","archived"],
  active: ["paused","completed","cancelled"],
  paused: ["active","cancelled","archived"],
  completed: ["archived"],
  cancelled: ["archived"],
  archived: [],
};

const PLAN: Readonly<Record<SocialPlanStatus, readonly SocialPlanStatus[]>> = {
  draft: ["pending_review","cancelled","archived"],
  pending_review: ["approved","draft","cancelled"],
  approved: ["active","cancelled","archived"],
  active: ["completed","cancelled","archived"],
  completed: ["archived"],
  cancelled: ["archived"],
  archived: [],
};

const CONTENT: Readonly<Record<SocialContentStatus, readonly SocialContentStatus[]>> = {
  idea: ["draft","cancelled","archived"],
  draft: ["generated","needs_review","paused","cancelled","archived"],
  generated: ["needs_review","paused","cancelled","archived"],
  needs_review: ["changes_requested","approved","paused","cancelled","archived"],
  changes_requested: ["draft","generated","needs_review","cancelled"],
  approved: ["scheduled","paused","cancelled","archived"],
  scheduled: ["publishing","paused","cancelled","archived"],
  publishing: ["published","failed","cancelled"],
  published: ["archived"],
  failed: ["draft","scheduled","cancelled","archived"],
  paused: ["draft","approved","scheduled","cancelled","archived"],
  cancelled: ["archived"],
  archived: [],
};

function assert<T extends string>(
  map: Readonly<Record<T, readonly T[]>>, from: T, to: T,
  code: "invalid_content_transition" | "invalid_approval_transition" = "invalid_content_transition",
) {
  const allowed = map[from];
  if (!allowed || !allowed.includes(to)) throw new SocialError(code, `invalid transition ${from} -> ${to}`);
}

export const brandProfileTransition = (from: SocialBrandProfileStatus, to: SocialBrandProfileStatus) => assert(BRAND, from, to);
export const campaignTransition = (from: SocialCampaignStatus, to: SocialCampaignStatus) => assert(CAMPAIGN, from, to);
export const planTransition = (from: SocialPlanStatus, to: SocialPlanStatus) => assert(PLAN, from, to);
export const contentTransition = (from: SocialContentStatus, to: SocialContentStatus) => assert(CONTENT, from, to);

export const isBrandProfileTransitionValid = (from: SocialBrandProfileStatus, to: SocialBrandProfileStatus) =>
  BRAND[from]?.includes(to) ?? false;
export const isCampaignTransitionValid = (from: SocialCampaignStatus, to: SocialCampaignStatus) =>
  CAMPAIGN[from]?.includes(to) ?? false;
export const isPlanTransitionValid = (from: SocialPlanStatus, to: SocialPlanStatus) =>
  PLAN[from]?.includes(to) ?? false;
export const isContentTransitionValid = (from: SocialContentStatus, to: SocialContentStatus) =>
  CONTENT[from]?.includes(to) ?? false;