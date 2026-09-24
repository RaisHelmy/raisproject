-- Postgres-adapted mirror of ../0000_sleepy_jackal.sql, used ONLY by
-- tests/dualDb.test.ts to catch dialect drift early. This is NOT applied by
-- wrangler (D1 uses the sqlite file next door as the single source of
-- truth today). When we cut over to Postgres for real, this file — kept in
-- sync by the dual-db test failing whenever it drifts — becomes the seed
-- for the real Postgres migration set.
--
-- Differences from the SQLite original, and why:
--   - unquoted identifiers instead of `backticks` (Postgres doesn't accept
--     backtick-quoted identifiers)
--   - integer-mode boolean columns become native `boolean` (SQLite has no
--     boolean type; Postgres does, and won't accept `DEFAULT true` on an
--     `integer` column)
-- Every other type (text, integer) is identical on both engines.

CREATE TABLE audit_log (
	id text PRIMARY KEY NOT NULL,
	ts text NOT NULL,
	actor_user_id text,
	actor_role text,
	group_id text,
	impersonated_by_user_id text,
	action text NOT NULL,
	entity_type text NOT NULL,
	entity_id text,
	before_json text,
	after_json text,
	ip text,
	user_agent text,
	request_id text NOT NULL,
	result text NOT NULL,
	result_reason text
);

CREATE TABLE groups (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	name text NOT NULL,
	owner_user_id text NOT NULL,
	allow_anonymity boolean DEFAULT true NOT NULL,
	commission_override_minor integer,
	cod_policy text DEFAULT 'default' NOT NULL,
	settings_json text DEFAULT '{}' NOT NULL,
	own_gateway_enabled boolean DEFAULT false NOT NULL
);

CREATE TABLE users (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	real_name text NOT NULL,
	phone text NOT NULL,
	email text,
	password_hash text NOT NULL,
	handle text NOT NULL,
	anonymous_mode boolean DEFAULT false NOT NULL,
	auto_reject_anonymous_cod boolean DEFAULT true NOT NULL,
	verification_tier text DEFAULT 'unverified' NOT NULL,
	status text DEFAULT 'active' NOT NULL,
	quiet_ride_preferred boolean DEFAULT false NOT NULL,
	scent_free_vehicle boolean DEFAULT false NOT NULL
);

ALTER TABLE groups ADD FOREIGN KEY (owner_user_id) REFERENCES users(id) ON UPDATE no action ON DELETE no action;

CREATE TABLE group_members (
	id text PRIMARY KEY NOT NULL,
	group_id text NOT NULL REFERENCES groups(id) ON UPDATE no action ON DELETE no action,
	user_id text NOT NULL REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	role_in_group text,
	created_at text NOT NULL
);

CREATE TABLE vendors (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	user_id text NOT NULL REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	group_id text REFERENCES groups(id) ON UPDATE no action ON DELETE no action,
	business_name text NOT NULL,
	status text DEFAULT 'active' NOT NULL
);

CREATE TABLE jobs (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	group_id text REFERENCES groups(id) ON UPDATE no action ON DELETE no action,
	type text NOT NULL,
	status text DEFAULT 'draft' NOT NULL,
	purchaser_user_id text NOT NULL REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	runner_user_id text REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	vendor_id text REFERENCES vendors(id) ON UPDATE no action ON DELETE no action,
	payment_method text NOT NULL,
	declared_value_minor integer,
	item_cost_minor integer,
	delivery_fee_minor integer NOT NULL,
	commission_minor integer,
	is_anonymous_job boolean DEFAULT false NOT NULL,
	posted_at text,
	claimed_at text,
	picked_up_at text,
	in_transit_at text,
	delivered_at text,
	settled_at text,
	cancelled_at text,
	quiet_ride_requested boolean DEFAULT false NOT NULL,
	requested_vehicle_brand text,
	requested_vehicle_model text,
	requested_vehicle_segment text,
	pool_enabled boolean DEFAULT false NOT NULL,
	scheduled_for text,
	spawned_from_schedule_id text,
	vendor_contract_id text
);

CREATE TABLE vehicles (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	runner_user_id text NOT NULL REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	vehicle_type text NOT NULL,
	brand text NOT NULL,
	model text NOT NULL,
	year integer,
	plate_number text NOT NULL,
	engine_cc integer,
	segment text,
	seat_count integer,
	leather_seats boolean DEFAULT false NOT NULL,
	aircond_condition text,
	active boolean DEFAULT true NOT NULL
);

CREATE TABLE job_offers (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	group_id text REFERENCES groups(id) ON UPDATE no action ON DELETE no action,
	job_id text NOT NULL REFERENCES jobs(id) ON UPDATE no action ON DELETE no action,
	runner_user_id text NOT NULL REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	proposed_fee_minor integer NOT NULL,
	message text,
	status text DEFAULT 'pending' NOT NULL,
	responded_at text
);

CREATE TABLE ledger_entries (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	group_id text REFERENCES groups(id) ON UPDATE no action ON DELETE no action,
	job_id text REFERENCES jobs(id) ON UPDATE no action ON DELETE no action,
	account_type text NOT NULL,
	account_ref_id text,
	direction text NOT NULL,
	amount_minor integer NOT NULL,
	description text,
	idempotency_key text NOT NULL
);

CREATE TABLE non_payment_incidents (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	job_id text NOT NULL REFERENCES jobs(id) ON UPDATE no action ON DELETE no action,
	purchaser_user_id text NOT NULL REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	reported_by_user_id text NOT NULL REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	amount_minor integer NOT NULL,
	resolved boolean DEFAULT false NOT NULL
);

