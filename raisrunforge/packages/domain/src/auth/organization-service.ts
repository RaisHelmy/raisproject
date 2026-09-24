import type { AuthContext, Member, Organization, Role, User } from "@runforge/shared";
import { newId, nowIso } from "@runforge/shared";
import { DomainError, assertString, slugify } from "../errors";
import type { DataStore } from "../store/repository";
import { PermissionService } from "./permissions";
import type { EventService } from "../services/event-service";

export class OrganizationService {
  constructor(
    private readonly store: DataStore,
    private readonly permissions: PermissionService,
    private readonly events: EventService,
  ) {}

  async get(ctx: AuthContext): Promise<Organization> {
    const org = await this.store.organizations.get(ctx.organizationId);
    if (!org) throw DomainError.notFound("organization", ctx.organizationId);
    return org;
  }

  async create(user: User, name: string): Promise<Organization> {
    const ts = nowIso();
    const org: Organization = {
      id: newId("org"),
      name: assertString(name, "name", { min: 2, max: 64 }),
      slug: slugify(name),
      plan: "free",
      createdAt: ts,
      updatedAt: ts,
    };
    await this.store.organizations.insert(org);
    await this.store.members.insert({
      id: newId("mem"),
      organizationId: org.id,
      userId: user.id,
      role: "owner",
      status: "active",
      createdAt: ts,
      updatedAt: ts,
    });
    return org;
  }

  async listMembers(ctx: AuthContext): Promise<Array<Member & { user?: User }>> {
    this.permissions.require(ctx, "team:read");
    const members = await this.store.members.list(ctx.organizationId);
    return Promise.all(members.map(async (m) => ({ ...m, user: (await this.store.users.get(m.userId)) ?? undefined })));
  }

  async invite(ctx: AuthContext, input: { email: string; name?: string; role: Role }): Promise<Member> {
    this.permissions.require(ctx, "team:write");
    const email = assertString(input.email, "email", { pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ });
    const ts = nowIso();
    let user = (await this.store.users.list({ where: { email } as Partial<User> }))[0];
    if (!user) {
      user = { id: newId("usr"), email, name: input.name ?? email.split("@")[0], createdAt: ts, updatedAt: ts };
      await this.store.users.insert(user);
    }
    const member: Member = {
      id: newId("mem"),
      organizationId: ctx.organizationId,
      userId: user.id,
      role: input.role,
      status: "invited",
      createdAt: ts,
      updatedAt: ts,
    };
    await this.store.members.insert(member);
    await this.events.record(ctx, {
      action: "member.invited",
      resourceType: "member",
      resourceId: member.id,
      resourceName: email,
      message: `Invited ${email} as ${input.role}`,
      after: { role: input.role },
    });
    return member;
  }

  async changeRole(ctx: AuthContext, memberId: string, role: Role): Promise<Member> {
    this.permissions.require(ctx, "team:write");
    const member = await this.store.members.get(ctx.organizationId, memberId);
    this.permissions.requireTenant(ctx, member, "member", memberId);
    const before = member!.role;
    const updated = await this.store.members.update(ctx.organizationId, memberId, { role });
    await this.events.record(ctx, {
      action: "member.role_changed",
      resourceType: "member",
      resourceId: memberId,
      resourceName: member!.userId,
      message: `Role changed ${before} → ${role}`,
      before: { role: before },
      after: { role },
    });
    return updated;
  }
}
