import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId, SCOPES, type AuthContext } from "@raisai/shared";
import { MovieService } from "../src/services/movie-service";
import { ShotService } from "../src/services/shot-service";
import { LedgerService } from "../src/services/ledger-service";
import { ModelSeedService } from "../src/services/model-seed-service";
import { AssetService } from "../src/services/asset-service";
import { FakeAIProvider } from "../src/providers/fake/fake-provider";
import { extractJson, storySchema } from "../src/services/story-schema";
import { registerBuiltinNodes } from "../src/engine/nodes";

const STORY = {
  title: "Neon Rain",
  logline: "A detective chases a ghost through a flooded city.",
  synopsis: "A long paragraph about the case.",
  visualStyle: "wet neon, anamorphic, deep shadows",
  characters: [{ name: "Aiman", age: "32", description: "A tired detective", appearance: "grey coat, stubble", personality: "dogged" }],
  locations: [{ name: "Night Market", description: "Steam and neon signage", lighting: "hard neon, wet reflections" }],
  scenes: [
    {
      number: 1,
      title: "The Call",
      location: "Night Market",
      timeOfDay: "night",
      characters: ["Aiman"],
      action: "Aiman takes a call he does not want.",
      dialogue: [{ character: "Aiman", line: "I already told you no." }],
      shots: [
        { number: 1, shotType: "wide", cameraMovement: "static", description: "Rain over the night market", durationSeconds: 5 },
        { number: 2, shotType: "close-up", cameraMovement: "push in", description: "Aiman's face lit by a phone", durationSeconds: 3 },
      ],
    },
  ],
};

