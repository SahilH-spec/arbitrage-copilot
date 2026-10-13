import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";
import { config, isConfigured } from "../config";
import { db } from "../db/client";
import { agentSettings, transactions } from "../db/schema";
import { eq } from "drizzle-orm";
import { decryptSecret, encryptSecret, isEncrypted } from "../lib/crypto";
import { validEncryptionKey } from "../config";

let client: PlaidApi | null = null;

function getClient(): PlaidApi {
  if (!client) {
    const configuration = new Configuration({
      basePath: PlaidEnvironments[config.plaid.env] || PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": config.plaid.clientId,
          "PLAID-SECRET": config.plaid.secret,
        },
      },
    });
    client = new PlaidApi(configuration);
  }
  return client;
}

// ─── Settings helpers (store Plaid item state in agent_settings) ──────────────
async function getSetting(key: string): Promise<unknown> {
  const [row] = await db.select().from(agentSettings).where(eq(agentSettings.key, key));
  return row?.value ?? null;
}
async function setSetting(key: string, value: unknown) {
  await db.insert(agentSettings).values({ key, value: value as never })
    .onConflictDoUpdate({ target: agentSettings.key, set: { value: value as never, updatedAt: new Date() } });
}

// The Plaid access token is a long-lived credential to the bank connection. It is stored
// AES-256-GCM encrypted. A legacy plaintext value (from before encryption was added) is
// accepted once and re-saved encrypted.
async function getAccessToken(): Promise<string | null> {
  const stored = await getSetting("plaid_access_token");
  if (typeof stored !== "string" || !stored) return null;
  if (isEncrypted(stored)) return decryptSecret(stored);
  if (validEncryptionKey(config.security.encryptionKey)) {
    await setSetting("plaid_access_token", encryptSecret(stored));
  }
  return stored;
}

export async function isBankConnected(): Promise<boolean> {
  return !!(await getSetting("plaid_access_token"));
}

// ─── Link token (frontend Plaid Link uses this) ──────────────────────────────
export async function createLinkToken(): Promise<string> {
  if (!isConfigured.plaid) throw new Error("Plaid not configured");
  const resp = await getClient().linkTokenCreate({
    user: { client_user_id: "arbitrage-copilot-owner" },
    client_name: "Arbitrage Copilot",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
  });
  return resp.data.link_token;
}

// ─── Exchange the public token from Plaid Link for an access token ───────────
export async function exchangePublicToken(publicToken: string): Promise<void> {
  const resp = await getClient().itemPublicTokenExchange({ public_token: publicToken });
  await setSetting("plaid_access_token", encryptSecret(resp.data.access_token));
  await setSetting("plaid_item_id", resp.data.item_id);
  await setSetting("plaid_cursor", null);
}

// ─── Account balances ─────────────────────────────────────────────────────────
export async function getAccounts() {
  const accessToken = await getAccessToken();
  if (!accessToken) return [];
  const resp = await getClient().accountsBalanceGet({ access_token: accessToken });
  return resp.data.accounts.map((a) => ({
    id: a.account_id,
    name: a.name,
    officialName: a.official_name,
    mask: a.mask,
    type: a.type,
    subtype: a.subtype,
    available: a.balances.available,
    current: a.balances.current,
    currency: a.balances.iso_currency_code,
  }));
}

// ─── Sync transactions into the accounting ledger ─────────────────────────────
export async function syncTransactions(): Promise<{ added: number }> {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("No bank connected");

  let cursor = ((await getSetting("plaid_cursor")) as string | null) || undefined;
  let added = 0;
  let hasMore = true;

  while (hasMore) {
    const resp = await getClient().transactionsSync({
      access_token: accessToken,
      cursor,
      count: 250,
    });
    const data = resp.data;

    for (const t of data.added) {
      // Plaid: positive amount = money leaving the account (expense); negative = inflow (income)
      const isExpense = t.amount > 0;
      const category = t.personal_finance_category?.primary?.toLowerCase()
        || t.category?.[0]?.toLowerCase()
        || "other";
      await db.insert(transactions).values({
        date: t.date,
        type: isExpense ? "expense" : "income",
        category,
        description: t.merchant_name || t.name,
        amount: Math.abs(t.amount).toFixed(2),
        orderId: t.transaction_id,
        notes: "Imported from bank (Plaid)",
      });
      added++;
    }

    cursor = data.next_cursor;
    hasMore = data.has_more;
    await setSetting("plaid_cursor", cursor);
  }

  return { added };
}

export async function disconnectBank(): Promise<void> {
  const accessToken = await getAccessToken();
  if (accessToken) {
    try { await getClient().itemRemove({ access_token: accessToken }); } catch { /* ignore */ }
  }
  await setSetting("plaid_access_token", null);
  await setSetting("plaid_item_id", null);
  await setSetting("plaid_cursor", null);
}
