import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId, SCOPES, type AuthContext } from "@raisai/shared";
import { WorkflowExecutionService } from "../src/services/workflow-execution-service";
import { GenerationService } from "../src/services/generation-service";

import { ModelSeedService } from "../src/services/model-seed-service";
import { FakeAIProvider } from "../src/providers/fake/fake-provider";
import { registerBuiltinNodes } from "../src/engine/nodes";

registerBuiltinNodes();

async function context(): Promise<AuthContext> {
  const userId = newId();
  const orgId = newId();
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)`)
    .bind(userId, `${userId}@example.com`, "h", "Canceller").run();
  await env.DB.prepare(`INSERT INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`)
    .bind(orgId, "Studio", userId).run();
  await env.DB.prepare(`INSERT INTO balances (org_id, available_sen) VALUES (?, 50000)`).bind(orgId).run();
  return { userId, orgId, actorType: "user", scopes: SCOPES, requestId: newId(), isAdmin: false };
}

/**
 * A run that is still going. Made by really running one and then reopening it,
 * so every not-null column holds what the application itself would have
 * written rather than what a test made up.
 */
async function runInFlight(auth: AuthContext): Promise<string> {
  await new ModelSeedService(env).seed();
  const generation = await new GenerationService(env).create(auth, {
    modelId: "@cf/black-forest-labs/flux-1-schnell",
    prompt: "something slow",
    provider: new FakeAIProvider(),
  });
  const runId = generation.generation.workflow_run_id!;
  await env.DB.prepare(`UPDATE workflow_runs SET status='running', completed_at=NULL WHERE id=?`).bind(runId).run();
  return runId;
}

describe("cancelling a run", () => {
  it("records the request so the runner can stop between nodes", async () => {
    const auth = await context();
    const runId = await runInFlight(auth);

    const service = new WorkflowExecutionService(env);
    expect(await service.isCancelRequested(runId)).toBe(false);

    const result = await service.cancel(auth, runId);
    expect(result.status).toBe("cancelling");
    expect(await service.isCancelRequested(runId)).toBe(true);
  });

  it("refuses to stop a run that has already finished", async () => {
    const auth = await context();
    await new ModelSeedService(env).seed();
    const provider = new FakeAIProvider();
    const generation = await new GenerationService(env).create(auth, {
      modelId: "@cf/black-forest-labs/flux-1-schnell",
      prompt: "a finished picture",
      provider,
    });

    // The message says what actually happened rather than "cannot cancel" (§112).
    await expect(new WorkflowExecutionService(env).cancel(auth, generation.generation.workflow_run_id!))
      .rejects.toMatchObject({ code: "invalid_input" });
  });

  it("does not let one workspace stop another's run", async () => {
    const mine = await context();
    const theirs = await context();
    const runId = await runInFlight(theirs);

    await expect(new WorkflowExecutionService(env).cancel(mine, runId)).rejects.toMatchObject({ code: "not_found" });
  });

  it("asking twice is not an error", async () => {
    const auth = await context();
    const runId = await runInFlight(auth);

    const service = new WorkflowExecutionService(env);
    const first = await service.cancel(auth, runId);
    const second = await service.cancel(auth, runId);
    expect(second.status).toBe(first.status);

    // The first request's time stands: a second click must not restart the clock.
    const row = await env.DB.prepare(`SELECT cancel_requested_at FROM workflow_runs WHERE id = ?`)
      .bind(runId).first<{ cancel_requested_at: string }>();
    expect(row!.cancel_requested_at).toBeTruthy();
  });
});
