import { createFileRoute } from "@tanstack/react-router";
import { Band, BandHeading, FinalCta, PageIntro, SiteLayout, pageMeta } from "@/components/marketing/site-shell";
import { PROCESS_STEPS } from "@/lib/marketing/content";

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorksPage,
  head: () =>
    pageMeta({
      title: "How It Works | NorthStar Labs",
      description:
        "The NorthStar Labs client journey: Assessment, Discovery, Executive Assessment, Growth Blueprint, Proposal, Implementation, and Optimization.",
      path: "/how-it-works",
    }),
});

function HowItWorksPage() {
  return (
    <SiteLayout>
      <PageIntro
        eyebrow="How it works"
        title="Seven steps from first conversation to measured result."
        lede="No surprises and no open-ended engagements. You know what happens at every step, and you decide before implementation begins."
      />

      <Band>
        <ol className="relative space-y-0 border-l border-border pl-6 md:pl-8">
          {PROCESS_STEPS.map((s) => (
            <li key={s.step} className="relative pb-10 last:pb-0">
              <span
                aria-hidden="true"
                className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary md:-left-[37px]"
              />
              <div className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-primary">
                Step {s.step}
              </div>
              <h2 className="mt-2 font-display text-[20px] font-semibold text-foreground md:text-[23px]">
                {s.name}
              </h2>
              <p className="mt-2 max-w-2xl text-[14.5px] leading-[1.8] text-muted-foreground">{s.detail}</p>
            </li>
          ))}
        </ol>
      </Band>

      <Band muted>
        <BandHeading
          eyebrow="What you can expect"
          title="Written plans, visible milestones, truthful reporting."
          lede="Once implementation starts, clients get a workspace showing delivery stage, milestones, deliverables awaiting review, billing status, and an executive report of outcomes. Nothing in it is estimated."
        />
      </Band>

      <FinalCta />
    </SiteLayout>
  );
}