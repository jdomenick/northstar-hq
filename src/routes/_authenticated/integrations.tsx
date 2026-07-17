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
                    className="group flex items-center justify-between rounded-xl bg-card/40 px-5 py-4 hover:bg-card/70"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/70 text-[13px] font-semibold text-foreground">
                        {i.name.slice(0, 1)}
                      </div>
                      <div>
                        <div className="text-[13.5px] text-foreground">{i.name}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                          <span
                            className={
                              i.status === "Connected"
                                ? "h-1.5 w-1.5 rounded-full bg-[oklch(0.72_0.14_155)]"
                                : "h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
                            }
                          />
                          {i.status}
                        </div>
                      </div>
                    </div>
                    <button
                      className={
                        i.status === "Connected"
                          ? "rounded-md px-2.5 py-1.5 text-[12px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
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