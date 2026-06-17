import { config, isConfigured } from "../config";
import { db } from "../db/client";
import { reports, reportProducts, suppliers, agentRuns } from "../db/schema";
import { eq } from "drizzle-orm";
import { findProducts, getProductMetrics, KEEPA_CATEGORIES } from "./keepa";
import { findRetailSources } from "./search";
import { getFbaInventory, getRecentOrders, updateListingPrice } from "./amazon-sp";

const API = "https://api.anthropic.com/v1";
const BETA = "managed-agents-2026-04-01";

function headers() {
  return {
    "x-api-key": config.anthropic.apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": BETA,
    "content-type": "application/json",
  };
}

let isRunning = false;
let currentSessionId: string | null = null;

export function getManagedAgentStatus() {
  return { isRunning, currentSessionId, configured: isConfigured.managedAgent };
}

// ─── Tool dispatch: the agent calls these; we run them with the owner's keys ──
async function dispatchTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "keepa_find_products": {
      const cats = (input.categories as string[]) || [];
      const opts = {
        maxBsr: (input.maxBsr as number) || 100000,
        minPriceCents: Math.round(((input.minPrice as number) || 12) * 100),
        maxPriceCents: Math.round(((input.maxPrice as number) || 80) * 100),
        maxSellers: (input.maxSellers as number) || 12,
        limit: (input.limit as number) || 30,
      };
      const set = new Set<string>();
      if (cats.length) {
        for (const c of cats.slice(0, 6)) {
          const catId = KEEPA_CATEGORIES[c];
          const found = await findProducts({ ...opts, categoryId: catId, limit: Math.ceil(opts.limit / Math.min(cats.length, 6)) + 4 }).catch(() => []);
          found.forEach((a) => set.add(a));
        }
      } else {
        (await findProducts(opts).catch(() => [])).forEach((a) => set.add(a));
      }
      return { asins: Array.from(set).slice(0, opts.limit) };
    }

    case "keepa_product_metrics": {
      const m = await getProductMetrics(input.asin as string).catch(() => null);
      if (!m) return { error: "No Keepa data for this ASIN" };
      return m;
    }

    case "find_retail_source": {
      const results = await findRetailSources(
        input.title as string,
        input.brand as string | undefined,
        input.upc as string | undefined
      ).catch(() => []);
      return { candidates: results };
    }

    case "lookup_suppliers": {
      const all = await db.select().from(suppliers).where(eq(suppliers.active, true));
      const cat = (input.category as string | undefined)?.toLowerCase();
      const matched = cat
        ? all.filter((s) => s.category?.toLowerCase().includes(cat.split(" ")[0]) || s.type === "wholesale")
        : all;
      return {
        suppliers: (matched.length ? matched : all).slice(0, 12).map((s) => ({
          name: s.name, type: s.type, website: s.website,
          couponsAvailable: s.couponsAvailable, avgDiscount: s.avgDiscount,
        })),
      };
    }

    case "amazon_inventory":
      return { inventory: await getFbaInventory().catch(() => []) };

    case "amazon_orders":
      return { orders: await getRecentOrders((input.days as number) || 7).catch(() => []) };

    case "amazon_update_price": {
      const ok = await updateListingPrice(input.sku as string, input.newPrice as number).catch(() => false);
      return { success: ok };
    }

    case "save_daily_report":
      return await saveAgentReport(input.summary as string, (input.products as AgentProduct[]) || []);

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

interface AgentProduct {
  asin: string; title?: string; category?: string;
  amazonPrice?: number; estimatedSourcePrice?: number;
  sourceVerified?: boolean; sourceUrl?: string; suggestedSupplier?: string;
  estimatedProfit?: number; estimatedRoi?: number; bsrRank?: number;
  monthlySalesEst?: number; competitionLevel?: string; criteriaScore?: number;
  analysis?: string; couponNote?: string; qualified?: boolean;
}

export async function saveAgentReport(summary: string, products: AgentProduct[]) {
  const today = new Date().toISOString().split("T")[0];
  const [existing] = await db.select().from(reports).where(eq(reports.date, today));
  let reportId: number;
  if (existing) {
    reportId = existing.id;
    // clear out previous products for a clean re-run
    await db.delete(reportProducts).where(eq(reportProducts.reportId, reportId));
  } else {
    const [r] = await db.insert(reports).values({ date: today, status: "generating" }).returning();
    reportId = r.id;
  }

  for (const p of products) {
    await db.insert(reportProducts).values({
      reportId,
      asin: p.asin,
      title: p.title || p.asin,
      category: p.category || null,
      currentPrice: p.amazonPrice?.toFixed(2) || null,
      suggestedBuyPrice: p.estimatedSourcePrice?.toFixed(2) || null,
      suggestedSellPrice: p.amazonPrice?.toFixed(2) || null,
      estimatedProfit: p.estimatedProfit?.toFixed(2) || null,
      estimatedRoi: p.estimatedRoi?.toFixed(2) || null,
      buyBoxPrice: p.amazonPrice?.toFixed(2) || null,
      bsrRank: p.bsrRank || null,
      monthlySalesEst: p.monthlySalesEst || null,
      competitionLevel: p.competitionLevel || null,
      sourceStore: p.suggestedSupplier || null,
      sourceUrl: p.sourceUrl || null,
      sourcePrice: p.estimatedSourcePrice?.toFixed(2) || null,
      criteriaScore: p.criteriaScore || null,
      aiAnalysis: p.analysis || null,
      discountNotes: p.couponNote || null,
      notes: p.sourceVerified
        ? "✓ Source price verified on a live retailer page"
        : "Unverified source estimate — confirm the real cost before buying",
      status: "pending",
    });
  }

  await db.update(reports).set({
    status: "completed",
    summary,
    totalProductsFound: products.length,
    updatedAt: new Date(),
  }).where(eq(reports.id, reportId));

  return { reportId, saved: products.length };
}

