import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  Band,
  BandHeading,
  CtaLink,
  FinalCta,
  SiteLayout,
  pageMeta,
} from "@/components/marketing/site-shell";
import { BRAND, INDUSTRIES, OUTCOMES, PROCESS_STEPS, SERVICES, WHY_US } from "@/lib/marketing/content";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    ...pageMeta({
      title: "NorthStar Labs | Find What's Limiting Growth, and Fix It",
      description:
        "NorthStar Labs implements business systems for lead generation, sales, operations, automation, and reporting. Request an Assessment.",
      path: "/",
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "NorthStar Labs",
          url: BRAND.siteUrl,
          email: BRAND.email,
          description: BRAND.positioning,
        }),
      },
    ],
  }),
});

function HomePage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
          <div className="flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            <span className="h-1 w-1 rounded-full bg-primary" />
            Business systems implementation
          </div>
          <h1 className="mt-5 max-w-4xl font-display text-[36px] font-semibold leading-[1.06] text-foreground md:text-[58px]">
            Most businesses do not have a growth problem. They have a constraint nobody has named.
          </h1>
          <p className="mt-6 max-w-2xl text-[16px] leading-[1.8] text-muted-foreground">
            {BRAND.tagline} We find the one thing holding revenue back, then implement the systems that
            remove it. Marketing, lead generation, sales, operations, automation, reporting, and AI.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <CtaLink to="/request-assessment">
              Request an Assessment <ArrowRight className="h-4 w-4" />
            </CtaLink>
            <CtaLink to="/services" variant="secondary">
              View Services
            </CtaLink>
          </div>
        </div>
      </section>

      {/* What We Do */}
      <Band muted>
        <BandHeading
          eyebrow="What we do"
          title="We implement business systems, not software."
          lede={BRAND.positioning}
        />
        <div className="mt-10 grid gap-px overflow-hidden border border-border bg-border md:grid-cols-3">
          {[
            {
              t: "Demand",
              b: "Generate qualified conversations and answer them fast enough to win them.",
            },
            {
              t: "Conversion",
              b: "Move deals through a pipeline that is structured, instrumented, and followed up on.",
            },
            {
              t: "Operations",
              b: "Remove manual work, and report on what actually happened without assembling it by hand.",
            },
          ].map((c) => (
            <div key={c.t} className="bg-background p-7">
              <h3 className="font-display text-[17px] font-semibold text-foreground">{c.t}</h3>
              <p className="mt-3 text-[14px] leading-[1.75] text-muted-foreground">{c.b}</p>
            </div>
          ))}
        </div>
      </Band>

      {/* Why NorthStar Labs */}
      <Band>
        <BandHeading
          eyebrow="Why NorthStar Labs"
          title="Accountable for the outcome, not the deliverable."
        />
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {WHY_US.map((w) => (
            <div key={w.title} className="border-l border-primary/40 pl-5">
              <h3 className="font-display text-[16px] font-semibold text-foreground">{w.title}</h3>
              <p className="mt-2 text-[14px] leading-[1.75] text-muted-foreground">{w.body}</p>
            </div>
          ))}
        </div>
      </Band>

      {/* Our Process */}
      <Band muted>
        <BandHeading
          eyebrow="Our process"
          title="Seven steps, in order, with nothing skipped."
          lede="Every engagement follows the same sequence so you always know where you are and what comes next."
        />
        <ol className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PROCESS_STEPS.slice(0, 4).map((s) => (
            <li key={s.step} className="border-t border-border pt-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
                Step {s.step}
              </div>
              <h3 className="mt-2 font-display text-[15px] font-semibold text-foreground">{s.name}</h3>
              <p className="mt-2 text-[13.5px] leading-[1.7] text-muted-foreground">{s.detail}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8">
          <Link
            to="/how-it-works"
            className="inline-flex items-center gap-2 text-[13px] text-foreground underline underline-offset-4"
          >
            See all seven steps <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Band>

      {/* Services overview */}
      <Band>
        <BandHeading
          eyebrow="Services"
          title="Managed services, selected by what the business needs first."
        />
        <div className="mt-10 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <div key={s.slug} className="bg-background p-6">
              <h3 className="font-display text-[15px] font-semibold text-foreground">{s.name}</h3>
              <p className="mt-2 text-[13.5px] leading-[1.7] text-muted-foreground">{s.outcome}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Link
            to="/services"
            className="inline-flex items-center gap-2 text-[13px] text-foreground underline underline-offset-4"
          >
            Read the full service detail <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Band>

      {/* Industries */}
      <Band muted>
        <BandHeading
          eyebrow="Industries we help"
          title="Different industries. The same constraints."
          lede="Response time, follow-up, manual work, and unclear reporting show up almost everywhere. The context changes; the operating problems rarely do."
        />
        <ul className="mt-10 flex flex-wrap gap-2">
          {INDUSTRIES.map((i) => (
            <li
              key={i.name}
              className="border border-border px-3.5 py-2 text-[13px] text-muted-foreground"
            >
              {i.name}
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <Link
            to="/industries"
            className="inline-flex items-center gap-2 text-[13px] text-foreground underline underline-offset-4"
          >
            See industry detail <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Band>

      {/* Business outcomes */}
      <Band>
        <BandHeading
          eyebrow="Business outcomes"
          title="We measure the work the way an owner does."
          lede="Every engagement is tied to outcomes you can see in the business, not activity reports."
        />
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {OUTCOMES.map((o) => (
            <div key={o.label} className="border-t border-border pt-4">
              <h3 className="font-display text-[15px] font-semibold text-foreground">{o.label}</h3>
              <p className="mt-2 text-[13.5px] leading-[1.7] text-muted-foreground">{o.detail}</p>
            </div>
          ))}
        </div>
      </Band>

      {/* Why businesses choose us */}
      <Band muted>
        <BandHeading
          eyebrow="Why businesses choose us"
          title="Because the plan is written down, and so is the result."
        />
        <div className="mt-8 max-w-3xl space-y-4 text-[15px] leading-[1.85] text-muted-foreground">
          <p>
            Owners come to us after buying tools that did not change anything. The tools were rarely the
            problem. The problem was that nobody connected them to how the business actually runs.
          </p>
          <p>
            We start with an Assessment, name the constraint, and put the sequence in writing. You see the
            plan before you commit, you see the milestones during implementation, and you see the outcome
            afterward in a report built from real data.
          </p>
        </div>
      </Band>

      <FinalCta />
    </SiteLayout>
  );
}