import { AppError, newId, type AuthContext } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso, runBatch } from "../db/client";
import { MovieService } from "./movie-service";

export type TrackKind = "video" | "voice" | "dialogue" | "music" | "sfx" | "subtitles";

export interface TrackRow {
  id: string;
  movie_id: string;
  kind: TrackKind;
  name: string;
  sort_order: number;
  muted: number;
}

export interface ItemRow {
  id: string;
  track_id: string;
  asset_id: string | null;
  shot_id: string | null;
  label: string | null;
  start_ms: number;
  duration_ms: number;
  trim_in_ms: number;
  trim_out_ms: number;
  volume: number;
  fade_in_ms: number;
  fade_out_ms: number;
}

export interface Timeline {
  movieId: string;
  durationMs: number;
  tracks: (TrackRow & { items: ItemRow[] })[];
}

const TRACK_ORDER: TrackKind[] = ["video", "dialogue", "voice", "music", "sfx", "subtitles"];

/**
 * The movie's timeline (§46).
 *
 * Built from the shots rather than authored from scratch: once shots exist,
 * the cut already exists, and the timeline is where it gets adjusted. Times are
 * milliseconds throughout so trimming never accumulates rounding drift.
 */
export class TimelineService {
  constructor(private readonly env: Pick<Env, "DB">) {}

  /**
   * Lays every rendered shot end to end on the video track, preserving any
   * edits already made to tracks that are not rebuilt.
   */
  async build(auth: AuthContext, movieId: string): Promise<Timeline> {
    const movies = new MovieService(this.env as never);
    await movies.require(auth, movieId);
    const scenes = await movies.scenes(auth, movieId);

    const videoTrack = await this.ensureTrack(movieId, "video", "Video");
    // Rebuilt from the shots, so re-running after regenerating a shot picks up
    // the new take rather than leaving the old one in the cut.
    await this.env.DB.prepare(`DELETE FROM timeline_items WHERE track_id = ?`).bind(videoTrack.id).run();

    let cursorMs = 0;
    const inserts: { sql: string; params: unknown[] }[] = [];

    for (const scene of scenes) {
      for (const shot of scene.shots) {
        const durationMs = Math.round(shot.duration_s * 1000);
        const assetId = shot.video_asset_id ?? shot.image_asset_id;
        inserts.push({
          sql: `INSERT INTO timeline_items (id, track_id, asset_id, shot_id, label, start_ms, duration_ms, created_at)
                VALUES (?,?,?,?,?,?,?,?)`,
          params: [
            newId(), videoTrack.id, assetId, shot.id,
            `Scene ${scene.number} shot ${shot.number}`, cursorMs, durationMs, nowIso(),
          ],
        });
        cursorMs += durationMs;
      }
    }
    if (inserts.length > 0) await runBatch(this.env.DB, inserts);

    await this.env.DB
      .prepare(`UPDATE movies SET status='timeline', updated_at=? WHERE id=?`)
      .bind(nowIso(), movieId)
      .run();
    return this.get(auth, movieId);
  }

  async get(auth: AuthContext, movieId: string): Promise<Timeline> {
    await new MovieService(this.env as never).require(auth, movieId);
    const { results: tracks } = await this.env.DB
      .prepare(`SELECT * FROM timeline_tracks WHERE movie_id = ? ORDER BY sort_order`)
      .bind(movieId)
      .all<TrackRow>();

    const withItems = await Promise.all(
      tracks.map(async (track) => {
        const { results: items } = await this.env.DB
          .prepare(`SELECT * FROM timeline_items WHERE track_id = ? ORDER BY start_ms`)
          .bind(track.id)
          .all<ItemRow>();
        return { ...track, items };
      }),
    );

    const durationMs = withItems.reduce(
      (longest, track) =>
        Math.max(longest, ...track.items.map((i) => i.start_ms + Math.max(0, i.duration_ms - i.trim_in_ms - i.trim_out_ms))),
      0,
    );
    return { movieId, durationMs, tracks: withItems };
  }

