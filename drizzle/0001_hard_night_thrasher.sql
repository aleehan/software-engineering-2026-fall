PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`match_limit` integer DEFAULT 3 NOT NULL,
	`close_delay_seconds` integer DEFAULT 0 NOT NULL,
	`password_hash` text,
	`gsi_token` text,
	CONSTRAINT "settings_singleton" CHECK("__new_settings"."id" = 1),
	CONSTRAINT "settings_limit_range" CHECK("__new_settings"."match_limit" BETWEEN 1 AND 10),
	CONSTRAINT "settings_delay_positive" CHECK("__new_settings"."close_delay_seconds" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_settings`("id", "match_limit", "close_delay_seconds", "password_hash", "gsi_token") SELECT "id", "match_limit", "close_delay_seconds", "password_hash", "gsi_token" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;