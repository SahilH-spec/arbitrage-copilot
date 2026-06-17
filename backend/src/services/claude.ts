import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return client;
}

// Models used across the app
const MODELS = {
  agent: "claude-opus-4-8",      // Heavy research + analysis
  chat: "claude-sonnet-4-6",     // Interactive chat
  fast: "claude-haiku-4-5-20251001", // Quick classifications
};

// ─── Chat (streaming) ────────────────────────────────────────────────────────
export async function streamChat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  const anthropic = getClient();
  let fullText = "";

  const stream = anthropic.messages.stream({
    model: MODELS.chat,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  for await (const chunk of stream) {
    if (
      chunk.type === "content_block_delta" &&
      chunk.delta.type === "text_delta"
    ) {
      fullText += chunk.delta.text;
      onChunk(chunk.delta.text);
    }
  }

  return fullText;
}

// ─── Agent Research ──────────────────────────────────────────────────────────
export async function runAgentResearch(prompt: string): Promise<string> {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: MODELS.agent,
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
    system: getAgentSystemPrompt(),
  });

  const content = response.content[0];
  if (content.type === "text") return content.text;
  throw new Error("Unexpected response type from Claude");
}

// ─── Product Analysis ────────────────────────────────────────────────────────
export async function analyzeProduct(productData: {
  asin: string;
  title: string;
  category: string;
  currentPrice: number;
  bsrRank: number;
  monthlySales: number;
  competitorCount: number;
  priceHistory: Array<{ date: string; price: number }>;
  sourceStore: string;
  sourcePrice: number;
  fbaFees: number;
}): Promise<{
  score: number;
  criteriaDetails: Record<string, { pass: boolean; reason: string; weight: number }>;
  aiAnalysis: string;
  estimatedProfit: number;
  estimatedRoi: number;
}> {
  const anthropic = getClient();
  const prompt = `
Analyze this Amazon product for online arbitrage profitability:

PRODUCT:
- ASIN: ${productData.asin}
- Title: ${productData.title}
- Category: ${productData.category}
- Current Amazon Price: $${productData.currentPrice}
- BSR Rank: #${productData.bsrRank} in ${productData.category}
- Est. Monthly Sales: ${productData.monthlySales}
- Competitor Sellers: ${productData.competitorCount}
- Source: ${productData.sourceStore} @ $${productData.sourcePrice}
- FBA Fees: $${productData.fbaFees}

PRICE HISTORY (last 90 days):
${productData.priceHistory.map((p) => `${p.date}: $${p.price}`).join("\n")}

Evaluate against these online-arbitrage criteria and return JSON:
{
  "score": <0-100>,
  "criteriaDetails": {
    "roi": { "pass": true/false, "reason": "...", "weight": 20 },
    "profitDollars": { "pass": true/false, "reason": "...", "weight": 10 },
    "salesVelocity": { "pass": true/false, "reason": "...", "weight": 20 },
    "competition": { "pass": true/false, "reason": "...", "weight": 15 },
    "amazonPresence": { "pass": true/false, "reason": "...", "weight": 10 },
    "priceStability": { "pass": true/false, "reason": "...", "weight": 10 },
    "profitMargin": { "pass": true/false, "reason": "...", "weight": 10 },
    "reviewHealth": { "pass": true/false, "reason": "...", "weight": 5 }
  },
  "aiAnalysis": "2-3 sentence narrative",
  "estimatedProfit": <number>,
  "estimatedRoi": <percentage>
}

ROI Formula: ((sellPrice - buyPrice - fees) / buyPrice) * 100
Pass thresholds:
- roi: ROI >= 30%
- profitDollars: net profit >= $3/unit
- salesVelocity: BSR <= 100,000 AND est monthly sales >= 30
- competition: <= 8 FBA sellers on the listing
- amazonPresence: Amazon not in buy box (or < 30% of the time)
- priceStability: 90-day average price not declining more than 20%
- profitMargin: net margin >= 20%
- reviewHealth: rating >= 4 stars (low return risk)

Return ONLY valid JSON, no markdown.
`;

  const response = await anthropic.messages.create({
    model: MODELS.fast,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response");

  try {
    return JSON.parse(content.text);
  } catch {
    return {
      score: 50,
      criteriaDetails: {},
      aiAnalysis: content.text.slice(0, 200),
      estimatedProfit: productData.currentPrice - productData.sourcePrice - productData.fbaFees,
      estimatedRoi: ((productData.currentPrice - productData.sourcePrice - productData.fbaFees) / productData.sourcePrice) * 100,
    };
  }
}

// ─── Sourcing Estimate ────────────────────────────────────────────────────────
export async function estimateSourcing(input: {
  title: string;
  brand: string;
  category: string;
  amazonPrice: number;
  suppliers: string[];
}): Promise<{ estimatedSourcePrice: number; suggestedSource: string; rationale: string }> {
  const anthropic = getClient();
  const prompt = `
You are an Amazon online-arbitrage sourcing expert. For this product, estimate the most likely
retail/wholesale SOURCE cost and which store to buy it from.

Product: ${input.title}
Brand: ${input.brand || "n/a"}
Category: ${input.category}
Current Amazon sell price: $${input.amazonPrice.toFixed(2)}
Candidate suppliers: ${input.suppliers.join(", ")}

Estimate a realistic source price (what you'd actually pay at retail/wholesale, often 40-70% of the
Amazon price for viable arbitrage, accounting for sales/clearance/coupons). Pick the single best
source from the candidate list.

Return ONLY JSON: {"estimatedSourcePrice": <number>, "suggestedSource": "<store>", "rationale": "<one sentence>"}
`;

  const response = await anthropic.messages.create({
    model: MODELS.fast,
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });
  const content = response.content[0];
  if (content.type !== "text") {
    return { estimatedSourcePrice: input.amazonPrice * 0.6, suggestedSource: input.suppliers[0] || "Walmart", rationale: "Estimate unavailable" };
  }
  try {
    const json = JSON.parse(content.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    return {
      estimatedSourcePrice: Number(json.estimatedSourcePrice) || input.amazonPrice * 0.6,
      suggestedSource: json.suggestedSource || input.suppliers[0] || "Walmart",
      rationale: json.rationale || "",
    };
  } catch {
    return { estimatedSourcePrice: input.amazonPrice * 0.6, suggestedSource: input.suppliers[0] || "Walmart", rationale: "Estimate unavailable" };
  }
}

// ─── Inventory Alert Analysis ─────────────────────────────────────────────────
export async function analyzeInventoryAlerts(items: Array<{
  asin: string;
  title: string;
  currentPrice: number;
  buyBoxPrice: number;
  buyPrice: number;
  quantityAtAmazon: number;
  daysInStorage: number;
  lastSaleDate: string | null;
}>): Promise<Array<{
  asin: string;
  alertType: string;
  severity: "low" | "medium" | "high";
  message: string;
  action: string;
}>> {
  if (items.length === 0) return [];

  const anthropic = getClient();
  const prompt = `
Analyze these Amazon FBA inventory items and identify issues requiring attention:

${JSON.stringify(items, null, 2)}

For each item that has an issue, return an alert in this JSON array format:
[
  {
    "asin": "...",
    "alertType": "price_war|slow_sales|stranded|low_stock|repricing_needed|profit_at_risk",
    "severity": "low|medium|high",
    "message": "Brief description of the issue",
    "action": "Specific recommended action"
  }
]

Return ONLY valid JSON array (can be empty if no issues).
`;

  const response = await anthropic.messages.create({
    model: MODELS.fast,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") return [];

  try {
    return JSON.parse(content.text);
  } catch {
    return [];
  }
}

// ─── Report Summary ───────────────────────────────────────────────────────────
export async function generateReportSummary(products: Array<{
  title: string;
  category: string;
  estimatedRoi: number;
  criteriaScore: number;
  sourceStore: string;
}>): Promise<string> {
  const anthropic = getClient();
  const prompt = `
Write a concise executive summary (3-4 sentences) for today's Amazon arbitrage product research report.

Top products found:
${products
  .slice(0, 5)
  .map((p) => `- ${p.title} (${p.category}) | ROI: ${p.estimatedRoi}% | Score: ${p.criteriaScore}/100 | Source: ${p.sourceStore}`)
  .join("\n")}

Total products: ${products.length}
Avg score: ${Math.round(products.reduce((a, b) => a + b.criteriaScore, 0) / products.length)}

Keep it professional and actionable. Focus on opportunities and key metrics.
`;

  const response = await anthropic.messages.create({
    model: MODELS.fast,
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  return content.type === "text" ? content.text : "Report generated successfully.";
}

// ─── Chat System Prompt ───────────────────────────────────────────────────────
export function getChatSystemPrompt(context: {
  todayRevenue?: number;
  activeProducts?: number;
  pendingTodos?: number;
}): string {
  return `You are the AI Copilot for an Amazon online arbitrage business. You have deep expertise in:
- Amazon FBA operations, fees, and policies
- Online arbitrage strategies and sourcing
- Keepa price history analysis
- Buy box dynamics and repricing
- Inventory management and storage fees
- Profitability analysis and ROI calculations
- Market trends and product research
- Amazon Seller Central operations

Current business context:
- Today's revenue: $${context.todayRevenue || 0}
- Active products: ${context.activeProducts || 0}
- Pending action items: ${context.pendingTodos || 0}

Be concise, data-driven, and actionable. When asked for analysis, provide specific numbers and recommendations.
Help the user make profitable decisions, avoid costly mistakes, and grow their arbitrage business.
Always consider Amazon's current policies and FBA fee structure in your advice.`;
}

function getAgentSystemPrompt(): string {
  return `You are an autonomous AI research agent for an Amazon online arbitrage business.
Your job is to find profitable products that can be purchased from retail stores or online
and resold on Amazon FBA for profit.

You have expertise in:
- Identifying products with strong BSR ranks (sell frequently)
- Calculating FBA fees and profitability
- Recognizing price arbitrage opportunities
- Understanding Amazon marketplace dynamics
- Evaluating competition levels
- Assessing price stability using Keepa data

Always provide structured, actionable findings with specific numbers.
Focus on products that meet these minimum criteria:
- ROI >= 30% after all fees
- Monthly sales >= 30 units
- Not sold/dominated by Amazon
- Competition <= 5 FBA sellers
- Price history stable or rising

Prioritize products from: Walmart, Target, Home Depot, Walgreens, CVS, Costco, Sam's Club,
and major online retailers when retail arbitrage opportunities exist.`;
}
