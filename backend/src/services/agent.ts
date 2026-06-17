import { db } from "../db/client";
import { reports, reportProducts, agentRuns, agentSettings, suppliers } from "../db/schema";
import { runAgentResearch, analyzeProduct, generateReportSummary } from "./claude";
import { braveSearch, researchTrendingProducts } from "./search";
import { getProductMetrics } from "./keepa";
import { eq } from "drizzle-orm";
import { config } from "../config";

export interface AgentConfig {
  maxProducts: number;
  minRoi: number;
  minMonthlySales: number;
  minScore: number;
  categories: string[];
  excludeCategories: string[];
  maxCompetitors: number;
}

let isRunning = false;
let currentRunId: number | null = null;

export function getAgentStatus() {
  return { isRunning, currentRunId };
}

export async function getAgentConfig(): Promise<AgentConfig> {
  const settings = await db.select().from(agentSettings);
  const map: Record<string, unknown> = {};
  settings.forEach((s) => {
    map[s.key] = s.value;
  });

  return {
    maxProducts: (map.maxProducts as number) || config.agent.maxProducts,
    minRoi: (map.minRoi as number) || config.agent.minRoi,
    minMonthlySales: (map.minMonthlySales as number) || config.agent.minMonthlySales,
    minScore: (map.minScore as number) || 60,
    categories: (map.categories as string[]) || [
      "Electronics", "Home & Kitchen", "Sports & Outdoors", "Toys & Games",
    ],
    excludeCategories: (map.excludeCategories as string[]) || ["Grocery", "Automotive"],
    maxCompetitors: (map.maxCompetitors as number) || 5,
  };
}

