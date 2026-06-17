import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import {
  CheckCircle, XCircle, Clock, ExternalLink, ChevronDown, ChevronUp,
  Star, TrendingUp, AlertTriangle, ShoppingCart, Filter,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { reportsApi, ReportProduct, ReportWithProducts } from "@/lib/api";
import {
  formatCurrency, formatDate, getScoreBg, getRoiColor, asinToAmazonUrl, cn,
} from "@/lib/utils";

const statusColors: Record<string, string> = {
  pending: "bg-secondary text-muted-foreground",
  approved: "bg-accent/10 text-accent",
  rejected: "bg-red-500/10 text-red-400",
  purchased: "bg-blue-500/10 text-blue-400",
};

export function Reports() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: latestReport, isLoading } = useQuery({
    queryKey: id ? ["report", id] : ["report-latest"],
    queryFn: id ? () => reportsApi.get(parseInt(id)) : reportsApi.getLatest,
  });

  const { data: reportsList } = useQuery({
    queryKey: ["reports-list"],
    queryFn: () => reportsApi.list(30),
  });

  const updateMutation = useMutation({
    mutationFn: ({ productId, status, notes }: { productId: number; status: string; notes?: string }) =>
      reportsApi.updateProduct(latestReport?.id || 0, productId, { status, notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: id ? ["report", id] : ["report-latest"] }),
  });

  const reviewMutation = useMutation({
    mutationFn: () => reportsApi.review(latestReport?.id || 0),
    onSuccess: () => qc.invalidateQueries({ queryKey: id ? ["report", id] : ["report-latest"] }),
  });

  const report = latestReport as ReportWithProducts | null;

  const filteredProducts = (report?.products || []).filter((p) => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Nightly Reports"
        subtitle="AI-generated product research results"
        actions={
          report && report.status !== "reviewed" ? (
            <button
              onClick={() => reviewMutation.mutate()}
              className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Mark Reviewed
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Reports Sidebar */}
        <div className="w-56 shrink-0 border-r border-border overflow-y-auto px-3 py-4">
          <p className="section-title mb-3 px-2">History</p>
          <div className="space-y-1">
            {(reportsList || []).map((r) => (
              <Link
                key={r.id}
                to={`/reports/${r.id}`}
                className={cn(
                  "block rounded-lg px-3 py-2 text-xs transition-colors",
                  (id ? parseInt(id) === r.id : !id && r.id === report?.id)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <div className="flex items-center justify-between">
                  <span>{formatDate(r.date)}</span>
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px]",
                    r.status === "completed" || r.status === "reviewed"
                      ? "bg-accent/10 text-accent"
                      : "bg-secondary text-muted-foreground"
                  )}>
                    {r.status}
                  </span>
                </div>
                <p className="mt-0.5 text-muted-foreground">{r.totalProductsFound} products</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Main Report Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
            </div>
          ) : !report ? (
            <div className="flex flex-1 items-center justify-center text-center">
              <div>
                <Clock className="mx-auto mb-3 h-12 w-12 text-muted-foreground/20" />
                <p className="text-muted-foreground">No reports yet</p>
                <p className="mt-1 text-sm text-muted-foreground/60">
                  Run the AI agent to generate your first product report
                </p>
                <Link
                  to="/agent"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black"
                >
                  Go to Agent
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Report Header */}
              <div className="border-b border-border bg-card/50 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      {formatDate(report.date)} Report
                    </h2>
                    {report.summary && (
                      <p className="mt-1 max-w-2xl text-xs text-muted-foreground line-clamp-2">{report.summary}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-center">
                    <div>
                      <p className="text-xl font-bold text-foreground">{report.totalProductsFound}</p>
                      <p className="text-xs text-muted-foreground">Found</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-accent">{report.approvedCount}</p>
                      <p className="text-xs text-muted-foreground">Approved</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-red-400">{report.rejectedCount}</p>
                      <p className="text-xs text-muted-foreground">Rejected</p>
                    </div>
                  </div>
                </div>

                {/* Filters */}
                <div className="mt-3 flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  {["all", "pending", "approved", "rejected"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        "rounded-full px-3 py-0.5 text-xs font-medium transition-colors capitalize",
                        filter === f
                          ? "bg-accent/10 text-accent"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Products List */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                {filteredProducts.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
                    No products in this filter
                  </div>
                ) : (
                  filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      expanded={expandedId === product.id}
                      onToggle={() => setExpandedId(expandedId === product.id ? null : product.id)}
                      onApprove={() => updateMutation.mutate({ productId: product.id, status: "approved" })}
                      onReject={() => updateMutation.mutate({ productId: product.id, status: "rejected" })}
                      isUpdating={updateMutation.isPending}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  expanded,
  onToggle,
  onApprove,
  onReject,
  isUpdating,
}: {
  product: ReportProduct;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  isUpdating: boolean;
}) {
  const roi = parseFloat(product.estimatedRoi || "0");
  const score = product.criteriaScore || 0;
  const buyPrice = parseFloat(product.suggestedBuyPrice || "0");
  const sellPrice = parseFloat(product.suggestedSellPrice || "0");
  const profit = parseFloat(product.estimatedProfit || "0");

  return (
    <div className={cn(
      "rounded-xl border bg-card transition-all",
      product.status === "approved" ? "border-accent/30" :
      product.status === "rejected" ? "border-red-500/20 opacity-60" :
      "border-border hover:border-border/80"
    )}>
      {/* Card Header */}
      <div className="flex items-center gap-4 px-4 py-3 cursor-pointer" onClick={onToggle}>
        {/* Score badge */}
        <div className={cn("flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-center", getScoreBg(score))}>
          <span className="text-sm font-bold leading-none">{score}</span>
          <span className="text-[9px] leading-none opacity-70">score</span>
        </div>

        {/* Product info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{product.title || product.asin}</p>
            <span className="shrink-0 text-xs text-muted-foreground">{product.category}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>ASIN: <span className="font-mono">{product.asin}</span></span>
            <span>Source: {product.sourceStore}</span>
            {product.bsrRank && <span>BSR: #{product.bsrRank.toLocaleString()}</span>}
          </div>
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Buy @ Source</p>
            <p className="text-sm font-semibold text-foreground">{formatCurrency(buyPrice)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Sell @ Amazon</p>
            <p className="text-sm font-semibold text-foreground">{formatCurrency(sellPrice)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Est. Profit</p>
            <p className={cn("text-sm font-bold", profit >= 0 ? "text-emerald-400" : "text-red-400")}>
              {formatCurrency(profit)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">ROI</p>
            <p className={cn("text-sm font-bold", getRoiColor(roi))}>
              {roi.toFixed(1)}%
            </p>
          </div>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", statusColors[product.status] || statusColors.pending)}>
            {product.status}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {/* AI Analysis */}
          {product.aiAnalysis && (
            <div className="rounded-lg bg-accent/5 border border-accent/20 px-4 py-3">
              <p className="mb-1 text-xs font-semibold text-accent">AI Analysis</p>
              <p className="text-sm text-foreground/90">{product.aiAnalysis}</p>
            </div>
          )}

          {/* Criteria */}
          {product.criteriaDetails && Object.keys(product.criteriaDetails).length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Criteria Check</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(product.criteriaDetails).map(([key, val]) => (
                  <div key={key} className="flex items-start gap-2 rounded-lg bg-secondary/40 px-3 py-2">
                    {val.pass ? (
                      <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                    )}
                    <div>
                      <p className="text-xs font-medium text-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</p>
                      <p className="text-xs text-muted-foreground">{val.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* More stats */}
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="rounded-lg bg-secondary/50 py-2 px-3">
              <p className="text-xs text-muted-foreground">Monthly Sales</p>
              <p className="text-sm font-semibold text-foreground">{product.monthlySalesEst || "N/A"}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 py-2 px-3">
              <p className="text-xs text-muted-foreground">Competition</p>
              <p className={cn("text-sm font-semibold capitalize",
                product.competitionLevel === "low" ? "text-emerald-400" :
                product.competitionLevel === "medium" ? "text-amber-400" : "text-red-400"
              )}>
                {product.competitionLevel || "N/A"}
              </p>
            </div>
            <div className="rounded-lg bg-secondary/50 py-2 px-3">
              <p className="text-xs text-muted-foreground">Buy Box</p>
              <p className="text-sm font-semibold text-foreground">
                {product.buyBoxPrice ? formatCurrency(parseFloat(product.buyBoxPrice)) : "N/A"}
              </p>
            </div>
            <div className="rounded-lg bg-secondary/50 py-2 px-3">
              <p className="text-xs text-muted-foreground">BSR Rank</p>
              <p className="text-sm font-semibold text-foreground">
                {product.bsrRank ? `#${product.bsrRank.toLocaleString()}` : "N/A"}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <a
              href={asinToAmazonUrl(product.asin)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Amazon Listing
            </a>
            {product.sourceUrl && (
              <a
                href={product.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Source Store
              </a>
            )}
            <div className="ml-auto flex items-center gap-2">
              {product.status !== "rejected" && (
                <button
                  onClick={onReject}
                  disabled={isUpdating}
                  className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </button>
              )}
              {product.status !== "approved" && (
                <button
                  onClick={onApprove}
                  disabled={isUpdating}
                  className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Approve & Buy
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
