// Light/dark theme state for the PUBLIC marketing site only.
//
// The theme is applied as a data attribute on the public site shell, so the
// authenticated internal app keeps its own fixed theme. The choice persists in
// localStorage and falls back to the visitor's OS preference on first visit.

import { useCallback, useEffect, useState } from "react";

export type SiteTheme = "light" | "dark";

const STORAGE_KEY = "nsl-site-theme";

/** Server render and first client paint use this, so hydration always matches. */
const DEFAULT_THEME: SiteTheme = "dark";

function readStoredTheme(): SiteTheme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function useSiteTheme() {
  const [theme, setTheme] = useState<SiteTheme>(DEFAULT_THEME);

  // Resolve the real preference after hydration: stored choice wins, then the
  // OS setting, otherwise the default above.
  useEffect(() => {
    const stored = readStoredTheme();
    if (stored) {
      setTheme(stored);
      return;
    }
    const prefersLight =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: light)").matches;
    if (prefersLight) setTheme("light");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: SiteTheme = current === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Storage can be unavailable (private mode). The toggle still works
        // for the current session.
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
