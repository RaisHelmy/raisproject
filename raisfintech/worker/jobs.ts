/**
 * Investment job queue, backed by D1 and processed by the worker.
 *
 * Jobs are enqueued by API routes and processed:
 *  - immediately after enqueue via ctx.waitUntil (fast feedback in dev), and
 *  - by the scheduled (cron) handler in production as a safety net, so a job
 *    survives even if the enqueueing request dies before processing.
 *
 * Claiming uses a conditional UPDATE (status='queued' → 'running'), so two
 * concurrent processors never run the same job twice.
 */

import type { Env } from "./types";
import { findInstrument, UNIVERSE } from "./instruments";
import { analyzeInstrument } from "./quant";

export type JobType = "analysis" | "order";

export interface JobRow {
  id: string;
  user_id: string;
  type: JobType;
  payload: string;
  status: "queued" | "running" | "done" | "failed";
  result: string | null;
  error: string | null;
  attempts: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export async function enqueueJob(
  env: Env,
  userId: string,
  type: JobType,
  payload: unknown
): Promise<string> {
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO jobs (id, user_id, type, payload) VALUES (?, ?, ?, ?)")
    .bind(id, userId, type, JSON.stringify(payload))
    .run();
  return id;
}

const MAX_ATTEMPTS = 3;
const BATCH = 10;

export async function processJobs(env: Env): Promise<number> {
  let processed = 0;
  for (let n = 0; n < BATCH; n++) {
    const job = await env.DB.prepare(
      "SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1"
    ).first<JobRow>();
    if (!job) break;

    // atomic claim — if another processor got it first, skip
    const claim = await env.DB.prepare(
      "UPDATE jobs SET status = 'running', started_at = now(), attempts = attempts + 1 WHERE id = ? AND status = 'queued'"
    )
      .bind(job.id)
      .run();
    if (!claim.meta.changes) continue;

    try {
      const result = await runJob(env, job);
      await env.DB.prepare(
        "UPDATE jobs SET status = 'done', result = ?, error = NULL, finished_at = now() WHERE id = ?"
      )
        .bind(JSON.stringify(result), job.id)
        .run();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const failed = job.attempts + 1 >= MAX_ATTEMPTS;
      await env.DB.prepare(
        `UPDATE jobs SET status = ?, error = ?, finished_at = ? WHERE id = ?`
      )
        .bind(failed ? "failed" : "queued", message, failed ? new Date().toISOString() : null, job.id)
        .run();
    }
    processed++;
  }
  return processed;
}

async function runJob(env: Env, job: JobRow): Promise<unknown> {
  const payload = JSON.parse(job.payload) as Record<string, unknown>;

  if (job.type === "analysis") {
    const symbol = typeof payload.symbol === "string" ? payload.symbol : null;
    if (symbol) {
      const inst = findInstrument(symbol);
      if (!inst) throw new Error(`Unknown instrument: ${symbol}`);
      return { kind: "analysis", analyses: [analyzeInstrument(inst)] };
    }
    // full-universe scan
    const analyses = UNIVERSE.map(analyzeInstrument);
    return {
      kind: "analysis",
      summary: {
        scanned: analyses.length,
        buys: analyses.filter((a) => a.decision.action === "buy").map((a) => a.symbol),
        sells: analyses.filter((a) => a.decision.action === "sell").map((a) => a.symbol),
      },
      analyses,
    };
  }

  if (job.type === "order") {
    const symbol = String(payload.symbol ?? "");
    const side = payload.side === "sell" ? "sell" : "buy";
    const amount = Number(payload.amount);
    const mode = payload.mode === "live" ? "live" : "paper";

    const inst = findInstrument(symbol);
    if (!inst) throw new Error(`Unknown instrument: ${symbol}`);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Order amount must be positive.");

    // Re-check live-trading consent at execution time, not just enqueue time.
    if (mode === "live") {
      const g = await env.DB.prepare("SELECT data FROM guidance WHERE user_id = ?")
        .bind(job.user_id)
        .first<{ data: string }>();
      const enabled = g ? !!JSON.parse(g.data).liveTradingEnabled : false;
      if (!enabled) throw new Error("Live trading is not enabled for this account. The order was not placed.");
    }

    const analysis = analyzeInstrument(inst);
    const price = analysis.history.latest;
    const qty = +(amount / price).toFixed(4);

    return {
      kind: "order",
      status: "filled",
      mode,
      symbol: inst.symbol,
      side,
      amount,
      fillPrice: price,
      quantity: qty,
      shariah: inst.shariah.status,
      risk: analysis.flags.risk,
      signalAtFill: analysis.decision.action,
      note:
        mode === "paper"
          ? "Simulated fill with paper funds."
          : "Live order simulated in this build; broker execution is the integration point.",
    };
  }

  throw new Error(`Unknown job type: ${job.type}`);
}
