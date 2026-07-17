// Beehiiv credential + publication validation. Server-only. Requires
// executive membership on the acting org to avoid leaking capabilities
// to viewers.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "./membership.server";
import { ContentOpsError } from "./errors";

const Input = z.object({
  organizationId: z.string().uuid(),
  ventureId: z.string().uuid(),
  expectedPublicationName: z.string().max(200).optional(),
});

export const validateBeehiivConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(
      context.supabase,
      context.userId,
      data.organizationId,
      data.ventureId,
      "executive",
    );
    const { validateBeehiivCredentials } = await import("@/lib/social/providers/beehiiv");
    let result;
    try {
      result = await validateBeehiivCredentials();
    } catch (err) {
      throw new ContentOpsError("provider_error", (err as Error).message);
    }
    const identityMatches = data.expectedPublicationName && result.publicationName
      ? result.publicationName.toLowerCase().includes(data.expectedPublicationName.toLowerCase())
      : null;
    return {
      ...result,
      identityMatches,
      // Never leak the api key or full raw payload to the browser.
      raw: undefined,
    };
  });