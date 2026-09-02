import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  Band,
  BandHeading,
  CtaLink,
  SiteLayout,
  pageMeta,
} from "@/components/marketing/site-shell";
import { GrowthPipelineVisual } from "@/components/marketing/pipeline-visual";
import { Reveal } from "@/components/marketing/motion";
import {
  AssessmentCta,
  DiagnosticStory,
  EcosystemStrip,
  OutcomeBoard,
  ProcessFlow,
  WhatWeFix,
} from "@/components/marketing/sections";
import { BRAND, INDUSTRIES, SERVICES } from "@/lib/marketing/content";
import { SOCIAL_IMAGE_URL, siteUrl } from "@/lib/marketing/site-url";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    ...pageMeta({
      title: "NorthStar Labs | Find the Revenue Leak, Then Fix It",
      description:
        "We find where your business is leaking revenue, then build, automate, and measure the systems that close the gap. Request an Assessment.",
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
          logo: SOCIAL_IMAGE_URL,
          image: SOCIAL_IMAGE_URL,
          slogan: BRAND.tagline,
          contactPoint: [
            {
              "@type": "ContactPoint",
              contactType: "sales",
              email: BRAND.email,
              url: siteUrl("/request-assessment"),
              availableLanguage: ["en"],
            },
          ],
        }),
      },
    ],
  }),
});

function HomePage() {
  return (
    <SiteLayout>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 nsl-wash" aria-hidden />
        <div className="pointer-events-none absolute inset-0 nsl-grid-field" aria-hidden />

        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-20 md:px-8 md:pb-24 md:pt-28">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-14">
            <div>
              <div className="flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-primary" />
                Business growth consulting and implementation
              </div>

              <h1 className="mt-6 max-w-2xl font-display text-[42px] font-semibold leading-[1.02] tracking-tight text-foreground md:text-[68px]">
                We find where your business is leaking revenue.
              </h1>

              <p className="mt-7 max-w-xl text-[17px] leading-[1.75] text-muted-foreground">
                Then we fix it. We identify what is preventing growth, determine what needs to change,
                implement the right systems, and measure whether it worked.
              </p>

              <div className="mt-10 flex flex-wrap gap-3">
                <CtaLink to="/request-assessment" className="nsl-elev-1 px-7 py-4 text-[12.5px]">
                  Request an Assessment <ArrowRight className="h-4 w-4" />
                </CtaLink>
                <CtaLink to="/how-it-works" variant="secondary" className="px-7 py-4 text-[12.5px]">
                  How it works
                </CtaLink>
              </div>

              <dl className="mt-12 grid max-w-lg grid-cols-3 gap-px border border-border bg-border">
                {[
                  { k: "Starts with", v: "An Assessment" },
                  { k: "Delivered as", v: "Implementation" },
                  { k: "Judged on", v: "Measured change" },
                ].map((item) => (
                  <div key={item.k} className="bg-background px-4 py-4">
                    <dt className="text-[9.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {item.k}
                    </dt>
                    <dd className="mt-1.5 font-display text-[13.5px] font-semibold text-foreground">
                      {item.v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <Reveal delay={120}>
              <GrowthPipelineVisual />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* What we actually fix                                              */}
      {/* ---------------------------------------------------------------- */}
      <Band muted>
        <BandHeading
          eyebrow="What we actually fix"
          title="Revenue is rarely lost in one place. It leaks between the steps."
          lede="These are the failures we find in almost every business we assess. None of them are a tooling problem on their own."
        />
        <WhatWeFix />
      </Band>

      {/* ---------------------------------------------------------------- */}
      {/* How NorthStar works                                               */}
      {/* ---------------------------------------------------------------- */}
      <Band textured>
        <BandHeading
          eyebrow="How NorthStar works"
          title="Assess. Diagnose. Implement. Measure. Optimize."
          lede="The same sequence on every engagement. Diagnosis is where we start, not where we stop."
        />
        <ProcessFlow />
        <div className="mt-10">
          <Link
            to="/how-it-works"
            className="inline-flex items-center gap-2 text-[13px] text-foreground underline underline-offset-4"
          >
            See all seven steps of the engagement <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Band>

      {/* ---------------------------------------------------------------- */}
      {/* Diagnostic story                                                  */}
      {/* ---------------------------------------------------------------- */}
      <Band deep>
        <BandHeading
          eyebrow="How the leak forms"
          title="It almost never starts with a bad product or a bad team."
          lede="It starts with a handoff nobody owns, and it compounds quietly until the month closes short."
        />
        <DiagnosticStory />
      </Band>

      {/* ---------------------------------------------------------------- */}
      {/* Outcomes                                                          */}
      {/* ---------------------------------------------------------------- */}
      <Band>
        <BandHeading
          eyebrow="Business outcomes"
          title="We measure the work the way an owner does."
          lede="Every engagement is tied to numbers you can see in the business, not activity reports."
        />
        <OutcomeBoard />
      </Band>

      {/* ---------------------------------------------------------------- */}
      {/* Assessment CTA                                                    */}
      {/* ---------------------------------------------------------------- */}
      <AssessmentCta />

      {/* ---------------------------------------------------------------- */}
      {/* Services                                                          */}
      {/* ---------------------------------------------------------------- */}
      <Band muted>
        <BandHeading
          eyebrow="Managed services"
          title="What an engagement turns into once the constraint is named."
          lede="Scope follows the Assessment. We recommend only the work that changes a number, in the order it should happen."
        />
        <div className="mt-12 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <Reveal key={s.slug} delay={i * 50} className="bg-background">
              <div className="h-full p-6 transition-colors duration-300 hover:bg-accent/40">
                <h3 className="font-display text-[15.5px] font-semibold text-foreground">{s.name}</h3>
                <p className="mt-2 text-[13.5px] leading-[1.7] text-muted-foreground">{s.outcome}</p>
              </div>
            </Reveal>
          ))}
          {/* Fillers keep the hairline grid from ending on an empty cell. */}
          <div aria-hidden className="hidden bg-background sm:block" />
          <div aria-hidden className="hidden bg-background lg:block" />
        </div>
        <div className="mt-9">
          <Link
            to="/services"
            className="inline-flex items-center gap-2 text-[13px] text-foreground underline underline-offset-4"
          >
            Read the full service detail <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Band>

      {/* ---------------------------------------------------------------- */}
      {/* Supporting infrastructure                                         */}
      {/* ---------------------------------------------------------------- */}
      <Band textured>
        <BandHeading
          eyebrow="The infrastructure underneath"
          title="You buy an outcome. This is part of how we deliver it."
          lede="NorthStar runs its own operating modules so acquisition, conversations, pipeline, and reporting stay connected. They are the plumbing, not the product."
        />
        <EcosystemStrip />
      </Band>

      {/* ---------------------------------------------------------------- */}
      {/* Industries                                                        */}
      {/* ---------------------------------------------------------------- */}
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
              className="border border-border bg-background px-3.5 py-2 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {i.name}
            </li>
          ))}
        </ul>
        <div className="mt-9">
          <Link
            to="/industries"
            className="inline-flex items-center gap-2 text-[13px] text-foreground underline underline-offset-4"
          >
            See industry detail <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Band>
    </SiteLayout>
  );
}
