import {
  Search, FileText, CheckSquare, ShoppingCart, Package,
  Send, TrendingUp, DollarSign, ArrowRight, Bot, AlertCircle,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";

const WORKFLOW_STEPS = [
  {
    id: 1,
    phase: "Research",
    icon: Search,
    title: "AI Agent Research",
    subtitle: "Automated — runs nightly",
    desc: "The AI agent runs at 4 AM, researching trending products, checking Keepa price history, calculating profitability, and scoring each opportunity against your criteria.",
    color: "accent",
    details: [
      "Market trend analysis (news, social, categories)",
      "Product discovery across 6+ categories",
      "Keepa BSR + price history analysis",
      "ROI calculation with FBA fees",
      "Competition level assessment",
      "Profitability scoring (0-100)",
    ],
    time: "~2-3 hours",
  },
  {
    id: 2,
    phase: "Review",
    icon: FileText,
    title: "Nightly Report Review",
    subtitle: "Your action — every evening",
    desc: "Log in each evening to review the curated product list. Each product shows the AI analysis, score, projected ROI, and source store. Approve or reject with one click.",
    color: "blue",
    details: [
      "View AI-scored product list",
      "Read full profitability analysis",
      "Check price history charts",
      "Approve products to buy",
      "Reject poor opportunities",
      "Add notes for reference",
    ],
    time: "15-30 min",
  },
  {
    id: 3,
    phase: "Purchase",
    icon: ShoppingCart,
    title: "Buy Products",
    subtitle: "Your action — same evening or next morning",
    desc: "For each approved product, visit the source store (Walmart, Target, etc.) in-person or online, purchase the recommended quantity, and log the expense in the app.",
    color: "purple",
    details: [
      "Visit source store / order online",
      "Buy at or below suggested buy price",
      "Log purchase in accounting",
      "Take photos of receipts",
      "Update inventory with quantity",
      "Calculate actual ROI after purchase",
    ],
    time: "1-3 hours",
  },
  {
    id: 4,
    phase: "Prep & Ship",
    icon: Package,
    title: "FBA Prep & Ship",
    subtitle: "Your action — within 24-48 hours",
    desc: "Label products with FNSKU labels, pack them in appropriate boxes, and create an FBA shipment in Seller Central. Ship to Amazon's fulfillment center.",
    color: "orange",
    details: [
      "Print FNSKU labels (print from Seller Central)",
      "Apply labels to products",
      "Select appropriate box size",
      "Create FBA inbound shipment",
      "Print box labels & packing slip",
      "Drop off at UPS/FedEx",
    ],
    time: "1-2 hours",
  },
  {
    id: 5,
    phase: "Monitor",
    icon: TrendingUp,
    title: "Active Monitoring",
    subtitle: "Automated + your oversight",
    desc: "Once listed, the AI agent monitors your products daily — tracking buy box status, pricing competition, sales velocity, and inventory levels. Get alerts when action is needed.",
    color: "accent",
    details: [
      "Buy box win/loss tracking",
      "Price competition alerts",
      "Sales velocity monitoring",
      "Inventory level alerts",
      "Storage fee warnings",
      "Auto-reprice suggestions",
    ],
    time: "Continuous",
  },
  {
    id: 6,
    phase: "Profit",
    icon: DollarSign,
    title: "Collect Profit",
    subtitle: "Automated — Amazon pays every 2 weeks",
    desc: "Amazon deposits your earnings directly to your bank account every 14 days. Track your P&L in the accounting section and reinvest in the next round of products.",
    color: "green",
    details: [
      "Amazon pays every 2 weeks",
      "Review settlement reports",
      "Log income in accounting",
      "Calculate actual vs projected ROI",
      "Identify best-performing categories",
      "Reinvest in next product cycle",
    ],
    time: "Every 2 weeks",
  },
];

const colorMap: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  accent: { bg: "bg-emerald-400/10", text: "text-emerald-400", border: "border-emerald-400/30", dot: "bg-emerald-400" },
  blue: { bg: "bg-blue-400/10", text: "text-blue-400", border: "border-blue-400/30", dot: "bg-blue-400" },
  purple: { bg: "bg-purple-400/10", text: "text-purple-400", border: "border-purple-400/30", dot: "bg-purple-400" },
  orange: { bg: "bg-orange-400/10", text: "text-orange-400", border: "border-orange-400/30", dot: "bg-orange-400" },
  green: { bg: "bg-emerald-400/10", text: "text-emerald-400", border: "border-emerald-400/30", dot: "bg-emerald-400" },
};

