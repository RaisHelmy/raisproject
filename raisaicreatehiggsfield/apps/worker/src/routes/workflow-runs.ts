import { Hono } from "hono";
import { AppError, hasScope } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { WorkflowExecutionService } from "../services/workflow-execution-service";

export const workflowRuns = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

function serialize(run: Awaited<ReturnType<WorkflowExecutionService["get"]>>) {
  return {
    id: run.id,
    status: run.status,
    estimatedCostSen: run.estimatedCostSen,
    chargedSen: run.actualCostSen,
    outputs: run.outputs,
    nodes: run.nodes.map((n) => ({
      nodeId: n.nodeId,
      status: n.status,
      attempt: n.attempt,
      chargedSen: n.actualCostSen ?? 0,
      durationMs: n.durationMs ?? null,
      outputs: n.outputs ?? null,
      error: n.error ?? null,
    })),
    ...(run.error ? { error: run.error } : {}),
  };
}

workflowRuns.get("/workflow-runs/:id", requireAuth(), async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "workflows:read")) throw new AppError("insufficient_scope", "This token cannot read runs.");
  return c.json(serialize(await new WorkflowExecutionService(c.env).get(auth, c.req.param("id"))));
});

/**
 * Live run status over Server-Sent Events (§66).
 *
 * The stream polls D1 and only emits when something actually changed, so an
 * idle run costs one small query per interval. Clients that cannot use SSE
 * fall back to polling GET /workflow-runs/:id, which returns the same shape.
 */
workflowRuns.post("/workflow-runs/:id/cancel", requireAuth(), requireCsrf(), async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "workflows:execute")) throw new AppError("insufficient_scope", "This token cannot stop runs.");
  return c.json(await new WorkflowExecutionService(c.env).cancel(auth, c.req.param("id")));
});

workflowRuns.get("/workflow-runs/:id/events", requireAuth(), async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "workflows:read")) throw new AppError("insufficient_scope", "This token cannot read runs.");
  const runId = c.req.param("id");
  const service = new WorkflowExecutionService(c.env);

  // Fails fast with a normal error response if the run is not the caller's.
  await service.get(auth, runId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastPayload = "";
      let elapsedMs = 0;
      const intervalMs = 1500;
      const timeoutMs = 5 * 60 * 1000;

      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        while (elapsedMs < timeoutMs) {
          const run = await service.get(auth, runId);
          const payload = JSON.stringify(serialize(run));
          if (payload !== lastPayload) {
            lastPayload = payload;
            send("status", JSON.parse(payload));
          }
          if (["completed", "failed", "cancelled", "paused"].includes(run.status)) {
            send("done", { status: run.status });
            break;
          }
          await scheduler.wait(intervalMs);
          elapsedMs += intervalMs;
        }
      } catch (error) {
        send("error", { message: error instanceof Error ? error.message : "Stream failed." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
});
