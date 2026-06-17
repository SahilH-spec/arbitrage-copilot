import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { config } from "../config";

const pool = new Pool({
  connectionString: config.db.url,
  // Railway's internal Postgres does NOT use SSL. Only enable SSL for
  // external databases that require it (set DATABASE_SSL=true).
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err);
});

export const db = drizzle(pool, { schema });
export { pool };
