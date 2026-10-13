const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "same-origin",
    ...init,
  });
  // Session expired or never logged in: let the app show the login screen
  if (res.status === 401 && !path.startsWith("/auth/")) {
    window.dispatchEvent(new Event("auth:expired"));
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error || res.statusText);
  }
  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthState {
  demo: boolean;
  authRequired: boolean;
  authenticated: boolean;
}
export const authApi = {
  me: () => request<AuthState>("/auth/me"),
  login: (password: string) =>
    request<{ authenticated: boolean }>("/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request<{ authenticated: boolean }>("/auth/logout", { method: "POST" }),
};

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

// ─── Suppliers ────────────────────────────────────────────────────────────────
export const suppliersApi = {
  list: () => request<Supplier[]>("/suppliers"),
  add: (item: Partial<Supplier>) =>
    request<Supplier>("/suppliers", { method: "POST", body: JSON.stringify(item) }),
  update: (id: number, data: Partial<Supplier>) =>
    request<Supplier>(`/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: number) => request<{ message: string }>(`/suppliers/${id}`, { method: "DELETE" }),
};

// ─── Bank (Plaid) ─────────────────────────────────────────────────────────────
export const bankApi = {
  getStatus: () => request<{ configured: boolean; connected: boolean }>("/bank/status"),
  createLinkToken: () => request<{ linkToken: string }>("/bank/link-token", { method: "POST" }),
  exchange: (publicToken: string) =>
    request<{ message: string }>("/bank/exchange", { method: "POST", body: JSON.stringify({ publicToken }) }),
  getAccounts: () => request<{ accounts: BankAccount[] }>("/bank/accounts"),
  sync: () => request<{ message: string; added: number }>("/bank/sync", { method: "POST" }),
  disconnect: () => request<{ message: string }>("/bank/disconnect", { method: "POST" }),
};

export interface BankAccount {
  id: string;
  name: string;
  officialName: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
  available: number | null;
  current: number | null;
  currency: string | null;
}

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

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: response.statusText }));
      return onError((body as { error?: string }).error || response.statusText);
    }

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
    hourly: Array<{ time: string; revenue: number }>;
  };
  report: Report | null;
  recentReports: Report[];
  inventory: {
    activeProducts: number;
    totalValue: number;
    lowStockAlerts: number;
    totalAtAmazon: number;
    buyBoxPct: number | null;
  };
  accounting: {
    monthlyRevenue: number;
    cogs: number;
    amazonFees: number;
    shipping: number;
    otherExpenses: number;
    monthlyProfit: number;
    profitMargin: number;
    profitToday: number;
  };
  agent: {
    isRunning: boolean;
    currentRunId: number | null;
    scheduler: SchedulerStatus;
    lastRun: AgentRun | null;
    activity: Array<{ time: string; event: string; type: string }>;
    update: string;
  };
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
  supplierRecommendations: Array<{ name: string; website: string | null; couponsAvailable: boolean; avgDiscount: string | null; type: string | null }> | null;
  coupons: string[] | null;
  discountNotes: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

export interface Supplier {
  id: number;
  name: string;
  type: string | null;
  category: string | null;
  website: string | null;
  region: string | null;
  couponsAvailable: boolean;
  avgDiscount: string | null;
  rating: number | null;
  tags: string[] | null;
  notes: string | null;
  active: boolean;
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
  priority: string;
  task: string;
  done: boolean;
}
