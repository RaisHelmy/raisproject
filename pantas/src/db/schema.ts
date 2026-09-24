import { pgSchema, text, integer, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Hyperdrive pools connections at the transaction/statement level and does
 * not guarantee that a `SET search_path` (or the `search_path` startup
 * parameter) persists across statements — every table reference must
 * therefore be schema-qualified at the SQL level instead. `pantasSchema`
 * fixes production/dev to the `pantas` schema; there is currently no runtime
 * switch to `pantas_staging` (see wrangler.jsonc `env.staging`) — the
 * staging Hyperdrive/schema wiring needs revisiting separately.
 */
const pantasSchema = pgSchema("pantas");
const pgTable = pantasSchema.table.bind(pantasSchema);

/**
 * Postgres migration note
 * ------------------------
 * This schema now targets drizzle-orm/pg-core directly (cut over from
 * drizzle-orm/sqlite-core). It was deliberately written to be dialect-portable
 * from the start, so the port was mechanical:
 *   - sqliteTable(...)                -> pgTable(...)
 *   - text("...")                     -> unchanged (text(...))
 *   - integer(..., {mode:"boolean"})  -> boolean(...)
 *   - integer(..., {mode:"timestamp"}) was NEVER used here — all timestamps
 *     are ISO-8601 UTC strings in text columns, so they round-trip identically
 *     on both engines. Kept as text on Postgres too, per CLAUDE.md.
 *   - integer money columns stay integer (minor units / sen) on both engines.
 *   - No AUTOINCREMENT anywhere: every id is a UUID v7 generated in app code
 *     (see src/db/ids.ts) before insert, so it works identically on Postgres.
 *   - No INSERT OR REPLACE anywhere — repositories use explicit
 *     insert/update.
 * The old SQLite/D1 schema is preserved in git history; drizzle.config.sqlite.ts
 * and migrations/ (the D1 migration set) are left in place, unused, in case of
 * rollback need — see CLAUDE.md and the migration summary for details.
 */

// ---------------------------------------------------------------------------
// Shared enum value lists (defined early so both `jobs` and `vehicles` can
// reference carSegmentValues without a forward-reference problem).
// ---------------------------------------------------------------------------

export const vehicleTypeValues = ["motorcycle", "car"] as const;
export const carSegmentValues = [
  "hatchback",
  "sedan",
  "suv",
  "mpv",
  "pickup",
  "van",
] as const;
export const aircondConditionValues = [
  "excellent",
  "good",
  "fair",
  "poor",
] as const;

// ---------------------------------------------------------------------------
// Users & roles
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),

  // Real identity — always stored, regardless of anonymity settings.
  realName: text("real_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),

  // Display-layer anonymity. Masking happens on read, never on write.
  handle: text("handle").notNull(),
  anonymousMode: boolean("anonymous_mode")
    .notNull()
    .default(false),
  autoRejectAnonymousCod: boolean("auto_reject_anonymous_cod")
    .notNull()
    .default(true),

  verificationTier: text("verification_tier", {
    enum: ["unverified", "verified"],
  })
    .notNull()
    .default("unverified"),

  status: text("status", { enum: ["active", "suspended"] })
    .notNull()
    .default("active"),

  // Runner-role comfort preferences (CLAUDE.md "Ride comfort & safety
  // preferences"). Meaningful only when the user holds the runner role;
  // stored on users rather than a separate runner-profile table, matching
  // the existing precedent of anonymousMode/autoRejectAnonymousCod.
  quietRidePreferred: boolean("quiet_ride_preferred")
    .notNull()
    .default(false),
  scentFreeVehicle: boolean("scent_free_vehicle")
    .notNull()
    .default(false),
});

export const userRoles = pgTable("user_roles", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role", {
    enum: ["purchaser", "runner", "vendor", "admin"],
  }).notNull(),
  createdAt: text("created_at").notNull(),
});

// ---------------------------------------------------------------------------
// Groups / societies (multi-tenancy)
// ---------------------------------------------------------------------------

