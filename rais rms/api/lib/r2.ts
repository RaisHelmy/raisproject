import { newId } from "./ids";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export function extensionFor(contentType: string): string {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

export function isAllowedImageType(contentType: string): boolean {
  return ALLOWED_IMAGE_TYPES.has(contentType);
}

export function tenantR2Key(tenantId: string, outletId: string, collection: string, contentType: string): string {
  return `tenants/${tenantId}/${outletId}/${collection}/${newId()}.${extensionFor(contentType)}`;
}

export async function putTenantImage(
  bucket: R2Bucket,
  tenantId: string,
  outletId: string,
  collection: string,
  body: ReadableStream | ArrayBuffer,
  contentType: string,
  sizeBytes: number,
): Promise<string> {
  if (!isAllowedImageType(contentType)) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error(`File too large — max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB`);
  }
  const key = tenantR2Key(tenantId, outletId, collection, contentType);
  await bucket.put(key, body, { httpMetadata: { contentType } });
  return key;
}

/** Guards against reading an R2 key that doesn't belong to this tenant/outlet's own prefix. */
export function assertKeyBelongsToTenant(key: string, tenantId: string, outletId?: string): void {
  const prefix = outletId ? `tenants/${tenantId}/${outletId}/` : `tenants/${tenantId}/`;
  if (!key.startsWith(prefix)) {
    throw new Error("Key does not belong to this tenant");
  }
}
