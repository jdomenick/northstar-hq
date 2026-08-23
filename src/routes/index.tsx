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
import {
  BRAND,
  CAPABILITIES,
  DELIVERY_MODEL,
  INDUSTRIES,
  OUTCOMES,
  PROCESS_STEPS,
  REVENUE_PATH,
  SERVICES,
  WHY_US,
} from "@/lib/marketing/content";
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
      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
          <div className="flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            <span className="h-1 w-1 rounded-full bg-primary" />
            Business systems implementation
          </div>
          <h1 className="mt-5 max-w-4xl font-display text-[36px] font-semibold leading-[1.06] text-foreground md:text-[58px]">
            We find where your business is leaking revenue. Then we fix it.
          </h1>
          <p className="mt-6 max-w-2xl text-[16px] leading-[1.8] text-muted-foreground">
            {BRAND.positioning} We do not stop at the diagnosis. We build the fix, automate the workflow
            where that is the right answer, integrate it with the systems you already run, and measure what
            changed.
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

      {/* Where revenue leaks */}
      <Band muted>
        <BandHeading
          eyebrow="Where revenue leaks"
          title="Revenue is rarely lost in one place. It leaks between the steps."
          lede="Marketing, leads, calls, follow-up, appointments, sales, and revenue are one connected path. Most businesses lose money in the handoffs, not in the tools."
        />
        <ul className="mt-10 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {REVENUE_PATH.map((r) => (
            <li key={r.stage} className="bg-background p-6">
              <h3 className="font-display text-[15px] font-semibold text-foreground">{r.stage}</h3>
              <p className="mt-2 text-[13.5px] leading-[1.7] text-muted-foreground">{r.leak}</p>
            </li>
          ))}
        </ul>
      </Band>

      {/* Delivery model */}
      <Band>
        <BandHeading
          eyebrow="How we deliver"
          title="Assess. Identify. Build. Automate. Measure."
          lede="The same sequence on every engagement. Diagnosis is where we start, not where we stop."
        />
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {DELIVERY_MODEL.map((d, i) => (
            <li key={d.key} className="border-t border-border pt-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
                0{i + 1} / {d.label}
              </div>
              <p className="mt-2 text-[13.5px] leading-[1.7] text-muted-foreground">{d.detail}</p>
            </li>
          ))}
        </ol>
      </Band>

      {/* Why NorthStar Labs */}
      <Band muted>
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

      {/* What we implement */}
      <Band>
        <BandHeading
          eyebrow="What we implement"
          title="Built around the gap, not around a product."
          lede="We integrate with the CRM and business systems you already use. AI and automation are used where they are the right solution, not because they are the headline."
        />
        <div className="mt-10 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((c) => (
            <div key={c.title} className="bg-background p-6">
              <h3 className="font-display text-[14.5px] font-semibold leading-[1.35] text-foreground">
                {c.title}
              </h3>
              <p className="mt-2 text-[13.5px] leading-[1.7] text-muted-foreground">{c.body}</p>
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
          eyebrow="Managed services"
          title="What an engagement can turn into once the constraint is named."
          lede="Scope follows the Assessment. We recommend only the work that changes a number, in the order it should happen."
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

      {/* Assessment */}
      <Band muted>
        <BandHeading
          eyebrow="The assessment"
          title="Start With the Constraint."
          lede="We inspect the actual customer journey the way a buyer experiences it, then show you what we found in writing."
        />
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "What is broken", b: "The specific steps where the process fails, named and evidenced." },
            { t: "Where opportunity is lost", b: "The points between demand and revenue that quietly cost you deals." },
            { t: "What should change", b: "The sequence of fixes, ordered by business impact." },
            { t: "What we can implement", b: "The work NorthStar Labs can build and run, with scope in writing." },
          ].map((a, i) => (
            <li key={a.t} className="border-t border-border pt-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">0{i + 1}</div>
              <h3 className="mt-2 font-display text-[15px] font-semibold text-foreground">{a.t}</h3>
              <p className="mt-2 text-[13.5px] leading-[1.7] text-muted-foreground">{a.b}</p>
            </li>
          ))}
        </ol>
      </Band>

      <FinalCta />
    </SiteLayout>
  );
}