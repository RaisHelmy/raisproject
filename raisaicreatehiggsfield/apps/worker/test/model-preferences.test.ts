import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId, SCOPES, type AuthContext } from "@raisai/shared";
import { ModelPreferenceService } from "../src/services/model-preference-service";
import { GenerationService } from "../src/services/generation-service";
import { ModelSeedService } from "../src/services/model-seed-service";
import { FakeAIProvider } from "../src/providers/fake/fake-provider";
import { registerBuiltinNodes } from "../src/engine/nodes";

registerBuiltinNodes();
const FLUX = "@cf/black-forest-labs/flux-1-schnell";

async function context(orgId = newId()): Promise<AuthContext> {
  const userId = newId();
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)`)
    .bind(userId, `${userId}@example.com`, "h", "Picker").run();
  await env.DB.prepare(`INSERT OR IGNORE INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`)
    .bind(orgId, "Studio", userId).run();
  await env.DB.prepare(`INSERT OR IGNORE INTO balances (org_id, available_sen) VALUES (?, 50000)`).bind(orgId).run();
  return { userId, orgId, actorType: "user", scopes: SCOPES, requestId: newId(), isAdmin: false };
}

describe("model favourites", () => {
  it("marks and unmarks a model", async () => {
    const auth = await context();
    await new ModelSeedService(env).seed();
    const service = new ModelPreferenceService(env);

    await service.setFavourite(auth, FLUX, true);
    expect((await service.list(auth)).find((p) => p.modelId === FLUX)?.favourite).toBe(true);

    await service.setFavourite(auth, FLUX, false);
    expect((await service.list(auth)).find((p) => p.modelId === FLUX)?.favourite).toBe(false);
  });

  it("refuses a model that does not exist", async () => {
    const auth = await context();
    await expect(new ModelPreferenceService(env).setFavourite(auth, "@cf/not/real", true))
      .rejects.toMatchObject({ code: "model_not_found" });
  });

  it("keeps taste personal even inside one shared workspace", async () => {
    const orgId = newId();
    const mine = await context(orgId);
    const theirs = await context(orgId);
    await new ModelSeedService(env).seed();

    await new ModelPreferenceService(env).setFavourite(mine, FLUX, true);

    expect((await new ModelPreferenceService(env).list(theirs))).toHaveLength(0);
  });

  it("records a model as recently used when a generation runs", async () => {
    const auth = await context();
    await new ModelSeedService(env).seed();

    await new GenerationService(env).create(auth, { modelId: FLUX, prompt: "a cat", provider: new FakeAIProvider() });

    const preference = (await new ModelPreferenceService(env).list(auth)).find((p) => p.modelId === FLUX);
    expect(preference?.lastUsedAt).toBeTruthy();
    expect(preference?.useCount).toBe(1);
    // Using something is not the same as choosing it as a favourite.
    expect(preference?.favourite).toBe(false);
  });
});
