import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { useOrg } from "@/lib/org-context";
import { supabase } from "@/integrations/supabase/client";
import { SamMcpConnectionPanel } from "@/components/sam-mcp-connection-panel";
import {
  listIntegrationsDashboard,
  testIntegrationConnection,
  type IntegrationRow,
  type IntegrationStatus,
  type TestConnectionResult,
} from "@/lib/integrations/dashboard.functions";
import { CATEGORY_ORDER, CATEGORY_LABEL } from "@/lib/integrations/providers";

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
  const rowsQ = useQuery({
    enabled: !!activeOrgId,
    queryKey: ["integrations-dashboard", activeOrgId],
    queryFn: () => listFn({ data: { organizationId: activeOrgId! } }),
  });

  const [connecting, setConnecting] = useState<null | "facebook" | "instagram">(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, TestConnectionResult>>({});

  type TestableKey = "beehiiv" | "linkedin" | "stripe" | "supabase_self";
  const testableKeys = new Set<TestableKey>(["beehiiv", "linkedin", "stripe", "supabase_self"]);
  const testMut = useMutation({
    mutationFn: (key: TestableKey) =>
      testFn({ data: { organizationId: activeOrgId!, key } }),
    onSuccess: (result) => {
      setTestResult((prev) => ({ ...prev, [result.key]: result }));
      qc.invalidateQueries({ queryKey: ["integrations-dashboard", activeOrgId] });
    },
  });

  const startMetaConnect = async (which: "facebook" | "instagram") => {
    if (!activeOrgId) return;
    setConnecting(which);
    setConnectError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const redirectUri = `${window.location.origin}/integrations`;
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
                          (r.key === "facebook" && connecting === "facebook") ||
                          (r.key === "instagram" && connecting === "instagram") ||
                          (testMut.isPending && testMut.variables === r.key)
                        }
                        onMetaConnect={() =>
                          startMetaConnect(r.key === "instagram" ? "instagram" : "facebook")
                        }
                        onTest={() =>
                          testableKeys.has(r.key as TestableKey) &&
                          testMut.mutate(r.key as TestableKey)
                        }
                        testResult={testResult[r.key] ?? null}
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
  onTest,
  testResult,
}: {
  row: IntegrationRow;
  busy: boolean;
  onMetaConnect: () => void;
  onTest: () => void;
  testResult: TestConnectionResult | null;
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
        {row.testable ? (
          <button
            disabled={busy}
            onClick={onTest}
            className="rounded-md border border-border px-3 py-1.5 text-[12px] text-foreground hover:bg-secondary/60 disabled:opacity-50"
          >
            {busy ? "Testing..." : "Test connection"}
          </button>
        ) : null}
        {row.action.kind === "start_meta_oauth" ? (
          <button
            disabled={busy}
            onClick={onMetaConnect}
            className="rounded-md bg-foreground px-3 py-1.5 text-[12px] text-background hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "..." : row.status === "connected" ? "Manage" : "Connect"}
          </button>
        ) : null}
        {row.action.kind === "manage_link" ? (
          <Link
            to={row.action.href}
            className="rounded-md border border-border px-3 py-1.5 text-[12px] text-foreground hover:bg-secondary/60"
          >
            {row.action.label}
          </Link>
        ) : null}
        {row.action.kind === "ask_lovable" ? (
          <div className="text-[11.5px] text-muted-foreground italic">
            {row.action.message}
          </div>
        ) : null}
        {row.action.kind === "none" && (row.status === "ready_to_connect" || row.status === "awaiting_provider_approval") ? (
          <span className="text-[11.5px] text-muted-foreground/70">
            {row.externalStep ? "See details" : "Ready"}
          </span>
        ) : null}
      </div>
    </div>
  );
}