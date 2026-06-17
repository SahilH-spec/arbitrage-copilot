import { RefreshCw } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: React.ReactNode;
  // Accepted for backwards-compat with existing pages; no longer rendered
  // (connection status now lives in the global top bar).
  isConnected?: boolean;
  lastUpdated?: string;
}

/**
 * In-page title row. The global app top bar handles search, live stats,
 * connection status, theme, and notifications — this is just the page heading.
 */
export function Header({ title, subtitle, onRefresh, isRefreshing, actions }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 pt-6 pb-1">
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--foreground)" }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-center rounded p-1.5 transition-opacity hover:opacity-75 disabled:opacity-50"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
          </button>
        )}
        {actions}
      </div>
    </div>
  );
}
