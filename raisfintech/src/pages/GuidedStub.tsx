import { useNavigate } from "react-router-dom";
import { PageHeader, EmptyState } from "../ux/components";
import type { Crumb } from "../ux/components";

/**
 * Consistent guided page for modules on the roadmap: same header pattern,
 * an empty state that explains what belongs here, and a next action —
 * never a blank screen.
 */
export function GuidedStub({
  crumbs,
  eyebrow,
  title,
  description,
  icon,
  emptyTitle,
  emptyBody,
  steps,
  ctaLabel,
  ctaRoute,
}: {
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  emptyTitle: string;
  emptyBody: string;
  steps?: string[];
  ctaLabel?: string;
  ctaRoute?: string;
}) {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader crumbs={crumbs} eyebrow={eyebrow} title={title} description={description} />
      <EmptyState
        icon={icon}
        title={emptyTitle}
        body={emptyBody}
        steps={steps}
        action={
          ctaLabel && ctaRoute ? (
            <button className="btn btn-primary" onClick={() => navigate(ctaRoute)}>
              {ctaLabel}
            </button>
          ) : undefined
        }
      />
    </>
  );
}
