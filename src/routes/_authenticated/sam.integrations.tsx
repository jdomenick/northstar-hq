import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { useOrg } from "@/lib/org-context";
import { supabase } from "@/integrations/supabase/client";
import { SamMcpConnectionPanel } from "@/components/sam-mcp-connection-panel";
import { IntegrationDetailDrawer } from "@/components/integration-detail-drawer";
import { ExecutiveActionBlock } from "@/components/executive-action-block";
import {
  listIntegrationsDashboard,
  testIntegrationConnection,
  type IntegrationRow,
  type IntegrationStatus,
  type TestConnectionResult,
} from "@/lib/integrations/dashboard.functions";
import { CATEGORY_ORDER, CATEGORY_LABEL } from "@/lib/integrations/providers";
import type { IntegrationAction } from "@/lib/integrations/actions";
import { beginXConnect, disconnectX, beginRedditConnect, disconnectReddit } from "@/lib/content-ops/social-connect.functions";
import {
  beginConnectorConnect,
  completeConnectorConnect,
  disconnectConnector,
} from "@/lib/integrations/app-user-connector.functions";
import { useVentures } from "@/lib/data-hooks";

export const Route = createFileRoute("/_authenticated/sam/integrations")({
  component: IntegrationsPage,
  head: () => ({
    meta: [
      { title: "Integrations - NorthStar Labs" },
      { name: "description", content: "Every external system SAM uses. Truthful status, one dashboard." },
    ],
  }),
});

