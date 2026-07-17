// Policy precedence helpers. Pure, deterministic.

import type { SocialApprovalPolicy, SocialAutomationMode } from "@/lib/constants";
import type {
  OrganizationSocialSettingsDescriptor,
  VentureSocialSettingsDescriptor,
  SocialAccountDescriptor,
  SocialCampaignDescriptor,
} from "./types";

const MODE_STRICTNESS: Record<SocialAutomationMode, number> = {
  draft_only: 0,
  approval_required: 1,
  auto_publish_approved_templates: 2,
  full_automation: 3,
};

const POLICY_STRICTNESS: Record<SocialApprovalPolicy, number> = {
  human_required: 0,
  campaign_preapproved: 1,
  template_preapproved: 1,
  policy_based: 2,
  no_approval_required: 3,
};

// Lower value = stricter. Lower-level policy may make behavior stricter,
// never weaker.
export function resolveEffectiveAutomationMode(
  org: Pick<OrganizationSocialSettingsDescriptor, "defaultAutomationMode">,
  venture: Pick<VentureSocialSettingsDescriptor, "automationMode"> | null,
  account: Pick<SocialAccountDescriptor, "automationMode"> | null,
  campaign: Pick<SocialCampaignDescriptor, "automationMode"> | null,
): SocialAutomationMode {
  const modes: SocialAutomationMode[] = [
    org.defaultAutomationMode,
    venture?.automationMode ?? "draft_only",
    account?.automationMode ?? "draft_only",
    campaign?.automationMode ?? "draft_only",
  ];
  return modes.reduce<SocialAutomationMode>(
    (acc, m) => (MODE_STRICTNESS[m] < MODE_STRICTNESS[acc] ? m : acc),
    "full_automation",
  );
}

export function resolveEffectiveApprovalPolicy(
  org: Pick<OrganizationSocialSettingsDescriptor, "defaultApprovalPolicy">,
  venture: Pick<VentureSocialSettingsDescriptor, "approvalPolicy"> | null,
  account: Pick<SocialAccountDescriptor, "approvalPolicy"> | null,
  campaign: Pick<SocialCampaignDescriptor, "approvalPolicy"> | null,
): SocialApprovalPolicy {
  const policies: SocialApprovalPolicy[] = [
    org.defaultApprovalPolicy,
    venture?.approvalPolicy ?? "human_required",
    account?.approvalPolicy ?? "human_required",
    campaign?.approvalPolicy ?? "human_required",
  ];
  return policies.reduce<SocialApprovalPolicy>(
    (acc, p) => (POLICY_STRICTNESS[p] < POLICY_STRICTNESS[acc] ? p : acc),
    "no_approval_required",
  );
}

export function requiresApproval(policy: SocialApprovalPolicy, mode: SocialAutomationMode): boolean {
  if (policy === "no_approval_required" && mode === "full_automation") return false;
  if (policy === "human_required") return true;
  if (mode === "draft_only") return false;
  return true;
}