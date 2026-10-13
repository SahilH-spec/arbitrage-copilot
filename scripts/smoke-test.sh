#!/usr/bin/env bash
# Security smoke test: boots the built server in production and in demo mode and checks the
# guarantees that matter. Needs a built app (npm run build) and two empty Postgres databases.
#   PROD_DATABASE_URL=postgresql://... DEMO_DATABASE_URL=postgresql://... scripts/smoke-test.sh
set -u
fail=0
ok()   { echo "  ok   $1"; }
bad()  { echo "  FAIL $1"; fail=1; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
expect() { [ "$2" = "$3" ] && ok "$1 -> $2" || bad "$1 -> got $2, expected $3"; }
wait_up() { for _ in $(seq 1 40); do curl -s -o /dev/null "$1/api/health" && return 0; sleep 1; done; return 1; }
PASS='smoke-test-password-123'
SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
pids=""
cleanup() { for p in $pids; do kill "$p" 2>/dev/null; done; }
trap cleanup EXIT

echo "1. Production refuses to boot without secrets"
out=$(NODE_ENV=production PORT=3911 DATABASE_URL="$PROD_DATABASE_URL" timeout 20 node backend/dist/server.js 2>&1 || true)
echo "$out" | grep -q "Insecure production configuration" && ok "boot refused" || bad "server booted without APP_PASSWORD/JWT_SECRET"

echo "2. Production with secrets: login required"
NODE_ENV=production PORT=3911 DATABASE_URL="$PROD_DATABASE_URL" APP_PASSWORD="$PASS" JWT_SECRET="$SECRET" ENCRYPTION_KEY="$KEY" node backend/dist/server.js >/tmp/smoke-prod.log 2>&1 &
pids="$pids $!"
wait_up http://localhost:3911 || { bad "prod server did not start"; cat /tmp/smoke-prod.log; exit 1; }
B=http://localhost:3911/api
expect "GET /health (public)" "$(code $B/health)" 200
for r in dashboard inventory accounting bank/accounts agent/settings chat/messages reports suppliers; do
  expect "GET /$r without login" "$(code $B/$r)" 401; done
for r in inventory/1/reprice bank/sync agent/run chat/send; do
  expect "POST /$r without login" "$(code -X POST -H 'Content-Type: application/json' -d '{}' $B/$r)" 401; done
expect "wrong password" "$(code -X POST -H 'Content-Type: application/json' -d '{"password":"nope"}' $B/auth/login)" 401
expect "forged 'alg: none' token" "$(code -b 'ac_session=eyJhbGciOiJub25lIn0.eyJzdWIiOiJvd25lciJ9.' $B/dashboard)" 401
expect "correct password" "$(code -c /tmp/smoke-cj -X POST -H 'Content-Type: application/json' -d "{\"password\":\"$PASS\"}" $B/auth/login)" 200
expect "GET /dashboard with session" "$(code -b /tmp/smoke-cj $B/dashboard)" 200
curl -s -b /tmp/smoke-cj $B/agent/settings | grep -q plaid_ && bad "settings API exposes plaid_* keys" || ok "settings API hides plaid_* keys"

echo "3. Demo mode: read-only, no integrations"
DEMO_MODE=true NODE_ENV=production PORT=3912 DATABASE_URL="$DEMO_DATABASE_URL" ANTHROPIC_API_KEY=x AMAZON_SP_APP_ID=x AMAZON_SP_REFRESH_TOKEN=x PLAID_CLIENT_ID=x PLAID_SECRET=x node backend/dist/server.js >/tmp/smoke-demo.log 2>&1 &
pids="$pids $!"
wait_up http://localhost:3912 || { bad "demo server did not start"; cat /tmp/smoke-demo.log; exit 1; }
D=http://localhost:3912/api
expect "GET /dashboard (public, fictional)" "$(code $D/dashboard)" 200
for r in "POST inventory/1/reprice" "POST agent/run" "POST chat/send" "POST bank/sync" "PUT agent/settings" "DELETE inventory/1"; do
  set -- $r; expect "$1 /$2 blocked" "$(code -X $1 -H 'Content-Type: application/json' -d '{}' $D/$2)" 403; done
curl -s $D/dashboard | grep -q '"amazon":false' && ok "integrations report as disabled" || bad "demo reports a live integration"

echo "4. Demo refuses a database that holds real data"
# put one real-looking row in the production database so the guard has something to protect
PROD_DATABASE_URL="$PROD_DATABASE_URL" node -e "
const { Pool } = require('pg'); const p = new Pool({ connectionString: process.env.PROD_DATABASE_URL });
p.query(\"insert into transactions(date,type,amount) values (now(),'income',1)\").then(() => p.end());"
out=$(DEMO_MODE=true NODE_ENV=production PORT=3913 DATABASE_URL="$PROD_DATABASE_URL" timeout 20 node backend/dist/server.js 2>&1 || true)
echo "$out" | grep -q "DEMO_MODE refused to start" && ok "demo refused" || bad "demo booted against a non-demo database"
exit $fail
