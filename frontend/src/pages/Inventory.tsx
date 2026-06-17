import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package, Plus, RefreshCw, AlertTriangle, TrendingDown, Box,
  ExternalLink, Edit2, Trash2, DollarSign, BarChart2,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { inventoryApi, InventoryItem, Supply } from "@/lib/api";
import { formatCurrency, formatDate, cn, asinToAmazonUrl } from "@/lib/utils";

const statusColors: Record<string, string> = {
  active: "bg-accent/10 text-accent",
  low_stock: "bg-amber-400/10 text-amber-400",
  out_of_stock: "bg-red-500/10 text-red-400",
  stranded: "bg-orange-500/10 text-orange-400",
};

type Tab = "products" | "supplies";

export function Inventory() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("products");
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [repriceItem, setRepriceItem] = useState<{ id: number; current: number } | null>(null);
  const [newPrice, setNewPrice] = useState("");

  const { data: items, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: inventoryApi.list,
    refetchInterval: 60000,
  });

  const { data: stats } = useQuery({
    queryKey: ["inventory-stats"],
    queryFn: inventoryApi.getStats,
    refetchInterval: 60000,
  });

  const { data: supplies } = useQuery({
    queryKey: ["supplies"],
    queryFn: inventoryApi.getSupplies,
  });

  const syncMutation = useMutation({
    mutationFn: inventoryApi.sync,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); qc.invalidateQueries({ queryKey: ["inventory-stats"] }); },
  });

  const alertsMutation = useMutation({
    mutationFn: inventoryApi.analyzeAlerts,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });

  const removeMutation = useMutation({
    mutationFn: inventoryApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); qc.invalidateQueries({ queryKey: ["inventory-stats"] }); },
  });

  const repriceMutation = useMutation({
    mutationFn: ({ id, price }: { id: number; price: number }) => inventoryApi.reprice(id, price),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); setRepriceItem(null); },
  });

  const inventoryItems = (items as InventoryItem[]) || [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Inventory"
        subtitle="Products & packing supplies management"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => alertsMutation.mutate()}
              disabled={alertsMutation.isPending}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <BarChart2 className={cn("h-3.5 w-3.5", alertsMutation.isPending && "animate-pulse")} />
              AI Alerts
            </button>
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncMutation.isPending && "animate-spin")} />
              Sync Amazon
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Active Products", value: stats?.active || 0, icon: Package, color: "text-accent" },
            { label: "At Amazon FBA", value: stats?.totalAtAmazon || 0, icon: Box, color: "text-blue-400" },
            { label: "Low Stock", value: stats?.lowStock || 0, icon: AlertTriangle, color: "text-amber-400" },
            { label: "Total Revenue", value: formatCurrency(Number(stats?.totalRevenue || 0)), icon: DollarSign, color: "text-accent" },
            { label: "Total Profit", value: formatCurrency(Number(stats?.totalProfit || 0)), icon: TrendingDown, color: "text-emerald-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="stat-card flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="section-title">{label}</p>
                <Icon className={cn("h-4 w-4", color)} />
              </div>
              <p className="text-xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {(["products", "supplies"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors",
                tab === t
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "products" ? `Products (${inventoryItems.length})` : `Packing Supplies (${(supplies || []).length})`}
            </button>
          ))}
        </div>

        {/* Products Tab */}
        {tab === "products" && (
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
              </div>
            ) : inventoryItems.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
                <Package className="h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">No inventory items yet</p>
                <p className="text-xs text-muted-foreground/60">Add items manually or sync from Amazon FBA</p>
              </div>
            ) : (
              <>
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-3 rounded-lg bg-secondary/30 px-4 py-2 text-xs font-medium text-muted-foreground">
                  <div className="col-span-4">Product</div>
                  <div className="col-span-1 text-center">Qty</div>
                  <div className="col-span-1 text-center">FBA Qty</div>
                  <div className="col-span-1 text-right">Cost</div>
                  <div className="col-span-1 text-right">Sell Price</div>
                  <div className="col-span-1 text-right">Profit</div>
                  <div className="col-span-1 text-center">Status</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                {inventoryItems.map((item) => {
                  const profit = Number(item.totalProfit || 0);
                  const alertSeverity = (item.alertFlags as { severity?: string } | null)?.severity;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "grid grid-cols-12 gap-3 rounded-xl border px-4 py-3 items-center transition-colors",
                        alertSeverity === "high" ? "border-red-500/30 bg-red-500/5" :
                        alertSeverity === "medium" ? "border-amber-500/30 bg-amber-500/5" :
                        "border-border bg-card hover:border-border/80"
                      )}
                    >
                      <div className="col-span-4 min-w-0">
                        <div className="flex items-center gap-2">
                          {alertSeverity && (
                            <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0",
                              alertSeverity === "high" ? "text-red-400" : "text-amber-400"
                            )} />
                          )}
                          <a
                            href={item.asin ? asinToAmazonUrl(item.asin) : "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-sm font-medium text-foreground hover:text-accent"
                          >
                            {item.title || item.asin || "Unknown"}
                          </a>
                        </div>
                        <p className="mt-0.5 text-xs font-mono text-muted-foreground">{item.asin}</p>
                        {item.alertFlags && (
                          <p className="mt-0.5 text-xs text-amber-400">
                            {(item.alertFlags as { message?: string }).message}
                          </p>
                        )}
                      </div>
                      <div className="col-span-1 text-center text-sm text-foreground">{item.quantityInStock}</div>
                      <div className="col-span-1 text-center text-sm text-foreground">{item.quantityAtAmazon}</div>
                      <div className="col-span-1 text-right text-sm text-foreground">{formatCurrency(Number(item.buyPrice || 0))}</div>
                      <div className="col-span-1 text-right">
                        <button
                          onClick={() => setRepriceItem({ id: item.id, current: Number(item.currentSellPrice || 0) })}
                          className="text-sm font-medium text-foreground hover:text-accent transition-colors"
                        >
                          {formatCurrency(Number(item.currentSellPrice || 0))}
                        </button>
                      </div>
                      <div className={cn("col-span-1 text-right text-sm font-semibold", profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {formatCurrency(profit)}
                      </div>
                      <div className="col-span-1 text-center">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", statusColors[item.status] || "bg-secondary text-muted-foreground")}>
                          {item.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <a
                          href={item.asin ? asinToAmazonUrl(item.asin) : "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <button
                          onClick={() => setEditItem(item)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm("Remove this item?")) removeMutation.mutate(item.id); }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Supplies Tab */}
        {tab === "supplies" && (
          <div className="space-y-2">
            {(supplies as Supply[] || []).length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
                <Box className="h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">No supplies tracked yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {(supplies as Supply[] || []).map((s) => {
                  const low = s.quantityOnHand <= s.reorderPoint;
                  return (
                    <div key={s.id} className={cn("stat-card", low && "border-amber-500/30 bg-amber-500/5")}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{s.category}</p>
                        </div>
                        {low && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                        <div className={cn("rounded-lg py-2", low ? "bg-amber-500/10" : "bg-secondary/50")}>
                          <p className={cn("text-lg font-bold", low ? "text-amber-400" : "text-foreground")}>{s.quantityOnHand}</p>
                          <p className="text-xs text-muted-foreground">On Hand</p>
                        </div>
                        <div className="rounded-lg bg-secondary/50 py-2">
                          <p className="text-lg font-bold text-foreground">{s.reorderPoint}</p>
                          <p className="text-xs text-muted-foreground">Reorder At</p>
                        </div>
                      </div>
                      {s.unitCost && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Cost: {formatCurrency(Number(s.unitCost))}/unit
                          {s.supplier && ` · ${s.supplier}`}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reprice Modal */}
      {repriceItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-80 rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Update Listing Price</h3>
            <p className="mb-2 text-xs text-muted-foreground">
              Current price: {formatCurrency(repriceItem.current)}
            </p>
            <input
              type="number"
              step="0.01"
              defaultValue={repriceItem.current}
              onChange={(e) => setNewPrice(e.target.value)}
              className="mb-4 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              placeholder="New price"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRepriceItem(null)}
                className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => repriceMutation.mutate({ id: repriceItem.id, price: parseFloat(newPrice) })}
                disabled={!newPrice || repriceMutation.isPending}
                className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                {repriceMutation.isPending ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
