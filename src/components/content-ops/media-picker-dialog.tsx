// Content Operations - unified media picker. Replaces the legacy
// window.prompt entry with a real Paper & Ink dialog that supports:
//   * drag / drop / paste / file-picker upload with progress
//   * browsing the venture's existing asset library
//   * per-platform validation warnings on the chosen asset
// All uploads flow through the shared media pipeline server functions.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery as useQ } from "@tanstack/react-query";
import { useServerFn as useSFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { QuietPanel, SectionLabel } from "@/components/editorial";
import { cn } from "@/lib/utils";
import { UploadCloud, X, Image as ImageIcon, Film, FileText, Search } from "lucide-react";
import {
  createMediaUpload, finalizeMediaUpload, markMediaUploadFailed,
  listVentureMedia, createMediaPreviewUrl,
} from "@/lib/content-ops/media.functions";
import {
  validateMediaForPlatform,
  type MediaAssetLike, type MediaFinding,
} from "@/lib/content-ops/media-validation";
import type { EditorPlatform } from "@/lib/content-ops/platform-registry";

// Public shape returned to the caller when the user picks an asset.
export interface PickedMedia {
  assetId: string;
  storageRef: string;    // storage_path in the shared bucket
  mimeType: string;
  altText: string | null;
  displayName: string | null;
  widthPx: number | null;
  heightPx: number | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  aspect: string | null;
}

type Tab = "upload" | "library";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (picked: PickedMedia) => void;
  organizationId: string;
  ventureId: string;
  campaignId?: string | null;
  platform: EditorPlatform;
  disabled?: boolean;
}

function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) return resolve(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { const r = { width: img.naturalWidth, height: img.naturalHeight }; URL.revokeObjectURL(url); resolve(r); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function readVideoMeta(file: File): Promise<{ width: number; height: number; duration: number } | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("video/")) return resolve(null);
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const r = { width: v.videoWidth, height: v.videoHeight, duration: v.duration };
      URL.revokeObjectURL(url); resolve(r);
    };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    v.src = url;
  });
}

function pickMediaTypeForMime(mime: string): "image" | "video" | "document" | "audio" | "other" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "document";
  return "other";
}

async function sha256(file: File): Promise<string | undefined> {
  try {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return undefined;
  }
}

