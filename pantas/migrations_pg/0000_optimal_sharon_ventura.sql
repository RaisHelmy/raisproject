CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"ts" text NOT NULL,
	"actor_user_id" text,
	"actor_role" text,
	"group_id" text,
	"impersonated_by_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before_json" text,
	"after_json" text,
	"ip" text,
	"user_agent" text,
	"request_id" text NOT NULL,
	"result" text NOT NULL,
	"result_reason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commission_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"job_type" text NOT NULL,
	"group_id" text,
	"amount_minor" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "group_members" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role_in_group" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "groups" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"allow_anonymity" boolean DEFAULT true NOT NULL,
	"commission_override_minor" integer,
	"cod_policy" text DEFAULT 'default' NOT NULL,
	"settings_json" text DEFAULT '{}' NOT NULL,
	"own_gateway_enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_offers" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"group_id" text,
	"job_id" text NOT NULL,
	"runner_user_id" text NOT NULL,
	"proposed_fee_minor" integer NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"responded_at" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_pool_legs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"job_id" text NOT NULL,
	"purchaser_user_id" text NOT NULL,
	"pickup_note" text,
	"dropoff_note" text,
	"fare_minor" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"group_id" text,
	"type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"purchaser_user_id" text NOT NULL,
	"runner_user_id" text,
	"vendor_id" text,
	"payment_method" text NOT NULL,
	"declared_value_minor" integer,
	"item_cost_minor" integer,
	"delivery_fee_minor" integer NOT NULL,
	"commission_minor" integer,
	"is_anonymous_job" boolean DEFAULT false NOT NULL,
	"posted_at" text,
	"claimed_at" text,
	"picked_up_at" text,
	"in_transit_at" text,
	"delivered_at" text,
	"settled_at" text,
	"cancelled_at" text,
	"quiet_ride_requested" boolean DEFAULT false NOT NULL,
	"requested_vehicle_brand" text,
	"requested_vehicle_model" text,
	"requested_vehicle_segment" text,
	"pool_enabled" boolean DEFAULT false NOT NULL,
	"scheduled_for" text,
	"spawned_from_schedule_id" text,
	"vendor_contract_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"group_id" text,
	"job_id" text,
	"account_type" text NOT NULL,
	"account_ref_id" text,
	"direction" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"description" text,
	"idempotency_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "non_payment_incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"job_id" text NOT NULL,
	"purchaser_user_id" text NOT NULL,
	"reported_by_user_id" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payout_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"group_id" text,
	"payee_type" text NOT NULL,
	"payee_id" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"total_payable_minor" integer NOT NULL,
	"total_fees_deducted_minor" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "perk_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"name" text NOT NULL,
	"verification_tier" text NOT NULL,
	"perk_type" text NOT NULL,
	"config_json" text DEFAULT '{}' NOT NULL,
	"group_id" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"vendor_id" text NOT NULL,
	"group_id" text,
	"name" text NOT NULL,
	"description" text,
	"price_minor" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"job_id" text NOT NULL,
	"rater_user_id" text NOT NULL,
	"ratee_user_id" text NOT NULL,
	"score" integer NOT NULL,
	"comment" text,
	"rejected" boolean DEFAULT false NOT NULL,
	"rejection_reason" text,
	"resolution_outcome" text,
	"resolver_user_id" text,
	"resolved_at" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ride_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"group_id" text,
	"purchaser_user_id" text NOT NULL,
	"job_type" text NOT NULL,
	"days_of_week_json" text NOT NULL,
	"time_of_day" text NOT NULL,
	"pool_preferred" boolean DEFAULT false NOT NULL,
	"preferred_runner_user_id" text,
	"delivery_fee_minor" integer NOT NULL,
	"payment_method" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"lead_time_minutes" integer DEFAULT 30 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sos_incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"job_id" text NOT NULL,
	"triggered_by_user_id" text NOT NULL,
	"last_known_lat" text,
	"last_known_lng" text,
	"status" text DEFAULT 'triggered' NOT NULL,
	"acknowledged_by_user_id" text,
	"acknowledged_at" text,
	"resolved_by_user_id" text,
	"resolved_at" text,
	"resolution_note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"real_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"password_hash" text NOT NULL,
	"handle" text NOT NULL,
	"anonymous_mode" boolean DEFAULT false NOT NULL,
	"auto_reject_anonymous_cod" boolean DEFAULT true NOT NULL,
	"verification_tier" text DEFAULT 'unverified' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"quiet_ride_preferred" boolean DEFAULT false NOT NULL,
	"scent_free_vehicle" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicle_rental_bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"listing_id" text NOT NULL,
	"renter_user_id" text NOT NULL,
	"group_id" text,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"total_fee_minor" integer NOT NULL,
	"payment_method" text NOT NULL,
	"commission_minor" integer,
	"status" text DEFAULT 'requested' NOT NULL,
	"requested_at" text NOT NULL,
	"accepted_at" text,
	"active_at" text,
	"completed_at" text,
	"cancelled_at" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicle_rental_listings" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"vehicle_id" text NOT NULL,
	"group_id" text,
	"daily_rate_minor" integer NOT NULL,
	"declared_deposit_minor" integer,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"runner_user_id" text NOT NULL,
	"vehicle_type" text NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"year" integer,
	"plate_number" text NOT NULL,
	"engine_cc" integer,
	"segment" text,
	"seat_count" integer,
	"leather_seats" boolean DEFAULT false NOT NULL,
	"aircond_condition" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_contract_offers" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"contract_id" text NOT NULL,
	"proposed_by_role" text NOT NULL,
	"proposed_by_user_id" text NOT NULL,
	"proposed_price_per_meal_minor" integer NOT NULL,
	"proposed_terms" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"responded_at" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_contracts" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"group_id" text NOT NULL,
	"vendor_id" text NOT NULL,
	"price_per_meal_minor" integer NOT NULL,
	"days_of_week_json" text NOT NULL,
	"meal_time" text NOT NULL,
	"menu_terms" text,
	"contract_start" text NOT NULL,
	"contract_end" text,
	"status" text DEFAULT 'negotiating' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"user_id" text NOT NULL,
	"group_id" text,
	"business_name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_runner_user_id_users_id_fk" FOREIGN KEY ("runner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_pool_legs" ADD CONSTRAINT "job_pool_legs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_pool_legs" ADD CONSTRAINT "job_pool_legs_purchaser_user_id_users_id_fk" FOREIGN KEY ("purchaser_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs" ADD CONSTRAINT "jobs_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs" ADD CONSTRAINT "jobs_purchaser_user_id_users_id_fk" FOREIGN KEY ("purchaser_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs" ADD CONSTRAINT "jobs_runner_user_id_users_id_fk" FOREIGN KEY ("runner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs" ADD CONSTRAINT "jobs_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "non_payment_incidents" ADD CONSTRAINT "non_payment_incidents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "non_payment_incidents" ADD CONSTRAINT "non_payment_incidents_purchaser_user_id_users_id_fk" FOREIGN KEY ("purchaser_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "non_payment_incidents" ADD CONSTRAINT "non_payment_incidents_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payout_batches" ADD CONSTRAINT "payout_batches_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "perk_rules" ADD CONSTRAINT "perk_rules_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ratings" ADD CONSTRAINT "ratings_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rater_user_id_users_id_fk" FOREIGN KEY ("rater_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ratings" ADD CONSTRAINT "ratings_ratee_user_id_users_id_fk" FOREIGN KEY ("ratee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ratings" ADD CONSTRAINT "ratings_resolver_user_id_users_id_fk" FOREIGN KEY ("resolver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_schedules" ADD CONSTRAINT "ride_schedules_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_schedules" ADD CONSTRAINT "ride_schedules_purchaser_user_id_users_id_fk" FOREIGN KEY ("purchaser_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_schedules" ADD CONSTRAINT "ride_schedules_preferred_runner_user_id_users_id_fk" FOREIGN KEY ("preferred_runner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sos_incidents" ADD CONSTRAINT "sos_incidents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sos_incidents" ADD CONSTRAINT "sos_incidents_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sos_incidents" ADD CONSTRAINT "sos_incidents_acknowledged_by_user_id_users_id_fk" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sos_incidents" ADD CONSTRAINT "sos_incidents_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_rental_bookings" ADD CONSTRAINT "vehicle_rental_bookings_listing_id_vehicle_rental_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."vehicle_rental_listings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_rental_bookings" ADD CONSTRAINT "vehicle_rental_bookings_renter_user_id_users_id_fk" FOREIGN KEY ("renter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_rental_bookings" ADD CONSTRAINT "vehicle_rental_bookings_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_rental_listings" ADD CONSTRAINT "vehicle_rental_listings_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_rental_listings" ADD CONSTRAINT "vehicle_rental_listings_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_rental_listings" ADD CONSTRAINT "vehicle_rental_listings_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_runner_user_id_users_id_fk" FOREIGN KEY ("runner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_contract_offers" ADD CONSTRAINT "vendor_contract_offers_contract_id_vendor_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."vendor_contracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_contract_offers" ADD CONSTRAINT "vendor_contract_offers_proposed_by_user_id_users_id_fk" FOREIGN KEY ("proposed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_contracts" ADD CONSTRAINT "vendor_contracts_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_contracts" ADD CONSTRAINT "vendor_contracts_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendors" ADD CONSTRAINT "vendors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendors" ADD CONSTRAINT "vendors_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
