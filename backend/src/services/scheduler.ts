import cron from "node-cron";
import { runAgentCycle } from "./agent";
import { runManagedAgentSession, RESEARCH_KICKOFF } from "./managed-agent";
import { db } from "../db/client";
import { agentSettings } from "../db/schema";
import { eq } from "drizzle-orm";
import { isConfigured } from "../config";

let scheduledTask: cron.ScheduledTask | null = null;
let currentSchedule = "0 4 * * *"; // Default: 4 AM daily

export async function initScheduler() {
  const schedule = await getScheduleFromDb();
  startScheduler(schedule);
  console.log(`[Scheduler] Initialized — running at: ${schedule}`);
}

async function getScheduleFromDb(): Promise<string> {
  const [setting] = await db
    .select()
    .from(agentSettings)
    .where(eq(agentSettings.key, "schedule"));

  return (setting?.value as string) || "0 4 * * *";
}

export function startScheduler(schedule: string) {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }

  if (!cron.validate(schedule)) {
    console.error(`[Scheduler] Invalid cron expression: ${schedule}`);
    return;
  }

  currentSchedule = schedule;
  scheduledTask = cron.schedule(schedule, async () => {
    console.log("[Scheduler] Triggered agent cycle");
    try {
      if (isConfigured.managedAgent) {
        await runManagedAgentSession(RESEARCH_KICKOFF);
      } else {
        await runAgentCycle(false);
      }
    } catch (err) {
      console.error("[Scheduler] Agent cycle failed:", err);
    }
  });

  console.log(`[Scheduler] Started with schedule: ${schedule}`);
}

export async function updateSchedule(newSchedule: string): Promise<boolean> {
  if (!cron.validate(newSchedule)) return false;

  await db
    .insert(agentSettings)
    .values({ key: "schedule", value: newSchedule })
    .onConflictDoUpdate({ target: agentSettings.key, set: { value: newSchedule } });

  startScheduler(newSchedule);
  return true;
}

export function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[Scheduler] Stopped");
  }
}

export function getSchedulerStatus() {
  return {
    running: !!scheduledTask,
    schedule: currentSchedule,
    nextRun: scheduledTask ? getNextRunTime(currentSchedule) : null,
  };
}

function getNextRunTime(cronExpression: string): string | null {
  try {
    const now = new Date();
    const [min, hour, dom, mon, dow] = cronExpression.split(" ");
    // Simplified next run time calculation
    const next = new Date(now);
    next.setSeconds(0);
    next.setMilliseconds(0);
    next.setMinutes(min === "*" ? now.getMinutes() + 1 : parseInt(min));
    next.setHours(hour === "*" ? now.getHours() : parseInt(hour));
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toISOString();
  } catch {
    return null;
  }
}
