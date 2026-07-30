CREATE TABLE IF NOT EXISTS "system_health" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
