// Static demo for GitHub Pages: no backend, no API keys. GET requests are served from
// fictional JSON fixtures in public/demo-api (recorded from the backend's DEMO_MODE by
// scripts/record-static-demo.mjs). Dates are shifted so the data always looks current.

export const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === "true";
export const READ_ONLY_MESSAGE = "Static demo: changes are disabled and no real accounts are connected.";

const root = `${import.meta.env.BASE_URL}demo-api/`;
const keyFor = (path: string) => path.replace(/^\//, "").replace(/[/?=&]/g, "_");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;

let shiftDays: Promise<number> | null = null;
function getShiftDays(): Promise<number> {
  shiftDays ??= fetch(`${root}_meta.json`)
    .then((r) => r.json())
    .then((m: { recordedAt: string }) => Math.max(0, Math.floor((Date.now() - Date.parse(m.recordedAt)) / DAY_MS)))
    .catch(() => 0);
  return shiftDays;
}

function shiftString(s: string, days: number): string {
  if (!days) return s;
  let out = s.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, (iso) =>
    new Date(Date.parse(iso) + days * DAY_MS).toISOString()
  );
  out = out.replace(/(?<![\dT:-])(\d{4})-(\d{2})-(\d{2})(?![\dT])/g, (_m, y, mo, d) => {
    const t = new Date(Date.UTC(+y, +mo - 1, +d) + days * DAY_MS);
    return t.toISOString().slice(0, 10);
  });
  const months = Math.round(days / 30.44);
  if (months) {
    out = out.replace(new RegExp(`^(${MONTHS.join("|")}) (\\d{4})$`), (_m, mon, y) => {
      const idx = +y * 12 + MONTHS.indexOf(mon) + months;
      return `${MONTHS[idx % 12]} ${Math.floor(idx / 12)}`;
    });
  }
  return out;
}

function shiftDeep<T>(v: T, days: number): T {
  if (!days) return v;
  if (typeof v === "string") return shiftString(v, days) as T;
  if (Array.isArray(v)) return v.map((x) => shiftDeep(x, days)) as T;
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shiftDeep(x, days)])) as T;
  }
  return v;
}

export async function staticRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  if (path === "/auth/me") return { demo: true, authRequired: false, authenticated: true } as T;
  if (method !== "GET") throw new Error(READ_ONLY_MESSAGE);

  const res = await fetch(`${root}${keyFor(path)}.json`);
  if (!res.ok) throw new Error("Not available in the static demo.");
  const data = shiftDeep((await res.json()) as T, await getShiftDays());
  // Messages sent in this browser tab are kept in memory so the conversation reads naturally
  if (path.startsWith("/chat/messages") && Array.isArray(data)) return [...data, ...sessionChat] as T;
  return data;
}

const CHAT_REPLY =
  "This is the static GitHub Pages demo, so the assistant isn't connected to a model here.\n\n" +
  "In the full app, your question goes to Claude together with live context: the latest nightly report, " +
  "inventory with Buy Box status, low-stock alerts and the month's P&L. It answers in this panel as a " +
  "streamed response, for example: which approved products to buy first, which listings are losing the " +
  "Buy Box and by how much, or why this month's margin moved.";

type Msg = { id: number; role: string; content: string; createdAt: string };
const sessionChat: Msg[] = [];

/** Streams a canned reply so the chat UI can be shown without a backend. */
export async function staticChat(message: string, onChunk: (t: string) => void, onDone: () => void) {
  sessionChat.push({ id: Date.now(), role: "user", content: message, createdAt: new Date().toISOString() });
  for (const w of CHAT_REPLY.split(/(\s+)/)) {
    onChunk(w);
    await new Promise((r) => setTimeout(r, 18));
  }
  sessionChat.push({ id: Date.now() + 1, role: "assistant", content: CHAT_REPLY, createdAt: new Date().toISOString() });
  onDone();
}
