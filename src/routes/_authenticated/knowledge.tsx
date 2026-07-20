import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/knowledge")({
  beforeLoad: () => { throw redirect({ to: "/labs/knowledge" }); },
});
