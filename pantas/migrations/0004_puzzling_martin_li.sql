CREATE TABLE `vehicle_rental_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`listing_id` text NOT NULL,
	`renter_user_id` text NOT NULL,
	`group_id` text,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`total_fee_minor` integer NOT NULL,
	`payment_method` text NOT NULL,
	`commission_minor` integer,
	`status` text DEFAULT 'requested' NOT NULL,
	`requested_at` text NOT NULL,
	`accepted_at` text,
	`active_at` text,
	`completed_at` text,
	`cancelled_at` text,
	FOREIGN KEY (`listing_id`) REFERENCES `vehicle_rental_listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`renter_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vehicle_rental_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`group_id` text,
	`daily_rate_minor` integer NOT NULL,
	`declared_deposit_minor` integer,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
