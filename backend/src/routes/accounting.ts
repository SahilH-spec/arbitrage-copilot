import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { db } from "../db/client";
import { transactions } from "../db/schema";
import { desc, gte, lte, and, sql, eq } from "drizzle-orm";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/accounting/transactions
router.get("/transactions", async (req, res) => {
  try {
    const { startDate, endDate, type, category, limit } = req.query as Record<string, string>;
    const conditions: ReturnType<typeof eq>[] = [];

    if (startDate) conditions.push(gte(transactions.date, startDate));
    if (endDate) conditions.push(lte(transactions.date, endDate));
    if (type) conditions.push(eq(transactions.type, type as "income" | "expense" | "refund" | "fee" | "adjustment"));
    if (category) conditions.push(eq(transactions.category, category));

    const items = await db
      .select()
      .from(transactions)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(transactions.date))
      .limit(parseInt(limit || "100"));

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Failed to get transactions" });
  }
});

// GET /api/accounting/summary
router.get("/summary", async (req, res) => {
  try {
    const { period } = req.query as { period?: string };
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "week":
        startDate = new Date(now); startDate.setDate(now.getDate() - 7); break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1); break;
      default: // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
    }

    const summary = await db
      .select({
        income: sql<number>`sum(case when type = 'income' then amount else 0 end)`,
        expenses: sql<number>`sum(case when type = 'expense' then amount else 0 end)`,
        fees: sql<number>`sum(case when type = 'fee' then amount else 0 end)`,
        refunds: sql<number>`sum(case when type = 'refund' then amount else 0 end)`,
      })
      .from(transactions)
      .where(gte(transactions.date, startDate.toISOString().split("T")[0]));

    const income = Number(summary[0]?.income || 0);
    const expenses = Number(summary[0]?.expenses || 0);
    const fees = Number(summary[0]?.fees || 0);
    const refunds = Number(summary[0]?.refunds || 0);
    const totalCosts = expenses + fees;
    const netProfit = income - totalCosts + refunds;

    // Monthly breakdown (last 6 months)
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      const monthSummary = await db
        .select({
          income: sql<number>`sum(case when type = 'income' then amount else 0 end)`,
          costs: sql<number>`sum(case when type in ('expense','fee') then amount else 0 end)`,
        })
        .from(transactions)
        .where(and(
          gte(transactions.date, monthStart.toISOString().split("T")[0]),
          lte(transactions.date, monthEnd.toISOString().split("T")[0])
        ));

      monthlyData.push({
        month: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        revenue: Number(monthSummary[0]?.income || 0),
        expenses: Number(monthSummary[0]?.costs || 0),
        profit: Number(monthSummary[0]?.income || 0) - Number(monthSummary[0]?.costs || 0),
      });
    }

    // Category breakdown
    const categories = await db
      .select({
        category: transactions.category,
        total: sql<number>`sum(amount)`,
        count: sql<number>`count(*)`,
      })
      .from(transactions)
      .where(gte(transactions.date, startDate.toISOString().split("T")[0]))
      .groupBy(transactions.category);

    res.json({
      income,
      expenses,
      fees,
      refunds,
      totalCosts,
      netProfit,
      profitMargin: income > 0 ? (netProfit / income) * 100 : 0,
      monthlyData,
      categories,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get accounting summary" });
  }
});

// POST /api/accounting/transactions — add transaction
router.post("/transactions", async (req, res) => {
  try {
    const [item] = await db.insert(transactions).values(req.body).returning();
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: "Failed to add transaction" });
  }
});

// PATCH /api/accounting/transactions/:id
router.patch("/transactions/:id", async (req, res) => {
  try {
    const [updated] = await db
      .update(transactions)
      .set(req.body)
      .where(eq(transactions.id, parseInt(req.params.id)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Transaction not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update transaction" });
  }
});

// DELETE /api/accounting/transactions/:id
router.delete("/transactions/:id", async (req, res) => {
  try {
    await db.delete(transactions).where(eq(transactions.id, parseInt(req.params.id)));
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

// POST /api/accounting/import-csv — CSV import
router.post("/import-csv", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const csvContent = req.file.buffer.toString("utf-8");
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, string>>;

    const inserted: number[] = [];

    for (const record of records) {
      const amount = parseFloat(record.amount || record.Amount || "0");
      const date = record.date || record.Date || new Date().toISOString().split("T")[0];
      const type = (record.type || record.Type || "expense") as "income" | "expense" | "fee" | "refund" | "adjustment";
      const category = record.category || record.Category || "other";
      const description = record.description || record.Description || record.memo || "";

      const [tx] = await db
        .insert(transactions)
        .values({ date, type, category, description, amount: amount.toFixed(2) })
        .returning();
      inserted.push(tx.id);
    }

    res.json({ message: `Imported ${inserted.length} transactions`, ids: inserted });
  } catch (err) {
    res.status(500).json({ error: "CSV import failed" });
  }
});

export default router;
