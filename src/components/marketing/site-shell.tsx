// Public website chrome. Sticky header, mobile menu, footer, and the small
// set of layout primitives every marketing page composes with.

import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import northstarLogo from "@/assets/northstar-labs-logo.png.asset.json";
import { BRAND } from "@/lib/marketing/content";
import { cn } from "@/lib/utils";

type NavTo =
  | "/"
  | "/services"
  | "/industries"
  | "/how-it-works"
  | "/about"
  | "/contact"
  | "/privacy"
  | "/terms"
  | "/request-assessment"
  | "/client/login";


const NAV: { to: NavTo; label: string }[] = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/industries", label: "Industries" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export function CtaLink({
  to,
  children,
  variant = "primary",
  className,
}: {
  to: NavTo;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center justify-center gap-2 px-5 py-3 text-[12px] font-medium uppercase tracking-[0.16em] transition-colors",
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-border text-foreground hover:bg-accent",
        className,
      )}
    >
      {children}
    </Link>
  );
}

function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 md:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="NorthStar Labs home">
          <img
            src={northstarLogo.url}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 object-contain"
          />
          <span className="font-display text-[15px] font-semibold tracking-tight text-foreground">
            NorthStar Labs
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {NAV.slice(1).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/client/login"
            className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Client sign in
          </Link>
          <CtaLink to="/request-assessment" className="px-4 py-2.5">
            Request Assessment
          </CtaLink>
        </nav>


        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="inline-flex h-10 w-10 items-center justify-center border border-border text-foreground lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t border-border bg-background lg:hidden">
          <nav aria-label="Mobile" className="mx-auto flex max-w-6xl flex-col px-5 py-3">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="border-b border-border/60 py-3 text-[14px] text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/client/login"
              onClick={() => setOpen(false)}
              className="border-b border-border/60 py-3 text-[14px] text-foreground"
            >
              Client sign in
            </Link>
            <CtaLink to="/request-assessment" className="mt-4 mb-2 w-full">
              Request Assessment
            </CtaLink>
          </nav>
        </div>
      )}

    </header>
  );
}

function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-3 md:px-8">
        <div>
          <div className="flex items-center gap-3">
            <img src={northstarLogo.url} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
            <span className="font-display text-[14px] font-semibold text-foreground">NorthStar Labs</span>
          </div>
          <p className="mt-4 max-w-xs text-[13px] leading-[1.7] text-muted-foreground">{BRAND.tagline}</p>
          <a
            href={`mailto:${BRAND.email}`}
            className="mt-4 inline-block text-[13px] text-foreground underline underline-offset-4"
          >
            {BRAND.email}
          </a>
        </div>

        <div>
          <h2 className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-foreground/70">
            Navigation
          </h2>
          <ul className="mt-4 space-y-2.5">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-[13px] text-muted-foreground hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-foreground/70">
            Company
          </h2>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link to="/request-assessment" className="text-[13px] text-muted-foreground hover:text-foreground">
                Request an Assessment
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="text-[13px] text-muted-foreground hover:text-foreground">
                Privacy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="text-[13px] text-muted-foreground hover:text-foreground">
                Terms
              </Link>
            </li>
            <li>
              <Link to="/client/login" className="text-[13px] text-muted-foreground hover:text-foreground">
                Client sign in
              </Link>
            </li>

            <li>
              <a href="/auth" className="text-[13px] text-muted-foreground hover:text-foreground">
                Team sign in
              </a>
            </li>
          </ul>
          <p className="mt-6 text-[12px] text-muted-foreground/70">
            Social profiles are not published yet.
          </p>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-5 py-5 text-[12px] text-muted-foreground md:px-8">
          &copy; {year} NorthStar Labs. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede: string;
}) {
  return (
    <section className="border-b border-border bg-card/30">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <div className="flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          <span className="h-1 w-1 rounded-full bg-primary" />
          {eyebrow}
        </div>
        <h1 className="mt-4 max-w-3xl font-display text-[32px] font-semibold leading-[1.1] text-foreground md:text-[46px]">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-[1.8] text-muted-foreground">{lede}</p>
      </div>
    </section>
  );
}

export function Band({
  children,
  muted = false,
  className,
}: {
  children: ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-border", muted && "bg-card/30", className)}>
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">{children}</div>
    </section>
  );
}

export function BandHeading({ eyebrow, title, lede }: { eyebrow?: string; title: string; lede?: string }) {
  return (
    <div className="max-w-2xl">
      {eyebrow && (
        <div className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          {eyebrow}
        </div>
      )}
      <h2 className="mt-3 font-display text-[24px] font-semibold leading-[1.2] text-foreground md:text-[32px]">
        {title}
      </h2>
      {lede && <p className="mt-4 text-[15px] leading-[1.8] text-muted-foreground">{lede}</p>}
    </div>
  );
}

export function FinalCta({
  title = "Find out what is limiting growth.",
  body = "An Assessment is a working conversation about your business, not a software demo. You leave with a clear read on the constraint and what it costs to leave it in place.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="bg-card/50">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <div className="max-w-2xl">
          <h2 className="font-display text-[26px] font-semibold leading-[1.2] text-foreground md:text-[34px]">
            {title}
          </h2>
          <p className="mt-4 text-[15px] leading-[1.8] text-muted-foreground">{body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <CtaLink to="/request-assessment">
              Request an Assessment <ArrowRight className="h-4 w-4" />
            </CtaLink>
            <CtaLink to="/how-it-works" variant="secondary">
              See how it works
            </CtaLink>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Per-page head metadata builder. Keeps title/description/OG/canonical consistent. */
export function pageMeta({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}) {
  const url = `${BRAND.siteUrl}${path}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}