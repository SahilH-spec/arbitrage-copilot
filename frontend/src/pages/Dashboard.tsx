import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DollarSign, TrendingUp, Package, BarChart2, RefreshCw,
  ChevronRight, CheckCircle2, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { dashboardApi, inventoryApi, agentApi, DashboardData, InventoryItem } from "@/lib/api";
import { formatCurrency, asinToAmazonUrl } from "@/lib/utils";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function StatCard({
  label, value, sub, icon: Icon, color = "var(--muted-foreground)", trend, trendLabel,
}: {
  label: string; value: string; sub?: string; icon: typeof DollarSign;
  color?: string; trend?: "up" | "down"; trendLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between">
        <span className="section-title">{label}</span>
        <div className="rounded p-1.5" style={{ background: "var(--accent)" }}>
          <Icon size={13} style={{ color }} />
        </div>
      </div>
      <div>
        <div className="mono" style={{ fontSize: 24, fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.02em" }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{sub}</div>}
      </div>
      {trendLabel && (
        <div className="flex items-center gap-1">
          {trend === "up" ? <ArrowUpRight size={12} style={{ color: "var(--profit)" }} /> : <ArrowDownRight size={12} style={{ color: "var(--loss)" }} />}
          <span style={{ fontSize: 11, color: trend === "up" ? "var(--profit)" : "var(--loss)" }}>{trendLabel}</span>
        </div>
      )}
    </div>
  );
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="rounded p-2.5" style={{ background: "var(--popover)", border: "1px solid var(--border)", fontSize: 12 }}>
        <p style={{ color: "var(--muted-foreground)", marginBottom: 4 }}>{label}</p>
        <p style={{ color: "var(--profit)" }}>{formatCurrency(payload[0]?.value || 0)}</p>
      </div>
    );
  }
  return null;
};

