CREATE TYPE "public"."application_status" AS ENUM('applied', 'reviewing', 'shortlisted', 'interview', 'rejected', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('seeker', 'company', 'admin');--> statement-breakpoint
CREATE TYPE "public"."contract_type" AS ENUM('full-time', 'part-time', 'contract', 'internship');--> statement-breakpoint
CREATE TYPE "public"."experience_level" AS ENUM('entry', 'mid', 'senior', 'lead');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('draft', 'active', 'paused', 'closed');--> statement-breakpoint
CREATE TYPE "public"."skill_category" AS ENUM('professional', 'technical', 'soft', 'language');--> statement-breakpoint
CREATE TABLE "match_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"overall_score" integer NOT NULL,
	"breakdown" jsonb,
	"explanation" text,
	"model_version" text DEFAULT 'v1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"status" "application_status" DEFAULT 'applied' NOT NULL,
	"match_score" integer,
	"match_breakdown" jsonb,
	"ai_explanation" text,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"headline" text,
	"summary" text,
	"location" text,
	"years_experience" integer,
	"cv_url" text,
	"cv_parsed_data" jsonb,
	"preferences" jsonb,
	"completion" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"name" text NOT NULL,
	"issuer" text,
	"year" integer
);
--> statement-breakpoint
CREATE TABLE "education" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"degree" text NOT NULL,
	"field" text,
	"institution" text,
	"year" integer
);
--> statement-breakpoint
CREATE TABLE "experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"role" text NOT NULL,
	"company" text NOT NULL,
	"location" text,
	"description" text,
	"start_date" text,
	"end_date" text,
	"current" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"url" text
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"industry" text NOT NULL,
	"location" text NOT NULL,
	"website" text,
	"description" text,
	"logo_url" text,
	"employee_count" integer,
	"founded_year" integer,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'seeker' NOT NULL,
	"phone" text,
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"industry" text NOT NULL,
	"location" text NOT NULL,
	"contract_type" "contract_type" DEFAULT 'full-time' NOT NULL,
	"experience_level" "experience_level" DEFAULT 'mid' NOT NULL,
	"salary_min" integer,
	"salary_max" integer,
	"deadline" timestamp with time zone,
	"status" "job_status" DEFAULT 'draft' NOT NULL,
	"applicants_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"skill_id" integer NOT NULL,
	"proficiency" integer DEFAULT 3 NOT NULL,
	"years_experience" integer
);
--> statement-breakpoint
CREATE TABLE "job_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"skill_id" integer NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" "skill_category" DEFAULT 'professional' NOT NULL,
	CONSTRAINT "skills_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "applications_job_candidate_unique" ON "applications" USING btree ("job_id","candidate_id");