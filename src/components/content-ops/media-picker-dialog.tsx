// Content Operations - unified media picker (S1f-2a).
//
// Backed by the unified asset library (listLibraryAssets). Supports:
//   * Upload tab: drag/drop/paste/file-picker with progress + preflight validation
//   * Library tab: folder tree, unified search, view chips
//     (all / recent / favorites / unused / archived), tag & campaign filter,
//     single or multi select, infinite scroll, preview, attachment ordering
//
// The legacy listVentureMedia path is no longer used by the picker.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery as useQ } from "@tanstack/react-query";
import { useServerFn as useSFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { QuietPanel, SectionLabel } from "@/components/editorial";
import { cn } from "@/lib/utils";
import {
  UploadCloud, X, Image as ImageIcon, Film, FileText, Search,
  Folder, Star, GripVertical, ChevronRight, ChevronDown,
} from "lucide-react";
import {
  createMediaUpload, finalizeMediaUpload, markMediaUploadFailed,
  createMediaPreviewUrl,
} from "@/lib/content-ops/media.functions";
import {
  listLibraryAssets, listAssetFolders, listAssetFavorites,
} from "@/lib/content-ops/asset-library.functions";
import {
  validateMediaForPlatform,
  type MediaAssetLike, type MediaFinding,
} from "@/lib/content-ops/media-validation";
import type { EditorPlatform } from "@/lib/content-ops/platform-registry";
import type { FolderNode } from "@/lib/content-ops/asset-library";

export interface PickedMedia {
  assetId: string;
  storageRef: string;
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
type LibView = "all" | "recent" | "favorites" | "unused" | "archived";
const PAGE_SIZE = 40;

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (picked: PickedMedia) => void;
  /** Optional multi-select. onPickMany fires with ordered picks on Confirm. */
  onPickMany?: (picked: PickedMedia[]) => void;
  multiSelect?: boolean;
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
  } catch { return undefined; }
}

interface LibraryRow {
  id: string;
  media_type: string;
  status: string;
  archived: boolean;
  mime_type: string | null;
  file_size_bytes: number | null;
  width_px: number | null;
  height_px: number | null;
  duration_seconds: number | null;
  aspect_ratio: string | null;
  alt_text: string | null;
  display_name: string | null;
  original_filename: string | null;
  storage_path: string | null;
  folder_id: string | null;
  campaign_id: string | null;
}

function rowToPicked(row: LibraryRow): PickedMedia {
  return {
    assetId: row.id,
    storageRef: row.storage_path ?? "",
    mimeType: row.mime_type ?? "application/octet-stream",
    altText: row.alt_text,
    displayName: row.display_name ?? row.original_filename,
    widthPx: row.width_px,
    heightPx: row.height_px,
    durationSeconds: row.duration_seconds,
    fileSizeBytes: row.file_size_bytes,
    aspect: row.aspect_ratio,
  };
}

function rowToMediaLike(row: LibraryRow): MediaAssetLike {
  return {
    id: row.id,
    mediaType: row.media_type as MediaAssetLike["mediaType"],
    status: row.status as MediaAssetLike["status"],
    archived: row.archived,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    widthPx: row.width_px,
    heightPx: row.height_px,
    durationSeconds: row.duration_seconds,
    altText: row.alt_text,
  };
}

