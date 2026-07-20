// Legacy /operator route. Kept as a permanent client-side redirect to /sam so
// existing bookmarks and back/forward history keep working. See
// docs/sam/adr/0009-preserve-operator-db-identifiers.md for why the database
// enum value `operator` remains unchanged.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/operator")({
  beforeLoad: () => {
    throw redirect({ to: "/sam", replace: true });
  },
  component: () => null,
});