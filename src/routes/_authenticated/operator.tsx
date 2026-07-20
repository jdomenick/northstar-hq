import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/operator")({
  beforeLoad: () => { throw redirect({ to: "/labs/operator" }); },
});
