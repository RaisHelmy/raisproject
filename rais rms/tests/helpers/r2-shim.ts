/**
 * Minimal in-memory R2Bucket-compatible shim for tests — implements only the
 * subset this codebase uses (put/get with httpMetadata.contentType).
 */
export function createTestR2(): R2Bucket {
  const store = new Map<string, { body: Uint8Array; contentType: string }>();

  const bucket = {
    async put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream, options?: R2PutOptions) {
      const bytes =
        value instanceof ArrayBuffer
          ? new Uint8Array(value)
          : value instanceof Uint8Array
            ? value
            : new Uint8Array(await new Response(value as ReadableStream).arrayBuffer());
      const httpMetadata = options?.httpMetadata;
      const contentType =
        httpMetadata instanceof Headers
          ? (httpMetadata.get("content-type") ?? "application/octet-stream")
          : (httpMetadata?.contentType ?? "application/octet-stream");
      store.set(key, { body: bytes, contentType });
      return { key } as unknown as R2Object;
    },
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      return {
        body: new Response(entry.body.buffer as ArrayBuffer).body,
        httpMetadata: { contentType: entry.contentType },
      } as unknown as R2ObjectBody;
    },
  };

  return bucket as unknown as R2Bucket;
}
