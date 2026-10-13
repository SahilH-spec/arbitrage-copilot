import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DollarSign, TrendingUp, TrendingDown, Plus, Upload,
  FileText, ArrowUpCircle, ArrowDownCircle,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { accountingApi, AccountingSummary, Transaction } from "@/lib/api";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { STATIC_DEMO, READ_ONLY_MESSAGE } from "@/lib/staticDemo";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";

type Period = "week" | "month" | "year";

const CATEGORIES = [
  "product_sale", "product_purchase", "amazon_fee", "shipping",
  "supplies", "advertising", "refund", "other",
];

const TYPE_ICONS: Record<string, React.ElementType> = {
  income: ArrowUpCircle,
  expense: ArrowDownCircle,
  fee: DollarSign,
  refund: ArrowUpCircle,
};

const TYPE_COLORS: Record<string, string> = {
  income: "text-emerald-400",
  expense: "text-red-400",
  fee: "text-amber-400",
  refund: "text-blue-400",
};

export function Accounting() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>("month");
  const [showAdd, setShowAdd] = useState(false);
  const [newTx, setNewTx] = useState({
    date: new Date().toISOString().split("T")[0],
    type: "expense",
    category: "product_purchase",
    description: "",
    amount: "",
  });

  const { data: summary, isLoading } = useQuery({
    queryKey: ["accounting-summary", period],
    queryFn: () => accountingApi.getSummary(period),
    refetchInterval: 120000,
  });

  const { data: transactions } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => accountingApi.getTransactions({ limit: "50" } as Record<string, string>),
    refetchInterval: 60000,
  });

  const addMutation = useMutation({
    mutationFn: accountingApi.addTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounting-summary"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setShowAdd(false);
      setNewTx({ date: new Date().toISOString().split("T")[0], type: "expense", category: "product_purchase", description: "", amount: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: accountingApi.deleteTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounting-summary"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const s = summary as AccountingSummary | undefined;
  const txList = (transactions as Transaction[]) || [];

  const handleImportCSV = () => {
    if (STATIC_DEMO) { alert(READ_ONLY_MESSAGE); return; }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/accounting/import-csv", { method: "POST", body: formData });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["accounting-summary"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      }
    };
    input.click();
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Accounting"
        subtitle="Profit & loss tracking"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleImportCSV}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Import CSV
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Transaction
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {/* Period selector */}
        <div className="flex gap-1 rounded-lg border border-border bg-secondary/30 p-1 w-fit">
          {(["week", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-4 py-1.5 text-xs font-medium capitalize transition-colors",
                period === p ? "bg-accent text-black" : "text-muted-foreground hover:text-foreground"
              )}
            >
              This {p}
            </button>
          ))}
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Revenue", value: s?.income || 0, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-400/10" },
            { label: "Expenses + Fees", value: s?.totalCosts || 0, icon: TrendingDown, color: "text-red-400", bg: "bg-red-400/10" },
            { label: "Net Profit", value: s?.netProfit || 0, icon: DollarSign, color: (s?.netProfit || 0) >= 0 ? "text-emerald-400" : "text-red-400", bg: (s?.netProfit || 0) >= 0 ? "bg-emerald-400/10" : "bg-red-400/10" },
            { label: "Profit Margin", value: `${(s?.profitMargin || 0).toFixed(1)}%`, icon: FileText, color: "text-accent", bg: "bg-accent/10", isText: true },
          ].map(({ label, value, icon: Icon, color, bg, isText }) => (
            <div key={label} className="stat-card flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="section-title">{label}</p>
                <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", bg)}>
                  <Icon className={cn("h-3.5 w-3.5", color)} />
                </div>
              </div>
              <p className={cn("text-2xl font-bold", color)}>
                {isText ? value : formatCurrency(Number(value))}
              </p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-4">
          {/* Monthly Revenue vs Expenses */}
          <div className="stat-card">
            <p className="section-title mb-4">Revenue vs Expenses (6 months)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={s?.monthlyData || []}>
                <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 10 }} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Profit trend */}
          <div className="stat-card">
            <p className="section-title mb-4">Net Profit Trend</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={s?.monthlyData || []}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 10 }} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" fill="url(#profitGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category breakdown */}
        {(s?.categories || []).length > 0 && (
          <div className="stat-card">
            <p className="section-title mb-3">Spending by Category</p>
            <div className="space-y-2">
              {(s?.categories || [])
                .sort((a, b) => Number(b.total) - Number(a.total))
                .slice(0, 8)
                .map((cat) => {
                  const maxVal = Math.max(...(s?.categories || []).map((c) => Number(c.total)));
                  const pct = (Number(cat.total) / maxVal) * 100;
                  return (
                    <div key={cat.category} className="flex items-center gap-3">
                      <p className="w-36 shrink-0 text-xs text-muted-foreground capitalize">
                        {(cat.category || "other").replace("_", " ")}
                      </p>
                      <div className="flex-1 rounded-full bg-secondary h-2">
                        <div
                          className="h-2 rounded-full bg-accent transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="w-20 text-right text-xs font-medium text-foreground">
                        {formatCurrency(Number(cat.total))}
                      </p>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Transactions Table */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title">Recent Transactions</p>
            <span className="text-xs text-muted-foreground">{txList.length} records</span>
          </div>
          <div className="space-y-1">
            {txList.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No transactions yet — add some or import a CSV
              </p>
            ) : (
              txList.slice(0, 20).map((tx) => {
                const Icon = TYPE_ICONS[tx.type] || DollarSign;
                const colorClass = TYPE_COLORS[tx.type] || "text-foreground";
                const amount = Number(tx.amount);
                const isIncome = tx.type === "income" || tx.type === "refund";

                return (
                  <div key={tx.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-secondary/30 transition-colors">
                    <Icon className={cn("h-4 w-4 shrink-0", colorClass)} />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm text-foreground">{tx.description || tx.category}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.date)} · {(tx.category || "").replace("_", " ")}
                        {tx.asin && ` · ${tx.asin}`}
                      </p>
                    </div>
                    <p className={cn("text-sm font-semibold tabular-nums", isIncome ? "text-emerald-400" : "text-red-400")}>
                      {isIncome ? "+" : "-"}{formatCurrency(Math.abs(amount))}
                    </p>
                    <button
                      onClick={() => { if (confirm("Delete this transaction?")) deleteMutation.mutate(tx.id); }}
                      className="text-xs text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-96 rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Add Transaction</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Date</label>
                <input type="date" value={newTx.date} onChange={(e) => setNewTx({ ...newTx, date: e.target.value })}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Type</label>
                  <select value={newTx.type} onChange={(e) => setNewTx({ ...newTx, type: e.target.value })}
                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none">
                    {["income", "expense", "fee", "refund"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Category</label>
                  <select value={newTx.category} onChange={(e) => setNewTx({ ...newTx, category: e.target.value })}
                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none">
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Description</label>
                <input type="text" value={newTx.description} onChange={(e) => setNewTx({ ...newTx, description: e.target.value })}
                  placeholder="e.g. Bought 10x Widget from Walmart"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Amount ($)</label>
                <input type="number" step="0.01" value={newTx.amount} onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button
                onClick={() => addMutation.mutate({ ...newTx, amount: newTx.amount } as Parameters<typeof accountingApi.addTransaction>[0])}
                disabled={!newTx.amount || addMutation.isPending}
                className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-black disabled:opacity-50">
                {addMutation.isPending ? "Saving..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