export const groups = pgTable("groups", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),

  name: text("name").notNull(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id),

  allowAnonymity: boolean("allow_anonymity")
    .notNull()
    .default(true),
  commissionOverrideMinor: integer("commission_override_minor"),
  codPolicy: text("cod_policy", {
    enum: ["default", "disabled", "verified_only"],
  })
    .notNull()
    .default("default"),
  // Free-form extensible settings (priority rules, etc). Never used to store
  // anything that must be queried/filtered on — those get real columns.
  settingsJson: text("settings_json").notNull().default("{}"),

  // Own-gateway deposit tracking: the current deposit balance is derived
  // from ledgerEntries against the `group_gateway_deposit` account, this
  // column is not a source of truth — see repositories/ledger.ts.
  ownGatewayEnabled: boolean("own_gateway_enabled")
    .notNull()
    .default(false),
});

export const groupMembers = pgTable("group_members", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  roleInGroup: text("role_in_group"),
  createdAt: text("created_at").notNull(),
});

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------

export const vendors = pgTable("vendors", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),

  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  groupId: text("group_id").references(() => groups.id),
  businessName: text("business_name").notNull(),
  status: text("status", { enum: ["active", "suspended"] })
    .notNull()
    .default("active"),
});

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export const jobStatusValues = [
  "draft",
  "posted",
  "claimed",
  "picked_up",
  "in_transit",
  "delivered",
  "settled",
  "cancelled",
  "disputed",
] as const;

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),

  groupId: text("group_id").references(() => groups.id),
  type: text("type", {
    enum: ["food_order", "item_order", "fetch", "delivery", "ride"],
  }).notNull(),
  status: text("status", { enum: jobStatusValues })
    .notNull()
    .default("draft"),

  purchaserUserId: text("purchaser_user_id")
    .notNull()
    .references(() => users.id),
  runnerUserId: text("runner_user_id").references(() => users.id),
  vendorId: text("vendor_id").references(() => vendors.id),

  paymentMethod: text("payment_method", { enum: ["cash", "gateway"] }).notNull(),

  // Fetch jobs: purchaser attestation, used to cap runner outlay and gate
  // job visibility. Logged, and admissible in dispute resolution.
  declaredValueMinor: integer("declared_value_minor"),
  // Purchase-on-behalf: what the runner fronted for the item(s).
  itemCostMinor: integer("item_cost_minor"),
  deliveryFeeMinor: integer("delivery_fee_minor").notNull(),
  // Flat commission fee snapshotted at settlement (never a percentage).
  commissionMinor: integer("commission_minor"),

  // Snapshot of anonymity at time of posting, so later toggles don't rewrite
  // history.
  isAnonymousJob: boolean("is_anonymous_job")
    .notNull()
    .default(false),

  postedAt: text("posted_at"),
  claimedAt: text("claimed_at"),
  pickedUpAt: text("picked_up_at"),
  inTransitAt: text("in_transit_at"),
  deliveredAt: text("delivered_at"),
  settledAt: text("settled_at"),
  cancelledAt: text("cancelled_at"),

  // Ride-specific (type === "ride"), left null for other job types.
  quietRideRequested: boolean("quiet_ride_requested")
    .notNull()
    .default(false),
  requestedVehicleBrand: text("requested_vehicle_brand"),
  requestedVehicleModel: text("requested_vehicle_model"),
  requestedVehicleSegment: text("requested_vehicle_segment", {
    enum: carSegmentValues,
  }),

  // Carpool (CLAUDE.md "Carpool (pooled rides)").
  poolEnabled: boolean("pool_enabled").notNull().default(false),

  // Scheduling (CLAUDE.md "Scheduling & subscriptions"). Set when this job
  // instance was spawned from a ride_schedule template rather than posted
  // directly by a purchaser.
  scheduledFor: text("scheduled_for"),
  spawnedFromScheduleId: text("spawned_from_schedule_id"),

  // Vendor corporate contract linkage (CLAUDE.md "Vendor corporate
  // contracts"). Set when this job instance was spawned from an active
  // vendor_contract rather than posted directly.
  vendorContractId: text("vendor_contract_id"),
});

