import { config } from "../config";

// Keepa API docs: https://keepa.com/#!api
const BASE_URL = "https://api.keepa.com";

interface KeepaProduct {
  asin: string;
  title: string;
  brand: string;
  categories: number[];
  salesRankReference: number;
  salesRankReferenceName: string;
  numberOfItems: number;
  buyBoxPrice: number;
  amazonPrice: number;
  newPrice: number;
  fbaFees: {
    pickAndPackFee: number;
    storageFee: number;
  } | null;
  csv: number[][];  // price history arrays
  stats: {
    current: number[];
    avg: number[];
    avg30: number[];
    avg90: number[];
    avg180: number[];
    outOfStockPercentage30: number[];
  };
  monthlySold: number;
  totalOfferCount: number;
}

interface KeepaResponse {
  products: KeepaProduct[];
  tokensLeft: number;
}

// Keepa time to Unix timestamp
function keepaTimeToDate(keepaTime: number): Date {
  return new Date((keepaTime + 21564000) * 60000);
}

function keepaPriceToUSD(keepaPrice: number): number {
  return keepaPrice === -1 ? -1 : keepaPrice / 100;
}

export async function getKeepaProduct(asin: string): Promise<KeepaProduct | null> {
  if (!config.keepa.apiKey) {
    console.warn("[Keepa] API key not configured");
    return null;
  }

  const params = new URLSearchParams({
    key: config.keepa.apiKey,
    domain: "1", // US
    asin,
    stats: "90",
    offers: "20",
    history: "1",
  });

  const response = await fetch(`${BASE_URL}/product?${params}`);
  if (!response.ok) {
    console.error(`[Keepa] Failed: ${response.status}`);
    return null;
  }

  const data = (await response.json()) as KeepaResponse;
  return data.products?.[0] || null;
}

export interface ProductMetrics {
  asin: string;
  title: string;
  brand: string;
  currentAmazonPrice: number;
  buyBoxPrice: number;
  bsrRank: number;
  bsrCategory: string;
  monthlySalesEst: number;
  sellerCount: number;
  fbaFeeEstimate: number;
  priceHistory90d: Array<{ date: string; price: number }>;
  isAmazonSeller: boolean;
  avgPrice30d: number;
  avgPrice90d: number;
  priceDropPercent: number;
}

export async function getProductMetrics(asin: string): Promise<ProductMetrics | null> {
  const product = await getKeepaProduct(asin);
  if (!product) return null;

  // Parse price history from csv[1] (Amazon price) or csv[0] (new price)
  const priceHistory90d: Array<{ date: string; price: number }> = [];
  const rawPrices = product.csv?.[1] || product.csv?.[0] || [];
  for (let i = 0; i < rawPrices.length - 1; i += 2) {
    const keepaTime = rawPrices[i];
    const price = rawPrices[i + 1];
    if (price > 0) {
      const date = keepaTimeToDate(keepaTime);
      const now = new Date();
      const daysAgo = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      if (daysAgo <= 90) {
        priceHistory90d.push({
          date: date.toISOString().split("T")[0],
          price: keepaPriceToUSD(price),
        });
      }
    }
  }

  const currentPrice = keepaPriceToUSD(product.buyBoxPrice || product.newPrice || product.amazonPrice);
  const avg30 = keepaPriceToUSD(product.stats?.avg30?.[1] || product.stats?.avg30?.[18] || product.buyBoxPrice);
  const avg90 = keepaPriceToUSD(product.stats?.avg90?.[1] || product.stats?.avg90?.[18] || product.buyBoxPrice);
  const priceDropPercent = avg30 > 0 ? ((avg90 - currentPrice) / avg90) * 100 : 0;

  // Estimate monthly sales from BSR (rough heuristic for US marketplace)
  const bsr = product.salesRankReference;
  const monthlySalesEst = estimateMonthlySales(bsr, product.salesRankReferenceName);

  // FBA fee estimate (simplified)
  const fbaFeeEstimate = product.fbaFees?.pickAndPackFee
    ? keepaPriceToUSD(product.fbaFees.pickAndPackFee)
    : estimateFbaFee(currentPrice);

  return {
    asin: product.asin,
    title: product.title || "Unknown product",
    brand: product.brand || "",
    currentAmazonPrice: keepaPriceToUSD(product.amazonPrice),
    buyBoxPrice: keepaPriceToUSD(product.buyBoxPrice),
    bsrRank: bsr,
    bsrCategory: product.salesRankReferenceName || "Unknown",
    monthlySalesEst,
    sellerCount: product.totalOfferCount || 0,
    fbaFeeEstimate,
    priceHistory90d,
    isAmazonSeller: product.csv?.[10]?.[product.csv[10].length - 1] === 1,
    avgPrice30d: avg30,
    avgPrice90d: avg90,
    priceDropPercent,
  };
}

