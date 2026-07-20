// Files & Assets Library - the universal asset repository UI.
// Folder tree on the left, grid/list of assets in the middle, preview panel
// on the right. All operations flow through asset-library.functions.ts.

import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronRight, ChevronDown, Folder, FolderPlus, Star, StarOff, Archive,
  Trash2, Search, LayoutGrid, List, Upload, MoveRight, RotateCcw, Copy, Files,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageBody, PageHeader } from "@/components/page-header";
import { EditorialSkeleton, ErrorLine } from "@/components/editorial";
import { useOrg } from "@/lib/org-context";
import { useVentures } from "@/lib/data-hooks";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/storage";
import {
  listAssetFolders, createAssetFolder, renameAssetFolder, moveAssetFolder,
  archiveAssetFolder, deleteAssetFolder,
  listLibraryAssets, moveMediaAssets, archiveMediaAssets, deleteMediaAssets,
  renameMediaAsset, setMediaAssetTags,
  listAssetFavorites, setAssetFavorite,
  copyMediaAssets, duplicateMediaAssets,
} from "@/lib/content-ops/asset-library.functions";
import { createMediaUpload, finalizeMediaUpload, markMediaUploadFailed, createMediaPreviewUrl } from "@/lib/content-ops/media.functions";
import type { FolderNode } from "@/lib/content-ops/asset-library";
import { summarizeCopyResult } from "@/lib/content-ops/asset-copy";

const PAGE_SIZE = 60;

export const Route = createFileRoute("/_authenticated/content-ops/library")({
  component: LibraryPage,
  head: () => ({
    meta: [
      { title: "Files & Assets Library - NorthStar Labs" },
      { name: "description", content: "SAM's universal asset library: folders, favorites, collections, and unified search." },
    ],
  }),
});

type ViewMode = "grid" | "list";
type LibView = "all" | "recent" | "favorites" | "unused" | "archived";

interface LibraryAsset {
  id: string;
  display_name: string | null;
  original_filename: string | null;
  media_type: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  width_px: number | null;
  height_px: number | null;
  storage_bucket: string;
  storage_path: string | null;
  folder_id: string | null;
  tags: string[];
  archived: boolean;
  updated_at: string;
  created_at: string;
  alt_text: string | null;
  caption: string | null;
}

