import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth-context";
import { OrgProvider } from "@/lib/org-context";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background paper-grain px-6">
      <div className="w-full max-w-lg text-center">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.28em] text-foreground/60">
          NorthStar Labs , 404
        </div>
        <div className="mt-4 border-y border-foreground/80 py-6">
          <h1 className="font-display text-[80px] leading-none tracking-tight text-foreground md:text-[112px]">
            Not in the register
          </h1>
        </div>
        <p className="mx-auto mt-6 max-w-md text-[14px] leading-[1.75] text-foreground/70">
          The page you are looking for does not exist, has been moved, or was never filed.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center bg-foreground px-5 py-2.5 text-[11.5px] font-medium uppercase tracking-[0.18em] text-background hover:bg-foreground/85"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background paper-grain px-6">
      <div className="w-full max-w-lg text-center">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.28em] text-foreground/60">
          Something interrupted this
        </div>
        <div className="mt-4 border-y border-foreground/80 py-6">
          <h1 className="font-display text-[40px] leading-[1.05] tracking-tight text-foreground md:text-[52px]">
            This page did not load.
          </h1>
        </div>
        <p className="mx-auto mt-6 max-w-md text-[14px] leading-[1.75] text-foreground/70">
          NorthStar Labs hit an unexpected error on our end. Try again, or return home.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center bg-foreground px-5 py-2.5 text-[11.5px] font-medium uppercase tracking-[0.18em] text-background hover:bg-foreground/85"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center border border-foreground/25 bg-transparent px-5 py-2.5 text-[11.5px] font-medium uppercase tracking-[0.18em] text-foreground hover:bg-foreground/[0.04]"
          >
            Return home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NorthStar Labs  -  Mission Control" },
      { name: "description", content: "NorthStar Labs Mission Control. The operating room where every venture is run, measured, and moved." },
      { name: "author", content: "NorthStar Labs" },
      { property: "og:title", content: "NorthStar Labs  -  Mission Control" },
      { property: "og:description", content: "NorthStar Labs Mission Control. The operating room where every venture is run, measured, and moved." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "NorthStar Labs  -  Mission Control" },
      { name: "twitter:description", content: "NorthStar Labs Mission Control. The operating room where every venture is run, measured, and moved." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5e0a0b3c-4e32-406f-a3f5-e5a497a1055e/id-preview-6f619393--0d729d9b-ddb9-49fb-9d95-0093c085d057.lovable.app-1784249565320.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5e0a0b3c-4e32-406f-a3f5-e5a497a1055e/id-preview-6f619393--0d729d9b-ddb9-49fb-9d95-0093c085d057.lovable.app-1784249565320.png" },
      { name: "theme-color", content: "#0b0b0b" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "NorthStar Labs" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Manrope:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OrgProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <Toaster />
        </OrgProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
