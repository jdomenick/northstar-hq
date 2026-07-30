import { createFileRoute } from "@tanstack/react-router";
import { Band, BandHeading, PageIntro, SiteLayout, pageMeta } from "@/components/marketing/site-shell";
import { AssessmentForm } from "@/components/marketing/assessment-form";
import { BRAND } from "@/lib/marketing/content";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () =>
    pageMeta({
      title: "Contact NorthStar Labs",
      description:
        "Reach NorthStar Labs by email or start an Assessment request. We respond to every message from a business owner.",
      path: "/contact",
    }),
});

function ContactPage() {
  return (
    <SiteLayout>
      <PageIntro
        eyebrow="Contact"
        title="Talk to someone who has run a business."
        lede="Every message is read by our team. If you already know what you need, use the form and we will follow up to schedule Discovery."
      />

      <Band>
        <div className="grid gap-12 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div>
            <h2 className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Direct
            </h2>
            <a
              href={`mailto:${BRAND.email}`}
              className="mt-3 block text-[15px] text-foreground underline underline-offset-4"
            >
              {BRAND.email}
            </a>
            <p className="mt-6 text-[13.5px] leading-[1.8] text-muted-foreground">
              We respond during standard business hours. Existing clients should use their client workspace
              so requests stay attached to the engagement record.
            </p>
            <a
              href="/client/login"
              className="mt-4 inline-block text-[13px] text-foreground underline underline-offset-4"
            >
              Client sign in
            </a>
          </div>

          <div>
            <BandHeading
              title="Send a request"
              lede="Tell us about the business and the problem. This is the same form used to request an Assessment."
            />
            <div className="mt-8">
              <AssessmentForm />
            </div>
          </div>
        </div>
      </Band>
    </SiteLayout>
  );
}