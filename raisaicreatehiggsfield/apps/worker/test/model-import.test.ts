import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { DISCOVERED_MODELS } from "@raisai/seed-models";
import { MODEL_STATUSES } from "@raisai/shared";
import { ModelSyncService } from "../src/services/model-sync-service";
import { ModelSeedService } from "../src/services/model-seed-service";
import { ModelRepository } from "../src/repositories/models";

describe("importing the published catalog", () => {
  it("adds every documented model as discovered", async () => {
    const result = await new ModelSyncService(env).importDocumented();
    expect(result.total).toBe(DISCOVERED_MODELS.length);
    expect(result.total).toBeGreaterThan(200);

    const all = await new ModelRepository(env).list({ statuses: [...MODEL_STATUSES] });
    const imported = all.filter((m) => DISCOVERED_MODELS.some((d) => d.id === m.id));
    // Nothing the import creates is usable: a price and a passing test come
    // first (§125). Retired models arrive already deprecated.
    expect(imported.every((m) => ["discovered", "deprecated", "enabled"].includes(m.status))).toBe(true);
  });

  it("never makes a newly imported model visible to a customer", async () => {
    const repo = new ModelRepository(env);
    const before = new Set((await repo.list({ statuses: [...MODEL_STATUSES] })).map((m) => m.id));

    await new ModelSyncService(env).importDocumented();

    const enabled = await repo.list({ statuses: ["enabled"] });
    // Models the import itself introduced. Anything already enabled was
    // enabled by an admin and is none of the import's business.
    const newlyEnabled = enabled.filter((m) => !before.has(m.id));
    expect(newlyEnabled).toEqual([]);
  });

  it("leaves a description someone wrote for customers alone", async () => {
    await new ModelSeedService(env).seed();
    const repo = new ModelRepository(env);
    const curated = (await repo.list({ statuses: [...MODEL_STATUSES] })).find(
      (m) => m.id === "@cf/black-forest-labs/flux-1-schnell",
    )!;

    await new ModelSyncService(env).importDocumented();

    const after = (await repo.list({ statuses: [...MODEL_STATUSES] })).find((m) => m.id === curated.id)!;
    expect(after.description).toBe(curated.description);
  });

  it("marks a model Cloudflare has retired as deprecated, not as something new", async () => {
    const retired = DISCOVERED_MODELS.filter((m) => m.status === "deprecated");
    expect(retired.length).toBeGreaterThan(0);
    expect(retired.every((m) => m.status !== "discovered")).toBe(true);
  });

  it("carries no leftover page markup into what a customer would read", async () => {
    const junk = ["Cloudflare-hosted", "Third-party", "Zero data retention", "https://", "](", "Function calling"];
    const dirty = DISCOVERED_MODELS.filter((m) => junk.some((j) => m.description.includes(j)));
    expect(dirty.map((m) => m.id)).toEqual([]);
  });

  it("does not disturb a model an admin already enabled", async () => {
    await new ModelSeedService(env).seed();
    const repo = new ModelRepository(env);
    const before = (await repo.list({ statuses: [...MODEL_STATUSES] })).find(
      (m) => m.id === "@cf/black-forest-labs/flux-1-schnell",
    )!;
    expect(before.status).toBe("enabled");

    await new ModelSyncService(env).importDocumented();

    const after = (await repo.list({ statuses: [...MODEL_STATUSES] })).find((m) => m.id === before.id)!;
    // Status, capabilities and hand-written controls all survive the import.
    expect(after.status).toBe("enabled");
    expect(after.capabilities).toEqual(before.capabilities);
    expect(after.parameters).toEqual(before.parameters);
  });

  it("is safe to run twice", async () => {
    const first = await new ModelSyncService(env).importDocumented();
    const second = await new ModelSyncService(env).importDocumented();
    expect(second.added).toBe(0);
    expect(first.added + first.untouched + first.describedAgain).toBe(first.total);
  });

  it("brings in video and music, which Workers AI does not host itself", async () => {
    await new ModelSyncService(env).importDocumented();
    const all = await new ModelRepository(env).list({ statuses: [...MODEL_STATUSES] });

    const video = all.filter((m) => m.category === "video");
    const music = all.filter((m) => m.capabilities.includes("music"));
    expect(video.length).toBeGreaterThan(10);
    expect(music.length).toBeGreaterThan(0);
    // These come through the gateway rather than Workers AI (ADR-002).
    expect(video.every((m) => m.hosting === "third-party")).toBe(true);
  });

  it("gives every imported model a shape the engine can read", async () => {
    await new ModelSyncService(env).importDocumented();
    const all = (await new ModelRepository(env).list({ statuses: [...MODEL_STATUSES] })).filter((m) =>
      DISCOVERED_MODELS.some((d) => d.id === m.id),
    );
    expect(all.length).toBeGreaterThan(200);

    for (const model of all) {
      expect(model.category).toBeTruthy();
      expect(model.displayName.trim()).not.toBe("");
      // Ports are what the node editor connects. A model with none could be
      // dropped on a canvas and wired to nothing.
      expect(Object.keys(model.outputs).length).toBeGreaterThan(0);
    }
  });
});
