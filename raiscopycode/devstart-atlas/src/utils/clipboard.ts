import { trackCopy } from "../services/storage";

/** Copy text to clipboard with a fallback for non-secure contexts. */
export async function copyText(text: string, label = "Snippet"): Promise<boolean> {
  let ok = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch {
    ok = false;
  }
  if (!ok) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand("copy");
      document.body.removeChild(ta);
    } catch {
      ok = false;
    }
  }
  if (ok) trackCopy(label, text);
  return ok;
}
