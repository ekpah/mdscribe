SET lock_timeout = '10s';
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = current_schema()
			AND table_name = 'UsageEvent'
			AND column_name = 'timestamp'
			AND data_type = 'timestamp without time zone'
	) THEN
		ALTER TABLE "UsageEvent"
			ALTER COLUMN "timestamp" TYPE timestamp (3) with time zone
			USING "timestamp" AT TIME ZONE 'UTC';
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "UsageEvent"
	ALTER COLUMN "timestamp" SET DEFAULT now();
--> statement-breakpoint
RESET lock_timeout;