function estimateMonthlySales(bsr: number, category: string): number {
  if (bsr <= 0) return 0;
  // Rough BSR → monthly sales conversion (varies heavily by category)
  if (bsr <= 1000) return 3000;
  if (bsr <= 5000) return 1000;
  if (bsr <= 10000) return 500;
  if (bsr <= 50000) return 200;
  if (bsr <= 100000) return 100;
  if (bsr <= 500000) return 30;
  if (bsr <= 1000000) return 10;
  return 5;
}

function estimateFbaFee(price: number): number {
  // Simplified FBA fee estimate based on price (standard size, light item)
  if (price < 10) return 2.5;
  if (price < 20) return 3.5;
  if (price < 50) return 4.5;
  if (price < 100) return 5.5;
  return 7.0;
}

// ─── Product Finder ───────────────────────────────────────────────────────────
// Keepa "query" endpoint returns REAL ASINs matching a selection filter.
// Docs: https://keepa.com/#!discuss/t/product-finder/
export interface FinderOptions {
  maxBsr?: number;        // sales rank ceiling (lower = sells faster)
  minPriceCents?: number; // min current NEW price in cents
  maxPriceCents?: number; // max current NEW price in cents
  categoryId?: number;    // Keepa category id (optional)
  maxSellers?: number;    // max number of NEW offers (low competition)
  limit?: number;         // how many ASINs to return
}

export async function findProducts(opts: FinderOptions = {}): Promise<string[]> {
  if (!config.keepa.apiKey) {
    console.warn("[Keepa] API key not configured — cannot run product finder");
    return [];
  }

  const {
    maxBsr = 100000,
    minPriceCents = 1200,   // $12
    maxPriceCents = 8000,   // $80
    categoryId,
    maxSellers = 12,
    limit = 30,
  } = opts;

  // NOTE: Keepa Product Finder requires perPage === 50 (other values 400).
  // We always request 50 and slice down to `limit` client-side.
  const selection: Record<string, unknown> = {
    current_SALES_gte: 1,
    current_SALES_lte: maxBsr,
    current_NEW_gte: minPriceCents,
    current_NEW_lte: maxPriceCents,
    current_COUNT_NEW_gte: 2,
    current_COUNT_NEW_lte: maxSellers,
    sort: [["current_SALES", "asc"]],
    perPage: 50,
    page: 0,
  };
  if (categoryId) selection.categories_include = [categoryId];

  try {
    // Product Finder is a POST endpoint with the selection JSON as the body.
    const response = await fetch(`${BASE_URL}/query?key=${config.keepa.apiKey}&domain=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selection),
    });
    if (!response.ok) {
      console.error(`[Keepa] Product finder failed: ${response.status}`);
      return [];
    }
    const data = (await response.json()) as { asinList?: string[]; error?: { message: string } };
    if (data.error) {
      console.error(`[Keepa] Product finder error: ${data.error.message}`);
      return [];
    }
    return (data.asinList || []).slice(0, limit);
  } catch (err) {
    console.error("[Keepa] Product finder exception:", err);
    return [];
  }
}

// US root category ids (Keepa domain 1)
export const KEEPA_CATEGORIES: Record<string, number> = {
  "Electronics": 172282,
  "Home & Kitchen": 1055398,
  "Toys & Games": 165793011,
  "Sports & Outdoors": 3375251,
  "Health & Household": 3760901,
  "Office Products": 1064954,
  "Pet Supplies": 2619533011,
  "Beauty & Personal Care": 3760911,
  "Tools & Home Improvement": 228013,
  "Grocery & Gourmet Food": 16310101,
  "Baby": 165796011,
  "Garden & Outdoor": 2972638011,
};

export async function getBatchProductMetrics(asins: string[]): Promise<Map<string, ProductMetrics>> {
  const results = new Map<string, ProductMetrics>();
  // Keepa allows batch requests of up to 100 ASINs
  const batches = [];
  for (let i = 0; i < asins.length; i += 20) {
    batches.push(asins.slice(i, i + 20));
  }

  for (const batch of batches) {
    const promises = batch.map((asin) => getProductMetrics(asin));
    const metrics = await Promise.allSettled(promises);
    metrics.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value) {
        results.set(batch[idx], result.value);
      }
    });
    // Rate limit: Keepa allows 1 request/second on standard plan
    await new Promise((r) => setTimeout(r, 1000));
  }

  return results;
}
