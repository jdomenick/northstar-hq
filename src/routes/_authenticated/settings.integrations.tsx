import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page-header";
import {
  EditorialSkeleton,
  EmptyEditorialState,
  ErrorLine,
  Ledger,
  SectionLabel,
  StatusLine,
  type StatusTone,
} from "@/components/editorial";
import { useOrg } from "@/lib/org-context";
import { listWebsiteConnections } from "@/lib/integrations/website.functions";

export const Route = createFileRoute("/_authenticated/settings/integrations")({
  component: IntegrationsIndex,
  head: () => ({
    meta: [
      { title: "Automation - NorthStar Labs" },
      {
        name: "description",
        content: "Registered connections, their standing, and when they last ran.",
      },
    ],
  }),
});

const DISCOVERY_TONE: Record<string, StatusTone> = {
  pending: "muted",
  running: "attention",
  completed: "positive",
  failed: "critical",
};

const AUTOMATION_TONE: Record<string, StatusTone> = {
  manual: "muted",
  scheduled: "positive",
  paused: "attention",
};

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

function IntegrationsIndex() {
  const { activeOrgId } = useOrg();
  const list = useServerFn(listWebsiteConnections);
  const q = useQuery({
    enabled: !!activeOrgId,
    queryKey: ["website-connections", activeOrgId],
    queryFn: () => list({ data: { organizationId: activeOrgId! } }),
  });

  const rows = q.data ?? [];
  const active = rows.filter((c) => c.status !== "archived");
  const failing = active.filter((c) => c.discovery_status === "failed");
  const running = active.filter((c) => c.discovery_status === "running");

  return (
    <div>
      <PageHeader
        eyebrow="Automation"
        title="Connections and their standing."
        description="What NorthStar Labs is authorized to read from, when each connection last ran, and whether it is healthy. Nothing runs unattended without your consent."
        actions={
          <Link
            to="/settings/integrations/new"
            className="inline-flex items-center gap-2 border border-foreground bg-foreground px-4 py-2 text-[11.5px] uppercase tracking-[0.2em] text-background hover:bg-foreground/90"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> New connection
          </Link>
        }
      />
      <PageBody>
        <div className="mb-12 grid grid-cols-3 gap-8 border-b border-foreground/15 pb-8">
          <StatBlock label="Registered" value={active.length} />
          <StatBlock
            label="Running now"
            value={running.length}
            tone={running.length > 0 ? "attention" : "muted"}
          />
          <StatBlock
            label="Needs attention"
            value={failing.length}
            tone={failing.length > 0 ? "critical" : "muted"}
          />
        </div>

        {!activeOrgId || q.isLoading ? (
          <EditorialSkeleton rows={5} />
        ) : q.error ? (
          <ErrorLine message={(q.error as Error).message} />
        ) : rows.length === 0 ? (
          <EmptyEditorialState
            eyebrow="No connections"
            title="Nothing has been registered."
            description="Add a website to begin discovering knowledge sources. Discovery is manual until you enable a schedule."
            action={
              <Link
                to="/settings/integrations/new"
                className="inline-flex items-center gap-2 border border-foreground bg-foreground px-4 py-2 text-[11.5px] uppercase tracking-[0.2em] text-background hover:bg-foreground/90"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> New connection
              </Link>
            }
          />
        ) : (
          <section className="mb-14">
            <div className="flex items-baseline justify-between gap-4 border-b border-foreground/80 pb-2">
              <SectionLabel>Website connections</SectionLabel>
              <span className="text-[11px] tabular-nums uppercase tracking-[0.22em] text-foreground/55">
                {rows.length}
              </span>
            </div>
            <Ledger className="mt-4 border-t border-foreground/15">
              {rows.map((c, i) => (
                <li key={c.id} className="group hover:bg-foreground/[0.02]">
                  <Link
                    to="/settings/integrations/$connectionId"
                    params={{ connectionId: c.id }}
                    className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-4 py-4 focus:outline-none focus-visible:bg-foreground/[0.04] md:grid-cols-[2.25rem_minmax(0,1fr)_11rem_auto] md:gap-6"
                  >
                    <span className="pt-1 font-display text-[14px] leading-none text-foreground/40 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
                        Website
                      </div>
                      <div className="mt-1.5 truncate font-display text-[19px] leading-[1.2] text-foreground group-hover:underline underline-offset-4 md:text-[22px]">
                        {c.display_name}
                      </div>
                      <div className="mt-1.5 truncate text-[12.5px] italic text-foreground/70">
                        {c.homepage_url ?? "No homepage recorded"}
                      </div>
                    </div>
                    <div className="hidden text-[11px] uppercase tracking-[0.18em] text-foreground/70 md:block">
                      <div className="tabular-nums">
                        Last sync {formatRelative(c.last_successful_sync_at)}
                      </div>
                      <div className="mt-1 text-foreground/50">
                        Registered {new Date(c.created_at).toISOString().slice(0, 10)}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 pt-1">
                      <StatusLine tone={DISCOVERY_TONE[c.discovery_status] ?? "neutral"}>
                        {c.discovery_status}
                      </StatusLine>
                      <StatusLine tone={AUTOMATION_TONE[c.automation_mode] ?? "muted"}>
                        {c.automation_mode}
                      </StatusLine>
                    </div>
                  </Link>
                </li>
              ))}
            </Ledger>
          </section>
        )}
      </PageBody>
    </div>
  );
}

function StatBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: StatusTone;
}) {
  const toneClass =
    tone === "critical"
      ? "text-[oklch(0.5_0.18_27)]"
      : tone === "attention"
        ? "text-[oklch(0.55_0.14_65)]"
        : tone === "muted"
          ? "text-foreground/40"
          : "text-foreground";
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.24em] text-foreground/55">
        {label}
      </div>
      <div className={`mt-3 font-display text-[44px] leading-none tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}