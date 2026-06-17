import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Truck, Plus, ExternalLink, Star, Tag, Trash2, Globe, Store, Boxes } from "lucide-react";
import { suppliersApi, Supplier } from "@/lib/api";

const TYPE_META: Record<string, { label: string; icon: typeof Store; color: string }> = {
  retail: { label: "Retail", icon: Store, color: "var(--agent)" },
  online: { label: "Online", icon: Globe, color: "var(--profit)" },
  wholesale: { label: "Wholesale", icon: Boxes, color: "var(--warning)" },
  distributor: { label: "Distributor", icon: Truck, color: "var(--loss)" },
};

export function Suppliers() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", type: "retail", category: "", website: "", couponsAvailable: false, avgDiscount: "", rating: 4 });

  const { data: suppliers, isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: suppliersApi.list });

  const addMutation = useMutation({
    mutationFn: suppliersApi.add,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); setShowAdd(false); setForm({ name: "", type: "retail", category: "", website: "", couponsAvailable: false, avgDiscount: "", rating: 4 }); },
  });
  const removeMutation = useMutation({
    mutationFn: suppliersApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });

  const list = (suppliers as Supplier[]) || [];
  const filtered = filter === "all" ? list : list.filter((s) => s.type === filter);
  const withCoupons = list.filter((s) => s.couponsAvailable).length;

  return (
    <div className="flex min-h-full flex-col gap-5 p-6" style={{ color: "var(--foreground)" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>Suppliers</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
            {list.length} sourcing sources · {withCoupons} with coupons/discounts available
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded px-3 py-1.5" style={{ background: "var(--profit)", color: "#000", fontSize: 12, fontWeight: 600 }}>
          <Plus size={13} /> Add Supplier
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {["all", "retail", "online", "wholesale", "distributor"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="rounded-full px-3 py-1 capitalize"
            style={{
              fontSize: 12,
              background: filter === f ? "var(--profit-muted)" : "var(--card)",
              color: filter === f ? "var(--profit)" : "var(--muted-foreground)",
              border: "1px solid var(--border)",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: "var(--border)", borderTopColor: "var(--profit)" }} />
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {filtered.map((s) => {
            const meta = TYPE_META[s.type || "retail"] || TYPE_META.retail;
            const Icon = meta.icon;
            return (
              <div key={s.id} className="flex flex-col gap-3 rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center rounded" style={{ width: 32, height: 32, background: "var(--accent)" }}>
                      <Icon size={15} style={{ color: meta.color }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</p>
                      <p style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{s.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={10} style={{ color: i < (s.rating || 0) ? "var(--warning)" : "var(--border)", fill: i < (s.rating || 0) ? "var(--warning)" : "transparent" }} />
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  <span className="rounded px-1.5 py-0.5" style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--accent)", color: meta.color }}>{meta.label}</span>
                  {s.couponsAvailable && (
                    <span className="flex items-center gap-1 rounded px-1.5 py-0.5" style={{ fontSize: 9, fontWeight: 600, background: "var(--profit-muted)", color: "var(--profit)" }}>
                      <Tag size={9} /> COUPONS
                    </span>
                  )}
                  {s.avgDiscount && (
                    <span className="rounded px-1.5 py-0.5" style={{ fontSize: 9, fontWeight: 600, background: "var(--warning-muted)", color: "var(--warning)" }}>{s.avgDiscount} off</span>
                  )}
                </div>

                {s.tags && s.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {s.tags.slice(0, 4).map((t) => (
                      <span key={t} style={{ fontSize: 10, color: "var(--muted-foreground)", background: "var(--secondary)", padding: "1px 6px", borderRadius: 4 }}>{t}</span>
                    ))}
                  </div>
                )}

                <div className="mt-auto flex items-center gap-2 pt-1">
                  {s.website && (
                    <a href={s.website} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded py-1.5" style={{ border: "1px solid var(--border)", fontSize: 11, color: "var(--foreground)" }}>
                      <ExternalLink size={11} /> Visit
                    </a>
                  )}
                  <button onClick={() => { if (confirm(`Remove ${s.name}?`)) removeMutation.mutate(s.id); }} className="flex items-center justify-center rounded p-1.5" style={{ border: "1px solid var(--border)", color: "var(--loss)" }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-96 rounded-lg p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Add Supplier</h3>
            <div className="flex flex-col gap-3">
              <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded px-3 py-2 outline-none" style={{ background: "var(--input-background)", border: "1px solid var(--border)", fontSize: 13 }} />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded px-3 py-2 outline-none" style={{ background: "var(--input-background)", border: "1px solid var(--border)", fontSize: 13 }}>
                  {["retail", "online", "wholesale", "distributor"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded px-3 py-2 outline-none" style={{ background: "var(--input-background)", border: "1px solid var(--border)", fontSize: 13 }} />
              </div>
              <input placeholder="Website (https://...)" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="rounded px-3 py-2 outline-none" style={{ background: "var(--input-background)", border: "1px solid var(--border)", fontSize: 13 }} />
              <input placeholder="Avg discount (e.g. 10-40%)" value={form.avgDiscount} onChange={(e) => setForm({ ...form, avgDiscount: e.target.value })} className="rounded px-3 py-2 outline-none" style={{ background: "var(--input-background)", border: "1px solid var(--border)", fontSize: 13 }} />
              <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
                <input type="checkbox" checked={form.couponsAvailable} onChange={(e) => setForm({ ...form, couponsAvailable: e.target.checked })} /> Coupons available
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 rounded py-2" style={{ border: "1px solid var(--border)", fontSize: 13, color: "var(--muted-foreground)" }}>Cancel</button>
              <button onClick={() => addMutation.mutate(form)} disabled={!form.name || addMutation.isPending} className="flex-1 rounded py-2" style={{ background: "var(--profit)", color: "#000", fontSize: 13, fontWeight: 600, opacity: !form.name ? 0.5 : 1 }}>
                {addMutation.isPending ? "Saving..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