function LibraryPage() {
  const qc = useQueryClient();
  const { activeOrgId } = useOrg();
  const venturesQ = useVentures(activeOrgId);
  const [ventureId, setVentureId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [view, setView] = useState<LibView>("all");
  const [mode, setMode] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "oldest" | "name" | "size">("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<LibraryAsset | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const activeVenture = ventureId ?? venturesQ.data?.[0]?.id ?? null;

  const foldersFn = useServerFn(listAssetFolders);
  const foldersQ = useQuery({
    queryKey: ["asset-library", "folders", activeOrgId, activeVenture],
    enabled: Boolean(activeOrgId && activeVenture),
    queryFn: () => foldersFn({ data: { organizationId: activeOrgId!, ventureId: activeVenture, includeArchived: false } }),
  });

  const listFn = useServerFn(listLibraryAssets);
  const assetsQ = useInfiniteQuery({
    queryKey: ["asset-library", "assets", activeOrgId, activeVenture, folderId, view, query, sort],
    enabled: Boolean(activeOrgId && activeVenture),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const res = await listFn({ data: {
        organizationId: activeOrgId!, ventureId: activeVenture!,
        folderId, view, query: query.trim() || undefined, sort,
        limit: PAGE_SIZE, offset: pageParam as number,
      } });
      return { ...res, offset: pageParam as number };
    },
    getNextPageParam: (last) => {
      const nextOffset = last.offset + (last.assets?.length ?? 0);
      return nextOffset < (last.total ?? 0) && (last.assets?.length ?? 0) > 0 ? nextOffset : undefined;
    },
  });

  const favFn = useServerFn(listAssetFavorites);
  const favQ = useQuery({
    queryKey: ["asset-library", "favorites", activeOrgId],
    enabled: Boolean(activeOrgId),
    queryFn: () => favFn({ data: { organizationId: activeOrgId! } }),
  });
  const favSet = useMemo(
    () => new Set((favQ.data?.favorites ?? []).map((f) => f.media_asset_id)),
    [favQ.data],
  );

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["asset-library"] });
  }, [qc]);

  // Clear selection whenever the active view / filter / venture changes so
  // selection never leaks between contexts.
  useEffect(() => {
    setSelected(new Set());
    setPreview(null);
  }, [activeOrgId, activeVenture, folderId, view, query, sort]);

  // ---- Mutations ------------------------------------------------------------
  const createFolderFn = useServerFn(createAssetFolder);
  const renameFolderFn = useServerFn(renameAssetFolder);
  const moveFolderFn = useServerFn(moveAssetFolder);
  const archiveFolderFn = useServerFn(archiveAssetFolder);
  const deleteFolderFn = useServerFn(deleteAssetFolder);
  const moveAssetsFn = useServerFn(moveMediaAssets);
  const archiveAssetsFn = useServerFn(archiveMediaAssets);
  const deleteAssetsFn = useServerFn(deleteMediaAssets);
  const renameAssetFn = useServerFn(renameMediaAsset);
  const setTagsFn = useServerFn(setMediaAssetTags);
  const setFavFn = useServerFn(setAssetFavorite);

  const createFolder = useMutation({
    mutationFn: async () => {
      const name = window.prompt("Folder name")?.trim();
      if (!name) return null;
      return createFolderFn({ data: {
        organizationId: activeOrgId!, ventureId: activeVenture!,
        parentFolderId: folderId, name,
      } });
    },
    onSuccess: (r) => { if (r) { toast.success("Folder created"); invalidateAll(); } },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const toggleFav = useMutation({
    mutationFn: (a: LibraryAsset) => setFavFn({ data: {
      organizationId: activeOrgId!, mediaAssetId: a.id, favorite: !favSet.has(a.id),
    } }),
    onSuccess: () => invalidateAll(),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const bulkArchive = useMutation({
    mutationFn: (archived: boolean) => archiveAssetsFn({ data: {
      organizationId: activeOrgId!, mediaAssetIds: [...selected], archived,
    } }),
    onSuccess: (r, archived) => {
      toast.success(`${r.count} asset${r.count === 1 ? "" : "s"} ${archived ? "archived" : "restored"}`);
      setSelected(new Set()); invalidateAll();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const bulkDelete = useMutation({
    mutationFn: () => deleteAssetsFn({ data: {
      organizationId: activeOrgId!, mediaAssetIds: [...selected],
    } }),
    onSuccess: (r) => {
      toast.success(`${r.count} asset${r.count === 1 ? "" : "s"} deleted`);
      setSelected(new Set()); invalidateAll();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const copyAssetsFn = useServerFn(copyMediaAssets);
  const duplicateAssetsFn = useServerFn(duplicateMediaAssets);

  const bulkDuplicate = useMutation({
    mutationFn: () => duplicateAssetsFn({ data: {
      organizationId: activeOrgId!, mediaAssetIds: [...selected],
    } }),
    onSuccess: (r) => {
      toast.success(summarizeCopyResult(r));
      setSelected(new Set()); invalidateAll();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const bulkCopyTo = useMutation({
    mutationFn: (targetFolderId: string | null) => copyAssetsFn({ data: {
      organizationId: activeOrgId!, mediaAssetIds: [...selected], targetFolderId,
    } }),
    onSuccess: (r) => {
      toast.success(summarizeCopyResult(r));
      setSelected(new Set()); invalidateAll();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const moveTo = useMutation({
    mutationFn: (targetFolderId: string | null) => moveAssetsFn({ data: {
      organizationId: activeOrgId!, mediaAssetIds: [...selected], targetFolderId,
    } }),
    onSuccess: (r) => {
      toast.success(`Moved ${r.count} asset${r.count === 1 ? "" : "s"}`);
      setSelected(new Set()); invalidateAll();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // ---- Upload ---------------------------------------------------------------
  const createUpFn = useServerFn(createMediaUpload);
  const finalizeFn = useServerFn(finalizeMediaUpload);
  const failFn = useServerFn(markMediaUploadFailed);
  const [uploading, setUploading] = useState(false);

  const doUpload = useCallback(async (files: FileList | null) => {
    if (!files || !files.length || !activeOrgId || !activeVenture) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const mediaType = file.type.startsWith("image/") ? "image"
          : file.type.startsWith("video/") ? "video"
          : file.type.startsWith("audio/") ? "audio"
          : "document";
        const row = await createUpFn({ data: {
          organizationId: activeOrgId, ventureId: activeVenture,
          mediaType, mimeType: file.type || null, originalFilename: file.name,
          fileSizeBytes: file.size, displayName: file.name,
        } });
        try {
          const { error: upErr } = await supabase.storage.from(row.bucket)
            .upload(row.storagePath, file, { contentType: file.type || undefined, upsert: true });
          if (upErr) throw upErr;
          await finalizeFn({ data: {
            organizationId: activeOrgId, assetId: row.assetId,
            fileSizeBytes: file.size, mimeType: file.type || undefined,
          } });
        } catch (err) {
          await failFn({ data: {
            organizationId: activeOrgId, assetId: row.assetId,
            errorMessage: err instanceof Error ? err.message : "upload failed",
          } }).catch(() => {});
          throw err;
        }
      }
      toast.success("Upload complete");
      invalidateAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [activeOrgId, activeVenture, createUpFn, finalizeFn, failFn, invalidateAll]);

  if (!activeOrgId) return null;

  const folderTree = (foldersQ.data?.tree ?? []) as FolderNode[];
  const rawAssets = ((assetsQ.data?.pages.flatMap((p) => p.assets) ?? []) as unknown) as LibraryAsset[];
  // Truthful de-duplication in case concurrent updates cause overlap between pages.
  const seenIds = new Set<string>();
  const assets: LibraryAsset[] = [];
  for (const a of rawAssets) { if (!seenIds.has(a.id)) { seenIds.add(a.id); assets.push(a); } }
  const totalAssets = assetsQ.data?.pages[0]?.total ?? assets.length;

  return (
    <div>
      <PageHeader
        eyebrow="Files & Assets"
        title="Universal asset library."
        description="Every file SAM uses lives here. Folders, favorites, collections, tags - one repository for content, brand, documents, and future capabilities."
        actions={
          <div className="flex items-center gap-2">
            <label className={cn(
              "inline-flex items-center gap-1.5 rounded-md bg-secondary/60 px-3 py-2 text-[12.5px] font-medium hover:bg-secondary cursor-pointer",
              uploading && "opacity-50 pointer-events-none",
            )}>
              <Upload className="h-3.5 w-3.5" />
              {uploading ? "Uploading…" : "Upload"}
              <input type="file" multiple className="hidden"
                onChange={(e) => { doUpload(e.target.files); e.target.value = ""; }} />
            </label>
            <button
              onClick={() => createFolder.mutate()}
              className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-[12.5px] font-medium text-background hover:opacity-90"
            >
              <FolderPlus className="h-3.5 w-3.5" /> New folder
            </button>
          </div>
        }
      />
      <PageBody>
        {venturesQ.data && venturesQ.data.length > 1 && (
          <div className="mb-4 flex items-center gap-2">
            <label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Venture</label>
            <select
              value={activeVenture ?? ""}
              onChange={(e) => { setVentureId(e.target.value); setFolderId(null); }}
              className="rounded-md bg-secondary/40 px-2.5 py-1.5 text-[12.5px] outline-none"
            >
              {venturesQ.data.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-[220px_1fr] gap-6 lg:grid-cols-[240px_1fr_320px]">
          {/* Sidebar */}
          <aside className="min-w-0">
            <div className="mb-3 space-y-0.5">
              {(["all","recent","favorites","unused","archived"] as LibView[]).map((v) => (
                <button key={v}
                  onClick={() => { setView(v); setFolderId(null); }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] hover:bg-secondary/40",
                    view === v && !folderId && "bg-secondary/60 font-medium",
                  )}
                >
                  {v === "favorites" ? <Star className="h-3.5 w-3.5" /> : <Folder className="h-3.5 w-3.5" />}
                  <span className="capitalize">{v}</span>
                </button>
              ))}
            </div>
            <div className="mb-2 mt-4 px-2.5 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/70">Folders</div>
            {foldersQ.isLoading ? <EditorialSkeleton /> :
              foldersQ.error ? <ErrorLine message={foldersQ.error instanceof Error ? foldersQ.error.message : "Failed to load folders"} /> :
              folderTree.length === 0 ? (
                <div className="px-2.5 py-2 text-[11.5px] text-muted-foreground/70">No folders yet</div>
              ) : (
                <FolderTree
                  nodes={folderTree}
                  selectedId={folderId}
                  expanded={expanded}
                  onToggle={(id) => setExpanded((prev) => {
                    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
                  })}
                  onSelect={(id) => { setFolderId(id); setView("all"); }}
                  onRename={async (id) => {
                    const name = window.prompt("New name")?.trim();
                    if (!name) return;
                    try { await renameFolderFn({ data: { organizationId: activeOrgId!, folderId: id, name } }); invalidateAll(); }
                    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                  }}
                  onArchive={async (id, archived) => {
                    try { await archiveFolderFn({ data: { organizationId: activeOrgId!, folderId: id, archived } }); invalidateAll(); }
                    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                  }}
                  onDelete={async (id) => {
                    if (!window.confirm("Delete this folder? Assets will remain in the library.")) return;
                    try { await deleteFolderFn({ data: { organizationId: activeOrgId!, folderId: id } }); invalidateAll(); }
                    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                  }}
                />
              )
            }
          </aside>

          {/* Main list */}
          <main className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                <input value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search filename, tag, caption…"
                  className="w-full rounded-md bg-secondary/40 pl-8 pr-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground/60"
                />
              </div>
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
                className="rounded-md bg-secondary/40 px-2.5 py-2 text-[12.5px] outline-none">
                <option value="recent">Most recent</option>
                <option value="oldest">Oldest</option>
                <option value="name">Name</option>
                <option value="size">Size</option>
              </select>
              <div className="ml-auto flex items-center gap-0.5 rounded-md bg-secondary/40 p-0.5">
                <button onClick={() => setMode("grid")} className={cn("rounded p-1.5", mode === "grid" && "bg-background")}><LayoutGrid className="h-3.5 w-3.5" /></button>
                <button onClick={() => setMode("list")} className={cn("rounded p-1.5", mode === "list" && "bg-background")}><List className="h-3.5 w-3.5" /></button>
              </div>
            </div>

            {selected.size > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-[12.5px]">
                <span className="text-muted-foreground">{selected.size} selected</span>
                <button onClick={() => {
                  const target = window.prompt("Target folder id (blank for root)")?.trim() || null;
                  moveTo.mutate(target);
                }} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-secondary"><MoveRight className="h-3.5 w-3.5" /> Move</button>
                <button onClick={() => bulkDuplicate.mutate()} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-secondary">
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </button>
                <button onClick={() => {
                  const target = window.prompt("Copy to folder id (blank for root)")?.trim() || null;
                  bulkCopyTo.mutate(target);
                }} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-secondary">
                  <Files className="h-3.5 w-3.5" /> Copy to...
                </button>
                <button onClick={() => bulkArchive.mutate(view !== "archived")} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-secondary">
                  {view === "archived" ? <><RotateCcw className="h-3.5 w-3.5" />Restore</> : <><Archive className="h-3.5 w-3.5" />Archive</>}
                </button>
                <button onClick={() => { if (window.confirm(`Delete ${selected.size} assets?`)) bulkDelete.mutate(); }}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />Delete
                </button>
                <button onClick={() => setSelected(new Set())} className="ml-auto text-muted-foreground hover:text-foreground">Clear</button>
              </div>
            )}

            {assetsQ.isLoading ? <EditorialSkeleton /> :
              assetsQ.error ? <ErrorLine message={assetsQ.error instanceof Error ? assetsQ.error.message : "Failed to load assets"} /> :
              assets.length === 0 ? (
                <div className="py-16 text-center text-[13.5px] text-muted-foreground">
                  {query || folderId || view !== "all" ? "No assets match this view." : "No assets yet. Upload your first file."}
                </div>
              ) : (
                <>
                {mode === "grid" ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
                  {assets.map((a) => (
                    <AssetCard key={a.id} a={a}
                      selected={selected.has(a.id)}
                      favorite={favSet.has(a.id)}
                      onSelect={() => setSelected((prev) => { const n = new Set(prev); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })}
                      onOpen={() => setPreview(a)}
                      onFav={() => toggleFav.mutate(a)}
                    />
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {assets.map((a) => (
                    <AssetRow key={a.id} a={a}
                      selected={selected.has(a.id)}
                      favorite={favSet.has(a.id)}
                      onSelect={() => setSelected((prev) => { const n = new Set(prev); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })}
                      onOpen={() => setPreview(a)}
                      onFav={() => toggleFav.mutate(a)}
                    />
                  ))}
                </div>
                )}
                <div className="mt-4 flex items-center justify-center gap-3 text-[11.5px] text-muted-foreground">
                  <span>{assets.length} of {totalAssets}</span>
                  {assetsQ.hasNextPage && (
                    <button type="button" onClick={() => assetsQ.fetchNextPage()}
                      disabled={assetsQ.isFetchingNextPage}
                      className="rounded-md border border-border/60 px-3 py-1.5 hover:bg-secondary/40 disabled:opacity-50">
                      {assetsQ.isFetchingNextPage ? "Loading..." : "Load more"}
                    </button>
                  )}
                </div>
                </>
              )}
          </main>

          {/* Preview panel (desktop) */}
          <aside className="hidden lg:block">
            {preview ? (
              <PreviewPanel a={preview} orgId={activeOrgId} favorite={favSet.has(preview.id)}
                onClose={() => setPreview(null)}
                onRename={async (name) => {
                  try {
                    await renameAssetFn({ data: { organizationId: activeOrgId!, mediaAssetId: preview.id, displayName: name } });
                    invalidateAll(); toast.success("Renamed");
                  } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                }}
                onTags={async (tags) => {
                  try {
                    await setTagsFn({ data: { organizationId: activeOrgId!, mediaAssetId: preview.id, tags } });
                    invalidateAll(); toast.success("Tags updated");
                  } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                }}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-[12px] text-muted-foreground">
                Select an asset to preview.
              </div>
            )}
          </aside>
        </div>
      </PageBody>
    </div>
  );
}

// ---- Folder tree ------------------------------------------------------------

function FolderTree({ nodes, selectedId, expanded, onToggle, onSelect, onRename, onArchive, onDelete }: {
  nodes: FolderNode[]; selectedId: string | null; expanded: Set<string>;
  onToggle: (id: string) => void; onSelect: (id: string) => void;
  onRename: (id: string) => void; onArchive: (id: string, archived: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      {nodes.map((n) => (
        <FolderRow key={n.id} node={n} selectedId={selectedId} expanded={expanded}
          onToggle={onToggle} onSelect={onSelect} onRename={onRename} onArchive={onArchive} onDelete={onDelete} />
      ))}
    </div>
  );
}

function FolderRow({ node, selectedId, expanded, onToggle, onSelect, onRename, onArchive, onDelete }: {
  node: FolderNode; selectedId: string | null; expanded: Set<string>;
  onToggle: (id: string) => void; onSelect: (id: string) => void;
  onRename: (id: string) => void; onArchive: (id: string, archived: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const isOpen = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  return (
    <div>
      <div className={cn(
        "group flex items-center gap-1 rounded-md pr-1 hover:bg-secondary/40",
        selectedId === node.id && "bg-secondary/60",
      )} style={{ paddingLeft: `${node.depth * 12}px` }}>
        <button
          onClick={() => hasChildren && onToggle(node.id)}
          className="flex h-6 w-4 items-center justify-center text-muted-foreground/60"
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          {hasChildren ? (isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />) : null}
        </button>
        <button onClick={() => onSelect(node.id)}
          className="flex flex-1 items-center gap-1.5 truncate py-1.5 text-left text-[12.5px]">
          <Folder className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate">{node.name}</span>
        </button>
        <div className="hidden items-center gap-0.5 group-hover:flex">
          <button title="Rename" onClick={() => onRename(node.id)} className="rounded p-1 text-muted-foreground hover:text-foreground">✎</button>
          <button title={node.archived ? "Restore" : "Archive"} onClick={() => onArchive(node.id, !node.archived)} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <Archive className="h-3 w-3" />
          </button>
          <button title="Delete" onClick={() => onDelete(node.id)} className="rounded p-1 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {isOpen && hasChildren && (
        <FolderTree nodes={node.children} selectedId={selectedId} expanded={expanded}
          onToggle={onToggle} onSelect={onSelect} onRename={onRename} onArchive={onArchive} onDelete={onDelete} />
      )}
    </div>
  );
}

// ---- Asset card / row -------------------------------------------------------

function AssetCard({ a, selected, favorite, onSelect, onOpen, onFav }: {
  a: LibraryAsset; selected: boolean; favorite: boolean;
  onSelect: () => void; onOpen: () => void; onFav: () => void;
}) {
  const [thumb, setThumb] = useState<string | null>(null);
  useThumb(a, setThumb);
  return (
    <div className={cn(
      "group relative overflow-hidden rounded-lg border border-border/40 bg-card/40 transition",
      selected && "ring-2 ring-foreground",
    )}>
      <button onClick={onOpen} className="block aspect-square w-full bg-secondary/30">
        {thumb && a.media_type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={a.alt_text ?? a.display_name ?? ""} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-widest text-muted-foreground">
            {a.media_type}
          </div>
        )}
      </button>
      <div className="absolute left-1.5 top-1.5">
        <input type="checkbox" checked={selected} onChange={onSelect} className="h-3.5 w-3.5" />
      </div>
      <button onClick={onFav} className="absolute right-1.5 top-1.5 rounded bg-background/70 p-1 opacity-0 group-hover:opacity-100 aria-pressed:opacity-100" aria-pressed={favorite}>
        {favorite ? <Star className="h-3.5 w-3.5 fill-current" /> : <StarOff className="h-3.5 w-3.5" />}
      </button>
      <div className="border-t border-border/40 px-2 py-1.5">
        <div className="truncate text-[11.5px] font-medium">{a.display_name ?? a.original_filename ?? "Untitled"}</div>
        <div className="truncate text-[10.5px] text-muted-foreground">{formatFileSize(a.file_size_bytes)}</div>
      </div>
    </div>
  );
}

function AssetRow({ a, selected, favorite, onSelect, onOpen, onFav }: {
  a: LibraryAsset; selected: boolean; favorite: boolean;
  onSelect: () => void; onOpen: () => void; onFav: () => void;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-2 py-2.5 hover:bg-secondary/30", selected && "bg-secondary/40")}>
      <input type="checkbox" checked={selected} onChange={onSelect} className="h-3.5 w-3.5" />
      <button onClick={onOpen} className="flex-1 truncate text-left">
        <div className="truncate text-[13px]">{a.display_name ?? a.original_filename ?? "Untitled"}</div>
        <div className="text-[11px] text-muted-foreground">{a.media_type} · {formatFileSize(a.file_size_bytes)} · {a.updated_at.slice(0, 10)}</div>
      </button>
      <button onClick={onFav} className="p-1 text-muted-foreground hover:text-foreground">
        {favorite ? <Star className="h-3.5 w-3.5 fill-current" /> : <StarOff className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function useThumb(a: LibraryAsset, setThumb: (u: string | null) => void) {
  const { activeOrgId } = useOrg();
  const previewFn = useServerFn(createMediaPreviewUrl);
  useMemo(() => {
    if (a.media_type !== "image" || !a.storage_path || !activeOrgId) return;
    previewFn({ data: { organizationId: activeOrgId, assetId: a.id } })
      .then((r) => setThumb(r?.url ?? null))
      .catch(() => setThumb(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id]);
}

// ---- Preview panel ----------------------------------------------------------

function PreviewPanel({ a, orgId, favorite, onClose, onRename, onTags }: {
  a: LibraryAsset; orgId: string; favorite: boolean;
  onClose: () => void; onRename: (name: string) => void; onTags: (tags: string[]) => void;
}) {
  const [name, setName] = useState(a.display_name ?? "");
  const [tagText, setTagText] = useState(a.tags.join(", "));
  return (
    <div className="sticky top-4 space-y-4 rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="flex items-start justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
          {a.media_type}{favorite && " · Favorite"}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">×</button>
      </div>
      <div className="aspect-video overflow-hidden rounded-md bg-secondary/30">
        <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-widest text-muted-foreground">
          Preview
        </div>
      </div>
      <div className="space-y-2 text-[12.5px]">
        <label className="block">
          <div className="mb-1 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/70">Name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { if (name.trim() && name !== (a.display_name ?? "")) onRename(name.trim()); }}
            className="w-full rounded-md bg-secondary/40 px-2 py-1.5 outline-none" />
        </label>
        <label className="block">
          <div className="mb-1 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/70">Tags (comma separated)</div>
          <input value={tagText} onChange={(e) => setTagText(e.target.value)} onBlur={() => {
            const tags = tagText.split(",").map((t) => t.trim()).filter(Boolean);
            onTags(tags);
          }} className="w-full rounded-md bg-secondary/40 px-2 py-1.5 outline-none" />
        </label>
        <dl className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
          <dt>Type</dt><dd>{a.mime_type ?? "-"}</dd>
          <dt>Size</dt><dd>{formatFileSize(a.file_size_bytes)}</dd>
          {a.width_px && <><dt>Dimensions</dt><dd>{a.width_px}×{a.height_px}</dd></>}
          <dt>Updated</dt><dd>{a.updated_at.slice(0, 10)}</dd>
        </dl>
      </div>
    </div>
  );
}