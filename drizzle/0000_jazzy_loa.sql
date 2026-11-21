CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`finished_at` integer NOT NULL,
	`mode` text NOT NULL,
	`map` text NOT NULL,
	`steam_id` text NOT NULL,
	`ct_score` integer,
	`t_score` integer
);
--> statement-breakpoint
CREATE INDEX `matches_finished_at_idx` ON `matches` (`finished_at`);--> statement-breakpoint
CREATE TABLE `pending_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`value` integer,
	`requested_at` integer NOT NULL,
	`apply_after` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pending_changes_status_idx` ON `pending_changes` (`status`,`apply_after`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`match_limit` integer DEFAULT 3 NOT NULL,
	`close_delay_seconds` integer DEFAULT 120 NOT NULL,
	`password_hash` text,
	`gsi_token` text,
	CONSTRAINT "settings_singleton" CHECK("settings"."id" = 1),
	CONSTRAINT "settings_limit_range" CHECK("settings"."match_limit" BETWEEN 1 AND 10),
	CONSTRAINT "settings_delay_positive" CHECK("settings"."close_delay_seconds" >= 0)
);
