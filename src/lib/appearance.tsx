// Global appearance preferences (theme + interface font size).
//
// The choices are applied as data attributes on <html>, which the token blocks
// in src/styles.css translate into the light/dark palettes and the interface
// type scale. Preferences persist in localStorage (there is no per-user UI
// preference column in the backend, and adding one is not warranted yet).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "light" | "dark" | "system";
export type FontSizePreference = "compact" | "default" | "large";

const THEME_KEY = "nsl-app-theme";
const FONT_KEY = "nsl-app-font-size";

const DEFAULT_THEME: ThemePreference = "dark";
const DEFAULT_FONT: FontSizePreference = "default";

function readStored<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const value = window.localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : null;
  } catch {
    return null;
  }
}

function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref !== "system") return pref;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

type AppearanceValue = {
  theme: ThemePreference;
  resolvedTheme: "light" | "dark";
  fontSize: FontSizePreference;
  setTheme: (next: ThemePreference) => void;
  setFontSize: (next: FontSizePreference) => void;
};

const AppearanceContext = createContext<AppearanceValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(DEFAULT_THEME);
  const [fontSize, setFontSizeState] = useState<FontSizePreference>(DEFAULT_FONT);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");

  // Hydrate from storage after mount so SSR markup and first paint always match.
  useEffect(() => {
    const storedTheme = readStored<ThemePreference>(THEME_KEY, ["light", "dark", "system"]);
    const storedFont = readStored<FontSizePreference>(FONT_KEY, ["compact", "default", "large"]);
    if (storedTheme) setThemeState(storedTheme);
    if (storedFont) setFontSizeState(storedFont);
  }, []);

  // Keep the resolved theme in sync, including live OS changes under "system".
  useEffect(() => {
    setResolvedTheme(resolveTheme(theme));
    if (theme !== "system" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setResolvedTheme(mq.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-app-theme", resolvedTheme);
    root.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-app-density", fontSize);
  }, [fontSize]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the choice still applies now.
    }
  }, []);

  const setFontSize = useCallback((next: FontSizePreference) => {
    setFontSizeState(next);
    try {
      window.localStorage.setItem(FONT_KEY, next);
    } catch {
      // Same as above: session-only fallback.
    }
  }, []);

  const value = useMemo<AppearanceValue>(
    () => ({ theme, resolvedTheme, fontSize, setTheme, setFontSize }),
    [theme, resolvedTheme, fontSize, setTheme, setFontSize],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used inside AppearanceProvider");
  return ctx;
}
