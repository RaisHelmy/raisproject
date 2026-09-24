/**
 * R2 storage abstraction (spec §5/§32/§33). Wraps an R2Bucket binding for
 * backups and application file storage. A demo in-memory implementation lets
 * the same interface work without a real bucket bound.
 */
export interface ObjectStorage {
  put(key: string, data: ArrayBuffer | Uint8Array | string, opts?: { contentType?: string }): Promise<void>;
  get(key: string): Promise<{ body: ArrayBuffer; contentType?: string } | null>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<Array<{ key: string; size: number; uploadedAt: string }>>;
}

export class R2ObjectStorage implements ObjectStorage {
  constructor(private readonly bucket: R2Bucket) {}

  async put(key: string, data: ArrayBuffer | Uint8Array | string, opts?: { contentType?: string }): Promise<void> {
    await this.bucket.put(key, data, opts?.contentType ? { httpMetadata: { contentType: opts.contentType } } : undefined);
  }

  async get(key: string): Promise<{ body: ArrayBuffer; contentType?: string } | null> {
    const obj = await this.bucket.get(key);
    if (!obj) return null;
    return { body: await obj.arrayBuffer(), contentType: obj.httpMetadata?.contentType };
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async list(prefix?: string): Promise<Array<{ key: string; size: number; uploadedAt: string }>> {
    const listed = await this.bucket.list(prefix ? { prefix } : undefined);
    return listed.objects.map((o) => ({ key: o.key, size: o.size, uploadedAt: o.uploaded.toISOString() }));
  }
}

/** In-memory ObjectStorage used by demo mode / tests when no R2 bucket is bound. */
export class MemoryObjectStorage implements ObjectStorage {
  private objects = new Map<string, { body: ArrayBuffer; contentType?: string; uploadedAt: string }>();

  async put(key: string, data: ArrayBuffer | Uint8Array | string, opts?: { contentType?: string }): Promise<void> {
    const body = typeof data === "string" ? new TextEncoder().encode(data).buffer : data instanceof Uint8Array ? data.buffer : data;
    this.objects.set(key, { body: body as ArrayBuffer, contentType: opts?.contentType, uploadedAt: new Date().toISOString() });
  }

  async get(key: string): Promise<{ body: ArrayBuffer; contentType?: string } | null> {
    const obj = this.objects.get(key);
    return obj ? { body: obj.body, contentType: obj.contentType } : null;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async list(prefix?: string): Promise<Array<{ key: string; size: number; uploadedAt: string }>> {
    return [...this.objects.entries()]
      .filter(([key]) => !prefix || key.startsWith(prefix))
      .map(([key, obj]) => ({ key, size: obj.body.byteLength, uploadedAt: obj.uploadedAt }));
  }
}