export function Dashboard() {
  const qc = useQueryClient();
  const [checkedTodos, setCheckedTodos] = useState<number[]>([]);

  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.get, refetchInterval: 60000 });
  const { data: inventory } = useQuery({ queryKey: ["inventory"], queryFn: inventoryApi.list });

  const syncMutation = useMutation({
    mutationFn: agentApi.runNow,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["agent-status"] });
    },
  });

  const toggleTodo = (id: number) =>
    setCheckedTodos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2" style={{ borderColor: "var(--border)", borderTopColor: "var(--profit)" }} />
      </div>
    );
  }

  const d = data as DashboardData;
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const todos = d?.todos || [];
  const activity = d?.agent?.activity || [];
  const feedItems = ((inventory as InventoryItem[]) || []).filter((i) => i.status === "active").slice(0, 6);
  const acct = d?.accounting;
  const hourly = d?.sales?.hourly?.length ? d.sales.hourly : [];

  return (
    <div className="flex min-h-full flex-col gap-5 p-6" style={{ color: "var(--foreground)" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>{greeting()}.</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
            {dateStr} · {d?.agent?.update || "Agent idle"}
          </p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending || d?.agent?.isRunning}
          className="flex items-center gap-2 rounded px-3 py-1.5 transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: "var(--accent)", border: "1px solid var(--border)", fontSize: 12, color: "var(--foreground)" }}
        >
          <RefreshCw size={12} className={syncMutation.isPending || d?.agent?.isRunning ? "animate-spin" : ""} />
          {d?.agent?.isRunning ? "Syncing..." : "Sync Now"}
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <StatCard label="Today's Revenue" value={formatCurrency(d?.sales?.today?.revenue || 0)} sub={`${d?.sales?.today?.orders || 0} orders`} icon={DollarSign} color="var(--profit)" />
        <StatCard label="Profit Today" value={formatCurrency(acct?.profitToday || 0)} sub="net today" icon={TrendingUp} color="var(--profit)" />
        <StatCard label="Active Listings" value={String(d?.inventory?.activeProducts || 0)} sub={`${d?.inventory?.totalAtAmazon || 0} units at FBA`} icon={Package} color="var(--agent)" />
        <StatCard label="Buy Box %" value={d?.inventory?.buyBoxPct != null ? `${d.inventory.buyBoxPct.toFixed(1)}%` : "—"} sub={`${d?.inventory?.activeProducts || 0} SKUs`} icon={BarChart2} color="var(--warning)" />
      </div>

      {/* Chart + Agent Activity */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 380px" }}>
        <div className="rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 500 }}>Revenue Today</h3>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Hourly breakdown</p>
            </div>
            <span className="mono" style={{ fontSize: 20, fontWeight: 600, color: "var(--profit)" }}>{formatCurrency(d?.sales?.today?.revenue || 0)}</span>
          </div>
          {hourly.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={hourly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="var(--profit)" strokeWidth={1.5} fill="var(--profit)" fillOpacity={0.1} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center" style={{ height: 160, fontSize: 12, color: "var(--muted-foreground)" }}>
              No sales recorded yet today
            </div>
          )}
        </div>

        {/* Agent Activity */}
        <div className="flex flex-col rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="mb-3 flex items-center justify-between">
            <h3 style={{ fontSize: 13, fontWeight: 500 }}>Agent Activity</h3>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full" style={{ width: 6, height: 6, background: d?.agent?.isRunning ? "var(--profit)" : "var(--muted-foreground)", boxShadow: d?.agent?.isRunning ? "0 0 5px var(--profit)" : "none", display: "inline-block" }} />
              <span style={{ fontSize: 10, color: d?.agent?.isRunning ? "var(--profit)" : "var(--muted-foreground)", fontWeight: 500 }}>{d?.agent?.isRunning ? "LIVE" : "IDLE"}</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto" style={{ maxHeight: 200 }}>
            {activity.length === 0 ? (
              <p style={{ fontSize: 11, color: "var(--muted-foreground)" }}>No agent activity yet. Click Sync Now to run a research cycle.</p>
            ) : (
              activity.map((entry, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="mt-1 flex-shrink-0 rounded-full" style={{ width: 6, height: 6, background: entry.type === "success" ? "var(--profit)" : entry.type === "warning" ? "var(--warning)" : "var(--agent)" }} />
                  <div>
                    <p style={{ fontSize: 11, color: "var(--foreground)", lineHeight: 1.5 }}>{entry.event}</p>
                    <p className="mono" style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{entry.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Live Sales Feed + Agenda */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 340px" }}>
        {/* Feed */}
        <div className="rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: 13, fontWeight: 500 }}>Live Sales Feed</h3>
            <a href="/inventory" className="flex items-center gap-1" style={{ fontSize: 11, color: "var(--agent)" }}>View all <ChevronRight size={11} /></a>
          </div>
          {feedItems.length === 0 ? (
            <div className="flex items-center justify-center px-4 py-10" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              No active listings yet — sync inventory or approve products from a report
            </div>
          ) : (
            feedItems.map((item, i) => {
              const sell = Number(item.currentSellPrice || 0);
              const buy = Number(item.buyPrice || 0);
              const margin = sell - buy;
              const hasBuyBox = item.buyBoxPrice && sell <= Number(item.buyBoxPrice);
              return (
                <a
                  key={item.id}
                  href={item.asin ? asinToAmazonUrl(item.asin) : "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ borderBottom: i < feedItems.length - 1 ? "1px solid var(--border)" : "none" }}
                >
                  <div className="flex flex-shrink-0 items-center justify-center rounded" style={{ width: 32, height: 32, background: "var(--accent)" }}>
                    <Package size={14} style={{ color: "var(--muted-foreground)" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title || item.asin}</p>
                    <p className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{item.asin} · qty {item.quantityAtAmazon}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{formatCurrency(sell)}</p>
                    <p className="mono" style={{ fontSize: 11, color: margin >= 0 ? "var(--profit)" : "var(--loss)" }}>{margin >= 0 ? "+" : ""}{formatCurrency(margin)}</p>
                  </div>
                  <span className="flex-shrink-0 rounded px-1.5 py-0.5" style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: hasBuyBox ? "var(--profit-muted)" : "var(--warning-muted)", color: hasBuyBox ? "var(--profit)" : "var(--warning)" }}>
                    {hasBuyBox ? "buy box" : "watch"}
                  </span>
                </a>
              );
            })
          )}
        </div>

        {/* Agenda */}
        <div className="rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: 13, fontWeight: 500 }}>Today's Agenda</h3>
            <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{checkedTodos.length}/{todos.length} done</span>
          </div>
          <div className="flex flex-col">
            {todos.length === 0 ? (
              <div className="flex items-center justify-center px-4 py-10" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>All caught up</div>
            ) : (
              todos.map((todo, i) => {
                const checked = checkedTodos.includes(todo.id);
                return (
                  <div
                    key={todo.id}
                    className="flex cursor-pointer items-start gap-3 px-4 py-2.5"
                    style={{ borderBottom: i < todos.length - 1 ? "1px solid var(--border)" : "none" }}
                    onClick={() => toggleTodo(todo.id)}
                  >
                    <div className="mt-0.5 flex flex-shrink-0 items-center justify-center rounded" style={{ width: 15, height: 15, border: checked ? "none" : "1px solid var(--border)", background: checked ? "var(--profit)" : "transparent" }}>
                      {checked && <CheckCircle2 size={10} style={{ color: "#000" }} />}
                    </div>
                    <div>
                      <p style={{ fontSize: 11.5, lineHeight: 1.5, textDecoration: checked ? "line-through" : "none", color: checked ? "var(--muted-foreground)" : "var(--foreground)" }}>{todo.task}</p>
                      <span className="mt-1 inline-block rounded px-1.5 py-0.5" style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: todo.priority === "high" ? "var(--loss-muted)" : todo.priority === "medium" ? "var(--warning-muted)" : "var(--accent)", color: todo.priority === "high" ? "var(--loss)" : todo.priority === "medium" ? "var(--warning)" : "var(--muted-foreground)" }}>{todo.priority}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Monthly Accounting Bar */}
      <div className="rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="mb-3 flex items-center gap-2">
          <h3 style={{ fontSize: 13, fontWeight: 500 }}>This Month — Accounting</h3>
          <span style={{ fontSize: 10, color: "var(--muted-foreground)", background: "var(--accent)", padding: "2px 6px", borderRadius: 4 }}>
            {new Date().toLocaleDateString("en-US", { month: "long" })} MTD
          </span>
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
          {[
            { label: "Revenue", value: acct?.monthlyRevenue || 0, color: "var(--foreground)" },
            { label: "COGS", value: acct?.cogs || 0, color: "var(--loss)" },
            { label: "Amazon Fees", value: acct?.amazonFees || 0, color: "var(--loss)" },
            { label: "Shipping", value: acct?.shipping || 0, color: "var(--loss)" },
            { label: "Net Profit", value: acct?.monthlyProfit || 0, color: "var(--profit)" },
          ].map((item) => (
            <div key={item.label}>
              <p style={{ fontSize: 10, color: "var(--muted-foreground)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>{item.label}</p>
              <p className="mono" style={{ fontSize: 18, fontWeight: 600, color: item.color }}>{formatCurrency(item.value)}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 overflow-hidden rounded" style={{ height: 5, background: "var(--accent)" }}>
          <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, acct?.profitMargin || 0))}%`, background: "var(--profit)", borderRadius: 4 }} />
        </div>
        <p style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>
          {(acct?.profitMargin || 0).toFixed(1)}% net margin · {formatCurrency(acct?.monthlyProfit || 0)} profit on {formatCurrency(acct?.monthlyRevenue || 0)} revenue
        </p>
      </div>
    </div>
  );
}
