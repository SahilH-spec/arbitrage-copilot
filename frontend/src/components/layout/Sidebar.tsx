import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Bot, GitBranch, FileBarChart2, Package,
  Calculator, MessageSquare, ChevronLeft, ChevronRight,
  Zap, Settings, TrendingUp, Truck, Landmark,
} from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badge?: "agentLive" | "reports";
}

const navItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { path: "/agent", label: "AI Agent", icon: Bot, badge: "agentLive" },
  { path: "/workflow", label: "Workflow", icon: GitBranch },
  { path: "/reports", label: "Nightly Reports", icon: FileBarChart2, badge: "reports" },
  { path: "/inventory", label: "Inventory", icon: Package },
  { path: "/suppliers", label: "Suppliers", icon: Truck },
  { path: "/accounting", label: "Accounting", icon: Calculator },
  { path: "/bank", label: "Bank", icon: Landmark },
  { path: "/chat", label: "AI Chat", icon: MessageSquare },
];

interface SidebarProps {
  agentRunning?: boolean;
  reportCount?: number;
}

export function Sidebar({ agentRunning = false, reportCount = 0 }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className="relative flex h-full flex-col transition-all duration-300"
      style={{
        width: collapsed ? 60 : 220,
        minWidth: collapsed ? 60 : 220,
        background: "var(--sidebar)",
        borderRight: "1px solid var(--sidebar-border)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
        <div
          className="flex flex-shrink-0 items-center justify-center rounded"
          style={{ width: 28, height: 28, background: "var(--profit)", color: "#000" }}
        >
          <TrendingUp size={15} strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div>
            <div style={{ color: "var(--sidebar-primary)", fontWeight: 600, fontSize: 13, lineHeight: 1.2, letterSpacing: "0.01em" }}>
              ARBITRAGE
            </div>
            <div style={{ color: "var(--sidebar-foreground)", fontSize: 10, letterSpacing: "0.08em" }}>
              COPILOT
            </div>
          </div>
        )}
      </div>

      {/* Agent Status Pill */}
      {!collapsed && (
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
          <div className="flex items-center gap-2 rounded px-2 py-1.5" style={{ background: agentRunning ? "var(--agent-muted)" : "rgba(255,255,255,0.04)" }}>
            <span
              className="flex-shrink-0 rounded-full"
              style={{
                width: 7, height: 7,
                background: agentRunning ? "var(--agent)" : "var(--muted-foreground)",
                boxShadow: agentRunning ? "0 0 6px var(--agent)" : "none",
                animation: agentRunning ? "pulse-dot 2s infinite" : "none",
              }}
            />
            <span style={{ color: agentRunning ? "var(--agent)" : "var(--sidebar-foreground)", fontSize: 11, fontWeight: 500, letterSpacing: "0.04em" }}>
              {agentRunning ? "Agent Running" : "Agent Idle"}
            </span>
            <Zap size={10} style={{ color: agentRunning ? "var(--agent)" : "var(--sidebar-foreground)", marginLeft: "auto" }} />
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.exact
            ? location.pathname === "/"
            : location.pathname.startsWith(item.path);
          const badge =
            item.badge === "agentLive" && agentRunning ? "LIVE" :
            item.badge === "reports" && reportCount > 0 ? String(reportCount) : null;

          return (
            <Link
              key={item.path}
              to={item.path}
              className="relative flex w-full items-center gap-3 rounded transition-all duration-150"
              style={{
                padding: collapsed ? "9px 0" : "9px 10px",
                justifyContent: collapsed ? "center" : "flex-start",
                background: active ? "var(--sidebar-accent)" : "transparent",
                color: active ? "var(--sidebar-primary)" : "var(--sidebar-foreground)",
              }}
            >
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
              {!collapsed && (
                <>
                  <span style={{ fontSize: 13, fontWeight: active ? 500 : 400 }}>{item.label}</span>
                  {badge && (
                    <span
                      className="ml-auto rounded px-1.5 py-0.5"
                      style={{
                        fontSize: 9, fontWeight: 600, letterSpacing: "0.06em",
                        background: badge === "LIVE" ? "var(--profit-muted)" : "var(--sidebar-accent)",
                        color: badge === "LIVE" ? "var(--profit)" : "var(--sidebar-foreground)",
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </>
              )}
              {active && (
                <span className="absolute left-0 bottom-1 top-1 rounded-r" style={{ width: 2.5, background: "var(--profit)" }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="px-2 py-3" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        <Link
          to="/agent"
          className="flex w-full items-center gap-3 rounded px-2.5 py-2 transition-all duration-150"
          style={{ justifyContent: collapsed ? "center" : "flex-start", color: "var(--sidebar-foreground)" }}
        >
          <Settings size={15} />
          {!collapsed && <span style={{ fontSize: 13 }}>Settings</span>}
        </Link>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 z-10 flex items-center justify-center rounded-full transition-all"
        style={{ width: 20, height: 20, background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>
    </aside>
  );
}
