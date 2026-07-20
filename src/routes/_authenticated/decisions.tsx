import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/decisions")({
  beforeLoad: () => { throw redirect({ to: "/labs/decisions" }); },
});
