import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, Section } from "@/components/page-header";

export const Route = createFileRoute("/integrations")({
  component: IntegrationsPage,
  head: () => ({
    meta: [
      { title: "Integrations — Northstar" },
      { name: "description", content: "Connect the systems Operator reads from." },
    ],
  }),
});

const integrations = [
  { name: "Gmail", cat: "Communication", status: "Connected" },
  { name: "Google Calendar", cat: "Communication", status: "Connected" },
  { name: "Slack", cat: "Communication", status: "Connected" },
  { name: "Zoom", cat: "Communication", status: "Connected" },
  { name: "Notion", cat: "Knowledge", status: "Connected" },
  { name: "Linear", cat: "Projects", status: "Connected" },
  { name: "GitHub", cat: "Projects", status: "Not connected" },
  { name: "Stripe", cat: "Finance", status: "Connected" },
  { name: "QuickBooks", cat: "Finance", status: "Not connected" },
  { name: "HubSpot", cat: "Sales", status: "Not connected" },
];

function IntegrationsPage() {
  const cats = Array.from(new Set(integrations.map((i) => i.cat)));
  return (
    <div>
      <PageHeader
        eyebrow="Integrations"
        title="What Operator can see."
        description="Northstar is only as sharp as its inputs. Connect the systems that hold the truth."
      />
      <PageBody>
        {cats.map((cat) => (
          <Section key={cat} title={cat}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {integrations
                .filter((i) => i.cat === cat)
                .map((i) => (
                  <div
                    key={i.name}
                    className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-5 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-[12px] font-semibold text-foreground">
                        {i.name.slice(0, 1)}
                      </div>
                      <div>
                        <div className="text-[13px] text-foreground">{i.name}</div>
                        <div className="text-[11px] text-muted-foreground">{i.status}</div>
                      </div>
                    </div>
                    <button
                      className={
                        i.status === "Connected"
                          ? "text-[12px] text-muted-foreground hover:text-foreground"
                          : "rounded-md bg-foreground px-3 py-1.5 text-[12px] text-background hover:opacity-90"
                      }
                    >
                      {i.status === "Connected" ? "Manage" : "Connect"}
                    </button>
                  </div>
                ))}
            </div>
          </Section>
        ))}
      </PageBody>
    </div>
  );
}