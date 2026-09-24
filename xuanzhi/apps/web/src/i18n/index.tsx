import { useCallback } from "react";
import type { Locale } from "@xuanzhi/shared-types";
import { en, type Dict } from "./en";
import { zhCN } from "./zh-CN";
import { zhTW } from "./zh-TW";
import { usePrefs } from "@/services/prefs";

const DICTS: Record<Locale, Dict> = { en, "zh-CN": zhCN, "zh-TW": zhTW };
export type TKey = keyof Dict;

export function translate(locale: Locale, key: TKey, vars?: Record<string, string | number>): string {
  let s: string = DICTS[locale]?.[key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
export function useT() {
  const { locale } = usePrefs();
  const t = useCallback((key: TKey, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);
  return { t, locale };
}
/** Pick a localised field from an object carrying name / name_zh / name_zh_tw. */
export function pickName<T extends { name: string; name_zh?: string; name_zh_tw?: string }>(o: T, locale: Locale): string {
  return locale === "zh-CN" ? o.name_zh || o.name : locale === "zh-TW" ? o.name_zh_tw || o.name_zh || o.name : o.name;
}
export function pickDescription<T extends { description: string; description_zh?: string; description_zh_tw?: string }>(o: T, locale: Locale): string {
  return locale === "zh-CN" ? o.description_zh || o.description : locale === "zh-TW" ? o.description_zh_tw || o.description_zh || o.description : o.description;
}
export const LOCALE_LABELS: Record<Locale, string> = { en: "English", "zh-CN": "简体中文", "zh-TW": "繁體中文" };
