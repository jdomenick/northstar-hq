import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/page-header";
import { useOrg } from "@/lib/org-context";
import { useCreateVenture, useVentures } from "@/lib/data-hooks";

export const Route = createFileRoute("/_authenticated/ventures")({
  component: VenturesLayout,
  head: () => ({
    meta: [
      { title: "Ventures — Northstar" },
      { name: "description", content: "Every venture you run, in one calm view." },
    ],
  }),
});

function VenturesLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/ventures") return <Outlet />;
  return <VenturesIndex />;
}

function VenturesIndex() {
  const { activeOrgId, activeMembership } = useOrg();
  const { data, isLoading, error } = useVentures(activeOrgId);
  const [showNew, setShowNew] = useState(false);
  const canCreate = activeMembership && activeMembership.role !== "viewer";

  const ventures = data ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Ventures"
        title="Every venture, in one view."
        description="One operating system across every organization you run."
        actions={
          canCreate && (
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-2 text-[12.5px] font-medium text-background hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> New venture
            </button>
          )
        }
      />
      <PageBody>
        {error ? (
          <ErrorLine message={(error as Error).message} />
        ) : isLoading ? (
          <Skeleton />
        ) : ventures.length === 0 ? (
          <EmptyState onCreate={canCreate ? () => setShowNew(true) : undefined} />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {ventures.map((v) => (
              <Link
                key={v.id}
                to="/ventures/$id"
                params={{ id: v.id }}
                className="group relative overflow-hidden rounded-2xl bg-card/40 p-7 transition-all hover:-translate-y-0.5 hover:bg-card/70"
              >
                <div className="absolute left-0 top-6 h-8 w-[2px] rounded-r-full bg-foreground/60 transition-all duration-300 group-hover:h-14" />
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
                      {v.status.replaceAll("_", " ")}
                    </div>
                    <h3 className="mt-3 font-display text-[26px] leading-tight text-foreground">
                      {v.name}
                    </h3>
                    {v.description && (
                      <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                        {v.description}
                      </p>
                    )}
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                </div>
                {v.current_focus && (
                  <div className="mt-6 border-t border-border/60 pt-4 text-[12.5px] text-muted-foreground/90">
                    {v.current_focus}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </PageBody>

      {showNew && (
        <NewVentureModal onClose={() => setShowNew(false)} orgId={activeOrgId} />
      )}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="mt-16 rounded-2xl px-6 py-20 text-center">
      <div className="mx-auto max-w-sm">
        <div className="mx-auto h-10 w-10 rounded-full bg-secondary/50" />
        <h3 className="mt-6 font-display text-2xl text-foreground">No ventures yet</h3>
        <p className="mt-2 text-[13.5px] text-muted-foreground">
          Add your first venture — a business, project portfolio, or initiative.
        </p>
        {onCreate && (
          <button
            onClick={onCreate}
            className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-[12.5px] font-medium text-background hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> New venture
          </button>
        )}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-2xl bg-card/30" />
      ))}
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <div className="rounded-2xl bg-secondary/40 p-6 text-[13.5px] text-muted-foreground">
      {message}
    </div>
  );
}

function NewVentureModal({
  onClose,
  orgId,
}: {
  onClose: () => void;
  orgId: string | null;
}) {
  const create = useCreateVenture(orgId);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [currentFocus, setCurrentFocus] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const v = await create.mutateAsync({
        name,
        description: description || undefined,
        website_url: website || undefined,
        current_focus: currentFocus || undefined,
      });
      toast.success("Venture created");
      onClose();
      navigate({ to: "/ventures/$id", params: { id: v.id } });
    } catch (err: any) {
      toast.error(err.message ?? "Could not create venture");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-lg rounded-2xl bg-card p-8 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="font-display text-[24px] text-foreground">New venture</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Just the essentials. You can complete the rest later.
        </p>
        <div className="mt-6 space-y-5">
          <Field label="Name">
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent text-[15px] text-foreground outline-none"
            />
          </Field>
          <Field label="Description">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-transparent text-[15px] text-foreground outline-none"
            />
          </Field>
          <Field label="Website">
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
              className="w-full bg-transparent text-[15px] text-foreground outline-none"
            />
          </Field>
          <Field label="Current focus">
            <input
              value={currentFocus}
              onChange={(e) => setCurrentFocus(e.target.value)}
              className="w-full bg-transparent text-[15px] text-foreground outline-none"
            />
          </Field>
        </div>
        <div className="mt-8 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3.5 py-2 text-[12.5px] text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name || create.isPending}
            className="rounded-md bg-foreground px-4 py-2 text-[12.5px] font-medium text-background hover:opacity-90 disabled:opacity-60"
          >
            {create.isPending ? "…" : "Create venture"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block border-b border-border/60 pb-3 focus-within:border-foreground/60">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">
        {label}
      </div>
      {children}
    </label>
  );
}