export function MediaPickerDialog(props: Props) {
  const { open, onClose, onPick, organizationId, ventureId, campaignId, platform, disabled } = props;
  const [tab, setTab] = useState<Tab>("upload");
  const [search, setSearch] = useState("");

  useEffect(() => { if (open) { setTab("upload"); setSearch(""); } }, [open]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-foreground/15 bg-background shadow-lg">
        <header className="sticky top-0 z-10 flex items-baseline justify-between gap-4 border-b border-foreground/10 bg-background/95 px-6 py-4">
          <div>
            <h2 className="font-display text-[22px] leading-tight">Attach media</h2>
            <p className="mt-1 text-[11.5px] uppercase tracking-[0.22em] text-foreground/55">
              {platform.replace(/_/g, " ")}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-foreground/60 hover:text-foreground" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="px-6 pt-4">
          <div className="flex gap-1 border-b border-foreground/10 text-[11.5px] uppercase tracking-[0.22em]">
            {(["upload","library"] as const).map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={cn("px-4 py-2 -mb-px border-b-2",
                  tab === t ? "border-foreground text-foreground" : "border-transparent text-foreground/55 hover:text-foreground/80")}>
                {t === "upload" ? "Upload new" : "Venture library"}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-6">
          {tab === "upload"
            ? <UploadTab organizationId={organizationId} ventureId={ventureId} campaignId={campaignId ?? null}
                platform={platform} disabled={disabled} onPick={(m) => { onPick(m); onClose(); }} />
            : <LibraryTab organizationId={organizationId} ventureId={ventureId} platform={platform}
                search={search} onSearchChange={setSearch}
                onPick={(m) => { onPick(m); onClose(); }} />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload tab
// ---------------------------------------------------------------------------

function UploadTab({
  organizationId, ventureId, campaignId, platform, disabled, onPick,
}: {
  organizationId: string; ventureId: string; campaignId: string | null;
  platform: EditorPlatform; disabled?: boolean;
  onPick: (m: PickedMedia) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [findings, setFindings] = useState<MediaFinding[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const createUpload = useSFn(createMediaUpload);
  const finalize = useSFn(finalizeMediaUpload);
  const failUpload = useSFn(markMediaUploadFailed);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onFile = useCallback(async (f: File) => {
    setError(null); setProgress(0); setFile(f);
    // Preflight validation before uploading a byte.
    const [imgMeta, vidMeta] = await Promise.all([readImageDimensions(f), readVideoMeta(f)]);
    const mediaLike: MediaAssetLike = {
      id: "pending",
      mediaType: pickMediaTypeForMime(f.type),
      status: "uploaded",
      archived: false,
      mimeType: f.type || null,
      fileSizeBytes: f.size,
      widthPx: imgMeta?.width ?? vidMeta?.width ?? null,
      heightPx: imgMeta?.height ?? vidMeta?.height ?? null,
      durationSeconds: vidMeta?.duration ?? null,
      altText: null,
    };
    setFindings(validateMediaForPlatform(platform, [mediaLike]).findings);
  }, [platform]);

  const onPaste = useCallback((e: ClipboardEvent) => {
    const item = Array.from(e.clipboardData?.items ?? []).find(i => i.kind === "file");
    const f = item?.getAsFile();
    if (f) void onFile(f);
  }, [onFile]);
  useEffect(() => {
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [onPaste]);

  const doUpload = async () => {
    if (!file || uploading) return;
    setUploading(true); setError(null); setProgress(0);
    let assetId: string | null = null;
    let storagePath: string | null = null;
    try {
      const [imgMeta, vidMeta, checksum] = await Promise.all([
        readImageDimensions(file), readVideoMeta(file), sha256(file),
      ]);

      const created = await createUpload({ data: {
        organizationId, ventureId, campaignId,
        mediaType: pickMediaTypeForMime(file.type),
        source: "upload",
        mimeType: file.type || null,
        originalFilename: file.name,
        fileSizeBytes: file.size,
        displayName: file.name,
      }});
      assetId = created.assetId;
      storagePath = created.storagePath;
      setProgress(15);

      // Direct upload via the org-scoped bucket (RLS gates by organization_id folder).
      const { error: upErr } = await supabase.storage
        .from(created.bucket)
        .upload(created.storagePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: true,
        });
      if (upErr) throw new Error(upErr.message);
      setProgress(80);

      const width = imgMeta?.width ?? vidMeta?.width;
      const height = imgMeta?.height ?? vidMeta?.height;
      const finalized = await finalize({ data: {
        organizationId, assetId,
        mimeType: file.type || undefined,
        fileSizeBytes: file.size,
        widthPx: width, heightPx: height,
        durationSeconds: vidMeta?.duration,
        checksumSha256: checksum,
      }});
      setProgress(100);

      onPick({
        assetId: finalized.id,
        storageRef: finalized.storage_path ?? storagePath,
        mimeType: finalized.mime_type ?? file.type,
        altText: finalized.alt_text ?? null,
        displayName: finalized.display_name ?? file.name,
        widthPx: finalized.width_px ?? width ?? null,
        heightPx: finalized.height_px ?? height ?? null,
        durationSeconds: finalized.duration_seconds ?? vidMeta?.duration ?? null,
        fileSizeBytes: finalized.file_size_bytes ?? file.size,
        aspect: finalized.aspect_ratio ?? null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      if (assetId) { try { await failUpload({ data: { organizationId, assetId, errorMessage: msg } }); } catch { /* ignore */ } }
    } finally {
      setUploading(false);
    }
  };

  const hasErrors = findings.some(f => f.severity === "error");

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) void onFile(f); }}
        className={cn("flex flex-col items-center justify-center border border-dashed p-8 text-center transition-colors",
          dragOver ? "border-foreground/60 bg-foreground/5" : "border-foreground/20")}
      >
        <UploadCloud className="h-8 w-8 text-foreground/50" />
        <div className="mt-3 font-display text-[16px] leading-tight">Drop a file, paste, or choose one</div>
        <div className="mt-1 text-[11.5px] text-foreground/55">Images, video, audio, or PDF up to 500 MB.</div>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || uploading}
          className="mt-4 border border-foreground/30 px-4 py-2 text-[11.5px] uppercase tracking-[0.22em] hover:border-foreground disabled:opacity-40">
          Choose file
        </button>
        <input ref={inputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />
      </div>

      {file && (
        <QuietPanel className="!p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center border border-foreground/10 bg-foreground/5">
              {previewUrl && file.type.startsWith("image/") ? <img src={previewUrl} alt="" className="max-h-full max-w-full object-contain" />
                : file.type.startsWith("video/") ? <Film className="h-6 w-6 text-foreground/60" />
                : <FileText className="h-6 w-6 text-foreground/60" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[15px] leading-tight">{file.name}</div>
              <div className="mt-1 text-[11.5px] uppercase tracking-[0.22em] text-foreground/55">
                {(file.size / 1024).toFixed(1)} KB - {file.type || "unknown"}
              </div>
              {findings.length > 0 && (
                <ul className="mt-3 space-y-1 text-[12px]">
                  {findings.map((f, i) => (
                    <li key={i} className={f.severity === "error" ? "text-[oklch(0.5_0.18_27)]" : "text-[oklch(0.55_0.14_65)]"}>
                      {f.severity === "error" ? "Error:" : "Warning:"} {f.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {uploading && (
            <div className="mt-4 h-1 w-full bg-foreground/10">
              <div className="h-full bg-foreground transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          {error && <div className="mt-3 text-[12px] text-[oklch(0.5_0.18_27)]">{error}</div>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => { setFile(null); setFindings([]); setError(null); }} disabled={uploading}
              className="border border-foreground/20 px-4 py-2 text-[11.5px] uppercase tracking-[0.22em] hover:border-foreground/60 disabled:opacity-40">
              Clear
            </button>
            <button type="button" onClick={doUpload} disabled={uploading || disabled || hasErrors}
              className="bg-foreground px-4 py-2 text-[11.5px] uppercase tracking-[0.22em] text-background hover:bg-foreground/85 disabled:opacity-40">
              {uploading ? "Uploading..." : hasErrors ? "Fix errors" : "Upload and attach"}
            </button>
          </div>
        </QuietPanel>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Library tab
// ---------------------------------------------------------------------------

function LibraryTab({
  organizationId, ventureId, platform, search, onSearchChange, onPick,
}: {
  organizationId: string; ventureId: string; platform: EditorPlatform;
  search: string; onSearchChange: (v: string) => void;
  onPick: (m: PickedMedia) => void;
}) {
  const listFn = useSFn(listVentureMedia);
  const previewFn = useSFn(createMediaPreviewUrl);

  const q = useQ({
    queryKey: ["content-ops", "media-library", organizationId, ventureId, search],
    queryFn: () => listFn({ data: {
      organizationId, ventureId,
      search: search.trim() || undefined,
      status: "uploaded", archived: false,
      sort: "recent", limit: 60, offset: 0,
    }}),
  });

  return (
    <div className="space-y-4">
      <label className="relative flex items-center border border-foreground/15 focus-within:border-foreground/50">
        <Search className="mx-2 h-4 w-4 text-foreground/50" />
        <input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search by name, caption, alt text"
          className="flex-1 bg-transparent px-1 py-2 text-[13px] focus:outline-none" />
      </label>

      {q.isLoading ? <div className="py-8 text-center text-[12.5px] text-foreground/55">Loading library...</div>
       : q.isError ? <div className="py-8 text-center text-[12.5px] text-[oklch(0.5_0.18_27)]">Could not load library.</div>
       : (q.data?.rows.length ?? 0) === 0 ? <div className="py-8 text-center text-[12.5px] text-foreground/55">No assets yet. Upload one on the other tab.</div>
       : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {q.data!.rows.map((row) => (
              <li key={row.id}>
                <LibraryTile row={row} platform={platform} previewFn={previewFn}
                  organizationId={organizationId}
                  onPick={onPick} />
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

function LibraryTile({
  row, platform, previewFn, organizationId, onPick,
}: {
  row: any;
  platform: EditorPlatform;
  previewFn: (args: { data: { organizationId: string; assetId: string } }) => Promise<{ url: string; expiresIn: number }>;
  organizationId: string;
  onPick: (m: PickedMedia) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (row.mime_type?.startsWith("image/")) {
      previewFn({ data: { organizationId, assetId: row.id } })
        .then(({ url }) => { if (alive) setPreview(url); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [row.id, row.mime_type, organizationId, previewFn]);

  const mediaLike: MediaAssetLike = {
    id: row.id,
    mediaType: row.media_type,
    status: row.status,
    archived: !!row.archived,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    widthPx: row.width_px,
    heightPx: row.height_px,
    durationSeconds: row.duration_seconds,
    altText: row.alt_text,
  };
  const result = validateMediaForPlatform(platform, [mediaLike]);
  const findings = result.findings;
  const hasError = result.errors.length > 0;

  return (
    <button type="button"
      onClick={() => onPick({
        assetId: row.id, storageRef: row.storage_path,
        mimeType: row.mime_type, altText: row.alt_text, displayName: row.display_name,
        widthPx: row.width_px, heightPx: row.height_px, durationSeconds: row.duration_seconds,
        fileSizeBytes: row.file_size_bytes, aspect: row.aspect_ratio,
      })}
      className={cn("group block w-full border text-left transition-colors",
        hasError ? "border-[oklch(0.5_0.18_27)]/40" : "border-foreground/15 hover:border-foreground/50")}>
      <div className="aspect-square w-full overflow-hidden bg-foreground/5">
        {preview ? <img src={preview} alt={row.alt_text ?? row.display_name ?? ""} className="h-full w-full object-cover" />
          : row.mime_type?.startsWith("video/") ? <div className="flex h-full items-center justify-center"><Film className="h-6 w-6 text-foreground/40" /></div>
          : row.mime_type?.startsWith("image/") ? <div className="flex h-full items-center justify-center"><ImageIcon className="h-6 w-6 text-foreground/40" /></div>
          : <div className="flex h-full items-center justify-center"><FileText className="h-6 w-6 text-foreground/40" /></div>}
      </div>
      <div className="px-3 py-2">
        <div className="truncate text-[12.5px] text-foreground">{row.display_name ?? row.original_filename ?? "Untitled"}</div>
        <div className="mt-0.5 text-[10.5px] uppercase tracking-[0.2em] text-foreground/50">
          {row.mime_type ?? "unknown"} {row.width_px && row.height_px ? ` - ${row.width_px}x${row.height_px}` : ""}
        </div>
        {findings.length > 0 && (
          <div className={cn("mt-1 text-[10.5px]", hasError ? "text-[oklch(0.5_0.18_27)]" : "text-[oklch(0.55_0.14_65)]")}>
            {findings[0].message}
          </div>
        )}
      </div>
    </button>
  );
}
