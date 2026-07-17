import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, Section } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/accountability")({
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
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                <tr className="border-b border-border">
                  <th className="px-2 py-3 font-medium">Owner</th>
                  <th className="px-2 py-3 font-medium">Commitment</th>
                  <th className="hidden px-2 py-3 font-medium md:table-cell">Venture</th>
                  <th className="px-2 py-3 font-medium">Due</th>
                  <th className="px-2 py-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {commitments.map((c, i) => (
                  <tr
                    key={i}
                    className="text-[13.5px] hover:bg-secondary/30 border-b border-border/60 last:border-0"
                  >
                    <td className="px-2 py-5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary/70 text-[10px] font-medium text-foreground">
                          {c.who.slice(0, 2)}
                        </div>
                        <span className="text-foreground">{c.who}</span>
                      </div>
                    </td>
                    <td className="px-2 py-5 text-foreground">{c.what}</td>
                    <td className="hidden px-2 py-5 text-muted-foreground md:table-cell">{c.venture}</td>
                    <td className="px-2 py-5 tabular-nums text-muted-foreground">{c.by}</td>
                    <td className="px-2 py-5 text-right text-[12.5px]">
                      <span
                        className={
                          c.status === "Overdue"
                            ? "text-[oklch(0.72_0.14_25)]"
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
          <ul>
            {commitments
              .filter((c) => c.who === "Jeff")
              .map((c, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between border-b border-border/60 py-5 text-[14px] last:border-0"
                >
                  <span className="text-foreground">{c.what}</span>
                  <span className="text-[12.5px] text-muted-foreground">
                    {c.venture} · {c.by}
                  </span>
                </li>
              ))}
          </ul>
        </Section>
      </PageBody>
    </div>
  );
}