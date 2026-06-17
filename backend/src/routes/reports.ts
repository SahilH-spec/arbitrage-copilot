import { Router } from "express";
import { db } from "../db/client";
import { reports, reportProducts } from "../db/schema";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

// GET /api/reports — list all reports
router.get("/", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string || "30");
    const allReports = await db
      .select()
      .from(reports)
      .orderBy(desc(reports.date))
      .limit(limit);

    res.json(allReports);
  } catch (err) {
    res.status(500).json({ error: "Failed to get reports" });
  }
});

// GET /api/reports/latest — most recent report
router.get("/latest", async (req, res) => {
  try {
    const [report] = await db
      .select()
      .from(reports)
      .orderBy(desc(reports.date))
      .limit(1);

    if (!report) return res.json(null);

    const products = await db
      .select()
      .from(reportProducts)
      .where(eq(reportProducts.reportId, report.id))
      .orderBy(desc(reportProducts.criteriaScore));

    res.json({ ...report, products });
  } catch (err) {
    res.status(500).json({ error: "Failed to get latest report" });
  }
});

// GET /api/reports/:id
router.get("/:id", async (req, res) => {
  try {
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, parseInt(req.params.id)));

    if (!report) return res.status(404).json({ error: "Report not found" });

    const products = await db
      .select()
      .from(reportProducts)
      .where(eq(reportProducts.reportId, report.id))
      .orderBy(desc(reportProducts.criteriaScore));

    res.json({ ...report, products });
  } catch (err) {
    res.status(500).json({ error: "Failed to get report" });
  }
});

// PATCH /api/reports/:id/products/:productId — approve/reject a product
router.patch("/:id/products/:productId", async (req, res) => {
  try {
    const { status, notes } = req.body as { status: string; notes?: string };
    const productId = parseInt(req.params.productId);

    const [updated] = await db
      .update(reportProducts)
      .set({ status, notes, })
      .where(eq(reportProducts.id, productId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Product not found" });

    // Update report counters
    const reportId = parseInt(req.params.id);
    const allProducts = await db
      .select()
      .from(reportProducts)
      .where(eq(reportProducts.reportId, reportId));

    const approvedCount = allProducts.filter((p) => p.status === "approved").length;
    const rejectedCount = allProducts.filter((p) => p.status === "rejected").length;

    await db.update(reports).set({ approvedCount, rejectedCount }).where(eq(reports.id, reportId));

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update product" });
  }
});

// POST /api/reports/:id/review — mark report as reviewed
router.post("/:id/review", async (req, res) => {
  try {
    const [updated] = await db
      .update(reports)
      .set({ status: "reviewed", updatedAt: new Date() })
      .where(eq(reports.id, parseInt(req.params.id)))
      .returning();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to mark report reviewed" });
  }
});

export default router;
