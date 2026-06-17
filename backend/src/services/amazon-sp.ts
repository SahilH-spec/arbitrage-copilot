import { config } from "../config";

const SP_API_BASE = "https://sellingpartnerapi-na.amazon.com";
let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry - 60000) {
    return accessToken;
  }

  if (!config.amazon.refreshToken) {
    throw new Error("Amazon SP-API not configured — add credentials to .env");
  }

  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.amazon.refreshToken,
      client_id: config.amazon.appId,
      client_secret: config.amazon.clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Amazon auth failed: ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  accessToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;
  return accessToken;
}

async function spRequest(path: string, params?: Record<string, string>): Promise<unknown> {
  const token = await getAccessToken();
  const url = new URL(`${SP_API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-amz-access-token": token,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SP-API ${path} failed: ${response.status} — ${body}`);
  }

  return response.json();
}

// ─── Orders ───────────────────────────────────────────────────────────────────
export interface SpOrder {
  orderId: string;
  status: string;
  purchaseDate: string;
  orderTotal: { amount: string; currencyCode: string };
  numberOfItemsShipped: number;
}

export async function getRecentOrders(days = 7): Promise<SpOrder[]> {
  if (!config.amazon.refreshToken) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const data = await spRequest("/orders/v0/orders", {
    MarketplaceIds: config.amazon.marketplaceId,
    CreatedAfter: cutoff.toISOString(),
  });

  const orders = (data as { payload: { Orders: Array<{
    AmazonOrderId: string;
    OrderStatus: string;
    PurchaseDate: string;
    OrderTotal?: { Amount: string; CurrencyCode: string };
    NumberOfItemsShipped: number;
  }> } }).payload?.Orders || [];

  return orders.map((o) => ({
    orderId: o.AmazonOrderId,
    status: o.OrderStatus,
    purchaseDate: o.PurchaseDate,
    orderTotal: {
      amount: o.OrderTotal?.Amount || "0",
      currencyCode: o.OrderTotal?.CurrencyCode || "USD",
    },
    numberOfItemsShipped: o.NumberOfItemsShipped,
  }));
}

// ─── Inventory ────────────────────────────────────────────────────────────────
export interface SpInventoryItem {
  asin: string;
  fnsku: string;
  sellerSku: string;
  totalQuantity: number;
  fulfillableQuantity: number;
  inboundReceivingQuantity: number;
}

export async function getFbaInventory(): Promise<SpInventoryItem[]> {
  if (!config.amazon.refreshToken) return [];

  const data = await spRequest("/fba/inventory/v1/summaries", {
    granularityType: "Marketplace",
    granularityId: config.amazon.marketplaceId,
    marketplaceIds: config.amazon.marketplaceId,
  });

  const summaries = (data as { payload: { inventorySummaries: Array<{
    asin: string;
    fnsku: string;
    sellerSku: string;
    totalQuantity: number;
    fulfillableQuantity: number;
    inboundReceivingQuantity: number;
  }> } }).payload?.inventorySummaries || [];

  return summaries.map((s) => ({
    asin: s.asin,
    fnsku: s.fnsku,
    sellerSku: s.sellerSku,
    totalQuantity: s.totalQuantity || 0,
    fulfillableQuantity: s.fulfillableQuantity || 0,
    inboundReceivingQuantity: s.inboundReceivingQuantity || 0,
  }));
}

// ─── Sales Stats ──────────────────────────────────────────────────────────────
export interface SalesSummary {
  orderedProductSales: number;
  orderedProductSalesB2B: number;
  orderedUnits: number;
  orderedUnitsB2B: number;
}

export async function getSalesStats(startDate: Date, endDate: Date): Promise<SalesSummary | null> {
  if (!config.amazon.refreshToken) return null;

  try {
    const data = await spRequest("/sales/v1/orderMetrics", {
      marketplaceIds: config.amazon.marketplaceId,
      interval: `${startDate.toISOString()}--${endDate.toISOString()}`,
      granularity: "Total",
    });

    const payload = (data as { payload: Array<{
      orderedProductSales?: { amount: number };
      orderedProductSalesB2B?: { amount: number };
      unitCount?: number;
    }> }).payload?.[0];

    return {
      orderedProductSales: payload?.orderedProductSales?.amount || 0,
      orderedProductSalesB2B: payload?.orderedProductSalesB2B?.amount || 0,
      orderedUnits: payload?.unitCount || 0,
      orderedUnitsB2B: 0,
    };
  } catch {
    return null;
  }
}

// ─── Buy Box Price (Catalog) ──────────────────────────────────────────────────
export async function updateListingPrice(
  sku: string,
  newPrice: number
): Promise<boolean> {
  if (!config.amazon.refreshToken) return false;

  const token = await getAccessToken();
  const response = await fetch(
    `${SP_API_BASE}/listings/2021-08-01/items/${config.amazon.sellerId}/${sku}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-amz-access-token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productType: "PRODUCT",
        patches: [
          {
            op: "replace",
            path: "/attributes/purchasable_offer",
            value: [
              {
                marketplace_id: config.amazon.marketplaceId,
                currency: "USD",
                our_price: [{ schedule: [{ value_with_tax: newPrice }] }],
              },
            ],
          },
        ],
      }),
    }
  );

  return response.ok;
}

// ─── Mock data fallback (when Amazon not configured) ─────────────────────────
export function getMockSalesData() {
  return {
    today: { revenue: 847.5, orders: 12, units: 18 },
    thisWeek: { revenue: 4230.0, orders: 67, units: 102 },
    thisMonth: { revenue: 18940.0, orders: 289, units: 441 },
    lastMonth: { revenue: 16720.0, orders: 251, units: 389 },
  };
}
