import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-context";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const { loading: orgLoading, memberships } = useOrg();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (!orgLoading && memberships.length === 0 && pathname !== "/onboarding") {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [loading, user, orgLoading, memberships, pathname, navigate]);

  if (loading || !user) {
    return <FullscreenLoader label="Preparing Northstar" />;
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
        <div className="font-display text-[36px] leading-none text-foreground">Northstar</div>
        <div className="h-px w-16 bg-foreground/40" />
        <div className="text-[10.5px] uppercase tracking-[0.28em] text-foreground/60">
          {label}
        </div>
      </div>
    </div>
  );
}