  /**
   * Moves, trims or adjusts one clip.
   *
   * Trimming ripples by default: the clips after it move up to close the gap.
   * A cut assembled from consecutive shots almost never wants a hole in the
   * middle, and leaving one silently is the kind of thing you only notice on
   * playback. Pass `ripple: false` to hold the other clips where they are.
   */
  async updateItem(
    auth: AuthContext,
    movieId: string,
    itemId: string,
    patch: Partial<Pick<ItemRow, "start_ms" | "trim_in_ms" | "trim_out_ms" | "volume" | "fade_in_ms" | "fade_out_ms">>,
    options: { ripple?: boolean } = {},
  ): Promise<Timeline> {
    await new MovieService(this.env as never).require(auth, movieId);
    const item = await this.env.DB
      .prepare(
        `SELECT i.* FROM timeline_items i JOIN timeline_tracks t ON t.id = i.track_id
          WHERE i.id = ? AND t.movie_id = ?`,
      )
      .bind(itemId, movieId)
      .first<ItemRow>();
    if (!item) throw new AppError("not_found", "Clip not found.");

    const next = { ...item, ...patch };
    const remaining = next.duration_ms - next.trim_in_ms - next.trim_out_ms;
    if (remaining <= 0) {
      throw new AppError("invalid_input", "That would trim the whole clip away.", {
        action: "Trim less from one end.",
      });
    }
    if (next.start_ms < 0) throw new AppError("invalid_input", "A clip cannot start before the beginning.");

    await this.env.DB
      .prepare(
        `UPDATE timeline_items SET start_ms=?, trim_in_ms=?, trim_out_ms=?, volume=?, fade_in_ms=?, fade_out_ms=? WHERE id=?`,
      )
      .bind(next.start_ms, next.trim_in_ms, next.trim_out_ms, next.volume, next.fade_in_ms, next.fade_out_ms, itemId)
      .run();

    const trimChanged = patch.trim_in_ms !== undefined || patch.trim_out_ms !== undefined;
    if (trimChanged && options.ripple !== false) {
      await this.closeGaps(item.track_id);
    }
    return this.get(auth, movieId);
  }

