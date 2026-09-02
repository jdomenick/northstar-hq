import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ClientWorkspace } from "@/components/client-shell";
import { updateMyClientProfileFn } from "@/lib/client-identity/identity.functions";
import type { PreferredContactMethod } from "@/lib/client-identity/types";

export function ProfileForm({
  initial,
  email,
}: {
  initial: {
    first_name: string;
    last_name: string;
    phone: string;
    preferred_contact_method: PreferredContactMethod;
  };
  email: string;
}) {
  const update = useServerFn(updateMyClientProfileFn);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await update({
        data: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          phone: form.phone.trim() ? form.phone.trim() : null,
          preferred_contact_method: form.preferred_contact_method,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["client-context"] });
      toast.success("Profile updated");
    } catch {
      toast.error("We could not save your profile. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.26em] text-foreground/55">
        Your profile
      </div>
      <h1 className="mt-3 font-display text-[34px] leading-[1.08] text-foreground">
        Contact details
      </h1>
      <p className="mt-3 text-[13.5px] text-foreground/65">
        Your email ({email}) is managed by NorthStar Labs and cannot be changed here.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <Field label="First name">
          <input
            required
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            className="w-full bg-transparent text-[15px] text-foreground outline-none"
          />
        </Field>
        <Field label="Last name">
          <input
            required
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            className="w-full bg-transparent text-[15px] text-foreground outline-none"
          />
        </Field>
        <Field label="Phone">
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full bg-transparent text-[15px] text-foreground outline-none"
          />
        </Field>
        <Field label="Preferred contact method">
          <select
            value={form.preferred_contact_method}
            onChange={(e) =>
              setForm({
                ...form,
                preferred_contact_method: e.target.value as PreferredContactMethod,
              })
            }
            className="w-full bg-transparent text-[15px] text-foreground outline-none"
          >
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="sms">Text message</option>
          </select>
        </Field>
        <button
          type="submit"
          disabled={busy}
          className="bg-foreground px-5 py-3 text-[11.5px] font-medium uppercase tracking-[0.18em] text-background hover:bg-foreground/85 disabled:opacity-50"
        >
          {busy ? "Saving" : "Save changes"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block border-b border-foreground/20 pb-3 focus-within:border-foreground">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/60">
        {label}
      </div>
      {children}
    </label>
  );
}