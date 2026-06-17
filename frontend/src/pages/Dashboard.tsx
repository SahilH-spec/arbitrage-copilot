import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, Package, DollarSign, Bot, FileText,
  CheckCircle, Clock, AlertTriangle, ArrowRight, Activity, Zap,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { dashboardApi, DashboardData } from "@/lib/api";
import { formatCurrency, formatNumber, getScoreBg, formatRelativeTime, cronToHuman } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export function Dashboard() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardApi.get,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const d = data as DashboardData;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Dashboard"
        subtitle={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        onRefresh={() => refetch()}
        isRefreshing={isRefetching}
        isConnected={true}
      />

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Integration warnings */}
        {d && !d.integrations?.anthropic && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-sm text-amber-400">
              Anthropic API key not set — AI features disabled. Add{" "}
              <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> to your .env file.
            </p>
          </div>
        )}

        {/* ── Sales KPIs ── */}
        <section>
          <p className="section-title mb-3">Live Sales</p>
          <div className="grid grid-cols-4 gap-3">
            <StatCard
              label="Today's Revenue"
              value={formatCurrency(d?.sales?.today?.revenue || 0)}
              sub={`${d?.sales?.today?.orders || 0} orders`}
              icon={DollarSign}
              positive={true}
            />
            <StatCard
              label="This Week"
              value={formatCurrency(d?.sales?.thisWeek?.revenue || 0)}
              sub={`${d?.sales?.thisWeek?.units || 0} units`}
              icon={TrendingUp}
              positive={true}
            />
            <StatCard
              label="This Month"
              value={formatCurrency(d?.sales?.thisMonth?.revenue || 0)}
              sub={`${d?.sales?.thisMonth?.orders || 0} orders`}
              icon={Activity}
              positive={true}
            />
            <StatCard
              label="Monthly Profit"
              value={formatCurrency(d?.accounting?.monthlyProfit || 0)}
              sub={`${(d?.accounting?.profitMargin || 0).toFixed(1)}% margin`}
              icon={d?.accounting?.monthlyProfit >= 0 ? TrendingUp : TrendingDown}
              positive={(d?.accounting?.monthlyProfit || 0) >= 0}
            />
          </div>
        </section>

        {/* ── Main Content Row ── */}
        <div className="grid grid-cols-3 gap-4">
          {/* Agent Status */}
          <div className="stat-card col-span-1 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="section-title">AI Agent</p>
              <Link to="/agent" className="text-xs text-accent hover:underline">
                Manage →
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                d?.agent?.isRunning ? "bg-accent/10" : "bg-secondary"
              )}>
                <Bot className={cn(
                  "h-5 w-5",
                  d?.agent?.isRunning ? "text-accent animate-pulse-glow" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="font-medium text-sm text-foreground">
                  {d?.agent?.isRunning ? "Running research..." : "Idle"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {d?.agent?.scheduler?.schedule
                    ? cronToHuman(d.agent.scheduler.schedule)
                    : "Not scheduled"}
                </p>
              </div>
            </div>

            {d?.agent?.lastRun && (
              <div className="rounded-lg bg-secondary/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">Last run</p>
                <p className="text-sm font-medium text-foreground">
                  {d.agent.lastRun.productsFound} products found
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatRelativeTime(d.agent.lastRun.createdAt)}
                </p>
              </div>
            )}

            <Link
              to="/agent"
              className="flex items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/5 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
            >
              <Zap className="h-3.5 w-3.5" />
              Run Now
            </Link>
          </div>

          {/* Today's Report */}
          <div className="stat-card col-span-1 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="section-title">Today's Report</p>
              <Link to="/reports" className="text-xs text-accent hover:underline">View all →</Link>
            </div>

            {d?.report ? (
              <>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    d.report.status === "completed" ? "bg-accent/10 text-accent" :
                    d.report.status === "generating" ? "bg-amber-400/10 text-amber-400" :
                    "bg-secondary text-muted-foreground"
                  )}>
                    {d.report.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-secondary/50 py-2">
                    <p className="text-lg font-bold text-foreground">{d.report.totalProductsFound}</p>
                    <p className="text-xs text-muted-foreground">Found</p>
                  </div>
                  <div className="rounded-lg bg-accent/5 py-2">
                    <p className="text-lg font-bold text-accent">{d.report.approvedCount}</p>
                    <p className="text-xs text-muted-foreground">Approved</p>
                  </div>
                  <div className="rounded-lg bg-red-500/5 py-2">
                    <p className="text-lg font-bold text-red-400">{d.report.rejectedCount}</p>
                    <p className="text-xs text-muted-foreground">Rejected</p>
                  </div>
                </div>
                {d.report.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-3">{d.report.summary}</p>
                )}
                <Link
                  to="/reports"
                  className="flex items-center justify-center gap-2 rounded-lg border border-border py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Review Products
                </Link>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
                <FileText className="mb-2 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No report today</p>
                <p className="text-xs text-muted-foreground/60">Run the agent to generate one</p>
              </div>
            )}
          </div>

          {/* Inventory Summary */}
          <div className="stat-card col-span-1 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="section-title">Inventory</p>
              <Link to="/inventory" className="text-xs text-accent hover:underline">Manage →</Link>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">Active Products</span>
                </div>
                <span className="font-semibold text-foreground">{d?.inventory?.activeProducts || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Value</span>
                <span className="font-semibold text-foreground">{formatCurrency(d?.inventory?.totalValue || 0)}</span>
              </div>
              {(d?.inventory?.lowStockAlerts || 0) > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-xs text-amber-400">
                    {d.inventory.lowStockAlerts} low stock alert{d.inventory.lowStockAlerts !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-auto">
              <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                <span className="text-xs text-muted-foreground">Monthly P&L</span>
                <span className={cn(
                  "text-sm font-semibold",
                  (d?.accounting?.monthlyProfit || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {formatCurrency(d?.accounting?.monthlyProfit || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── AI To-Do List ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="section-title">AI-Generated To-Dos</p>
            <span className="text-xs text-muted-foreground">{d?.todos?.length || 0} items</span>
          </div>
          <div className="space-y-2">
            {(d?.todos || []).length === 0 ? (
              <div className="stat-card flex items-center justify-center py-8 text-center">
                <div>
                  <CheckCircle className="mx-auto mb-2 h-8 w-8 text-accent/30" />
                  <p className="text-sm text-muted-foreground">All caught up!</p>
                </div>
              </div>
            ) : (
              (d?.todos || []).map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-accent/20"
                >
                  <div className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    todo.priority === "high" ? "bg-red-400" :
                    todo.priority === "medium" ? "bg-amber-400" : "bg-accent"
                  )} />
                  <p className="flex-1 text-sm text-foreground">{todo.text}</p>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Recent Reports ── */}
        {(d?.recentReports || []).length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="section-title">Recent Reports</p>
              <Link to="/reports" className="text-xs text-accent hover:underline">View all</Link>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(d?.recentReports || []).slice(0, 4).map((report) => (
                <Link
                  key={report.id}
                  to={`/reports/${report.id}`}
                  className="stat-card flex flex-col gap-2 hover:border-accent/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{report.date}</span>
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      report.status === "completed" || report.status === "reviewed"
                        ? "bg-accent/10 text-accent"
                        : "bg-secondary text-muted-foreground"
                    )}>
                      {report.status}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-foreground">{report.totalProductsFound}</p>
                  <p className="text-xs text-muted-foreground">products found</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  positive,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  positive: boolean;
}) {
  return (
    <div className="stat-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="section-title">{label}</p>
        <div className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg",
          positive ? "bg-accent/10" : "bg-red-500/10"
        )}>
          <Icon className={cn("h-3.5 w-3.5", positive ? "text-accent" : "text-red-400")} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}
