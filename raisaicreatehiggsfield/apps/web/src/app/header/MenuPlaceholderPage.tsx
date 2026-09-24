import { useLocation } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { ALL_ENTRIES, HEADER_ITEMS } from "./menuData";

function humanize(pathname: string): string {
  const last = pathname.split("/").filter(Boolean).pop() ?? "Page";
  return last.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Landing spot for menu destinations that have no screen yet. It titles
 * itself from the menu entry that points here so every link in the mega
 * menu resolves to a real page rather than a redirect home.
 */
export function MenuPlaceholderPage() {
  const { pathname, search } = useLocation();
  const here = pathname + search;
  const entry = ALL_ENTRIES.find((e) => e.href === here) ?? ALL_ENTRIES.find((e) => e.href.split("?")[0] === pathname);
  const top = HEADER_ITEMS.find((i) => i.kind !== "separator" && i.href.split("?")[0] === pathname);
  const title = entry?.title ?? (top && top.kind !== "separator" ? top.label : humanize(pathname));
  return (
    <section>
      <h1 className="h3 mb-1">{title}</h1>
      {entry?.subtitle && <p className="text-secondary mb-3">{entry.subtitle}</p>}
      <EmptyState icon="hourglass-split" title={`${title} is coming in a later phase.`} />
    </section>
  );
}
