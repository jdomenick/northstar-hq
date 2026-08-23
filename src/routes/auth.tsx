import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Moon, Sun } from "lucide-react";
import northstarLogo from "@/assets/northstar-labs-logo.png.asset.json";
import { useSiteTheme } from "@/lib/marketing/site-theme";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { next?: string } =>
    typeof search['next'] === "string" ? { next: search['next'] as string } : {},
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in  -  NorthStar Labs" },
      { name: "description", content: "Sign in to your executive operating system." },
    ],
  }),
});

type Mode = "signin" | "signup";

// Public operator signup is disabled unless explicitly enabled by configuration.
// Internal users are provisioned through invitation instead.
const PUBLIC_SIGNUP_ENABLED = import.meta.env.VITE_ALLOW_PUBLIC_SIGNUP === "true";

// Only same-origin relative paths are accepted as a post sign-in destination.
function safeNext(next: string | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const redirectTo = safeNext(next);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Sign-in is a public surface, so it gets the same true light / true dark
  // tokens as the marketing site, persisted under its own key. The
  // authenticated app theme is untouched.
  const { theme, toggleTheme } = useSiteTheme("nsl-auth-theme");

  useEffect(() => {
    if (loading || !user) return;
    if (redirectTo) {
      window.location.replace(redirectTo);
      return;
    }
    navigate({ to: "/labs", replace: true });
  }, [loading, user, navigate, redirectTo]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        if (!PUBLIC_SIGNUP_ENABLED) throw new Error("Account creation is by invitation only.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}${redirectTo ?? "/"}`,
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Account created  -  sign in to continue");
          setMode("signin");
          setPassword("");
        } else {
          toast.success("Account created");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="nsl-site flex min-h-screen bg-background" data-theme={theme}>
      <div className="mx-auto flex w-full max-w-md flex-col justify-center px-6 py-16">
        <div className="mb-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={northstarLogo.url}
              alt="NorthStar Labs"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 object-contain"
            />
            <span className="font-display text-[18px] leading-none text-foreground">
              NorthStar Labs
            </span>
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        <h1 className="font-display text-[36px] leading-tight text-foreground">
          {mode === "signin" ? "Welcome back." : "Start with NorthStar Labs."}
        </h1>
        <p className="mt-3 text-[14px] text-muted-foreground">
          {mode === "signin"
            ? "Sign in to open your operating system."
            : "Create your account. The rest takes about a minute."}
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-5">
          {mode === "signup" && (
            <Field label="Full name">
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60"
                placeholder="Jeff Carter"
              />
            </Field>
          )}
          <Field label="Email">
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60"
              placeholder="you@company.com"
            />
          </Field>
          <Field label="Password">
            <input
              required
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60"
              placeholder="At least 8 characters"
            />
          </Field>

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-foreground px-4 py-3 text-[13.5px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-8 flex items-center justify-between text-[12.5px] text-muted-foreground">
          {PUBLIC_SIGNUP_ENABLED ? (
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="hover:text-foreground"
            >
              {mode === "signin" ? "Create an account" : "I already have an account"}
            </button>
          ) : (
            <span>Access is by invitation only.</span>
          )}
          {mode === "signin" && (
            <Link to="/auth/forgot" className="hover:text-foreground">
              Forgot password
            </Link>
          )}
        </div>

        <div className="mt-6 border-t border-border/60 pt-5 text-center text-[12.5px] text-muted-foreground">
          Looking for the client workspace?{" "}
          <Link to="/client/login" className="text-foreground underline underline-offset-4 hover:text-foreground/80">
            Sign in as a client
          </Link>
        </div>

      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block border-b border-border/80 pb-3 focus-within:border-foreground/60">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">
        {label}
      </div>
      {children}
    </label>
  );
}