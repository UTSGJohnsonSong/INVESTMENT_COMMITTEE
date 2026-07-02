// Drizzle schema for Neon Postgres.
// The MVP runtime serves analyses from live fetch + in-memory cache; this
// schema is the persistence target for when Neon is linked (drizzle-kit
// push). Table shapes follow the product spec exactly.
import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  doublePrecision,
  integer,
  jsonb,
  date,
} from "drizzle-orm/pg-core";

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  ticker: varchar("ticker", { length: 16 }).notNull().unique(),
  name: text("name").notNull(),
  assetType: varchar("asset_type", { length: 16 }).notNull(), // stock | etf | index | theme
  exchange: varchar("exchange", { length: 32 }),
  currency: varchar("currency", { length: 8 }).default("USD"),
  sector: text("sector"),
  industry: text("industry"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sourceDocuments = pgTable("source_documents", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").references(() => assets.id),
  sourceLevel: varchar("source_level", { length: 4 }).notNull(), // P0..P3
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceType: varchar("source_type", { length: 64 }).notNull(), // sec_filing | fred_series | market_quote | ir_release | news
  title: text("title"),
  author: text("author"),
  publishedAt: timestamp("published_at"),
  retrievedAt: timestamp("retrieved_at").notNull(),
  rawText: text("raw_text"),
  rawJson: jsonb("raw_json"),
  filingAccessionNumber: varchar("filing_accession_number", { length: 32 }),
  filingFormType: varchar("filing_form_type", { length: 16 }),
  periodEndDate: date("period_end_date"),
  checksum: varchar("checksum", { length: 64 }),
});

export const metrics = pgTable("metrics", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").references(() => assets.id),
  metricName: varchar("metric_name", { length: 64 }).notNull(),
  metricValue: doublePrecision("metric_value").notNull(),
  unit: varchar("unit", { length: 16 }),
  period: varchar("period", { length: 32 }),
  sourceDocumentId: integer("source_document_id").references(
    () => sourceDocuments.id
  ),
  asOfDate: date("as_of_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const committeeOpinions = pgTable("committee_opinions", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").references(() => assets.id),
  sessionId: integer("session_id").references(() => decisionSessions.id),
  persona: varchar("persona", { length: 32 }).notNull(),
  stance: varchar("stance", { length: 16 }).notNull(), // bullish | neutral | bearish
  rating: integer("rating").notNull(), // 0-100
  confidence: integer("confidence").notNull(), // 0-100
  summary: text("summary").notNull(),
  argumentsJson: jsonb("arguments_json").notNull(),
  risksJson: jsonb("risks_json").notNull(),
  citationsJson: jsonb("citations_json").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const decisionSessions = pgTable("decision_sessions", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").references(() => assets.id),
  userId: varchar("user_id", { length: 64 }),
  overallRating: varchar("overall_rating", { length: 16 }).notNull(),
  confidence: integer("confidence").notNull(),
  suggestedAllocationConservative: doublePrecision(
    "suggested_allocation_conservative"
  ),
  suggestedAllocationBalanced: doublePrecision("suggested_allocation_balanced"),
  suggestedAllocationAggressive: doublePrecision(
    "suggested_allocation_aggressive"
  ),
  timeHorizon: varchar("time_horizon", { length: 32 }),
  memo: text("memo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const portfolioPositions = pgTable("portfolio_positions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  ticker: varchar("ticker", { length: 16 }).notNull(),
  weight: doublePrecision("weight").notNull(),
  quantity: doublePrecision("quantity"),
  costBasis: doublePrecision("cost_basis"),
  accountType: varchar("account_type", { length: 16 }), // TFSA | taxable | RRSP | general
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").references(() => assets.id),
  alertType: varchar("alert_type", { length: 32 }).notNull(),
  message: text("message").notNull(),
  severity: varchar("severity", { length: 16 }).notNull(), // info | warning | critical
  triggerCondition: text("trigger_condition"),
  sourceDocumentId: integer("source_document_id").references(
    () => sourceDocuments.id
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});
