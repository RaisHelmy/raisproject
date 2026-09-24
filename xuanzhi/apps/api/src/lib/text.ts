/** Rough token estimate: CJK characters ≈ 1 token each; other text ≈ 4 chars/token. Good enough for budgets and cost estimates. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjk = (text.match(/[㐀-鿿豈-﫿]/g) ?? []).length;
  const rest = text.length - cjk;
  return Math.ceil(cjk * 1.0 + rest / 4);
}
export function detectLanguage(text: string): "en" | "zh-CN" | "zh-TW" {
  const cjk = (text.match(/[㐀-鿿]/g) ?? []).length;
  if (cjk === 0 || cjk / Math.max(1, text.replace(/\s/g, "").length) < 0.2) return "en";
  // Traditional-only characters commonly seen; a heuristic, not a classifier.
  const trad = (text.match(/[們個這說對時間開關會來學國經應該體點讓從產動業實際發現無為與]/g) ?? []).length;
  const simp = (text.match(/[们个这说对时间开关会来学国经应该体点让从产动业实际发现无为与]/g) ?? []).length;
  return trad > simp ? "zh-TW" : "zh-CN";
}
export function truncate(s: string, n: number): string { return s.length <= n ? s : s.slice(0, n - 1) + "…"; }
export function titleFromMessage(s: string): string { const t = s.replace(/\s+/g, " ").trim(); return truncate(t, 60) || "New chat"; }
export async function contentHash(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(d)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}
