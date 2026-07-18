// Dispatcher for the shared `social_publish` job type. Reads the content
// item's platform and hands off to the correct per-provider handler.
// Registered exactly once at module import time.

import { AutomationError } from "@/lib/automation/errors";
import { registerHandler, type HandlerFn } from "@/lib/automation/executor.server";
import { beehiivPublishHandler } from "./beehiiv-publish.server";
import { metaPublishHandler } from "./meta-publish.server";

const dispatcher: HandlerFn = async (ctx) => {
  const input = ctx.job.input_payload as { contentItemId?: string } | null;
  const contentItemId = input?.contentItemId;
  if (!contentItemId) throw new AutomationError("malformed_input", "social_publish requires contentItemId");
  const { data: item, error } = await ctx.supabase
    .from("social_content_items")
    .select("platform")
    .eq("id", contentItemId)
    .eq("organization_id", ctx.job.organization_id)
    .maybeSingle();
  if (error) throw new AutomationError("internal_automation_error", error.message);
  if (!item) throw new AutomationError("source_deleted", "content item not found");
  const platform = (item as { platform: string }).platform;
  switch (platform) {
    case "beehiiv":
      return beehiivPublishHandler(ctx);
    case "facebook":
    case "instagram":
      return metaPublishHandler(ctx);
    default:
      throw new AutomationError("job_not_implemented", `social_publish_no_dispatcher:${platform}`);
  }
};

registerHandler("social_publish", dispatcher);