function IntegrationsPage() {
  const { activeOrgId } = useOrg();
  const qc = useQueryClient();
  const listFn = useServerFn(listIntegrationsDashboard);
  const testFn = useServerFn(testIntegrationConnection);
  const venturesQ = useVentures(activeOrgId ?? undefined);
  const ventureId = venturesQ.data?.[0]?.id ?? null;
  const rowsQ = useQuery({
    enabled: !!activeOrgId,
    queryKey: ["integrations-dashboard", activeOrgId, ventureId],
    queryFn: () => listFn({ data: { organizationId: activeOrgId!, ventureId } }),
  });

  const beginX = useServerFn(beginXConnect);
  const dropX = useServerFn(disconnectX);
  const beginReddit = useServerFn(beginRedditConnect);
  const dropReddit = useServerFn(disconnectReddit);
  const beginConnector = useServerFn(beginConnectorConnect);
  const completeConnector = useServerFn(completeConnectorConnect);
  const dropConnector = useServerFn(disconnectConnector);

  const [connecting, setConnecting] = useState<null | "facebook" | "instagram">(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, TestConnectionResult>>({});
  const [detailRow, setDetailRow] = useState<IntegrationRow | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  // Support deep-link from Mission Control: /sam/integrations?open=<key>
  useEffect(() => {
    if (!rowsQ.data) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const key = params.get("open");
    if (!key) return;
    const row = rowsQ.data.find((r) => r.key === key);
    if (row) setDetailRow(row);
  }, [rowsQ.data]);

  type TestableKey = "beehiiv" | "linkedin" | "stripe" | "supabase_self" | "sam_mcp" | "website_sync";
  const testableKeys = new Set<TestableKey>([
    "beehiiv",
    "linkedin",
    "stripe",
    "supabase_self",
    "sam_mcp",
    "website_sync",
  ]);
  const testMut = useMutation({
    mutationFn: (key: TestableKey) =>
      testFn({ data: { organizationId: activeOrgId!, key } }),
    onSuccess: (result) => {
      setTestResult((prev) => ({ ...prev, [result.key]: result }));
      qc.invalidateQueries({ queryKey: ["integrations-dashboard", activeOrgId] });
    },
  });

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["integrations-dashboard", activeOrgId, ventureId] });

  const waitForConnectorCode = (popup: Window, connectorId: string) =>
    new Promise<string | null>((resolve, reject) => {
      let poll: number | undefined;
      const cleanup = () => {
        window.removeEventListener("message", onMessage);
        if (poll !== undefined) window.clearInterval(poll);
      };
      const onMessage = (event: MessageEvent) => {
        const payload = event.data as { type?: string; connectorId?: string; code?: string | null };
        if (
          event.origin !== window.location.origin ||
          event.source !== popup ||
          payload?.connectorId !== connectorId ||
          (payload?.type !== "appUserConnectorOAuthComplete" &&
            payload?.type !== "appUserConnectorOAuthFailed")
        ) {
          return;
        }
        cleanup();
        if (payload.type === "appUserConnectorOAuthComplete") {
          resolve(typeof payload.code === "string" ? payload.code : null);
          return;
        }
        popup.close();
        reject(new Error("Authorization failed."));
      };
      window.addEventListener("message", onMessage);
      poll = window.setInterval(() => {
        if (!popup.closed) return;
        cleanup();
        reject(new Error("Authorization window closed before completion."));
      }, 500);
    });

  const runAction = async (rowKey: string, action: IntegrationAction) => {
    if (!activeOrgId) return;
    setConnectError(null);
    setActionBusy(rowKey);
    try {
      if (action.kind === "oauth_connect") {
        if (action.provider === "facebook" || action.provider === "instagram") {
          await startMetaConnect(action.provider);
          return;
        }
        if (!ventureId) throw new Error("No venture in this organization yet.");
        const payload = {
          data: { organizationId: activeOrgId, ventureId, returnPath: "/sam/integrations" },
        };
        const res =
          action.provider === "x" ? await beginX(payload) : await beginReddit(payload);
        if (!res.ok || !res.authorizeUrl) {
          throw new Error(
            res.missing.length
              ? `Setup required. Missing: ${res.missing.join(", ")}`
              : (res.reason ?? "Could not start authorization."),
          );
        }
        window.location.href = res.authorizeUrl;
        return;
      }
      if (action.kind === "oauth_disconnect") {
        if (!ventureId) throw new Error("No venture in this organization yet.");
        const payload = { data: { organizationId: activeOrgId, ventureId } };
        if (action.provider === "x") await dropX(payload);
        else if (action.provider === "reddit") await dropReddit(payload);
        await refresh();
        return;
      }
      if (action.kind === "connector_connect") {
        const popup = window.open("", "northstar-connector-oauth", "width=600,height=720");
        if (!popup) throw new Error("Popup blocked. Allow popups and try again.");
        let code: string | null;
        try {
          const res = await beginConnector({
            data: { organizationId: activeOrgId, connectorId: action.connectorId },
          });
          if (!res.ok || !res.authorizationUrl) {
            throw new Error(
              res.missingEnv.length
                ? `Setup required. Missing: ${res.missingEnv.join(", ")}`
                : (res.reason ?? "Could not start authorization."),
            );
          }
          const completion = waitForConnectorCode(popup, action.connectorId);
          popup.location.href = res.authorizationUrl;
          code = await completion;
        } catch (err) {
          popup.close();
          throw err;
        }
        if (code) {
          await completeConnector({
            data: { organizationId: activeOrgId, connectorId: action.connectorId, code },
          });
        }
        await refresh();
        return;
      }
      if (action.kind === "connector_disconnect") {
        await dropConnector({
          data: { organizationId: activeOrgId, connectorId: action.connectorId },
        });
        await refresh();
        return;
      }
    } catch (err) {
      setConnectError((err as Error).message);
    } finally {
      setActionBusy(null);
    }
  };

  const startMetaConnect = async (which: "facebook" | "instagram") => {
    if (!activeOrgId) return;
    setConnecting(which);
    setConnectError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const redirectUri = `${window.location.origin}/sam/integrations`;
      const res = await fetch(
        `/api/public/oauth/meta/authorize?organizationId=${encodeURIComponent(activeOrgId)}&redirectUri=${encodeURIComponent(redirectUri)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const body = (await res.json()) as { authorizeUrl?: string; error?: string; missing?: string[] };
      if (!res.ok || !body.authorizeUrl) {
        throw new Error(
          body.error === "meta_not_configured"
            ? `Meta credentials not configured (missing: ${(body.missing ?? []).join(", ")})`
            : body.error ?? `Request failed (${res.status})`,
        );
      }
      window.location.href = body.authorizeUrl;
    } catch (err) {
      setConnectError((err as Error).message);
      setConnecting(null);
    }
  };

  const rows = rowsQ.data ?? [];
  const groups = CATEGORY_ORDER.map((k) => ({ key: k, label: CATEGORY_LABEL[k] }));

  return (
    <div>
      <PageHeader
        eyebrow="Integrations"
        title="Integrations"
        description="Every external system SAM uses. Real status, last activity, and last error - no fabrication."
      />
      <PageBody>
        {connectError ? (
          <div className="mb-6 rounded-md border border-[oklch(0.5_0.18_27)]/30 bg-[oklch(0.5_0.18_27)]/5 px-4 py-3 text-[12.5px] text-[oklch(0.5_0.18_27)]">
            {connectError}
          </div>
        ) : null}

        {rowsQ.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading integrations...</div>
        ) : rowsQ.isError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Could not load integrations dashboard.
          </div>
        ) : (
          <>
            {groups.map((g) => {
              const groupRows = rows.filter((r) => r.category === g.key);
              if (groupRows.length === 0) return null;
              return (
                <Section key={g.key} title={g.label}>
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                    {groupRows.map((r) => (
                      <IntegrationCard
                        key={r.key}
                        row={r}
                        busy={
                          actionBusy === r.key ||
                          (r.key === "facebook" && connecting === "facebook") ||
                          (r.key === "instagram" && connecting === "instagram") ||
                          (testMut.isPending && testMut.variables === r.key)
                        }
                        onMetaConnect={() =>
                          startMetaConnect(r.key === "instagram" ? "instagram" : "facebook")
                        }
                        onAction={(a) => void runAction(r.key, a)}
                        onTest={() =>
                          testableKeys.has(r.key as TestableKey) &&
                          testMut.mutate(r.key as TestableKey)
                        }
                        testResult={testResult[r.key] ?? null}
                        onDetails={() => setDetailRow(r)}
                      />
                    ))}
                  </div>
                </Section>
              );
            })}

            <Section title="SAM MCP details">
              <SamMcpConnectionPanel />
            </Section>
          </>
        )}

        <IntegrationDetailDrawer
          organizationId={activeOrgId ?? null}
          row={detailRow}
          open={!!detailRow}
          onOpenChange={(v) => { if (!v) setDetailRow(null); }}
        />
      </PageBody>
    </div>
  );
}

function statusLabel(s: IntegrationStatus): string {
  switch (s) {
    case "connected": return "Connected";
    case "action_needed": return "Action needed";
    case "awaiting_credentials": return "Awaiting credentials";
    case "awaiting_oauth_configuration": return "Awaiting OAuth setup";
    case "awaiting_provider_approval": return "Awaiting provider approval";
    case "ready_to_connect": return "Ready to connect";
    case "authentication_failed": return "Authentication failed";
    case "connection_error": return "Connection error";
    case "not_configured": return "Not configured";
    case "unknown": return "Unknown";
  }
}

function statusDot(s: IntegrationStatus): string {
  switch (s) {
    case "connected": return "bg-[oklch(0.72_0.14_155)]";
    case "action_needed":
    case "awaiting_provider_approval":
    case "awaiting_oauth_configuration": return "bg-[oklch(0.75_0.15_75)]";
    case "awaiting_credentials":
    case "not_configured":
    case "ready_to_connect": return "bg-muted-foreground/60";
    case "authentication_failed":
    case "connection_error":
    case "unknown": return "bg-[oklch(0.5_0.18_27)]";
  }
}

function formatWhen(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function IntegrationCard({
  row,
  busy,
  onMetaConnect,
  onAction,
  onTest,
  testResult,
  onDetails,
}: {
  row: IntegrationRow;
  busy: boolean;
  onMetaConnect: () => void;
  onAction: (action: IntegrationAction) => void;
  onTest: () => void;
  testResult: TestConnectionResult | null;
  onDetails: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusDot(row.status)}`} />
            <div className="text-[14px] font-medium text-foreground">{row.label}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {statusLabel(row.status)}
            </div>
          </div>
          <div className="mt-1.5 text-[13px] text-foreground">{row.headline}</div>
          <div className="mt-1 text-[12.5px] text-muted-foreground">{row.detail}</div>
          {row.identity ? (
            <div className="mt-2 text-[11.5px] text-muted-foreground">
              Identity: <span className="font-mono text-foreground/80">{row.identity}</span>
            </div>
          ) : null}
        </div>
      </div>

      {(row.lastActivityAt || row.lastErrorAt || row.armed !== null) && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border/40 pt-3 text-[11.5px] text-muted-foreground">
          {row.armed !== null ? (
            <div>
              <span className="text-foreground/70">Armed</span>{" "}
              <span className={row.armed ? "text-[oklch(0.72_0.14_155)]" : "text-[oklch(0.75_0.15_75)]"}>
                {row.armed ? "yes" : "no"}
              </span>
            </div>
          ) : null}
          {row.lastActivityAt ? (
            <div>
              <span className="text-foreground/70">{row.lastActivityLabel ?? "Last activity"}</span>{" "}
              {formatWhen(row.lastActivityAt)}
            </div>
          ) : null}
          {row.lastErrorAt ? (
            <div className="col-span-2 text-[oklch(0.5_0.18_27)]">
              <span className="text-foreground/70">Last error</span> {formatWhen(row.lastErrorAt)}
              {row.lastErrorMessage ? ` - ${row.lastErrorMessage}` : ""}
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-3">
        <ExecutiveActionBlock action={row.executiveAction} variant="card" />
      </div>

      {testResult ? (
        <div
          className={`mt-3 rounded-md border px-3 py-2 text-[12px] ${
            testResult.ok
              ? "border-[oklch(0.72_0.14_155)]/30 bg-[oklch(0.72_0.14_155)]/5 text-[oklch(0.55_0.14_155)]"
              : "border-[oklch(0.5_0.18_27)]/30 bg-[oklch(0.5_0.18_27)]/5 text-[oklch(0.5_0.18_27)]"
          }`}
        >
          <div className="font-medium">{testResult.headline} ({testResult.latencyMs}ms)</div>
          <div className="mt-0.5 opacity-80">{testResult.detail}</div>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={onDetails}
          className="rounded-md border border-border px-3 py-1.5 text-[12px] text-foreground hover:bg-secondary/60"
        >
          Details
        </button>
        {row.testable ? (
          <button
            disabled={busy}
            onClick={onTest}
            className="rounded-md border border-border px-3 py-1.5 text-[12px] text-foreground hover:bg-secondary/60 disabled:opacity-50"
          >
            {busy ? "Testing..." : "Test connection"}
          </button>
        ) : null}
        {row.actions.map((action, i) => {
          if (action.kind === "test" || action.kind === "none") return null;
          if (action.kind === "manage_link") {
            return (
              <Link
                key={`${action.kind}-${i}`}
                to={action.href}
                className="rounded-md border border-border px-3 py-1.5 text-[12px] text-foreground hover:bg-secondary/60"
              >
                {action.label}
              </Link>
            );
          }
          if (action.kind === "setup_required") {
            return (
              <button
                key={`${action.kind}-${i}`}
                onClick={onDetails}
                className="rounded-md border border-dashed border-border px-3 py-1.5 text-left text-[11.5px] text-muted-foreground hover:bg-secondary/60"
                title={action.externalStep}
              >
                Setup required
                {action.missingEnv.length ? `: ${action.missingEnv.join(", ")}` : ""}
              </button>
            );
          }
          const primary = i === 0;
          return (
            <button
              key={`${action.kind}-${i}`}
              disabled={busy}
              onClick={() =>
                action.kind === "start_meta_oauth" ? onMetaConnect() : onAction(action)
              }
              className={
                primary
                  ? "rounded-md bg-foreground px-3 py-1.5 text-[12px] text-background hover:opacity-90 disabled:opacity-50"
                  : "rounded-md border border-border px-3 py-1.5 text-[12px] text-foreground hover:bg-secondary/60 disabled:opacity-50"
              }
            >
              {busy ? "..." : action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}