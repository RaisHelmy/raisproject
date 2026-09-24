import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";

/**
 * Consistent page header pattern used on every major page:
 * breadcrumb → eyebrow → title → description → actions.
 * This repetition is what builds the user's mental model of the app.
 */
export function PageHeader({
  crumbs,
  eyebrow,
  title,
  description,
  actions,
}: {
  crumbs?: Crumb[];
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="page-eyebrow">{eyebrow}</div>
      <h1 className="page-title">{title}</h1>
      {description && <p className="page-desc">{description}</p>}
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