// ─── Session runner (SSE tool bridge) ─────────────────────────────────────────
export async function runManagedAgentSession(kickoff: string): Promise<number | null> {
  if (!isConfigured.managedAgent) throw new Error("Managed agent not configured");
  if (isRunning) {
    console.log("[ManagedAgent] Already running");
    return null;
  }
  isRunning = true;

  const logs: string[] = [];
  const log = (m: string) => {
    console.log(`[ManagedAgent] ${m}`);
    logs.push(`${new Date().toISOString()} — ${m}`);
  };

  const [run] = await db.insert(agentRuns).values({ startedAt: new Date(), status: "running", logs: [] }).returning();

  try {
    // 1. Create session
    const sessionResp = await fetch(`${API}/sessions`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        agent: config.anthropic.managedAgentId,
        environment_id: config.anthropic.managedEnvId,
        title: `Research ${new Date().toISOString()}`,
      }),
    });
    if (!sessionResp.ok) throw new Error(`Session create failed: ${sessionResp.status} ${await sessionResp.text()}`);
    const session = (await sessionResp.json()) as { id: string };
    currentSessionId = session.id;
    log(`Session created: ${session.id}`);

    // 2. Open the event stream (stream-first), then send the kickoff
    const streamResp = await fetch(`${API}/sessions/${session.id}/events/stream`, { headers: headers() });
    if (!streamResp.ok || !streamResp.body) throw new Error(`Stream open failed: ${streamResp.status}`);

    await fetch(`${API}/sessions/${session.id}/events`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ events: [{ type: "user.message", content: [{ type: "text", text: kickoff }] }] }),
    });
    log("Kickoff sent; streaming agent activity...");

    const reader = streamResp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let done = false;

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        let evt: { type: string; id?: string; name?: string; input?: Record<string, unknown>; content?: Array<{ type: string; text?: string }>; stop_reason?: { type: string }; error?: { message?: string } };
        try {
          evt = JSON.parse(dataLine.slice(5).trim());
        } catch {
          continue;
        }

        if (evt.type === "agent.custom_tool_use" && evt.id && evt.name) {
          log(`Tool call: ${evt.name}`);
          let result: unknown;
          try {
            result = await dispatchTool(evt.name, evt.input || {});
          } catch (e) {
            result = { error: e instanceof Error ? e.message : String(e) };
          }
          await fetch(`${API}/sessions/${session.id}/events`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({
              events: [{
                type: "user.custom_tool_result",
                custom_tool_use_id: evt.id,
                content: [{ type: "text", text: JSON.stringify(result).slice(0, 100000) }],
              }],
            }),
          });
        } else if (evt.type === "agent.message" && evt.content) {
          const text = evt.content.filter((c) => c.type === "text").map((c) => c.text).join("");
          if (text.trim()) log(`Agent: ${text.slice(0, 200)}`);
        } else if (evt.type === "session.error") {
          log(`Session error: ${evt.error?.message || "unknown"}`);
        } else if (evt.type === "session.status_terminated") {
          log("Session terminated");
          done = true;
        } else if (evt.type === "session.status_idle") {
          const sr = evt.stop_reason?.type;
          if (sr && sr !== "requires_action") {
            log(`Session idle (${sr}) — complete`);
            done = true;
          }
        }
      }
    }

    // Determine how many products landed in today's report
    const today = new Date().toISOString().split("T")[0];
    const [rep] = await db.select().from(reports).where(eq(reports.date, today));
    const found = rep?.totalProductsFound || 0;

    await db.update(agentRuns).set({
      completedAt: new Date(), status: "completed", productsFound: found,
      reportId: rep?.id || null, logs,
    }).where(eq(agentRuns.id, run.id));

    log(`Cycle complete — ${found} products in report`);
    isRunning = false;
    currentSessionId = null;
    return rep?.id || null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`ERROR: ${msg}`);
    await db.update(agentRuns).set({ completedAt: new Date(), status: "failed", error: msg, logs }).where(eq(agentRuns.id, run.id));
    isRunning = false;
    currentSessionId = null;
    throw err;
  }
}

export const RESEARCH_KICKOFF =
  "Run the full nightly research cycle now. Use keepa_find_products to discover real candidate ASINs across my active categories (Electronics, Home & Kitchen, Sports & Outdoors, Toys & Games, Health & Beauty, Office Products), pull each one's metrics with keepa_product_metrics, then SOURCE each viable product for real: get its UPC, call find_retail_source, and use web_search/web_fetch to open retailer pages and read the actual price and stock. Pick suppliers with lookup_suppliers and note coupons. Score every product against the criteria, then save the ranked report with save_daily_report (surface top candidates as a watchlist if fewer than 5 fully qualify). Aim for 15-20 products.";

export const MONITOR_KICKOFF =
  "Monitor my active inventory. Use amazon_inventory and amazon_orders to pull current listings and recent sales, check each against its buy-box price and sales velocity, and report prioritized alerts (price war, slow mover, lost buy box, stranded, profit at risk) with a specific recommended action for each. Do not change any prices without my approval.";
