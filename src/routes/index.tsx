import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Band, BandHeading, CtaLink, FinalCta, SiteLayout, pageMeta } from "@/components/marketing/site-shell";
import { BRAND } from "@/lib/marketing/content";
import { SOCIAL_IMAGE_URL, siteUrl } from "@/lib/marketing/site-url";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    ...pageMeta({ title: "NorthStar Labs | Build a Better Growth System", description: "Find the constraint. Fix the leaks. Build the system. Prove the result.", path: "/" }),
    scripts: [{ type: "application/ld+json", children: JSON.stringify({ "@context":"https://schema.org", "@type":"Organization", name:"NorthStar Labs", url:BRAND.siteUrl, email:BRAND.email, logo:SOCIAL_IMAGE_URL, contactPoint:[{ "@type":"ContactPoint", contactType:"sales", email:BRAND.email, url:siteUrl("/request-assessment") }] }) }],
  }),
});

const FLOW = [
  ["Assess", "We look at how demand becomes revenue today."],
  ["Diagnose", "We identify the constraints, leaks, and highest-impact opportunities."],
  ["Implement", "We build the smallest system required to fix what matters."],
  ["Operate", "The system handles the repeatable work and keeps the process moving."],
  ["Measure", "We connect activity to pipeline, customers, and revenue."],
  ["Improve", "We use real performance to decide what should change next."],
];

const SYSTEM = [
  ["Acquire", "Create, capture, and qualify opportunities."],
  ["Convert", "Respond, follow up, book, and move opportunities forward."],
  ["Operate", "Connect systems and automate repetitive execution."],
  ["Measure", "Track the path from spend to customer and revenue."],
  ["Improve", "Find the next constraint using actual performance."],
];

const OUTCOMES = [
  ["Faster response", "Build toward immediate lead response instead of hours or days."],
  ["Consistent follow-up", "Every qualified opportunity gets the required next touch."],
  ["Fewer lost opportunities", "Recover missed calls, stalled leads, cancellations, and forgotten follow-up."],
  ["Less manual work", "Remove repetitive handoffs and re-entry where automation is appropriate."],
  ["Clear pipeline visibility", "Know what is moving, what is stalled, and what needs attention."],
  ["Revenue attribution", "Connect spend → lead → conversation → opportunity → customer → revenue."],
];

function HomePage() {
  return <SiteLayout>
    <section className="border-b border-border"><div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
      <div className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-primary">NorthStar Labs</div>
      <h1 className="mt-5 max-w-4xl font-display text-[40px] font-semibold leading-[1.04] text-foreground md:text-[64px]">Find the constraint. Fix the leaks. Build the system. Prove the result.</h1>
      <p className="mt-6 max-w-2xl text-[17px] leading-[1.8] text-muted-foreground">NorthStar builds and operates the systems that turn demand into customers and measurable revenue. We start with the business, not with a software package.</p>
      <div className="mt-9"><CtaLink to="/request-assessment">Request an Assessment <ArrowRight className="h-4 w-4"/></CtaLink></div>
    </div></section>

    <Band muted><BandHeading eyebrow="The problem" title="Growth breaks between the steps." lede="Marketing, lead capture, response, follow-up, appointments, sales, customer management, and reporting are one connected system. When the handoffs fail, revenue gets lost." />
      <div className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">{SYSTEM.map(([t,b])=><div key={t} className="bg-background p-6"><h3 className="font-display font-semibold">{t}</h3><p className="mt-2 text-[13.5px] leading-7 text-muted-foreground">{b}</p></div>)}</div>
    </Band>

    <Band><BandHeading eyebrow="How NorthStar works" title="One process. No software maze." lede="We diagnose first, then implement only what the business actually needs." />
      <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{FLOW.map(([t,b],i)=><li key={t} className="border-t border-border pt-4"><div className="text-[11px] uppercase tracking-[.2em] text-primary">0{i+1}</div><h3 className="mt-2 font-display font-semibold">{t}</h3><p className="mt-2 text-[13.5px] leading-7 text-muted-foreground">{b}</p></li>)}</ol>
    </Band>

    <Band muted><BandHeading eyebrow="Business outcomes" title="Measure what the owner actually cares about." lede="The operating chain is simple: Spend → Lead → Qualified Lead → Conversation → Appointment / Opportunity → Customer → Revenue." />
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{OUTCOMES.map(([t,b])=><div key={t} className="border-t border-border pt-4"><h3 className="font-display font-semibold">{t}</h3><p className="mt-2 text-[13.5px] leading-7 text-muted-foreground">{b}</p></div>)}</div>
      <p className="mt-8 max-w-3xl text-xs leading-6 text-muted-foreground">Targets are established from each client's baseline and implementation scope. Capability targets are not presented as historical client results.</p>
    </Band>

    <Band><BandHeading eyebrow="The assessment" title="Know what to fix before you buy anything." lede="We assess acquisition, lead handling, conversion, operations and automation, and measurement and revenue. You get the constraints, leaks, priorities, defensible opportunity estimates, recommended fixes, and implementation scope in writing." />
      <div className="mt-8"><CtaLink to="/request-assessment">Start the Assessment <ArrowRight className="h-4 w-4"/></CtaLink></div>
    </Band>

    <Band muted><BandHeading eyebrow="NorthStar infrastructure" title="The technology stays underneath the outcome." lede="NorthStar can deploy acquisition, communication, workflow execution, CRM, attribution, integrations, and AI independently or as one connected system. You do not need to assemble the stack yourself." /></Band>
    <FinalCta />
  </SiteLayout>;
}
