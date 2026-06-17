import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePlaidLink } from "react-plaid-link";
import {
  Landmark, ShieldCheck, Link2, ArrowRight, Building2, CreditCard, Lock, RefreshCw, Unplug,
} from "lucide-react";
import { bankApi, BankAccount } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

function ConnectButton({ onConnected }: { onConnected: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSuccess = useCallback(async (publicToken: string) => {
    await bankApi.exchange(publicToken);
    setLinkToken(null);
    onConnected();
  }, [onConnected]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  const start = async () => {
    setLoading(true);
    try {
      const { linkToken } = await bankApi.createLinkToken();
      setLinkToken(linkToken);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to start Plaid");
    } finally {
      setLoading(false);
    }
  };

  // Auto-open once the token is set and Plaid is ready
  if (linkToken && ready) {
    open();
    setLinkToken(null);
  }

  return (
    <button
      onClick={start}
      disabled={loading}
      className="flex items-center gap-2 rounded px-4 py-2"
      style={{ background: "var(--agent)", color: "#fff", fontSize: 13, fontWeight: 600, opacity: loading ? 0.6 : 1 }}
    >
      <Link2 size={14} /> {loading ? "Starting..." : "Connect with Plaid"}
    </button>
  );
}

export function Bank() {
  const qc = useQueryClient();
  const { data: status } = useQuery({ queryKey: ["bank-status"], queryFn: bankApi.getStatus });
  const { data: accountsData } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: bankApi.getAccounts,
    enabled: !!status?.connected,
  });

  const syncMutation = useMutation({
    mutationFn: bankApi.sync,
    onSuccess: (r) => { alert(r.message); qc.invalidateQueries({ queryKey: ["transactions"] }); qc.invalidateQueries({ queryKey: ["accounting-summary"] }); },
  });
  const disconnectMutation = useMutation({
    mutationFn: bankApi.disconnect,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-status"] }); qc.invalidateQueries({ queryKey: ["bank-accounts"] }); },
  });

  const configured = status?.configured;
  const connected = status?.connected;
  const accounts = (accountsData?.accounts as BankAccount[]) || [];

  return (
    <div className="flex min-h-full flex-col gap-5 p-6" style={{ color: "var(--foreground)" }}>
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>Bank</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
            Connect your business bank account to auto-sync expenses and income
          </p>
        </div>
        {connected && (
          <div className="flex items-center gap-2">
            <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}
              className="flex items-center gap-2 rounded px-3 py-1.5" style={{ background: "var(--profit)", color: "#000", fontSize: 12, fontWeight: 600 }}>
              <RefreshCw size={13} className={syncMutation.isPending ? "animate-spin" : ""} /> Sync transactions
            </button>
            <button onClick={() => { if (confirm("Disconnect bank?")) disconnectMutation.mutate(); }}
              className="flex items-center gap-2 rounded px-3 py-1.5" style={{ border: "1px solid var(--border)", fontSize: 12, color: "var(--loss)" }}>
              <Unplug size={13} /> Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Connected: show accounts */}
      {connected ? (
        <>
          <div className="flex items-center gap-2 rounded-lg px-4 py-3" style={{ background: "var(--profit-muted)", border: "1px solid var(--border)" }}>
            <ShieldCheck size={16} style={{ color: "var(--profit)" }} />
            <span style={{ fontSize: 13, color: "var(--profit)", fontWeight: 500 }}>Bank connected — transactions sync into your accounting ledger.</span>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {accounts.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Loading accounts…</p>
            ) : accounts.map((a) => (
              <div key={a.id} className="rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard size={15} style={{ color: "var(--agent)" }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</span>
                </div>
                <p style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "capitalize" }}>
                  {a.subtype || a.type} {a.mask ? `••${a.mask}` : ""}
                </p>
                <p className="mono" style={{ fontSize: 22, fontWeight: 600, marginTop: 8 }}>
                  {a.current != null ? formatCurrency(a.current) : "—"}
                </p>
                {a.available != null && (
                  <p style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{formatCurrency(a.available)} available</p>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Not connected — connect card (live if configured, instructions if not) */
        <div className="flex flex-col items-center gap-4 rounded-lg px-6 py-10 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-center rounded-full" style={{ width: 56, height: 56, background: "var(--agent-muted)" }}>
            <Landmark size={26} style={{ color: "var(--agent)" }} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Connect your business bank account</h3>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", maxWidth: 460, marginTop: 6 }}>
              Securely link your bank via Plaid to automatically import transactions into your accounting,
              categorize Amazon payouts, and reconcile expenses.
            </p>
          </div>
          {configured ? (
            <ConnectButton onConnected={() => qc.invalidateQueries({ queryKey: ["bank-status"] })} />
          ) : (
            <div className="rounded-lg px-4 py-3 text-left" style={{ background: "var(--secondary)", maxWidth: 480 }}>
              <p style={{ fontSize: 12, color: "var(--foreground)", fontWeight: 500, marginBottom: 4 }}>Plaid not configured yet</p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                Add <code>PLAID_CLIENT_ID</code>, <code>PLAID_SECRET</code>, and <code>PLAID_ENV</code> in Railway
                (free sandbox keys at dashboard.plaid.com). The Connect button activates automatically once they're set.
              </p>
            </div>
          )}
          <div className="flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            <Lock size={11} /> Bank-grade encryption · credentials never stored on our servers
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="mb-3 flex items-center gap-2">
            <Building2 size={15} style={{ color: "var(--agent)" }} />
            <h3 style={{ fontSize: 13, fontWeight: 500 }}>How it works</h3>
          </div>
          <ol className="flex flex-col gap-2.5">
            {[
              "Connect your bank through Plaid's secure modal (credentials never touch our servers).",
              "Transactions sync into Accounting, auto-categorized as income or expense.",
              "Amazon payouts map to income; supplier purchases and fees to COGS/expenses.",
              "Re-sync anytime, or let the agent reconcile against your sales.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                <span className="flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: 18, height: 18, background: "var(--accent)", color: "var(--foreground)", fontSize: 10, fontWeight: 600 }}>{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <div className="flex items-center justify-between rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500 }}>Prefer manual entry?</p>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Import bank/credit-card statements as CSV in Accounting instead.</p>
          </div>
          <a href="/accounting" className="flex items-center gap-1.5 rounded px-3 py-1.5" style={{ border: "1px solid var(--border)", fontSize: 12, color: "var(--foreground)" }}>
            Accounting <ArrowRight size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}
