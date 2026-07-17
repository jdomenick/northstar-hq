import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-context";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  component: OnboardingFlow,
  head: () => ({ meta: [{ title: "Set up Northstar" }] }),
});

type Step = 1 | 2 | 3 | 4;

function OnboardingFlow() {
  const { user, loading } = useAuth();
  const { refresh, setActiveOrgId } = useOrg();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  // Profile
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [title, setTitle] = useState("");
  const [tz, setTz] = useState(
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC",
  );

  // Organization
  const [orgName, setOrgName] = useState("Northstar HQ");
  const [orgDescription, setOrgDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [orgTz, setOrgTz] = useState(tz);

  // Venture
  const [ventureName, setVentureName] = useState("");
  const [ventureDescription, setVentureDescription] = useState("");
  const [mission, setMission] = useState("");
  const [website, setWebsite] = useState("");
  const [ventureStatus, setVentureStatus] = useState<
    "idea" | "active" | "paused" | "at_risk" | "closed" | "archived"
  >("active");
  const [currentFocus, setCurrentFocus] = useState("");

  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  // Preload existing profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, preferred_name, title, timezone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setFullName(data.full_name ?? "");
        setPreferredName(data.preferred_name ?? "");
        setTitle(data.title ?? "");
        if (data.timezone) setTz(data.timezone);
      });
  }, [user]);

  async function saveProfile() {
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName,
      preferred_name: preferredName || null,
      title: title || null,
      timezone: tz,
      email: user.email,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setStep(2);
  }

  async function createOrg() {
    if (!user) return;
    setSubmitting(true);
    const slug = orgName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { data: org, error } = await supabase
      .from("organizations")
      .insert({
        name: orgName,
        slug: slug || null,
        description: orgDescription || null,
        industry: industry || null,
        timezone: orgTz,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !org) {
      setSubmitting(false);
      return toast.error(error?.message ?? "Could not create organization");
    }
    const { error: memberErr } = await supabase.from("organization_members").insert({
      organization_id: org.id,
      user_id: user.id,
      role: "owner",
      status: "active",
    });
    setSubmitting(false);
    if (memberErr) return toast.error(memberErr.message);
    setCreatedOrgId(org.id);
    await refresh();
    setActiveOrgId(org.id);
    setStep(3);
  }

  async function createVenture() {
    if (!user || !createdOrgId) return;
    setSubmitting(true);
    const { error } = await supabase.from("ventures").insert({
      organization_id: createdOrgId,
      name: ventureName,
      description: ventureDescription || null,
      mission: mission || null,
      website_url: website || null,
      status: ventureStatus,
      current_focus: currentFocus || null,
      created_by: user.id,
      owner_user_id: user.id,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setStep(4);
  }

  async function finish() {
    if (!user) return;
    setSubmitting(true);
    await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
    setSubmitting(false);
    navigate({ to: "/", replace: true });
  }

  async function skipVenture() {
    setStep(4);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-16">
      <div className="mb-10 flex items-center gap-3">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className={
              "h-1 flex-1 rounded-full " + (n <= step ? "bg-foreground" : "bg-border")
            }
          />
        ))}
      </div>

      {step === 1 && (
        <Panel
          eyebrow="Step 1 of 4"
          title="Founder profile"
          description="Northstar uses this to personalize your executive briefings."
        >
          <TextField label="Full name" value={fullName} onChange={setFullName} required />
          <TextField label="Preferred name" value={preferredName} onChange={setPreferredName} placeholder="What SAM calls you" />
          <TextField label="Title" value={title} onChange={setTitle} placeholder="Founder & CEO" />
          <TextField label="Timezone" value={tz} onChange={setTz} />
          <PrimaryButton onClick={saveProfile} disabled={!fullName || submitting}>
            Continue
          </PrimaryButton>
        </Panel>
      )}

      {step === 2 && (
        <Panel
          eyebrow="Step 2 of 4"
          title="Create your organization"
          description="Every venture, decision, and project lives inside an organization."
        >
          <TextField label="Organization name" value={orgName} onChange={setOrgName} required />
          <TextField label="Description" value={orgDescription} onChange={setOrgDescription} placeholder="Optional" />
          <TextField label="Industry" value={industry} onChange={setIndustry} placeholder="Optional" />
          <TextField label="Timezone" value={orgTz} onChange={setOrgTz} />
          <PrimaryButton onClick={createOrg} disabled={!orgName || submitting}>
            Create organization
          </PrimaryButton>
        </Panel>
      )}

      {step === 3 && (
        <Panel
          eyebrow="Step 3 of 4"
          title="Add your first venture"
          description="A venture is a business, project portfolio, or initiative you run. You can add more later."
        >
          <TextField label="Venture name" value={ventureName} onChange={setVentureName} required />
          <TextField label="Description" value={ventureDescription} onChange={setVentureDescription} />
          <TextField label="Mission" value={mission} onChange={setMission} />
          <TextField label="Website" value={website} onChange={setWebsite} placeholder="https://" />
          <div className="border-b border-border/80 pb-3">
            <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">Status</div>
            <select
              value={ventureStatus}
              onChange={(e) => setVentureStatus(e.target.value as typeof ventureStatus)}
              className="w-full bg-transparent text-[15px] text-foreground outline-none"
            >
              {["idea", "active", "paused", "at_risk", "closed", "archived"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <TextField label="Current focus" value={currentFocus} onChange={setCurrentFocus} />
          <div className="flex items-center gap-3">
            <PrimaryButton onClick={createVenture} disabled={!ventureName || submitting}>
              Create venture
            </PrimaryButton>
            <button
              type="button"
              onClick={skipVenture}
              className="text-[12.5px] text-muted-foreground hover:text-foreground"
            >
              Skip for now
            </button>
          </div>
        </Panel>
      )}

      {step === 4 && (
        <Panel
          eyebrow="Step 4 of 4"
          title="You're ready."
          description="Northstar is set up. SAM will begin learning from your organization once intelligence is enabled in Phase 3."
        >
          <PrimaryButton onClick={finish} disabled={submitting}>
            Enter Northstar
          </PrimaryButton>
        </Panel>
      )}
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
        {eyebrow}
      </div>
      <h1 className="mt-3 font-display text-[32px] leading-tight text-foreground">{title}</h1>
      {description && (
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{description}</p>
      )}
      <div className="mt-10 space-y-5">{children}</div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block border-b border-border/80 pb-3 focus-within:border-foreground/60">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">
        {label}
      </div>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/50"
      />
    </label>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-4 inline-flex items-center justify-center rounded-md bg-foreground px-5 py-3 text-[13.5px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {children}
    </button>
  );
}