import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/forgot")({
  ssr: false,
  component: ForgotPassword,
  head: () => ({ meta: [{ title: "Reset password — Northstar" }] }),
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else setSent(true);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <h1 className="font-display text-[32px] text-foreground">Reset your password.</h1>
      <p className="mt-3 text-[14px] text-muted-foreground">
        Enter your email. We'll send a link to reset your password.
      </p>
      {sent ? (
        <div className="mt-10 rounded-lg bg-secondary/40 p-5 text-[13.5px] text-foreground">
          Check {email} for a reset link.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-10 space-y-5">
          <label className="block border-b border-border/80 pb-3 focus-within:border-foreground/60">
            <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">Email</div>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent text-[15px] text-foreground outline-none"
            />
          </label>
          <button
            disabled={submitting}
            className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-foreground px-4 py-3 text-[13.5px] font-medium text-background disabled:opacity-60"
          >
            {submitting ? "…" : "Send reset link"}
          </button>
        </form>
      )}
      <Link to="/auth" className="mt-8 text-[12.5px] text-muted-foreground hover:text-foreground">
        ← Back to sign in
      </Link>
    </div>
  );
}