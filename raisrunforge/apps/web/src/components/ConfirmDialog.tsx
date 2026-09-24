import type { ReactNode } from "react";

export function ConfirmDialog({
  title,
  danger,
  children,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: {
  title: string;
  danger?: boolean;
  children: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div className="rf-backdrop" onClick={onCancel} />
      <div className="rf-modal">
        <div className="p-3 border-bottom" style={{ borderColor: "var(--rf-border-soft)" }}>
          <div className="d-flex align-items-center gap-2">
            {danger && <i className="bi bi-exclamation-triangle-fill text-danger" />}
            <strong>{title}</strong>
          </div>
        </div>
        <div className="p-3">{children}</div>
        <div className="p-3 border-top d-flex justify-content-end gap-2" style={{ borderColor: "var(--rf-border-soft)" }}>
          <button className="btn-rf" onClick={onCancel}>Cancel</button>
          <button className={danger ? "btn-rf btn-rf-danger" : "btn-rf btn-rf-primary"} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </>
  );
}