// ---------------------------------------------------------------------------
// Runner vehicles. A runner may register more than one (e.g. a motorcycle
// for delivery jobs, a car for ride jobs) — this is its own entity, not
// columns bolted onto users. See CLAUDE.md "Runner vehicles".
// ---------------------------------------------------------------------------

export const vehicles = pgTable("vehicles", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),

  runnerUserId: text("runner_user_id")
    .notNull()
    .references(() => users.id),

  vehicleType: text("vehicle_type", { enum: vehicleTypeValues }).notNull(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  year: integer("year"),
  plateNumber: text("plate_number").notNull(),

  // Applies to both vehicle types.
  engineCc: integer("engine_cc"),

  // Car-only detail. Left null for motorcycles.
  segment: text("segment", { enum: carSegmentValues }),
  seatCount: integer("seat_count"),
  leatherSeats: boolean("leather_seats")
    .notNull()
    .default(false),
  // Self-declared by the runner; admin can flag it if a purchaser disputes
  // it in a rating/complaint. Not independently verified.
  aircondCondition: text("aircond_condition", {
    enum: aircondConditionValues,
  }),

  active: boolean("active").notNull().default(true),
});

// ---------------------------------------------------------------------------
// Emergency (SOS). See CLAUDE.md "Emergency (SOS)".
// ---------------------------------------------------------------------------

export const sosIncidentStatusValues = ["triggered", "acknowledged", "resolved"] as const;

export const sosIncidents = pgTable("sos_incidents", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),

  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id),
  triggeredByUserId: text("triggered_by_user_id")
    .notNull()
    .references(() => users.id),
  lastKnownLat: text("last_known_lat"),
  lastKnownLng: text("last_known_lng"),

  status: text("status", { enum: sosIncidentStatusValues })
    .notNull()
    .default("triggered"),
  acknowledgedByUserId: text("acknowledged_by_user_id").references(() => users.id),
  acknowledgedAt: text("acknowledged_at"),
  resolvedByUserId: text("resolved_by_user_id").references(() => users.id),
  resolvedAt: text("resolved_at"),
  resolutionNote: text("resolution_note"),
});

// ---------------------------------------------------------------------------
// Carpool: co-passenger legs on a poolEnabled ride job. Each leg is its own
// purchaser and its own (reduced) fare — see CLAUDE.md "Carpool (pooled
// rides)". The job row itself remains the "primary" leg via
// jobs.purchaserUserId/deliveryFeeMinor; additional co-passengers who join
// get a row here.
// ---------------------------------------------------------------------------

export const jobPoolLegStatusValues = ["pending", "confirmed", "cancelled"] as const;

export const jobPoolLegs = pgTable("job_pool_legs", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),

  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id),
  purchaserUserId: text("purchaser_user_id")
    .notNull()
    .references(() => users.id),

  pickupNote: text("pickup_note"),
  dropoffNote: text("dropoff_note"),
  fareMinor: integer("fare_minor").notNull(),
  status: text("status", { enum: jobPoolLegStatusValues }).notNull().default("pending"),
});

// ---------------------------------------------------------------------------
// Scheduling & subscriptions. A ride_schedule is a recurring-booking
// template; it is never itself billable — it spawns real `jobs` rows ahead
// of each occurrence. See CLAUDE.md "Scheduling & subscriptions". Despite
// the name, this also covers non-ride recurring bookings (a "personal
// vendor" for repeat food/item orders) via `jobType`.
// ---------------------------------------------------------------------------

export const scheduleStatusValues = ["active", "paused", "cancelled"] as const;

