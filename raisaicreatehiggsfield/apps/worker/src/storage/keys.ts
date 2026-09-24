/**
 * R2 key layout. Keys embed org and project so a listing prefix maps to a
 * tenant, and so a stray key can be traced back to its owner.
 *   org/{orgId}/project/{projectId}/{assetId}/v{version}.{ext}
 */
export function assetKey(orgId: string, projectId: string, assetId: string, version: number, ext: string): string {
  return `org/${orgId}/project/${projectId}/${assetId}/v${version}.${ext}`;
}

export function thumbnailKey(orgId: string, projectId: string, assetId: string, version: number): string {
  return `org/${orgId}/project/${projectId}/${assetId}/v${version}-thumb.jpg`;
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "application/json": "json",
  "text/plain": "txt",
  "application/pdf": "pdf",
  "text/vtt": "vtt",
  "application/x-subrip": "srt",
};

export function extensionFor(mime: string): string {
  return EXT_BY_MIME[mime] ?? "bin";
}

export function assetKindFor(mime: string): "image" | "video" | "audio" | "document" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}
