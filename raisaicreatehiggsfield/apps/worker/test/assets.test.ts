import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId, SCOPES, type AuthContext } from "@raisai/shared";
import { AssetService } from "../src/services/asset-service";
import { ProjectService } from "../src/services/project-service";

async function context(): Promise<AuthContext> {
  const userId = newId();
  const orgId = newId();
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)`)
    .bind(userId, `${userId}@example.com`, "h", "Asset User").run();
  await env.DB.prepare(`INSERT INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`)
    .bind(orgId, "W", userId).run();
  await env.DB.prepare(`INSERT INTO balances (org_id) VALUES (?)`).bind(orgId).run();
  return { userId, orgId, actorType: "user", scopes: SCOPES, requestId: newId(), isAdmin: false };
}

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer as ArrayBuffer;

describe("AssetService", () => {
  it("stores bytes in R2 and metadata in D1", async () => {
    const ctx = await context();
    const project = await new ProjectService(env).getOrCreateDefault(ctx);
    const assets = new AssetService(env);

    const asset = await assets.create(ctx, {
      projectId: project.id, name: "street.png", mime: "image/png",
      bytes: PNG, source: "generation", width: 1024, height: 1024,
    });

    expect(asset.kind).toBe("image");
    expect(asset.current_version).toBe(1);

    const version = await assets.getVersion(ctx, asset.id);
    expect(version.r2_key).toContain(`org/${ctx.orgId}/project/${project.id}/${asset.id}/v1.png`);

    const stored = await env.ASSETS.get(version.r2_key);
    expect(stored).not.toBeNull();
    // D1 holds metadata only; the bytes live in R2 (§68).
    expect((await stored!.arrayBuffer()).byteLength).toBe(PNG.byteLength);
  });

  it("adds a version without destroying the previous one", async () => {
    const ctx = await context();
    const project = await new ProjectService(env).getOrCreateDefault(ctx);
    const assets = new AssetService(env);
    const asset = await assets.create(ctx, {
      projectId: project.id, name: "shot.png", mime: "image/png", bytes: PNG, source: "generation",
    });

    const v2Bytes = new Uint8Array([1, 2, 3, 4]).buffer as ArrayBuffer;
    const updated = await assets.addVersion(ctx, asset.id, { mime: "image/png", bytes: v2Bytes });
    expect(updated.current_version).toBe(2);

    // Version 1 is still readable, which is what makes "keep previous version" work (§41).
    const v1 = await assets.readBytes(ctx, asset.id, 1);
    const v2 = await assets.readBytes(ctx, asset.id, 2);
    expect(v1.bytes.byteLength).toBe(PNG.byteLength);
    expect(v2.bytes.byteLength).toBe(4);
  });

  it("refuses to read another workspace's asset", async () => {
    const owner = await context();
    const stranger = await context();
    const project = await new ProjectService(env).getOrCreateDefault(owner);
    const assets = new AssetService(env);
    const asset = await assets.create(owner, {
      projectId: project.id, name: "private.png", mime: "image/png", bytes: PNG, source: "upload",
    });

    await expect(assets.require(stranger, asset.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects a project from another workspace", async () => {
    const owner = await context();
    const stranger = await context();
    const project = await new ProjectService(env).getOrCreateDefault(owner);

    await expect(
      new AssetService(env).create(stranger, {
        projectId: project.id, name: "x.png", mime: "image/png", bytes: PNG, source: "upload",
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("hides soft-deleted assets but keeps the stored file", async () => {
    const ctx = await context();
    const project = await new ProjectService(env).getOrCreateDefault(ctx);
    const assets = new AssetService(env);
    const asset = await assets.create(ctx, {
      projectId: project.id, name: "temp.png", mime: "image/png", bytes: PNG, source: "upload",
    });
    const key = (await assets.getVersion(ctx, asset.id)).r2_key;

    await assets.softDelete(ctx, asset.id);
    expect(await assets.findById(ctx, asset.id)).toBeNull();
    expect(await env.ASSETS.get(key)).not.toBeNull();
  });

  it("lists assets filtered by kind, newest first", async () => {
    const ctx = await context();
    const project = await new ProjectService(env).getOrCreateDefault(ctx);
    const assets = new AssetService(env);
    await assets.create(ctx, { projectId: project.id, name: "a.png", mime: "image/png", bytes: PNG, source: "upload" });
    await assets.create(ctx, { projectId: project.id, name: "b.mp3", mime: "audio/mpeg", bytes: PNG, source: "generation" });

    const images = await assets.list(ctx, { kind: "image" });
    expect(images.items).toHaveLength(1);
    expect(images.items[0]!.name).toBe("a.png");
  });
});

describe("ProjectService", () => {
  it("gives a new workspace a default project instead of an empty screen", async () => {
    const ctx = await context();
    const service = new ProjectService(env);
    const first = await service.getOrCreateDefault(ctx);
    const again = await service.getOrCreateDefault(ctx);
    expect(again.id).toBe(first.id);
    expect(first.name).toBe("My first project");
  });

  it("keeps projects scoped to their workspace", async () => {
    const owner = await context();
    const stranger = await context();
    const project = await new ProjectService(env).create(owner, { name: "Cyberpunk Movie" });
    await expect(new ProjectService(env).require(stranger, project.id)).rejects.toMatchObject({ code: "not_found" });
  });
});
