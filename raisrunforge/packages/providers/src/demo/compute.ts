import type { ProviderKind, Server, ServerMetricsSnapshot, ServiceRecord } from "@runforge/shared";
import { newId, nowIso } from "@runforge/shared";
import type { ComputeProvider, CreateServerInput } from "../interfaces";
import type { DemoWorld } from "./world";
import { seededRandom } from "../util/random";

/** Smoothly varying value around a base so demo metrics look alive but stable. */
export function wobble(key: string, base: number, amplitude: number, now: number, periodMs = 15 * 60_000): number {
  const rand = seededRandom(key);
  const phase = rand() * Math.PI * 2;
  const secondary = rand() * Math.PI * 2;
  const t = now / periodMs;
  const v =
    base +
    Math.sin(t * Math.PI * 2 + phase) * amplitude * 0.6 +
    Math.sin(t * Math.PI * 6.3 + secondary) * amplitude * 0.4;
  return Math.max(0, Math.round(v * 10) / 10);
}

export class DemoComputeProvider implements ComputeProvider {
  readonly kind: ProviderKind = "demo";
  constructor(private readonly world: DemoWorld) {}

  async listServers(organizationId: string): Promise<Server[]> {
    return this.world.servers.filter((s) => s.organizationId === organizationId).map((s) => this.refresh(s));
  }

  async getServer(organizationId: string, id: string): Promise<Server | null> {
    const s = this.world.servers.find((x) => x.id === id && x.organizationId === organizationId);
    return s ? this.refresh(s) : null;
  }

  async createServer(input: CreateServerInput): Promise<Server> {
    const ts = nowIso();
    const server: Server = {
      id: newId("srv"),
      organizationId: input.organizationId,
      name: input.name,
      status: "provisioning",
      provider: "demo",
      providerLabel: "Demo Provider",
      region: input.region,
      os: input.os,
      ipAddress: `10.99.0.${10 + this.world.servers.length}`,
      cpuCores: input.cpuCores,
      memoryMb: input.memoryMb,
      diskGb: input.diskGb,
      uptimeSeconds: 0,
      tags: ["demo"],
      createdAt: ts,
      updatedAt: ts,
    };
    this.world.servers.push(server);
    return server;
  }

  async deleteServer(organizationId: string, id: string): Promise<void> {
    const idx = this.world.servers.findIndex((x) => x.id === id && x.organizationId === organizationId);
    if (idx >= 0) this.world.servers.splice(idx, 1);
  }

  async getMetrics(organizationId: string, id: string): Promise<ServerMetricsSnapshot | null> {
    const s = await this.getServer(organizationId, id);
    if (!s) return null;
    const now = this.world.now();
    const offline = s.status === "offline";
    const base = s.name === "production-01" ? { cpu: 17, mem: 41, disk: 62, net: 3.8 } : s.name === "staging-01" ? { cpu: 44, mem: 71, disk: 38, net: 0.9 } : { cpu: 0, mem: 0, disk: 0, net: 0 };
    return {
      serverId: s.id,
      cpuPercent: offline ? 0 : wobble(`${s.id}:cpu`, base.cpu, 6, now),
      memoryPercent: offline ? 0 : wobble(`${s.id}:mem`, base.mem, 2, now, 60 * 60_000),
      diskPercent: offline ? 0 : base.disk,
      networkMbps: offline ? 0 : wobble(`${s.id}:net`, base.net, 1.5, now, 5 * 60_000),
      loadAverage: offline ? [0, 0, 0] : [wobble(`${s.id}:l1`, 1.2, 0.5, now), wobble(`${s.id}:l5`, 1.0, 0.3, now), 0.9],
      processes: offline ? 0 : 180 + Math.round(wobble(`${s.id}:proc`, 20, 10, now)),
      containers: this.world.containers.filter((c) => c.serverId === s.id).length,
      applications: this.world.applications.filter((a) => a.serverId === s.id).length,
      collectedAt: new Date(now).toISOString(),
    };
  }

  async listServices(organizationId: string, serverId: string): Promise<ServiceRecord[]> {
    return this.world.services.filter((s) => s.organizationId === organizationId && s.serverId === serverId);
  }

  async controlService(organizationId: string, serviceId: string, action: "start" | "stop" | "restart" | "enable" | "disable"): Promise<ServiceRecord> {
    const svc = this.world.services.find((s) => s.id === serviceId && s.organizationId === organizationId);
    if (!svc) throw new Error(`Service ${serviceId} not found`);
    const ts = nowIso();
    if (action === "stop") {
      svc.status = "inactive";
      svc.pid = undefined;
      svc.uptimeSeconds = 0;
    } else if (action === "start" || action === "restart") {
      svc.status = "active";
      svc.pid = 1000 + Math.floor(Math.random() * 9000);
      svc.uptimeSeconds = 0;
    } else if (action === "enable") svc.enabled = true;
    else if (action === "disable") svc.enabled = false;
    svc.updatedAt = ts;
    return svc;
  }

  async restartAgent(organizationId: string, serverId: string): Promise<void> {
    const s = this.world.servers.find((x) => x.id === serverId && x.organizationId === organizationId);
    if (!s) throw new Error(`Server ${serverId} not found`);
    s.lastHeartbeatAt = nowIso();
    s.updatedAt = s.lastHeartbeatAt;
  }

  private refresh(s: Server): Server {
    if (s.status === "online") s.lastHeartbeatAt = new Date(this.world.now()).toISOString();
    return s;
  }
}
