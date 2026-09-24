export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly fieldErrors?: Array<{ key: string; message: string }>) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? "unknown_error", body.message ?? "Request failed", body.fieldErrors);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) => request<T>(path, { method: "PUT", body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export interface Ticket {
  id: string;
  number: number;
  subject: string;
  status: "new" | "open" | "pending" | "on_hold" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  assigneeAgentId: string | null;
  createdAt: string;
  updatedAt: string;
  fieldValues: string;
}

export interface TicketMessage {
  id: string;
  authorType: "agent" | "contact" | "system";
  authorId: string | null;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
}

export interface TicketEvent {
  id: string;
  type: string;
  actorType: string;
  data: string;
  createdAt: string;
}

export interface TicketDetail {
  ticket: Ticket;
  messages: TicketMessage[];
  events: TicketEvent[];
  attachments: unknown[];
}

export interface Account {
  id: string;
  name: string;
  scopeByTeam: boolean;
  createdAt: string;
}

export interface Team {
  id: string;
  accountId: string;
  name: string;
}

export interface Contact {
  id: string;
  accountId: string;
  teamId: string | null;
  email: string;
  name: string;
}

export const PERMISSIONS = [
  "ticket.read", "ticket.create", "ticket.reply", "ticket.note.internal", "ticket.assign",
  "ticket.transition", "ticket.delete", "template.manage", "role.manage", "agent.manage",
  "account.manage", "sla.manage", "automation.manage", "report.view", "tenant.settings.manage",
  "domain.manage", "billing.view",
] as const;

export const TICKET_SCOPES = ["all", "team", "assigned", "own", "none"] as const;

export interface Role {
  id: string;
  name: string;
  ticketScope: (typeof TICKET_SCOPES)[number];
  permissions: string[];
  isPreset: boolean;
}

export interface AgentSummary {
  id: string;
  name: string;
  email: string;
  totpEnabled: boolean;
  accepted: boolean;
  roles: { id: string; name: string }[];
}

export interface TemplateField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  helpText?: string;
  options?: string[];
}

export interface TemplateDefaults {
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
}

export interface TemplateSummary {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
}

export interface TemplateVersion {
  id: string;
  version: number;
  fields: TemplateField[];
  defaults: TemplateDefaults;
  createdAt: string;
}
