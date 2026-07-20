import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { useOrg } from "@/lib/org-context";
import { supabase } from "@/integrations/supabase/client";
import { getMetaConnectorHealth } from "@/lib/social/providers/meta/health.functions";
import { SamMcpConnectionPanel } from "@/components/sam-mcp-connection-panel";

export const Route = createFileRoute("/_authenticated/integrations")({
  component: IntegrationsPage,
  head: () => ({
    meta: [
      { title: "Integrations  -  NorthStar Labs" },
      { name: "description", content: "Connect the systems SAM reads from." },
    ],
  }),
});

type TileState = "connected" | "not_connected" | "not_configured" | "coming_soon";

type Tile = {
  name: string;
  cat: string;
  state: TileState;
  detail?: string;
  action?: { kind: "manage" | "connect_meta" | "link"; href?: string };
};

function IntegrationsPage() {
  const { activeOrgId } = useOrg();
  const health = useServerFn(getMetaConnectorHealth);
  const metaQ = useQuery({
    enabled: !!activeOrgId,
    queryKey: ["meta-connector-health", activeOrgId],
    queryFn: () => health({ data: { organizationId: activeOrgId! } }),
  });

  const [connecting, setConnecting] = useState<null | "facebook" | "instagram">(null);
  const [connectError, setConnectError] = useState<string | null>(null);

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

  const meta = metaQ.data;
  const metaConfigured = meta?.configured ?? false;
  const fbDests = (meta?.destinations ?? []).filter((d) => d.kind === "facebook_page");
  const igDests = (meta?.destinations ?? []).filter((d) => d.kind === "instagram_business");

  const facebookTile: Tile = {
    name: "Facebook Page",
    cat: "Social",
    state: !metaConfigured
      ? "not_configured"
      : fbDests.some((d) => d.publish_available)
        ? "connected"
        : "not_connected",
    detail: !metaConfigured
      ? `Missing: ${(meta?.missing ?? []).join(", ") || "credentials"}`
      : fbDests.length > 0
        ? fbDests.map((d) => d.display_name).join(", ")
        : "Connect a Facebook Page",
    action: { kind: "connect_meta" },
  };
  const instagramTile: Tile = {
    name: "Instagram Business",
    cat: "Social",
    state: !metaConfigured
      ? "not_configured"
      : igDests.some((d) => d.publish_available)
        ? "connected"
        : "not_connected",
    detail: !metaConfigured
      ? "Configured with Facebook credentials"
      : igDests.length > 0
        ? igDests.map((d) => d.display_name).join(", ")
        : "Requires a Facebook Page linked to an IG Business account",
    action: { kind: "connect_meta" },
  };

  const tiles: Tile[] = [
    facebookTile,
    instagramTile,
    { name: "LinkedIn", cat: "Social", state: "coming_soon" },
    { name: "X (Twitter)", cat: "Social", state: "coming_soon" },
    { name: "Reddit", cat: "Social", state: "coming_soon" },
    {
      name: "Website",
      cat: "Knowledge",
      state: "connected",
      detail: "Managed under Settings",
      action: { kind: "link", href: "/settings/integrations" },
    },
    { name: "Gmail", cat: "Communication", state: "coming_soon" },
    { name: "Google Calendar", cat: "Communication", state: "coming_soon" },
    { name: "Slack", cat: "Communication", state: "coming_soon" },
    { name: "Zoom", cat: "Communication", state: "coming_soon" },
    { name: "Notion", cat: "Knowledge", state: "coming_soon" },
    { name: "Linear", cat: "Projects", state: "coming_soon" },
    { name: "GitHub", cat: "Projects", state: "coming_soon" },
    { name: "Stripe", cat: "Finance", state: "coming_soon" },
    { name: "HubSpot", cat: "Sales", state: "coming_soon" },
  ];

  const cats = Array.from(new Set(tiles.map((i) => i.cat)));
  return (
    <div>
      <PageHeader
        eyebrow="Integrations"
        title="What SAM can see."
        description="NorthStar Labs is only as sharp as its inputs. Connect the systems that hold the truth."
      />
      <PageBody>
        {connectError ? (
          <div className="mb-6 rounded-md border border-[oklch(0.5_0.18_27)]/30 bg-[oklch(0.5_0.18_27)]/5 px-4 py-3 text-[12.5px] text-[oklch(0.5_0.18_27)]">
            {connectError}
          </div>
        ) : null}
        <Section title="SAM">
          <SamMcpConnectionPanel />
        </Section>
        {cats.map((cat) => (
          <Section key={cat} title={cat}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {tiles
                .filter((i) => i.cat === cat)
                .map((i) => (
                  <TileRow
                    key={i.name}
                    tile={i}
                    busy={
                      (i.name === "Facebook Page" && connecting === "facebook") ||
                      (i.name === "Instagram Business" && connecting === "instagram")
                    }
                    onConnectMeta={() =>
                      startMetaConnect(i.name === "Instagram Business" ? "instagram" : "facebook")
                    }
                  />
                ))}
            </div>
          </Section>
        ))}
      </PageBody>
    </div>
  );
}

function TileRow({
  tile,
  busy,
  onConnectMeta,
}: {
  tile: Tile;
  busy: boolean;
  onConnectMeta: () => void;
}) {
  const stateLabel: Record<TileState, string> = {
    connected: "Connected",
    not_connected: "Not connected",
    not_configured: "Credentials required",
    coming_soon: "Coming soon",
  };
  const dot =
    tile.state === "connected"
      ? "bg-[oklch(0.72_0.14_155)]"
      : tile.state === "not_connected"
        ? "bg-[oklch(0.55_0.14_65)]"
        : tile.state === "not_configured"
          ? "bg-[oklch(0.5_0.18_27)]"
          : "bg-muted-foreground/40";

  const button = () => {
    if (tile.state === "coming_soon") {
      return (
        <span className="rounded-md px-2.5 py-1.5 text-[12px] text-muted-foreground/70">
          Coming soon
        </span>
      );
    }
    if (tile.action?.kind === "link" && tile.action.href) {
      return (
        <Link
          to={tile.action.href}
          className="rounded-md px-2.5 py-1.5 text-[12px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        >
          Manage
        </Link>
      );
    }
    if (tile.action?.kind === "connect_meta") {
      const label =
        tile.state === "connected"
          ? "Manage"
          : tile.state === "not_configured"
            ? "Setup"
            : "Connect";
      return (
        <button
          disabled={busy || tile.state === "not_configured"}
          onClick={onConnectMeta}
          className={
            tile.state === "connected"
              ? "rounded-md px-2.5 py-1.5 text-[12px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground disabled:opacity-50"
              : "rounded-md bg-foreground px-3 py-1.5 text-[12px] text-background hover:opacity-90 disabled:opacity-50"
          }
          title={tile.state === "not_configured" ? "Meta app credentials must be added first" : undefined}
        >
          {busy ? "..." : label}
        </button>
      );
    }
    return null;
  };

  return (
    <div className="group flex items-center justify-between rounded-xl bg-card/40 px-5 py-4 hover:bg-card/70">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/70 text-[13px] font-semibold text-foreground">
          {tile.name.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <div className="text-[13.5px] text-foreground">{tile.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
            <span className="truncate">{tile.detail ?? stateLabel[tile.state]}</span>
          </div>
        </div>
      </div>
      {button()}
    </div>
  );
}