import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId, SCOPES, type AuthContext } from "@raisai/shared";
import { ThumbnailService } from "../src/services/thumbnail-service";
import { AssetService } from "../src/services/asset-service";
import { ProjectService } from "../src/services/project-service";

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]).buffer as ArrayBuffer;

async function context(): Promise<AuthContext> {
  const userId = newId();
  const orgId = newId();
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)`)
    .bind(userId, `${userId}@example.com`, "h", "Thumb").run();
  await env.DB.prepare(`INSERT INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`)
    .bind(orgId, "W", userId).run();
  await env.DB.prepare(`INSERT INTO balances (org_id) VALUES (?)`).bind(orgId).run();
  return { userId, orgId, actorType: "user", scopes: SCOPES, requestId: newId(), isAdmin: false };
}

describe("thumbnails", () => {
  it("stores a thumbnail for an image and records the key", async () => {
    const auth = await context();
    const project = await new ProjectService(env).getOrCreateDefault(auth);
    const assets = new AssetService(env);
    const asset = await assets.create(auth, {
      projectId: project.id, name: "shot.png", mime: "image/png", bytes: PNG, source: "generation",
    });
    const version = await assets.getVersion(auth, asset.id);

    const result = await new ThumbnailService(env).generate({
      kind: "thumbnail", assetId: asset.id, orgId: auth.orgId, projectId: project.id,
      version: asset.current_version, r2Key: version.r2_key, mime: asset.mime,
    });

    // Without the Images binding the original stands in, and the grid still works.
    expect(result.key).toContain("-thumb.jpg");
    expect(await env.ASSETS.get(result.key)).not.toBeNull();

    const updated = await assets.require(auth, asset.id);
    expect(updated.thumbnail_key).toBe(result.key);
  });

  it("leaves non-image assets alone rather than storing a broken preview", async () => {
    const auth = await context();
    const project = await new ProjectService(env).getOrCreateDefault(auth);
    const assets = new AssetService(env);
    const asset = await assets.create(auth, {
      projectId: project.id, name: "voice.mp3", mime: "audio/mpeg", bytes: PNG, source: "generation",
    });
    const version = await assets.getVersion(auth, asset.id);

    const result = await new ThumbnailService(env).generate({
      kind: "thumbnail", assetId: asset.id, orgId: auth.orgId, projectId: project.id,
      version: asset.current_version, r2Key: version.r2_key, mime: asset.mime,
    });
    expect(result.resized).toBe(false);
    expect(result.key).toBe(version.r2_key);
  });
});
