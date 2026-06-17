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
