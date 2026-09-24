import type { Technology } from "../../types";
import { languages } from "./languages";
import { frameworks } from "./frameworks";
import { platforms } from "./platforms";

// Adding a technology = add it to one of these files (or a new file spread here).
// Nothing in the UI needs to change.
export const technologies: Technology[] = [...languages, ...frameworks, ...platforms];

export const technologyById = new Map(technologies.map((t) => [t.id, t]));

export const pinnedLanguages = languages.filter((l) => l.pinned);

export function techName(id: string): string {
  return technologyById.get(id)?.name ?? id;
}

export function relatedOf(tech: Technology): Technology[] {
  const ids = new Set(tech.relatedTechnologies ?? []);
  // include reverse relationships and same-language members
  for (const t of technologies) {
    if (t.id === tech.id) continue;
    if (t.relatedTechnologies?.includes(tech.id)) ids.add(t.id);
    if (tech.category === "language" && t.language === tech.id) ids.add(t.id);
  }
  return [...ids].map((id) => technologyById.get(id)).filter((t): t is Technology => !!t);
}
