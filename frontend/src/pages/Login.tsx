import { useState } from "react";
import { Lock } from "lucide-react";
import { authApi } from "../lib/api";

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.login(password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex h-screen w-screen items-center justify-center"
      style={{ background: "var(--background)", color: "var(--foreground)", fontFamily: "var(--font-sans)" }}
    >
      <form
        onSubmit={submit}
        className="flex flex-col gap-4 rounded-lg p-8"
        style={{ width: 340, background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <Lock size={16} style={{ color: "var(--profit)" }} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>Arbitrage Copilot</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          This workspace is private. Enter the owner password to continue.
        </p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="rounded px-3 py-2 outline-none"
          style={{ fontSize: 13, background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        />
        {error && <div style={{ fontSize: 12, color: "var(--loss)" }}>{error}</div>}
        <button
          type="submit"
          disabled={busy || !password}
          className="rounded px-3 py-2 transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ fontSize: 13, fontWeight: 600, background: "var(--profit)", color: "#000" }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
