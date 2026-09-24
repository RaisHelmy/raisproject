import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId, SCOPES, type AuthContext } from "@raisai/shared";
import { CastService } from "../src/services/cast-service";
import { ProjectService } from "../src/services/project-service";
import { AssetService } from "../src/services/asset-service";
import { ShotService } from "../src/services/shot-service";
import { MovieService } from "../src/services/movie-service";
import { ModelSeedService } from "../src/services/model-seed-service";
import { FakeAIProvider } from "../src/providers/fake/fake-provider";
import { registerBuiltinNodes } from "../src/engine/nodes";

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer as ArrayBuffer;

async function context(): Promise<AuthContext> {
  const userId = newId();
  const orgId = newId();
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)`)
    .bind(userId, `${userId}@example.com`, "h", "Caster").run();
  await env.DB.prepare(`INSERT INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`)
    .bind(orgId, "Studio", userId).run();
  await env.DB.prepare(`INSERT INTO balances (org_id, available_sen) VALUES (?, 50000)`).bind(orgId).run();
  return { userId, orgId, actorType: "user", scopes: SCOPES, requestId: newId(), isAdmin: false };
}

describe("characters and locations", () => {
  it("keeps a character with everything a shot prompt needs", async () => {
    const auth = await context();
    const project = await new ProjectService(env).getOrCreateDefault(auth);
    const character = await new CastService(env).createCharacter(auth, project.id, {
      name: "Aiman", age: "32", appearance: "grey coat, stubble", personality: "dogged",
    });

    expect(character.name).toBe("Aiman");
    expect(character.appearance).toContain("grey coat");
  });

  it("insists on a name", async () => {
    const auth = await context();
    const project = await new ProjectService(env).getOrCreateDefault(auth);
    await expect(new CastService(env).createCharacter(auth, project.id, { name: "  " }))
      .rejects.toMatchObject({ code: "invalid_input" });
  });

  it("stores a voice so a character sounds the same in every scene", async () => {
    const auth = await context();
    const project = await new ProjectService(env).getOrCreateDefault(auth);
    const service = new CastService(env);
    const character = await service.createCharacter(auth, project.id, { name: "Aiman" });

    const updated = await service.updateCharacter(auth, character.id, {
      voice: { modelId: "@cf/myshell-ai/melotts", lang: "en" },
    });
    expect(JSON.parse(updated.voice_json)).toMatchObject({ modelId: "@cf/myshell-ai/melotts", lang: "en" });
  });

  it("refuses a reference image from another workspace", async () => {
    const owner = await context();
    const stranger = await context();
    const ownerProject = await new ProjectService(env).getOrCreateDefault(owner);
    const strangerProject = await new ProjectService(env).getOrCreateDefault(stranger);

    const theirAsset = await new AssetService(env).create(stranger, {
      projectId: strangerProject.id, name: "theirs.png", mime: "image/png", bytes: PNG, source: "upload",
    });

    // A reference id is later handed to a model, so accepting a foreign one
    // would be a way to read someone else's file.
    await expect(
      new CastService(env).createCharacter(owner, ownerProject.id, { name: "Thief", referenceAssetIds: [theirAsset.id] }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("leaves references alone when an edit does not mention them", async () => {
    const auth = await context();
    const project = await new ProjectService(env).getOrCreateDefault(auth);
    const asset = await new AssetService(env).create(auth, {
      projectId: project.id, name: "face.png", mime: "image/png", bytes: PNG, source: "upload",
    });
    const service = new CastService(env);
    const character = await service.createCharacter(auth, project.id, { name: "Aiman", referenceAssetIds: [asset.id] });

    const renamed = await service.updateCharacter(auth, character.id, { name: "Aiman Rahman" });
    expect(JSON.parse(renamed.reference_asset_ids_json)).toEqual([asset.id]);
  });

  it("carries a character's reference into the shot that features them", async () => {
    registerBuiltinNodes();
    await new ModelSeedService(env).seed();
    const auth = await context();
    const movies = new MovieService(env);
    const movie = await movies.create(auth, { title: "M", idea: "an idea" });

    // Build the scene by hand so the test is about references, not planning.
    const sceneId = newId();
    const shotId = newId();
    await env.DB.prepare(
      `INSERT INTO scenes (id, movie_id, number, title, characters_json, dialogue_json) VALUES (?,?,1,'S',?,'[]')`,
    ).bind(sceneId, movie.id, JSON.stringify(["Aiman"])).run();
    await env.DB.prepare(
      `INSERT INTO shots (id, scene_id, number, description, duration_s) VALUES (?,?,1,'a face in the rain',4)`,
    ).bind(shotId, sceneId).run();

    const asset = await new AssetService(env).create(auth, {
      projectId: movie.project_id, name: "aiman.png", mime: "image/png", bytes: PNG, source: "upload",
    });
    await new CastService(env).createCharacter(auth, movie.project_id, {
      name: "Aiman", appearance: "grey coat", referenceAssetIds: [asset.id],
    });

    const provider = new FakeAIProvider();
    await new ShotService(env).generateImage(auth, shotId, {
      modelId: "@cf/meta/llama-3.2-11b-vision-instruct",
      provider,
    });

    // This is the whole of character consistency: the reference reaches the model.
    expect(provider.calls[0]!.input.images).toHaveLength(1);
    expect(provider.calls[0]!.input.prompt).toContain("Aiman: grey coat");
  });

  it("keeps a cast scoped to its workspace", async () => {
    const auth = await context();
    const stranger = await context();
    const project = await new ProjectService(env).getOrCreateDefault(auth);
    const character = await new CastService(env).createCharacter(auth, project.id, { name: "Private" });

    await expect(new CastService(env).requireCharacter(stranger, character.id))
      .rejects.toMatchObject({ code: "not_found" });
  });

  it("keeps locations the same way, for reuse across scenes", async () => {
    const auth = await context();
    const project = await new ProjectService(env).getOrCreateDefault(auth);
    const service = new CastService(env);
    const location = await service.createLocation(auth, project.id, {
      name: "Night Market", lighting: "hard neon, wet reflections",
    });

    expect((await service.listLocations(auth, project.id)).map((l) => l.name)).toEqual(["Night Market"]);
    expect(location.lighting).toContain("hard neon");
  });
});
