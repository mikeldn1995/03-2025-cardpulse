import { pgTable, serial, text, integer, real, timestamp, boolean, jsonb } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  currency: text("currency").notNull().default("GBP"),
  theme: text("theme").notNull().default("system"),
  utilThreshold: integer("util_threshold").notNull().default(75),
  forecastMonthly: real("forecast_monthly").notNull().default(200),
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

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  issuer: text("issuer").notNull(),
  last4: text("last4").notNull().default("0000"),
  fullNumber: text("full_number").notNull().default(""),
  openingBalance: real("opening_balance").notNull().default(0),
  openingMonth: text("opening_month").notNull().default("2025-02"),
  creditLimit: real("credit_limit").notNull().default(0),
  aprRegular: real("apr_regular").notNull().default(0),
  aprPromo: real("apr_promo"),
  promoUntil: text("promo_until"),
  dd: text("dd").notNull().default("none"),
  ddAmount: real("dd_amount").notNull().default(0),
  address: text("address").notNull().default(""),
  paymentDay: integer("payment_day").notNull().default(5),
  statementDay: integer("statement_day").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const statements = pgTable("statements", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => cards.id),
  month: text("month").notNull(),
  spent: real("spent").notNull().default(0),
  paid: real("paid").notNull().default(0),
  interest: real("interest").notNull().default(0),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const truelayerConnections = pgTable("truelayer_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
})

export const addresses = pgTable("addresses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  address: text("address").notNull(),
})