export function Workflow() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Workflow"
        subtitle="Your Amazon arbitrage business roadmap — from AI research to profit"
      />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Overview banner */}
        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-accent/20 bg-accent/5 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
            <Bot className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Your Business, Automated</p>
            <p className="text-xs text-muted-foreground">
              The AI agent handles research and monitoring. Your job is to review reports, make purchases, and ship to Amazon.
              Total active time: <span className="font-medium text-foreground">~3-5 hours/day</span>
            </p>
          </div>
          <div className="ml-auto flex items-center gap-6 text-center">
            <div>
              <p className="text-lg font-bold text-foreground">6</p>
              <p className="text-xs text-muted-foreground">Steps</p>
            </div>
            <div>
              <p className="text-lg font-bold text-accent">AI</p>
              <p className="text-xs text-muted-foreground">Handles research</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">You</p>
              <p className="text-xs text-muted-foreground">Make decisions</p>
            </div>
          </div>
        </div>

        {/* Workflow Steps */}
        <div className="space-y-4">
          {WORKFLOW_STEPS.map((step, index) => {
            const Icon = step.icon;
            const colors = colorMap[step.color] || colorMap.accent;
            const isLast = index === WORKFLOW_STEPS.length - 1;

            return (
              <div key={step.id} className="relative flex gap-5">
                {/* Connector line */}
                {!isLast && (
                  <div className="absolute left-5 top-[3.25rem] bottom-0 w-px bg-border translate-x-px" />
                )}

                {/* Step number + icon */}
                <div className="relative flex shrink-0 flex-col items-center">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2",
                    colors.bg, colors.border
                  )}>
                    <Icon className={cn("h-4.5 w-4.5", colors.text)} />
                  </div>
                </div>

                {/* Content */}
                <div className={cn(
                  "mb-4 flex-1 rounded-2xl border p-5 transition-colors",
                  colors.border, "bg-card"
                )}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", colors.bg, colors.text)}>
                          Phase {step.id}: {step.phase}
                        </span>
                        <span className="text-xs text-muted-foreground">{step.time}</span>
                      </div>
                      <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                      <p className="text-xs font-medium text-muted-foreground mb-2">{step.subtitle}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                    </div>

                    {/* Details list */}
                    <div className="w-64 shrink-0">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Steps</p>
                      <ul className="space-y-1.5">
                        {step.details.map((detail, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <div className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", colors.dot)} />
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Key metrics targets */}
        <div className="mt-6 stat-card">
          <p className="section-title mb-4">Target Metrics to Track</p>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Minimum ROI", target: "≥ 30%", desc: "After all FBA fees", color: "text-emerald-400" },
              { label: "Monthly Sales", target: "≥ 30 units", desc: "BSR rank target", color: "text-blue-400" },
              { label: "Max Competitors", target: "≤ 5 sellers", desc: "FBA sellers on listing", color: "text-amber-400" },
              { label: "Price Stability", target: "< 20% drop", desc: "90-day price history", color: "text-accent" },
              { label: "Profit Margin", target: "≥ 25%", desc: "Net after all costs", color: "text-purple-400" },
              { label: "BSR Rank", target: "< 100,000", desc: "In primary category", color: "text-orange-400" },
              { label: "Amazon In BB", target: "< 30%", desc: "Time in buy box", color: "text-red-400" },
              { label: "Score Threshold", target: "≥ 60/100", desc: "Combined criteria score", color: "text-emerald-400" },
            ].map(({ label, target, desc, color }) => (
              <div key={label} className="rounded-xl bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn("text-lg font-bold", color)}>{target}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pro tips */}
        <div className="mt-4 stat-card border-amber-500/20">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <p className="section-title text-amber-400">Important Notes</p>
          </div>
          <ul className="space-y-2">
            {[
              "Always verify product is not restricted/gated before purchasing — check Amazon's restricted categories list",
              "Check if Amazon itself is selling the product — avoid competing with Amazon directly",
              "Factor in prep costs (labels, packaging, mileage) into your ROI calculations",
              "Start small: buy 2-5 units of a new product to test before scaling up",
              "Keep 3-6 months of Amazon statements for tax purposes — log everything in the accounting section",
              "Watch for price crashes after purchases — set up alerts in the inventory section",
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-0.5 text-amber-400 font-bold shrink-0">{i + 1}.</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
