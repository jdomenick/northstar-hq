import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { CtaLink, FinalCta, PageIntro, SiteLayout, pageMeta } from "@/components/marketing/site-shell";
import { SERVICES } from "@/lib/marketing/content";

export const Route = createFileRoute("/services")({
  component: ServicesPage,
  head: () =>
    pageMeta({
      title: "Services | NorthStar Labs",
      description:
        "Lead generation, AI receptionist, marketing and sales automation, workflow automation, AI integration, reporting, and custom business systems.",
      path: "/services",
    }),
});

function ServicesPage() {
  return (
    <SiteLayout>
      <PageIntro
        eyebrow="Services"
        title="Managed services built around a business result."
        lede="Each service below closes a specific place where revenue leaks. We integrate with the CRM and systems you already run, and scope only what the Assessment shows the business needs, in the order it needs it."
      />

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-16">
          <div className="grid gap-px overflow-hidden border border-border bg-border md:grid-cols-2">
            {SERVICES.map((s) => (
              <article key={s.slug} id={s.slug} className="bg-background p-7 md:p-8">
                <h2 className="font-display text-[19px] font-semibold text-foreground">{s.name}</h2>
                <dl className="mt-5 space-y-4">
                  <div>
                    <dt className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Problem
                    </dt>
                    <dd className="mt-1.5 text-[14px] leading-[1.75] text-foreground/85">{s.problem}</dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      What we do
                    </dt>
                    <dd className="mt-1.5 text-[14px] leading-[1.75] text-foreground/85">{s.solution}</dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-primary">
                      Business outcome
                    </dt>
                    <dd className="mt-1.5 text-[14px] leading-[1.75] text-foreground/85">{s.outcome}</dd>
                  </div>
                </dl>
                <div className="mt-6">
                  <CtaLink to="/request-assessment" variant="secondary" className="px-4 py-2.5">
                    Request an Assessment <ArrowRight className="h-4 w-4" />
                  </CtaLink>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <FinalCta
        title="Not sure which of these you need?"
        body="That is what the Assessment is for. We look at the business first and recommend only the work that changes a number."
      />
    </SiteLayout>
  );
}