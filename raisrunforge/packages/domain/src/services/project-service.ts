import type { AuthContext, Environment, EnvironmentRecord, Project } from "@runforge/shared";
import { newId, nowIso } from "@runforge/shared";
import { DomainError, assertString, slugify } from "../errors";
import type { DataStore } from "../store/repository";
import type { PermissionService } from "../auth/permissions";
import type { EventService } from "./event-service";

export interface CreateProjectInput {
  name: string;
  description?: string;
}

/**
 * ProjectService owns projects and their environments. Applications,
 * databases and domains all hang off a project (spec §54).
 */
export class ProjectService {
  constructor(
    private readonly store: DataStore,
    private readonly permissions: PermissionService,
    private readonly events: EventService,
  ) {}

  async list(ctx: AuthContext): Promise<Project[]> {
    this.permissions.require(ctx, "project:read");
    return this.store.projects.list(ctx.organizationId, { orderBy: "createdAt", direction: "desc" });
  }

  async get(ctx: AuthContext, id: string): Promise<Project> {
    this.permissions.require(ctx, "project:read");
    const project = await this.store.projects.get(ctx.organizationId, id);
    this.permissions.requireTenant(ctx, project, "project", id);
    return project!;
  }

  async getBySlug(ctx: AuthContext, slug: string): Promise<Project> {
    this.permissions.require(ctx, "project:read");
    const [project] = await this.store.projects.list(ctx.organizationId, { where: { slug } as Partial<Project> });
    if (!project) throw DomainError.notFound("project", slug);
    return project;
  }

  async create(ctx: AuthContext, input: CreateProjectInput): Promise<Project> {
    this.permissions.require(ctx, "project:write");
    const ts = nowIso();
    const project: Project = {
      id: newId("prj"),
      organizationId: ctx.organizationId,
      name: assertString(input.name, "name", { min: 2, max: 64 }),
      slug: slugify(input.name),
      description: input.description,
      status: "active",
      createdAt: ts,
      updatedAt: ts,
    };
    await this.store.projects.insert(project);
    await this.createEnvironment(ctx, project.id, "production");
    await this.events.record(ctx, {
      action: "project.created",
      resourceType: "project",
      resourceId: project.id,
      resourceName: project.name,
      message: `Project ${project.name} created`,
      after: { name: project.name, slug: project.slug },
    });
    return project;
  }

  async archive(ctx: AuthContext, id: string): Promise<Project> {
    this.permissions.require(ctx, "project:delete");
    const project = await this.get(ctx, id);
    const updated = await this.store.projects.update(ctx.organizationId, id, { status: "archived" });
    await this.events.record(ctx, {
      action: "project.archived",
      resourceType: "project",
      resourceId: id,
      resourceName: project.name,
      message: `Project ${project.name} archived`,
    });
    return updated;
  }

  async listEnvironments(ctx: AuthContext, projectId: string): Promise<EnvironmentRecord[]> {
    this.permissions.require(ctx, "project:read");
    await this.get(ctx, projectId);
    return this.store.environments.list(ctx.organizationId, { where: { projectId } as Partial<EnvironmentRecord> });
  }

  async createEnvironment(ctx: AuthContext, projectId: string, name: Environment): Promise<EnvironmentRecord> {
    this.permissions.require(ctx, "project:write");
    const ts = nowIso();
    const env: EnvironmentRecord = {
      id: newId("env"),
      organizationId: ctx.organizationId,
      projectId,
      name,
      slug: slugify(name),
      createdAt: ts,
      updatedAt: ts,
    };
    await this.store.environments.insert(env);
    return env;
  }

  /** Clone an environment's applications into a new environment (spec §48). */
  async cloneEnvironment(ctx: AuthContext, projectId: string, sourceEnvId: string, targetName: Environment): Promise<EnvironmentRecord> {
    this.permissions.require(ctx, "project:write");
    const source = await this.store.environments.get(ctx.organizationId, sourceEnvId);
    this.permissions.requireTenant(ctx, source, "environment", sourceEnvId);
    const target = await this.createEnvironment(ctx, projectId, targetName);
    await this.events.record(ctx, {
      action: "environment.cloned",
      resourceType: "environment",
      resourceId: target.id,
      resourceName: target.name,
      projectId,
      message: `Environment ${source!.name} cloned to ${target.name}`,
    });
    return target;
  }
}
