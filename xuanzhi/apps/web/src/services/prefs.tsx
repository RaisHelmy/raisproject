import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Locale, Theme } from "@xuanzhi/shared-types";

interface Prefs { locale: Locale; theme: Theme; setLocale: (l: Locale) => void; setTheme: (t: Theme) => void; resolvedTheme: "light" | "dark" }
const Ctx = createContext<Prefs | null>(null);
const read = <T,>(k: string, d: T): T => { try { return (localStorage.getItem(k) as T) ?? d; } catch { return d; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

function detectLocale(): Locale {
  const n = navigator.language.toLowerCase();
  if (n.startsWith("zh")) return n.includes("tw") || n.includes("hk") || n.includes("hant") ? "zh-TW" : "zh-CN";
  return "en";
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => read<Locale | null>("xz.locale", null) ?? detectLocale());
  const [theme, setThemeState] = useState<Theme>(() => read<Theme>("xz.theme", "system"));
  const [system, setSystem] = useState<"light" | "dark">(() => (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  useEffect(() => { const mq = window.matchMedia("(prefers-color-scheme: dark)"); const h = () => setSystem(mq.matches ? "dark" : "light"); mq.addEventListener("change", h); return () => mq.removeEventListener("change", h); }, []);
  const resolvedTheme = theme === "system" ? system : theme;
  useEffect(() => { document.documentElement.setAttribute("data-bs-theme", resolvedTheme); document.documentElement.lang = locale; document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolvedTheme === "dark" ? "#17161a" : "#f6f1e7"); }, [resolvedTheme, locale]);
  const setLocale = useCallback((l: Locale) => { setLocaleState(l); write("xz.locale", l); }, []);
  const setTheme = useCallback((t: Theme) => { setThemeState(t); write("xz.theme", t); }, []);
  const value = useMemo(() => ({ locale, theme, setLocale, setTheme, resolvedTheme }), [locale, theme, setLocale, setTheme, resolvedTheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function usePrefs(): Prefs { const v = useContext(Ctx); if (!v) throw new Error("usePrefs outside PrefsProvider"); return v; }
