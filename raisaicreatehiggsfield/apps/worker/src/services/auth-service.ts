import { AppError } from "@raisai/shared";
import type { Env } from "../env";
import { UserRepository, type UserRow } from "../repositories/users";
import { OrganizationRepository, type OrganizationRow } from "../repositories/organizations";
import { SessionRepository, type SessionRow } from "../repositories/sessions";
import { AuditLogService } from "./audit-log-service";
import { hashPassword, verifyPassword } from "../auth/password";

export interface SignupInput {
  email: string;
  password: string;
  name: string;
  requestId: string;
  ip?: string;
  userAgent?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  requestId: string;
  ip?: string;
  userAgent?: string;
}

export interface AuthResult {
  user: UserRow;
  org: OrganizationRow;
  session: SessionRow;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthService {
  private readonly users: UserRepository;
  private readonly orgs: OrganizationRepository;
  private readonly sessions: SessionRepository;
  private readonly audit: AuditLogService;

  constructor(env: Pick<Env, "DB">) {
    this.users = new UserRepository(env);
    this.orgs = new OrganizationRepository(env);
    this.sessions = new SessionRepository(env);
    this.audit = new AuditLogService(env);
  }

  async signup(input: SignupInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      throw new AppError("invalid_input", "Enter a valid email address.", { action: "Check the email field." });
    }
    if (input.password.length < 8) {
      throw new AppError("invalid_input", "Password must be at least 8 characters.", { action: "Choose a longer password." });
    }
    if (input.name.trim().length === 0) {
      throw new AppError("invalid_input", "Enter your name.");
    }
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new AppError("conflict", "An account with this email already exists.", { action: "Log in instead." });
    }
    const passwordHash = await hashPassword(input.password);
    const user = await this.users.create({ email, passwordHash, name: input.name.trim() });
    const org = await this.orgs.createPersonal(user.id, `${user.name}'s workspace`);
    const session = await this.sessions.create(user.id, { ip: input.ip, userAgent: input.userAgent });
    await this.audit.record({
      orgId: org.id,
      actorUserId: user.id,
      actorType: "user",
      event: "signup",
      targetType: "user",
      targetId: user.id,
      requestId: input.requestId,
    });
    await this.audit.record({
      orgId: org.id,
      actorUserId: user.id,
      actorType: "user",
      event: "login",
      targetType: "session",
      targetId: session.id,
      requestId: input.requestId,
    });
    return { user, org, session };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);
    const invalid = () =>
      new AppError("unauthorized", "Incorrect email or password.", { action: "Check your credentials and try again." });
    if (!user) throw invalid();
    const ok = await verifyPassword(input.password, user.password_hash);
    if (!ok) throw invalid();
    const org = await this.orgs.findDefaultForUser(user.id);
    if (!org) throw new AppError("internal", "Account is missing a workspace.");
    const session = await this.sessions.create(user.id, { ip: input.ip, userAgent: input.userAgent });
    await this.audit.record({
      orgId: org.id,
      actorUserId: user.id,
      actorType: "user",
      event: "login",
      targetType: "session",
      targetId: session.id,
      requestId: input.requestId,
    });
    return { user, org, session };
  }

  /**
   * Sign in an existing user whose identity was already proven by a verified
   * suite SSO token (auth/sso.ts). Same session + audit path as login(), just
   * without the password step. Only admins may enter this way.
   */
  async ssoLogin(input: Omit<LoginInput, "password">): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);
    if (!user) throw new AppError("forbidden", "No account for this email.");
    if (user.role !== "admin") throw new AppError("forbidden", "Account is not an admin.");
    const org = await this.orgs.findDefaultForUser(user.id);
    if (!org) throw new AppError("internal", "Account is missing a workspace.");
    const session = await this.sessions.create(user.id, { ip: input.ip, userAgent: input.userAgent });
    await this.audit.record({
      orgId: org.id,
      actorUserId: user.id,
      actorType: "user",
      event: "login",
      targetType: "session",
      targetId: session.id,
      requestId: input.requestId,
    });
    return { user, org, session };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.delete(sessionId);
  }
}
