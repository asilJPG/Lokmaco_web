CREATE TABLE IF NOT EXISTS "bot_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"filial_id" integer NOT NULL,
	"tg_id" bigint,
	"user_name" text,
	"action_type" text NOT NULL,
	"document_number" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cash_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"filial_id" integer NOT NULL,
	"cashier_tg_id" bigint,
	"cashier_name" text,
	"reported_cash" bigint DEFAULT 0 NOT NULL,
	"iiko_cash" bigint DEFAULT 0 NOT NULL,
	"difference" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "filials" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"iiko_org_id" text,
	"iiko_login" text,
	"iiko_password_enc" text,
	"timezone" text DEFAULT 'Asia/Tashkent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pending_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filial_id" integer NOT NULL,
	"creator_tg_id" text,
	"creator_name" text,
	"creator_role" text,
	"store_from" text,
	"store_from_name" text,
	"store_to" text,
	"store_to_name" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"comment" text,
	"receiver_comment" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_filials" (
	"user_id" integer NOT NULL,
	"filial_id" integer NOT NULL,
	CONSTRAINT "user_filials_user_id_filial_id_pk" PRIMARY KEY("user_id","filial_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_passkeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_passkeys_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"tg_id" bigint,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"access_code" text,
	"last_login_at" timestamp with time zone,
	"last_login_method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_tg_id_unique" UNIQUE("tg_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bot_actions" ADD CONSTRAINT "bot_actions_filial_id_filials_id_fk" FOREIGN KEY ("filial_id") REFERENCES "public"."filials"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cash_reports" ADD CONSTRAINT "cash_reports_filial_id_filials_id_fk" FOREIGN KEY ("filial_id") REFERENCES "public"."filials"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_transfers" ADD CONSTRAINT "pending_transfers_filial_id_filials_id_fk" FOREIGN KEY ("filial_id") REFERENCES "public"."filials"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_filials" ADD CONSTRAINT "user_filials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_filials" ADD CONSTRAINT "user_filials_filial_id_filials_id_fk" FOREIGN KEY ("filial_id") REFERENCES "public"."filials"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_passkeys" ADD CONSTRAINT "user_passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bot_actions_filial_type_idx" ON "bot_actions" USING btree ("filial_id","action_type","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bot_actions_selected_date_idx" ON "bot_actions" USING btree ("filial_id","action_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bot_actions_created_idx" ON "bot_actions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_reports_filial_date_idx" ON "cash_reports" USING btree ("filial_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_transfers_filial_status_idx" ON "pending_transfers" USING btree ("filial_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_filials_filial_idx" ON "user_filials" USING btree ("filial_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "passkeys_user_idx" ON "user_passkeys" USING btree ("user_id");