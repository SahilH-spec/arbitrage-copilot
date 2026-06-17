import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

export const config = {
  env: process.env.NODE_ENV || "development",
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

  email: {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587"),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    reportEmail: process.env.REPORT_EMAIL || "",
  },

  security: {
    sessionSecret: process.env.SESSION_SECRET || "dev-session-secret",
    jwtSecret: process.env.JWT_SECRET || "dev-jwt-secret",
  },

  agent: {
    schedule: process.env.AGENT_RUN_SCHEDULE || "0 4 * * *",
    maxProducts: parseInt(process.env.AGENT_MAX_PRODUCTS || "20"),
    minRoi: parseInt(process.env.AGENT_MIN_ROI || "30"),
    minMonthlySales: parseInt(process.env.AGENT_MIN_MONTHLY_SALES || "30"),
  },
};

export const isConfigured = {
  anthropic: !!config.anthropic.apiKey,
  managedAgent: !!config.anthropic.managedAgentId && !!config.anthropic.managedEnvId,
  amazon: !!config.amazon.appId && !!config.amazon.refreshToken,
  keepa: !!config.keepa.apiKey,
  brave: !!config.brave.apiKey,
  email: !!config.email.user && !!config.email.pass,
};
