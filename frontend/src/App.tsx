import { Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Search, Sun, Moon, Wifi, WifiOff, LogOut } from "lucide-react";
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
import { Login } from "./pages/Login";
import { agentApi, authApi, dashboardApi, reportsApi, type AuthState } from "./lib/api";
import { useTheme } from "./lib/theme";
import { formatCurrency } from "./lib/utils";

function Topbar({ authRequired }: { authRequired: boolean }) {
  const qc = useQueryClient();
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

        {authRequired && (
          <button
            onClick={async () => { await authApi.logout(); qc.clear(); window.location.reload(); }}
            className="flex items-center justify-center rounded p-1.5 transition-opacity hover:opacity-75"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            title="Sign out"
          >
            <LogOut size={14} style={{ color: "var(--muted-foreground)" }} />
          </button>
        )}

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

function Shell({ auth }: { auth: AuthState }) {
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
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: "var(--background)", color: "var(--foreground)", fontFamily: "var(--font-sans)" }}>
      {auth.demo && (
        <div
          className="flex flex-shrink-0 items-center justify-center gap-2 px-4 py-1.5 text-center"
          style={{ background: "var(--warning)", color: "#000", fontSize: 11, fontWeight: 600 }}
        >
          Public demo: fictional products and numbers, read-only. No real accounts are connected.
        </div>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
      <Sidebar agentRunning={agentStatus?.isRunning} reportCount={pendingReports} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar authRequired={auth.authRequired} />
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
    </div>
  );
}

export default function App() {
  const qc = useQueryClient();
  const { data: auth, isLoading, isError } = useQuery({ queryKey: ["auth-me"], queryFn: authApi.me, retry: false });

  // Any API call that comes back 401 sends the user to the login screen
  useEffect(() => {
    const onExpired = () =>
      qc.setQueryData<AuthState>(["auth-me"], (old) => (old ? { ...old, authenticated: false } : old));
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, [qc]);

  const fullScreen = (text: string) => (
    <div className="flex h-screen w-screen items-center justify-center" style={{ background: "var(--background)", color: "var(--muted-foreground)", fontSize: 13 }}>
      {text}
    </div>
  );

  if (isLoading) return fullScreen("Loading…");
  if (isError || !auth) return fullScreen("Can't reach the server.");
  if (!auth.authenticated) return <Login onSuccess={() => qc.invalidateQueries()} />;
  return <Shell auth={auth} />;
}
