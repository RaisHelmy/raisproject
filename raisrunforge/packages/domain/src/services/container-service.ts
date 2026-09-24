import type { AuthContext, Container } from "@runforge/shared";
import type { ProviderRegistry } from "@runforge/providers";
import { DomainError } from "../errors";
import type { PermissionService } from "../auth/permissions";
import type { EventService } from "./event-service";

export class ContainerService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly events: EventService,
    private readonly providers: ProviderRegistry,
  ) {}

  async list(ctx: AuthContext, serverId?: string): Promise<Container[]> {
    this.permissions.require(ctx, "container:read");
    return this.providers.container().listContainers(ctx.organizationId, serverId);
  }

  async get(ctx: AuthContext, id: string): Promise<Container> {
    this.permissions.require(ctx, "container:read");
    const c = await this.providers.container().getContainer(ctx.organizationId, id);
    if (!c) throw DomainError.notFound("container", id);
    return c;
  }

  async restart(ctx: AuthContext, id: string): Promise<Container> {
    this.permissions.require(ctx, "container:restart");
    const c = await this.providers.container().restartContainer(ctx.organizationId, id);
    await this.events.record(ctx, {
      action: "container.restarted",
      resourceType: "container",
      resourceId: c.id,
      resourceName: c.name,
      message: `Container ${c.name} restarted`,
    });
    return c;
  }

  async start(ctx: AuthContext, id: string): Promise<Container> {
    this.permissions.require(ctx, "container:restart");
    const c = await this.providers.container().startContainer(ctx.organizationId, id);
    await this.events.record(ctx, { action: "container.started", resourceType: "container", resourceId: c.id, resourceName: c.name, message: `Container ${c.name} started` });
    return c;
  }

  async stop(ctx: AuthContext, id: string): Promise<Container> {
    this.permissions.require(ctx, "container:restart");
    const c = await this.providers.container().stopContainer(ctx.organizationId, id);
    await this.events.record(ctx, { action: "container.stopped", resourceType: "container", resourceId: c.id, resourceName: c.name, message: `Container ${c.name} stopped` });
    return c;
  }

  async pause(ctx: AuthContext, id: string): Promise<Container> {
    this.permissions.require(ctx, "container:restart");
    const c = await this.providers.container().pauseContainer(ctx.organizationId, id);
    await this.events.record(ctx, { action: "container.paused", resourceType: "container", resourceId: c.id, resourceName: c.name, message: `Container ${c.name} paused` });
    return c;
  }

  async remove(ctx: AuthContext, id: string): Promise<void> {
    this.permissions.require(ctx, "container:remove");
    const c = await this.get(ctx, id);
    await this.providers.container().removeContainer(ctx.organizationId, id);
    await this.events.record(ctx, { action: "container.removed", resourceType: "container", resourceId: id, resourceName: c.name, message: `Container ${c.name} removed` });
  }
}
