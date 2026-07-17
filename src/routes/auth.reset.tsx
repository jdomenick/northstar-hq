import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/reset")({
  ssr: false,
  component: ResetPassword,
  head: () => ({ meta: [{ title: "New password  -  Northstar" }] }),
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <h1 className="font-display text-[32px] text-foreground">Set a new password.</h1>
      <form onSubmit={onSubmit} className="mt-10 space-y-5">
        <label className="block border-b border-border/80 pb-3 focus-within:border-foreground/60">
          <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">New password</div>
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent text-[15px] text-foreground outline-none"
          />
        </label>
        <button
          disabled={submitting}
          className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-foreground px-4 py-3 text-[13.5px] font-medium text-background disabled:opacity-60"
        >
          {submitting ? "…" : "Update password"}
        </button>
      </form>
    </div>
  );
}