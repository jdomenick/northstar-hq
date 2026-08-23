import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ClientFrame } from "@/components/client-shell";
import {
  getMyClientContextFn,
  recordClientSessionFn,
} from "@/lib/client-identity/identity.functions";

export const Route = createFileRoute("/client/login")({
  ssr: false,
  component: ClientLoginPage,
  head: () => ({
    meta: [
      { title: "Client sign in  -  NorthStar Labs" },
      { name: "description", content: "Sign in to your NorthStar Labs client workspace." },
      { property: "og:title", content: "Client sign in  -  NorthStar Labs" },
      { property: "og:description", content: "Sign in to your NorthStar Labs client workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ClientLoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const getContext = useServerFn(getMyClientContextFn);
  const record = useServerFn(recordClientSessionFn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user || busy) return;
    getContext()
      .then(() => navigate({ to: "/client", replace: true }))
      .catch(() => undefined);
  }, [loading, user, busy, getContext, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setBusy(false);
      setError("That email and password combination did not work.");
      return;
    }
    try {
      await getContext();
    } catch {
      // Not a client account. It is a valid NorthStar Labs account, so send it
      // to the operator workspace instead of signing it back out.
      setBusy(false);
      navigate({ to: "/command", replace: true });
      return;
    }
    await record({ data: { event: "client_login" } }).catch(() => undefined);
    navigate({ to: "/client", replace: true });
  }

  return (
    <ClientFrame label="Client access">
      <div className="text-[12.5px] text-foreground/60">
        <Link to="/" className="underline underline-offset-4 hover:text-foreground">
          Back to NorthStar Labs
        </Link>
      </div>
      <h1 className="mt-4 font-display text-[40px] leading-[1.05] text-foreground">
        Sign in to your workspace.
      </h1>
      <p className="mt-3 text-[14px] leading-[1.7] text-foreground/70">
        This is the client workspace for NorthStar Labs engagements. Team members of NorthStar Labs
        should use the <Link to="/auth" className="underline">operator sign in</Link>.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <label className="block border-b border-foreground/20 pb-3 focus-within:border-foreground">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/60">
            Email
          </div>
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent text-[15px] text-foreground outline-none"
          />
        </label>
        <label className="block border-b border-foreground/20 pb-3 focus-within:border-foreground">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/60">
            Password
          </div>
          <input
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent text-[15px] text-foreground outline-none"
          />
        </label>
        {error && <p className="text-[13px] text-[var(--brand-danger,theme(colors.destructive))]">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-foreground px-5 py-3 text-[11.5px] font-medium uppercase tracking-[0.18em] text-background hover:bg-foreground/85 disabled:opacity-50"
        >
          {busy ? "Signing in" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-[12.5px] text-foreground/60">
        Need access? Ask your NorthStar Labs contact to send you an invitation.
      </p>
    </ClientFrame>
  );
}