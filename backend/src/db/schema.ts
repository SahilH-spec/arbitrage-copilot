import {
  pgTable,
  serial,
  varchar,
  text,
  decimal,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const productStatusEnum = pgEnum("product_status", [
  "researched",
  "approved",
  "rejected",
  "purchased",
  "listed",
  "sold",
  "removed",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "generating",
  "completed",
  "reviewed",
]);

export const inventoryStatusEnum = pgEnum("inventory_status", [
  "active",
  "low_stock",
  "out_of_stock",
  "stranded",
  "removed",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "income",
  "expense",
  "refund",
  "fee",
  "adjustment",
]);

export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "running",
  "completed",
  "failed",
  "cancelled",
]);

// ─── Agent Settings ─────────────────────────────────────────────────────────
export const agentSettings = pgTable("agent_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).unique().notNull(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Agent Runs ──────────────────────────────────────────────────────────────
export const agentRuns = pgTable("agent_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  status: agentRunStatusEnum("status").default("running"),
  productsFound: integer("products_found").default(0),
  reportId: integer("report_id"),
  logs: text("logs").array(),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  date: date("date").unique().notNull(),
  status: reportStatusEnum("status").default("pending"),
  summary: text("summary"),
  totalProductsFound: integer("total_products_found").default(0),
  approvedCount: integer("approved_count").default(0),
  rejectedCount: integer("rejected_count").default(0),
  agentRunId: integer("agent_run_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Report Products ─────────────────────────────────────────────────────────
export const reportProducts = pgTable("report_products", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").notNull(),
  asin: varchar("asin", { length: 20 }).notNull(),
  title: varchar("title", { length: 500 }),
  brand: varchar("brand", { length: 200 }),
  category: varchar("category", { length: 200 }),
  imageUrl: text("image_url"),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }),
  suggestedBuyPrice: decimal("suggested_buy_price", { precision: 10, scale: 2 }),
  suggestedSellPrice: decimal("suggested_sell_price", { precision: 10, scale: 2 }),
  estimatedProfit: decimal("estimated_profit", { precision: 10, scale: 2 }),
  estimatedRoi: decimal("estimated_roi", { precision: 6, scale: 2 }),
  buyBoxPrice: decimal("buy_box_price", { precision: 10, scale: 2 }),
  bsrRank: integer("bsr_rank"),
  bsrCategory: varchar("bsr_category", { length: 200 }),
  monthlySalesEst: integer("monthly_sales_est"),
  competitionLevel: varchar("competition_level", { length: 50 }),
  sourceStore: varchar("source_store", { length: 200 }),
  sourceUrl: text("source_url"),
  sourcePrice: decimal("source_price", { precision: 10, scale: 2 }),
  criteriaScore: integer("criteria_score"),
  criteriaDetails: jsonb("criteria_details"),
  aiAnalysis: text("ai_analysis"),
  supplierRecommendations: jsonb("supplier_recommendations"),
  coupons: jsonb("coupons"),
  discountNotes: text("discount_notes"),
  status: varchar("status", { length: 50 }).default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Suppliers ───────────────────────────────────────────────────────────────
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  type: varchar("type", { length: 50 }), // retail | online | wholesale | distributor
  category: varchar("category", { length: 200 }),
  website: text("website"),
  region: varchar("region", { length: 100 }),
  couponsAvailable: boolean("coupons_available").default(false),
  avgDiscount: varchar("avg_discount", { length: 50 }),
  rating: integer("rating"), // 1-5
  tags: text("tags").array(),
  notes: text("notes"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Inventory Items ──────────────────────────────────────────────────────────
export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  asin: varchar("asin", { length: 20 }),
  title: varchar("title", { length: 500 }),
  fnsku: varchar("fnsku", { length: 50 }),
  sku: varchar("sku", { length: 100 }),
  quantityInStock: integer("quantity_in_stock").default(0),
  quantityAtAmazon: integer("quantity_at_amazon").default(0),
  quantityInbound: integer("quantity_inbound").default(0),
  buyPrice: decimal("buy_price", { precision: 10, scale: 2 }),
  currentSellPrice: decimal("current_sell_price", { precision: 10, scale: 2 }),
  buyBoxPrice: decimal("buy_box_price", { precision: 10, scale: 2 }),
  status: inventoryStatusEnum("status").default("active"),
  datePurchased: date("date_purchased"),
  dateListed: date("date_listed"),
  lastSaleDate: date("last_sale_date"),
  totalSold: integer("total_sold").default(0),
  totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default("0"),
  totalFees: decimal("total_fees", { precision: 10, scale: 2 }).default("0"),
  totalProfit: decimal("total_profit", { precision: 10, scale: 2 }).default("0"),
  alertFlags: jsonb("alert_flags"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Supplies ────────────────────────────────────────────────────────────────
export const supplies = pgTable("supplies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  category: varchar("category", { length: 100 }),
  quantityOnHand: integer("quantity_on_hand").default(0),
  reorderPoint: integer("reorder_point").default(10),
  unitCost: decimal("unit_cost", { precision: 8, scale: 2 }),
  supplier: varchar("supplier", { length: 200 }),
  supplierUrl: text("supplier_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Transactions ─────────────────────────────────────────────────────────────
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  type: transactionTypeEnum("type").notNull(),
  category: varchar("category", { length: 100 }),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  asin: varchar("asin", { length: 20 }),
  orderId: varchar("order_id", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Chat Messages ───────────────────────────────────────────────────────────
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 100 }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const reportsRelations = relations(reports, ({ many }) => ({
  products: many(reportProducts),
}));

export const reportProductsRelations = relations(reportProducts, ({ one }) => ({
  report: one(reports, {
    fields: [reportProducts.reportId],
    references: [reports.id],
  }),
}));

// Types
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type ReportProduct = typeof reportProducts.$inferSelect;
export type NewReportProduct = typeof reportProducts.$inferInsert;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;
export type Supply = typeof supplies.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type AgentRun = typeof agentRuns.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
