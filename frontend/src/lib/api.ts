const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error || res.statusText);
  }
  return res.json();
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  get: () => request<DashboardData>("/dashboard"),
};

// ─── Agent ────────────────────────────────────────────────────────────────────
export const agentApi = {
  getStatus: () => request<AgentStatus>("/agent/status"),
  runNow: () => request<{ message: string }>("/agent/run", { method: "POST" }),
  getSettings: () => request<Record<string, unknown>>("/agent/settings"),
  updateSettings: (settings: Record<string, unknown>) =>
    request<{ message: string }>("/agent/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  getRuns: (limit = 20) => request<AgentRun[]>(`/agent/runs?limit=${limit}`),
  getRunLogs: (id: number) => request<AgentRunLogs>(`/agent/runs/${id}/logs`),
};

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportsApi = {
  list: (limit = 30) => request<Report[]>(`/reports?limit=${limit}`),
  getLatest: () => request<ReportWithProducts | null>("/reports/latest"),
  get: (id: number) => request<ReportWithProducts>(`/reports/${id}`),
  updateProduct: (reportId: number, productId: number, data: { status: string; notes?: string }) =>
    request<ReportProduct>(`/reports/${reportId}/products/${productId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  review: (id: number) => request<Report>(`/reports/${id}/review`, { method: "POST" }),
};

// ─── Inventory ────────────────────────────────────────────────────────────────
export const inventoryApi = {
  list: () => request<InventoryItem[]>("/inventory"),
  getStats: () => request<InventoryStats>("/inventory/stats"),
  add: (item: Partial<InventoryItem>) =>
    request<InventoryItem>("/inventory", { method: "POST", body: JSON.stringify(item) }),
  update: (id: number, data: Partial<InventoryItem>) =>
    request<InventoryItem>(`/inventory/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: number) => request<{ message: string }>(`/inventory/${id}`, { method: "DELETE" }),
  sync: () => request<{ message: string }>("/inventory/sync", { method: "POST" }),
  analyzeAlerts: () => request<InventoryAlert[]>("/inventory/analyze-alerts", { method: "POST" }),
  reprice: (id: number, newPrice: number) =>
    request<{ message: string }>(`/inventory/${id}/reprice`, {
      method: "POST",
      body: JSON.stringify({ newPrice }),
    }),
  getSupplies: () => request<Supply[]>("/inventory/supplies/list"),
  addSupply: (item: Partial<Supply>) =>
    request<Supply>("/inventory/supplies/list", { method: "POST", body: JSON.stringify(item) }),
  updateSupply: (id: number, data: Partial<Supply>) =>
    request<Supply>(`/inventory/supplies/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

// ─── Accounting ───────────────────────────────────────────────────────────────
export const accountingApi = {
  getTransactions: (params?: { startDate?: string; endDate?: string; type?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return request<Transaction[]>(`/accounting/transactions${q ? "?" + q : ""}`);
  },
  getSummary: (period?: "week" | "month" | "year") =>
    request<AccountingSummary>(`/accounting/summary${period ? "?period=" + period : ""}`),
  addTransaction: (tx: Partial<Transaction>) =>
    request<Transaction>("/accounting/transactions", { method: "POST", body: JSON.stringify(tx) }),
  updateTransaction: (id: number, data: Partial<Transaction>) =>
    request<Transaction>(`/accounting/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteTransaction: (id: number) =>
    request<{ message: string }>(`/accounting/transactions/${id}`, { method: "DELETE" }),
};

// ─── Chat ─────────────────────────────────────────────────────────────────────
export const chatApi = {
  getMessages: (sessionId = "default") =>
    request<ChatMessage[]>(`/chat/messages?sessionId=${sessionId}`),
  clearHistory: (sessionId = "default") =>
    request<{ message: string }>(`/chat/messages?sessionId=${sessionId}`, { method: "DELETE" }),
  // Streaming send — returns EventSource-compatible response
  sendMessage: async (
    message: string,
    sessionId = "default",
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (msg: string) => void
  ) => {
    const response = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) return onError("No response body");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split("\n\n").filter(Boolean);

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6)) as { type: string; text?: string; message?: string };
          if (data.type === "chunk" && data.text) onChunk(data.text);
          else if (data.type === "done") onDone();
          else if (data.type === "error") onError(data.message || "Unknown error");
        } catch {
          /* skip malformed lines */
        }
      }
    }
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DashboardData {
  sales: {
    today: { revenue: number; orders: number; units: number };
    thisWeek: { revenue: number; orders: number; units: number };
    thisMonth: { revenue: number; orders: number; units: number };
  };
  report: Report | null;
  recentReports: Report[];
  inventory: { activeProducts: number; totalValue: number; lowStockAlerts: number };
  accounting: { monthlyRevenue: number; monthlyExpenses: number; monthlyProfit: number; profitMargin: number };
  agent: { isRunning: boolean; currentRunId: number | null; scheduler: SchedulerStatus; lastRun: AgentRun | null };
  todos: Todo[];
  integrations: Record<string, boolean>;
}

