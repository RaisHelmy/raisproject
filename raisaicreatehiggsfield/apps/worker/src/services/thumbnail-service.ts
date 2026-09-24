import type { Env } from "../env";
import { thumbnailKey } from "../storage/keys";
import { nowIso } from "../db/client";

export interface ThumbnailJob {
  kind: "thumbnail";
  assetId: string;
  orgId: string;
  projectId: string;
  version: number;
  r2Key: string;
  mime: string;
}

const THUMBNAIL_WIDTH = 480;

/**
 * Thumbnails for the asset library and history grid (§116).
 *
 * Resizing uses the Cloudflare Images binding when the account has it. That
 * binding is the only way to transform bytes we hold privately in R2: the
 * fetch-based `cf.image` path needs a publicly reachable URL, which generated
 * assets deliberately do not have.
 *
 * Without the binding the original is stored as its own thumbnail. A heavier
 * grid is a fair trade for one that always works, and the UI reads
 * `thumbnail_key` either way.
 */
export class ThumbnailService {
  constructor(private readonly env: Pick<Env, "DB" | "ASSETS">) {}

  async generate(job: ThumbnailJob): Promise<{ key: string; resized: boolean }> {
    const source = await this.env.ASSETS.get(job.r2Key);
    if (!source) return { key: job.r2Key, resized: false };

    const key = thumbnailKey(job.orgId, job.projectId, job.assetId, job.version);

    if (!job.mime.startsWith("image/")) {
      // Video and audio get no still frame here; the UI falls back to an icon.
      return { key: job.r2Key, resized: false };
    }

    let resized = false;
    let body: ArrayBuffer = await source.arrayBuffer();

    const images = (this.env as { IMAGES?: ImagesBinding }).IMAGES;
    if (images) {
      try {
        const output = await images
          .input(new Response(body).body!)
          .transform({ width: THUMBNAIL_WIDTH, fit: "scale-down" })
          .output({ format: "image/jpeg" });
        body = await output.response().arrayBuffer();
        resized = true;
      } catch {
        // Transform refused this input (an unsupported format, say). The
        // original still makes a usable thumbnail.
      }
    }

    await this.env.ASSETS.put(key, body, {
      httpMetadata: { contentType: resized ? "image/jpeg" : job.mime },
    });
    await this.env.DB
      .prepare(`UPDATE assets SET thumbnail_key = ?, updated_at = ? WHERE id = ?`)
      .bind(key, nowIso(), job.assetId)
      .run();

    return { key, resized };
  }
}
