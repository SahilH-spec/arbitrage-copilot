import { config } from "../config";

interface SearchResult {
  title: string;
  url: string;
  description: string;
}

interface BraveSearchResponse {
  web?: {
    results?: Array<{
      title: string;
      url: string;
      description: string;
    }>;
  };
}

// ─── Brave Search ─────────────────────────────────────────────────────────────
export async function braveSearch(query: string, count = 10): Promise<SearchResult[]> {
  if (!config.brave.apiKey) {
    console.warn("[Search] Brave API key not configured — returning empty results");
    return [];
  }

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", count.toString());
  url.searchParams.set("freshness", "pw"); // past week

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": config.brave.apiKey,
    },
  });

  if (!response.ok) {
    console.error(`[Search] Brave search failed: ${response.status}`);
    return [];
  }

  const data = (await response.json()) as BraveSearchResponse;
  return (data.web?.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    description: r.description,
  }));
}

// ─── Research Queries ─────────────────────────────────────────────────────────
export async function researchTrendingProducts(category: string): Promise<SearchResult[]> {
  const queries = [
    `"${category}" trending products Amazon 2025 high demand`,
    `best selling ${category} products Amazon arbitrage opportunity`,
    `${category} retail clearance deals arbitrage`,
  ];

  const allResults: SearchResult[] = [];
  for (const q of queries) {
    const results = await braveSearch(q, 5);
    allResults.push(...results);
  }
  return allResults;
}

export async function researchProductSources(productTitle: string): Promise<SearchResult[]> {
  const queries = [
    `"${productTitle}" buy site:walmart.com OR site:target.com OR site:homedepot.com`,
    `"${productTitle}" best price retail store`,
    `"${productTitle}" amazon arbitrage source`,
  ];

  const allResults: SearchResult[] = [];
  for (const q of queries) {
    const results = await braveSearch(q, 5);
    allResults.push(...results);
  }
  return allResults;
}

export async function researchMarketTrends(): Promise<string[]> {
  const results = await braveSearch(
    "Amazon FBA trending categories 2025 online arbitrage opportunity",
    10
  );
  return results.map((r) => `${r.title}: ${r.description}`);
}

export async function researchProductNews(asin: string, title: string): Promise<SearchResult[]> {
  return braveSearch(`"${title}" site:news.google.com OR site:reddit.com latest 2025`, 5);
}

export async function researchCompetitor(productTitle: string): Promise<SearchResult[]> {
  return braveSearch(`"${productTitle}" amazon competitors sellers analysis`, 5);
}

const RETAILER_DOMAINS = [
  "walmart.com", "target.com", "homedepot.com", "lowes.com", "bestbuy.com",
  "walgreens.com", "cvs.com", "costco.com", "samsclub.com", "bjs.com",
  "kohls.com", "staples.com", "officedepot.com", "chewy.com", "gnc.com",
  "ulta.com", "wayfair.com", "academy.com", "dickssportinggoods.com",
];

// Find candidate retailer pages for a product (sourcing). UPC gives the most exact match.
export async function findRetailSources(
  title: string,
  brand?: string,
  upc?: string
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  const queries: string[] = [];
  if (upc) queries.push(`${upc} ${brand || ""} buy`);
  queries.push(`${brand ? brand + " " : ""}${title} buy price`);
  queries.push(`${brand ? brand + " " : ""}${title} ${RETAILER_DOMAINS.slice(0, 4).map((d) => "site:" + d).join(" OR ")}`);

  for (const q of queries) {
    const r = await braveSearch(q, 6);
    for (const item of r) {
      const isRetailer = RETAILER_DOMAINS.some((d) => item.url.includes(d));
      if (isRetailer && !seen.has(item.url)) {
        seen.add(item.url);
        results.push(item);
      }
    }
  }
  // If nothing matched a known retailer, return the best general results
  if (results.length === 0) {
    const general = await braveSearch(`${brand ? brand + " " : ""}${title} buy online price`, 6);
    return general.slice(0, 6);
  }
  return results.slice(0, 10);
}
