import { createFileRoute } from "@tanstack/react-router";
import { Band, SiteLayout, PageIntro, pageMeta } from "@/components/marketing/site-shell";
import { BRAND } from "@/lib/marketing/content";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () =>
    pageMeta({
      title: "Terms of Use | NorthStar Labs",
      description: "The terms that govern use of the NorthStar Labs website and the information published on it.",
      path: "/terms",
    }),
});

function TermsPage() {
  return (
    <SiteLayout>
      <PageIntro
        eyebrow="Terms"
        title="Terms of Use"
        lede="These terms govern your use of this website. Client engagements are governed separately by the written agreement signed for that engagement."
      />
      <Band>
        <div className="max-w-3xl space-y-8 text-[14.5px] leading-[1.85] text-muted-foreground">
          <section>
            <h2 className="font-display text-[18px] font-semibold text-foreground">Use of this site</h2>
            <p className="mt-2">
              You may use this website for lawful purposes only. You may not attempt to disrupt the site,
              access areas you are not authorized to use, or submit forms in an automated or abusive manner.
            </p>
          </section>
          <section>
            <h2 className="font-display text-[18px] font-semibold text-foreground">No guarantee of results</h2>
            <p className="mt-2">
              Content on this site describes our services and approach. It is not a promise of specific
              financial results. Outcomes depend on the business, the market, and execution on both sides.
            </p>
          </section>
          <section>
            <h2 className="font-display text-[18px] font-semibold text-foreground">Not professional advice</h2>
            <p className="mt-2">
              Nothing on this site is legal, tax, accounting, or investment advice. Consult a qualified
              professional for those matters.
            </p>
          </section>
          <section>
            <h2 className="font-display text-[18px] font-semibold text-foreground">Engagement terms</h2>
            <p className="mt-2">
              Submitting an Assessment request does not create a client relationship or a binding agreement.
              A relationship begins only when a written proposal is accepted by both parties.
            </p>
          </section>
          <section>
            <h2 className="font-display text-[18px] font-semibold text-foreground">Intellectual property</h2>
            <p className="mt-2">
              The NorthStar Labs name, marks, and site content are our property. Do not reproduce them
              without written permission.
            </p>
          </section>
          <section>
            <h2 className="font-display text-[18px] font-semibold text-foreground">Changes</h2>
            <p className="mt-2">
              We may update these terms as the business changes. Continued use of the site after an update
              means you accept the revised terms. Questions can be sent to{" "}
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