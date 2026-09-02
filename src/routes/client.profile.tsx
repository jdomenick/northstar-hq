import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ClientWorkspace } from "@/components/client-shell";
import { updateMyClientProfileFn } from "@/lib/client-identity/identity.functions";
import type { PreferredContactMethod } from "@/lib/client-identity/types";
import { ProfileForm } from "@/components/client-pages/profile";

export const Route = createFileRoute("/client/profile")({
  ssr: false,
  component: ClientProfilePage,
  head: () => ({
    meta: [
      { title: "Your profile  -  NorthStar Labs" },
      { name: "description", content: "Update your contact details for your NorthStar Labs engagement." },
      { property: "og:title", content: "Your profile  -  NorthStar Labs" },
      { property: "og:description", content: "Update your contact details for your NorthStar Labs engagement." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ClientProfilePage() {
  return (
    <ClientWorkspace>
      {(ctx) => (
        <ProfileForm
          initial={{
            first_name: ctx.account.first_name,
            last_name: ctx.account.last_name,
            phone: ctx.account.phone ?? "",
            preferred_contact_method: ctx.account.preferred_contact_method,
          }}
          email={ctx.account.email}
        />
      )}
    </ClientWorkspace>
  );
}
