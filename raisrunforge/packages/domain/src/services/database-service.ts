import type { AuthContext, Database } from "@runforge/shared";
import type { CreateDatabaseInput, ProviderRegistry } from "@runforge/providers";
import { DomainError } from "../errors";
import type { PermissionService } from "../auth/permissions";
import type { EventService } from "./event-service";

export class DatabaseService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly events: EventService,
    private readonly providers: ProviderRegistry,
  ) {}

  async list(ctx: AuthContext): Promise<Database[]> {
    this.permissions.require(ctx, "database:read");
    return this.providers.database().listDatabases(ctx.organizationId);
  }

  async get(ctx: AuthContext, id: string): Promise<Database> {
    this.permissions.require(ctx, "database:read");
    const db = await this.providers.database().getDatabase(ctx.organizationId, id);
    if (!db) throw DomainError.notFound("database", id);
    return db;
  }

  async create(ctx: AuthContext, input: Omit<CreateDatabaseInput, "organizationId">): Promise<Database> {
    this.permissions.require(ctx, "database:write");
    const db = await this.providers.database().createDatabase({ ...input, organizationId: ctx.organizationId });
    await this.events.record(ctx, {
      action: "database.created",
      resourceType: "database",
      resourceId: db.id,
      resourceName: db.name,
      projectId: db.projectId,
      message: `Database ${db.name} (${db.engine}) created`,
    });
    return db;
  }

  async remove(ctx: AuthContext, id: string): Promise<void> {
    this.permissions.require(ctx, "database:delete");
    const db = await this.get(ctx, id);
    await this.providers.database().deleteDatabase(ctx.organizationId, id);
    await this.events.record(ctx, {
      action: "database.deleted",
      resourceType: "database",
      resourceId: id,
      resourceName: db.name,
      projectId: db.projectId,
      message: `Database ${db.name} deleted`,
      status: "info",
    });
  }

  async getHealth(ctx: AuthContext, id: string) {
    this.permissions.require(ctx, "database:read");
    return this.providers.database().getHealth(ctx.organizationId, id);
  }

  async runQuery(ctx: AuthContext, id: string, sql: string) {
    this.permissions.require(ctx, "database:query");
    const db = await this.get(ctx, id);
    const result = await this.providers.database().runQuery(ctx.organizationId, id, sql);
    await this.events.record(ctx, {
      action: "database.query",
      resourceType: "database",
      resourceId: id,
      resourceName: db.name,
      projectId: db.projectId,
      message: `Query executed against ${db.name}`,
      simulated: result.simulated,
    });
    return result;
  }
}
