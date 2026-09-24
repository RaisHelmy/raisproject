// The full set of permission strings the product checks against. Never
// check `role === 'admin'` — always check one of these (CLAUDE.md §8).
export const PERMISSIONS = [
  "ticket.read",
  "ticket.create",
  "ticket.reply",
  "ticket.note.internal",
  "ticket.assign",
  "ticket.transition",
  "ticket.delete",
  "template.manage",
  "role.manage",
  "agent.manage",
  "account.manage",
  "sla.manage",
  "automation.manage",
  "report.view",
  "tenant.settings.manage",
  "domain.manage",
  "billing.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const TICKET_SCOPES = ["all", "team", "assigned", "own", "none"] as const;
export type TicketScope = (typeof TICKET_SCOPES)[number];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function isTicketScope(value: string): value is TicketScope {
  return (TICKET_SCOPES as readonly string[]).includes(value);
}

/** Validates a tenant-authored role definition before it's persisted. */
export function validateRoleDef(name: string, ticketScope: string, permissions: string[]): string[] {
  const errors: string[] = [];
  if (!name.trim()) errors.push("name is required");
  if (!isTicketScope(ticketScope)) errors.push(`ticketScope must be one of: ${TICKET_SCOPES.join(", ")}`);
  const invalid = permissions.filter((p) => !isPermission(p));
  if (invalid.length > 0) errors.push(`unknown permissions: ${invalid.join(", ")}`);
  return errors;
}

export interface PresetRoleDef {
  name: string;
  ticketScope: TicketScope;
  permissions: Permission[];
}

// Shipped at tenant creation (CLAUDE.md §8). Tenants clone and edit these —
// they are a starting point, not a fixed list, so nothing else in the
// codebase may assume a role by this name exists.
export const PRESET_ROLES: PresetRoleDef[] = [
  {
    name: "Owner",
    ticketScope: "all",
    permissions: [...PERMISSIONS],
  },
  {
    name: "Admin",
    ticketScope: "all",
    permissions: PERMISSIONS.filter((p) => p !== "billing.view"),
  },
  {
    name: "Support",
    ticketScope: "all",
    permissions: [
      "ticket.read",
      "ticket.create",
      "ticket.reply",
      "ticket.note.internal",
      "ticket.assign",
      "ticket.transition",
      "account.manage",
      "report.view",
    ],
  },
  {
    name: "Developer",
    ticketScope: "assigned",
    permissions: ["ticket.read", "ticket.reply", "ticket.note.internal", "ticket.transition"],
  },
  {
    name: "Strategic",
    ticketScope: "none",
    permissions: ["report.view"],
  },
  {
    name: "Read-only",
    ticketScope: "all",
    permissions: ["ticket.read", "report.view"],
  },
];
