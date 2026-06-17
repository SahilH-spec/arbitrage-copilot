import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Bot,
  FileText,
  Package,
  DollarSign,
  MessageSquare,
  GitBranch,
  TrendingUp,
  Settings,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/agent", label: "AI Agent", icon: Bot },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/workflow", label: "Workflow", icon: GitBranch },
  { path: "/inventory", label: "Inventory", icon: Package },
  { path: "/accounting", label: "Accounting", icon: DollarSign },
  { path: "/chat", label: "AI Chat", icon: MessageSquare },
];

interface SidebarProps {
  agentRunning?: boolean;
}

export function Sidebar({ agentRunning = false }: SidebarProps) {
  const location = useLocation();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
          <TrendingUp className="h-4 w-4 text-accent" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Arbitrage</p>
          <p className="text-xs text-muted-foreground">Copilot</p>
        </div>
      </div>

      {/* Agent status badge */}
      <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            agentRunning
              ? "animate-pulse-glow bg-accent"
              : "bg-muted-foreground/30"
          )}
        />
        <span className="text-xs text-muted-foreground">
          {agentRunning ? "Agent running..." : "Agent idle"}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="section-title mb-3 px-3">Navigation</p>
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "nav-item group",
                isActive && "active"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-accent" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <ChevronRight className="h-3 w-3 text-accent" />
              )}
              {item.label === "AI Agent" && agentRunning && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent agent-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-4 py-4">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary">
            <span className="text-xs font-bold text-foreground">AC</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-foreground">Arbitrage Biz</p>
            <p className="truncate text-xs text-muted-foreground">Amazon Seller</p>
          </div>
          <Settings className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
    </aside>
  );
}
