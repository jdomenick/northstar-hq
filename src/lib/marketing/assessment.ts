// Shared validation contract for the public Assessment request form.
// Imported by both the browser form and the public API route so client and
// server validate the exact same shape.

import { z } from "zod";
import { BUSINESS_SIZES, INDUSTRIES, REFERRAL_SOURCES } from "./content";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

export const assessmentRequestSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  company: z.string().trim().min(2, "Enter your company name").max(160),
  email: z.string().trim().email("Enter a valid email address").max(255),
  phone: optionalText(40),
  website: optionalText(255),
  industry: optionalText(80),
  businessSize: optionalText(60),
  biggestChallenge: z
    .string()
    .trim()
    .min(10, "Tell us briefly what is limiting growth")
    .max(2000),
  referralSource: optionalText(80),
  consent: z.literal(true, { message: "Consent is required to submit" }),
  // Honeypot. Real people never fill this in.
  company_website_confirm: z.string().max(0).optional().or(z.literal("")),
});

export type AssessmentRequestInput = z.input<typeof assessmentRequestSchema>;
export type AssessmentRequest = z.output<typeof assessmentRequestSchema>;

export const INDUSTRY_OPTIONS = INDUSTRIES.map((i) => i.name);
export const BUSINESS_SIZE_OPTIONS = [...BUSINESS_SIZES];
export const REFERRAL_OPTIONS = [...REFERRAL_SOURCES];

export type AssessmentSubmitResult =
  | { ok: true }
  | { ok: false; code: "invalid_input" | "rate_limited" | "internal_error"; message: string };