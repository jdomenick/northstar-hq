import { createContext, useContext, type ReactNode } from "react";

/**
 * Preview mode marker. When present, client workspace components read data via
 * the operator preview server functions (scoped by organization + client) and
 * disable every write control. It is never set in a real client session.
 */
export interface ClientPreviewState {
  organizationId: string;
  clientId: string;
  companyName: string;
}

const Ctx = createContext<ClientPreviewState | null>(null);

export function ClientPreviewProvider({
  value,
  children,
}: {
  value: ClientPreviewState;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClientPreview(): ClientPreviewState | null {
  return useContext(Ctx);
}

/** True when the current tree is an operator preview and must stay read-only. */
export function useIsClientPreview(): boolean {
  return useContext(Ctx) !== null;
}
