import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/mission-control")({
  beforeLoad: () => { throw redirect({ to: "/labs/mission-control" }); },
});