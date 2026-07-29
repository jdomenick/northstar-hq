import { createFileRoute } from "@tanstack/react-router";
import { ClientWorkspace } from "@/components/client-shell";
import { roleLabel } from "@/lib/client-identity/types";

export const Route = createFileRoute("/client/")({
  ssr: false,
  component: ClientHome,
  head: () => ({
    meta: [
      { title: "Your workspace  -  NorthStar Labs" },
      { name: "description", content: "Your NorthStar Labs engagement status and next step." },
      { property: "og:title", content: "Your workspace  -  NorthStar Labs" },
      { property: "og:description", content: "Your NorthStar Labs engagement status and next step." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ClientHome() {
  return (
    <ClientWorkspace>
      {(ctx) => (
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.26em] text-foreground/55">
            Engagement status
          </div>
          <h1 className="mt-3 font-display text-[38px] leading-[1.05] text-foreground">
            {ctx.status}
          </h1>
          <p className="mt-4 text-[15px] leading-[1.75] text-foreground/75">{ctx.next_step}</p>

          <dl className="mt-10 grid gap-px border border-foreground/12 bg-foreground/12 sm:grid-cols-3">
            <Cell label="Company" value={ctx.company.name} />
            <Cell label="Your access" value={roleLabel(ctx.account.role)} />
            <Cell label="Signed in as" value={ctx.account.email} />
          </dl>

          <p className="mt-8 text-[12.5px] leading-[1.7] text-foreground/60">
            Only your own company information is visible here. If something looks wrong, contact
            your NorthStar Labs representative.
          </p>
        </div>
      )}
    </ClientWorkspace>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-5">
      <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
        {label}
      </dt>
      <dd className="mt-2 break-words text-[14px] text-foreground">{value}</dd>
    </div>
  );
}