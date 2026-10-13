# Deploying on Railway

Two services from this one repo: the **private app** (real keys, login required) and an optional **public demo**
(fictional data, read-only). Give each its own PostgreSQL database.

## Private app

1. Railway project > Add PostgreSQL. Link `DATABASE_URL` to the app service.
2. Service variables (generate secrets with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`):
   ```
   NODE_ENV=production
   APP_PASSWORD=<12+ characters>
   JWT_SECRET=<64 hex chars>
   ENCRYPTION_KEY=<64 hex chars>      # needed once Plaid is configured; keep a copy somewhere safe
   ANTHROPIC_API_KEY, KEEPA_API_KEY, BRAVE_SEARCH_API_KEY, AMAZON_SP_*, PLAID_* ...
   ```
3. Deploy. The healthcheck is `/api/health`. The app shows a password screen at the root URL.
4. If a Plaid token was saved before encryption existed, it is re-encrypted the first time the bank is used
   (needs `ENCRYPTION_KEY` set).

If a variable is missing the deploy fails on purpose and the log says which one.

## Public demo

1. In the same Railway project: New > Service from the same GitHub repo, plus a **second** PostgreSQL database.
2. Variables for this service only:
   ```
   NODE_ENV=production
   DEMO_MODE=true
   DATABASE_URL=<the demo database, NOT the real one>
   ```
   Do not add any API keys. They would be ignored anyway.
3. Deploy. The fictional dataset loads on boot and refreshes every 6 hours. Generate a public domain for the
   service and use that URL on GitHub/LinkedIn.

The demo refuses to start if its database contains real data (reports, inventory, transactions, chat or a Plaid
token), so a wrong `DATABASE_URL` fails loudly instead of exposing anything.

## Local

```bash
cp .env.example .env     # in development APP_PASSWORD may be left empty (login disabled, with a warning)
npm install && npm run dev
DEMO_MODE=true npm run seed:demo --workspace=backend   # optional: load the demo dataset locally
```
