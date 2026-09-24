import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId, SCOPES, type AuthContext } from "@raisai/shared";
import { MovieService } from "../src/services/movie-service";
import { ShotService } from "../src/services/shot-service";
import { ModelSeedService } from "../src/services/model-seed-service";
import { FakeAIProvider } from "../src/providers/fake/fake-provider";
import { registerBuiltinNodes } from "../src/engine/nodes";

registerBuiltinNodes();

async function context(): Promise<AuthContext> {
  const userId = newId();
  const orgId = newId();
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)`)
    .bind(userId, `${userId}@example.com`, "h", "Director").run();
  await env.DB.prepare(`INSERT INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`)
    .bind(orgId, "Studio", userId).run();
  await env.DB.prepare(`INSERT INTO balances (org_id, available_sen) VALUES (?, 200000)`).bind(orgId).run();
  return { userId, orgId, actorType: "user", scopes: SCOPES, requestId: newId(), isAdmin: false };
}

const STORY = {
  title: "Neon Rain",
  logline: "A detective chases a ghost through a flooded city.",
  synopsis: "A long paragraph about the case.",
  visualStyle: "wet neon, anamorphic, deep shadows",
  characters: [{ name: "Aiman", age: "32", description: "A tired detective", appearance: "grey coat", personality: "dogged" }],
  locations: [{ name: "Night Market", description: "Steam and neon signage", lighting: "hard neon" }],
  scenes: [
    {
      number: 1, title: "The Call", location: "Night Market", timeOfDay: "night",
      characters: ["Aiman"], action: "Aiman takes a call he does not want.",
      dialogue: [{ character: "Aiman", line: "I already told you no." }],
      shots: [{ number: 1, shotType: "wide", cameraMovement: "static", description: "Rain over the night market", durationSeconds: 5 }],
    },
  ],
};

/** A provider whose text model returns the treatment above. */
function storyteller() {
  const provider = new FakeAIProvider();
  const original = provider.execute.bind(provider);
  provider.execute = async (model, input, ctx) => {
    if (model.category === "text") {
      return {
        providerRequestId: "fake", status: "completed",
        output: { text: JSON.stringify(STORY) },
        usage: { unit: "tokens", measures: { tokensIn: 100, tokensOut: 900 } },
      };
    }
    return original(model, input, ctx);
  };
  return provider;
}

async function firstShot(auth: AuthContext) {
  await new ModelSeedService(env).seed();
  const movies = new MovieService(env);
  const movie = await movies.create(auth, { title: "Neon Rain", idea: "a detective story" });
  await movies.generateStory(auth, movie.id, { provider: storyteller() });
  const scenes = await movies.scenes(auth, movie.id);
  return scenes[0]!.shots[0]!;
}

describe("shot takes", () => {
  it("keeps the earlier picture when a shot is generated again", async () => {
    const auth = await context();
    const shot = await firstShot(auth);
    const service = new ShotService(env);
    const provider = new FakeAIProvider();

    const first = await service.generateImage(auth, shot.id, { provider });
    const second = await service.generateImage(auth, shot.id, { provider });

    const takes = await service.listTakes(auth, shot.id);
    expect(takes).toHaveLength(2);
    expect(takes.map((t) => t.version).sort()).toEqual([1, 2]);
    // Both pictures still exist. Regenerating must never destroy a take (§41).
    expect(new Set(takes.map((t) => t.assetId))).toEqual(new Set([first.assetId, second.assetId]));
  });

  it("goes back to an earlier take without generating anything", async () => {
    const auth = await context();
    const shot = await firstShot(auth);
    const service = new ShotService(env);
    const provider = new FakeAIProvider();

    const first = await service.generateImage(auth, shot.id, { provider });
    await service.generateImage(auth, shot.id, { provider });

    const takes = await service.listTakes(auth, shot.id);
    const original = takes.find((t) => t.version === 1)!;
    const callsBefore = provider.calls.length;

    await service.selectTake(auth, shot.id, original.id);

    const row = await env.DB.prepare(`SELECT image_asset_id, selected_image_version FROM shots WHERE id = ?`)
      .bind(shot.id).first<{ image_asset_id: string; selected_image_version: number }>();
    expect(row!.image_asset_id).toBe(first.assetId);
    expect(row!.selected_image_version).toBe(1);
    // Changing your mind costs nothing.
    expect(provider.calls.length).toBe(callsBefore);
  });

  it("writes camera settings into the prompt the model receives", async () => {
    const auth = await context();
    const shot = await firstShot(auth);
    const service = new ShotService(env);

    await service.updateShot(auth, shot.id, { cinematic: { lens: "anamorphic", lighting: "neon" } });

    const provider = new FakeAIProvider();
    await service.generateImage(auth, shot.id, { provider });

    const prompt = String(provider.calls[0]!.input.prompt);
    expect(prompt).toContain("Lens: anamorphic");
    expect(prompt).toContain("Lighting: neon");
  });

  it("setting one camera setting does not clear another", async () => {
    const auth = await context();
    const shot = await firstShot(auth);
    const service = new ShotService(env);

    await service.updateShot(auth, shot.id, { cinematic: { lens: "wide", lighting: "soft" } });
    const updated = await service.updateShot(auth, shot.id, { cinematic: { lens: "telephoto" } });

    const values = JSON.parse(updated.cinematic_json) as Record<string, string>;
    expect(values).toEqual({ lens: "telephoto", lighting: "soft" });
  });

  it("clears a camera setting when it is emptied", async () => {
    const auth = await context();
    const shot = await firstShot(auth);
    const service = new ShotService(env);

    await service.updateShot(auth, shot.id, { cinematic: { lens: "wide" } });
    const cleared = await service.updateShot(auth, shot.id, { cinematic: { lens: "" } });

    expect(JSON.parse(cleared.cinematic_json)).toEqual({});
  });

  it("refuses a shot length that could not be filmed", async () => {
    const auth = await context();
    const shot = await firstShot(auth);
    await expect(new ShotService(env).updateShot(auth, shot.id, { durationS: 0 }))
      .rejects.toMatchObject({ code: "invalid_input" });
  });
});