  /**
   * Cuts a clip in two at a point on the timeline (§46).
   *
   * Both halves keep pointing at the same file: a split is a decision about
   * what is shown, not a new render, so it costs nothing and can be undone by
   * deleting one half.
   */
  async splitItem(auth: AuthContext, movieId: string, itemId: string, atMs: number): Promise<Timeline> {
    const item = await this.requireItem(auth, movieId, itemId);

    const effective = item.duration_ms - item.trim_in_ms - item.trim_out_ms;
    const offset = Math.round(atMs - item.start_ms);
    if (offset <= 0 || offset >= effective) {
      throw new AppError("invalid_input", "A cut has to fall inside the clip.", {
        action: "Move the playhead over the clip and try again.",
      });
    }

    // The left half ends where the cut is; the right half starts there and
    // skips what the left half already showed.
    await runBatch(this.env.DB, [
      {
        sql: `UPDATE timeline_items SET trim_out_ms = ? WHERE id = ?`,
        params: [item.duration_ms - item.trim_in_ms - offset, item.id],
      },
      {
        sql: `INSERT INTO timeline_items
                (id, track_id, asset_id, shot_id, label, start_ms, duration_ms, trim_in_ms, trim_out_ms,
                 volume, fade_in_ms, fade_out_ms, created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        params: [
          newId(), item.track_id, item.asset_id, item.shot_id, item.label,
          item.start_ms + offset, item.duration_ms, item.trim_in_ms + offset, item.trim_out_ms,
          item.volume, 0, item.fade_out_ms, nowIso(),
        ],
      },
      // The left half no longer fades out, and the right half no longer fades
      // in, or the cut would be audible as a dip.
      { sql: `UPDATE timeline_items SET fade_out_ms = 0 WHERE id = ?`, params: [item.id] },
    ]);

    return this.get(auth, movieId);
  }

  /**
   * Copies a clip and drops it straight after the original, pushing the rest
   * of the track along so nothing is buried underneath (§46).
   */
  async duplicateItem(auth: AuthContext, movieId: string, itemId: string): Promise<Timeline> {
    const item = await this.requireItem(auth, movieId, itemId);
    const effective = item.duration_ms - item.trim_in_ms - item.trim_out_ms;
    const at = item.start_ms + effective;

    await runBatch(this.env.DB, [
      {
        sql: `UPDATE timeline_items SET start_ms = start_ms + ? WHERE track_id = ? AND start_ms >= ?`,
        params: [effective, item.track_id, at],
      },
      {
        sql: `INSERT INTO timeline_items
                (id, track_id, asset_id, shot_id, label, start_ms, duration_ms, trim_in_ms, trim_out_ms,
                 volume, fade_in_ms, fade_out_ms, created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        params: [
          newId(), item.track_id, item.asset_id, item.shot_id, item.label,
          at, item.duration_ms, item.trim_in_ms, item.trim_out_ms,
          item.volume, item.fade_in_ms, item.fade_out_ms, nowIso(),
        ],
      },
    ]);

    return this.get(auth, movieId);
  }

  /**
   * Moves a clip along its track, or onto another track of the same kind.
   *
   * Only the same kind: dropping a voice clip onto the video track would
   * produce an edit nothing downstream could render.
   */
  async moveItem(
    auth: AuthContext,
    movieId: string,
    itemId: string,
    input: { startMs?: number; trackId?: string },
  ): Promise<Timeline> {
    const item = await this.requireItem(auth, movieId, itemId);
    let trackId = item.track_id;

    if (input.trackId && input.trackId !== item.track_id) {
      const [from, to] = await Promise.all([
        this.env.DB.prepare(`SELECT kind FROM timeline_tracks WHERE id = ? AND movie_id = ?`).bind(item.track_id, movieId).first<{ kind: string }>(),
        this.env.DB.prepare(`SELECT kind FROM timeline_tracks WHERE id = ? AND movie_id = ?`).bind(input.trackId, movieId).first<{ kind: string }>(),
      ]);
      if (!to) throw new AppError("not_found", "That track does not exist.");
      if (from?.kind !== to.kind) {
        throw new AppError("invalid_input", `A ${from?.kind ?? "clip"} cannot go on the ${to.kind} track.`, {
          action: "Move it to another track of the same kind.",
        });
      }
      trackId = input.trackId;
    }

    const startMs = input.startMs === undefined ? item.start_ms : Math.max(0, Math.round(input.startMs));
    await this.env.DB
      .prepare(`UPDATE timeline_items SET track_id = ?, start_ms = ? WHERE id = ?`)
      .bind(trackId, startMs, itemId)
      .run();

    return this.get(auth, movieId);
  }

  /** Removes a clip. The file it points at is untouched (§41). */
  async removeItem(auth: AuthContext, movieId: string, itemId: string, options: { ripple?: boolean } = {}): Promise<Timeline> {
    const item = await this.requireItem(auth, movieId, itemId);
    await this.env.DB.prepare(`DELETE FROM timeline_items WHERE id = ?`).bind(itemId).run();
    if (options.ripple !== false) await this.closeGaps(item.track_id);
    return this.get(auth, movieId);
  }

  private async requireItem(auth: AuthContext, movieId: string, itemId: string): Promise<ItemRow> {
    await new MovieService(this.env as never).require(auth, movieId);
    const item = await this.env.DB
      .prepare(
        `SELECT i.* FROM timeline_items i JOIN timeline_tracks t ON t.id = i.track_id
          WHERE i.id = ? AND t.movie_id = ?`,
      )
      .bind(itemId, movieId)
      .first<ItemRow>();
    if (!item) throw new AppError("not_found", "Clip not found.");
    return item;
  }

  async setMuted(auth: AuthContext, movieId: string, trackId: string, muted: boolean): Promise<Timeline> {
    await new MovieService(this.env as never).require(auth, movieId);
    await this.env.DB
      .prepare(`UPDATE timeline_tracks SET muted = ? WHERE id = ? AND movie_id = ?`)
      .bind(muted ? 1 : 0, trackId, movieId)
      .run();
    return this.get(auth, movieId);
  }

  async addItem(
    auth: AuthContext,
    movieId: string,
    input: { kind: TrackKind; assetId: string; startMs: number; durationMs: number; label?: string },
  ): Promise<Timeline> {
    await new MovieService(this.env as never).require(auth, movieId);
    const track = await this.ensureTrack(movieId, input.kind, trackName(input.kind));
    await this.env.DB
      .prepare(
        `INSERT INTO timeline_items (id, track_id, asset_id, label, start_ms, duration_ms, created_at)
         VALUES (?,?,?,?,?,?,?)`,
      )
      .bind(newId(), track.id, input.assetId, input.label ?? null, Math.max(0, input.startMs), input.durationMs, nowIso())
      .run();
    return this.get(auth, movieId);
  }

  /** Re-seats every clip on a track back to back, in its existing order. */
  private async closeGaps(trackId: string): Promise<void> {
    const { results } = await this.env.DB
      .prepare(`SELECT * FROM timeline_items WHERE track_id = ? ORDER BY start_ms`)
      .bind(trackId)
      .all<ItemRow>();

    let cursorMs = 0;
    const updates: { sql: string; params: unknown[] }[] = [];
    for (const item of results) {
      const effective = item.duration_ms - item.trim_in_ms - item.trim_out_ms;
      if (item.start_ms !== cursorMs) {
        updates.push({ sql: `UPDATE timeline_items SET start_ms = ? WHERE id = ?`, params: [cursorMs, item.id] });
      }
      cursorMs += effective;
    }
    if (updates.length > 0) await runBatch(this.env.DB, updates);
  }

  private async ensureTrack(movieId: string, kind: TrackKind, name: string): Promise<TrackRow> {
    const existing = await this.env.DB
      .prepare(`SELECT * FROM timeline_tracks WHERE movie_id = ? AND kind = ?`)
      .bind(movieId, kind)
      .first<TrackRow>();
    if (existing) return existing;

    const id = newId();
    await this.env.DB
      .prepare(`INSERT INTO timeline_tracks (id, movie_id, kind, name, sort_order, created_at) VALUES (?,?,?,?,?,?)`)
      .bind(id, movieId, kind, name, TRACK_ORDER.indexOf(kind), nowIso())
      .run();
    return (await this.env.DB.prepare(`SELECT * FROM timeline_tracks WHERE id = ?`).bind(id).first<TrackRow>())!;
  }
}

function trackName(kind: TrackKind): string {
  return { video: "Video", dialogue: "Dialogue", voice: "Voice", music: "Music", sfx: "Sound effects", subtitles: "Subtitles" }[kind];
}
