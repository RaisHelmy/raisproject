import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, EmptyState, StatusBadge } from "../ux/components";
import { api } from "../lib/api";

interface Job {
  id: string;
  type: "analysis" | "order";
  payload: string;
  status: "queued" | "running" | "done" | "failed";
  result: string | null;
  error: string | null;
  attempts: number;
  created_at: string;
  finished_at: string | null;
}

function StatusChip({ status }: { status: Job["status"] }) {
  const tone = status === "done" ? "green" : status === "failed" ? "red" : status === "running" ? "gold" : "blue";
  return <StatusBadge tone={tone}>{status}</StatusBadge>;
}

function describe(job: Job): string {
  const p = JSON.parse(job.payload || "{}");
  if (job.type === "analysis") {
    return p.symbol ? `Analyze ${p.symbol}` : "Analyze full universe";
  }
  return `${String(p.side).toUpperCase()} RM ${p.amount} of ${p.symbol} (${p.mode})`;
}

function resultSummary(job: Job): string {
  if (job.status === "failed") return job.error ?? "Failed.";
  if (!job.result) return job.status === "queued" ? "Waiting for the worker…" : "Processing…";
  const r = JSON.parse(job.result);
  if (r.kind === "order") {
    return `Filled ${r.quantity} @ ${r.fillPrice} · ${r.shariah === "compliant" ? "☪ compliant" : r.shariah} · ${r.risk} risk · signal at fill: ${String(r.signalAtFill).toUpperCase()}`;
  }
  if (r.kind === "analysis") {
    if (r.summary) return `Scanned ${r.summary.scanned} — buys: ${r.summary.buys.join(", ") || "none"}; sells: ${r.summary.sells.join(", ") || "none"}`;
    const a = r.analyses?.[0];
    return a ? `${a.symbol}: ${a.decision.action.toUpperCase()} (${Math.round(a.decision.confidence * 100)}% confidence)` : "Done.";
  }
  return "Done.";
}

/**
 * The investment queue: analysis runs and robo orders are jobs processed by
 * the worker (immediately after enqueue, and by a cron trigger as a safety
 * net in production). The page polls while anything is still in flight.
 */
export function Queue() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    api
      .get<{ jobs: Job[] }>("/jobs")
      .then((r) => setJobs(r.jobs))
      .catch((e) => setNotice(e instanceof Error ? e.message : "Could not load the queue."));
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 2500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  const queueScan = async () => {
    setNotice(null);
    try {
      await api.post("/robo/analyze", {});
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not queue the analysis.");
    }
  };

  const processNow = async () => {
    setNotice(null);
    try {
      const r = await api.post<{ processed: number }>("/jobs/process");
      setNotice(r.processed > 0 ? `Processed ${r.processed} job(s).` : "Nothing queued — the worker is idle.");
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Processing failed.");
    }
  };

  const inFlight = jobs?.some((j) => j.status === "queued" || j.status === "running") ?? false;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Investments", to: "/invest/portfolio" }, { label: "Queue" }]}
        eyebrow="Investments"
        title="Investment Queue"
        description="Analysis runs and robo orders are queued here and executed by the worker — nothing trades in the middle of a page view. Jobs retry on failure and every outcome is recorded."
        actions={
          <>
            <button className="btn btn-primary" onClick={queueScan}>Queue Full Analysis</button>
            <button className="btn btn-secondary" onClick={processNow}>Process Now</button>
          </>
        }
      />

      {notice && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <span aria-hidden>ⓘ</span>
          <span>{notice}</span>
        </div>
      )}

      {inFlight && (
        <div className="alert alert-warn" style={{ marginBottom: 16 }}>
          <span aria-hidden>⏳</span>
          <span>Jobs are in flight — this page refreshes automatically.</span>
        </div>
      )}

      {jobs === null ? (
        <p className="muted">Loading the queue…</p>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon="🧵"
          title="The queue is empty"
          body="Queued work appears here: full-universe analysis runs and robo orders, with their status and results."
          steps={[
            "Queue a full analysis from here or from Markets",
            "Place a paper order from Robo Trading",
            "Watch results land as the worker processes each job",
          ]}
          action={
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={queueScan}>Queue Full Analysis</button>
              <button className="btn btn-secondary" onClick={() => navigate("/invest/robo")}>Open Robo Trading</button>
            </div>
          }
        />
      ) : (
        <div className="card" style={{ padding: "10px 12px" }}>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Outcome</th>
                  <th>Queued</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <strong>{describe(j)}</strong>
                      <div className="muted">{j.type} · attempt {j.attempts}</div>
                    </td>
                    <td><StatusChip status={j.status} /></td>
                    <td style={{ maxWidth: 420 }} className={j.status === "failed" ? "" : "muted"}>
                      {resultSummary(j)}
                    </td>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>{j.created_at.slice(5, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
