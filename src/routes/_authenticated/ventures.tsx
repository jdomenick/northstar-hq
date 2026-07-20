import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/ventures")({
  beforeLoad: () => { throw redirect({ to: "/labs/ventures" }); },
});
