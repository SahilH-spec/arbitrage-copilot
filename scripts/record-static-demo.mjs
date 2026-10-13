// Records the read-only demo API (DEMO_MODE=true, fictional data) into static JSON files
// that the GitHub Pages build serves instead of a backend.
//
//   1. Start the backend in demo mode:  DEMO_MODE=true DATABASE_URL=... node backend/dist/server.js
//   2. node scripts/record-static-demo.mjs http://localhost:3001
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const base = (process.argv[2] || "http://localhost:3001").replace(/\/$/, "") + "/api";
const out = join(process.cwd(), "frontend", "public", "demo-api");
export const keyFor = (p) => p.replace(/^\//, "").replace(/[/?=&]/g, "_");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

async function get(path) {
  const res = await fetch(base + path);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}
async function save(path, transform) {
  let data = await get(path);
  if (transform) data = transform(data);
  writeFileSync(join(out, keyFor(path) + ".json"), JSON.stringify(data));
  return data;
}

const paths = [
  "/dashboard", "/agent/status", "/agent/settings", "/agent/runs?limit=20",
  "/reports?limit=30", "/reports/latest",
  "/inventory", "/inventory/stats", "/inventory/supplies/list",
  "/accounting/transactions?limit=50",
  "/accounting/summary", "/accounting/summary?period=week", "/accounting/summary?period=month", "/accounting/summary?period=year",
  "/suppliers", "/chat/messages?sessionId=default",
];
// The static build shows integrations in their connected state and the scheduler on (data stays fictional).
const connected = (d) => {
  if (d.integrations) d.integrations = Object.fromEntries(Object.keys(d.integrations).map((k) => [k, true]));
  const sched = d.agent?.scheduler ?? d.scheduler;
  if (sched) { sched.running = true; sched.nextRun = sched.nextRun ?? new Date(Date.now() + 18 * 3600e3).toISOString(); }
  return d;
};
for (const p of paths) await save(p, p === "/dashboard" || p === "/agent/status" ? connected : undefined);

// Per-item pages
for (const r of await get("/reports?limit=30")) await save(`/reports/${r.id}`);
for (const r of await get("/agent/runs?limit=20")) await save(`/agent/runs/${r.id}/logs`);

// The static build shows integrations in their connected state, with fictional bank accounts.
writeFileSync(join(out, "bank_status.json"), JSON.stringify({ configured: true, connected: true }));
writeFileSync(join(out, "bank_accounts.json"), JSON.stringify({ accounts: [
  { id: "demo-chk", name: "Business Checking", officialName: "Demo Business Checking", mask: "0000", type: "depository", subtype: "checking", available: 18452.37, current: 18921.04, currency: "USD" },
  { id: "demo-cc", name: "Business Card", officialName: "Demo Business Rewards Card", mask: "0001", type: "credit", subtype: "credit card", available: 11240.0, current: 3760.0, currency: "USD" },
]}));

writeFileSync(join(out, "_meta.json"), JSON.stringify({ recordedAt: new Date().toISOString() }));
console.log(`Recorded ${paths.length}+ endpoints into ${out}`);
