import type { Container, ProviderKind } from "@runforge/shared";
import { nowIso } from "@runforge/shared";
import type { ContainerProvider } from "../interfaces";
import type { DemoWorld } from "./world";
import { wobble } from "./compute";

export class DemoContainerProvider implements ContainerProvider {
  readonly kind: ProviderKind = "demo";
  constructor(private readonly world: DemoWorld) {}

  async listContainers(organizationId: string, serverId?: string): Promise<Container[]> {
    return this.world.containers
      .filter((c) => c.organizationId === organizationId && (!serverId || c.serverId === serverId))
      .map((c) => this.live(c));
  }

  async getContainer(organizationId: string, id: string): Promise<Container | null> {
    const c = this.world.containers.find((x) => x.id === id && x.organizationId === organizationId);
    return c ? this.live(c) : null;
  }

  async startContainer(organizationId: string, id: string): Promise<Container> {
    const c = this.must(organizationId, id);
    c.status = "running";
    c.startedAt = nowIso();
    c.updatedAt = c.startedAt;
    return c;
  }

  async stopContainer(organizationId: string, id: string): Promise<Container> {
    const c = this.must(organizationId, id);
    c.status = "stopped";
    c.cpuPercent = 0;
    c.updatedAt = nowIso();
    return c;
  }

  async restartContainer(organizationId: string, id: string): Promise<Container> {
    const c = this.must(organizationId, id);
    c.status = "running";
    c.restarts += 1;
    c.startedAt = nowIso();
    c.updatedAt = c.startedAt;
    return c;
  }

  async pauseContainer(organizationId: string, id: string): Promise<Container> {
    const c = this.must(organizationId, id);
    c.status = "paused";
    c.updatedAt = nowIso();
    return c;
  }

  async removeContainer(organizationId: string, id: string): Promise<void> {
    const idx = this.world.containers.findIndex((x) => x.id === id && x.organizationId === organizationId);
    if (idx < 0) throw new Error(`Container ${id} not found`);
    this.world.containers.splice(idx, 1);
  }

  private must(organizationId: string, id: string): Container {
    const c = this.world.containers.find((x) => x.id === id && x.organizationId === organizationId);
    if (!c) throw new Error(`Container ${id} not found`);
    return c;
  }

  private live(c: Container): Container {
    if (c.status !== "running") return c;
    const now = this.world.now();
    return { ...c, cpuPercent: wobble(`${c.id}:cpu`, c.cpuPercent, Math.max(0.5, c.cpuPercent * 0.3), now) };
  }
}