async function context(): Promise<AuthContext> {
  const userId = newId();
  const orgId = newId();
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)`)
    .bind(userId, `${userId}@example.com`, "h", "Director").run();
  await env.DB.prepare(`INSERT INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`)
    .bind(orgId, "Studio", userId).run();
  await env.DB.prepare(`INSERT INTO balances (org_id, available_sen) VALUES (?, 100000)`).bind(orgId).run();
  return { userId, orgId, actorType: "user", scopes: SCOPES, requestId: newId(), isAdmin: false };
}

/** A provider whose text model returns the treatment above. */
function storytellingProvider(reply: string = JSON.stringify(STORY)) {
  const provider = new FakeAIProvider();
  const original = provider.execute.bind(provider);
  provider.execute = async (model, input, ctx) => {
    if (model.category === "text") {
      return { providerRequestId: "fake", status: "completed", output: { text: reply }, usage: { unit: "tokens", measures: { tokensIn: 100, tokensOut: 900 } } };
    }
    return original(model, input, ctx);
  };
  return provider;
}

describe("story parsing", () => {
  it("reads JSON that arrives wrapped in a fence or prose", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! Here you go:\n{"a":2}\nHope that helps.')).toEqual({ a: 2 });
    expect(extractJson("not json at all")).toBeNull();
  });

  it("requires the pieces a movie is built from", () => {
    expect(storySchema.safeParse(STORY).success).toBe(true);
    // Prose with no scenes is not a movie, however good it reads.
    expect(storySchema.safeParse({ title: "x", logline: "y", synopsis: "z", scenes: [] }).success).toBe(false);
  });
});

describe("movie creation", () => {
  it("turns an idea into editable scenes and shots, not a blob of prose", async () => {
    registerBuiltinNodes();
    await new ModelSeedService(env).seed();
    const auth = await context();
    const movies = new MovieService(env);

    const movie = await movies.create(auth, {
      title: "Untitled",
      idea: "A cyberpunk detective story set in Kuala Lumpur",
      targetDurationSeconds: 600,
    });
    const { story } = await movies.generateStory(auth, movie.id, { provider: storytellingProvider() });

    expect(story.title).toBe("Neon Rain");
    const scenes = await movies.scenes(auth, movie.id);
    expect(scenes).toHaveLength(1);
    expect(scenes[0]!.shots).toHaveLength(2);
    // Each shot is its own row, so one can be redone without the others (§32).
    expect(scenes[0]!.shots[0]!.description).toContain("night market");

    const updated = await movies.require(auth, movie.id);
    expect(updated.title).toBe("Neon Rain");
    expect(updated.status).toBe("story");
  });

  it("stores characters and locations for reuse across the project", async () => {
    registerBuiltinNodes();
    await new ModelSeedService(env).seed();
    const auth = await context();
    const movies = new MovieService(env);
    const movie = await movies.create(auth, { title: "X", idea: "an idea" });
    await movies.generateStory(auth, movie.id, { provider: storytellingProvider() });

    const character = await env.DB
      .prepare(`SELECT name, appearance FROM characters WHERE project_id = ?`).bind(movie.project_id)
      .first<{ name: string; appearance: string }>();
    expect(character?.name).toBe("Aiman");
    expect(character?.appearance).toContain("grey coat");

    const location = await env.DB
      .prepare(`SELECT name FROM locations WHERE project_id = ?`).bind(movie.project_id).first<{ name: string }>();
    expect(location?.name).toBe("Night Market");
  });

  it("refuses a reply that is not a usable story rather than importing half of it", async () => {
    registerBuiltinNodes();
    await new ModelSeedService(env).seed();
    const auth = await context();
    const movies = new MovieService(env);
    const movie = await movies.create(auth, { title: "X", idea: "an idea" });

    await expect(
      movies.generateStory(auth, movie.id, { provider: storytellingProvider("I'd love to help! What genre?") }),
    ).rejects.toMatchObject({ code: "provider_error" });

    // Nothing was written, so there is no half-made movie to clean up.
    expect(await movies.scenes(auth, movie.id)).toHaveLength(0);
  });

  it("asks for an idea before trying to write anything", async () => {
    const auth = await context();
    const movies = new MovieService(env);
    const movie = await movies.create(auth, { title: "Empty" });
    await expect(movies.generateStory(auth, movie.id)).rejects.toMatchObject({ code: "invalid_input" });
  });
});

describe("shot generation", () => {
  async function movieWithShots() {
    registerBuiltinNodes();
    await new ModelSeedService(env).seed();
    const auth = await context();
    const movies = new MovieService(env);
    const movie = await movies.create(auth, { title: "X", idea: "an idea" });
    await movies.generateStory(auth, movie.id, { provider: storytellingProvider() });
    const scenes = await movies.scenes(auth, movie.id);
    return { auth, movie, movies, shot: scenes[0]!.shots[0]! };
  }

  it("builds a prompt carrying the scene, location, character and style", async () => {
    const { auth, movie, movies, shot } = await movieWithShots();
    const scenes = await movies.scenes(auth, movie.id);
    const prompt = await new ShotService(env).buildPrompt(shot, scenes[0]!, await movies.require(auth, movie.id));

    // A shot generated alone must still look like it belongs to the same film.
    expect(prompt).toContain("Rain over the night market");
    expect(prompt).toContain("wide shot");
    expect(prompt).toContain("Night Market");
    expect(prompt).toContain("hard neon");
    expect(prompt).toContain("Aiman: grey coat");
    expect(prompt).toContain("wet neon, anamorphic");
  });

  it("generates a storyboard image and records what it cost", async () => {
    const { auth, shot } = await movieWithShots();
    const before = await new LedgerService(env).getBalance(auth.orgId);

    const result = await new ShotService(env).generateImage(auth, shot.id, { provider: new FakeAIProvider() });
    expect(result.status).toBe("image_ready");
    expect(result.assetId).toBeTruthy();

    const stored = await env.DB.prepare(`SELECT status, cost_sen, image_asset_id FROM shots WHERE id = ?`)
      .bind(shot.id).first<{ status: string; cost_sen: number; image_asset_id: string }>();
    expect(stored?.status).toBe("image_ready");
    expect(stored?.cost_sen).toBe(result.chargedSen);

    const after = await new LedgerService(env).getBalance(auth.orgId);
    expect(before.availableSen - after.availableSen).toBe(result.chargedSen);
  });

  it("will not animate a shot that has no picture yet", async () => {
    const { auth, shot } = await movieWithShots();
    await expect(
      new ShotService(env).generateVideo(auth, shot.id, { provider: new FakeAIProvider() }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("quotes a shot before it is generated", async () => {
    const { auth, shot } = await movieWithShots();
    const estimate = await new ShotService(env).estimate(auth, shot.id, "image");
    expect(estimate.estimatedSen).toBeGreaterThan(0);
    expect(estimate.modelId).toBeTruthy();
  });

  it("passes a character's reference image through for consistency", async () => {
    const { auth, movie, shot } = await movieWithShots();
    // Give the character a reference the way the UI would.
    const asset = await new AssetService(env).create(auth, {
      projectId: movie.project_id, name: "aiman.png", mime: "image/png",
      bytes: new Uint8Array([137, 80, 78, 71]).buffer as ArrayBuffer, source: "upload",
    });
    await env.DB
      .prepare(`UPDATE characters SET reference_asset_ids_json = ? WHERE project_id = ? AND name = 'Aiman'`)
      .bind(JSON.stringify([asset.id]), movie.project_id)
      .run();

    const provider = new FakeAIProvider();
    // A vision-capable model is the enabled one that accepts an image.
    await new ShotService(env).generateImage(auth, shot.id, {
      modelId: "@cf/meta/llama-3.2-11b-vision-instruct",
      provider,
    });
    expect(provider.calls[0]!.input.images).toHaveLength(1);
  });

  it("keeps a movie's shots out of another workspace's reach", async () => {
    const { shot } = await movieWithShots();
    const stranger = await context();
    await expect(new MovieService(env).requireShot(stranger, shot.id)).rejects.toMatchObject({ code: "not_found" });
  });
});
