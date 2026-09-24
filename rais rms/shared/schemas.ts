import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantSlug: z.string().min(1),
});

export const registerTenantSchema = z.object({
  tenantName: z.string().min(2).max(120),
  tenantSlug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, and hyphens only"),
  ownerName: z.string().min(2).max(120),
  ownerEmail: z.string().email(),
  password: z.string().min(8),
  outletName: z.string().min(2).max(120),
  timezone: z.string().min(1),
  currency: z.string().length(3),
});

export const createGuestSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal("")).transform((v) => v || undefined),
  phone: z.string().max(40).optional(),
  marketingConsent: z.boolean().default(false),
  dob: z.string().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});

export const updateGuestSchema = createGuestSchema.partial();

export const createAreaSchema = z.object({
  name: z.string().min(1).max(120),
});

export const createTableSchema = z.object({
  areaId: z.string().uuid(),
  label: z.string().min(1).max(40),
  seatsMin: z.number().int().min(1).max(50),
  seatsMax: z.number().int().min(1).max(50),
  x: z.number().default(0),
  y: z.number().default(0),
  combinable: z.boolean().default(true),
});

export const createServiceSchema = z.object({
  name: z.string().min(1).max(120),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  turnTimeByPartySize: z.record(z.number().int().min(15).max(600)).optional(),
});

export const createReservationSchema = z.object({
  guestId: z.string().uuid().optional(),
  guestName: z.string().min(1).max(200).optional(),
  guestPhone: z.string().max(40).optional(),
  guestEmail: z.string().email().optional(),
  serviceId: z.string().uuid().optional(),
  startsAt: z.number().int(),
  partySize: z.number().int().min(1).max(100),
  source: z
    .enum(["widget", "google", "instagram", "facebook", "phone", "walkin"])
    .default("widget"),
  tableIds: z.array(z.string().uuid()).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateReservationSchema = z.object({
  status: z
    .enum(["booked", "seated", "completed", "no_show", "cancelled"])
    .optional(),
  startsAt: z.number().int().optional(),
  partySize: z.number().int().min(1).max(100).optional(),
  tableIds: z.array(z.string().uuid()).optional(),
  notes: z.string().max(2000).optional(),
});

export const createWaitlistSchema = z.object({
  guestId: z.string().uuid().optional(),
  guestName: z.string().min(1).max(200).optional(),
  guestPhone: z.string().max(40).optional(),
  partySize: z.number().int().min(1).max(100),
  quotedWait: z.number().int().min(0).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const roleSchema = z.enum([
  "owner",
  "group_admin",
  "outlet_manager",
  "host",
  "server",
  "marketing",
  "read_only",
]);

export const inviteUserSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  outletId: z.string().uuid(),
  role: roleSchema,
});

export const assignRoleSchema = z.object({
  outletId: z.string().uuid(),
  role: roleSchema,
});

export const updateTableSchema = z.object({
  x: z.number(),
  y: z.number(),
  label: z.string().min(1).max(40).optional(),
  seatsMin: z.number().int().min(1).max(50).optional(),
  seatsMax: z.number().int().min(1).max(50).optional(),
  areaId: z.string().uuid().optional(),
  combinable: z.boolean().optional(),
});

export const assignTablesSchema = z.object({
  tableIds: z.array(z.string().uuid()).max(20),
});

export const createMenuSchema = z.object({
  name: z.string().min(1).max(120),
});

export const createMenuSectionSchema = z.object({
  name: z.string().min(1).max(120),
  sortOrder: z.number().int().default(0),
});

export const createMenuItemSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  priceMinor: z.number().int().min(0),
  currency: z.string().length(3).default("USD"),
  tags: z.array(z.string().max(40)).max(20).optional(),
  available: z.boolean().default(true),
});

export const createOrderSchema = z.object({
  type: z.enum(["dine_in", "qr", "takeaway", "delivery"]),
  tableId: z.string().uuid().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        qty: z.number().int().min(1).max(50),
        modifiers: z.array(z.string().max(80)).max(10).optional(),
      }),
    )
    .min(1),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["open", "placed", "preparing", "ready", "completed", "cancelled"]),
});

export const createInventoryItemSchema = z.object({
  name: z.string().min(1).max(160),
  unit: z.string().min(1).max(20),
  qtyOnHand: z.number().min(0).default(0),
  parLevel: z.number().min(0).default(0),
});

export const adjustInventorySchema = z.object({
  delta: z.number(),
  reason: z.string().min(1).max(200),
});

export const createStaffShiftSchema = z.object({
  userId: z.string().uuid(),
  startsAt: z.number().int(),
  endsAt: z.number().int(),
  role: z.string().min(1).max(60),
});

export const createTicketEventSchema = z.object({
  name: z.string().min(1).max(160),
  startsAt: z.number().int(),
  priceMinor: z.number().int().min(0),
  currency: z.string().length(3).default("USD"),
  capacity: z.number().int().min(0),
});

export const createTicketOrderSchema = z.object({
  guestId: z.string().uuid().optional(),
  guestName: z.string().min(1).max(200).optional(),
  guestEmail: z.string().email().optional(),
  quantity: z.number().int().min(1).max(50).default(1),
});

export const createCampaignSchema = z.object({
  channel: z.enum(["email", "sms", "whatsapp"]),
  trigger: z.enum(["birthday", "winback", "top_spender", "manual"]),
  segment: z.record(z.unknown()).optional(),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(10000),
});

export const sendCampaignSchema = z.object({
  guestIds: z.array(z.string().uuid()).min(1).max(500).optional(),
});

export const createFeedbackSchema = z.object({
  scores: z.object({
    ambiance: z.number().int().min(1).max(5).optional(),
    service: z.number().int().min(1).max(5).optional(),
    value: z.number().int().min(1).max(5).optional(),
    food: z.number().int().min(1).max(5).optional(),
  }),
  comment: z.string().max(4000).optional(),
});

export const createDepositSchema = z.object({
  amountMinor: z.number().int().min(1),
  currency: z.string().length(3).default("USD"),
  type: z.enum(["deposit", "preauth", "prepaid", "cancellation_fee"]),
});

export const publicAvailabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.coerce.number().int().min(1).max(100),
});

export const publicBookingSchema = z.object({
  guestName: z.string().min(1).max(200),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().max(40).optional(),
  startsAt: z.number().int(),
  partySize: z.number().int().min(1).max(100),
  notes: z.string().max(2000).optional(),
});

export const publicManageSchema = z.object({
  action: z.enum(["cancel", "reschedule"]),
  startsAt: z.number().int().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterTenantInput = z.infer<typeof registerTenantSchema>;
export type CreateGuestInput = z.infer<typeof createGuestSchema>;
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type CreateWaitlistInput = z.infer<typeof createWaitlistSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type PublicBookingInput = z.infer<typeof publicBookingSchema>;
