ALTER TABLE `matches` ADD `source` text DEFAULT 'gsi' NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `faceit_match_id` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `player_team` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `own_score` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `opp_score` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `result` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `kills` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `deaths` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `matches_faceit_match_id_unique` ON `matches` (`faceit_match_id`);--> statement-breakpoint
ALTER TABLE `pending_changes` ADD `text_value` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `faceit_nickname` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `faceit_player_id` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `faceit_api_key` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `faceit_synced_at` integer;