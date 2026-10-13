import { Router } from "express";
import { db } from "../db/client";
import { reports, reportProducts, inventoryItems, transactions, agentRuns } from "../db/schema";
import { desc, eq, gte, sql, and } from "drizzle-orm";
import { getSalesStats } from "../services/amazon-sp";
import { getAgentStatus } from "../services/agent";
import { getSchedulerStatus } from "../services/scheduler";
import { config, isConfigured } from "../config";

const router = Router();

// GET /api/dashboard
router.get("/", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split("T")[0];

    // ── Today's sales (real from Amazon, else zeros) ──
    const sales = {
      today: { revenue: 0, orders: 0, units: 0 },
      hourly: [] as Array<{ time: string; revenue: number }>,
    };
    if (isConfigured.amazon) {
      const now = new Date();
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const stats = await getSalesStats(dayStart, now).catch(() => null);
      if (stats) {
        sales.today.revenue = stats.orderedProductSales;
        sales.today.units = stats.orderedUnits;
        sales.today.orders = stats.orderedUnits; // approximation until order breakdown
      }
    }

    // Demo: derive "today" from the fictional order transactions (no Amazon connection exists)
    if (config.demo) {
      const [t] = await db
        .select({ revenue: sql<number>`coalesce(sum(amount), 0)`, orders: sql<number>`count(*)` })
        .from(transactions)
        .where(and(eq(transactions.date, today), eq(transactions.type, "income")));
      sales.today.revenue = Number(t?.revenue || 0);
      sales.today.orders = Number(t?.orders || 0);
      sales.today.units = sales.today.orders;
      const shape = [0.05, 0.1, 0.18, 0.12, 0.2, 0.15, 0.12, 0.08];
      sales.hourly = shape.map((f, i) => ({ time: `${8 + i * 2}:00`, revenue: Math.round(sales.today.revenue * f * 100) / 100 }));
    }

    // ── Today's report ──
    const [todayReport] = await db.select().from(reports).where(eq(reports.date, today)).limit(1);
    const recentReports = await db.select().from(reports).orderBy(desc(reports.date)).limit(7);

    // ── Inventory ──
    const inv = await db
      .select({
        count: sql<number>`count(*)`,
        totalValue: sql<number>`coalesce(sum(buy_price * (quantity_at_amazon + quantity_in_stock)), 0)`,
        lowStock: sql<number>`coalesce(sum(case when status = 'low_stock' then 1 else 0 end), 0)`,
        atAmazon: sql<number>`coalesce(sum(quantity_at_amazon), 0)`,
        withBuyBox: sql<number>`coalesce(sum(case when status = 'active' and buy_box_price is not null and current_sell_price is not null and current_sell_price <= buy_box_price then 1 else 0 end), 0)`,
        totalListings: sql<number>`coalesce(sum(case when status = 'active' then 1 else 0 end), 0)`,
      })
      .from(inventoryItems)
      .where(sql`status != 'removed'`);

    const totalListings = Number(inv[0]?.totalListings || 0);
    const withBuyBox = Number(inv[0]?.withBuyBox || 0);

    // ── Monthly accounting breakdown ──
    const acct = await db
      .select({
        revenue: sql<number>`coalesce(sum(case when type = 'income' then amount else 0 end), 0)`,
        cogs: sql<number>`coalesce(sum(case when category = 'product_purchase' then amount else 0 end), 0)`,
        amazonFees: sql<number>`coalesce(sum(case when type = 'fee' or category = 'amazon_fee' then amount else 0 end), 0)`,
        shipping: sql<number>`coalesce(sum(case when category = 'shipping' then amount else 0 end), 0)`,
        otherExpenses: sql<number>`coalesce(sum(case when type = 'expense' and category not in ('product_purchase','shipping','amazon_fee') then amount else 0 end), 0)`,
      })
      .from(transactions)
      .where(gte(transactions.date, monthStartStr));

    const revenue = Number(acct[0]?.revenue || 0);
    const cogs = Number(acct[0]?.cogs || 0);
    const amazonFees = Number(acct[0]?.amazonFees || 0);
    const shipping = Number(acct[0]?.shipping || 0);
    const otherExpenses = Number(acct[0]?.otherExpenses || 0);
    const netProfit = revenue - cogs - amazonFees - shipping - otherExpenses;

    // Profit today (best-effort: today's income minus today's costs)
    const todayAcct = await db
      .select({
        income: sql<number>`coalesce(sum(case when type = 'income' then amount else 0 end), 0)`,
        costs: sql<number>`coalesce(sum(case when type in ('expense','fee') then amount else 0 end), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.date, today));
    const profitToday = Number(todayAcct[0]?.income || 0) - Number(todayAcct[0]?.costs || 0);

    // ── Recent agent runs → activity feed ──
    const recentRuns = await db.select().from(agentRuns).orderBy(desc(agentRuns.createdAt)).limit(6);
    const activity = recentRuns.map((run) => ({
      time: run.createdAt ? new Date(run.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "",
      event:
        run.status === "completed"
          ? `Research cycle complete — ${run.productsFound || 0} products found`
          : run.status === "failed"
          ? `Research cycle failed${run.error ? `: ${run.error.slice(0, 60)}` : ""}`
          : "Research cycle running...",
      type: run.status === "completed" ? "success" : run.status === "failed" ? "warning" : "info",
    }));

    // ── AI-generated TODOs ──
    const pendingProducts = todayReport
      ? await db
          .select()
          .from(reportProducts)
          .where(and(eq(reportProducts.reportId, todayReport.id), eq(reportProducts.status, "pending")))
          .limit(4)
      : [];

    const todos = [
      ...(todayReport?.totalProductsFound
        ? [{ id: 1, priority: "high", task: `Review ${todayReport.totalProductsFound} new products in today's report`, done: false }]
        : []),
      ...pendingProducts.slice(0, 3).map((p, i) => ({
        id: 10 + i,
        priority: "medium",
        task: `Consider buying: ${(p.title || p.asin)?.slice(0, 50)} — ${p.estimatedRoi}% ROI`,
        done: false,
      })),
      ...(Number(inv[0]?.lowStock || 0) > 0
        ? [{ id: 20, priority: "high", task: `${inv[0].lowStock} item(s) low on stock — review reorder`, done: false }]
        : []),
    ];

    // AI agent one-liner for the greeting
    const lastRun = recentRuns[0] || null;
    let agentUpdate = "Agent has not run yet — trigger a scan or wait for the scheduled run.";
    if (lastRun?.status === "completed") {
      agentUpdate = `Agent last ran and found ${lastRun.productsFound || 0} opportunities.`;
    } else if (lastRun?.status === "running") {
      agentUpdate = "Agent is running a research cycle right now.";
    }

    res.json({
      sales,
      report: todayReport || null,
      recentReports,
      inventory: {
        activeProducts: totalListings,
        totalValue: Number(inv[0]?.totalValue || 0),
        lowStockAlerts: Number(inv[0]?.lowStock || 0),
        totalAtAmazon: Number(inv[0]?.atAmazon || 0),
        buyBoxPct: totalListings > 0 ? (withBuyBox / totalListings) * 100 : null,
      },
      accounting: {
        monthlyRevenue: revenue,
        cogs,
        amazonFees,
        shipping,
        otherExpenses,
        monthlyProfit: netProfit,
        profitMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
        profitToday,
      },
      agent: {
        ...getAgentStatus(),
        scheduler: getSchedulerStatus(),
        lastRun,
        activity,
        update: agentUpdate,
      },
      todos,
      integrations: isConfigured,
    });
  } catch (err) {
    console.error("[Dashboard]", err);
    res.status(500).json({ error: "Failed to load dashboard data" });
  }
});

export default router;
