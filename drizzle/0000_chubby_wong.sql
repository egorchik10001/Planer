CREATE TABLE `planner_entities` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`last_op` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `planner_history` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`entity_id` text NOT NULL,
	`kind` text NOT NULL,
	`before_data` text,
	`after_data` text NOT NULL,
	`at` text NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `planner_history_owner` ON `planner_history` (`owner`,`entity_id`);--> statement-breakpoint
CREATE TABLE `planner_receipts` (
	`owner` text NOT NULL,
	`op_id` text NOT NULL,
	`at` text NOT NULL,
	PRIMARY KEY(`owner`, `op_id`)
);
--> statement-breakpoint
CREATE TABLE `planner_telegram` (
	`owner` text PRIMARY KEY NOT NULL,
	`chat_id` text,
	`link_code` text,
	`link_expires` text,
	`last_update` integer DEFAULT 0 NOT NULL
);
