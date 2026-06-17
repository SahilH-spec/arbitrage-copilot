import { Routes, Route } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, Search, Sun, Moon, Wifi, WifiOff } from "lucide-react";
import { Sidebar } from "./components/layout/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { AgentControl } from "./pages/AgentControl";
import { Reports } from "./pages/Reports";
import { Inventory } from "./pages/Inventory";
import { Accounting } from "./pages/Accounting";
import { AIChat } from "./pages/AIChat";
import { Workflow } from "./pages/Workflow";
import { Suppliers } from "./pages/Suppliers";
import { Bank } from "./pages/Bank";
import { agentApi, dashboardApi, reportsApi } from "./lib/api";
import { useTheme } from "./lib/theme";
import { formatCurrency } from "./lib/utils";

function Topbar() {
  const { theme, toggle } = useTheme();
  const { data, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardApi.get,
    refetchInterval: 60000,
  });

  const connected = !isError;
  const today = data?.sales?.today;
  const buyBox = data?.inventory?.buyBoxPct;

  const stats = [
    { label: "Today", value: formatCurrency(today?.revenue || 0), color: "var(--profit)" },
    { label: "Orders", value: String(today?.orders || 0), color: "var(--foreground)" },
    { label: "Buy Box", value: buyBox != null ? `${buyBox.toFixed(1)}%` : "—", color: "var(--warning)" },
  ];

  return (
    <header
      className="flex flex-shrink-0 items-center justify-between px-6"
      style={{ height: 52, borderBottom: "1px solid var(--border)", background: "var(--background)" }}
    >
      {/* Search */}
      <div className="flex items-center gap-2 rounded px-3 py-1.5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <Search size={12} style={{ color: "var(--muted-foreground)" }} />
        <input
          placeholder="Search products, ASINs, reports..."
          className="bg-transparent outline-none"
          style={{ width: 220, fontSize: 12, color: "var(--foreground)" }}
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Live stats */}
        <div className="mr-1 hidden items-center gap-4 md:flex">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{s.label}</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Connected indicator */}
        <div
          className="flex items-center gap-1.5 rounded px-2 py-1"
          style={{
            background: "var(--card)", border: "1px solid var(--border)",
            color: connected ? "var(--profit)" : "var(--loss)", fontSize: 10,
          }}
          title={connected ? "Connected to backend" : "Offline"}
        >
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {connected ? "Connected" : "Offline"}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="flex items-center justify-center rounded p-1.5 transition-all hover:opacity-75"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={14} style={{ color: "var(--warning)" }} /> : <Moon size={14} style={{ color: "var(--muted-foreground)" }} />}
        </button>

        {/* Notifications */}
        <button
          className="relative flex items-center justify-center rounded p-1.5 transition-opacity hover:opacity-75"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <Bell size={14} style={{ color: "var(--foreground)" }} />
          <span className="absolute rounded-full" style={{ width: 7, height: 7, background: "var(--loss)", top: 3, right: 3, border: "1.5px solid var(--background)" }} />
        </button>

        {/* Avatar */}
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: 30, height: 30, background: "var(--profit)", color: theme === "dark" ? "#000" : "#fff", fontSize: 12, fontWeight: 700 }}
        >
          OA
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const { data: agentStatus } = useQuery({
    queryKey: ["agent-status"],
    queryFn: agentApi.getStatus,
    refetchInterval: 10000,
  });

  const { data: reports } = useQuery({
    queryKey: ["reports-list"],
    queryFn: () => reportsApi.list(30),
  });

  const pendingReports = (reports || []).filter((r) => r.status === "completed").length;

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: "var(--background)", color: "var(--foreground)", fontFamily: "var(--font-sans)" }}>
      <Sidebar agentRunning={agentStatus?.isRunning} reportCount={pendingReports} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agent" element={<AgentControl />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/:id" element={<Reports />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/accounting" element={<Accounting />} />
            <Route path="/bank" element={<Bank />} />
            <Route path="/chat" element={<AIChat />} />
            <Route path="/workflow" element={<Workflow />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