export const rideSchedules = pgTable("ride_schedules", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),

  groupId: text("group_id").references(() => groups.id),
  purchaserUserId: text("purchaser_user_id")
    .notNull()
    .references(() => users.id),

  jobType: text("job_type", {
    enum: ["food_order", "item_order", "fetch", "delivery", "ride"],
  }).notNull(),
  // Bitmask-free explicit list, e.g. ["mon","tue","wed","thu","fri"].
  daysOfWeekJson: text("days_of_week_json").notNull(),
  timeOfDay: text("time_of_day").notNull(), // "HH:MM", local to the group/user
  poolPreferred: boolean("pool_preferred").notNull().default(false),

  // First-refusal only, never a guarantee — see CLAUDE.md.
  preferredRunnerUserId: text("preferred_runner_user_id").references(() => users.id),

  deliveryFeeMinor: integer("delivery_fee_minor").notNull(),
  paymentMethod: text("payment_method", { enum: ["cash", "gateway"] }).notNull(),

  status: text("status", { enum: scheduleStatusValues }).notNull().default("active"),
  // How long before each occurrence's slot the spawner should post the job.
  leadTimeMinutes: integer("lead_time_minutes").notNull().default(30),
});

// ---------------------------------------------------------------------------
// Vendor corporate contracts (catering). See CLAUDE.md "Vendor corporate
// contracts (catering)" — billing is per-meal/per-day, never prepaid.
// ---------------------------------------------------------------------------

export const vendorContractStatusValues = [
  "negotiating",
  "active",
  "ended",
  "cancelled",
] as const;

export const vendorContracts = pgTable("vendor_contracts", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),

  groupId: text("group_id")
    .notNull()
    .references(() => groups.id),
  vendorId: text("vendor_id")
    .notNull()
    .references(() => vendors.id),

  pricePerMealMinor: integer("price_per_meal_minor").notNull(),
  daysOfWeekJson: text("days_of_week_json").notNull(),
  mealTime: text("meal_time").notNull(), // "HH:MM"
  menuTerms: text("menu_terms"),

  contractStart: text("contract_start").notNull(),
  contractEnd: text("contract_end"),

  status: text("status", { enum: vendorContractStatusValues })
    .notNull()
    .default("negotiating"),
});

export const vendorContractOfferStatusValues = [
  "pending",
  "accepted",
  "rejected",
  "withdrawn",
] as const;

/** Counter-offer negotiation on a contract, same pattern as job_offers. */
export const vendorContractOffers = pgTable("vendor_contract_offers", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),

  contractId: text("contract_id")
    .notNull()
    .references(() => vendorContracts.id),
  proposedByRole: text("proposed_by_role", { enum: ["group", "vendor"] }).notNull(),
  proposedByUserId: text("proposed_by_user_id")
    .notNull()
    .references(() => users.id),

  proposedPricePerMealMinor: integer("proposed_price_per_meal_minor").notNull(),
  proposedTerms: text("proposed_terms"),

  status: text("status", { enum: vendorContractOfferStatusValues })
    .notNull()
    .default("pending"),
  respondedAt: text("responded_at"),
});

// ---------------------------------------------------------------------------
// Vendor catalogue (post-launch per the original build order, but included
// now since it's a prerequisite for corporate catering contracts to
// reference real menu items).
// ---------------------------------------------------------------------------

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),

  vendorId: text("vendor_id")
    .notNull()
    .references(() => vendors.id),
  groupId: text("group_id").references(() => groups.id),

  name: text("name").notNull(),
  description: text("description"),
  priceMinor: integer("price_minor").notNull(),
  active: boolean("active").notNull().default(true),
});

// ---------------------------------------------------------------------------
// Price negotiation — a runner counter-offer on a posted job. Accepting one
// is what moves a job into `claimed`; it does not replace FCFS claiming,
// it's an alternative path alongside it. See CLAUDE.md "Price negotiation".
// ---------------------------------------------------------------------------

export const jobOfferStatusValues = [
  "pending",
  "accepted",
  "rejected",
  "withdrawn",
  "expired",
] as const;

export const jobOffers = pgTable("job_offers", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),

  groupId: text("group_id").references(() => groups.id),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id),
  runnerUserId: text("runner_user_id")
    .notNull()
    .references(() => users.id),

  proposedFeeMinor: integer("proposed_fee_minor").notNull(),
  message: text("message"),

  status: text("status", { enum: jobOfferStatusValues })
    .notNull()
    .default("pending"),
  respondedAt: text("responded_at"),
});

