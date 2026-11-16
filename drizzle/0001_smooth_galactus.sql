CREATE TABLE `planner_telegram_drafts` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`payload` text NOT NULL,
	`applied` integer DEFAULT 0 NOT NULL,
	`at` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
ALTER TABLE `planner_telegram` ADD `locked_until` integer DEFAULT 0 NOT NULL;