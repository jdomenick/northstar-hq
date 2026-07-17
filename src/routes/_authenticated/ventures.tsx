import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/page-header";
import {
  EmptyEditorialState,
  EditorialSkeleton,
  ErrorLine as EditorialErrorLine,
  Ledger,
  LedgerRow,
  StatusLine,
  type StatusTone,
} from "@/components/editorial";
import { useOrg } from "@/lib/org-context";
import { useCreateVenture, useVentures } from "@/lib/data-hooks";

function toneForStatus(status: string): StatusTone {
  if (status === "active" || status === "growing") return "positive";
  if (status === "at_risk" || status === "blocked") return "attention";
  if (status === "archived" || status === "closed") return "muted";
  if (status === "paused") return "muted";
  return "neutral";
}

export const Route = createFileRoute("/_authenticated/ventures")({
  component: VenturesLayout,
  head: () => ({
    meta: [
      { title: "Ventures  -  Northstar" },
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
        title="The venture index"
        description="Every business you run, in a single scannable register. Open a venture to see its own operating book."
        actions={
          canCreate && (
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-1.5 bg-foreground px-3.5 py-2 text-[11.5px] font-medium uppercase tracking-[0.16em] text-background hover:bg-foreground/85"
            >
              <Plus className="h-3.5 w-3.5" /> New venture
            </button>
          )
        }
      />
      <PageBody>
        {error ? (
          <EditorialErrorLine message={(error as Error).message} />
        ) : isLoading ? (
          <EditorialSkeleton rows={4} />
        ) : ventures.length === 0 ? (
          <EmptyEditorialState
            eyebrow="No ventures yet"
            title="Start with the first business you run."
            description="A venture is any business, initiative, or portfolio you operate. You can add more later."
            action={
              canCreate && (
                <button
                  onClick={() => setShowNew(true)}
                  className="inline-flex items-center gap-1.5 bg-foreground px-4 py-2 text-[11.5px] font-medium uppercase tracking-[0.16em] text-background hover:bg-foreground/85"
                >
                  <Plus className="h-3.5 w-3.5" /> New venture
                </button>
              )
            }
          />
        ) : (
          <Ledger>
            {ventures.map((v) => (
              <LedgerRow
                key={v.id}
                eyebrow={<span className="text-foreground/55">Venture</span>}
                title={
                  <Link
                    to="/ventures/$id"
                    params={{ id: v.id }}
                    className="font-display text-[22px] leading-[1.15] text-foreground hover:italic md:text-[26px]"
                  >
                    {v.name}
                  </Link>
                }
                meta={v.description || v.current_focus || undefined}
                status={
                  <StatusLine tone={toneForStatus(v.status)}>
                    {v.status.replaceAll("_", " ")}
                  </StatusLine>
                }
              />
            ))}
          </Ledger>
        )}
      </PageBody>

      {showNew && (
        <NewVentureModal onClose={() => setShowNew(false)} orgId={activeOrgId} />
      )}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-lg border border-foreground/15 bg-card p-8 shadow-[0_20px_60px_-20px_oklch(0.14_0_0/0.35)]"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-foreground/50 hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-foreground/60">
          New venture
        </div>
        <h2 className="mt-2 font-display text-[30px] leading-[1.1] text-foreground">Open a new book.</h2>
        <p className="mt-2 text-[13.5px] text-foreground/65">
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
            className="px-3.5 py-2 text-[11.5px] uppercase tracking-[0.18em] text-foreground/60 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name || create.isPending}
            className="bg-foreground px-4 py-2 text-[11.5px] font-medium uppercase tracking-[0.16em] text-background hover:bg-foreground/85 disabled:opacity-50"
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
    <label className="block border-b border-foreground/20 pb-3 focus-within:border-foreground">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/60">
        {label}
      </div>
      {children}
    </label>
  );
}