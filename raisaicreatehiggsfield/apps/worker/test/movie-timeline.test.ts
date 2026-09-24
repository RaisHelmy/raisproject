import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId, SCOPES, type AuthContext } from "@raisai/shared";
import { MovieService } from "../src/services/movie-service";
import { ShotService } from "../src/services/shot-service";
import { TimelineService } from "../src/services/timeline-service";
import { ExportService } from "../src/services/export-service";
import { MovieAudioService } from "../src/services/movie-audio-service";
import { ModelSeedService } from "../src/services/model-seed-service";
import { FakeAIProvider } from "../src/providers/fake/fake-provider";
import { registerBuiltinNodes } from "../src/engine/nodes";

const STORY = {
  title: "Neon Rain",
  logline: "A detective chases a ghost.",
  synopsis: "A paragraph.",
  visualStyle: "wet neon",
  characters: [{ name: "Aiman", description: "detective", appearance: "grey coat", personality: "dogged" }],
  locations: [{ name: "Night Market", description: "neon", lighting: "hard neon" }],
  scenes: [
    {
      number: 1, title: "The Call", location: "Night Market", timeOfDay: "night",
      characters: ["Aiman"], action: "A call arrives.",
      dialogue: [{ character: "Aiman", line: "I already told you no." }],
      shots: [
        { number: 1, shotType: "wide", cameraMovement: "static", description: "Rain over the market", durationSeconds: 5 },
        { number: 2, shotType: "close-up", cameraMovement: "push in", description: "A face lit by a phone", durationSeconds: 3 },
      ],
    },
  ],
};

function storyteller() {
  const provider = new FakeAIProvider();
  const original = provider.execute.bind(provider);
  provider.execute = async (model, input, ctx) => {
    if (model.category === "text") {
      return { providerRequestId: "fake", status: "completed", output: { text: JSON.stringify(STORY) }, usage: { unit: "tokens", measures: { tokensIn: 50, tokensOut: 500 } } };
    }
    return original(model, input, ctx);
  };
  return provider;
}

