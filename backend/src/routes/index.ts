import { Router } from "express";
import dashboardRouter from "./dashboard";
import agentRouter from "./agent";
import reportsRouter from "./reports";
import inventoryRouter from "./inventory";
import accountingRouter from "./accounting";
import chatRouter from "./chat";
import suppliersRouter from "./suppliers";
import bankRouter from "./bank";
import authRouter from "./auth";
import { gate } from "../middleware/auth";

const router = Router();

// Public: liveness only (Railway healthcheck). Reveals nothing about configuration.
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.use("/auth", authRouter);

// Everything below requires a login session (or, in DEMO_MODE, is read-only).
router.use(gate);

router.use("/dashboard", dashboardRouter);
router.use("/agent", agentRouter);
router.use("/reports", reportsRouter);
router.use("/inventory", inventoryRouter);
router.use("/accounting", accountingRouter);
router.use("/chat", chatRouter);
router.use("/suppliers", suppliersRouter);
router.use("/bank", bankRouter);

export default router;
