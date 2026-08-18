import { createFileRoute } from "@tanstack/react-router";
import { Band, BandHeading, FinalCta, PageIntro, SiteLayout, pageMeta } from "@/components/marketing/site-shell";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () =>
    pageMeta({
      title: "About NorthStar Labs | Built by Business Owners",
      description:
        "NorthStar Labs is built by business owners for business owners. Revenue before features, business outcomes over technology, long-term partnerships.",
      path: "/about",
    }),
});

const PRINCIPLES = [
  {
    t: "Built by business owners, for business owners",
    b: "We have made payroll, chased receivables, and lost deals to slow follow-up. That perspective shapes every recommendation we make.",
  },
  {
    t: "Revenue before features",
    b: "Work is sequenced by business impact. If something does not move revenue, cost, or capacity, it waits.",
  },
  {
    t: "Business outcomes over technology",
    b: "Technology is a means. The measure is what changed in the business, not what got installed.",
  },
  {
    t: "Long-term partnerships",
    b: "We would rather do fewer engagements well and stay accountable after go live than sell projects and move on.",
  },
  {
    t: "Truth over optimism",
    b: "We report what the data supports. If a number is not available yet, we say so instead of estimating it.",
  },
  {
    t: "Ownership",
    b: "Once a system is live, you own it. No hostage data and no dependency we manufactured on purpose.",
  },
];

function AboutPage() {
  return (
    <SiteLayout>
      <PageIntro
        eyebrow="About"
        title="We fix what is limiting growth, then prove it moved."
        lede="NorthStar Labs helps businesses find what’s limiting growth, fix the problem, and build the systems needed to produce measurable results."
      />

      <Band>
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-primary">Mission</h2>
            <p className="mt-3 text-[15px] leading-[1.85] text-muted-foreground">
              Help business owners see clearly what is limiting growth, and implement the systems that fix
              it. Not advice. Working systems, in production, measured against the business.
            </p>
          </div>
          <div>
            <h2 className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-primary">Vision</h2>
            <p className="mt-3 text-[15px] leading-[1.85] text-muted-foreground">
              A business of any size should be able to operate with the clarity, follow-through, and
              reporting discipline that used to require an enterprise back office.
            </p>
          </div>
        </div>
      </Band>

      <Band muted>
        <BandHeading eyebrow="Core principles" title="How we operate." />
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {PRINCIPLES.map((p) => (
            <div key={p.t} className="border-l border-primary/40 pl-5">
              <h3 className="font-display text-[16px] font-semibold text-foreground">{p.t}</h3>
              <p className="mt-2 text-[14px] leading-[1.75] text-muted-foreground">{p.b}</p>
            </div>
          ))}
        </div>
      </Band>

      <Band>
        <BandHeading eyebrow="Business philosophy" title="Diagnose first. Implement second. Measure always." />
        <div className="mt-6 max-w-3xl space-y-4 text-[15px] leading-[1.85] text-muted-foreground">
          <p>
            Most growth problems are not caused by a missing tool. They are caused by a step in the
            operation that quietly loses revenue: a call that goes unanswered, a lead that never gets a
            second touch, a proposal that sits, a report nobody trusts.
          </p>
          <p>
            We start by finding that step. Then we implement, in a deliberate order, the systems that close
            it. Afterward, we keep measuring, because the constraint moves as the business grows.
          </p>
          <p>
            We do not publish client statistics or case study numbers we cannot substantiate. When we have
            results we are permitted to share, they will appear here with the client's approval.
          </p>
        </div>
      </Band>

      <FinalCta />
    </SiteLayout>
  );
}