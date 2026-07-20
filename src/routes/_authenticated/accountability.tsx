import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/accountability")({
  beforeLoad: () => { throw redirect({ to: "/labs/accountability" }); },
});
