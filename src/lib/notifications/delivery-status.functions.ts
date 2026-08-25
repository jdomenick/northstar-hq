// Truthful email-delivery configuration status.
//
// Returns booleans only. No secret value, recipient address, or key is ever
// returned to the browser.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EmailDeliveryStatus = {
  recipientConfigured: boolean;
  senderDomainConfigured: boolean;
  apiKeyConfigured: boolean;
  missing: string[];
};

export const getEmailDeliveryStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<EmailDeliveryStatus> => {
    const recipientConfigured = Boolean(process.env["NSL_ASSESSMENT_NOTIFICATION_EMAIL"]?.trim());
    const senderDomainConfigured = Boolean(process.env["NSL_EMAIL_SENDER_DOMAIN"]?.trim());
    const apiKeyConfigured = Boolean(process.env["LOVABLE_API_KEY"]);
    const missing: string[] = [];
    if (!recipientConfigured) missing.push("NSL_ASSESSMENT_NOTIFICATION_EMAIL");
    if (!senderDomainConfigured) missing.push("NSL_EMAIL_SENDER_DOMAIN");
    if (!apiKeyConfigured) missing.push("LOVABLE_API_KEY");
    return { recipientConfigured, senderDomainConfigured, apiKeyConfigured, missing };
  });
