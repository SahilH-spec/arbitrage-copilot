# Arbitrage Copilot — Managed Agent config

This folder defines an **Anthropic Managed Agent**: a hosted, versioned agent that does the
nightly product research and active-listing monitoring for the arbitrage business.

| File | What it is |
|---|---|
| `agent.json` | The agent definition — model, full system prompt (the agent's entire job, the business, the platforms, the criteria), the tools it can call, and the report skills. **This is the main spec.** |
| `environment.json` | The cloud sandbox the agent runs in (web access on for research). |
| `deployment.json` | The nightly 4 AM cron schedule that fires the research cycle automatically. |

---

## ⚠️ Read this first: the API key does NOT go away

A Managed Agent is **not** an alternative to your API key. It's a config object stored on
Anthropic's servers. Your Railway app still authenticates to Anthropic with the same
`ANTHROPIC_API_KEY` to create the agent and start its sessions. The key is *how you talk to
the agent*, not a thing the agent replaces.

What the Managed Agent **does** give you over the current in-app agent:
- A persisted, **versioned** agent config (change the prompt without breaking running sessions).
- An Anthropic-hosted **research sandbox** with `web_search` / `web_fetch` built in.
- **Native cron scheduling** (`deployment.json`) — can replace the app's `node-cron` 4 AM job.
- A clean separation: the *thinking* runs on Anthropic; your Railway app just answers the
  agent's tool calls (Keepa, Amazon, suppliers, save-report) with **your** keys, which never
  leave your server.

> Managed Agents is a **beta** feature (`anthropic-beta: managed-agents-2026-04-01`). Confirm
> your Anthropic account has access before relying on it. If it's not enabled, the in-app agent
> already built into the Railway backend does the same job today.

---

## How the agent connects to your Railway app (the architecture)

The 5 `custom` tools in `agent.json` (`keepa_find_products`, `keepa_product_metrics`,
`lookup_suppliers`, `amazon_inventory`, `amazon_orders`, `amazon_update_price`,
`save_daily_report`) are **client-side**: when the agent decides to use one, Anthropic pauses
the session and emits a `agent.custom_tool_use` event. **Your Railway app** (holding the SSE
stream) executes the call with your Keepa/Amazon keys and sends the result back. This keeps
every third-party secret on your server — they're never exposed to Anthropic's sandbox.

```
Anthropic (agent loop + web research sandbox)
   │  emits  agent.custom_tool_use  (e.g. keepa_find_products)
   ▼
Railway app  ── runs the call with YOUR Keepa/Amazon keys ──┐
   ▲                                                          │
   └──────  user.custom_tool_result  (the data) ◀────────────┘
```

`web_search` / `web_fetch` run inside Anthropic's sandbox (no key needed). Keepa, Amazon SP-API,
and your supplier DB run on Railway via the tool bridge above.

---

## Deploy it

### Option A — `ant` CLI (recommended; YAML or JSON both work)
```bash
# Install once: see https://platform.claude.com/docs/en/api/sdks/cli
export ANTHROPIC_API_KEY=sk-ant-...   # the same key already in Railway

# 1. Create the environment, capture its id
ENV_ID=$(ant beta:environments create < environment.json --transform id -r)

# 2. Create the agent, capture its id
AGENT_ID=$(ant beta:agents create < agent.json --transform id -r)
echo "AGENT_ID=$AGENT_ID  ENV_ID=$ENV_ID"

# 3. Fill those two ids into deployment.json (replace the REPLACE_WITH_* placeholders),
#    then create the nightly schedule
ant beta:deployments create < deployment.json
```

### Option B — raw HTTP (curl)
```bash
# Environment
curl https://api.anthropic.com/v1/environments \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d @environment.json
# → copy the "id" (env_...) into deployment.json

# Agent
curl https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d @agent.json
# → copy the "id" (agent_...) into deployment.json

# Deployment (after filling in both ids)
curl https://api.anthropic.com/v1/deployments \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d @deployment.json
```

After creating, store the `agent_id` and `environment_id` as Railway variables
(`MANAGED_AGENT_ID`, `MANAGED_ENV_ID`) so the backend can start sessions and answer the
agent's tool calls.

---

## Should you switch to this, or keep the in-app agent?

Both do the same job. The in-app agent (already live on Railway) is simplest and works today.
The Managed Agent is worth adopting if you want Anthropic to own the scheduling + research
sandbox and you want a versioned, separately-managed agent config. You can also run them
side by side. Tell me which way you want to go and I'll wire the Railway backend to the tool
bridge (the `agent.custom_tool_use` → `user.custom_tool_result` loop).
