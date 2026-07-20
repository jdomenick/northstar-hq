import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/revenue")({
  beforeLoad: () => { throw redirect({ to: "/labs/revenue" }); },
});
