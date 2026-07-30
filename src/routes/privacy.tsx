import { createFileRoute } from "@tanstack/react-router";
import { Band, SiteLayout, PageIntro, pageMeta } from "@/components/marketing/site-shell";
import { BRAND } from "@/lib/marketing/content";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () =>
    pageMeta({
      title: "Privacy Policy | NorthStar Labs",
      description:
        "How NorthStar Labs collects, uses, and protects information submitted through this website and our client workspace.",
      path: "/privacy",
    }),
});

function PrivacyPage() {
  return (
    <SiteLayout>
      <PageIntro
        eyebrow="Privacy"
        title="Privacy Policy"
        lede="This page describes what information NorthStar Labs collects through this website, why we collect it, and how it is handled."
      />
      <Band>
        <div className="max-w-3xl space-y-8 text-[14.5px] leading-[1.85] text-muted-foreground">
          <section>
            <h2 className="font-display text-[18px] font-semibold text-foreground">Information we collect</h2>
            <p className="mt-2">
              When you submit an Assessment request or contact form, we collect the information you enter:
              name, company, email address, phone number, website, industry, business size, a description of
              your challenge, and how you heard about us. We also record technical metadata with each
              submission, including a one-way hash of the submitting network address and the browser user
              agent, used only to prevent abuse of the form.
            </p>
          </section>
          <section>
            <h2 className="font-display text-[18px] font-semibold text-foreground">How we use it</h2>
            <p className="mt-2">
              We use submitted information to respond to your request, schedule and conduct an Assessment,
              and, if you become a client, to deliver and support the engagement. We do not sell your
              information and we do not share it with third parties for their own marketing.
            </p>
          </section>
          <section>
            <h2 className="font-display text-[18px] font-semibold text-foreground">Service providers</h2>
            <p className="mt-2">
              We use third-party providers to host this website, store data, process payments, and send
              email. These providers process information on our behalf and only as needed to deliver their
              service to us.
            </p>
          </section>
          <section>
            <h2 className="font-display text-[18px] font-semibold text-foreground">Cookies and analytics</h2>
            <p className="mt-2">
              This website does not use advertising cookies or third-party tracking pixels. Authentication
              cookies are used only in the client and operator areas, which require a sign in.
            </p>
          </section>
          <section>
            <h2 className="font-display text-[18px] font-semibold text-foreground">Retention</h2>
            <p className="mt-2">
              Assessment requests are retained while we evaluate and pursue the opportunity, and for our
              business records afterward. You may request deletion at any time.
            </p>
          </section>
          <section>
            <h2 className="font-display text-[18px] font-semibold text-foreground">Your choices</h2>
            <p className="mt-2">
              You may request access to, correction of, or deletion of the information you submitted by
              emailing{" "}
              <a className="text-foreground underline underline-offset-4" href={`mailto:${BRAND.email}`}>
                {BRAND.email}
              </a>
              . You may opt out of follow-up communication at any time.
            </p>
          </section>
          <section>
            <h2 className="font-display text-[18px] font-semibold text-foreground">Contact</h2>
            <p className="mt-2">
              Questions about this policy can be sent to{" "}
              <a className="text-foreground underline underline-offset-4" href={`mailto:${BRAND.email}`}>
                {BRAND.email}
              </a>
              .
            </p>
          </section>
        </div>
      </Band>
    </SiteLayout>
  );
}