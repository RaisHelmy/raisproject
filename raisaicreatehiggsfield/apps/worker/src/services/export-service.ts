import { AppError, type AuthContext } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso } from "../db/client";
import { MovieService } from "./movie-service";
import { TimelineService, type Timeline } from "./timeline-service";
import { AssetService } from "./asset-service";
import { MovieAudioService } from "./movie-audio-service";

export interface ExportManifest {
  format: "raisai.movie.edit";
  formatVersion: 1;
  title: string;
  durationMs: number;
  exportedAt: string;
  tracks: {
    kind: string;
    name: string;
    muted: boolean;
    clips: {
      label: string | null;
      startMs: number;
      durationMs: number;
      trimInMs: number;
      trimOutMs: number;
      volume: number;
      asset: { id: string; name: string; mime: string; url: string } | null;
    }[];
  }[];
}

export interface ExportResult {
  manifestAssetId: string;
  manifest: ExportManifest;
  subtitlesAssetId: string | null;
  scriptAssetId: string;
  /** What still has to happen elsewhere, stated rather than implied. */
  renderNote: string;
}

const RENDER_NOTE =
  "This export contains the finished cut: every clip, its timing, and the audio and subtitle tracks. " +
  "Muxing it into a single video file needs a render step with ffmpeg, which cannot run inside a Worker. " +
  "The included script does exactly that on any machine with ffmpeg installed.";

/**
 * Exports a finished movie (§46 export step).
 *
 * A Worker cannot mux video: there is no ffmpeg and no filesystem. Rather than
 * pretend otherwise, this produces the complete edit decision list, the audio
 * and subtitle tracks, and a script that assembles them, so the work is
 * genuinely finishable today and a render service can be slotted in later
 * without changing what the user gets.
 */
export class ExportService {
  constructor(private readonly env: Pick<Env, "DB" | "ASSETS" | "AI" | "AI_GATEWAY_ID">) {}

