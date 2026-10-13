// npm run seed:demo --workspace=backend   (needs DEMO_MODE=true; same safety checks as server start)
import { config } from "../config";
import { pool } from "./client";
import { runMigrations } from "./migrate";
import { ensureDemoDatabase } from "./demo-data";

(async () => {
  if (!config.demo) {
    console.error("Refusing to seed: set DEMO_MODE=true (this wipes the target database).");
    process.exit(1);
  }
  await runMigrations();
  await ensureDemoDatabase();
  await pool.end();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
