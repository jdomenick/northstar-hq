import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the Supabase client reads its session from localStorage.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s['authorization_id'] === "string" ? (s['authorization_id'] as string) : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error) throw error;
    if (data && "redirect_url" in data) throw redirect({ href: data.redirect_url });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="font-display text-[28px] text-foreground">Authorization unavailable</h1>
      <p className="mt-3 text-[14px] text-muted-foreground">
        Could not load this authorization request: {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName =
    details && "client" in details ? (details.client?.name ?? "this application") : "this application";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: decisionError } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorization_id)
      : await supabase.auth.oauth.denyAuthorization(authorization_id);
    if (decisionError) {
      setBusy(false);
      setError(decisionError.message);
      return;
    }
    const target = data?.redirect_url;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-10 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-[13px] font-semibold text-background">
          N
        </div>
        <div className="leading-tight">
          <div className="font-display text-[18px]">NorthStar Labs</div>
          <div className="text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground/80">Executive OS</div>
        </div>
      </div>

      <h1 className="font-display text-[30px] leading-tight text-foreground">Connect {clientName}</h1>
      <p className="mt-3 text-[14px] text-muted-foreground">
        {clientName} is requesting access to NorthStar Labs as you. It can read and act on the data your account
        already has access to.
      </p>

      {error ? (
        <p role="alert" className="mt-5 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => decide(true)}
          className="flex-1 rounded-md bg-foreground px-4 py-2.5 text-[14px] font-medium text-background disabled:opacity-60"
        >
          {busy ? "Working..." : "Approve"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide(false)}
          className="flex-1 rounded-md border border-border px-4 py-2.5 text-[14px] font-medium text-foreground disabled:opacity-60"
        >
          Deny
        </button>
      </div>
    </main>
  );
}
