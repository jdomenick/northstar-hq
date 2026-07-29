import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  getMyClientContextFn,
  recordClientSessionFn,
} from "@/lib/client-identity/identity.functions";

export function ClientFrame({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background paper-grain px-5 py-10 md:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.28em] text-foreground/60">
          {label ?? "NorthStar Labs"}
        </div>
        {children}
      </div>
    </div>
  );
}

export function ClientLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background paper-grain">
      <div className="flex flex-col items-center gap-5">
        <div className="font-display text-[32px] leading-none text-foreground">NorthStar Labs</div>
        <div className="h-px w-16 bg-foreground/40" />
        <div className="text-[10.5px] uppercase tracking-[0.28em] text-foreground/60">{label}</div>
      </div>
    </div>
  );
}

/**
 * Client workspace guard. Only accounts that resolve to an active
 * client_accounts row may render children. Operator surfaces are never
 * reachable from here.
 */
export function ClientWorkspace({
  children,
}: {
  children: (ctx: NonNullable<Awaited<ReturnType<typeof getMyClientContextFn>>>) => ReactNode;
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const getContext = useServerFn(getMyClientContextFn);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["client-context", user?.id],
    queryFn: () => getContext(),
    enabled: Boolean(user),
    retry: false,
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/client/login", replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (isError) {
      void supabase.auth.signOut().then(() => navigate({ to: "/client/login", replace: true }));
    }
  }, [isError, navigate]);

  if (loading || !user || isLoading) return <ClientLoading label="Loading your workspace" />;
  if (isError || !data) return <ClientLoading label="Signing you out" />;

  return (
    <div className="min-h-screen bg-background paper-grain">
      <header className="border-b border-foreground/12">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-5">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.26em] text-foreground/55">
              NorthStar Labs
            </div>
            <div className="font-display text-[20px] leading-tight text-foreground">
              {data.company.name}
            </div>
          </div>
          <nav className="flex items-center gap-4 text-[11px] uppercase tracking-[0.18em]">
            <ClientNavLink to="/client" active={pathname === "/client"}>
              Overview
            </ClientNavLink>
            <ClientNavLink to="/client/profile" active={pathname === "/client/profile"}>
              Profile
            </ClientNavLink>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 py-10">{children(data)}</main>
    </div>
  );
}

function ClientNavLink({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={active ? "text-foreground" : "text-foreground/55 hover:text-foreground"}
    >
      {children}
    </Link>
  );
}

function SignOutButton() {
  const navigate = useNavigate();
  const record = useServerFn(recordClientSessionFn);
  return (
    <button
      onClick={async () => {
        await record({ data: { event: "client_logout" } }).catch(() => undefined);
        await supabase.auth.signOut();
        navigate({ to: "/client/login", replace: true });
      }}
      className="text-foreground/55 uppercase tracking-[0.18em] hover:text-foreground"
    >
      Sign out
    </button>
  );
}