// App User Connector OAuth landing page.
//
// The popup lands here after provider consent. It never holds an app session
// inside the embedded editor preview, so it only forwards the one-time code to
// the opener, which exchanges it through an authenticated server function.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/oauth/connector/return")({
  component: ConnectorReturn,
  head: () => ({
    meta: [
      { title: "Finishing connection | NorthStar Labs" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ConnectorReturn() {
  const [message, setMessage] = useState("Finishing connection...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectorId = params.get("connector_id") ?? "";
    const notify = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
      code?: string,
    ) => {
      window.opener?.postMessage(
        { type, connectorId, code: code ?? null },
        window.location.origin,
      );
      window.close();
    };

    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "Authorization did not complete.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        notify("appUserConnectorOAuthComplete");
        return;
      }
      setMessage("Authorization completed without an exchange code.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    notify("appUserConnectorOAuthComplete", code);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-8">
      <p className="text-sm text-muted-foreground">{message}</p>
    </main>
  );
}
