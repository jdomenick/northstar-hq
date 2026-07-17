// social_publish handler skeleton for Beehiiv (6a).
//
// The handler evaluates all nine pre-publish gates and records the outcome
// on the job. It does NOT invoke the Beehiiv publish endpoint unless
// BEEHIIV_PUBLISH_ARMED === "true" (gate 9). 6a never sets that flag, so
// no real newsletter can leave through this path.

import { z } from "zod";
import { AutomationError } from "@/lib/automation/errors";
import { registerHandler, type HandlerFn } from "@/lib/automation/executor.server";
import {
  evaluatePublishGates,
  PUBLISH_GATES_VERSION,
  type ContentItemForPublish,
} from "@/lib/content-ops/publish-gates.server";

export const BeehiivPublishInputSchema = z.object({
  contentItemId: z.string().uuid(),
  trigger: z.enum(["scheduled", "manual"]).default("scheduled"),
});

export const BEEHIIV_PUBLISH_HANDLER_VERSION = "beehiiv.publish.v1-6a";

const handler: HandlerFn = async ({ supabase, job }) => {
  const parsed = BeehiivPublishInputSchema.safeParse(job.input_payload ?? {});
  if (!parsed.success) throw new AutomationError("malformed_input", parsed.error.message);
  const { contentItemId, trigger } = parsed.data;

  const { data: item, error } = await supabase
    .from("social_content_items")
    .select(
      "id, organization_id, venture_id, platform, status, approval_status, approved_content_version, content_version, external_post_id, duplicate_fingerprint, scheduled_for, body, newsletter_subject",
    )
    .eq("id", contentItemId)
    .eq("organization_id", job.organization_id)
    .maybeSingle();
  if (error) throw new AutomationError("internal_automation_error", error.message);
  if (!item) throw new AutomationError("source_deleted", "content item not found");
  if (item.platform !== "beehiiv") {
    throw new AutomationError("job_not_implemented", `platform_not_supported_in_6a:${item.platform}`);
  }

  const gates = await evaluatePublishGates({
    supabase,
    item: item as ContentItemForPublish,
    trigger,
  });

  if (!gates.ok) {
    return {
      outputSummary: {
        handlerVersion: BEEHIIV_PUBLISH_HANDLER_VERSION,
        gatesVersion: PUBLISH_GATES_VERSION,
        gatesPassed: gates.passed,
        gateFailure: gates.failure,
        published: false,
        note: "6a: gates block real publish; no external side effect performed.",
      },
      significance: "minor",
    };
  }

  const { beehiivAdapter } = await import("@/lib/social/providers/beehiiv");
  if (!beehiivAdapter.publish) {
    throw new AutomationError("job_not_implemented", "beehiiv adapter missing publish()");
  }
  const res = await beehiivAdapter.publish({
    organizationId: item.organization_id,
    ventureId: item.venture_id,
    contentItemId: item.id,
    socialAccountId: null,
    title: null,
    body: item.body,
    hashtags: [],
    linkUrl: null,
    scheduledFor: item.scheduled_for,
    newsletterSubject: item.newsletter_subject,
    newsletterPreview: null,
  });

  if (res.status === "failed" || res.status === "blocked_missing_credentials") {
    return {
      outputSummary: {
        handlerVersion: BEEHIIV_PUBLISH_HANDLER_VERSION,
        gatesVersion: PUBLISH_GATES_VERSION,
        gatesPassed: gates.passed,
        adapterStatus: res.status,
        providerMessage: res.providerMessage,
        published: false,
      },
      significance: "moderate",
    };
  }

  const { error: upErr } = await supabase
    .from("social_content_items")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      external_post_id: res.externalPostId,
      external_post_url: res.externalPostUrl,
    } as never)
    .eq("id", item.id)
    .is("external_post_id", null);
  if (upErr) throw new AutomationError("internal_automation_error", upErr.message);

  let verified: { verified: boolean; reason?: string } = { verified: false, reason: "no_id" };
  if (res.externalPostId && beehiivAdapter.verifyPublication) {
    verified = await beehiivAdapter.verifyPublication(res.externalPostId);
  }

  return {
    outputSummary: {
      handlerVersion: BEEHIIV_PUBLISH_HANDLER_VERSION,
      gatesVersion: PUBLISH_GATES_VERSION,
      gatesPassed: gates.passed,
      adapterStatus: res.status,
      externalPostId: res.externalPostId,
      externalPostUrl: res.externalPostUrl,
      verification: verified,
      published: true,
    },
    signals: [
      {
        signalType: "social_publish_succeeded",
        title: "Beehiiv post created",
        description: `content_item=${item.id} external=${res.externalPostId ?? "?"}`,
        significance: "major",
      },
    ],
    changedContentItemId: item.id,
    significance: "major",
  };
};

registerHandler("social_publish", handler);