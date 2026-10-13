/**
 * Fictional dataset for the public read-only demo (DEMO_MODE=true).
 *
 * Every brand, product, ASIN, order and dollar figure here is invented. Dates are relative to
 * "now" so the demo always looks current, and the dataset is rebuilt on start and every 6 hours.
 *
 * Safety: the demo refuses to touch a database that holds anything other than this dataset
 * (it looks for the `demo_dataset` marker), so it can never wipe or expose a real database.
 */
import { sql } from "drizzle-orm";
import { db } from "./client";
import {
  agentRuns, agentSettings, chatMessages, inventoryItems, reportProducts, reports,
  suppliers, supplies, transactions,
} from "./schema";

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().split("T")[0];
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const money = (n: number) => n.toFixed(2);

// Small deterministic PRNG so every rebuild produces the same shape of data
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface P {
  asin: string; title: string; brand: string; category: string; store: string;
  buy: number; sell: number; bsr: number; bsrCat: string; monthly: number; comp: number; drop90: number;
}

// 16 invented products (brands do not exist)
const P: P[] = [
  { asin: "B0DEMO0001", title: "Brightleaf Reusable Silicone Food Bags, 8-Pack", brand: "Brightleaf", category: "Home & Kitchen", store: "Target", buy: 11.49, sell: 27.99, bsr: 4210, bsrCat: "Kitchen & Dining", monthly: 540, comp: 3, drop90: 6 },
  { asin: "B0DEMO0002", title: "Pinecrest Cedar Closet Organizer Set, 12 Piece", brand: "Pinecrest", category: "Home & Kitchen", store: "Walmart", buy: 14.0, sell: 34.5, bsr: 9800, bsrCat: "Home Storage", monthly: 310, comp: 4, drop90: 9 },
  { asin: "B0DEMO0003", title: "Kettleworks Gooseneck Pour-Over Kettle, 1L", brand: "Kettleworks", category: "Home & Kitchen", store: "Kohl's", buy: 22.0, sell: 49.99, bsr: 7600, bsrCat: "Coffee Makers", monthly: 260, comp: 5, drop90: 11 },
  { asin: "B0DEMO0004", title: "Tidewell Insulated Kids Water Bottle, 14oz", brand: "Tidewell", category: "Sports & Outdoors", store: "Costco", buy: 9.25, sell: 22.99, bsr: 3150, bsrCat: "Water Bottles", monthly: 720, comp: 6, drop90: 14 },
  { asin: "B0DEMO0005", title: "Northfold Packable Daypack, 18L", brand: "Northfold", category: "Sports & Outdoors", store: "Walmart", buy: 13.8, sell: 31.95, bsr: 12400, bsrCat: "Daypacks", monthly: 205, comp: 4, drop90: 7 },
  { asin: "B0DEMO0006", title: "Aurelia Interactive Cat Feather Wand Toy, 3-Pack", brand: "Aurelia", category: "Pet Supplies", store: "Target", buy: 6.4, sell: 17.99, bsr: 5300, bsrCat: "Cat Toys", monthly: 610, comp: 3, drop90: 5 },
  { asin: "B0DEMO0007", title: "Lumio Rechargeable Motion Night Light, 4-Pack", brand: "Lumio", category: "Electronics", store: "Home Depot", buy: 15.6, sell: 36.99, bsr: 6100, bsrCat: "Night Lights", monthly: 430, comp: 5, drop90: 8 },
  { asin: "B0DEMO0008", title: "Brindle & Co Wooden Stacking Puzzle Set", brand: "Brindle & Co", category: "Toys & Games", store: "Kohl's", buy: 12.0, sell: 29.99, bsr: 8800, bsrCat: "Stacking Toys", monthly: 280, comp: 4, drop90: 10 },
  { asin: "B0DEMO0009", title: "Fernhill Microfiber Cleaning Cloths, 24-Pack", brand: "Fernhill", category: "Home & Kitchen", store: "Costco", buy: 8.9, sell: 21.49, bsr: 2200, bsrCat: "Cleaning Cloths", monthly: 980, comp: 8, drop90: 18 },
  { asin: "B0DEMO0010", title: "Copperline Digital Kitchen Scale, 11lb", brand: "Copperline", category: "Home & Kitchen", store: "Walmart", buy: 10.2, sell: 23.99, bsr: 1900, bsrCat: "Kitchen Scales", monthly: 1150, comp: 9, drop90: 22 },
  { asin: "B0DEMO0011", title: "Halcyon Slow-Feed Dog Bowl, Medium", brand: "Halcyon", category: "Pet Supplies", store: "Target", buy: 7.75, sell: 19.99, bsr: 4700, bsrCat: "Dog Bowls", monthly: 500, comp: 4, drop90: 6 },
  { asin: "B0DEMO0012", title: "Mosswood Bamboo Desk Organizer with Phone Stand", brand: "Mosswood", category: "Home & Kitchen", store: "Kohl's", buy: 16.5, sell: 38.0, bsr: 15200, bsrCat: "Desk Organizers", monthly: 150, comp: 3, drop90: 12 },
  { asin: "B0DEMO0013", title: "Quillfeather Magnetic Dry-Erase Weekly Planner", brand: "Quillfeather", category: "Office Products", store: "Target", buy: 9.1, sell: 20.99, bsr: 7300, bsrCat: "Planners", monthly: 340, comp: 5, drop90: 9 },
  { asin: "B0DEMO0014", title: "Stonebridge Resistance Band Set, 5 Levels", brand: "Stonebridge", category: "Sports & Outdoors", store: "Walmart", buy: 7.0, sell: 18.99, bsr: 2900, bsrCat: "Resistance Bands", monthly: 860, comp: 11, drop90: 25 },
  { asin: "B0DEMO0015", title: "Oakmere Glass Meal Prep Containers, 10-Pack", brand: "Oakmere", category: "Home & Kitchen", store: "Costco", buy: 19.0, sell: 42.99, bsr: 5600, bsrCat: "Food Storage", monthly: 390, comp: 4, drop90: 7 },
  { asin: "B0DEMO0016", title: "Zephyra Portable Handheld Fan, USB-C", brand: "Zephyra", category: "Electronics", store: "Home Depot", buy: 8.4, sell: 19.49, bsr: 21000, bsrCat: "Personal Fans", monthly: 120, comp: 6, drop90: 31 },
];

