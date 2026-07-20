import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { useOrg } from "@/lib/org-context";
import { createWebsiteConnection } from "@/lib/integrations/website.functions";

export const Route = createFileRoute("/_authenticated/settings/integrations/new")({
  component: NewWebsiteConnection,
  head: () => ({
    meta: [
      { title: "New website connection  -  NorthStar Labs" },
      { name: "description", content: "Register a website so NorthStar Labs can discover its knowledge sources." },
    ],
  }),
});

function NewWebsiteConnection() {
  const { activeOrgId } = useOrg();
  const navigate = useNavigate();
  const create = useServerFn(createWebsiteConnection);
  const [displayName, setDisplayName] = useState("");
  const [homepageUrl, setHomepageUrl] = useState("https://");
  const [automationMode, setAutomationMode] = useState<"suggest" | "auto_accept" | "off">("suggest");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!activeOrgId) throw new Error("No active organization");
      return create({
        data: {
          organizationId: activeOrgId,
          displayName,
          homepageUrl,
          automationMode,
          ventureId: null,
        },
      });
    },
    onSuccess: (res) => {
      toast.success("Connection created");
      navigate({ to: "/settings/integrations/$connectionId", params: { connectionId: res.connectionId } });
    },
    onError: (err: unknown) => {
      const code = (err as { code?: string; message?: string })?.code ?? (err as { message?: string })?.message ?? "Something went wrong";
      toast.error(String(code));
    },
  });

  return (
    <div>
      <PageHeader eyebrow="Settings / Integrations" title="Add a website." description="NorthStar Labs will validate the URL, read robots.txt, and discover candidate pages. Nothing is published or promoted without your approval." />
      <PageBody>
        <Section title="Details">
          <form
            className="grid max-w-xl gap-4 rounded-xl bg-card/40 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <label className="grid gap-1.5">
              <span className="text-[11.5px] uppercase tracking-wider text-muted-foreground">Display name</span>
              <input
                required
                minLength={1}
                maxLength={200}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded-md bg-background/60 px-3 py-2 text-[13.5px] outline-none ring-1 ring-border/40 focus:ring-foreground/40"
                placeholder="Acme marketing site"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11.5px] uppercase tracking-wider text-muted-foreground">Homepage URL</span>
              <input
                required
                type="url"
                maxLength={2048}
                value={homepageUrl}
                onChange={(e) => setHomepageUrl(e.target.value)}
                className="rounded-md bg-background/60 px-3 py-2 text-[13.5px] outline-none ring-1 ring-border/40 focus:ring-foreground/40"
                placeholder="https://example.com"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11.5px] uppercase tracking-wider text-muted-foreground">Automation mode</span>
              <select
                value={automationMode}
                onChange={(e) => setAutomationMode(e.target.value as "suggest" | "auto_accept" | "off")}
                className="rounded-md bg-background/60 px-3 py-2 text-[13.5px] outline-none ring-1 ring-border/40 focus:ring-foreground/40"
              >
                <option value="suggest">Suggest (default): discoveries require review</option>
                <option value="auto_accept">Auto-accept (reserved; not used until later phase)</option>
                <option value="off">Off: discovery only, no future automation</option>
              </select>
            </label>
            <div className="flex items-center justify-end gap-2">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="rounded-md bg-foreground px-3 py-1.5 text-[12px] text-background hover:opacity-90 disabled:opacity-50"
              >
                {mutation.isPending ? "Creating..." : "Create connection"}
              </button>
            </div>
          </form>
        </Section>
      </PageBody>
    </div>
  );
}