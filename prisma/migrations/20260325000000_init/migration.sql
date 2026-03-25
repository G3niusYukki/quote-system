-- Migration: init
-- Created: 2026-03-25
-- Description: Initial migration with all 14 models

-- ============================================================
-- CreateEnum types
-- ============================================================

-- Roles: owner, admin, member, viewer
-- Block types: pricing, restriction, surcharge, notes, clause
-- Issue types: unclear_header, cross_sheet, conflict, missing_field, ambiguous_condition
-- Dictionary categories: country, channel, transport_type, cargo_type, unit, currency, zone
-- Version statuses: draft, published, archived
-- Rule categories: surcharge, restriction, compensation, billing
-- Confidence levels: high, medium, low
-- Rule sources: ai, manual
-- Charge types: per_kg, per_item, fixed
-- Surcharge categories: remote, oversize, overweight, item_type, private_address, other
-- Restriction types: category, size, area

-- ============================================================
-- CreateTable: organizations
-- ============================================================
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "plan" VARCHAR(50) NOT NULL DEFAULT 'free',
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "organizations_name_idx" ON "organizations"("name");

-- ============================================================
-- CreateTable: users
-- ============================================================
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_email_key" UNIQUE ("email"),
    CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");
CREATE INDEX "users_email_idx" ON "users"("email");

-- ============================================================
-- CreateTable: import_jobs
-- ============================================================
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "upstream" VARCHAR(255) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "uploaded_by" UUID,
    "error_message" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "completed_at" TIMESTAMP,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "import_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "import_jobs_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "import_jobs_organization_id_idx" ON "import_jobs"("organization_id");
CREATE INDEX "import_jobs_status_idx" ON "import_jobs"("status");
CREATE INDEX "import_jobs_upstream_idx" ON "import_jobs"("upstream");

-- ============================================================
-- CreateTable: import_blocks
-- ============================================================
CREATE TABLE "import_blocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "import_job_id" UUID NOT NULL,
    "block_type" VARCHAR(50) NOT NULL,
    "sheet_name" VARCHAR(255) NOT NULL,
    "row_range" VARCHAR(50),
    "raw_text" TEXT NOT NULL,
    "normalized_text" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "needs_review" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "import_blocks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "import_blocks_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "import_blocks_import_job_id_idx" ON "import_blocks"("import_job_id");
CREATE INDEX "import_blocks_needs_review_idx" ON "import_blocks"("needs_review");
CREATE INDEX "import_blocks_block_type_idx" ON "import_blocks"("block_type");

-- ============================================================
-- CreateTable: parse_issues
-- ============================================================
CREATE TABLE "parse_issues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "import_block_id" UUID NOT NULL,
    "issue_type" VARCHAR(100) NOT NULL,
    "raw_segment" TEXT NOT NULL,
    "ai_extraction" JSONB NOT NULL,
    "reason" TEXT,
    "suggested_fix" TEXT,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP,

    CONSTRAINT "parse_issues_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "parse_issues_import_block_id_fkey" FOREIGN KEY ("import_block_id") REFERENCES "import_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "parse_issues_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "parse_issues_import_block_id_idx" ON "parse_issues"("import_block_id");
CREATE INDEX "parse_issues_issue_type_idx" ON "parse_issues"("issue_type");

-- ============================================================
-- CreateTable: mapping_dictionaries
-- ============================================================
CREATE TABLE "mapping_dictionaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "normalized_value" VARCHAR(255) NOT NULL,
    "aliases" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT "mapping_dictionaries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mapping_dictionaries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "mapping_dictionaries_organization_id_idx" ON "mapping_dictionaries"("organization_id");
CREATE INDEX "mapping_dictionaries_category_idx" ON "mapping_dictionaries"("category");
CREATE INDEX "mapping_dictionaries_normalized_value_idx" ON "mapping_dictionaries"("normalized_value");

-- ============================================================
-- CreateTable: rule_versions
-- ============================================================
CREATE TABLE "rule_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "upstream" VARCHAR(255) NOT NULL,
    "version" SERIAL NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "published_by" UUID,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "published_at" TIMESTAMP,

    CONSTRAINT "rule_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rule_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "rule_versions_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "rule_versions_organization_id_idx" ON "rule_versions"("organization_id");
CREATE INDEX "rule_versions_status_idx" ON "rule_versions"("status");
CREATE INDEX "rule_versions_upstream_idx" ON "rule_versions"("upstream");

