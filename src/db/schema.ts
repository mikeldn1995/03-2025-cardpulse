import { pgTable, serial, text, integer, real, timestamp, boolean, date, jsonb } from "drizzle-orm/pg-core"

// ── Users & Auth ──────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  baseCurrency: text("base_currency").notNull().default("GBP"),
  onboarded: boolean("onboarded").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const otpCodes = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ── Account Categories ────────────────────────────────────
// credit_card | current_account | savings | isa | investment | crypto | loan | mortgage

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  institution: text("institution").notNull(),            // e.g. "Barclays", "Wise", "eToro"
  institutionDomain: text("institution_domain"),          // e.g. "barclays.co.uk" for logo lookup
  accountName: text("account_name").notNull().default(""), // e.g. "Barclaycard Platinum"
  category: text("category").notNull(),                  // credit_card | current_account | savings | isa | investment | crypto | loan | mortgage
  last4: text("last4").notNull().default(""),            // last 4 digits or account identifier
  currency: text("currency").notNull().default("GBP"),
  balance: real("balance").notNull().default(0),         // current balance (positive = asset, negative for debt accounts means owed)
  creditLimit: real("credit_limit"),                     // for credit cards / overdraft
  overdraftLimit: real("overdraft_limit"),                // for current accounts
  aprRegular: real("apr_regular"),                        // annual percentage rate
  aprPromo: real("apr_promo"),                            // promotional APR
  promoUntil: text("promo_until"),                        // "YYYY-MM-DD"
  minPaymentOverride: real("min_payment_override"),       // user override
  dd: text("dd").notNull().default("none"),              // "minimum" | "custom" | "full" | "none"
  ddAmount: real("dd_amount").notNull().default(0),
  paymentDay: integer("payment_day"),                     // day of month
  statementDay: integer("statement_day"),                 // day of month
  interestCharged: real("interest_charged"),              // from latest statement
  minimumPayment: real("minimum_payment"),                // from latest statement
  paymentDueDate: text("payment_due_date"),               // from latest statement "YYYY-MM-DD"
  lastStatementDate: text("last_statement_date"),         // "YYYY-MM-DD"
  balanceUpdatedAt: timestamp("balance_updated_at"),      // when balance was last updated
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ── Transactions ──────────────────────────────────────────

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  date: text("date").notNull(),                          // "YYYY-MM-DD"
  description: text("description").notNull(),
  amount: real("amount").notNull(),                      // positive = credit/income, negative = debit/expense
  category: text("category").notNull().default("uncategorised"),
  categoryConfidence: real("category_confidence"),        // 0-1 AI confidence
  source: text("source").notNull().default("statement"), // "statement" | "manual"
  statementId: text("statement_id"),                     // links to the upload batch
  isTransfer: boolean("is_transfer").notNull().default(false),
  linkedTransactionId: integer("linked_transaction_id"), // paired transfer transaction
  needsReview: boolean("needs_review").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ── Balance Snapshots (from statements) ───────────────────

export const balanceSnapshots = pgTable("balance_snapshots", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  date: text("date").notNull(),                          // "YYYY-MM-DD" statement date
  balance: real("balance").notNull(),
  creditLimit: real("credit_limit"),
  interestCharged: real("interest_charged"),
  minimumPayment: real("minimum_payment"),
  paymentDueDate: text("payment_due_date"),
  statementPeriodStart: text("statement_period_start"),  // "YYYY-MM-DD"
  statementPeriodEnd: text("statement_period_end"),      // "YYYY-MM-DD"
  source: text("source").notNull().default("statement"), // "statement" | "manual"
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ── Category Corrections (for AI learning) ────────────────

export const categoryCorrectionRules = pgTable("category_correction_rules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  descriptionPattern: text("description_pattern").notNull(), // the description that was corrected
  fromCategory: text("from_category").notNull(),
  toCategory: text("to_category").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ── PDF Passwords (encrypted per institution) ─────────────

export const pdfPasswords = pgTable("pdf_passwords", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  institution: text("institution").notNull(),
  encryptedPassword: text("encrypted_password").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ── Exchange Rates Cache ──────────────────────────────────

export const exchangeRates = pgTable("exchange_rates", {
  id: serial("id").primaryKey(),
  baseCurrency: text("base_currency").notNull().default("USD"),
  rates: jsonb("rates").notNull(),                       // { "GBP": 0.79, "EUR": 0.92, ... }
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
})
