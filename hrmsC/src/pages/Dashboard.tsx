import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type Summary = {
  own: { pendingLeaveApplications: number; pendingClaims: number } | null;
  approvals: { pendingLeave: number; pendingClaims: number } | null;
  organization: { totalEmployees: number; activeEmployees: number } | null;
};

function StatCard({ label, value, to, icon }: { label: string; value: number; to: string; icon: string }) {
  return (
    <Link to={to} className="text-decoration-none">
      <div className="card shadow-sm h-100">
        <div className="card-body d-flex align-items-center gap-3">
          <div className="fs-2 text-primary">
            <i className={`bi ${icon}`} />
          </div>
          <div>
            <div className="fs-3 fw-bold">{value}</div>
            <div className="text-secondary small">{label}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function Dashboard() {
  const { auth } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    api.get<Summary>("/dashboard").then(setSummary);
  }, []);

  return (
    <div>
      <h1 className="h3 mb-4">Welcome, {auth?.name}</h1>

      {summary?.own && (
        <>
          <h2 className="h6 text-uppercase text-secondary mb-3">Your requests</h2>
          <div className="row g-3 mb-4">
            <div className="col-sm-6 col-lg-3">
              <StatCard
                label="Pending leave applications"
                value={summary.own.pendingLeaveApplications}
                to="/leave/history"
                icon="bi-calendar-week"
              />
            </div>
            <div className="col-sm-6 col-lg-3">
              <StatCard
                label="Pending claims"
                value={summary.own.pendingClaims}
                to="/claims/history"
                icon="bi-receipt"
              />
            </div>
          </div>
        </>
      )}

      {summary?.approvals && (
        <>
          <h2 className="h6 text-uppercase text-secondary mb-3">Awaiting your approval</h2>
          <div className="row g-3 mb-4">
            <div className="col-sm-6 col-lg-3">
              <StatCard
                label="Leave applications"
                value={summary.approvals.pendingLeave}
                to="/leave/approvals"
                icon="bi-check2-square"
              />
            </div>
            <div className="col-sm-6 col-lg-3">
              <StatCard
                label="Claims"
                value={summary.approvals.pendingClaims}
                to="/claims/approvals"
                icon="bi-check2-square"
              />
            </div>
          </div>
        </>
      )}

      {summary?.organization && (
        <>
          <h2 className="h6 text-uppercase text-secondary mb-3">Organization</h2>
          <div className="row g-3">
            <div className="col-sm-6 col-lg-3">
              <StatCard
                label="Total employees"
                value={summary.organization.totalEmployees}
                to="/employees"
                icon="bi-people"
              />
            </div>
            <div className="col-sm-6 col-lg-3">
              <StatCard
                label="Active employees"
                value={summary.organization.activeEmployees}
                to="/employees"
                icon="bi-person-check"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
