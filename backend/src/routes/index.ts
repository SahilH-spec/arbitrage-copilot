import { Router } from "express";
import dashboardRouter from "./dashboard";
import agentRouter from "./agent";
import reportsRouter from "./reports";
import inventoryRouter from "./inventory";
import accountingRouter from "./accounting";
import chatRouter from "./chat";
import suppliersRouter from "./suppliers";
import bankRouter from "./bank";
import { isConfigured } from "../config";

const router = Router();

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    integrations: isConfigured,
  });
});

router.use("/dashboard", dashboardRouter);
router.use("/agent", agentRouter);
router.use("/reports", reportsRouter);
router.use("/inventory", inventoryRouter);
router.use("/accounting", accountingRouter);
router.use("/chat", chatRouter);
router.use("/suppliers", suppliersRouter);
router.use("/bank", bankRouter);

export default router;
