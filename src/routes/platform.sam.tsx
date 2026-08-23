import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { CtaLink, FinalCta, SiteLayout, pageMeta } from "@/components/marketing/site-shell";
import { SAM_FULL_NAME, SAM_MARK_SRC } from "@/lib/sam/branding";

export const Route = createFileRoute("/platform/sam")({
  component: SamPlatformPage,
  head: () =>
    pageMeta({
      title: "SAM, the Strategic Asset Manager | NorthStar Labs",
      description:
        "SAM is the intelligence and orchestration layer across the NorthStar ecosystem. Tell SAM the objective. SAM builds the plan, coordinates the work, measures the result, and improves.",
      path: "/platform/sam",
    }),
});

const LOOP = [
  { step: "Understand", body: "SAM reads the objective and the systems of record behind it." },
  { step: "Plan", body: "SAM turns the objective into a sequenced plan with owners and constraints." },
  { step: "Approve", body: "You keep control. Nothing consequential runs without your approval." },
  { step: "Execute", body: "SAM coordinates the work across the connected NorthStar systems." },
  { step: "Measure", body: "Results are compared against the objective, not against activity." },
  { step: "Learn", body: "Outcomes and corrections are retained as operating knowledge." },
  { step: "Improve", body: "The next plan starts from what already worked." },
  { step: "Repeat", body: "The loop runs continuously against the current objective." },
];

const PRINCIPLES = [
  { name: "Clarity", body: "One current picture of the business, drawn from the systems of record." },
  { name: "Focus", body: "The few things that move the objective, separated from the noise." },
  { name: "Execution", body: "Plans that turn into coordinated work, not documents." },
  { name: "Intelligence", body: "Context carried across systems, decisions, and time." },
  { name: "Control", body: "Approval gates, audit trails, and truthful status at every step." },
];

const SURFACES = [
  { name: "CAM", body: "Client acquisition work and the pipeline behind it." },
  { name: "CCM", body: "Client communication and the record of what was said and promised." },
  { name: "NorthStar CRM", body: "Accounts, contacts, and the commercial relationship." },
  { name: "NorthStar Command Center", body: "The primary internal operating view of the business." },
  { name: "Unified Client Workspace", body: "One client, one outcome chain, end to end." },
  { name: "Future NorthStar systems", body: "New systems join the same orchestration layer." },
];

function SamPlatformPage() {
  return (
    <SiteLayout>
      <div className="dark bg-background text-foreground">
        <section className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-primary/15 blur-3xl"
          />
          <div className="relative mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
            <div className="flex flex-col gap-10 md:flex-row md:items-center md:gap-16">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  SAM · {SAM_FULL_NAME}
                </div>
                <h1 className="mt-5 max-w-3xl font-display text-[34px] font-semibold leading-[1.08] text-foreground md:text-[52px]">
                  Tell SAM what needs to happen. SAM runs the work.
                </h1>
                <p className="mt-6 max-w-2xl text-[15.5px] leading-[1.85] text-muted-foreground">
                  SAM is the intelligence and orchestration layer across the NorthStar ecosystem, not
                  a chatbot bolted onto a dashboard. You state the objective in plain business
                  language. SAM understands what it depends on, builds the plan, coordinates the
                  work across the NorthStar systems, measures the result, learns from it, and
                  adjusts.
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  <CtaLink to="/request-assessment">
                    Request an Assessment <ArrowRight className="h-4 w-4" />
                  </CtaLink>
                  <CtaLink to="/how-it-works" variant="secondary">
                    See how it works
                  </CtaLink>
                </div>
              </div>
              <div className="flex shrink-0 justify-center md:w-[300px]">
                <div className="relative flex h-[220px] w-[220px] items-center justify-center md:h-[280px] md:w-[280px]">
                  <div
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-primary/10 blur-2xl"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-4 rounded-full border border-border/70"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-10 rounded-full border border-primary/30"
                  />
                  <img
                    src={SAM_MARK_SRC}
                    alt="SAM, the Strategic Asset Manager, identity mark"
                    className="relative h-[130px] w-[130px] object-contain md:h-[170px] md:w-[170px]"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-card/30">
          <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
            <div className="max-w-2xl">
              <div className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                The loop
              </div>
              <h2 className="mt-3 font-display text-[24px] font-semibold leading-[1.2] text-foreground md:text-[32px]">
                Understand, plan, approve, execute, measure, learn, improve, repeat.
              </h2>
              <p className="mt-4 text-[15px] leading-[1.8] text-muted-foreground">
                Every objective moves through the same loop, so progress is visible and reversible
                at each step.
              </p>
            </div>

            <ol className="mt-10 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {LOOP.map((s, i) => (
                <li key={s.step} className="bg-background p-6">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] text-primary">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-display text-[16px] font-semibold text-foreground">
                      {s.step}
                    </span>
                  </div>
                  <p className="mt-2.5 text-[13.5px] leading-[1.7] text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
            <div className="max-w-2xl">
              <div className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Where SAM works
              </div>
              <h2 className="mt-3 font-display text-[24px] font-semibold leading-[1.2] text-foreground md:text-[32px]">
                One intelligence layer across the NorthStar systems.
              </h2>
              <p className="mt-4 text-[15px] leading-[1.8] text-muted-foreground">
                SAM does not replace the systems that run the business. It coordinates across them so
                one objective does not fragment into six disconnected tools.
              </p>
            </div>

            <div className="mt-10 grid gap-px overflow-hidden border border-border bg-border md:grid-cols-3">
              {SURFACES.map((s) => (
                <article key={s.name} className="bg-background p-7">
                  <h3 className="font-display text-[17px] font-semibold text-foreground">{s.name}</h3>
                  <p className="mt-2.5 text-[13.5px] leading-[1.75] text-muted-foreground">{s.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-card/30">
          <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
            <div className="max-w-2xl">
              <div className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                What SAM is built on
              </div>
              <h2 className="mt-3 font-display text-[24px] font-semibold leading-[1.2] text-foreground md:text-[32px]">
                Clarity, Focus, Execution, Intelligence, Control.
              </h2>
            </div>
            <dl className="mt-10 grid gap-8 md:grid-cols-5">
              {PRINCIPLES.map((p) => (
                <div key={p.name}>
                  <dt className="font-display text-[16px] font-semibold text-foreground">
                    {p.name}
                  </dt>
                  <dd className="mt-2 text-[13.5px] leading-[1.7] text-muted-foreground">{p.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </div>

      <FinalCta
        title="Put SAM to work on a real objective"
        body="Start with an Assessment. We identify the constraint first, then show exactly where SAM coordinates the work."
      />
    </SiteLayout>
  );
}
