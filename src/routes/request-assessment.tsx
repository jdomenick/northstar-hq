import { createFileRoute } from "@tanstack/react-router";
import { Band, PageIntro, SiteLayout, pageMeta } from "@/components/marketing/site-shell";
import { AssessmentForm } from "@/components/marketing/assessment-form";
import { PROCESS_STEPS } from "@/lib/marketing/content";

export const Route = createFileRoute("/request-assessment")({
  component: RequestAssessmentPage,
  head: () =>
    pageMeta({
      title: "Request an Assessment | NorthStar Labs",
      description:
        "Tell us what is limiting growth. We will review your business and follow up to schedule Discovery. No software demo.",
      path: "/request-assessment",
    }),
});

function RequestAssessmentPage() {
  return (
    <SiteLayout>
      <PageIntro
        eyebrow="Request an Assessment"
        title="Start with a clear read on what is holding revenue back."
        lede="Answer a few questions about the business. We review every request personally and follow up to schedule Discovery."
      />
      <Band>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <AssessmentForm />
          </div>
          <aside className="lg:border-l lg:border-border lg:pl-8">
            <h2 className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              What happens next
            </h2>
            <ol className="mt-5 space-y-5">
              {PROCESS_STEPS.slice(0, 4).map((s) => (
                <li key={s.step}>
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
                    Step {s.step}
                  </div>
                  <div className="mt-1 text-[14px] font-medium text-foreground">{s.name}</div>
                  <p className="mt-1 text-[13px] leading-[1.7] text-muted-foreground">{s.detail}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-[12.5px] leading-[1.7] text-muted-foreground/80">
              Submitting this form does not create an account or a binding agreement.
            </p>
          </aside>
        </div>
      </Band>
    </SiteLayout>
  );
}