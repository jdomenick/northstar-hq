import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/proposal/$token")({
  component: () => <Outlet />,
});
