CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`ts` text NOT NULL,
	`actor_user_id` text,
	`actor_role` text,
	`group_id` text,
	`impersonated_by_user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`before_json` text,
	`after_json` text,
	`ip` text,
	`user_agent` text,
	`request_id` text NOT NULL,
	`result` text NOT NULL,
	`result_reason` text
);
--> statement-breakpoint
CREATE TABLE `group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_in_group` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`name` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`allow_anonymity` integer DEFAULT true NOT NULL,
	`commission_override_minor` integer,
	`cod_policy` text DEFAULT 'default' NOT NULL,
	`settings_json` text DEFAULT '{}' NOT NULL,
	`own_gateway_enabled` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`group_id` text,
	`type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`purchaser_user_id` text NOT NULL,
	`runner_user_id` text,
	`vendor_id` text,
	`payment_method` text NOT NULL,
	`declared_value_minor` integer,
	`item_cost_minor` integer,
	`delivery_fee_minor` integer NOT NULL,
	`commission_minor` integer,
	`is_anonymous_job` integer DEFAULT false NOT NULL,
	`posted_at` text,
	`claimed_at` text,
	`picked_up_at` text,
	`in_transit_at` text,
	`delivered_at` text,
	`settled_at` text,
	`cancelled_at` text,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchaser_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`runner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`group_id` text,
	`job_id` text,
	`account_type` text NOT NULL,
	`account_ref_id` text,
	`direction` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`description` text,
	`idempotency_key` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `non_payment_incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`job_id` text NOT NULL,
	`purchaser_user_id` text NOT NULL,
	`reported_by_user_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchaser_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reported_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payout_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`group_id` text,
	`payee_type` text NOT NULL,
	`payee_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`total_payable_minor` integer NOT NULL,
	`total_fees_deducted_minor` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`paid_at` text,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `perk_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`name` text NOT NULL,
	`verification_tier` text NOT NULL,
	`perk_type` text NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`group_id` text,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`job_id` text NOT NULL,
	`rater_user_id` text NOT NULL,
	`ratee_user_id` text NOT NULL,
	`score` integer NOT NULL,
	`comment` text,
	`rejected` integer DEFAULT false NOT NULL,
	`rejection_reason` text,
	`resolution_outcome` text,
	`resolver_user_id` text,
	`resolved_at` text,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rater_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ratee_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolver_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`real_name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`password_hash` text NOT NULL,
	`handle` text NOT NULL,
	`anonymous_mode` integer DEFAULT false NOT NULL,
	`auto_reject_anonymous_cod` integer DEFAULT true NOT NULL,
	`verification_tier` text DEFAULT 'unverified' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`user_id` text NOT NULL,
	`group_id` text,
	`business_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
