// Pure line-level diff used by the revision drawer's Compare view. No deps;
// LCS with a byte cap so pathological inputs can't blow up the worker.

export type DiffOp = "equal" | "added" | "removed";

export interface DiffLine {
  op: DiffOp;
  text: string;
  aLine: number | null;
  bLine: number | null;
}

const MAX_LINES = 2_000;

function split(s: string | null | undefined): string[] {
  if (!s) return [];
  const lines = s.replace(/\r\n?/g, "\n").split("\n");
  return lines.length > MAX_LINES ? lines.slice(0, MAX_LINES) : lines;
}

/** Line diff via classic LCS. O(n*m) memory - capped by MAX_LINES so worst
 *  case is 4M cells * 4 bytes = ~16MB, well within a worker's headroom for
 *  a normal editorial paragraph. */
export function diffLines(a: string | null | undefined, b: string | null | undefined): DiffLine[] {
  const A = split(a);
  const B = split(b);
  const n = A.length;
  const m = B.length;
  // LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push({ op: "equal", text: A[i], aLine: i + 1, bLine: j + 1 });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ op: "removed", text: A[i], aLine: i + 1, bLine: null });
      i++;
    } else {
      out.push({ op: "added", text: B[j], aLine: null, bLine: j + 1 });
      j++;
    }
  }
  while (i < n) { out.push({ op: "removed", text: A[i], aLine: i + 1, bLine: null }); i++; }
  while (j < m) { out.push({ op: "added", text: B[j], aLine: null, bLine: j + 1 }); j++; }
  return out;
}

export interface DiffSummary {
  added: number;
  removed: number;
  unchanged: number;
  changed: boolean;
}

export function summarizeDiff(lines: DiffLine[]): DiffSummary {
  let added = 0, removed = 0, unchanged = 0;
  for (const l of lines) {
    if (l.op === "added") added++;
    else if (l.op === "removed") removed++;
    else unchanged++;
  }
  return { added, removed, unchanged, changed: added + removed > 0 };
}