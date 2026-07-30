import { createFileRoute } from "@tanstack/react-router";
import { Band, BandHeading, FinalCta, PageIntro, SiteLayout, pageMeta } from "@/components/marketing/site-shell";
import { INDUSTRIES } from "@/lib/marketing/content";

export const Route = createFileRoute("/industries")({
  component: IndustriesPage,
  head: () =>
    pageMeta({
      title: "Industries We Help | NorthStar Labs",
      description:
        "NorthStar Labs works with healthcare, home services, professional services, automotive, construction, legal, financial, manufacturing, and other local service businesses.",
      path: "/industries",
    }),
});

function IndustriesPage() {
  return (
    <SiteLayout>
      <PageIntro
        eyebrow="Industries"
        title="We work with businesses across many industries."
        lede="We are not an industry-exclusive firm. What matters is whether the business depends on generating demand, responding quickly, converting it, and delivering consistently. The examples below are where we spend the most time."
      />

      <Band>
        <div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((i) => (
            <article key={i.name} className="bg-background p-6">
              <h2 className="font-display text-[16px] font-semibold text-foreground">{i.name}</h2>
              <p className="mt-2 text-[13.5px] leading-[1.7] text-muted-foreground">{i.note}</p>
            </article>
          ))}
        </div>
      </Band>

      <Band muted>
        <BandHeading
          eyebrow="If your industry is not listed"
          title="The operating problems travel."
          lede="Slow response to inbound demand, follow-up that depends on memory, manual re-entry between systems, and reporting nobody trusts. If those sound familiar, the industry label matters less than the constraint."
        />
      </Band>

      <FinalCta />
    </SiteLayout>
  );
}