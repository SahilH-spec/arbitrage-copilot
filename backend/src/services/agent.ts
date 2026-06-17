import { db } from "../db/client";
import { reports, reportProducts, agentRuns, agentSettings, suppliers } from "../db/schema";
import { analyzeProduct, generateReportSummary, estimateSourcing } from "./claude";
import { getProductMetrics, findProducts, KEEPA_CATEGORIES } from "./keepa";
import { eq } from "drizzle-orm";
import { config } from "../config";

export interface AgentConfig {
  maxProducts: number;
  minRoi: number;
  minMonthlySales: number;
  minScore: number;
  maxBsr: number;
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
    maxBsr: (map.maxBsr as number) || 100000,
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

    // Load suppliers once (used for sourcing estimates + report recommendations)
    const allSuppliers = await db.select().from(suppliers).where(eq(suppliers.active, true));
    const supplierNames = allSuppliers.map((s) => s.name);
    const recommendSuppliers = (category: string) => {
      const cat = (category || "").toLowerCase();
      const matched = allSuppliers.filter(
        (s) =>
          s.category &&
          (cat.includes(s.category.toLowerCase().split(" ")[0]) ||
            s.category.toLowerCase().includes(cat.split(" ")[0]) ||
            s.type === "wholesale")
      ).slice(0, 4);
      const pool = matched.length >= 2 ? matched : allSuppliers.slice(0, 4);
      return pool.map((s) => ({ name: s.name, website: s.website, couponsAvailable: s.couponsAvailable, avgDiscount: s.avgDiscount, type: s.type }));
    };

    // ── Phase 1: Discover real ASINs via Keepa Product Finder ─────────────────
    log("Phase 1: Finding real products via Keepa Product Finder...");
    const asinSet = new Set<string>();
    const categoriesToScan = agentConfig.categories.slice(0, 6);
    const perCat = Math.max(8, Math.ceil((agentConfig.maxProducts * 2) / Math.max(1, categoriesToScan.length)));

    for (const catName of categoriesToScan) {
      const catId = KEEPA_CATEGORIES[catName];
      const found = await findProducts({
        maxBsr: agentConfig.maxBsr || 100000,
        minPriceCents: 1200,
        maxPriceCents: 8000,
        categoryId: catId,
        maxSellers: 12,
        limit: perCat,
      }).catch(() => [] as string[]);
      found.forEach((a) => asinSet.add(a));
      log(`  ${catName}: ${found.length} candidates`);
    }

    // Fallback: category-agnostic sweep if categories returned little
    if (asinSet.size < agentConfig.maxProducts) {
      const broad = await findProducts({ maxBsr: agentConfig.maxBsr || 100000, limit: agentConfig.maxProducts * 2 }).catch(() => [] as string[]);
      broad.forEach((a) => asinSet.add(a));
    }

    const asinList = Array.from(asinSet).slice(0, agentConfig.maxProducts * 2);
    log(`Phase 1 complete — ${asinList.length} real ASINs to analyze`);

    // ── Phase 2: Pull real metrics + estimate sourcing + score ────────────────
    log("Phase 2: Analyzing products (Keepa metrics + sourcing estimate)...");
    const analyzedProducts: Array<{
      candidate: { title: string; asin: string; category: string; estimatedAmazonPrice: number; sourceStore: string; estimatedSourcePrice: number };
      metrics: Awaited<ReturnType<typeof getProductMetrics>>;
      analysis: {
        score: number;
        criteriaDetails: Record<string, { pass: boolean; reason: string; weight: number }>;
        aiAnalysis: string;
        estimatedProfit: number;
        estimatedRoi: number;
      };
    }> = [];

    for (const asin of asinList) {
      const metrics = await getProductMetrics(asin).catch(() => null);
      if (!metrics || !metrics.buyBoxPrice || metrics.buyBoxPrice <= 0) {
        continue;
      }

      const sellPrice = metrics.buyBoxPrice;
      const category = metrics.bsrCategory || "General";
      log(`Analyzing ${asin}: ${metrics.title.slice(0, 45)}`);

      // Estimate sourcing (source price + best store)
      const sourcing = await estimateSourcing({
        title: metrics.title,
        brand: metrics.brand,
        category,
        amazonPrice: sellPrice,
        suppliers: supplierNames.slice(0, 12),
      }).catch(() => ({ estimatedSourcePrice: sellPrice * 0.6, suggestedSource: supplierNames[0] || "Walmart", rationale: "" }));

      const buyPrice = sourcing.estimatedSourcePrice;
      const fbaFees = metrics.fbaFeeEstimate || sellPrice * 0.15 + 3.5;

      const analysis = await analyzeProduct({
        asin,
        title: metrics.title,
        category,
        currentPrice: sellPrice,
        bsrRank: metrics.bsrRank || 999999,
        monthlySales: metrics.monthlySalesEst || 0,
        competitorCount: metrics.sellerCount || 0,
        priceHistory: metrics.priceHistory90d || [],
        sourceStore: sourcing.suggestedSource,
        sourcePrice: buyPrice,
        fbaFees,
      }).catch(() => ({
        score: 0,
        criteriaDetails: {},
        aiAnalysis: "Analysis unavailable",
        estimatedProfit: sellPrice - buyPrice - fbaFees,
        estimatedRoi: buyPrice > 0 ? ((sellPrice - buyPrice - fbaFees) / buyPrice) * 100 : 0,
      }));

      analyzedProducts.push({
        candidate: {
          title: metrics.title,
          asin,
          category,
          estimatedAmazonPrice: sellPrice,
          sourceStore: sourcing.suggestedSource,
          estimatedSourcePrice: buyPrice,
        },
        metrics,
        analysis,
      });
    }

    // ── Phase 3: Filter & Rank ─────────────────────────────────────────────────
    log("Phase 3: Filtering and ranking products...");
    const meetsThreshold = (p: (typeof analyzedProducts)[number]) => {
      const roi = p.analysis.estimatedRoi;
      const score = p.analysis.score;
      const monthlySales = p.metrics?.monthlySalesEst || 0;
      return roi >= agentConfig.minRoi && score >= agentConfig.minScore && monthlySales >= agentConfig.minMonthlySales;
    };

    const ranked = [...analyzedProducts].sort((a, b) => b.analysis.score - a.analysis.score);
    const fullyQualified = ranked.filter(meetsThreshold);

    // Surface the fully-qualified leads; if too few clear every threshold,
    // fill the report with the highest-scoring candidates as a watchlist so the
    // user always sees real, ranked products to review (sourcing is an estimate).
    const qualifiedProducts = (fullyQualified.length >= 5 ? fullyQualified : ranked).slice(0, agentConfig.maxProducts);
    const qualifiedAsins = new Set(fullyQualified.map((p) => p.candidate.asin));

    log(`${fullyQualified.length} fully qualified; surfacing ${qualifiedProducts.length} top candidates for review`);

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

    // Insert report products (suppliers loaded in Phase 1)
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
        notes: qualifiedAsins.has(p.candidate.asin)
          ? "✓ Meets all profitability criteria"
          : "Watchlist — sourcing price is an AI estimate; verify the actual source cost before buying",
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
