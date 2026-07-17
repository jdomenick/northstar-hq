import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in  -  Northstar" },
      { name: "description", content: "Sign in to your executive operating system." },
    ],
  }),
});

type Mode = "signin" | "signup";

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/", replace: true });
  }, [loading, user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/`,
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
    <div className="flex min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-md flex-col justify-center px-6 py-16">
        <div className="mb-14 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background text-[13px] font-semibold">
            N
          </div>
          <div className="leading-tight">
            <div className="font-display text-[18px]">Northstar</div>
            <div className="text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground/80">
              Executive OS
            </div>
          </div>
        </div>

        <h1 className="font-display text-[36px] leading-tight text-foreground">
          {mode === "signin" ? "Welcome back." : "Start with Northstar."}
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
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="hover:text-foreground"
          >
            {mode === "signin" ? "Create an account" : "I already have an account"}
          </button>
          {mode === "signin" && (
            <Link to="/auth/forgot" className="hover:text-foreground">
              Forgot password
            </Link>
          )}
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