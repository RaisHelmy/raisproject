import type {
  LogEntry,
  LogQuery,
  MetricName,
  MetricPoint,
  MetricQuery,
  MetricRange,
  MetricSeries,
  ProviderKind,
} from "@runforge/shared";
import { newId } from "@runforge/shared";
import type { LogProvider, MetricsProvider } from "../interfaces";
import type { DemoWorld } from "./world";
import { LOG_APP_BY_SERVICE, LOG_TEMPLATES } from "./seed";
import { pick, seededRandom } from "../util/random";

/**
 * Demo logs: historical lines are seeded; new lines are synthesized on read at
 * a steady cadence so "live mode" always has fresh output. Control-plane
 * operations (deploy/restart) append explicit lines through `append`.
 */
export class DemoLogProvider implements LogProvider {
  readonly kind: ProviderKind = "demo";
  private lastSynthesizedAt: number;
  private seq = 0;

  constructor(private readonly world: DemoWorld) {
    this.lastSynthesizedAt = world.now();
  }

  async query(organizationId: string, q: LogQuery): Promise<LogEntry[]> {
    this.synthesize();
    let logs = this.world.logs.filter((l) => l.organizationId === organizationId);
    if (q.after) {
      const idx = logs.findIndex((l) => l.id === q.after);
      if (idx >= 0) logs = logs.slice(idx + 1);
    }
    if (q.severity?.length) logs = logs.filter((l) => q.severity!.includes(l.severity));
    if (q.service) logs = logs.filter((l) => l.service === q.service);
    if (q.serverId) logs = logs.filter((l) => l.serverId === q.serverId);
    if (q.applicationId) logs = logs.filter((l) => l.applicationId === q.applicationId);
    if (q.deploymentId) logs = logs.filter((l) => l.deploymentId === q.deploymentId);
    if (q.environment) logs = logs.filter((l) => l.environment === q.environment);
    if (q.since) logs = logs.filter((l) => l.timestamp >= q.since!);
    if (q.until) logs = logs.filter((l) => l.timestamp <= q.until!);
    if (q.search) {
      const s = q.search.toLowerCase();
      logs = logs.filter((l) => l.message.toLowerCase().includes(s) || l.service.includes(s) || l.requestId?.includes(s));
    }
    const limit = q.limit ?? 200;
    return logs.slice(-limit);
  }

  async append(entry: Omit<LogEntry, "id">): Promise<LogEntry> {
    const full: LogEntry = { id: newId("log"), ...entry };
    this.world.logs.push(full);
    return full;
  }

  async listServices(organizationId: string): Promise<string[]> {
    return [...new Set(this.world.logs.filter((l) => l.organizationId === organizationId).map((l) => l.service))].sort();
  }

  /** Generate one line roughly every 2.5 s of wall-clock time since the last call. */
  private synthesize(): void {
    const now = this.world.now();
    const CADENCE = 2_500;
    if (now - this.lastSynthesizedAt < CADENCE) return;
    const rand = seededRandom(`live:${Math.floor(this.lastSynthesizedAt / CADENCE)}`);
    for (let t = this.lastSynthesizedAt + CADENCE; t <= now; t += CADENCE) {
      const tpl = pick(rand, LOG_TEMPLATES);
      const [severity, message] = pick(rand, tpl.lines);
      const ctx = LOG_APP_BY_SERVICE[tpl.service];
      this.world.logs.push({
        id: `log_live_${String(this.seq++).padStart(6, "0")}`,
        organizationId: "org_demo",
        timestamp: new Date(t).toISOString(),
        severity,
        source: tpl.source,
        service: tpl.service,
        serverId: ctx?.serverId,
        applicationId: ctx?.applicationId,
        environment: ctx?.environment,
        requestId: `req_${Math.floor(rand() * 1e8).toString(16)}`,
        message,
      });
    }
    this.lastSynthesizedAt = now;
    if (this.world.logs.length > 5000) this.world.logs.splice(0, this.world.logs.length - 5000);
  }
}

const RANGE_MS: Record<MetricRange, number> = {
  "5m": 5 * 60_000,
  "1h": 60 * 60_000,
  "6h": 6 * 60 * 60_000,
  "24h": 24 * 60 * 60_000,
  "7d": 7 * 24 * 60 * 60_000,
  "30d": 30 * 24 * 60 * 60_000,
};

const POINTS = 90;

interface MetricProfile {
  base: number;
  amplitude: number;
  unit: string;
  min?: number;
  max?: number;
  integer?: boolean;
}

/**
 * Deterministic time-series generation: each bucket's value depends only on
 * (resourceId, metric, bucketIndex) so panning ranges and refreshing the page
 * never re-rolls history.
 */
export class DemoMetricsProvider implements MetricsProvider {
  readonly kind: ProviderKind = "demo";
  constructor(private readonly world: DemoWorld) {}

