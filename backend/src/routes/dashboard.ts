import { Router } from "express";
import { db } from "../db/client";
import { reports, reportProducts, inventoryItems, transactions, agentRuns } from "../db/schema";
import { desc, eq, gte, sql, and } from "drizzle-orm";
import { getMockSalesData, getSalesStats } from "../services/amazon-sp";
import { getAgentStatus } from "../services/agent";
import { getSchedulerStatus } from "../services/scheduler";
import { isConfigured } from "../config";

const router = Router();

// GET /api/dashboard — main dashboard data
router.get("/", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Sales data (Amazon or mock)
    let salesData = getMockSalesData();
    if (isConfigured.amazon) {
      const now = new Date();
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const stats = await getSalesStats(dayStart, now).catch(() => null);
      if (stats) {
        salesData.today.revenue = stats.orderedProductSales;
        salesData.today.units = stats.orderedUnits;
      }
    }

    // Today's report
    const [todayReport] = await db
      .select()
      .from(reports)
      .where(eq(reports.date, today))
      .limit(1);

    // Recent reports (last 7)
    const recentReports = await db
      .select()
      .from(reports)
      .orderBy(desc(reports.date))
      .limit(7);

    // Active inventory count + value
    const inventoryStats = await db
      .select({
        count: sql<number>`count(*)`,
        totalValue: sql<number>`sum(buy_price * (quantity_at_amazon + quantity_in_stock))`,
        lowStock: sql<number>`sum(case when status = 'low_stock' then 1 else 0 end)`,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.status, "active"));

    // Monthly P&L
    const monthlyPL = await db
      .select({
        income: sql<number>`sum(case when type = 'income' then amount else 0 end)`,
        expenses: sql<number>`sum(case when type in ('expense','fee') then amount else 0 end)`,
      })
      .from(transactions)
      .where(gte(transactions.date, thirtyDaysAgo.toISOString().split("T")[0]));

    // Recent agent runs
    const recentRuns = await db
      .select()
      .from(agentRuns)
      .orderBy(desc(agentRuns.createdAt))
      .limit(5);

    // AI-generated TODOs from today's report products
    const pendingProducts = await db
      .select()
      .from(reportProducts)
      .where(and(eq(reportProducts.reportId, todayReport?.id || 0), eq(reportProducts.status, "pending")))
      .limit(5);

    const todos = [
      ...(todayReport?.totalProductsFound
        ? [{ id: 1, type: "report", text: `Review ${todayReport.totalProductsFound} new products in today's report`, priority: "high" }]
        : []),
      ...pendingProducts.slice(0, 3).map((p, i) => ({
        id: 10 + i,
        type: "purchase",
        text: `Consider buying: ${p.title?.slice(0, 50) || p.asin} — ${p.estimatedRoi}% ROI`,
        priority: "medium",
      })),
    ];

    const income = Number(monthlyPL[0]?.income || 0);
    const expenses = Number(monthlyPL[0]?.expenses || 0);

    res.json({
      sales: salesData,
      report: todayReport || null,
      recentReports,
      inventory: {
        activeProducts: Number(inventoryStats[0]?.count || 0),
        totalValue: Number(inventoryStats[0]?.totalValue || 0),
        lowStockAlerts: Number(inventoryStats[0]?.lowStock || 0),
      },
      accounting: {
        monthlyRevenue: income,
        monthlyExpenses: expenses,
        monthlyProfit: income - expenses,
        profitMargin: income > 0 ? ((income - expenses) / income) * 100 : 0,
      },
      agent: {
        ...getAgentStatus(),
        scheduler: getSchedulerStatus(),
        lastRun: recentRuns[0] || null,
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
