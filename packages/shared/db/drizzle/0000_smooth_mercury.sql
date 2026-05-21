CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"tenant_id" integer NOT NULL,
	"owner_id" integer NOT NULL,
	"room_id" integer NOT NULL,
	"rent_amount" integer NOT NULL,
	"tenant_payment_status" text DEFAULT 'pending' NOT NULL,
	"tenant_payment_reference" text,
	"tenant_payment_verified_at" timestamp,
	"pidx" text,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"signed_at" timestamp,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"terms" text,
	"owner_signature" text,
	"tenant_signature" text,
	"owner_signed_at" timestamp,
	"tenant_signed_at" timestamp,
	"status" text DEFAULT 'draft' NOT NULL,
	"contract_pdf_url" text,
	"admin_verified_at" timestamp,
	"admin_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"email" text NOT NULL,
	"phone" text,
	"role" text DEFAULT 'tenant' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verification_status" text DEFAULT 'none' NOT NULL,
	"profile_photo" text,
	"bio" text,
	"preferred_city" text,
	"password_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"price" real NOT NULL,
	"room_type" text NOT NULL,
	"tenant_type" text DEFAULT 'any' NOT NULL,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"parking" boolean DEFAULT false NOT NULL,
	"amenities" text[] DEFAULT '{}' NOT NULL,
	"photos" text[] DEFAULT '{}' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"nearby_landmarks" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"room_id" integer NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"receiver_id" integer NOT NULL,
	"room_id" integer,
	"content" text DEFAULT '' NOT NULL,
	"media_url" text,
	"media_type" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_docs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"doc_type" text NOT NULL,
	"doc_url" text NOT NULL,
	"selfie_url" text NOT NULL,
	"citizenship_number" text,
	"full_name_citizenship" text,
	"date_of_birth" text,
	"issue_date" text,
	"doc_photo_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"approved_at" timestamp,
	"approved_by" integer,
	"rejected_at" timestamp,
	"rejected_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"room_type" text,
	"tenant_type" text,
	"city" text,
	"min_budget" real,
	"max_budget" real,
	"parking" boolean DEFAULT false,
	"amenities" text[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"owner_id" integer NOT NULL,
	"room_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tenant_status" text DEFAULT 'pending' NOT NULL,
	"owner_status" text DEFAULT 'pending' NOT NULL,
	"match_score" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verification_docs" ADD CONSTRAINT "verification_docs_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_docs" ADD CONSTRAINT "verification_docs_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;