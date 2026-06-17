import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot, Play, Settings, Clock, CheckCircle, XCircle, AlertTriangle,
  ChevronDown, BarChart2, Sliders, Calendar,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { agentApi, AgentStatus, AgentRun } from "@/lib/api";
import { formatRelativeTime, cronToHuman, cn } from "@/lib/utils";

const PRESET_SCHEDULES = [
  { label: "4 AM Daily", value: "0 4 * * *" },
  { label: "3 AM Daily", value: "0 3 * * *" },
  { label: "5 AM Daily", value: "0 5 * * *" },
  { label: "Every 12 hours", value: "0 */12 * * *" },
  { label: "Mon/Wed/Fri 4 AM", value: "0 4 * * 1,3,5" },
  { label: "Custom", value: "custom" },
];

const CATEGORIES = [
  "Electronics", "Home & Kitchen", "Sports & Outdoors", "Toys & Games",
  "Health & Beauty", "Office Products", "Pet Supplies", "Tools & Home Improvement",
  "Baby Products", "Clothing & Accessories", "Books", "Garden & Outdoor",
];

export function AgentControl() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"status" | "settings" | "history">("status");
  const [customSchedule, setCustomSchedule] = useState("");

  const { data: status, isLoading } = useQuery({
    queryKey: ["agent-status"],
    queryFn: agentApi.getStatus,
    refetchInterval: 5000,
  });

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["agent-settings"],
    queryFn: agentApi.getSettings,
  });

  const { data: runs } = useQuery({
    queryKey: ["agent-runs"],
    queryFn: () => agentApi.getRuns(20),
  });

  const runMutation = useMutation({
    mutationFn: agentApi.runNow,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-status"] });
      qc.invalidateQueries({ queryKey: ["agent-runs"] });
    },
  });

  const settingsMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => agentApi.updateSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-settings"] });
      qc.invalidateQueries({ queryKey: ["agent-status"] });
    },
  });

  const agentStatus = status as AgentStatus | undefined;
  const agentSettings = settings as Record<string, unknown> | undefined;

  const handleScheduleChange = (value: string) => {
    if (value === "custom") return;
    settingsMutation.mutate({ schedule: value });
  };

  const handleToggleCategory = (cat: string) => {
    const current = (agentSettings?.categories as string[]) || [];
    const updated = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    settingsMutation.mutate({ categories: updated });
  };

  const handleNumberSetting = (key: string, value: number) => {
    settingsMutation.mutate({ [key]: value });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="AI Agent"
        subtitle="Configure and monitor your research agent"
        actions={
          <button
            onClick={() => runMutation.mutate()}
            disabled={agentStatus?.isRunning || runMutation.isPending}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              agentStatus?.isRunning
                ? "bg-secondary text-muted-foreground cursor-not-allowed"
                : "bg-accent text-black hover:opacity-90"
            )}
          >
            {agentStatus?.isRunning ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Run Now
              </>
            )}
          </button>
        }
      />

      {/* Tabs */}
      <div className="border-b border-border bg-card/50 px-6">
        <div className="flex gap-1">
          {(["status", "settings", "history"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium capitalize transition-colors",
                activeTab === tab
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "status" && <Bot className="h-3.5 w-3.5" />}
              {tab === "settings" && <Sliders className="h-3.5 w-3.5" />}
              {tab === "history" && <Clock className="h-3.5 w-3.5" />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* ── Status Tab ── */}
        {activeTab === "status" && (
          <div className="space-y-4">
            {/* Current status */}
            <div className="stat-card">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full",
                  agentStatus?.isRunning ? "bg-accent/10 glow-accent" : "bg-secondary"
                )}>
                  <Bot className={cn(
                    "h-7 w-7",
                    agentStatus?.isRunning ? "text-accent animate-pulse-glow" : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {agentStatus?.isRunning ? "Research in progress..." : "Agent Idle"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {agentStatus?.isRunning
                      ? `Run #${agentStatus.currentRunId} — Searching products, analyzing profitability`
                      : "Waiting for next scheduled run or manual trigger"}
                  </p>
                </div>
              </div>
            </div>

            {/* Schedule info */}
            <div className="grid grid-cols-3 gap-3">
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-accent" />
                  <p className="section-title">Schedule</p>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {agentStatus?.scheduler?.schedule
                    ? cronToHuman(agentStatus.scheduler.schedule)
                    : "Not set"}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {agentStatus?.scheduler?.schedule}
                </p>
              </div>

              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-accent" />
                  <p className="section-title">Next Run</p>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {agentStatus?.scheduler?.nextRun
                    ? new Date(agentStatus.scheduler.nextRun).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                    : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {agentStatus?.scheduler?.nextRun
                    ? new Date(agentStatus.scheduler.nextRun).toLocaleDateString()
                    : ""}
                </p>
              </div>

              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart2 className="h-4 w-4 text-accent" />
                  <p className="section-title">Config</p>
                </div>
                <p className="text-sm text-foreground">
                  Max {agentStatus?.config?.maxProducts} products
                </p>
                <p className="text-xs text-muted-foreground">
                  Min {agentStatus?.config?.minRoi}% ROI · Score {agentStatus?.config?.minScore}+
                </p>
              </div>
            </div>

            {/* Agent phases explanation */}
            <div className="stat-card">
              <p className="section-title mb-4">Research Process</p>
              <div className="relative space-y-0">
                {[
                  { label: "Market Trend Analysis", desc: "Scans trending categories, news, social media for hot products", icon: "1" },
                  { label: "Product Discovery", desc: "Finds specific ASINs matching criteria from retail & online sources", icon: "2" },
                  { label: "Keepa Analysis", desc: "Checks 90-day price history, BSR rank, competition level", icon: "3" },
                  { label: "Profitability Scoring", desc: "Calculates ROI, fees, scores each product against your criteria", icon: "4" },
                  { label: "Report Generation", desc: "Builds the nightly report with top products ready for your review", icon: "5" },
                ].map((phase, i, arr) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="relative flex flex-col items-center">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                        {phase.icon}
                      </div>
                      {i < arr.length - 1 && (
                        <div className="mt-1 h-8 w-px bg-border" />
                      )}
                    </div>
                    <div className="pb-6">
                      <p className="text-sm font-medium text-foreground">{phase.label}</p>
                      <p className="text-xs text-muted-foreground">{phase.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Settings Tab ── */}
        {activeTab === "settings" && (
          <div className="space-y-4 max-w-2xl">
            {/* Schedule */}
            <div className="stat-card space-y-4">
              <p className="section-title">Schedule</p>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_SCHEDULES.filter((s) => s.value !== "custom").map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handleScheduleChange(preset.value)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                      agentSettings?.schedule === preset.value
                        ? "border-accent/50 bg-accent/10 text-accent"
                        : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                    )}
                  >
                    <p className="font-medium">{preset.label}</p>
                    <p className="font-mono opacity-60">{preset.value}</p>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Custom cron expression (e.g. 0 4 * * *)"
                  value={customSchedule}
                  onChange={(e) => setCustomSchedule(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                />
                <button
                  onClick={() => customSchedule && settingsMutation.mutate({ schedule: customSchedule })}
                  className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-black"
                >
                  Set
                </button>
              </div>
            </div>

            {/* Profitability Thresholds */}
            <div className="stat-card space-y-4">
              <p className="section-title">Profitability Thresholds</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "minRoi", label: "Minimum ROI (%)", min: 10, max: 100, step: 5 },
                  { key: "minMonthlySales", label: "Min Monthly Sales", min: 10, max: 500, step: 10 },
                  { key: "maxProducts", label: "Max Products Per Report", min: 5, max: 50, step: 5 },
                  { key: "minScore", label: "Minimum Score (0-100)", min: 0, max: 100, step: 5 },
                  { key: "maxCompetitors", label: "Max Competitor Sellers", min: 1, max: 20, step: 1 },
                ].map(({ key, label, min, max, step }) => (
                  <div key={key}>
                    <label className="mb-2 block text-xs font-medium text-foreground">{label}</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={(agentSettings?.[key] as number) || 0}
                        onChange={(e) => handleNumberSetting(key, parseInt(e.target.value))}
                        className="flex-1 accent-emerald-400"
                      />
                      <span className="w-10 text-right text-sm font-semibold text-foreground">
                        {(agentSettings?.[key] as number) || 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div className="stat-card space-y-3">
              <p className="section-title">Research Categories</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const selected = ((agentSettings?.categories as string[]) || []).includes(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => handleToggleCategory(cat)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        selected
                          ? "border-accent/50 bg-accent/10 text-accent"
                          : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                      )}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Permission Level */}
            <div className="stat-card space-y-3">
              <p className="section-title">Permission Level</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "read-only", label: "Read Only", desc: "Agent researches, no Amazon access" },
                  { value: "semi-auto", label: "Semi-Auto", desc: "Research + price alerts, no auto-reprice" },
                  { value: "full-auto", label: "Full Auto", desc: "Research + auto-reprice on approval" },
                ].map((p) => (
                  <button
                    key={p.value}
                    onClick={() => settingsMutation.mutate({ permissionLevel: p.value })}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      agentSettings?.permissionLevel === p.value
                        ? "border-accent/50 bg-accent/10"
                        : "border-border hover:border-border/80"
                    )}
                  >
                    <p className={cn("text-xs font-semibold", agentSettings?.permissionLevel === p.value ? "text-accent" : "text-foreground")}>
                      {p.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── History Tab ── */}
        {activeTab === "history" && (
          <div className="space-y-2">
            {(runs as AgentRun[] | undefined)?.length === 0 && (
              <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
                No runs yet
              </div>
            )}
            {(runs as AgentRun[] | undefined)?.map((run) => (
              <div key={run.id} className="stat-card flex items-center gap-4">
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  run.status === "completed" ? "bg-accent/10" :
                  run.status === "failed" ? "bg-red-500/10" :
                  "bg-amber-400/10"
                )}>
                  {run.status === "completed" ? (
                    <CheckCircle className="h-4 w-4 text-accent" />
                  ) : run.status === "failed" ? (
                    <XCircle className="h-4 w-4 text-red-400" />
                  ) : (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      Run #{run.id}
                    </p>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs",
                      run.status === "completed" ? "bg-accent/10 text-accent" :
                      run.status === "failed" ? "bg-red-500/10 text-red-400" :
                      "bg-amber-400/10 text-amber-400"
                    )}>
                      {run.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {run.startedAt ? formatRelativeTime(run.startedAt) : "—"}
                    {run.productsFound > 0 && ` · ${run.productsFound} products found`}
                    {run.error && ` · Error: ${run.error.slice(0, 60)}...`}
                  </p>
                </div>
                {run.completedAt && run.startedAt && (
                  <p className="text-xs text-muted-foreground">
                    {Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 60000)}m
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
