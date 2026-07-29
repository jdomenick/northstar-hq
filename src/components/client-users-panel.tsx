import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  inviteClientUserFn,
  listClientIdentityFn,
  removeClientAccountFn,
  resendClientInvitationFn,
  revokeClientInvitationFn,
  setClientAccountStatusFn,
} from "@/lib/client-identity/identity.functions";
import { roleLabel, type ClientRole } from "@/lib/client-identity/types";

function originOf(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

export function ClientUsersPanel({
  organizationId,
  clientId,
}: {
  organizationId: string;
  clientId: string;
}) {
  const list = useServerFn(listClientIdentityFn);
  const invite = useServerFn(inviteClientUserFn);
  const resend = useServerFn(resendClientInvitationFn);
  const revoke = useServerFn(revokeClientInvitationFn);
  const setStatus = useServerFn(setClientAccountStatusFn);
  const remove = useServerFn(removeClientAccountFn);
  const qc = useQueryClient();
  const key = ["client-identity", organizationId, clientId];

  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => list({ data: { organizationId, clientId } }),
    retry: false,
  });

  const [link, setLink] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "client_user" as ClientRole,
  });

  const inviteMut = useMutation({
    mutationFn: () =>
      invite({ data: { organizationId, clientId, ...form, origin: originOf() } }),
    onSuccess: (r) => {
      setLink(r.link);
      setForm({ firstName: "", lastName: "", email: "", role: "client_user" });
      toast.success("Invitation created. Copy the link and send it to your client.");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: () => toast.error("Could not create that invitation."),
  });

  const act = (fn: () => Promise<unknown>, ok: string) => async () => {
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: key });
    } catch {
      toast.error("That action did not complete.");
    }
  };

  if (error) {
    return (
      <p className="py-6 text-[13px] text-foreground/65">
        You need admin access to manage client users.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
          People with access
        </h3>
        {isLoading ? (
          <p className="py-4 text-[13px] text-foreground/55">Loading</p>
        ) : (data?.accounts.length ?? 0) === 0 ? (
          <p className="py-4 text-[13px] italic text-foreground/55">
            No one from this company has an account yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {data!.accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <div className="text-[14px]">
                    {a.first_name} {a.last_name}
                  </div>
                  <div className="text-[11.5px] text-foreground/60">{a.email}</div>
                  <div className="mt-1 text-[11px] text-foreground/50">
                    {a.last_login_at
                      ? `Last signed in ${new Date(a.last_login_at).toLocaleString()}`
                      : "Never signed in"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {roleLabel(a.role)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {a.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={act(
                      () =>
                        setStatus({
                          data: {
                            organizationId,
                            accountId: a.id,
                            status: a.status === "active" ? "deactivated" : "active",
                          },
                        }),
                      a.status === "active" ? "Access deactivated" : "Access restored",
                    )}
                  >
                    {a.status === "active" ? "Deactivate" : "Reactivate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={act(
                      () => remove({ data: { organizationId, accountId: a.id } }),
                      "Account removed",
                    )}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
          Invitations
        </h3>
        {(data?.invitations.length ?? 0) === 0 ? (
          <p className="py-4 text-[13px] italic text-foreground/55">No invitations sent.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {data!.invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <div className="text-[14px]">
                    {i.first_name} {i.last_name}
                  </div>
                  <div className="text-[11.5px] text-foreground/60">{i.email}</div>
                  <div className="mt-1 text-[11px] text-foreground/50">
                    Expires {new Date(i.expires_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {i.state}
                  </Badge>
                  {i.state !== "accepted" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            const r = await resend({
                              data: { organizationId, invitationId: i.id, origin: originOf() },
                            });
                            setLink(r.link);
                            toast.success("New link created. The previous link no longer works.");
                            await qc.invalidateQueries({ queryKey: key });
                          } catch {
                            toast.error("Could not create a new link.");
                          }
                        }}
                      >
                        New link
                      </Button>
                      {i.state === "pending" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={act(
                            () => revoke({ data: { organizationId, invitationId: i.id } }),
                            "Invitation revoked",
                          )}
                        >
                          Revoke
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {link && (
        <div className="border border-foreground/15 bg-foreground/[0.03] p-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
            Invitation link (shown once)
          </div>
          <code className="mt-2 block break-all text-[12px] text-foreground">{link}</code>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success("Link copied");
            }}
          >
            Copy link
          </Button>
        </div>
      )}

      <section>
        <h3 className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
          Invite someone
        </h3>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            inviteMut.mutate();
          }}
        >
          <input
            required
            placeholder="First name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className="border-b border-foreground/20 bg-transparent py-2 text-[14px] outline-none focus:border-foreground"
          />
          <input
            required
            placeholder="Last name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            className="border-b border-foreground/20 bg-transparent py-2 text-[14px] outline-none focus:border-foreground"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="border-b border-foreground/20 bg-transparent py-2 text-[14px] outline-none focus:border-foreground"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as ClientRole })}
            className="border-b border-foreground/20 bg-transparent py-2 text-[14px] outline-none focus:border-foreground"
          >
            <option value="client_user">Client user</option>
            <option value="client_admin">Client admin</option>
          </select>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={inviteMut.isPending}>
              {inviteMut.isPending ? "Creating" : "Create invitation"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}