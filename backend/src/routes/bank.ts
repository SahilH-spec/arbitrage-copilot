import { Router } from "express";
import { isConfigured } from "../config";
import {
  createLinkToken, exchangePublicToken, getAccounts,
  syncTransactions, isBankConnected, disconnectBank,
} from "../services/plaid";

const router = Router();

// GET /api/bank/status
router.get("/status", async (req, res) => {
  try {
    res.json({
      configured: isConfigured.plaid,
      connected: isConfigured.plaid ? await isBankConnected() : false,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get bank status" });
  }
});

// POST /api/bank/link-token — start Plaid Link
router.post("/link-token", async (req, res) => {
  if (!isConfigured.plaid) {
    return res.status(400).json({ error: "Plaid not configured. Add PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV to Railway." });
  }
  try {
    const linkToken = await createLinkToken();
    res.json({ linkToken });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to create link token" });
  }
});

// POST /api/bank/exchange — exchange public token after Link success
router.post("/exchange", async (req, res) => {
  try {
    const { publicToken } = req.body as { publicToken: string };
    if (!publicToken) return res.status(400).json({ error: "publicToken required" });
    await exchangePublicToken(publicToken);
    res.json({ message: "Bank connected" });
  } catch (err) {
    res.status(500).json({ error: "Failed to connect bank" });
  }
});

// GET /api/bank/accounts
router.get("/accounts", async (req, res) => {
  try {
    res.json({ accounts: await getAccounts() });
  } catch (err) {
    res.status(500).json({ error: "Failed to get accounts" });
  }
});

// POST /api/bank/sync — pull transactions into the accounting ledger
router.post("/sync", async (req, res) => {
  try {
    const result = await syncTransactions();
    res.json({ message: `Synced ${result.added} transactions`, ...result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Sync failed" });
  }
});

// POST /api/bank/disconnect
router.post("/disconnect", async (req, res) => {
  try {
    await disconnectBank();
    res.json({ message: "Bank disconnected" });
  } catch (err) {
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

export default router;
