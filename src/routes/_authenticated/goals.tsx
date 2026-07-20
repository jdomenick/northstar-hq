import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/goals")({
  beforeLoad: () => { throw redirect({ to: "/labs/goals" }); },
});