// ---------------------------------------------------------------------------
// Vehicle rental (peer-to-peer, like Trevo). See CLAUDE.md "Vehicle rental
// (peer-to-peer)" — deposit is an owner-declared attestation only, never
// platform-held.
// ---------------------------------------------------------------------------

export const rentalBookingStatusValues = [
  "requested",
  "accepted",
  "rejected",
  "active",
  "completed",
  "cancelled",
  "disputed",
] as const;

export const vehicleRentalListings = pgTable("vehicle_rental_listings", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),

  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id),
  vehicleId: text("vehicle_id")
    .notNull()
    .references(() => vehicles.id),
  groupId: text("group_id").references(() => groups.id),

  dailyRateMinor: integer("daily_rate_minor").notNull(),
  // Attestation only — see the compliance note in CLAUDE.md. Never held by
  // the platform; collected and returned directly between owner and renter.
  declaredDepositMinor: integer("declared_deposit_minor"),

  active: boolean("active").notNull().default(true),
});

export const vehicleRentalBookings = pgTable("vehicle_rental_bookings", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),

  listingId: text("listing_id")
    .notNull()
    .references(() => vehicleRentalListings.id),
  renterUserId: text("renter_user_id")
    .notNull()
    .references(() => users.id),
  groupId: text("group_id").references(() => groups.id),

  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  totalFeeMinor: integer("total_fee_minor").notNull(),
  paymentMethod: text("payment_method", { enum: ["cash", "gateway"] }).notNull(),
  commissionMinor: integer("commission_minor"),

  status: text("status", { enum: rentalBookingStatusValues })
    .notNull()
    .default("requested"),
  requestedAt: text("requested_at").notNull(),
  acceptedAt: text("accepted_at"),
  activeAt: text("active_at"),
  completedAt: text("completed_at"),
  cancelledAt: text("cancelled_at"),
});

// ---------------------------------------------------------------------------
// Commission rules — flat fee per job type, per group, never a percentage,
// never hardcoded (CLAUDE.md "Money"). A group-specific rule overrides the
// platform-wide (groupId: null) rule for the same job type.
// ---------------------------------------------------------------------------

export const commissionRules = pgTable("commission_rules", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),

  jobType: text("job_type", {
    enum: ["food_order", "item_order", "fetch", "delivery", "ride", "vehicle_rental"],
  }).notNull(),
  groupId: text("group_id").references(() => groups.id),
  amountMinor: integer("amount_minor").notNull(),
  active: boolean("active").notNull().default(true),
});

// ---------------------------------------------------------------------------
// Ledger — double-entry. Balances are always derived, never stored mutable.
// ---------------------------------------------------------------------------

export const ledgerAccountTypeValues = [
  // Platform's own revenue account (flat commission fees).
  "platform_revenue",
  // What the platform owes a runner or vendor, paid out weekly.
  "runner_payable",
  "vendor_payable",
  // Runner's outlay on a purchase-on-behalf job — reimbursable, never
  // platform revenue.
  "runner_outlay_receivable",
  // Flat fee owed to the platform on a cash job, netted against payout.
  "accrued_fee_receivable",
  // A group's deposit backing their own payment gateway.
  "group_gateway_deposit",
  // Clearing account for a purchaser's gateway charge before it settles out.
  "purchaser_charge_clearing",
] as const;

export const ledgerEntries = pgTable("ledger_entries", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),

  groupId: text("group_id").references(() => groups.id),
  jobId: text("job_id").references(() => jobs.id),

  accountType: text("account_type", {
    enum: ledgerAccountTypeValues,
  }).notNull(),
  // The user, vendor, or group this account instance belongs to. Null only
  // for the single platform_revenue account.
  accountRefId: text("account_ref_id"),

  direction: text("direction", { enum: ["debit", "credit"] }).notNull(),
  amountMinor: integer("amount_minor").notNull(),

  description: text("description"),
  // Ties every payment-side operation to an idempotency key so webhook
  // replays and retried operations can't double-post.
  idempotencyKey: text("idempotency_key").notNull(),
});