CREATE TABLE payout_batches (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	group_id text REFERENCES groups(id) ON UPDATE no action ON DELETE no action,
	payee_type text NOT NULL,
	payee_id text NOT NULL,
	period_start text NOT NULL,
	period_end text NOT NULL,
	total_payable_minor integer NOT NULL,
	total_fees_deducted_minor integer DEFAULT 0 NOT NULL,
	status text DEFAULT 'pending' NOT NULL,
	paid_at text
);

CREATE TABLE perk_rules (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	name text NOT NULL,
	verification_tier text NOT NULL,
	perk_type text NOT NULL,
	config_json text DEFAULT '{}' NOT NULL,
	group_id text REFERENCES groups(id) ON UPDATE no action ON DELETE no action,
	active boolean DEFAULT true NOT NULL
);

CREATE TABLE ratings (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	job_id text NOT NULL REFERENCES jobs(id) ON UPDATE no action ON DELETE no action,
	rater_user_id text NOT NULL REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	ratee_user_id text NOT NULL REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	score integer NOT NULL,
	comment text,
	rejected boolean DEFAULT false NOT NULL,
	rejection_reason text,
	resolution_outcome text,
	resolver_user_id text REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	resolved_at text
);

CREATE TABLE user_roles (
	id text PRIMARY KEY NOT NULL,
	user_id text NOT NULL REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	role text NOT NULL,
	created_at text NOT NULL
);

CREATE TABLE commission_rules (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	job_type text NOT NULL,
	group_id text REFERENCES groups(id) ON UPDATE no action ON DELETE no action,
	amount_minor integer NOT NULL,
	active boolean DEFAULT true NOT NULL
);

CREATE TABLE job_pool_legs (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	job_id text NOT NULL REFERENCES jobs(id) ON UPDATE no action ON DELETE no action,
	purchaser_user_id text NOT NULL REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	pickup_note text,
	dropoff_note text,
	fare_minor integer NOT NULL,
	status text DEFAULT 'pending' NOT NULL
);

CREATE TABLE products (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	vendor_id text NOT NULL REFERENCES vendors(id) ON UPDATE no action ON DELETE no action,
	group_id text REFERENCES groups(id) ON UPDATE no action ON DELETE no action,
	name text NOT NULL,
	description text,
	price_minor integer NOT NULL,
	active boolean DEFAULT true NOT NULL
);

CREATE TABLE ride_schedules (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	group_id text REFERENCES groups(id) ON UPDATE no action ON DELETE no action,
	purchaser_user_id text NOT NULL REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	job_type text NOT NULL,
	days_of_week_json text NOT NULL,
	time_of_day text NOT NULL,
	pool_preferred boolean DEFAULT false NOT NULL,
	preferred_runner_user_id text REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	delivery_fee_minor integer NOT NULL,
	payment_method text NOT NULL,
	status text DEFAULT 'active' NOT NULL,
	lead_time_minutes integer DEFAULT 30 NOT NULL
);

CREATE TABLE sos_incidents (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	job_id text NOT NULL REFERENCES jobs(id) ON UPDATE no action ON DELETE no action,
	triggered_by_user_id text NOT NULL REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	last_known_lat text,
	last_known_lng text,
	status text DEFAULT 'triggered' NOT NULL,
	acknowledged_by_user_id text REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	acknowledged_at text,
	resolved_by_user_id text REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	resolved_at text,
	resolution_note text
);

CREATE TABLE vendor_contracts (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	group_id text NOT NULL REFERENCES groups(id) ON UPDATE no action ON DELETE no action,
	vendor_id text NOT NULL REFERENCES vendors(id) ON UPDATE no action ON DELETE no action,
	price_per_meal_minor integer NOT NULL,
	days_of_week_json text NOT NULL,
	meal_time text NOT NULL,
	menu_terms text,
	contract_start text NOT NULL,
	contract_end text,
	status text DEFAULT 'negotiating' NOT NULL
);

CREATE TABLE vehicle_rental_listings (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	owner_user_id text NOT NULL REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	vehicle_id text NOT NULL REFERENCES vehicles(id) ON UPDATE no action ON DELETE no action,
	group_id text REFERENCES groups(id) ON UPDATE no action ON DELETE no action,
	daily_rate_minor integer NOT NULL,
	declared_deposit_minor integer,
	active boolean DEFAULT true NOT NULL
);

CREATE TABLE vehicle_rental_bookings (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	listing_id text NOT NULL REFERENCES vehicle_rental_listings(id) ON UPDATE no action ON DELETE no action,
	renter_user_id text NOT NULL REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	group_id text REFERENCES groups(id) ON UPDATE no action ON DELETE no action,
	start_date text NOT NULL,
	end_date text NOT NULL,
	total_fee_minor integer NOT NULL,
	payment_method text NOT NULL,
	commission_minor integer,
	status text DEFAULT 'requested' NOT NULL,
	requested_at text NOT NULL,
	accepted_at text,
	active_at text,
	completed_at text,
	cancelled_at text
);

CREATE TABLE vendor_contract_offers (
	id text PRIMARY KEY NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	contract_id text NOT NULL REFERENCES vendor_contracts(id) ON UPDATE no action ON DELETE no action,
	proposed_by_role text NOT NULL,
	proposed_by_user_id text NOT NULL REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	proposed_price_per_meal_minor integer NOT NULL,
	proposed_terms text,
	status text DEFAULT 'pending' NOT NULL,
	responded_at text
);
