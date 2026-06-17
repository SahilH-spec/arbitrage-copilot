import { Router } from "express";
import { db } from "../db/client";
import { agentSettings, agentRuns } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { runAgentCycle, getAgentStatus, getAgentConfig } from "../services/agent";
import { runManagedAgentSession, getManagedAgentStatus, RESEARCH_KICKOFF, MONITOR_KICKOFF } from "../services/managed-agent";
import { updateSchedule, getSchedulerStatus } from "../services/scheduler";
import { isConfigured } from "../config";

const router = Router();

// GET /api/agent/status
router.get("/status", async (req, res) => {
  try {
    const managed = getManagedAgentStatus();
    const inApp = getAgentStatus();
    const scheduler = getSchedulerStatus();
    const agentConfig = await getAgentConfig();
    res.json({
      isRunning: managed.isRunning || inApp.isRunning,
      currentRunId: inApp.currentRunId,
      mode: isConfigured.managedAgent ? "managed" : "in-app",
      managed,
      scheduler,
      config: agentConfig,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get agent status" });
  }
});

// POST /api/agent/run — trigger manual run (managed agent if configured, else in-app)
router.post("/run", async (req, res) => {
  try {
    const mode = (req.body?.mode as string) || "research";
    if (getManagedAgentStatus().isRunning || getAgentStatus().isRunning) {
      return res.status(409).json({ error: "Agent is already running" });
    }

    if (isConfigured.managedAgent) {
      const kickoff = mode === "monitor" ? MONITOR_KICKOFF : RESEARCH_KICKOFF;
      runManagedAgentSession(kickoff).catch((err) => console.error("[ManagedAgent] run failed:", err));
      res.json({ message: "Managed agent session started", status: "running", mode: "managed" });
    } else {
      runAgentCycle(true).catch((err) => console.error("[Agent] run failed:", err));
      res.json({ message: "Agent cycle started", status: "running", mode: "in-app" });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to start agent" });
  }
});

// GET /api/agent/settings
router.get("/settings", async (req, res) => {
  try {
    const settings = await db.select().from(agentSettings);
    const map: Record<string, unknown> = {};
    settings.forEach((s) => { map[s.key] = s.value; });
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: "Failed to get settings" });
  }
});

// PUT /api/agent/settings
router.put("/settings", async (req, res) => {
  try {
    const updates = req.body as Record<string, unknown>;

    for (const [key, value] of Object.entries(updates)) {
      await db
        .insert(agentSettings)
        .values({ key, value: value as never })
        .onConflictDoUpdate({
          target: agentSettings.key,
          set: { value: value as never, updatedAt: new Date() },
        });
    }

    // Update scheduler if schedule changed
    if (updates.schedule) {
      const scheduleStr = updates.schedule as string;
      const valid = await updateSchedule(scheduleStr);
      if (!valid) {
        return res.status(400).json({ error: "Invalid cron schedule expression" });
      }
    }

    res.json({ message: "Settings updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// GET /api/agent/runs — run history
router.get("/runs", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string || "20");
    const runs = await db
      .select()
      .from(agentRuns)
      .orderBy(desc(agentRuns.createdAt))
      .limit(limit);

    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: "Failed to get run history" });
  }
});

// GET /api/agent/runs/:id/logs — live logs for a run
router.get("/runs/:id/logs", async (req, res) => {
  try {
    const [run] = await db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.id, parseInt(req.params.id)));

    if (!run) return res.status(404).json({ error: "Run not found" });

    res.json({
      status: run.status,
      logs: run.logs || [],
      productsFound: run.productsFound,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get run logs" });
  }
});

export default router;
