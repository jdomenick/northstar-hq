import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-context";
import { getMyClientContextFn } from "@/lib/client-identity/identity.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const { loading: orgLoading, memberships } = useOrg();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const getClientContext = useServerFn(getMyClientContextFn);

  // A signed-in client account has no operator membership. Send it to the
  // client workspace instead of the operator onboarding flow.
  const noMemberships = !loading && Boolean(user) && !orgLoading && memberships.length === 0;
  const { data: clientContext } = useQuery({
    queryKey: ["client-context", user?.id],
    queryFn: () => getClientContext(),
    enabled: noMemberships,
    retry: false,
  });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (clientContext) {
      navigate({ to: "/client", replace: true });
      return;
    }
    if (!orgLoading && memberships.length === 0 && pathname !== "/onboarding") {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [loading, user, orgLoading, memberships, pathname, navigate, clientContext]);

  if (loading || !user) {
    return <FullscreenLoader label="Preparing NorthStar Labs" />;
  }

  if (orgLoading) {
    return <FullscreenLoader label="Loading your workspace" />;
  }

  if (memberships.length === 0) {
    // will redirect
    return <FullscreenLoader label="Loading your workspace" />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function FullscreenLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background paper-grain">
      <div className="flex flex-col items-center gap-5">
        <div className="font-display text-[36px] leading-none text-foreground">NorthStar Labs</div>
        <div className="h-px w-16 bg-foreground/40" />
        <div className="text-[10.5px] uppercase tracking-[0.28em] text-foreground/60">
          {label}
        </div>
      </div>
    </div>
  );
}