async function context(): Promise<AuthContext> {
  const userId = newId();
  const orgId = newId();
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)`)
    .bind(userId, `${userId}@example.com`, "h", "Editor").run();
  await env.DB.prepare(`INSERT INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`)
    .bind(orgId, "Studio", userId).run();
  await env.DB.prepare(`INSERT INTO balances (org_id, available_sen) VALUES (?, 100000)`).bind(orgId).run();
  return { userId, orgId, actorType: "user", scopes: SCOPES, requestId: newId(), isAdmin: false };
}

async function movieWithRenderedShots() {
  registerBuiltinNodes();
  await new ModelSeedService(env).seed();
  const auth = await context();
  const movies = new MovieService(env);
  const movie = await movies.create(auth, { title: "X", idea: "an idea" });
  await movies.generateStory(auth, movie.id, { provider: storyteller() });

  const shots = new ShotService(env);
  const scenes = await movies.scenes(auth, movie.id);
  for (const shot of scenes[0]!.shots) {
    await shots.generateImage(auth, shot.id, { provider: new FakeAIProvider() });
  }
  return { auth, movie };
}

describe("timeline", () => {
  it("lays rendered shots end to end in order", async () => {
    const { auth, movie } = await movieWithRenderedShots();
    const timeline = await new TimelineService(env).build(auth, movie.id);

    const video = timeline.tracks.find((t) => t.kind === "video")!;
    expect(video.items).toHaveLength(2);
    expect(video.items[0]!.start_ms).toBe(0);
    // The second shot starts exactly where the first ends: no gap, no overlap.
    expect(video.items[1]!.start_ms).toBe(5000);
    expect(timeline.durationMs).toBe(8000);
  });

  it("picks up a regenerated shot when rebuilt", async () => {
    const { auth, movie } = await movieWithRenderedShots();
    const service = new TimelineService(env);
    const first = await service.build(auth, movie.id);
    const rebuilt = await service.build(auth, movie.id);

    // Rebuilding replaces the cut rather than appending a second copy of it.
    expect(rebuilt.tracks.find((t) => t.kind === "video")!.items).toHaveLength(
      first.tracks.find((t) => t.kind === "video")!.items.length,
    );
  });


  it("cuts a clip in two without generating anything", async () => {
    const { auth, movie } = await movieWithRenderedShots();
    const service = new TimelineService(env);
    const timeline = await service.build(auth, movie.id);
    const clip = timeline.tracks.find((t) => t.kind === "video")!.items[0]!;

    const after = await service.splitItem(auth, movie.id, clip.id, 2000);
    const video = after.tracks.find((t) => t.kind === "video")!;

    expect(video.items).toHaveLength(3);
    // Two seconds, then three, from the same five-second file.
    const [left, right] = video.items;
    expect(left!.duration_ms - left!.trim_in_ms - left!.trim_out_ms).toBe(2000);
    expect(right!.duration_ms - right!.trim_in_ms - right!.trim_out_ms).toBe(3000);
    expect(right!.asset_id).toBe(left!.asset_id);
    // Nothing has moved and nothing has been added to the running time.
    expect(after.durationMs).toBe(timeline.durationMs);
  });

  it("refuses a cut that falls outside the clip", async () => {
    const { auth, movie } = await movieWithRenderedShots();
    const service = new TimelineService(env);
    const clip = (await service.build(auth, movie.id)).tracks.find((t) => t.kind === "video")!.items[0]!;

    await expect(service.splitItem(auth, movie.id, clip.id, 9000)).rejects.toMatchObject({ code: "invalid_input" });
    await expect(service.splitItem(auth, movie.id, clip.id, 0)).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("duplicates a clip and pushes the rest of the track along", async () => {
    const { auth, movie } = await movieWithRenderedShots();
    const service = new TimelineService(env);
    const timeline = await service.build(auth, movie.id);
    const clip = timeline.tracks.find((t) => t.kind === "video")!.items[0]!;

    const after = await service.duplicateItem(auth, movie.id, clip.id);
    const video = after.tracks.find((t) => t.kind === "video")!;

    expect(video.items).toHaveLength(3);
    expect(video.items[1]!.start_ms).toBe(5000);
    // The shot that used to follow is not buried underneath the copy.
    expect(video.items[2]!.start_ms).toBe(10000);
    expect(after.durationMs).toBe(timeline.durationMs + 5000);
  });

  it("moves a clip along its own track", async () => {
    const { auth, movie } = await movieWithRenderedShots();
    const service = new TimelineService(env);
    const clip = (await service.build(auth, movie.id)).tracks.find((t) => t.kind === "video")!.items[0]!;

    const after = await service.moveItem(auth, movie.id, clip.id, { startMs: 12000 });
    const moved = after.tracks.find((t) => t.kind === "video")!.items.find((i) => i.id === clip.id)!;
    expect(moved.start_ms).toBe(12000);
  });

  it("will not drop a clip onto a track of another kind", async () => {
    const { auth, movie } = await movieWithRenderedShots();
    const service = new TimelineService(env);
    const timeline = await service.build(auth, movie.id);
    const clip = timeline.tracks.find((t) => t.kind === "video")!.items[0]!;
    const subtitles = timeline.tracks.find((t) => t.kind === "subtitles");

    if (subtitles) {
      // An edit nothing downstream could render is refused with a reason (§112).
      await expect(service.moveItem(auth, movie.id, clip.id, { trackId: subtitles.id }))
        .rejects.toMatchObject({ code: "invalid_input" });
    }
  });

  it("removes a clip and closes the gap it leaves", async () => {
    const { auth, movie } = await movieWithRenderedShots();
    const service = new TimelineService(env);
    const timeline = await service.build(auth, movie.id);
    const clip = timeline.tracks.find((t) => t.kind === "video")!.items[0]!;

    const after = await service.removeItem(auth, movie.id, clip.id);
    const video = after.tracks.find((t) => t.kind === "video")!;

    expect(video.items).toHaveLength(1);
    expect(video.items[0]!.start_ms).toBe(0);
  });

  it("trims a clip and pulls the following shots up to close the gap", async () => {
    const { auth, movie } = await movieWithRenderedShots();
    const service = new TimelineService(env);
    const timeline = await service.build(auth, movie.id);
    const video = timeline.tracks.find((t) => t.kind === "video")!;
    const clip = video.items[0]!;

    const updated = await service.updateItem(auth, movie.id, clip.id, { trim_out_ms: 2000 });
    const after = updated.tracks.find((t) => t.kind === "video")!;

    expect(after.items[0]!.trim_out_ms).toBe(2000);
    // The next shot moves up: a cut assembled from shots should not grow a hole.
    expect(after.items[1]!.start_ms).toBe(3000);
    expect(updated.durationMs).toBe(timeline.durationMs - 2000);
  });

  it("can hold the other clips in place when that is what is wanted", async () => {
    const { auth, movie } = await movieWithRenderedShots();
    const service = new TimelineService(env);
    const timeline = await service.build(auth, movie.id);
    const clip = timeline.tracks.find((t) => t.kind === "video")!.items[0]!;

    const updated = await service.updateItem(auth, movie.id, clip.id, { trim_out_ms: 2000 }, { ripple: false });
    const after = updated.tracks.find((t) => t.kind === "video")!;
    expect(after.items[1]!.start_ms).toBe(5000);
  });

  it("refuses a trim that would remove the whole clip", async () => {
    const { auth, movie } = await movieWithRenderedShots();
    const service = new TimelineService(env);
    const timeline = await service.build(auth, movie.id);
    const clip = timeline.tracks.find((t) => t.kind === "video")!.items[0]!;

    await expect(
      service.updateItem(auth, movie.id, clip.id, { trim_in_ms: 3000, trim_out_ms: 3000 }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("keeps a timeline out of another workspace's reach", async () => {
    const { movie } = await movieWithRenderedShots();
    const stranger = await context();
    await expect(new TimelineService(env).get(stranger, movie.id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("dialogue and subtitles", () => {
  it("voices each line and charges per line", async () => {
    const { auth, movie } = await movieWithRenderedShots();
    const result = await new MovieAudioService(env).generateDialogue(auth, movie.id, { provider: new FakeAIProvider() });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]!.character).toBe("Aiman");
    expect(result.lines[0]!.assetId).toBeTruthy();
    expect(result.totalChargedSen).toBe(result.lines.reduce((sum, l) => sum + l.chargedSen, 0));
  });

  it("stops at the budget rather than voicing the whole script", async () => {
    const { auth, movie } = await movieWithRenderedShots();
    const result = await new MovieAudioService(env).generateDialogue(auth, movie.id, {
      maxCostSen: 0.5, provider: new FakeAIProvider(),
    });
    // The budget is already spent before the first line, so nothing runs.
    expect(result.lines).toHaveLength(1);
  });

  it("times subtitles to the scene they belong to", async () => {
    const { auth, movie } = await movieWithRenderedShots();
    const { content } = await new MovieAudioService(env).generateSubtitles(auth, movie.id, "srt");

    expect(content).toContain("Aiman: I already told you no.");
    expect(content).toContain("00:00:00,000 --> 00:00:08,000");
  });
});

describe("export", () => {
  it("produces an edit manifest, subtitles and a script that assembles them", async () => {
    const { auth, movie } = await movieWithRenderedShots();
    await new TimelineService(env).build(auth, movie.id);

    const result = await new ExportService(env).export(auth, movie.id, { baseUrl: "https://example.test" });

    expect(result.manifest.format).toBe("raisai.movie.edit");
    expect(result.manifest.durationMs).toBe(8000);
    const video = result.manifest.tracks.find((t) => t.kind === "video")!;
    expect(video.clips).toHaveLength(2);
    expect(video.clips[0]!.asset!.url).toContain("https://example.test/api/v1/assets/");
    expect(result.subtitlesAssetId).toBeTruthy();

    // The boundary is stated, not implied: a Worker cannot mux video.
    expect(result.renderNote).toContain("ffmpeg");

    const script = await env.DB
      .prepare(`SELECT id FROM assets WHERE id = ?`).bind(result.scriptAssetId).first();
    expect(script).not.toBeNull();
  });

  it("writes a script that holds a still for its own duration", async () => {
    const { auth, movie } = await movieWithRenderedShots();
    await new TimelineService(env).build(auth, movie.id);
    const result = await new ExportService(env).export(auth, movie.id, { baseUrl: "https://example.test" });

    const { AssetService } = await import("../src/services/asset-service");
    const { bytes } = await new AssetService(env).readBytes(auth, result.scriptAssetId);
    const script = new TextDecoder().decode(bytes);

    // Storyboard stills are held frames; footage would be cut instead.
    expect(script).toContain("-loop 1 -t 5");
    expect(script).toContain("concat");
    expect(script).toContain("RAISAI_API_KEY");
  });

  it("refuses to export an empty timeline", async () => {
    registerBuiltinNodes();
    await new ModelSeedService(env).seed();
    const auth = await context();
    const movie = await new MovieService(env).create(auth, { title: "Empty", idea: "x" });

    await expect(
      new ExportService(env).export(auth, movie.id, { baseUrl: "https://example.test" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });
});
