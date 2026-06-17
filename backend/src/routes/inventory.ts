import { Router } from "express";
import { db } from "../db/client";
import { inventoryItems, supplies } from "../db/schema";
import { eq, desc, sql, and, ne } from "drizzle-orm";
import { analyzeInventoryAlerts } from "../services/claude";
import { getFbaInventory, updateListingPrice } from "../services/amazon-sp";
import { isConfigured } from "../config";

const router = Router();

// GET /api/inventory — all inventory items
router.get("/", async (req, res) => {
  try {
    const items = await db
      .select()
      .from(inventoryItems)
      .where(ne(inventoryItems.status, "removed"))
      .orderBy(desc(inventoryItems.updatedAt));

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Failed to get inventory" });
  }
});

// GET /api/inventory/stats
router.get("/stats", async (req, res) => {
  try {
    const stats = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`sum(case when status = 'active' then 1 else 0 end)`,
        lowStock: sql<number>`sum(case when status = 'low_stock' then 1 else 0 end)`,
        outOfStock: sql<number>`sum(case when status = 'out_of_stock' then 1 else 0 end)`,
        totalRevenue: sql<number>`sum(total_revenue)`,
        totalProfit: sql<number>`sum(total_profit)`,
        totalFees: sql<number>`sum(total_fees)`,
        totalAtAmazon: sql<number>`sum(quantity_at_amazon)`,
      })
      .from(inventoryItems)
      .where(ne(inventoryItems.status, "removed"));

    res.json(stats[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to get inventory stats" });
  }
});

// POST /api/inventory — add item
router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const [item] = await db
      .insert(inventoryItems)
      .values({
        asin: body.asin,
        title: body.title,
        fnsku: body.fnsku,
        sku: body.sku,
        quantityInStock: body.quantityInStock || 0,
        quantityAtAmazon: body.quantityAtAmazon || 0,
        buyPrice: body.buyPrice,
        currentSellPrice: body.currentSellPrice,
        status: "active",
        datePurchased: body.datePurchased,
        dateListed: body.dateListed,
        notes: body.notes,
      })
      .returning();

    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: "Failed to add inventory item" });
  }
});

// PATCH /api/inventory/:id
router.patch("/:id", async (req, res) => {
  try {
    const body = req.body;
    const [updated] = await db
      .update(inventoryItems)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(inventoryItems.id, parseInt(req.params.id)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Item not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update item" });
  }
});

// DELETE /api/inventory/:id — soft delete
router.delete("/:id", async (req, res) => {
  try {
    await db
      .update(inventoryItems)
      .set({ status: "removed", updatedAt: new Date() })
      .where(eq(inventoryItems.id, parseInt(req.params.id)));

    res.json({ message: "Item removed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove item" });
  }
});

// POST /api/inventory/sync — sync from Amazon FBA
router.post("/sync", async (req, res) => {
  if (!isConfigured.amazon) {
    return res.status(400).json({ error: "Amazon SP-API not configured" });
  }

  try {
    const fbaItems = await getFbaInventory();
    let synced = 0;

    for (const item of fbaItems) {
      const [existing] = await db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.asin, item.asin));

      if (existing) {
        await db.update(inventoryItems).set({
          quantityAtAmazon: item.fulfillableQuantity,
          quantityInbound: item.inboundReceivingQuantity,
          sku: item.sellerSku,
          fnsku: item.fnsku,
          updatedAt: new Date(),
        }).where(eq(inventoryItems.id, existing.id));
      } else {
        await db.insert(inventoryItems).values({
          asin: item.asin,
          fnsku: item.fnsku,
          sku: item.sellerSku,
          quantityAtAmazon: item.fulfillableQuantity,
          quantityInbound: item.inboundReceivingQuantity,
          status: "active",
        });
      }
      synced++;
    }

    res.json({ message: `Synced ${synced} items from Amazon FBA` });
  } catch (err) {
    res.status(500).json({ error: "Sync failed" });
  }
});

// POST /api/inventory/analyze-alerts — AI alert analysis
router.post("/analyze-alerts", async (req, res) => {
  try {
    const items = await db
      .select()
      .from(inventoryItems)
      .where(and(ne(inventoryItems.status, "removed")));

    if (items.length === 0) return res.json([]);

    const now = new Date();
    const alerts = await analyzeInventoryAlerts(
      items.map((item) => {
        const dateListed = item.dateListed ? new Date(item.dateListed) : null;
        const daysInStorage = dateListed
          ? Math.floor((now.getTime() - dateListed.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          asin: item.asin || "",
          title: item.title || "",
          currentPrice: Number(item.currentSellPrice || 0),
          buyBoxPrice: Number(item.buyBoxPrice || 0),
          buyPrice: Number(item.buyPrice || 0),
          quantityAtAmazon: item.quantityAtAmazon || 0,
          daysInStorage,
          lastSaleDate: item.lastSaleDate,
        };
      })
    );

    // Save alerts back to items
    for (const alert of alerts) {
      await db
        .update(inventoryItems)
        .set({ alertFlags: alert })
        .where(eq(inventoryItems.asin, alert.asin));
    }

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: "Alert analysis failed" });
  }
});

// POST /api/inventory/:id/reprice — update listing price
router.post("/:id/reprice", async (req, res) => {
  try {
    const { newPrice } = req.body as { newPrice: number };
    const [item] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, parseInt(req.params.id)));

    if (!item) return res.status(404).json({ error: "Item not found" });
    if (!item.sku) return res.status(400).json({ error: "Item has no SKU" });

    if (isConfigured.amazon) {
      await updateListingPrice(item.sku, newPrice);
    }

    await db
      .update(inventoryItems)
      .set({ currentSellPrice: newPrice.toFixed(2), updatedAt: new Date() })
      .where(eq(inventoryItems.id, item.id));

    res.json({ message: "Price updated", newPrice });
  } catch (err) {
    res.status(500).json({ error: "Repricing failed" });
  }
});

// ─── Supplies ─────────────────────────────────────────────────────────────────

// GET /api/inventory/supplies
router.get("/supplies/list", async (req, res) => {
  try {
    const items = await db.select().from(supplies).orderBy(supplies.category);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Failed to get supplies" });
  }
});

// POST /api/inventory/supplies
router.post("/supplies/list", async (req, res) => {
  try {
    const [item] = await db.insert(supplies).values(req.body).returning();
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: "Failed to add supply" });
  }
});

// PATCH /api/inventory/supplies/:id
router.patch("/supplies/:id", async (req, res) => {
  try {
    const [updated] = await db
      .update(supplies)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(supplies.id, parseInt(req.params.id)))
      .returning();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update supply" });
  }
});

export default router;
