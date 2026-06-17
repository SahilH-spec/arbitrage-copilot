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
