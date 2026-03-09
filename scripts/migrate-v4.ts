/**
 * CardPulse v4 Migration Script
 *
 * Drops old v3 tables and pushes new v4 schema via drizzle-kit.
 * Run: npx tsx scripts/migrate-v4.ts
 */

import { neon } from "@neondatabase/serverless"
import { config } from "dotenv"
config({ path: ".env.local" })

const sql = neon(process.env.DATABASE_URL!)

async function migrate() {
  console.log("🔄 CardPulse v4 Migration\n")

  // 1. Check existing tables
  const existing = await sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `
  const tableNames = existing.map((r: any) => r.tablename)
  console.log("Existing tables:", tableNames.join(", "))

  // 2. Drop old v3 tables that no longer exist in v4
  if (tableNames.includes("truelayer_connections")) {
    console.log("  Dropping old table: truelayer_connections")
    await sql`DROP TABLE IF EXISTS "truelayer_connections" CASCADE`
  }
  if (tableNames.includes("monthly_records")) {
    console.log("  Dropping old table: monthly_records")
    await sql`DROP TABLE IF EXISTS "monthly_records" CASCADE`
  }
  if (tableNames.includes("cards")) {
    console.log("  Dropping old table: cards")
    await sql`DROP TABLE IF EXISTS "cards" CASCADE`
  }

  // 3. Handle users table migration - remove old columns, add new ones
  if (tableNames.includes("users")) {
    console.log("\n  Migrating users table...")

    // Check existing columns
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND table_schema = 'public'
    `
    const colNames = cols.map((r: any) => r.column_name)
    console.log("  Existing user columns:", colNames.join(", "))

    // Remove old columns if they exist
    if (colNames.includes("util_threshold")) {
      console.log("    Dropping column: util_threshold")
      await sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "util_threshold"`
    }
    if (colNames.includes("theme")) {
      console.log("    Dropping column: theme")
      await sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "theme"`
    }
    if (colNames.includes("forecast_monthly")) {
      console.log("    Dropping column: forecast_monthly")
      await sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "forecast_monthly"`
    }

    // Add new columns if they don't exist
    if (!colNames.includes("base_currency")) {
      console.log("    Adding column: base_currency")
      await sql`ALTER TABLE "users" ADD COLUMN "base_currency" text NOT NULL DEFAULT 'GBP'`
    }
    if (!colNames.includes("onboarded")) {
      console.log("    Adding column: onboarded")
      await sql`ALTER TABLE "users" ADD COLUMN "onboarded" boolean NOT NULL DEFAULT false`
    }
  }

  // 4. Create new v4 tables
  console.log("\n  Creating new v4 tables...")

  // Accounts
  if (!tableNames.includes("accounts")) {
    console.log("    Creating: accounts")
    await sql`
      CREATE TABLE "accounts" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id"),
        "institution" text NOT NULL,
        "institution_domain" text,
        "account_name" text NOT NULL DEFAULT '',
        "category" text NOT NULL,
        "last4" text NOT NULL DEFAULT '',
        "currency" text NOT NULL DEFAULT 'GBP',
        "balance" real NOT NULL DEFAULT 0,
        "credit_limit" real,
        "overdraft_limit" real,
        "apr_regular" real,
        "apr_promo" real,
        "promo_until" text,
        "min_payment_override" real,
        "dd" text NOT NULL DEFAULT 'none',
        "dd_amount" real NOT NULL DEFAULT 0,
        "payment_day" integer,
        "statement_day" integer,
        "interest_charged" real,
        "minimum_payment" real,
        "payment_due_date" text,
        "last_statement_date" text,
        "balance_updated_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `
  }

  // Transactions
  if (!tableNames.includes("transactions")) {
    console.log("    Creating: transactions")
    await sql`
      CREATE TABLE "transactions" (
        "id" serial PRIMARY KEY,
        "account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
        "user_id" integer NOT NULL REFERENCES "users"("id"),
        "date" text NOT NULL,
        "description" text NOT NULL,
        "amount" real NOT NULL,
        "category" text NOT NULL DEFAULT 'uncategorised',
        "category_confidence" real,
        "source" text NOT NULL DEFAULT 'statement',
        "statement_id" text,
        "is_transfer" boolean NOT NULL DEFAULT false,
        "linked_transaction_id" integer,
        "needs_review" boolean NOT NULL DEFAULT false,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `
  }

  // Balance Snapshots
  if (!tableNames.includes("balance_snapshots")) {
    console.log("    Creating: balance_snapshots")
    await sql`
      CREATE TABLE "balance_snapshots" (
        "id" serial PRIMARY KEY,
        "account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
        "date" text NOT NULL,
        "balance" real NOT NULL,
        "credit_limit" real,
        "interest_charged" real,
        "minimum_payment" real,
        "payment_due_date" text,
        "statement_period_start" text,
        "statement_period_end" text,
        "source" text NOT NULL DEFAULT 'statement',
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `
  }

  // Category Correction Rules
  if (!tableNames.includes("category_correction_rules")) {
    console.log("    Creating: category_correction_rules")
    await sql`
      CREATE TABLE "category_correction_rules" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id"),
        "description_pattern" text NOT NULL,
        "from_category" text NOT NULL,
        "to_category" text NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `
  }

  // PDF Passwords
  if (!tableNames.includes("pdf_passwords")) {
    console.log("    Creating: pdf_passwords")
    await sql`
      CREATE TABLE "pdf_passwords" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id"),
        "institution" text NOT NULL,
        "encrypted_password" text NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `
  }

  // Exchange Rates
  if (!tableNames.includes("exchange_rates")) {
    console.log("    Creating: exchange_rates")
    await sql`
      CREATE TABLE "exchange_rates" (
        "id" serial PRIMARY KEY,
        "base_currency" text NOT NULL DEFAULT 'USD',
        "rates" jsonb NOT NULL,
        "fetched_at" timestamp NOT NULL DEFAULT now()
      )
    `
  }

  // Ensure otp_codes and sessions exist (they may already from v3)
  if (!tableNames.includes("otp_codes")) {
    console.log("    Creating: otp_codes")
    await sql`
      CREATE TABLE "otp_codes" (
        "id" serial PRIMARY KEY,
        "email" text NOT NULL,
        "code" text NOT NULL,
        "expires_at" timestamp NOT NULL,
        "used" boolean NOT NULL DEFAULT false,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `
  }

  if (!tableNames.includes("sessions")) {
    console.log("    Creating: sessions")
    await sql`
      CREATE TABLE "sessions" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id"),
        "token" text NOT NULL UNIQUE,
        "expires_at" timestamp NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `
  }

  // 5. Verify
  const final = await sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `
  console.log("\n✅ Migration complete! Tables:", final.map((r: any) => r.tablename).join(", "))
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err)
  process.exit(1)
})
