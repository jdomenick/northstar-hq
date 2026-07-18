// Google-Docs-style autosave state machine for the editor.
//
// Guarantees:
// - Never displays "Saved" until the server confirms.
// - Never loses a keystroke: while a save is in flight, further edits
//   queue a follow-up save.
// - Never overwrites a newer edit with an older response: each attempt
//   carries a monotonically increasing seq; late responses are discarded.
// - Handles offline: while `navigator.onLine` is false the state reports
//   Offline and defers the flush until online returns.
// - Retries transient failures with backoff; surfaces Failed only after
//   the last retry.

import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "retrying" | "failed" | "offline";

export interface AutosaveState {
  status: AutosaveStatus;
  lastSavedAt: number | null;
  errorMessage: string | null;
  attempt: number;
}

interface Options {
  /** Debounce window before firing a save after the last edit. */
  debounceMs?: number;
  /** Max retries after transient failure. */
  maxRetries?: number;
  /** Returns a serializable snapshot representing "current edit". */
  getSnapshot: () => unknown | null;
  /** Perform the save. Receives the snapshot + a stable token that the
   *  server can dedupe against. Must throw on failure. */
  save: (snapshot: unknown, clientEditToken: string) => Promise<void>;
  /** Optional: skip saves entirely (e.g. no active variant). */
  enabled?: boolean;
}

function isTransient(err: unknown): boolean {
  const msg = (err as Error | undefined)?.message ?? "";
  if (/network|fetch|timeout|abort|econn|502|503|504/i.test(msg)) return true;
  return false;
}

function newToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useAutosave(opts: Options) {
  const { debounceMs = 900, maxRetries = 4, getSnapshot, save, enabled = true } = opts;
  const [state, setState] = useState<AutosaveState>({
    status: "idle", lastSavedAt: null, errorMessage: null, attempt: 0,
  });
  const seqRef = useRef(0);
  const inFlightRef = useRef(false);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onlineRef = useRef(typeof navigator === "undefined" ? true : navigator.onLine);

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const flush = useCallback(async (attempt: number) => {
    if (!enabled) return;
    if (!onlineRef.current) {
      setState((s) => ({ ...s, status: "offline" }));
      return;
    }
    const snap = getSnapshot();
    if (snap == null) return;
    inFlightRef.current = true;
    dirtyRef.current = false;
    const mySeq = ++seqRef.current;
    const token = newToken();
    setState((s) => ({ ...s, status: attempt > 0 ? "retrying" : "saving", attempt, errorMessage: null }));
    try {
      await save(snap, token);
      if (mySeq !== seqRef.current) {
        // A newer request has already superseded us; do not touch status.
        return;
      }
      if (dirtyRef.current) {
        // Edits came in during the save. Ack this attempt but immediately
        // fire a follow-up. Status stays "saving" so the UI does not lie.
        setState((s) => ({ ...s, status: "saving", attempt: 0, errorMessage: null }));
        inFlightRef.current = false;
        void flush(0);
        return;
      }
      setState({ status: "saved", lastSavedAt: Date.now(), errorMessage: null, attempt: 0 });
    } catch (err) {
      if (mySeq !== seqRef.current) return;
      if (attempt + 1 < maxRetries && (isTransient(err) || !onlineRef.current)) {
        const backoff = Math.min(15_000, 500 * 2 ** attempt);
        setState((s) => ({ ...s, status: "retrying", attempt: attempt + 1, errorMessage: (err as Error).message }));
        dirtyRef.current = true;
        clearTimer();
        timerRef.current = setTimeout(() => { void flush(attempt + 1); }, backoff);
      } else {
        setState((s) => ({ ...s, status: "failed", errorMessage: (err as Error).message ?? "Save failed" }));
        dirtyRef.current = true; // Keep the edit; user can retry.
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [enabled, getSnapshot, save, maxRetries]);

  /** Signal a fresh edit. Debounces the next flush. */
  const notifyEdit = useCallback(() => {
    if (!enabled) return;
    dirtyRef.current = true;
    clearTimer();
    timerRef.current = setTimeout(() => { void flush(0); }, debounceMs);
  }, [enabled, debounceMs, flush]);

  /** Force an immediate save (e.g. on explicit Save click or blur). */
  const flushNow = useCallback(async () => {
    clearTimer();
    await flush(0);
  }, [flush]);

  // Online / offline handling.
  useEffect(() => {
    const handleOnline = () => {
      onlineRef.current = true;
      if (dirtyRef.current) void flush(0);
      else setState((s) => (s.status === "offline" ? { ...s, status: "idle" } : s));
    };
    const handleOffline = () => {
      onlineRef.current = false;
      setState((s) => ({ ...s, status: "offline" }));
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flush]);

  // Warn the operator if they navigate away with unsaved edits.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current || inFlightRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  useEffect(() => () => clearTimer(), []);

  return { state, notifyEdit, flushNow };
}
