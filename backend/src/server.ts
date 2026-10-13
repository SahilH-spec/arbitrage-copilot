import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import path from "path";
import { config, assertSecureConfig } from "./config";
import routes from "./routes/index";
import { runMigrations } from "./db/migrate";
import { initScheduler } from "./services/scheduler";
import { ensureDemoDatabase } from "./db/demo-data";

const app = express();

// Railway terminates TLS in front of the app; needed for correct client IPs (rate limiting) and secure cookies.
app.set("trust proxy", 1);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // allow frontend to load assets
}));

app.use(cors({
  origin: config.env === "production" ? false : [config.frontendUrl],
  credentials: true,
}));

app.use(morgan(config.env === "production" ? "combined" : "dev"));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api", routes);

// ─── Serve Frontend (production) ─────────────────────────────────────────────
if (config.env === "production") {
  const frontendDist = path.join(__dirname, "../../frontend/dist");
  app.use(express.static(frontendDist));
  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[Error]", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    // Refuse to boot an open or weakly protected production server
    assertSecureConfig();

    // Run DB migrations
    await runMigrations();
    console.log("[DB] Connected and migrated");

    if (config.demo) {
      // Demo is only allowed on a database that holds the fictional dataset.
      await ensureDemoDatabase();
    } else {
      // Nightly research agent (never runs in demo mode)
      await initScheduler();
    }

    // Start server
    app.listen(config.port, () => {
      console.log(`[Server] Running on port ${config.port} (${config.env})`);
      console.log(`[Server] API: http://localhost:${config.port}/api`);
    });
  } catch (err) {
    console.error("[Server] Failed to start:", err);
    process.exit(1);
  }
}

start();

export default app;
