import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";

export type Membership = {
  id: string;
  organization_id: string;
  role: "owner" | "admin" | "executive" | "member" | "viewer";
  status: string;
  organizations: { id: string; name: string; slug: string | null } | null;
};

type OrgState = {
  loading: boolean;
  memberships: Membership[];
  activeOrgId: string | null;
  setActiveOrgId: (id: string) => void;
  activeMembership: Membership | null;
  refresh: () => Promise<void>;
};

const OrgContext = createContext<OrgState | undefined>(undefined);

const ACTIVE_ORG_KEY = "northstar.activeOrgId";

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeOrgId, _setActiveOrgId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    enabled: !!user,
    queryKey: ["memberships", user?.id],
    queryFn: async (): Promise<Membership[]> => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("id, organization_id, role, status, organizations(id,name,slug)")
        .eq("user_id", user!.id)
        .eq("status", "active");
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });

  const memberships = data ?? [];

  // Hydrate active org from storage or first membership
  useEffect(() => {
    if (!memberships.length) {
      _setActiveOrgId(null);
      return;
    }
    const stored = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_ORG_KEY) : null;
    const found = stored && memberships.find((m) => m.organization_id === stored);
    _setActiveOrgId(found ? stored : memberships[0].organization_id);
  }, [memberships]);

  const setActiveOrgId = (id: string) => {
    _setActiveOrgId(id);
    if (typeof window !== "undefined") localStorage.setItem(ACTIVE_ORG_KEY, id);
    qc.invalidateQueries();
  };

  const activeMembership = useMemo(
    () => memberships.find((m) => m.organization_id === activeOrgId) ?? null,
    [memberships, activeOrgId],
  );

  const value: OrgState = {
    loading: isLoading,
    memberships,
    activeOrgId,
    setActiveOrgId,
    activeMembership,
    refresh: async () => {
      await refetch();
    },
  };

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used inside <OrgProvider>");
  return ctx;
}