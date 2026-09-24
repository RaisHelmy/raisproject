import type { ReactNode } from "react";

export function AuthLayout(props: { title: string; children: ReactNode }) {
  return (
    <div className="auth-shell d-flex align-items-center justify-content-center min-vh-100">
      <div className="auth-card card shadow-sm" style={{ width: "min(420px, 92vw)" }}>
        <div className="card-body p-4">
          <div className="text-center mb-3">
            <div className="auth-mark"><i className="bi bi-stars" aria-hidden="true" /></div>
            <p className="lp-eyebrow mt-3 mb-1">RaisAI Create</p>
            <h1 className="h4 fw-bold mt-1 mb-2">{props.title}</h1>
            <p className="text-secondary small mb-0">A governed creative workspace for modern teams.</p>
          </div>
          {props.children}
        </div>
      </div>
    </div>
  );
}
