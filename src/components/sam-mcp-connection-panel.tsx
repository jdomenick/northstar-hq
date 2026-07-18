import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useOrg } from "@/lib/org-context";
import { atLeast } from "@/lib/permissions";
import {
  getSamMcpConnection,
  runSamMcpConnectionTest,
} from "@/lib/sam-mcp/connection.functions";

type Status = "disconnected" | "testing" | "connected" | "failed" | "blocked";

const STATUS_LABEL: Record<Status, string> = {
  disconnected: "Disconnected",
  testing: "Testing",
  connected: "Connected",
  failed: "Failed",
  blocked: "Blocked",
};

const STATUS_DOT: Record<Status, string> = {
  connected: "bg-[oklch(0.72_0.14_155)]",
  testing: "bg-[oklch(0.75_0.14_85)]",
  disconnected: "bg-muted-foreground/40",
  failed: "bg-[oklch(0.5_0.18_27)]",
  blocked: "bg-[oklch(0.5_0.18_27)]",
};

export function SamMcpConnectionPanel() {
  const { activeOrgId, activeMembership } = useOrg();
  const isAdmin = atLeast(activeMembership?.role, "admin");
  const qc = useQueryClient();
  const getFn = useServerFn(getSamMcpConnection);
  const testFn = useServerFn(runSamMcpConnectionTest);

  const q = useQuery({
    enabled: !!activeOrgId && isAdmin,
    queryKey: ["sam-mcp-connection", activeOrgId],
    queryFn: () => getFn({ data: { organizationId: activeOrgId! } }),
  });

  const testMut = useMutation({
    mutationFn: () => testFn({ data: { organizationId: activeOrgId! } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sam-mcp-connection", activeOrgId] }),
  });

  if (!activeOrgId) return null;
  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/40 px-5 py-4 text-[12.5px] text-muted-foreground">
        SAM MCP connection is admin-only.
      </div>
    );
  }

  const data = q.data;
  const record = data && "record" in data ? data.record : null;
  const apiKeyConfigured = data && "apiKeyConfigured" in data ? data.apiKeyConfigured : false;
  const uiStatus: Status = testMut.isPending
    ? "testing"
    : record
      ? record.status
      : "disconnected";
  const outcome = testMut.data && "outcome" in testMut.data ? testMut.data.outcome : null;

  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/70 text-[13px] font-semibold">
              S
            </div>
            <div>
              <div className="text-[14px] text-foreground">SAM MCP Server</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[uiStatus]}`} />
                <span>{STATUS_LABEL[uiStatus]}</span>
                {record?.protocolVersion ? (
                  <span className="text-muted-foreground/60">· MCP {record.protocolVersion}</span>
                ) : null}
              </div>
            </div>
          </div>
          {record?.serverUrl ? (
            <div className="mt-2 truncate text-[11.5px] text-muted-foreground/80">
              {record.serverUrl}
            </div>
          ) : null}
        </div>
        <button
          disabled={testMut.isPending || !apiKeyConfigured}
          onClick={() => testMut.mutate()}
          className="rounded-md bg-foreground px-3 py-1.5 text-[12px] text-background hover:opacity-90 disabled:opacity-50"
          title={!apiKeyConfigured ? "SAM_MCP_API_KEY must be set on the server first" : "Run initialize → tools/list → sam.list_pending_approvals"}
        >
          {testMut.isPending ? "Testing..." : "Test Connection"}
        </button>
      </div>

      {!apiKeyConfigured ? (
        <div className="mt-4 rounded-md border border-[oklch(0.5_0.18_27)]/30 bg-[oklch(0.5_0.18_27)]/5 p-3 text-[12px] text-[oklch(0.5_0.18_27)]">
          <div className="font-medium">Blocked: SAM_MCP_API_KEY is not configured.</div>
          <div className="mt-1 text-muted-foreground">
            Add a secret named <code className="rounded bg-secondary/70 px-1 py-0.5">SAM_MCP_API_KEY</code> in
            Project Settings → Secrets. See <code className="rounded bg-secondary/70 px-1 py-0.5">docs/sam-mcp-connection.md</code> for the full one-time setup.
          </div>
        </div>
      ) : null}

      {record && !testMut.isPending ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
          <dt className="text-muted-foreground">Last tested</dt>
          <dd className="truncate">{record.lastTestedAt ? new Date(record.lastTestedAt).toLocaleString() : "Never"}</dd>
          <dt className="text-muted-foreground">Last success</dt>
          <dd className="truncate">{record.lastSuccessAt ? new Date(record.lastSuccessAt).toLocaleString() : "Never"}</dd>
          <dt className="text-muted-foreground">Discovered tools</dt>
          <dd className="truncate">{record.discoveredTools.length ? record.discoveredTools.length.toString() : "0"}</dd>
          <dt className="text-muted-foreground">Last SAM operation</dt>
          <dd className="truncate font-mono text-[11px]">{record.lastOperationId ?? "-"}</dd>
          {record.lastErrorCode ? (
            <>
              <dt className="text-muted-foreground">Last error</dt>
              <dd className="truncate text-[oklch(0.5_0.18_27)]">
                {record.lastErrorCode}: {record.lastErrorMessage}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}

      {outcome && outcome.status === "connected" ? (
        <div className="mt-3 rounded-md border border-[oklch(0.72_0.14_155)]/30 bg-[oklch(0.72_0.14_155)]/5 p-3 text-[12px]">
          Connected. sam.list_pending_approvals returned {outcome.pendingApprovalsCount ?? "unknown"} item(s).
        </div>
      ) : null}
      {record?.discoveredTools && record.discoveredTools.length > 0 ? (
        <div className="mt-3">
          <div className="text-[11.5px] text-muted-foreground">Tools</div>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {record.discoveredTools.slice(0, 24).map((t) => (
              <li key={t} className="rounded bg-secondary/70 px-1.5 py-0.5 font-mono text-[10.5px]">{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}