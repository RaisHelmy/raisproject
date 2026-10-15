import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "rt.theme";

function initial(): Theme {
  try { const t = localStorage.getItem(KEY); if (t === "light" || t === "dark") return t; } catch { /* ignore */ }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.setAttribute("data-bs-theme", t);
}
applyTheme(initial());

export function setTheme(t: Theme) {
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  applyTheme(t);
  window.dispatchEvent(new Event("rt:theme"));
}

export function useTheme(): Theme {
  const [t, setT] = useState<Theme>(() => document.documentElement.getAttribute("data-theme") as Theme);
  useEffect(() => {
    const on = () => setT(document.documentElement.getAttribute("data-theme") as Theme);
    window.addEventListener("rt:theme", on);
    return () => window.removeEventListener("rt:theme", on);
  }, []);
  return t;
}

const cv = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/** Chart palette read from the CSS tokens, so charts follow the theme. */
export function chartColors() {
  return {
    grid: cv("--chart-grid"), axis: cv("--border"), label: cv("--muted-foreground"), fg: cv("--foreground"),
    tipBg: cv("--popover"), up: cv("--up"), down: cv("--down"), accent: cv("--primary"),
  };
}

export function ThemeToggle() {
  const t = useTheme();
  return (
    <button className="icon-btn" title={`Switch to ${t === "dark" ? "light" : "dark"} mode`} aria-label="Toggle theme"
      onClick={() => setTheme(t === "dark" ? "light" : "dark")}>
      {t === "dark" ? "☀" : "☾"}
    </button>
  );
}
