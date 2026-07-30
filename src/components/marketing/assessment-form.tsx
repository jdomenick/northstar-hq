// Public Assessment request form. Validates with the shared schema before
// posting to /api/public/assessment, which re-validates server side.

import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  assessmentRequestSchema,
  BUSINESS_SIZE_OPTIONS,
  INDUSTRY_OPTIONS,
  REFERRAL_OPTIONS,
  type AssessmentSubmitResult,
} from "@/lib/marketing/assessment";
import { BRAND } from "@/lib/marketing/content";
import { cn } from "@/lib/utils";

type Errors = Partial<Record<string, string>>;

const fieldClass =
  "w-full border border-input bg-background px-3.5 py-2.5 text-[14px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary";
const labelClass = "text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground";

export function AssessmentForm({ compact = false }: { compact?: boolean }) {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const fd = new FormData(e.currentTarget);
    const raw = {
      fullName: String(fd.get("fullName") ?? ""),
      company: String(fd.get("company") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      website: String(fd.get("website") ?? ""),
      industry: String(fd.get("industry") ?? ""),
      businessSize: String(fd.get("businessSize") ?? ""),
      biggestChallenge: String(fd.get("biggestChallenge") ?? ""),
      referralSource: String(fd.get("referralSource") ?? ""),
      consent: fd.get("consent") === "on",
      company_website_confirm: String(fd.get("company_website_confirm") ?? ""),
    };

    const parsed = assessmentRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setStatus("submitting");
    try {
      const res = await fetch("/api/public/assessment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await res.json()) as AssessmentSubmitResult;
      if (body.ok) {
        setStatus("done");
        return;
      }
      setServerError(body.message);
      setStatus("idle");
    } catch {
      setServerError("We could not reach the server. Please try again or email us directly.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="border border-primary/40 bg-primary/5 p-7" role="status" aria-live="polite">
        <CheckCircle2 className="h-6 w-6 text-primary" />
        <h2 className="mt-4 font-display text-[20px] font-semibold text-foreground">
          Your request has been received.
        </h2>
        <p className="mt-3 max-w-xl text-[14.5px] leading-[1.8] text-muted-foreground">
          A member of the NorthStar Labs team will review it and follow up to schedule Discovery. If you
          need to reach us sooner, email{" "}
          <a className="text-foreground underline underline-offset-4" href={`mailto:${BRAND.email}`}>
            {BRAND.email}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={cn("space-y-5", compact && "max-w-2xl")}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" name="fullName" error={errors.fullName} required autoComplete="name" />
        <Field label="Company" name="company" error={errors.company} required autoComplete="organization" />
        <Field label="Email" name="email" type="email" error={errors.email} required autoComplete="email" />
        <Field label="Phone" name="phone" type="tel" error={errors.phone} autoComplete="tel" />
        <Field
          label="Website"
          name="website"
          placeholder="example.com"
          error={errors.website}
          autoComplete="url"
        />
        <div>
          <label className={labelClass} htmlFor="industry">
            Industry
          </label>
          <select id="industry" name="industry" className={cn(fieldClass, "mt-2")} defaultValue="">
            <option value="">Select an industry</option>
            {INDUSTRY_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="businessSize">
            Business size
          </label>
          <select id="businessSize" name="businessSize" className={cn(fieldClass, "mt-2")} defaultValue="">
            <option value="">Select a size</option>
            {BUSINESS_SIZE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="referralSource">
            How did you hear about us
          </label>
          <select
            id="referralSource"
            name="referralSource"
            className={cn(fieldClass, "mt-2")}
            defaultValue=""
          >
            <option value="">Select one</option>
            {REFERRAL_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="biggestChallenge">
          Biggest challenge <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="biggestChallenge"
          name="biggestChallenge"
          rows={5}
          required
          maxLength={2000}
          aria-invalid={Boolean(errors.biggestChallenge)}
          aria-describedby={errors.biggestChallenge ? "biggestChallenge-error" : undefined}
          placeholder="What is limiting growth right now?"
          className={cn(fieldClass, "mt-2 resize-y")}
        />
        {errors.biggestChallenge && (
          <p id="biggestChallenge-error" className="mt-1.5 text-[12.5px] text-destructive">
            {errors.biggestChallenge}
          </p>
        )}
      </div>

      {/* Honeypot. Hidden from users, visible to naive bots. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="company_website_confirm">Leave this field empty</label>
        <input id="company_website_confirm" name="company_website_confirm" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex items-start gap-3">
        <input
          id="consent"
          name="consent"
          type="checkbox"
          className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
          aria-describedby={errors.consent ? "consent-error" : undefined}
        />
        <label htmlFor="consent" className="text-[13px] leading-[1.7] text-muted-foreground">
          I agree that NorthStar Labs may contact me about this request. See the{" "}
          <a className="text-foreground underline underline-offset-4" href="/privacy">
            Privacy Policy
          </a>
          .
        </label>
      </div>
      {errors.consent && (
        <p id="consent-error" className="text-[12.5px] text-destructive">
          Consent is required to submit.
        </p>
      )}

      {serverError && (
        <p role="alert" className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-foreground">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex items-center justify-center gap-2 bg-primary px-6 py-3 text-[12px] font-medium uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {status === "submitting" && <Loader2 className="h-4 w-4 animate-spin" />}
        {status === "submitting" ? "Submitting" : "Request an Assessment"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  type = "text",
  required,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  error?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={name}>
        {label} {required && <span aria-hidden="true">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        className={cn(fieldClass, "mt-2")}
      />
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-[12.5px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}