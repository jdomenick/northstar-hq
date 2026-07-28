import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { getIntegrationDetail, type IntegrationRow } from "@/lib/integrations/dashboard.functions";
import type { IntegrationDiagnostics } from "@/lib/integrations/probes.server";
import { ExecutiveActionBlock } from "@/components/executive-action-block";

function formatWhen(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function IntegrationDetailDrawer({
  organizationId,
  row,
  open,
  onOpenChange,
}: {
  organizationId: string | null;
  row: IntegrationRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const detailFn = useServerFn(getIntegrationDetail);
  const q = useQuery({
    enabled: open && !!organizationId && !!row,
    queryKey: ["integration-detail", organizationId, row?.key],
    queryFn: () => detailFn({ data: { organizationId: organizationId!, key: row!.key } }),
  });
  const d = q.data;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{row?.label ?? "Integration"}</SheetTitle>
          <SheetDescription>{row?.description}</SheetDescription>
        </SheetHeader>

        {!d ? (
          <div className="mt-6 text-sm text-muted-foreground">Loading details...</div>
        ) : (
          <div className="mt-6 space-y-6">
            <Block label="Executive action">
              <ExecutiveActionBlock action={d.row.executiveAction} variant="drawer" />
            </Block>

            <Block label="Current status">
              <div className="text-[13px] text-foreground">{d.row.headline}</div>
              <div className="mt-1 text-[12.5px] text-muted-foreground">{d.row.detail}</div>
              {d.row.identity ? (
                <div className="mt-2 text-[11.5px] text-muted-foreground">
                  Identity: <span className="font-mono text-foreground/80">{d.row.identity}</span>
                </div>
              ) : null}
              <MetaRow row={d.row} />
            </Block>

            <Block label="Capabilities">
              <CapabilityMatrix
                declared={d.row.declaredCapabilities}
                granted={d.row.capabilities.granted}
                missing={d.row.capabilities.missing}
              />
            </Block>

            {(d.requiredEnv.length > 0 || d.optionalEnv.length > 0) && (
              <Block label="Environment">
                <EnvList
                  required={d.requiredEnv}
                  optional={d.optionalEnv}
                  missing={
                    d.row.diagnostics?.kind === "env_shell" ? d.row.diagnostics.missingEnv : []
                  }
                />
              </Block>
            )}

            {d.requiredScopes.length > 0 && (
              <Block label="OAuth scopes required">
                <div className="flex flex-wrap gap-1.5">
                  {d.requiredScopes.map((s) => (
                    <span
                      key={s}
                      className="rounded border border-border/60 bg-secondary/40 px-2 py-0.5 font-mono text-[11px] text-foreground/80"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </Block>
            )}

            {d.row.diagnostics ? (
              <Block label="Diagnostics">
                <Diagnostics d={d.row.diagnostics} />
              </Block>
            ) : null}

            <Block label="Recent activity">
              {d.activity.length === 0 ? (
                <div className="text-[12.5px] text-muted-foreground">
                  No activity recorded for this integration yet.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {d.activity.slice(0, 20).map((e, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-3 border-b border-border/40 pb-1.5 text-[12px] last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div
                          className={
                            e.outcome === "success"
                              ? "text-[oklch(0.55_0.14_155)]"
                              : e.outcome === "error"
                                ? "text-[oklch(0.5_0.18_27)]"
                                : "text-foreground/80"
                          }
                        >
                          {e.kind}
                        </div>
                        <div className="mt-0.5 text-muted-foreground truncate">{e.message}</div>
                      </div>
                      <div className="shrink-0 text-[11px] text-muted-foreground">
                        {formatWhen(e.at)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Block>

            <Block label="Adapter">
              <div className="text-[11.5px] text-muted-foreground">
                Version: <span className="font-mono text-foreground/80">{d.row.adapterVersion ?? "n/a"}</span>
              </div>
              {d.row.externalStep ? (
                <div className="mt-1 text-[11.5px] text-muted-foreground">
                  External step: {d.row.externalStep}
                </div>
              ) : null}
              {d.row.docsUrl ? (
                <a
                  href={d.row.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-[11.5px] text-primary hover:underline"
                >
                  Documentation
                </a>
              ) : null}
            </Block>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function MetaRow({ row }: { row: IntegrationRow }) {
  if (!row.lastActivityAt && !row.lastErrorAt && row.armed === null) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border/40 pt-3 text-[11.5px] text-muted-foreground">
      {row.armed !== null ? (
        <div>
          <span className="text-foreground/70">Armed</span>{" "}
          <span
            className={row.armed ? "text-[oklch(0.72_0.14_155)]" : "text-[oklch(0.75_0.15_75)]"}
          >
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
  );
}

function CapabilityMatrix({
  declared,
  granted,
  missing,
}: {
  declared: string[];
  granted: string[];
  missing: string[];
}) {
  const grantedSet = new Set(granted);
  const missingSet = new Set(missing);
  const all = Array.from(new Set([...declared, ...granted, ...missing]));
  if (all.length === 0) {
    return (
      <div className="text-[12.5px] text-muted-foreground">
        No capabilities declared for this integration.
      </div>
    );
  }
  return (
    <ul className="space-y-1">
      {all.map((cap) => {
        const isGranted = grantedSet.has(cap);
        const isMissing = missingSet.has(cap);
        const state = isGranted ? "granted" : isMissing ? "missing" : "not verified";
        return (
          <li
            key={cap}
            className="flex items-center justify-between gap-3 text-[12px] text-foreground/80"
          >
            <span className="font-mono">{cap}</span>
            <span
              className={
                isGranted
                  ? "text-[oklch(0.55_0.14_155)]"
                  : isMissing
                    ? "text-[oklch(0.5_0.18_27)]"
                    : "text-muted-foreground"
              }
            >
              {state}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function EnvList({
  required,
  optional,
  missing,
}: {
  required: string[];
  optional: string[];
  missing: string[];
}) {
  const missingSet = new Set(missing);
  return (
    <div className="space-y-2">
      {required.length > 0 && (
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
            Required
          </div>
          <ul className="mt-1 space-y-0.5">
            {required.map((v) => (
              <li
                key={v}
                className="flex items-center justify-between text-[12px]"
              >
                <span className="font-mono text-foreground/80">{v}</span>
                <span
                  className={
                    missingSet.has(v)
                      ? "text-[oklch(0.5_0.18_27)]"
                      : "text-[oklch(0.55_0.14_155)]"
                  }
                >
                  {missingSet.has(v) ? "missing" : "present"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {optional.length > 0 && (
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
            Optional
          </div>
          <ul className="mt-1 space-y-0.5">
            {optional.map((v) => (
              <li key={v} className="text-[12px] font-mono text-muted-foreground">
                {v}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Diagnostics({ d }: { d: IntegrationDiagnostics }) {
  switch (d.kind) {
    case "stripe":
      return (
        <div className="space-y-1.5 text-[12px]">
          <KV k="Mode" v={d.mode} />
          {d.account ? (
            <>
              <KV k="Account ID" v={d.account.id ?? "-"} mono />
              <KV k="Display name" v={d.account.displayName ?? "-"} />
              <KV k="Email" v={d.account.email ?? "-"} />
              <KV k="Country" v={d.account.country ?? "-"} />
              <KV k="Charges enabled" v={String(d.account.chargesEnabled ?? "-")} />
              <KV k="Payouts enabled" v={String(d.account.payoutsEnabled ?? "-")} />
            </>
          ) : (
            <div className="text-muted-foreground">Account not yet retrieved.</div>
          )}
          <KV k="Webhook secret" v={d.webhookSecretPresent ? "configured" : "not configured"} />
          <KV k="Publishable key" v={d.publishableKeyPresent ? "configured" : "not configured"} />
        </div>
      );
    case "mcp":
      return d.servers.length === 0 ? (
        <div className="text-[12px] text-muted-foreground">No MCP server configured yet.</div>
      ) : (
        <div className="space-y-3">
          {d.servers.map((s) => (
            <div key={s.serverUrl} className="rounded-md border border-border/60 p-3 text-[12px]">
              <div className="truncate font-mono text-foreground/80">{s.serverUrl}</div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 text-muted-foreground">
                <div>Status: <span className="text-foreground/80">{s.status}</span></div>
                <div>Protocol: <span className="text-foreground/80">{s.protocolVersion ?? "-"}</span></div>
                <div>Tools: <span className="text-foreground/80">{s.toolCount}</span></div>
                <div>Last success: <span className="text-foreground/80">{formatWhen(s.lastSuccessAt)}</span></div>
              </div>
              {s.tools.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.tools.map((t) => (
                    <span
                      key={t}
                      className="rounded border border-border/60 bg-secondary/40 px-1.5 py-0.5 font-mono text-[10.5px] text-foreground/80"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    case "website_sync":
      return (
        <div className="space-y-3 text-[12px]">
          {d.sources.length === 0 ? (
            <div className="text-muted-foreground">No sources configured. Add one from the Knowledge module.</div>
          ) : (
            <div>
              <div className="mb-1 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                Sources ({d.sources.length})
              </div>
              <ul className="space-y-1">
                {d.sources.slice(0, 15).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 border-b border-border/40 pb-1">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-foreground/80">{s.title}</div>
                      {s.url ? (
                        <div className="truncate font-mono text-[11px] text-muted-foreground">{s.url}</div>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-[11px] text-muted-foreground">
                      {s.enabled ? "enabled" : "disabled"} - {formatWhen(s.lastSyncedAt)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {d.recentRuns.length > 0 && (
            <div>
              <div className="mb-1 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                Recent sync runs
              </div>
              <ul className="space-y-1">
                {d.recentRuns.slice(0, 10).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 border-b border-border/40 pb-1">
                    <div
                      className={
                        r.status === "succeeded"
                          ? "text-[oklch(0.55_0.14_155)]"
                          : r.status === "failed"
                            ? "text-[oklch(0.5_0.18_27)]"
                            : "text-foreground/80"
                      }
                    >
                      {r.status}
                    </div>
                    <div className="shrink-0 text-[11px] text-muted-foreground">
                      {r.recordsCreated}/{r.recordsDiscovered} indexed - {formatWhen(r.completedAt ?? r.startedAt)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    case "beehiiv":
      return (
        <div className="space-y-1.5 text-[12px]">
          <KV k="Publication" v={d.publicationName ?? "-"} />
          <KV k="Publication ID" v={d.publicationId ?? "-"} mono />
          <KV k="Publish armed" v={d.publishArmed ? "yes" : "no (safe mode)"} />
        </div>
      );
    case "linkedin":
      return (
        <div className="space-y-1.5 text-[12px]">
          {d.identity ? (
            <>
              <KV k="Display name" v={d.identity.displayName ?? "-"} />
              <KV k="Email" v={d.identity.email ?? "-"} />
              <KV k="Profile URN" v={d.identity.profileUrn ?? "-"} mono />
            </>
          ) : (
            <div className="text-muted-foreground">Not connected.</div>
          )}
          <KV k="Publish armed" v={d.publishArmed ? "yes" : "no (safe mode)"} />
        </div>
      );
    case "meta":
      return d.destinations.length === 0 ? (
        <div className="text-[12px] text-muted-foreground">No destinations connected.</div>
      ) : (
        <ul className="space-y-1.5 text-[12px]">
          {d.destinations.map((x) => (
            <li key={x.id} className="border-b border-border/40 pb-1">
              <div className="flex items-center justify-between gap-3">
                <div className="truncate text-foreground/80">{x.displayName}</div>
                <div
                  className={
                    x.publishAvailable
                      ? "text-[oklch(0.55_0.14_155)]"
                      : "text-[oklch(0.75_0.15_75)]"
                  }
                >
                  {x.publishAvailable ? "publish ready" : "awaiting approval"}
                </div>
              </div>
              {x.lastCapabilityReason ? (
                <div className="mt-0.5 text-[11px] text-muted-foreground">{x.lastCapabilityReason}</div>
              ) : null}
            </li>
          ))}
        </ul>
      );
    case "supabase_self":
      return (
        <div className="space-y-1.5 text-[12px]">
          <KV k="Host" v={d.host} mono />
          <KV k="Service role available" v={d.hasServiceRole ? "yes" : "no"} />
        </div>
      );
    case "webhooks_summary":
    case "rest_summary":
      return (
        <div className="space-y-1.5 text-[12px]">
          <KV k="Total" v={String(d.total)} />
          <KV k="Enabled" v={String(d.enabled)} />
        </div>
      );
    case "env_shell":
      return (
        <div className="space-y-1.5 text-[12px]">
          <KV
            k="Required environment"
            v={d.requiredEnv.length === 0 ? "none" : d.requiredEnv.join(", ")}
            mono
          />
          <KV
            k="Missing"
            v={d.missingEnv.length === 0 ? "none" : d.missingEnv.join(", ")}
            mono
          />
          <KV k="Provider approval required" v={d.approvalRequired ? "yes" : "no"} />
        </div>
      );
  }
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className={mono ? "font-mono text-foreground/80" : "text-foreground/80"}>{v}</span>
    </div>
  );
}