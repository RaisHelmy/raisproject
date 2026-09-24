CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`runner_user_id` text NOT NULL,
	`vehicle_type` text NOT NULL,
	`brand` text NOT NULL,
	`model` text NOT NULL,
	`year` integer,
	`plate_number` text NOT NULL,
	`engine_cc` integer,
	`segment` text,
	`seat_count` integer,
	`leather_seats` integer DEFAULT false NOT NULL,
	`aircond_condition` text,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`runner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