export async function runAgentCycle(manual = false): Promise<number | null> {
  if (isRunning) {
    console.log("[Agent] Already running — skipping");
    return null;
  }

  isRunning = true;
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(`[Agent] ${msg}`);
    logs.push(`${new Date().toISOString()} — ${msg}`);
  };

  // Create agent run record
  const [run] = await db
    .insert(agentRuns)
    .values({ startedAt: new Date(), status: "running", logs: [] })
    .returning();

  currentRunId = run.id;

  try {
    log(`Starting ${manual ? "manual" : "scheduled"} research cycle`);

    const agentConfig = await getAgentConfig();
    log(`Config: max ${agentConfig.maxProducts} products, min ROI ${agentConfig.minRoi}%, min score ${agentConfig.minScore}`);

    // ── Phase 1: Market Trend Research ────────────────────────────────────────
    log("Phase 1: Researching market trends...");
    const trendPrompt = `
Research today's best Amazon online arbitrage opportunities. Focus on:
1. Currently trending products across these categories: ${agentConfig.categories.join(", ")}
2. Products with strong BSR ranks (high sales velocity)
3. Items available at retail stores or online for less than Amazon price
4. Products NOT sold directly by Amazon (or where Amazon is out of stock)

Identify 10-15 specific product opportunities. For each, provide:
- Product name/description
- ASIN if known
- Estimated Amazon selling price
- Where to source it (store name + estimated source price)
- Why it's a good opportunity

Format as JSON array:
[{
  "title": "...",
  "asin": "...",
  "category": "...",
  "estimatedAmazonPrice": 0,
  "sourceStore": "...",
  "estimatedSourcePrice": 0,
  "reason": "..."
}]
`;

    const researchResult = await runAgentResearch(trendPrompt);
    log("Phase 1 complete — parsing product candidates");

    let candidates: Array<{
      title: string;
      asin: string;
      category: string;
      estimatedAmazonPrice: number;
      sourceStore: string;
      estimatedSourcePrice: number;
      reason: string;
    }> = [];

    try {
      const jsonMatch = researchResult.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        candidates = JSON.parse(jsonMatch[0]);
      }
    } catch {
      log("Warning: Could not parse research JSON — using text extraction");
    }

    log(`Found ${candidates.length} initial candidates`);

    // ── Phase 2: Deep Product Analysis ────────────────────────────────────────
    log("Phase 2: Running Keepa analysis on candidates...");
    const analyzedProducts: Array<{
      candidate: (typeof candidates)[0];
      metrics: Awaited<ReturnType<typeof getProductMetrics>>;
      analysis: {
        score: number;
        criteriaDetails: Record<string, { pass: boolean; reason: string; weight: number }>;
        aiAnalysis: string;
        estimatedProfit: number;
        estimatedRoi: number;
      };
    }> = [];

    for (const candidate of candidates.slice(0, agentConfig.maxProducts * 2)) {
      if (!candidate.asin) {
        log(`Skipping "${candidate.title}" — no ASIN`);
        continue;
      }

      log(`Analyzing ${candidate.asin}: ${candidate.title.slice(0, 50)}`);

      const metrics = await getProductMetrics(candidate.asin).catch(() => null);

      const buyPrice = candidate.estimatedSourcePrice;
      const sellPrice = metrics?.buyBoxPrice || candidate.estimatedAmazonPrice;
      const fbaFees = metrics?.fbaFeeEstimate || sellPrice * 0.15 + 3.5;

      const analysis = await analyzeProduct({
        asin: candidate.asin,
        title: candidate.title,
        category: candidate.category,
        currentPrice: sellPrice,
        bsrRank: metrics?.bsrRank || 999999,
        monthlySales: metrics?.monthlySalesEst || 0,
        competitorCount: metrics?.sellerCount || 0,
        priceHistory: metrics?.priceHistory90d || [],
        sourceStore: candidate.sourceStore,
        sourcePrice: buyPrice,
        fbaFees,
      }).catch(() => ({
        score: 0,
        criteriaDetails: {},
        aiAnalysis: "Analysis unavailable",
        estimatedProfit: sellPrice - buyPrice - fbaFees,
        estimatedRoi: ((sellPrice - buyPrice - fbaFees) / buyPrice) * 100,
      }));

      analyzedProducts.push({ candidate, metrics, analysis });
    }

    // ── Phase 3: Filter & Rank ─────────────────────────────────────────────────
    log("Phase 3: Filtering and ranking products...");
    const qualifiedProducts = analyzedProducts
      .filter((p) => {
        const roi = p.analysis.estimatedRoi;
        const score = p.analysis.score;
        const monthlySales = p.metrics?.monthlySalesEst || 0;
        return roi >= agentConfig.minRoi && score >= agentConfig.minScore && monthlySales >= agentConfig.minMonthlySales;
      })
      .sort((a, b) => b.analysis.score - a.analysis.score)
      .slice(0, agentConfig.maxProducts);

    log(`${qualifiedProducts.length} products passed quality filters`);

    // ── Phase 4: Create Report ────────────────────────────────────────────────
    log("Phase 4: Creating daily report...");
    const today = new Date().toISOString().split("T")[0];

    const [existingReport] = await db
      .select()
      .from(reports)
      .where(eq(reports.date, today));

    let reportId: number;
    if (existingReport) {
      await db.update(reports).set({ status: "generating" }).where(eq(reports.id, existingReport.id));
      reportId = existingReport.id;
    } else {
      const [newReport] = await db
        .insert(reports)
        .values({ date: today, status: "generating" })
        .returning();
      reportId = newReport.id;
    }

    // Load suppliers once for recommendations
    const allSuppliers = await db.select().from(suppliers).where(eq(suppliers.active, true));
    const recommendSuppliers = (category: string) => {
      const cat = (category || "").toLowerCase();
      const matched = allSuppliers
        .filter((s) =>
          s.category && (cat.includes(s.category.toLowerCase().split(" ")[0]) ||
          s.category.toLowerCase().includes(cat.split(" ")[0]) ||
          s.type === "wholesale")
        )
        .slice(0, 4);
      const pool = matched.length >= 2 ? matched : allSuppliers.slice(0, 4);
      return pool.map((s) => ({
        name: s.name,
        website: s.website,
        couponsAvailable: s.couponsAvailable,
        avgDiscount: s.avgDiscount,
        type: s.type,
      }));
    };

    // Insert report products
    for (const p of qualifiedProducts) {
      const m = p.metrics;
      const a = p.analysis;
      const supplierRecs = recommendSuppliers(p.candidate.category);
      const couponSuppliers = supplierRecs.filter((s) => s.couponsAvailable).map((s) => s.name);
      await db.insert(reportProducts).values({
        reportId,
        asin: p.candidate.asin,
        title: p.candidate.title,
        category: p.candidate.category,
        currentPrice: m?.buyBoxPrice?.toFixed(2) || p.candidate.estimatedAmazonPrice.toFixed(2),
        suggestedBuyPrice: p.candidate.estimatedSourcePrice.toFixed(2),
        suggestedSellPrice: (m?.buyBoxPrice || p.candidate.estimatedAmazonPrice).toFixed(2),
        estimatedProfit: a.estimatedProfit.toFixed(2),
        estimatedRoi: a.estimatedRoi.toFixed(2),
        buyBoxPrice: m?.buyBoxPrice?.toFixed(2) || null,
        bsrRank: m?.bsrRank || null,
        bsrCategory: m?.bsrCategory || null,
        monthlySalesEst: m?.monthlySalesEst || null,
        competitionLevel: (m?.sellerCount || 0) <= 3 ? "low" : (m?.sellerCount || 0) <= 6 ? "medium" : "high",
        sourceStore: p.candidate.sourceStore,
        sourcePrice: p.candidate.estimatedSourcePrice.toFixed(2),
        criteriaScore: a.score,
        criteriaDetails: a.criteriaDetails,
        aiAnalysis: a.aiAnalysis,
        supplierRecommendations: supplierRecs,
        coupons: couponSuppliers.length ? couponSuppliers : null,
        discountNotes: couponSuppliers.length
          ? `Coupons/discounts often available at: ${couponSuppliers.join(", ")}`
          : null,
        status: "pending",
      });
    }

    // Generate summary
    const summary = await generateReportSummary(
      qualifiedProducts.map((p) => ({
        title: p.candidate.title,
        category: p.candidate.category,
        estimatedRoi: p.analysis.estimatedRoi,
        criteriaScore: p.analysis.score,
        sourceStore: p.candidate.sourceStore,
      }))
    );

    await db.update(reports).set({
      status: "completed",
      summary,
      totalProductsFound: qualifiedProducts.length,
      agentRunId: run.id,
      updatedAt: new Date(),
    }).where(eq(reports.id, reportId));

    await db.update(agentRuns).set({
      completedAt: new Date(),
      status: "completed",
      productsFound: qualifiedProducts.length,
      reportId,
      logs,
    }).where(eq(agentRuns.id, run.id));

    log(`Cycle complete — ${qualifiedProducts.length} products added to report #${reportId}`);
    isRunning = false;
    currentRunId = null;
    return reportId;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log(`ERROR: ${errMsg}`);

    await db.update(agentRuns).set({
      completedAt: new Date(),
      status: "failed",
      error: errMsg,
      logs,
    }).where(eq(agentRuns.id, run.id));

    isRunning = false;
    currentRunId = null;
    throw error;
  }
}