const WEIGHTS = { ROI: 25, "Sales velocity": 20, Competition: 15, "Price stability": 15, "Amazon presence": 10, "Category health": 10, "Profit margin": 5 };

function economics(p: P) {
  const fees = p.sell * 0.15 + 3.4; // referral + FBA estimate
  const profit = p.sell - p.buy - fees;
  const roi = (profit / p.buy) * 100;
  const margin = (profit / p.sell) * 100;
  return { fees, profit, roi, margin };
}

function score(p: P) {
  const e = economics(p);
  const checks: Array<[keyof typeof WEIGHTS, boolean, string]> = [
    ["ROI", e.roi >= 30, `${e.roi.toFixed(0)}% estimated ROI (target 30%+)`],
    ["Sales velocity", p.monthly >= 30, `~${p.monthly} units/month (target 30+)`],
    ["Competition", p.comp <= 5, `${p.comp} FBA sellers on the listing (target 5 or fewer)`],
    ["Price stability", p.drop90 < 20, `${p.drop90}% price drop over 90 days (target under 20%)`],
    ["Amazon presence", true, "Amazon is not holding the Buy Box"],
    ["Category health", true, `${p.category} is open to new sellers`],
    ["Profit margin", e.margin >= 25, `${e.margin.toFixed(0)}% net margin (target 25%+)`],
  ];
  const details: Record<string, { pass: boolean; reason: string; weight: number }> = {};
  let total = 0;
  for (const [k, pass, reason] of checks) {
    details[k] = { pass, reason, weight: WEIGHTS[k] };
    if (pass) total += WEIGHTS[k];
  }
  return { total, details, ...e };
}

const SUPPLIERS = [
  { name: "Target (clearance + Circle offers)", type: "retail", category: "Home, Pet, Toys", website: "https://www.target.com", region: "US", couponsAvailable: true, avgDiscount: "20-30%", rating: 5, tags: ["clearance", "app coupons"] },
  { name: "Walmart (rollbacks)", type: "retail", category: "General", website: "https://www.walmart.com", region: "US", couponsAvailable: true, avgDiscount: "15-25%", rating: 4, tags: ["rollbacks", "online"] },
  { name: "Kohl's (Kohl's Cash)", type: "retail", category: "Home, Toys", website: "https://www.kohls.com", region: "US", couponsAvailable: true, avgDiscount: "25-40%", rating: 4, tags: ["stackable coupons"] },
  { name: "Costco (member pricing)", type: "retail", category: "Bulk household", website: "https://www.costco.com", region: "US", couponsAvailable: false, avgDiscount: "10-15%", rating: 4, tags: ["bulk", "membership"] },
  { name: "Home Depot (seasonal clearance)", type: "retail", category: "Electronics, Tools", website: "https://www.homedepot.com", region: "US", couponsAvailable: false, avgDiscount: "10-20%", rating: 3, tags: ["seasonal"] },
  { name: "Northstar Wholesale (fictional)", type: "wholesale", category: "Home & Kitchen", website: null, region: "US", couponsAvailable: false, avgDiscount: "30-45%", rating: 3, tags: ["case packs", "net-30"] },
];