export function MediaPickerDialog(props: Props) {
  const { open, onClose, onPick, onPickMany, multiSelect, organizationId, ventureId, campaignId, platform, disabled } = props;
  const [tab, setTab] = useState<Tab>("library");

  useEffect(() => { if (open) setTab("library"); }, [open]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative flex w-full max-w-5xl max-h-[92vh] flex-col border border-foreground/15 bg-background shadow-lg">
        <header className="flex items-baseline justify-between gap-4 border-b border-foreground/10 px-6 py-4">
          <div>
            <h2 className="font-display text-[22px] leading-tight">Attach media</h2>
            <p className="mt-1 text-[11.5px] uppercase tracking-[0.22em] text-foreground/55">
              {platform.replace(/_/g, " ")} {multiSelect ? " - Multi-select" : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-foreground/60 hover:text-foreground" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="px-6 pt-3">
          <div className="flex gap-1 border-b border-foreground/10 text-[11.5px] uppercase tracking-[0.22em]">
            {(["library","upload"] as const).map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={cn("px-4 py-2 -mb-px border-b-2",
                  tab === t ? "border-foreground text-foreground" : "border-transparent text-foreground/55 hover:text-foreground/80")}>
                {t === "upload" ? "Upload new" : "Library"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-hidden px-6 py-4">
          {tab === "upload"
            ? <UploadTab organizationId={organizationId} ventureId={ventureId} campaignId={campaignId ?? null}
                platform={platform} disabled={disabled} onPick={(m) => { onPick(m); onClose(); }} />
            : <LibraryTab organizationId={organizationId} ventureId={ventureId} campaignId={campaignId ?? null}
                platform={platform} multiSelect={!!multiSelect}
                onPickOne={(m) => { onPick(m); onClose(); }}
                onPickMany={(list) => { onPickMany?.(list); onClose(); }} />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload tab (unchanged behavior, minor polish)
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
    <div className="space-y-5 overflow-y-auto pr-1">
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
// Library tab - unified library, folder tree, views, search, pagination.
// ---------------------------------------------------------------------------

function LibraryTab({
  organizationId, ventureId, campaignId, platform, multiSelect, onPickOne, onPickMany,
}: {
  organizationId: string; ventureId: string; campaignId: string | null;
  platform: EditorPlatform; multiSelect: boolean;
  onPickOne: (m: PickedMedia) => void;
  onPickMany: (list: PickedMedia[]) => void;
}) {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [view, setView] = useState<LibView>("all");
  const [search, setSearch] = useState("");
  const [filterCampaign, setFilterCampaign] = useState(false);
  const [selected, setSelected] = useState<LibraryRow[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const listFolders = useSFn(listAssetFolders);
  const listAssets = useSFn(listLibraryAssets);
  const listFavs = useSFn(listAssetFavorites);

  const foldersQ = useQ({
    queryKey: ["picker","folders", organizationId, ventureId],
    queryFn: () => listFolders({ data: { organizationId, ventureId, includeArchived: false } }),
  });
  const favQ = useQ({
    queryKey: ["picker","favorites", organizationId],
    queryFn: () => listFavs({ data: { organizationId } }),
  });
  const favSet = useMemo(() => new Set((favQ.data?.favorites ?? []).map(f => f.media_asset_id)), [favQ.data]);

  const infQ = useInfiniteQuery({
    queryKey: ["picker","assets", organizationId, ventureId, folderId, view, search, filterCampaign, campaignId],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const res = await listAssets({ data: {
        organizationId, ventureId,
        folderId,
        view,
        query: search.trim() || undefined,
        campaignId: filterCampaign && campaignId ? campaignId : undefined,
        limit: PAGE_SIZE, offset: pageParam as number,
      }});
      return { rows: res.assets as unknown as LibraryRow[], total: res.total, offset: pageParam as number };
    },
    getNextPageParam: (last) => {
      const nextOffset = last.offset + last.rows.length;
      return nextOffset < last.total && last.rows.length > 0 ? nextOffset : undefined;
    },
  });

  // Truthful de-duplication in case a row appears in two pages after a
  // concurrent update; we also preserve insertion order.
  const rows = useMemo<LibraryRow[]>(() => {
    const seen = new Set<string>();
    const out: LibraryRow[] = [];
    for (const p of infQ.data?.pages ?? []) {
      for (const r of p.rows) {
        if (seen.has(r.id)) continue;
        seen.add(r.id); out.push(r);
      }
    }
    return out;
  }, [infQ.data]);

  const toggleSelect = (row: LibraryRow) => {
    if (!multiSelect) { onPickOne(rowToPicked(row)); return; }
    setSelected((prev) => {
      const has = prev.find(r => r.id === row.id);
      if (has) return prev.filter(r => r.id !== row.id);
      return [...prev, row];
    });
  };

  const move = (id: string, dir: -1 | 1) => {
    setSelected((prev) => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx < 0) return prev;
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      const [x] = next.splice(idx, 1);
      next.splice(j, 0, x);
      return next;
    });
  };

  const folderTree = (foldersQ.data?.tree ?? []) as FolderNode[];

  return (
    <div className="grid h-full grid-cols-[220px_1fr] gap-4 overflow-hidden md:grid-cols-[220px_1fr_260px]">
      {/* Folder / view sidebar */}
      <aside className="min-w-0 overflow-y-auto pr-2 text-[12.5px]">
        <div className="mb-2 space-y-0.5">
          {(["all","recent","favorites","unused","archived"] as LibView[]).map((v) => (
            <button key={v} onClick={() => { setView(v); setFolderId(null); }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-foreground/5",
                view === v && !folderId && "bg-foreground/10 font-medium",
              )}>
              {v === "favorites" ? <Star className="h-3.5 w-3.5" /> : <Folder className="h-3.5 w-3.5" />}
              <span className="capitalize">{v}</span>
            </button>
          ))}
          {campaignId && (
            <button onClick={() => { setFilterCampaign((v) => !v); setView("all"); setFolderId(null); }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-foreground/5",
                filterCampaign && "bg-foreground/10 font-medium",
              )}>
              <Folder className="h-3.5 w-3.5" /> Campaign assets
            </button>
          )}
        </div>
        <div className="mt-4 px-2 text-[10.5px] uppercase tracking-[0.22em] text-foreground/50">Folders</div>
        {foldersQ.isLoading ? <div className="p-2 text-foreground/50">Loading...</div>
          : folderTree.length === 0 ? <div className="p-2 text-foreground/50">No folders yet</div>
          : <FolderList nodes={folderTree} selected={folderId} expanded={expanded}
              onToggle={(id) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })}
              onSelect={(id) => { setFolderId(id); setView("all"); setFilterCampaign(false); }} />}
      </aside>

      {/* Main list */}
      <main className="flex min-w-0 flex-col overflow-hidden">
        <label className="relative mb-3 flex items-center border border-foreground/15 focus-within:border-foreground/50">
          <Search className="mx-2 h-4 w-4 text-foreground/50" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search library"
            className="flex-1 bg-transparent px-1 py-2 text-[13px] focus:outline-none" />
        </label>

        {infQ.isLoading ? <div className="py-8 text-center text-[12.5px] text-foreground/55">Loading library...</div>
          : infQ.isError ? <div className="py-8 text-center text-[12.5px] text-[oklch(0.5_0.18_27)]">Could not load library.</div>
          : rows.length === 0 ? <div className="py-8 text-center text-[12.5px] text-foreground/55">No assets match this view.</div>
          : (
            <>
              <div className="flex-1 overflow-y-auto pr-1">
                <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {rows.map((row) => (
                    <li key={row.id}>
                      <LibraryTile row={row}
                        platform={platform}
                        organizationId={organizationId}
                        favorite={favSet.has(row.id)}
                        selectedIndex={multiSelect ? selected.findIndex(s => s.id === row.id) : -1}
                        onClick={() => toggleSelect(row)} />
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center justify-center gap-3 text-[11.5px] text-foreground/60">
                  <span>{rows.length} of {infQ.data?.pages[0]?.total ?? rows.length}</span>
                  {infQ.hasNextPage && (
                    <button type="button" onClick={() => infQ.fetchNextPage()}
                      disabled={infQ.isFetchingNextPage}
                      className="border border-foreground/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] hover:border-foreground/60 disabled:opacity-50">
                      {infQ.isFetchingNextPage ? "Loading..." : "Load more"}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
      </main>

      {/* Selection tray (multi-select only) */}
      {multiSelect && (
        <aside className="hidden min-w-0 flex-col overflow-hidden border-l border-foreground/10 pl-4 md:flex">
          <SectionLabel>Attachment order</SectionLabel>
          {selected.length === 0
            ? <div className="mt-3 text-[12px] text-foreground/55">Select assets to attach.</div>
            : (
              <ul className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
                {selected.map((row, i) => (
                  <li key={row.id} className="flex items-center gap-2 border border-foreground/10 p-2">
                    <GripVertical className="h-3.5 w-3.5 text-foreground/40" />
                    <span className="w-5 text-[11px] text-foreground/60">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[12px]">{row.display_name ?? row.original_filename ?? "Untitled"}</span>
                    <button onClick={() => move(row.id, -1)} disabled={i === 0} className="text-[10px] text-foreground/60 hover:text-foreground disabled:opacity-30">Up</button>
                    <button onClick={() => move(row.id, +1)} disabled={i === selected.length - 1} className="text-[10px] text-foreground/60 hover:text-foreground disabled:opacity-30">Down</button>
                    <button onClick={() => setSelected((prev) => prev.filter(r => r.id !== row.id))} className="text-[10px] text-foreground/60 hover:text-foreground">Remove</button>
                  </li>
                ))}
              </ul>
            )
          }
          <button type="button"
            onClick={() => onPickMany(selected.map(rowToPicked))}
            disabled={selected.length === 0}
            className="mt-3 bg-foreground px-4 py-2 text-[11.5px] uppercase tracking-[0.22em] text-background hover:bg-foreground/85 disabled:opacity-40">
            Attach {selected.length || ""}
          </button>
        </aside>
      )}
    </div>
  );
}

function FolderList({ nodes, selected, expanded, onToggle, onSelect }: {
  nodes: FolderNode[]; selected: string | null; expanded: Set<string>;
  onToggle: (id: string) => void; onSelect: (id: string) => void;
}) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((n) => {
        const isOpen = expanded.has(n.id);
        const has = n.children.length > 0;
        return (
          <li key={n.id}>
            <div className={cn("group flex items-center gap-1 rounded-md pr-1 hover:bg-foreground/5",
              selected === n.id && "bg-foreground/10")}
              style={{ paddingLeft: `${n.depth * 12}px` }}>
              <button onClick={() => has && onToggle(n.id)} className="flex h-6 w-4 items-center justify-center text-foreground/40" aria-label={isOpen ? "Collapse" : "Expand"}>
                {has ? (isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />) : null}
              </button>
              <button onClick={() => onSelect(n.id)} className="flex flex-1 items-center gap-1.5 truncate py-1.5 text-left">
                <Folder className="h-3.5 w-3.5 text-foreground/50" />
                <span className="truncate">{n.name}</span>
              </button>
            </div>
            {isOpen && has && (
              <FolderList nodes={n.children} selected={selected} expanded={expanded} onToggle={onToggle} onSelect={onSelect} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function LibraryTile({
  row, platform, organizationId, favorite, selectedIndex, onClick,
}: {
  row: LibraryRow; platform: EditorPlatform; organizationId: string;
  favorite: boolean; selectedIndex: number; onClick: () => void;
}) {
  const previewFn = useSFn(createMediaPreviewUrl);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (row.mime_type?.startsWith("image/") && row.storage_path) {
      previewFn({ data: { organizationId, assetId: row.id } })
        .then(({ url }) => { if (alive) setPreview(url); }).catch(() => { /* preview optional */ });
    }
    return () => { alive = false; };
  }, [row.id, row.mime_type, row.storage_path, organizationId, previewFn]);

  const result = validateMediaForPlatform(platform, [rowToMediaLike(row)]);
  const findings = result.findings;
  const hasError = result.errors.length > 0;
  const isSelected = selectedIndex >= 0;

  return (
    <button type="button" onClick={onClick}
      aria-pressed={isSelected}
      className={cn("group block w-full border text-left transition-colors",
        isSelected ? "border-foreground ring-1 ring-foreground"
        : hasError ? "border-[oklch(0.5_0.18_27)]/40"
        : "border-foreground/15 hover:border-foreground/50")}>
      <div className="relative aspect-square w-full overflow-hidden bg-foreground/5">
        {preview
          ? <img src={preview} alt={row.alt_text ?? row.display_name ?? ""} className="h-full w-full object-cover" />
          : row.mime_type?.startsWith("video/") ? <div className="flex h-full items-center justify-center"><Film className="h-6 w-6 text-foreground/40" /></div>
          : row.mime_type?.startsWith("image/") ? <div className="flex h-full items-center justify-center"><ImageIcon className="h-6 w-6 text-foreground/40" /></div>
          : <div className="flex h-full items-center justify-center"><FileText className="h-6 w-6 text-foreground/40" /></div>}
        {favorite && <Star className="absolute right-1.5 top-1.5 h-3.5 w-3.5 fill-current text-foreground/80" />}
        {isSelected && (
          <span className="absolute left-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center bg-foreground text-[11px] font-medium text-background">
            {selectedIndex + 1}
          </span>
        )}
      </div>
      <div className="px-3 py-2">
        <div className="truncate text-[12.5px] text-foreground">{row.display_name ?? row.original_filename ?? "Untitled"}</div>
        <div className="mt-0.5 text-[10.5px] uppercase tracking-[0.2em] text-foreground/50">
          {row.mime_type ?? "unknown"}{row.width_px && row.height_px ? ` - ${row.width_px}x${row.height_px}` : ""}
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
