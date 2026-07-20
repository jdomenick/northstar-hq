import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/sam-control")({
  beforeLoad: () => { throw redirect({ to: "/sam/control" }); },
});
