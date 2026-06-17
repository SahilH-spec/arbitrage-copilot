import { Router } from "express";
import { db } from "../db/client";
import { suppliers } from "../db/schema";
import { eq, desc, ne } from "drizzle-orm";

const router = Router();

// GET /api/suppliers
router.get("/", async (req, res) => {
  try {
    const items = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.active, true))
      .orderBy(desc(suppliers.rating), suppliers.name);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Failed to get suppliers" });
  }
});

// POST /api/suppliers
router.post("/", async (req, res) => {
  try {
    const [item] = await db.insert(suppliers).values(req.body).returning();
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: "Failed to add supplier" });
  }
});

// PATCH /api/suppliers/:id
router.patch("/:id", async (req, res) => {
  try {
    const [updated] = await db
      .update(suppliers)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(suppliers.id, parseInt(req.params.id)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Supplier not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update supplier" });
  }
});

// DELETE /api/suppliers/:id (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    await db
      .update(suppliers)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(suppliers.id, parseInt(req.params.id)));
    res.json({ message: "Supplier removed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove supplier" });
  }
});

export default router;