export interface Report {
  id: number;
  date: string;
  status: string;
  summary: string | null;
  totalProductsFound: number;
  approvedCount: number;
  rejectedCount: number;
  createdAt: string;
}

export interface ReportProduct {
  id: number;
  reportId: number;
  asin: string;
  title: string | null;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  currentPrice: string | null;
  suggestedBuyPrice: string | null;
  suggestedSellPrice: string | null;
  estimatedProfit: string | null;
  estimatedRoi: string | null;
  buyBoxPrice: string | null;
  bsrRank: number | null;
  bsrCategory: string | null;
  monthlySalesEst: number | null;
  competitionLevel: string | null;
  sourceStore: string | null;
  sourceUrl: string | null;
  sourcePrice: string | null;
  criteriaScore: number | null;
  criteriaDetails: Record<string, { pass: boolean; reason: string; weight: number }> | null;
  aiAnalysis: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

export interface ReportWithProducts extends Report {
  products: ReportProduct[];
}

export interface InventoryItem {
  id: number;
  asin: string | null;
  title: string | null;
  fnsku: string | null;
  sku: string | null;
  quantityInStock: number;
  quantityAtAmazon: number;
  quantityInbound: number;
  buyPrice: string | null;
  currentSellPrice: string | null;
  buyBoxPrice: string | null;
  status: string;
  datePurchased: string | null;
  dateListed: string | null;
  lastSaleDate: string | null;
  totalSold: number;
  totalRevenue: string;
  totalFees: string;
  totalProfit: string;
  alertFlags: InventoryAlert | null;
  notes: string | null;
}

export interface InventoryStats {
  total: number;
  active: number;
  lowStock: number;
  outOfStock: number;
  totalRevenue: number;
  totalProfit: number;
  totalFees: number;
  totalAtAmazon: number;
}

export interface InventoryAlert {
  asin: string;
  alertType: string;
  severity: "low" | "medium" | "high";
  message: string;
  action: string;
}

export interface Supply {
  id: number;
  name: string;
  category: string | null;
  quantityOnHand: number;
  reorderPoint: number;
  unitCost: string | null;
  supplier: string | null;
  supplierUrl: string | null;
  notes: string | null;
}

export interface Transaction {
  id: number;
  date: string;
  type: string;
  category: string | null;
  description: string | null;
  amount: string;
  asin: string | null;
  orderId: string | null;
  notes: string | null;
}

export interface AccountingSummary {
  income: number;
  expenses: number;
  fees: number;
  refunds: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number;
  monthlyData: Array<{ month: string; revenue: number; expenses: number; profit: number }>;
  categories: Array<{ category: string | null; total: number; count: number }>;
}

export interface AgentStatus {
  isRunning: boolean;
  currentRunId: number | null;
  scheduler: SchedulerStatus;
  config: AgentConfig;
}

export interface SchedulerStatus {
  running: boolean;
  schedule: string;
  nextRun: string | null;
}

export interface AgentConfig {
  maxProducts: number;
  minRoi: number;
  minMonthlySales: number;
  minScore: number;
  categories: string[];
  maxCompetitors: number;
}

export interface AgentRun {
  id: number;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  productsFound: number;
  reportId: number | null;
  error: string | null;
  createdAt: string;
}

export interface AgentRunLogs {
  status: string;
  logs: string[];
  productsFound: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ChatMessage {
  id: number;
  role: string;
  content: string;
  createdAt: string;
}

export interface Todo {
  id: number;
  type: string;
  text: string;
  priority: string;
}
