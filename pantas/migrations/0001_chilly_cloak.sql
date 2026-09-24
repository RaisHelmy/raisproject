CREATE TABLE `job_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`group_id` text,
	`job_id` text NOT NULL,
	`runner_user_id` text NOT NULL,
	`proposed_fee_minor` integer NOT NULL,
	`message` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`responded_at` text,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`runner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
