import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Inline ⓘ explanation for unfamiliar concepts (Hibah, Faraid, paper
 * trading…). Short by design — a sentence or two, never a textbook.
 */
export function InfoTip({ children, learnMore }: { children: ReactNode; learnMore?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="infotip" ref={ref}>
      <button
        type="button"
        className="infotip-btn"
        aria-label="More information"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>
      {open && (
        <span className="infotip-pop" role="tooltip">
          {children}
          {learnMore && (
            <>
              {" "}
              <a href={learnMore} onClick={(e) => e.preventDefault()}>
                Learn more
              </a>
            </>
          )}
        </span>
      )}
    </span>
  );
}