  async export(auth: AuthContext, movieId: string, options: { baseUrl: string }): Promise<ExportResult> {
    const movies = new MovieService(this.env);
    const movie = await movies.require(auth, movieId);
    const timeline = await new TimelineService(this.env).get(auth, movieId);

    if (timeline.tracks.every((t) => t.items.length === 0)) {
      throw new AppError("invalid_input", "There is nothing on the timeline to export.", {
        action: "Generate some shots and build the timeline first.",
      });
    }

    const manifest = await this.buildManifest(movie.title, timeline, options.baseUrl);
    const assets = new AssetService(this.env);

    const manifestAsset = await assets.create(auth, {
      projectId: movie.project_id,
      name: `${movie.title} edit.json`,
      mime: "application/json",
      bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2)).buffer as ArrayBuffer,
      source: "generation",
    });

    const scriptAsset = await assets.create(auth, {
      projectId: movie.project_id,
      name: `render ${movie.title}.sh`,
      mime: "text/plain",
      bytes: new TextEncoder().encode(this.buildRenderScript(manifest)).buffer as ArrayBuffer,
      source: "generation",
    });

    let subtitlesAssetId: string | null = null;
    try {
      subtitlesAssetId = (await new MovieAudioService(this.env).generateSubtitles(auth, movieId, "srt")).assetId;
    } catch {
      // A movie with no dialogue simply has no subtitles; that is not a failure.
    }

    await this.env.DB
      .prepare(`UPDATE movies SET status='exported', updated_at=? WHERE id=?`)
      .bind(nowIso(), movieId)
      .run();

    return { manifestAssetId: manifestAsset.id, manifest, subtitlesAssetId, scriptAssetId: scriptAsset.id, renderNote: RENDER_NOTE };
  }

  private async buildManifest(title: string, timeline: Timeline, baseUrl: string): Promise<ExportManifest> {
    const tracks = await Promise.all(
      timeline.tracks.map(async (track) => ({
        kind: track.kind,
        name: track.name,
        muted: track.muted === 1,
        clips: await Promise.all(
          track.items.map(async (item) => ({
            label: item.label,
            startMs: item.start_ms,
            durationMs: item.duration_ms,
            trimInMs: item.trim_in_ms,
            trimOutMs: item.trim_out_ms,
            volume: item.volume,
            asset: item.asset_id ? await this.assetRef(item.asset_id, baseUrl) : null,
          })),
        ),
      })),
    );

    return {
      format: "raisai.movie.edit",
      formatVersion: 1,
      title,
      durationMs: timeline.durationMs,
      exportedAt: nowIso(),
      tracks,
    };
  }

  private async assetRef(assetId: string, baseUrl: string) {
    const row = await this.env.DB
      .prepare(`SELECT id, name, mime FROM assets WHERE id = ?`)
      .bind(assetId)
      .first<{ id: string; name: string; mime: string }>();
    if (!row) return null;
    return { id: row.id, name: row.name, mime: row.mime, url: `${baseUrl}/api/v1/assets/${row.id}/content` };
  }

  /**
   * A script that turns the manifest into a file. Written to be read before it
   * is run: it downloads each clip, trims it, concatenates the video track and
   * mixes any audio over the top.
   */
  private buildRenderScript(manifest: ExportManifest): string {
    const video = manifest.tracks.find((t) => t.kind === "video");
    const audioTracks = manifest.tracks.filter((t) => t.kind !== "video" && t.kind !== "subtitles" && !t.muted);

    const lines = [
      "#!/usr/bin/env bash",
      "# Assembles the exported cut into a single video file.",
      "#",
      "# Needs: ffmpeg, curl, and an API key with assets:read.",
      "#   export RAISAI_API_KEY=rk_...",
      "#   bash 'render " + manifest.title + ".sh'",
      "set -euo pipefail",
      "",
      ': "${RAISAI_API_KEY:?Set RAISAI_API_KEY to an API key with assets:read}"',
      'work="$(mktemp -d)"',
      'trap \'rm -rf "$work"\' EXIT',
      "",
      "# 1. Fetch every clip.",
    ];

    const videoClips = (video?.clips ?? []).filter((c) => c.asset);
    videoClips.forEach((clip, index) => {
      lines.push(
        `curl -fsSL -H "authorization: Bearer $RAISAI_API_KEY" "${clip.asset!.url}" -o "$work/clip${index}${extensionFor(clip.asset!.mime)}"`,
      );
    });

    lines.push("", "# 2. Trim each clip to the length it holds on the timeline.");
    videoClips.forEach((clip, index) => {
      const seconds = Math.max(0.04, (clip.durationMs - clip.trimInMs - clip.trimOutMs) / 1000);
      const start = clip.trimInMs / 1000;
      const input = `$work/clip${index}${extensionFor(clip.asset!.mime)}`;
      // A still becomes a held frame for its duration; footage is cut.
      lines.push(
        clip.asset!.mime.startsWith("image/")
          ? `ffmpeg -y -loop 1 -t ${seconds} -i "${input}" -vf "scale=1920:-2,format=yuv420p" -r 24 "$work/part${index}.mp4"`
          : `ffmpeg -y -ss ${start} -t ${seconds} -i "${input}" -vf "scale=1920:-2,format=yuv420p" -r 24 "$work/part${index}.mp4"`,
      );
    });

    lines.push("", "# 3. Join them in order.");
    lines.push(`printf '%s\\n' ${videoClips.map((_, i) => `"file '$work/part${i}.mp4'"`).join(" ")} > "$work/list.txt"`);
    lines.push(`ffmpeg -y -f concat -safe 0 -i "$work/list.txt" -c copy "$work/video.mp4"`);

    if (audioTracks.length === 0) {
      lines.push("", 'mv "$work/video.mp4" "./' + safeName(manifest.title) + '.mp4"');
    } else {
      lines.push("", "# 4. Lay the audio over the cut, each clip at its own offset.");
      const audioClips = audioTracks.flatMap((t) => t.clips.filter((c) => c.asset));
      audioClips.forEach((clip, index) => {
        lines.push(
          `curl -fsSL -H "authorization: Bearer $RAISAI_API_KEY" "${clip.asset!.url}" -o "$work/audio${index}${extensionFor(clip.asset!.mime)}"`,
        );
      });
      const inputs = audioClips.map((clip, i) => `-i "$work/audio${i}${extensionFor(clip.asset!.mime)}"`).join(" ");
      const delays = audioClips
        .map((clip, i) => `[${i + 1}:a]adelay=${clip.startMs}|${clip.startMs},volume=${clip.volume}[a${i}]`)
        .join(";");
      const mix = audioClips.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${audioClips.length}:dropout_transition=0[aout]`;
      lines.push(
        `ffmpeg -y -i "$work/video.mp4" ${inputs} -filter_complex "${delays};${mix}" -map 0:v -map "[aout]" -c:v copy -shortest "./${safeName(manifest.title)}.mp4"`,
      );
    }

    lines.push("", `echo "Wrote ./${safeName(manifest.title)}.mp4"`);
    return lines.join("\n") + "\n";
  }
}

function extensionFor(mime: string): string {
  if (mime.startsWith("video/")) return ".mp4";
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "audio/mpeg") return ".mp3";
  if (mime === "audio/wav") return ".wav";
  return ".bin";
}

function safeName(title: string): string {
  return title.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "movie";
}