const SUPPLIES = [
  ["Poly mailers 10x13 (100)", "Packaging", 240, 100, 0.09, "Packrite (fictional)"],
  ["Thermal labels 4x6 (500)", "Labels", 6, 8, 11.5, "Labelhouse (fictional)"],
  ["Packing tape, clear (6-pack)", "Packaging", 14, 6, 13.99, "Packrite (fictional)"],
  ["Bubble wrap roll 12in x 175ft", "Packaging", 3, 3, 24.0, "Packrite (fictional)"],
  ["FNSKU barcode labels 30-up (1000)", "Labels", 4, 5, 16.0, "Labelhouse (fictional)"],
  ["Bubble mailers 6x10 (50)", "Packaging", 70, 40, 0.22, "Packrite (fictional)"],
] as const;

/** Wipe every table and rebuild the fictional dataset. */
async function buildDemoDataset(): Promise<void> {
  const rand = rng(42);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];

  await db.execute(sql`TRUNCATE agent_settings, agent_runs, reports, report_products, suppliers,
    inventory_items, supplies, transactions, chat_messages RESTART IDENTITY`);

  await db.insert(agentSettings).values([
    { key: "demo_dataset", value: true as never },
    { key: "schedule", value: "0 4 * * *" as never },
  ]);

  const sup = await db.insert(suppliers).values(
    SUPPLIERS.map((s) => ({ ...s, tags: [...s.tags], notes: null, active: true })),
  ).returning();

  await db.insert(supplies).values(
    SUPPLIES.map(([name, category, qty, reorder, cost, supplier]) => ({
      name, category, quantityOnHand: qty, reorderPoint: reorder, unitCost: money(cost), supplier,
    })),
  );

  // ── Agent runs: the last five nightly cycles ──
  const runIds: number[] = [];
  const found = [8, 6, 6, 7, 5];
  for (let i = 0; i < 5; i++) {
    const start = daysAgo(i); start.setHours(4, 0, 2, 0);
    const end = new Date(start.getTime() + 17 * 60_000);
    const [r] = await db.insert(agentRuns).values({
      startedAt: start, completedAt: end, status: "completed", productsFound: found[i],
      logs: [
        `${start.toISOString()} — Research cycle started (scheduled)`,
        `${start.toISOString()} — Pulled 42 candidate ASINs from price-history screen`,
        `${start.toISOString()} — Scored candidates against criteria (ROI, velocity, competition, stability)`,
        `${end.toISOString()} — ${found[i]} products passed the 60-point threshold`,
        `${end.toISOString()} — Daily report saved`,
      ],
      createdAt: start,
    }).returning();
    runIds.push(r.id);
  }

  // ── Daily reports (today + two previous days) ──
  const plan: Array<{ day: number; status: "completed" | "reviewed"; items: number[]; summary: string }> = [
    { day: 0, status: "completed", items: [0, 1, 2, 5, 6, 10, 14, 7], summary: "8 products cleared the 60-point bar. Strongest: kitchen storage and pet toys with low seller counts and stable 90-day pricing. Skipped 3 high-velocity items where 9+ FBA sellers were already splitting the Buy Box." },
    { day: 1, status: "reviewed", items: [3, 4, 11, 12, 13, 15], summary: "6 products cleared. Two rejected for price drops over 25% in the last 90 days." },
    { day: 2, status: "reviewed", items: [8, 9, 1, 6, 10, 14], summary: "6 products cleared. Velocity is strong but competition is crowded; approved only the two with 4 or fewer sellers." },
  ];
  const productIdByAsin = new Map<string, number>();
  for (const day of plan) {
    const prods = day.items.map((i) => P[i]);
    const [rep] = await db.insert(reports).values({
      date: iso(daysAgo(day.day)), status: day.status, summary: day.summary,
      totalProductsFound: prods.length,
      approvedCount: day.status === "reviewed" ? Math.max(1, prods.length - 3) : 0,
      rejectedCount: day.status === "reviewed" ? 2 : 0,
      agentRunId: runIds[day.day], createdAt: daysAgo(day.day), updatedAt: daysAgo(day.day),
    }).returning();
    let n = 0;
    for (const p of prods) {
      const s = score(p);
      const recs = sup.filter((x) => x.name.startsWith(p.store)).concat(sup.slice(0, 1)).slice(0, 2)
        .map((x) => ({ name: x.name, website: x.website, couponsAvailable: x.couponsAvailable, avgDiscount: x.avgDiscount, type: x.type }));
      const status = day.status === "reviewed" ? (n < prods.length - 2 ? "approved" : "rejected") : "pending";
      const [row] = await db.insert(reportProducts).values({
        reportId: rep.id, asin: p.asin, title: p.title, brand: p.brand, category: p.category,
        currentPrice: money(p.sell), suggestedBuyPrice: money(p.buy), suggestedSellPrice: money(p.sell),
        estimatedProfit: money(s.profit), estimatedRoi: money(s.roi), buyBoxPrice: money(p.sell - 0.5),
        bsrRank: p.bsr, bsrCategory: p.bsrCat, monthlySalesEst: p.monthly,
        competitionLevel: p.comp <= 4 ? "Low" : p.comp <= 7 ? "Medium" : "High",
        sourceStore: p.store, sourceUrl: null, sourcePrice: money(p.buy),
        criteriaScore: s.total, criteriaDetails: s.details as never,
        aiAnalysis: `Buy at ~$${money(p.buy)} from ${p.store}, sell near $${money(p.sell)}. After roughly $${money(s.fees)} in Amazon fees that is about $${money(s.profit)} profit (${s.roi.toFixed(0)}% ROI). ${p.comp <= 4 ? "Few sellers, so Buy Box share should be easy to hold." : "Competition is moderate; watch the Buy Box after listing."} Sample data.`,
        supplierRecommendations: recs as never,
        coupons: recs.filter((r) => r.couponsAvailable).map((r) => r.name) as never,
        discountNotes: recs.some((r) => r.couponsAvailable) ? "Stack store coupons or app offers where available." : null,
        status, notes: null, createdAt: daysAgo(day.day),
      }).returning({ id: reportProducts.id });
      productIdByAsin.set(p.asin + day.day, row.id);
      n++;
    }
  }

  // ── Inventory ──
  const inv: Array<{ i: number; stock: number; amz: number; inbound: number; sold: number; status: "active" | "low_stock" | "out_of_stock" | "stranded"; buyBoxGap: number; alert?: { alertType: string; severity: "low" | "medium" | "high"; message: string; action: string } }> = [
    { i: 0, stock: 6, amz: 42, inbound: 0, sold: 118, status: "active", buyBoxGap: 0 },
    { i: 3, stock: 0, amz: 9, inbound: 36, sold: 204, status: "low_stock", buyBoxGap: 0, alert: { alertType: "low_stock", severity: "medium", message: "9 units left at ~25 units/week", action: "Inbound shipment of 36 arrives in about 5 days; reorder if sell-through holds." } },
    { i: 5, stock: 12, amz: 30, inbound: 0, sold: 96, status: "active", buyBoxGap: 0 },
    { i: 8, stock: 0, amz: 64, inbound: 0, sold: 311, status: "active", buyBoxGap: 1.2, alert: { alertType: "price_war", severity: "high", message: "Buy Box price is $1.20 below your price; 3 new FBA sellers this week", action: "Reprice to match or hold; margin still positive down to $19.80." } },
    { i: 9, stock: 4, amz: 18, inbound: 0, sold: 402, status: "active", buyBoxGap: 0 },
    { i: 10, stock: 8, amz: 26, inbound: 0, sold: 88, status: "active", buyBoxGap: 0 },
    { i: 13, stock: 20, amz: 0, inbound: 0, sold: 41, status: "stranded", buyBoxGap: 0, alert: { alertType: "stranded", severity: "high", message: "Listing is stranded: 20 units not sellable", action: "Fix the listing error in Seller Central, then re-list." } },
    { i: 14, stock: 0, amz: 15, inbound: 0, sold: 134, status: "active", buyBoxGap: 0 },
    { i: 4, stock: 0, amz: 0, inbound: 0, sold: 57, status: "out_of_stock", buyBoxGap: 0, alert: { alertType: "slow_sales", severity: "low", message: "Sold out; sold 57 units in 6 weeks at 41% ROI", action: "Strong sell-through; consider reordering." } },
    { i: 2, stock: 3, amz: 11, inbound: 0, sold: 72, status: "active", buyBoxGap: 0 },
  ];
  for (const it of inv) {
    const p = P[it.i]; const e = economics(p);
    await db.insert(inventoryItems).values({
      asin: p.asin, title: p.title, sku: `DEMO-${p.asin.slice(-4)}`, fnsku: `X00${p.asin.slice(-4)}DEMO`,
      quantityInStock: it.stock, quantityAtAmazon: it.amz, quantityInbound: it.inbound,
      buyPrice: money(p.buy), currentSellPrice: money(p.sell), buyBoxPrice: money(p.sell - it.buyBoxGap),
      status: it.status, datePurchased: iso(daysAgo(40 + it.i)), dateListed: iso(daysAgo(36 + it.i)),
      lastSaleDate: iso(daysAgo(it.status === "out_of_stock" ? 9 : 0)),
      totalSold: it.sold, totalRevenue: money(it.sold * p.sell), totalFees: money(it.sold * e.fees),
      totalProfit: money(it.sold * e.profit), alertFlags: it.alert ? ({ asin: p.asin, ...it.alert } as never) : null,
      notes: null,
    });
  }

  // ── Transactions: 150 days of invented orders, fees, shipping, purchases ──
  let order = 100200;
  const txRows: Array<typeof transactions.$inferInsert> = [];
  // 150 days with a gradual ramp-up, so the six-month charts tell a growth story
  for (let d = 149; d >= 0; d--) {
    const date = iso(daysAgo(d));
    const orders = d === 0 ? 6 : Math.max(1, Math.round(1 + ((150 - d) / 150) * 5 + rand() * 3));
    for (let k = 0; k < orders; k++) {
      const p = pick(P.slice(0, 12)); const qty = rand() < 0.2 ? 2 : 1; const id = `DEMO-${order++}`;
      const gross = p.sell * qty;
      txRows.push({ date, type: "income", category: "sales", description: `Order ${id}: ${p.title.slice(0, 40)}`, amount: money(gross), asin: p.asin, orderId: id });
      txRows.push({ date, type: "fee", category: "amazon_fee", description: `Referral + FBA fees, ${id}`, amount: money(gross * 0.15 + 3.4 * qty), asin: p.asin, orderId: id });
      txRows.push({ date, type: "expense", category: "product_purchase", description: `Cost of goods, ${id}`, amount: money(p.buy * qty), asin: p.asin, orderId: id });
    }
    if (d > 0 && d % 4 === 0) txRows.push({ date, type: "expense", category: "shipping", description: "Inbound shipping to FBA", amount: money(18 + rand() * 30) });
    if (d > 0 && d % 11 === 0) txRows.push({ date, type: "expense", category: "supplies", description: "Packaging supplies", amount: money(25 + rand() * 40) });
  }
  txRows.push({ date: iso(daysAgo(Math.min(new Date().getDate() - 1, 149))), type: "expense", category: "software", description: "Price-history subscription (sample)", amount: "19.00" });
  for (let i = 0; i < txRows.length; i += 200) await db.insert(transactions).values(txRows.slice(i, i + 200));

  // ── A sample chat so the AI Chat page isn't empty (the live chat is disabled in the demo) ──
  await db.insert(chatMessages).values([
    { sessionId: "default", role: "user", createdAt: new Date(Date.now() - 4 * 60_000), content: "Which of today's products should I look at first?" },
    { sessionId: "default", role: "assistant", createdAt: new Date(Date.now() - 3 * 60_000), content: "Start with the Aurelia cat feather wand and the Brightleaf silicone bags. Both have 3 FBA sellers, 5-6% price movement over 90 days and ROI above 100% after fees. The Halcyon dog bowl is a close third. I'd skip the Zephyra fan: its price has dropped 31% in 90 days.\n\n(Sample conversation. The live assistant is turned off in the public demo.)" },
  ]);
}

/**
 * Called on demo start. Only proceeds when the database is empty or already holds the demo
 * dataset; anything else is treated as real data and the server refuses to boot.
 */
export async function ensureDemoDatabase(): Promise<void> {
  const [row] = (await db.execute(sql`
    SELECT
      (SELECT count(*) FROM agent_settings WHERE key = 'demo_dataset')::int AS marker,
      ((SELECT count(*) FROM reports) + (SELECT count(*) FROM inventory_items) +
       (SELECT count(*) FROM transactions) + (SELECT count(*) FROM chat_messages) +
       (SELECT count(*) FROM agent_settings WHERE key LIKE 'plaid\_%'))::int AS rows
  `)).rows as Array<{ marker: number; rows: number }>;

  if (!row.marker && row.rows > 0) {
    throw new Error(
      "DEMO_MODE refused to start: this database contains data that is not the demo dataset. " +
      "Point the demo service at its own empty Postgres database.",
    );
  }
  await buildDemoDataset();
  console.log("[Demo] Fictional dataset loaded");
  // Dates are relative to now, so rebuild periodically to keep 'today' current.
  setInterval(() => buildDemoDataset().catch((e) => console.error("[Demo] refresh failed:", e)), 6 * 3600 * 1000).unref();
}
