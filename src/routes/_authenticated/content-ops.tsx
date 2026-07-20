import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/content-ops")({
  beforeLoad: () => { throw redirect({ to: "/sam/content" }); },
});
