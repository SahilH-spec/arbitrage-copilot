import { Landmark, ShieldCheck, Link2, ArrowRight, Building2, CreditCard, Lock } from "lucide-react";

export function Bank() {
  return (
    <div className="flex min-h-full flex-col gap-5 p-6" style={{ color: "var(--foreground)" }}>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Bank</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
          Connect your business bank account to auto-sync expenses and income
        </p>
      </div>

      {/* Connect card */}
      <div className="flex flex-col items-center gap-4 rounded-lg px-6 py-10 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-center rounded-full" style={{ width: 56, height: 56, background: "var(--agent-muted)" }}>
          <Landmark size={26} style={{ color: "var(--agent)" }} />
        </div>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Connect your business bank account</h3>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", maxWidth: 460, marginTop: 6 }}>
            Securely link your bank via Plaid to automatically import transactions into your accounting,
            categorize Amazon payouts, and reconcile expenses — no manual CSV imports.
          </p>
        </div>
        <button
          className="flex items-center gap-2 rounded px-4 py-2"
          style={{ background: "var(--agent)", color: "#fff", fontSize: 13, fontWeight: 600 }}
          onClick={() => alert("Plaid Link requires PLAID_CLIENT_ID and PLAID_SECRET to be configured in Railway. Once added, this button launches the secure Plaid connection flow.")}
        >
          <Link2 size={14} /> Connect with Plaid
        </button>
        <div className="flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          <Lock size={11} /> Bank-grade encryption · credentials never stored
        </div>
      </div>

      {/* Status / setup */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={15} style={{ color: "var(--profit)" }} />
            <h3 style={{ fontSize: 13, fontWeight: 500 }}>How it works</h3>
          </div>
          <ol className="flex flex-col gap-2.5">
            {[
              "Add Plaid credentials to Railway (PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV)",
              "Click Connect with Plaid and log in to your bank through Plaid's secure modal",
              "Transactions sync automatically into Accounting, categorized by type",
              "Amazon payouts are matched to income; supplier purchases to COGS",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                <span className="flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: 18, height: 18, background: "var(--accent)", color: "var(--foreground)", fontSize: 10, fontWeight: 600 }}>{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="mb-3 flex items-center gap-2">
            <Building2 size={15} style={{ color: "var(--agent)" }} />
            <h3 style={{ fontSize: 13, fontWeight: 500 }}>Connected accounts</h3>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <CreditCard size={28} style={{ color: "var(--muted-foreground)", opacity: 0.4 }} />
            <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>No accounts connected yet</p>
            <p style={{ fontSize: 11, color: "var(--muted-foreground)", opacity: 0.7 }}>
              Connect a bank to see balances and synced transactions here
            </p>
          </div>
        </div>
      </div>

      {/* Manual alternative */}
      <div className="flex items-center justify-between rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500 }}>Prefer not to connect a bank?</p>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>You can import bank/credit card statements as CSV in the Accounting section instead.</p>
        </div>
        <a href="/accounting" className="flex items-center gap-1.5 rounded px-3 py-1.5" style={{ border: "1px solid var(--border)", fontSize: 12, color: "var(--foreground)" }}>
          Go to Accounting <ArrowRight size={12} />
        </a>
      </div>
    </div>
  );
}
