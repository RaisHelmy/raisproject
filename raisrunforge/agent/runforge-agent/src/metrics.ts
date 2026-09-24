/** Server metrics abstraction (spec §12). A real agent reads /proc, os.loadavg(), etc. */
export interface RawServerMetrics {
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  networkMbps: number;
  loadAverage: [number, number, number];
  processes: number;
  collectedAt: string;
}

export async function collectMetrics(): Promise<RawServerMetrics> {
  // Real implementation: read from Bun/Node os module + /proc/stat sampling.
  // Kept here as a typed abstraction so ComputeProvider-compatible adapters can
  // consume it uniformly regardless of platform.
  const load = typeof process !== "undefined" && "loadavg" in (await import("node:os")) ? (await import("node:os")).loadavg() : [0, 0, 0];
  return {
    cpuPercent: 0,
    memoryPercent: 0,
    diskPercent: 0,
    networkMbps: 0,
    loadAverage: [load[0] ?? 0, load[1] ?? 0, load[2] ?? 0],
    processes: 0,
    collectedAt: new Date().toISOString(),
  };
}