-- ============================================================
-- CreateTable: rules
-- ============================================================
CREATE TABLE "rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "rule_version_id" UUID NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "type" VARCHAR(100),
    "item_type" JSONB,
    "charge_type" VARCHAR(50),
    "charge_value" DECIMAL(10,2),
    "condition" TEXT,
    "description" TEXT,
    "content" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "confidence" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "source" VARCHAR(20) NOT NULL DEFAULT 'ai',
    "raw_evidence" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "rules_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "rules_organization_id_idx" ON "rules"("organization_id");
CREATE INDEX "rules_rule_version_id_idx" ON "rules"("rule_version_id");
CREATE INDEX "rules_category_idx" ON "rules"("category");
CREATE INDEX "rules_confidence_idx" ON "rules"("confidence");

-- ============================================================
-- CreateTable: quote_versions
-- ============================================================
CREATE TABLE "quote_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "rule_version_id" UUID NOT NULL,
    "upstream" VARCHAR(255) NOT NULL,
    "version" SERIAL NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "published_by" UUID,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "published_at" TIMESTAMP,

    CONSTRAINT "quote_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "quote_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quote_versions_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quote_versions_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "quote_versions_organization_id_idx" ON "quote_versions"("organization_id");
CREATE INDEX "quote_versions_rule_version_id_idx" ON "quote_versions"("rule_version_id");
CREATE INDEX "quote_versions_status_idx" ON "quote_versions"("status");
CREATE INDEX "quote_versions_upstream_idx" ON "quote_versions"("upstream");

-- ============================================================
-- CreateTable: quotes
-- ============================================================
CREATE TABLE "quotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "quote_version_id" UUID NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "transport_type" VARCHAR(50) NOT NULL,
    "cargo_type" VARCHAR(50) NOT NULL,
    "channel_name" VARCHAR(255) NOT NULL,
    "zone" VARCHAR(100),
    "postcode_min" VARCHAR(50),
    "postcode_max" VARCHAR(50),
    "weight_min" DECIMAL(10,2) NOT NULL,
    "weight_max" DECIMAL(10,2),
    "unit_price" DECIMAL(10,4) NOT NULL,
    "time_estimate" VARCHAR(100),
    "raw_text" TEXT,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "quotes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quotes_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "quotes_organization_id_idx" ON "quotes"("organization_id");
CREATE INDEX "quotes_quote_version_id_idx" ON "quotes"("quote_version_id");
CREATE INDEX "quotes_country_idx" ON "quotes"("country");
CREATE INDEX "quotes_transport_type_idx" ON "quotes"("transport_type");
CREATE INDEX "quotes_cargo_type_idx" ON "quotes"("cargo_type");

-- ============================================================
-- CreateTable: surcharges
-- ============================================================
CREATE TABLE "surcharges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "quote_version_id" UUID NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "charge_type" VARCHAR(50),
    "charge_value" DECIMAL(10,2),
    "condition" TEXT,
    "raw_evidence" TEXT,

    CONSTRAINT "surcharges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "surcharges_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "surcharges_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "surcharges_organization_id_idx" ON "surcharges"("organization_id");
CREATE INDEX "surcharges_quote_version_id_idx" ON "surcharges"("quote_version_id");
CREATE INDEX "surcharges_category_idx" ON "surcharges"("category");

-- ============================================================
-- CreateTable: billing_rules
-- ============================================================
CREATE TABLE "billing_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "quote_version_id" UUID NOT NULL,
    "rule_type" VARCHAR(100) NOT NULL,
    "rule_key" VARCHAR(100) NOT NULL,
    "rule_value" TEXT NOT NULL,
    "raw_evidence" TEXT,

    CONSTRAINT "billing_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "billing_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "billing_rules_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "billing_rules_organization_id_idx" ON "billing_rules"("organization_id");
CREATE INDEX "billing_rules_quote_version_id_idx" ON "billing_rules"("quote_version_id");

-- ============================================================
-- CreateTable: restrictions
-- ============================================================
CREATE TABLE "restrictions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "quote_version_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "content" TEXT NOT NULL,
    "raw_evidence" TEXT,

    CONSTRAINT "restrictions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "restrictions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "restrictions_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "restrictions_organization_id_idx" ON "restrictions"("organization_id");
CREATE INDEX "restrictions_quote_version_id_idx" ON "restrictions"("quote_version_id");
CREATE INDEX "restrictions_type_idx" ON "restrictions"("type");

-- ============================================================
-- CreateTable: audit_logs
-- ============================================================
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100),
    "entity_id" VARCHAR(36),
    "before" JSONB,
    "after" JSONB,
    "ip" VARCHAR(50),
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs"("entity_type");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
