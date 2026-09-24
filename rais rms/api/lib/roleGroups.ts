import type { Role } from "../../shared/types";

export const ROLE_GROUPS = {
  /** Can manage outlets, staff/roles, and tenant-wide settings. */
  ADMIN: ["owner", "group_admin"] as Role[],
  /** Can manage floor plan, services, staff scheduling, inventory, menu for their outlet. */
  MANAGE_OUTLET: ["owner", "group_admin", "outlet_manager"] as Role[],
  /** Can run day-to-day FOH operations: reservations, waitlist, seating, orders. */
  FOH_OPERATE: ["owner", "group_admin", "outlet_manager", "host", "server"] as Role[],
  /** Can manage guest CRM records and marketing. */
  GUEST_WRITE: ["owner", "group_admin", "outlet_manager", "host", "server", "marketing"] as Role[],
  /** Can run marketing campaigns. */
  MARKETING: ["owner", "group_admin", "marketing"] as Role[],
  /** Any authenticated staff member (read access). */
  ANY: [
    "owner",
    "group_admin",
    "outlet_manager",
    "host",
    "server",
    "marketing",
    "read_only",
  ] as Role[],
};
