import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ClientFrame, ClientLoading } from "@/components/client-shell";

export const Route = createFileRoute("/client/invite/$token")({
  ssr: false,
  component: ClientInvitePage,
  head: () => ({
    meta: [
      { title: "Accept your invitation  -  NorthStar Labs" },
      { name: "description", content: "Set your password and open your NorthStar Labs client workspace." },
      { property: "og:title", content: "Accept your invitation  -  NorthStar Labs" },
      { property: "og:description", content: "Set your password and open your NorthStar Labs client workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

interface Preview {
  first_name: string;
  last_name: string;
  email: string;
  company_name: string;
  expires_at: string;
}

const COPY: Record<string, string> = {
  invitation_invalid: "This invitation link is not valid.",
  invitation_expired: "This invitation has expired. Ask NorthStar Labs to resend it.",
  invitation_revoked: "This invitation was revoked. Ask NorthStar Labs to resend it.",
  invitation_accepted: "This invitation has already been used. Sign in instead.",
  email_in_use: "An account already exists for this email. Sign in instead.",
  invalid_input: "Please check the details you entered.",
  internal_error: "Something went wrong. Please try again.",
};

async function callInvitation(body: Record<string, unknown>) {
  const res = await fetch("/api/public/client/invitation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as
    | { ok: true; invitation?: Preview; email?: string }
    | { ok: false; code: string };
}

function ClientInvitePage() {
  const { token } = useParams({ from: "/client/invite/$token" });
  const navigate = useNavigate();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    callInvitation({ action: "preview", token })
      .then((r) => {
        if (!alive) return;
        if (r.ok && r.invitation) setPreview(r.invitation);
        else setLoadError(COPY[(r as { code: string }).code] ?? COPY.internal_error);
      })
      .catch(() => alive && setLoadError(COPY.internal_error))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Those passwords do not match.");
    setBusy(true);
    const r = await callInvitation({ action: "accept", token, password }).catch(() => null);
    if (!r || !r.ok) {
      setBusy(false);
      setError(r && !r.ok ? (COPY[r.code] ?? COPY.internal_error) : COPY.internal_error);
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: r.email ?? preview?.email ?? "",
      password,
    });
    setBusy(false);
    if (signInError) {
      navigate({ to: "/client/login", replace: true });
      return;
    }
    navigate({ to: "/client", replace: true });
  }

  if (loading) return <ClientLoading label="Checking your invitation" />;

  if (loadError || !preview) {
    return (
      <ClientFrame label="Invitation">
        <h1 className="mt-4 font-display text-[36px] leading-[1.1] text-foreground">
          We could not open this invitation.
        </h1>
        <p className="mt-3 text-[14px] leading-[1.7] text-foreground/70">{loadError}</p>
        <button
          onClick={() => navigate({ to: "/client/login" })}
          className="mt-8 bg-foreground px-5 py-3 text-[11.5px] font-medium uppercase tracking-[0.18em] text-background hover:bg-foreground/85"
        >
          Go to sign in
        </button>
      </ClientFrame>
    );
  }

  return (
    <ClientFrame label="Invitation">
      <h1 className="mt-4 font-display text-[38px] leading-[1.05] text-foreground">
        Welcome, {preview.first_name}.
      </h1>
      <p className="mt-3 text-[14px] leading-[1.7] text-foreground/70">
        You have been invited to the NorthStar Labs client workspace for {preview.company_name}. Set
        a password for {preview.email} to continue.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <label className="block border-b border-foreground/20 pb-3 focus-within:border-foreground">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/60">
            Password
          </div>
          <input
            required
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent text-[15px] text-foreground outline-none"
          />
        </label>
        <label className="block border-b border-foreground/20 pb-3 focus-within:border-foreground">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/60">
            Confirm password
          </div>
          <input
            required
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-transparent text-[15px] text-foreground outline-none"
          />
        </label>
        {error && <p className="text-[13px] text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-foreground px-5 py-3 text-[11.5px] font-medium uppercase tracking-[0.18em] text-background hover:bg-foreground/85 disabled:opacity-50"
        >
          {busy ? "Creating your account" : "Create account"}
        </button>
      </form>
    </ClientFrame>
  );
}