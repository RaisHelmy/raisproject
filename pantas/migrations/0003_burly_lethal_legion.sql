CREATE TABLE `commission_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`job_type` text NOT NULL,
	`group_id` text,
	`amount_minor` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `job_pool_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`job_id` text NOT NULL,
	`purchaser_user_id` text NOT NULL,
	`pickup_note` text,
	`dropoff_note` text,
	`fare_minor` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchaser_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`vendor_id` text NOT NULL,
	`group_id` text,
	`name` text NOT NULL,
	`description` text,
	`price_minor` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ride_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`group_id` text,
	`purchaser_user_id` text NOT NULL,
	`job_type` text NOT NULL,
	`days_of_week_json` text NOT NULL,
	`time_of_day` text NOT NULL,
	`pool_preferred` integer DEFAULT false NOT NULL,
	`preferred_runner_user_id` text,
	`delivery_fee_minor` integer NOT NULL,
	`payment_method` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`lead_time_minutes` integer DEFAULT 30 NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchaser_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`preferred_runner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sos_incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`job_id` text NOT NULL,
	`triggered_by_user_id` text NOT NULL,
	`last_known_lat` text,
	`last_known_lng` text,
	`status` text DEFAULT 'triggered' NOT NULL,
	`acknowledged_by_user_id` text,
	`acknowledged_at` text,
	`resolved_by_user_id` text,
	`resolved_at` text,
	`resolution_note` text,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`triggered_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`acknowledged_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vendor_contract_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`contract_id` text NOT NULL,
	`proposed_by_role` text NOT NULL,
	`proposed_by_user_id` text NOT NULL,
	`proposed_price_per_meal_minor` integer NOT NULL,
	`proposed_terms` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`responded_at` text,
	FOREIGN KEY (`contract_id`) REFERENCES `vendor_contracts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vendor_contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`group_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`price_per_meal_minor` integer NOT NULL,
	`days_of_week_json` text NOT NULL,
	`meal_time` text NOT NULL,
	`menu_terms` text,
	`contract_start` text NOT NULL,
	`contract_end` text,
	`status` text DEFAULT 'negotiating' NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `jobs` ADD `quiet_ride_requested` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `requested_vehicle_brand` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `requested_vehicle_model` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `requested_vehicle_segment` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `pool_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `scheduled_for` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `spawned_from_schedule_id` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `vendor_contract_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `quiet_ride_preferred` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `scent_free_vehicle` integer DEFAULT false NOT NULL;