// ---------------------------------------------------------------------------
// Payout batches
// ---------------------------------------------------------------------------

export const payoutBatches = pgTable("payout_batches", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),

  groupId: text("group_id").references(() => groups.id),
  payeeType: text("payee_type", { enum: ["runner", "vendor"] }).notNull(),
  payeeId: text("payee_id").notNull(),

  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),

  totalPayableMinor: integer("total_payable_minor").notNull(),
  totalFeesDeductedMinor: integer("total_fees_deducted_minor")
    .notNull()
    .default(0),

  status: text("status", {
    enum: ["pending", "processing", "paid", "failed"],
  })
    .notNull()
    .default("pending"),
  paidAt: text("paid_at"),
});

// ---------------------------------------------------------------------------
// Non-payment incidents (anonymous COD risk tracking — against real identity)
// ---------------------------------------------------------------------------

export const nonPaymentIncidents = pgTable("non_payment_incidents", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),

  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id),
  purchaserUserId: text("purchaser_user_id")
    .notNull()
    .references(() => users.id),
  reportedByUserId: text("reported_by_user_id")
    .notNull()
    .references(() => users.id),
  amountMinor: integer("amount_minor").notNull(),
  resolved: boolean("resolved").notNull().default(false),
});

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

export const ratings = pgTable("ratings", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),

  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id),
  raterUserId: text("rater_user_id")
    .notNull()
    .references(() => users.id),
  rateeUserId: text("ratee_user_id")
    .notNull()
    .references(() => users.id),

  score: integer("score").notNull(),
  comment: text("comment"),

  rejected: boolean("rejected").notNull().default(false),
  rejectionReason: text("rejection_reason"),
  resolutionOutcome: text("resolution_outcome"),
  resolverUserId: text("resolver_user_id").references(() => users.id),
  resolvedAt: text("resolved_at"),
});

// ---------------------------------------------------------------------------
// Perk rules — data-driven, so marketing can tune verified-tier perks
// without code changes.
// ---------------------------------------------------------------------------

export const perkRules = pgTable("perk_rules", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),

  name: text("name").notNull(),
  verificationTier: text("verification_tier", {
    enum: ["unverified", "verified"],
  }).notNull(),
  perkType: text("perk_type", {
    enum: ["voucher", "priority_window", "order_value_limit", "cod_eligible"],
  }).notNull(),
  // e.g. {"maxOrderValueMinor": 50000} or {"voucherCode": "WELCOME10"}
  configJson: text("config_json").notNull().default("{}"),

  groupId: text("group_id").references(() => groups.id),
  active: boolean("active").notNull().default(true),
});

// ---------------------------------------------------------------------------
// Audit log — append-only. No UPDATE, no DELETE, enforced at the repository
// layer (see src/db/repositories/auditLog.ts), not just by convention.
// ---------------------------------------------------------------------------

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  ts: text("ts").notNull(),

  actorUserId: text("actor_user_id"),
  actorRole: text("actor_role"),
  groupId: text("group_id"),
  impersonatedByUserId: text("impersonated_by_user_id"),

  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),

  beforeJson: text("before_json"),
  afterJson: text("after_json"),

  ip: text("ip"),
  userAgent: text("user_agent"),
  requestId: text("request_id").notNull(),

  result: text("result", { enum: ["success", "failure"] }).notNull(),
  resultReason: text("result_reason"),
});

// ---------------------------------------------------------------------------
// Relations (query convenience only — every cross-entity read still goes
// through a group-scoped repository function)
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  roles: many(userRoles),
}));

export const jobsRelations = relations(jobs, ({ one }) => ({
  purchaser: one(users, {
    fields: [jobs.purchaserUserId],
    references: [users.id],
  }),
  runner: one(users, { fields: [jobs.runnerUserId], references: [users.id] }),
  vendor: one(vendors, { fields: [jobs.vendorId], references: [vendors.id] }),
  group: one(groups, { fields: [jobs.groupId], references: [groups.id] }),
}));
