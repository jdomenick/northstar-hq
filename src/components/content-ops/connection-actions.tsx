// Actionable controls for a Content Operations connection card.
//
// Only X exposes an in-app OAuth flow today. LinkedIn is provisioned through
// the workspace connector, Meta through Integrations, and Reddit is not built,
// so those render a truthful non-actionable note instead of a dead button.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { beginXConnect, disconnectX } from "@/lib/content-ops/social-connect.functions";
import type { ContentOpsConnectionStatus } from "@/lib/content-ops/connections.functions";

interface Props {
  connection: ContentOpsConnectionStatus;
  organizationId: string;
  ventureId: string;
}

export function ConnectionActions({ connection, organizationId, ventureId }: Props) {
  const [busy, setBusy] = useState<null | "connect" | "disconnect">(null);
  const beginFn = useServerFn(beginXConnect);
  const disconnectFn = useServerFn(disconnectX);
  const queryClient = useQueryClient();

  if (connection.key !== "x") {
    if (connection.action === "setup_required") {
      return (
        <p className="mt-4 text-xs text-muted-foreground">
          Setup required outside this screen. No publish path is armed.
        </p>
      );
    }
    return null;
  }

  if (connection.action === "setup_required") {
    return (
      <p className="mt-4 text-xs text-muted-foreground">
        Setup required: add {connection.missingCapabilities.join(", ") || "X app credentials"} in
        Project Settings before an account can be connected.
      </p>
    );
  }

  async function startConnect() {
    setBusy("connect");
    try {
      const res = await beginFn({
        data: {
          organizationId,
          ventureId,
          returnPath: window.location.pathname,
        },
      });
      if (!res.ok || !res.authorizeUrl) {
        toast.error(
          res.reason === "x_not_configured"
            ? `X app credentials missing: ${res.missing.join(", ")}`
            : "Could not start the X authorization.",
        );
        return;
      }
      window.location.href = res.authorizeUrl;
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function startDisconnect() {
    setBusy("disconnect");
    try {
      await disconnectFn({ data: { organizationId, ventureId } });
      toast.success("X account disconnected.");
      await queryClient.invalidateQueries({ queryKey: ["content-ops", "connections"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {connection.action === "connect" ? (
        <Button size="sm" onClick={startConnect} disabled={busy !== null}>
          {busy === "connect" ? "Opening X..." : "Connect X account"}
        </Button>
      ) : null}
      {connection.action === "reconnect" ? (
        <Button size="sm" onClick={startConnect} disabled={busy !== null}>
          {busy === "connect" ? "Opening X..." : "Reconnect"}
        </Button>
      ) : null}
      {connection.action === "connected" || connection.action === "reconnect" ? (
        <Button
          size="sm"
          variant="outline"
          onClick={startDisconnect}
          disabled={busy !== null}
        >
          {busy === "disconnect" ? "Disconnecting..." : "Disconnect"}
        </Button>
      ) : null}
    </div>
  );
}
