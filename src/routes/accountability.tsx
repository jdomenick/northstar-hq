import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, Section } from "@/components/page-header";

export const Route = createFileRoute("/accountability")({
  component: AccountabilityPage,
  head: () => ({
    meta: [
      { title: "Accountability — Northstar" },
      { name: "description", content: "Commitments, owners, and follow-through across every venture." },
    ],
  }),
});

const commitments = [
  { who: "Jeff", what: "Decide Mercy Health MSA terms", by: "Fri", venture: "Healing Path", status: "Due" },
  { who: "Andre", what: "Send dispatch vendor comparison", by: "Wed", venture: "Elite Fleet Rides", status: "In progress" },
  { who: "Rae", what: "File 501(c)(3) response", by: "Overdue 4d", venture: "Light In The Tunnel", status: "Overdue" },
  { who: "Maya", what: "Hand off intake redesign", by: "Feb 28", venture: "Healing Path", status: "On track" },
  { who: "Jeff", what: "Final read essay draft", by: "Thu", venture: "Personal Brand", status: "On track" },
];

function AccountabilityPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Accountability"
        title="Who owes what, by when."
        description="Every commitment made across ventures, tracked without nagging. Operator surfaces the ones drifting."
      />
      <PageBody>
        <Section title="Open commitments">
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left">
              <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Owner</th>
                  <th className="px-5 py-3 font-medium">Commitment</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Venture</th>
                  <th className="px-5 py-3 font-medium">Due</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {commitments.map((c, i) => (
                  <tr key={i} className="text-[13px] hover:bg-secondary/30">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px]">
                          {c.who.slice(0, 2)}
                        </div>
                        <span className="text-foreground">{c.who}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-foreground">{c.what}</td>
                    <td className="hidden px-5 py-4 text-muted-foreground md:table-cell">{c.venture}</td>
                    <td className="px-5 py-4 text-muted-foreground">{c.by}</td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          c.status === "Overdue"
                            ? "text-[oklch(0.62_0.19_25)]"
                            : c.status === "Due"
                              ? "text-[oklch(0.78_0.14_75)]"
                              : "text-muted-foreground"
                        }
                      >
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Where you are the bottleneck">
          <ul className="space-y-2">
            {commitments
              .filter((c) => c.who === "Jeff")
              .map((c, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-5 py-4 text-[13px]"
                >
                  <span className="text-foreground">{c.what}</span>
                  <span className="text-[12px] text-muted-foreground">{c.venture} · {c.by}</span>
                </li>
              ))}
          </ul>
        </Section>
      </PageBody>
    </div>
  );
}