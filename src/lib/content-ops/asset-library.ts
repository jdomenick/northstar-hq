// Files & Assets Foundation - pure helpers.
//
// Kept dependency-free so tests (and any client-side derivation) can import
// without pulling server-only modules. All folder/tag/tree logic that does
// not require the database lives here.

export interface FolderNodeInput {
  id: string;
  parent_folder_id: string | null;
  name: string;
  archived: boolean;
  sort_order: number;
}

export interface FolderNode extends FolderNodeInput {
  depth: number;
  path: string[];        // ancestor names + self
  children: FolderNode[];
}

export const ASSET_LIBRARY_LIMITS = {
  maxFolderDepth: 8,
  maxNameLength: 160,
  maxTagsPerAsset: 24,
  maxTagLength: 40,
  bulkActionMax: 200,
} as const;

export function normalizeTag(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "");
  if (!t) return null;
  return t.slice(0, ASSET_LIBRARY_LIMITS.maxTagLength);
}

export function normalizeTags(input: readonly string[]): string[] {
  const out = new Set<string>();
  for (const raw of input) {
    const t = normalizeTag(raw);
    if (t) out.add(t);
    if (out.size >= ASSET_LIBRARY_LIMITS.maxTagsPerAsset) break;
  }
  return [...out];
}

export function validateFolderName(raw: string): string {
  const n = raw.trim().replace(/\s+/g, " ");
  if (n.length === 0) throw new Error("folder name is required");
  if (n.length > ASSET_LIBRARY_LIMITS.maxNameLength) throw new Error("folder name too long");
  if (/[\\/\x00-\x1f]/.test(n)) throw new Error("folder name contains invalid characters");
  return n;
}

/** Build a nested folder tree from a flat list. Skips orphans safely. */
export function buildFolderTree(rows: readonly FolderNodeInput[]): FolderNode[] {
  const byId = new Map<string, FolderNode>();
  for (const r of rows) {
    byId.set(r.id, { ...r, depth: 0, path: [r.name], children: [] });
  }
  const roots: FolderNode[] = [];
  for (const node of byId.values()) {
    const parentId = node.parent_folder_id;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: FolderNode[], depth: number, prefix: string[]): void => {
    nodes.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    for (const n of nodes) {
      n.depth = depth;
      n.path = [...prefix, n.name];
      sortRec(n.children, depth + 1, n.path);
    }
  };
  sortRec(roots, 0, []);
  return roots;
}

/** Compute all descendant ids of a folder. Used to prevent move cycles. */
export function collectDescendantIds(
  rows: readonly FolderNodeInput[],
  rootId: string,
): Set<string> {
  const childrenByParent = new Map<string | null, FolderNodeInput[]>();
  for (const r of rows) {
    const list = childrenByParent.get(r.parent_folder_id) ?? [];
    list.push(r);
    childrenByParent.set(r.parent_folder_id, list);
  }
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const child of childrenByParent.get(id) ?? []) {
      if (!out.has(child.id)) {
        out.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return out;
}

/** Guard: destination must not be self or a descendant. */
export function canMoveFolder(
  rows: readonly FolderNodeInput[],
  folderId: string,
  targetParentId: string | null,
): { ok: boolean; reason?: string } {
  if (targetParentId === null) return { ok: true };
  if (targetParentId === folderId) return { ok: false, reason: "cannot move into itself" };
  const descendants = collectDescendantIds(rows, folderId);
  if (descendants.has(targetParentId)) return { ok: false, reason: "cannot move into a descendant" };
  // Depth check.
  const byId = new Map(rows.map((r) => [r.id, r]));
  let depth = 1;
  let cur: string | null = targetParentId;
  const seen = new Set<string>();
  while (cur) {
    if (seen.has(cur)) return { ok: false, reason: "cycle detected" };
    seen.add(cur);
    depth++;
    if (depth > ASSET_LIBRARY_LIMITS.maxFolderDepth) {
      return { ok: false, reason: "folder depth limit exceeded" };
    }
    cur = byId.get(cur)?.parent_folder_id ?? null;
  }
  return { ok: true };
}