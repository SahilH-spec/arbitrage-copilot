import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const demo = process.env.DEMO_MODE === "true";

export const config = {
  env: process.env.NODE_ENV || "development",
  /** Public read-only showcase: fictional data, no writes, no external API calls. */
  demo,
  port: parseInt(process.env.PORT || "3001"),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",

  db: {
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/arbitrage_copilot",
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    managedAgentId: process.env.MANAGED_AGENT_ID || "",
    managedEnvId: process.env.MANAGED_ENV_ID || "",
  },

  amazon: {
    appId: process.env.AMAZON_SP_APP_ID || "",
    clientSecret: process.env.AMAZON_SP_CLIENT_SECRET || "",
    refreshToken: process.env.AMAZON_SP_REFRESH_TOKEN || "",
    sellerId: process.env.AMAZON_SELLER_ID || "",
    marketplaceId: process.env.AMAZON_MARKETPLACE_ID || "ATVPDKIKX0DER",
  },

  keepa: {
    apiKey: process.env.KEEPA_API_KEY || "",
  },

  brave: {
    apiKey: process.env.BRAVE_SEARCH_API_KEY || "",
  },

  plaid: {
    clientId: process.env.PLAID_CLIENT_ID || "",
    secret: process.env.PLAID_SECRET || "",
    env: process.env.PLAID_ENV || "sandbox", // sandbox | development | production
  },

  email: {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587"),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    reportEmail: process.env.REPORT_EMAIL || "",
  },

  security: {
    jwtSecret: process.env.JWT_SECRET || "dev-jwt-secret",
    /** Single-owner login password. Required in production (unless DEMO_MODE). */
    appPassword: process.env.APP_PASSWORD || "",
    /** 32-byte key (64 hex chars or base64) used to encrypt stored secrets such as the Plaid token. */
    encryptionKey: process.env.ENCRYPTION_KEY || "",
    sessionTtlHours: parseInt(process.env.SESSION_TTL_HOURS || "12"),
  },

  agent: {
    schedule: process.env.AGENT_RUN_SCHEDULE || "0 4 * * *",
    maxProducts: parseInt(process.env.AGENT_MAX_PRODUCTS || "20"),
    minRoi: parseInt(process.env.AGENT_MIN_ROI || "30"),
    minMonthlySales: parseInt(process.env.AGENT_MIN_MONTHLY_SALES || "30"),
  },
};

// In demo mode every integration reports as not configured, so no code path can
// reach Amazon, Plaid, Keepa, Brave, SMTP or Anthropic even if keys are present.
const flag = (v: boolean) => v && !config.demo;

export const isConfigured = {
  anthropic: flag(!!config.anthropic.apiKey),
  managedAgent: flag(!!config.anthropic.managedAgentId && !!config.anthropic.managedEnvId),
  amazon: flag(!!config.amazon.appId && !!config.amazon.refreshToken),
  keepa: flag(!!config.keepa.apiKey),
  brave: flag(!!config.brave.apiKey),
  plaid: flag(!!config.plaid.clientId && !!config.plaid.secret),
  email: flag(!!config.email.user && !!config.email.pass),
};

/** Login is enforced whenever a password is set (always, in production). Never in demo mode. */
export const authRequired = !config.demo && !!config.security.appPassword;

function validEncryptionKey(raw: string): boolean {
  const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  return buf.length === 32;
}

/**
 * Refuse to boot a production server that would be open or weakly protected.
 * Called once at startup, before the server listens.
 */
export function assertSecureConfig(): void {
  if (config.demo) {
    console.warn("[Security] DEMO_MODE: read-only, fictional data, all integrations disabled.");
    return;
  }
  const { jwtSecret, appPassword, encryptionKey } = config.security;
  if (config.env !== "production") {
    if (!appPassword) console.warn("[Security] APP_PASSWORD not set: login is DISABLED (development only).");
    return;
  }
  const problems: string[] = [];
  if (jwtSecret === "dev-jwt-secret" || jwtSecret.length < 32) {
    problems.push("JWT_SECRET must be set to a random string of at least 32 characters");
  }
  if (appPassword.length < 12) problems.push("APP_PASSWORD must be set (at least 12 characters)");
  if (isConfigured.plaid && !validEncryptionKey(encryptionKey)) {
    problems.push("ENCRYPTION_KEY must be 32 bytes (64 hex chars) when Plaid is configured");
  }
  if (problems.length) {
    throw new Error("Insecure production configuration:\n - " + problems.join("\n - "));
  }
}

export { validEncryptionKey };
