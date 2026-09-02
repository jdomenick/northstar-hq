import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getClientDocumentUrlFn,
  getClientWorkspaceFn,
  registerClientUploadFn,
} from "@/lib/client-workspace/workspace.functions";
import type { ClientWorkspaceData } from "@/lib/client-workspace/types";
import { useClientPreview } from "@/lib/client-preview/context";
import {
  getClientPreviewDeliveryFn,
  getClientPreviewReportFn,
  getClientPreviewWorkspaceFn,
} from "@/lib/client-preview/preview.functions";
import { getClientDeliveryFn } from "@/lib/delivery/delivery.functions";
import type { ClientDeliveryView } from "@/lib/delivery/client-delivery";
import { getClientExecutiveReportFn } from "@/lib/reporting/reporting.functions";
import type { ClientExecutiveReportView } from "@/lib/reporting/types";

export const WORKSPACE_QUERY_KEY = ["client-workspace"] as const;
export const DELIVERY_QUERY_KEY = ["client-delivery"] as const;
export const REPORT_QUERY_KEY = ["client-executive-report"] as const;

/** In preview mode every client write control is disabled. */
export function useReadOnlyPreview(): boolean {
  return useClientPreview() !== null;
}

export function useClientWorkspace() {
  const preview = useClientPreview();
  const load = useServerFn(getClientWorkspaceFn);
  const loadPreview = useServerFn(getClientPreviewWorkspaceFn);
  return useQuery<ClientWorkspaceData>({
    queryKey: preview ? [...WORKSPACE_QUERY_KEY, "preview", preview.clientId] : WORKSPACE_QUERY_KEY,
    queryFn: () =>
      preview
        ? loadPreview({
            data: { organizationId: preview.organizationId, clientId: preview.clientId },
          })
        : load(),
    retry: false,
  });
}

export function useClientDelivery() {
  const preview = useClientPreview();
  const load = useServerFn(getClientDeliveryFn);
  const loadPreview = useServerFn(getClientPreviewDeliveryFn);
  return useQuery<ClientDeliveryView>({
    queryKey: preview ? [...DELIVERY_QUERY_KEY, "preview", preview.clientId] : DELIVERY_QUERY_KEY,
    queryFn: () =>
      preview
        ? loadPreview({
            data: { organizationId: preview.organizationId, clientId: preview.clientId },
          })
        : load(),
    retry: false,
  });
}

export function useClientExecutiveReport() {
  const preview = useClientPreview();
  const load = useServerFn(getClientExecutiveReportFn);
  const loadPreview = useServerFn(getClientPreviewReportFn);
  return useQuery<ClientExecutiveReportView>({
    queryKey: preview ? [...REPORT_QUERY_KEY, "preview", preview.clientId] : REPORT_QUERY_KEY,
    queryFn: () =>
      preview
        ? loadPreview({
            data: { organizationId: preview.organizationId, clientId: preview.clientId },
          })
        : load(),
    retry: false,
  });
}


export function PageHeading({ label, title, lead }: { label: string; title: string; lead?: string }) {
  return (
    <header>
      <div className="text-[10px] font-medium uppercase tracking-[0.26em] text-foreground/55">
        {label}
      </div>
      <h1 className="mt-3 font-display text-[32px] leading-[1.08] text-foreground">{title}</h1>
      {lead ? <p className="mt-3 text-[14px] leading-[1.7] text-foreground/70">{lead}</p> : null}
    </header>
  );
}

export function Pill({ tone, children }: { tone: "neutral" | "ok" | "warn" | "danger"; children: ReactNode }) {
  const cls =
    tone === "ok"
      ? "border-[hsl(var(--brand-ok))]/45 text-[hsl(var(--brand-ok))]"
      : tone === "warn"
        ? "border-foreground/35 text-foreground"
        : tone === "danger"
          ? "border-destructive/50 text-destructive"
          : "border-foreground/20 text-foreground/60";
  return (
    <span
      className={`inline-flex shrink-0 items-center border px-2 py-[3px] text-[10px] uppercase tracking-[0.16em] ${cls}`}
    >
      {children}
    </span>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return <div className="border border-foreground/12 bg-background p-5">{children}</div>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="border border-dashed border-foreground/18 p-8 text-center">
      <div className="text-[14px] text-foreground">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-[12.5px] leading-[1.7] text-foreground/60">{detail}</p>
    </div>
  );
}

export function WorkspaceError({ message }: { message: string }) {
  return (
    <div className="border border-destructive/40 bg-destructive/5 p-5 text-[13px] text-foreground">
      {message}
    </div>
  );
}

export function LoadingRows() {
  return (
    <div className="space-y-2" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse border border-foreground/10 bg-foreground/[0.03]" />
      ))}
    </div>
  );
}

export function formatDate(value: string | null): string {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Uploads to the client's own storage prefix, then records the document row. */
export function UploadButton({
  storagePrefix,
  documentId,
  onboardingItemId,
  title,
  label = "Upload file",
}: {
  storagePrefix: string;
  documentId?: string | null;
  onboardingItemId?: string | null;
  title: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const register = useServerFn(registerClientUploadFn);
  const queryClient = useQueryClient();

  async function handleFile(file: File) {
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Files must be 25 MB or smaller.");
      return;
    }
    setBusy(true);
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
    const path = `${storagePrefix}/${crypto.randomUUID()}-${safeName}`;
    const upload = await supabase.storage.from("client-documents").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upload.error) {
      setBusy(false);
      toast.error("Upload failed. Please try again.");
      return;
    }
    try {
      await register({
        data: {
          documentId: documentId ?? null,
          onboardingItemId: onboardingItemId ?? null,
          title,
          storagePath: path,
          fileName: file.name.slice(0, 255),
          fileSize: file.size,
          fileType: file.type || "application/octet-stream",
        },
      });
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEY });
      toast.success("File uploaded. NorthStar Labs will review it.");
    } catch {
      toast.error("We could not record that upload. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="border border-foreground/25 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-foreground transition hover:bg-foreground hover:text-background disabled:opacity-50"
      >
        {busy ? "Uploading" : label}
      </button>
    </>
  );
}

export function DownloadLink({ documentId, children }: { documentId: string; children: ReactNode }) {
  const getUrl = useServerFn(getClientDocumentUrlFn);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { url } = await getUrl({ data: { documentId } });
          window.open(url, "_blank", "noopener,noreferrer");
        } catch {
          toast.error("That file is not available right now.");
        } finally {
          setBusy(false);
        }
      }}
      className="text-[12px] underline underline-offset-4 text-foreground/75 hover:text-foreground disabled:opacity-50"
    >
      {children}
    </button>
  );
}