  async query(organizationId: string, q: MetricQuery): Promise<MetricSeries[]> {
    const now = this.world.now();
    const span = RANGE_MS[q.range] ?? RANGE_MS["1h"];
    const step = span / POINTS;
    const markers = this.markersFor(organizationId, q, now - span, now);
    return q.names.map((name) => {
      const profile = this.profile(q, name);
      const points: MetricPoint[] = [];
      for (let i = 0; i <= POINTS; i++) {
        const t = now - span + i * step;
        points.push({ t: Math.round(t), v: this.value(q.resourceId, name, t, step, profile, markers) });
      }
      return { name, unit: profile.unit, resourceType: q.resourceType, resourceId: q.resourceId, range: q.range, points, markers };
    });
  }

  private markersFor(organizationId: string, q: MetricQuery, from: number, to: number) {
    return this.world.deployments
      .filter((d) => d.organizationId === organizationId && d.startedAt)
      .filter((d) => (q.resourceType === "application" ? d.applicationId === q.resourceId : q.resourceType === "server" ? d.serverId === q.resourceId : true))
      .map((d) => ({ t: Date.parse(d.startedAt!), label: `${d.applicationName} ${d.version}`, deploymentId: d.id }))
      .filter((m) => m.t >= from && m.t <= to);
  }

  private profile(q: MetricQuery, name: MetricName): MetricProfile {
    const app = q.resourceType === "application" ? this.world.applications.find((a) => a.id === q.resourceId) : undefined;
    const server = q.resourceType === "server" ? this.world.servers.find((s) => s.id === q.resourceId) : undefined;
    const db = q.resourceType === "database" ? this.world.databases.find((d) => d.id === q.resourceId) : undefined;
    const degraded = app?.status === "degraded" || db?.status === "degraded";
    const offline = server?.status === "offline";
    const staging = server?.name === "staging-01";
    switch (name) {
      case "cpu":
        return { base: offline ? 0 : app ? (degraded ? 71 : 18) : staging ? 44 : 17, amplitude: 6, unit: "%", min: 0, max: 100 };
      case "memory":
        return app
          ? { base: degraded ? 930 : 421, amplitude: 25, unit: "MB", min: 0, integer: true }
          : { base: offline ? 0 : staging ? 71 : 41, amplitude: 2, unit: "%", min: 0, max: 100 };
      case "disk":
        return { base: offline ? 0 : staging ? 38 : 62, amplitude: 0.3, unit: "%", min: 0, max: 100 };
      case "network":
        return { base: offline ? 0 : staging ? 0.9 : 3.8, amplitude: 1.4, unit: "Mbps", min: 0 };
      case "requests":
        return { base: q.resourceType === "organization" ? 640 : app?.name.includes("API") ? (degraded ? 90 : 237) : 40, amplitude: 60, unit: "req/min", min: 0, integer: true };
      case "throughput":
        return { base: 1.9, amplitude: 0.6, unit: "MB/s", min: 0 };
      case "latency":
        return { base: degraded ? 1240 : 42, amplitude: degraded ? 350 : 9, unit: "ms", min: 1, integer: true };
      case "errors":
        return { base: degraded ? 8.3 : 0.03, amplitude: degraded ? 2 : 0.03, unit: "%", min: 0 };
      case "connections":
        return { base: db?.connections ?? 34, amplitude: degraded ? 2 : 8, unit: "conn", min: 0, max: db?.maxConnections ?? 100, integer: true };
      case "queries":
        return { base: db?.queriesPerSecond ?? 312, amplitude: 40, unit: "q/s", min: 0, integer: true };
      case "deployment_frequency":
        return { base: 4, amplitude: 3, unit: "deploys", min: 0, integer: true };
      case "deployment_duration":
        return { base: 190, amplitude: 60, unit: "s", min: 30, integer: true };
    }
  }

  private value(resourceId: string, name: MetricName, t: number, step: number, p: MetricProfile, markers: Array<{ t: number }>): number {
    const bucket = Math.floor(t / step);
    const rand = seededRandom(`${resourceId}:${name}:${bucket}`);
    const daily = Math.sin(((t / 86_400_000) % 1) * Math.PI * 2) * p.amplitude * 0.5;
    const noise = (rand() - 0.5) * p.amplitude * 1.2;
    let v = p.base + daily + noise;
    // Deployment bump: short spike right after a deployment marker (spec §68).
    for (const m of markers) {
      const dt = t - m.t;
      if (dt >= 0 && dt < step * 6) v += p.amplitude * 2 * (1 - dt / (step * 6));
    }
    if (p.min !== undefined) v = Math.max(p.min, v);
    if (p.max !== undefined) v = Math.min(p.max, v);
    return p.integer ? Math.round(v) : Math.round(v * 100) / 100;
  }
}
