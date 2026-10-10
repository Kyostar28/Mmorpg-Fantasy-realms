CREATE TABLE `auction_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`seller_id` text NOT NULL,
	`seller_name` text NOT NULL,
	`item_id` text NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`price` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`buyer_name` text,
	`proceeds_claimed` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auction_status` ON `auction_listings` (`status`);--> statement-breakpoint
CREATE INDEX `auction_seller` ON `auction_listings` (`seller_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`username_lower` text NOT NULL,
	`race` text,
	`class_name` text,
	`level` integer DEFAULT 1 NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`gold` integer DEFAULT 10 NOT NULL,
	`kills` integer DEFAULT 0 NOT NULL,
	`zone` text,
	`pos_x` real,
	`pos_z` real,
	`inventory` text,
	`equipment` text,
	`graphics` text DEFAULT 'normal' NOT NULL,
	`last_login` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_username_lower` ON `players` (`username_lower`);--> statement-breakpoint
CREATE INDEX `players_level` ON `players` (`level`);