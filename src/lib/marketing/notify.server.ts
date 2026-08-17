// Operator notification for new Assessment requests.
//
// Truthful by design: if no notification recipient or verified sender domain
// is configured, the send is reported as "not_configured" rather than
// silently pretending an email went out. Nothing here logs secrets.

import { sendLovableEmail, EmailAPIError } from "@lovable.dev/email-js";

export type NotificationOutcome =
  | { status: "sent" }
  | { status: "not_configured"; error: string }
  | { status: "failed"; error: string };

export interface AssessmentNotificationInput {
  id: string;
  fullName: string;
  company: string;
  email: string;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  businessSize?: string | null;
  biggestChallenge: string;
  referralSource?: string | null;
  reviewUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Header-safe single-line value. Visitor-supplied text reaches the subject
 * line, so CR/LF and other control characters are stripped to prevent email
 * header injection.
 */
function headerSafe(value: string, max = 120): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function fieldRows(input: AssessmentNotificationInput): Array<[string, string]> {
  return [
    ["Company", input.company],
    ["Contact", input.fullName],
    ["Email", input.email],
    ["Phone", input.phone?.trim() || "Not provided"],
    ["Website", input.website?.trim() || "Not provided"],
    ["Industry", input.industry?.trim() || "Not provided"],
    ["Business size", input.businessSize?.trim() || "Not provided"],
    ["Referral source", input.referralSource?.trim() || "Not provided"],
  ];
}

export function buildAssessmentNotification(input: AssessmentNotificationInput): {
  subject: string;
  text: string;
  html: string;
} {
  const rows = fieldRows(input);
  const subject = `New Assessment request: ${headerSafe(input.company)}`;
  const text = [
    "A new Assessment request was submitted on the NorthStar Labs website.",
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    "Biggest challenge:",
    input.biggestChallenge,
    "",
    `Review: ${input.reviewUrl}`,
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0b1220">
<div style="max-width:600px;margin:0 auto;padding:24px">
<p style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#64748b;margin:0 0 8px">NorthStar Labs</p>
<h1 style="font-size:20px;margin:0 0 16px">New Assessment request</h1>
<table style="width:100%;border-collapse:collapse;font-size:14px">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="padding:6px 0;color:#64748b;width:150px">${escapeHtml(k)}</td><td style="padding:6px 0">${escapeHtml(v)}</td></tr>`,
  )
  .join("")}
</table>
<p style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#64748b;margin:20px 0 6px">Biggest challenge</p>
<p style="font-size:14px;line-height:1.7;white-space:pre-wrap;margin:0 0 24px">${escapeHtml(input.biggestChallenge)}</p>
<a href="${escapeHtml(input.reviewUrl)}" style="display:inline-block;background:#0b1220;color:#ffffff;padding:12px 20px;font-size:14px;text-decoration:none">Review this request</a>
</div></body></html>`;

  return { subject, text, html };
}

/**
 * Attempts the operator notification. Never throws: the caller records the
 * returned outcome against the assessment row.
 */
export async function sendAssessmentNotification(
  input: AssessmentNotificationInput,
): Promise<NotificationOutcome> {
  const recipient = process.env.NSL_ASSESSMENT_NOTIFICATION_EMAIL?.trim();
  const senderDomain = process.env.NSL_EMAIL_SENDER_DOMAIN?.trim();
  const apiKey = process.env.LOVABLE_API_KEY;

  if (!recipient) {
    return { status: "not_configured", error: "No operator notification recipient configured." };
  }
  if (!senderDomain) {
    return { status: "not_configured", error: "No verified sender domain configured." };
  }
  if (!apiKey) {
    return { status: "not_configured", error: "Email sending is not available in this environment." };
  }

  const { subject, text, html } = buildAssessmentNotification(input);
  try {
    const res = await sendLovableEmail(
      {
        to: recipient,
        from: `NorthStar Labs <notifications@${senderDomain}>`,
        sender_domain: senderDomain,
        subject,
        html,
        text,
        purpose: "assessment_request_notification",
        idempotency_key: `assessment-${input.id}`,
      },
      { apiKey, idempotencyKey: `assessment-${input.id}` },
    );
    if (!res.success) {
      return { status: "failed", error: res.status ?? "Email provider did not accept the send." };
    }
    return { status: "sent" };
  } catch (e) {
    if (e instanceof EmailAPIError) {
      return { status: "failed", error: `${e.code ?? "email_error"}: ${e.message}` };
    }
    return { status: "failed", error: e instanceof Error ? e.message : "Unknown email failure." };
  }
}