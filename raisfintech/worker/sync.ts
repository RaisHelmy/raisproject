/**
 * Broker synchronization engine.
 *
 * Pages read normalized data from D1; they never call broker APIs directly.
 * Sync runs (a) on connect, (b) on explicit user refresh, and (c) from the
 * Cron trigger, which picks up connections whose sync interval has lapsed.
 * Every run writes a sync log; errors mark the connection needs_attention
 * with a user-safe message (raw provider errors stay in the log).
 */

import type { Env } from "./types";
import { getProviderEntry } from "./providers/registry";
import { IntegrationPendingError } from "./providers/types";

export interface ConnectionRow {
  id: string;
  user_id: string;
  provider_id: string;
  status: string;
  environment: string;
  label: string | null;
  sync_interval_min: number;
  last_sync_at: string | null;
  last_sync_status: string | null;
  created_at: string;
}

export async function syncConnection(env: Env, conn: ConnectionRow): Promise<void> {
  const startedAt = new Date().toISOString();
  const entry = getProviderEntry(conn.provider_id);

  const log = (status: "ok" | "error", message: string) =>
    env.DB.prepare(
      "INSERT INTO investment_sync_logs (id, connection_id, user_id, status, message, started_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(crypto.randomUUID(), conn.id, conn.user_id, status, message, startedAt)
      .run();

  if (!entry) {
    await log("error", `Unknown provider: ${conn.provider_id}`);
    return;
  }

  await env.DB.prepare("UPDATE investment_connections SET status = 'syncing' WHERE id = ?")
    .bind(conn.id)
    .run();

  try {
    const client = entry.makeClient(env, conn.user_id);
    const accounts = await client.getAccounts();

    for (const acct of accounts) {
      // Upsert account by (connection, provider_account_id) — internal ids stay stable.
      let row = await env.DB.prepare(
        "SELECT id FROM investment_accounts WHERE connection_id = ? AND provider_account_id = ?"
      )
        .bind(conn.id, acct.providerAccountId)
        .first<{ id: string }>();

      if (row) {
        await env.DB.prepare(
          "UPDATE investment_accounts SET name = ?, type = ?, currency = ?, cash_balance = ? WHERE id = ?"
        )
          .bind(acct.name, acct.type, acct.currency, acct.cashBalance, row.id)
          .run();
      } else {
        row = { id: crypto.randomUUID() };
        await env.DB.prepare(
          "INSERT INTO investment_accounts (id, connection_id, user_id, provider_account_id, name, type, currency, cash_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
          .bind(row.id, conn.id, conn.user_id, acct.providerAccountId, acct.name, acct.type, acct.currency, acct.cashBalance)
          .run();
      }
      const accountId = row.id;

      // Holdings: replace the account's snapshot atomically in one batch.
      const positions = await client.getPositions(acct.providerAccountId);
      const stmts = [
        env.DB.prepare("DELETE FROM investment_holdings WHERE account_id = ?").bind(accountId),
        ...positions.map((p) =>
          env.DB.prepare(
            `INSERT INTO investment_holdings
             (id, account_id, user_id, symbol, name, provider_security_id, quantity, avg_cost, last_price, currency, market_value, asset_class, shariah_status, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())`
          ).bind(
            crypto.randomUUID(),
            accountId,
            conn.user_id,
            p.symbol,
            p.name,
            p.providerSecurityId ?? null,
            p.quantity,
            p.avgCost ?? null,
            p.lastPrice,
            p.currency,
            +(p.quantity * p.lastPrice).toFixed(2),
            p.assetClass ?? null,
            p.shariahStatus ?? null
          )
        ),
      ];
      await env.DB.batch(stmts);

      // Transactions & dividends: append-only, idempotent on provider ids.
      const txs = await client.getTransactions(acct.providerAccountId);
      if (txs.length) {
        await env.DB.batch(
          txs.map((t) =>
            env.DB.prepare(
              `INSERT INTO investment_transactions
               (id, account_id, user_id, provider_transaction_id, type, symbol, quantity, price, amount, currency, occurred_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT (account_id, provider_transaction_id) DO NOTHING`
            ).bind(
              crypto.randomUUID(),
              accountId,
              conn.user_id,
              t.providerTransactionId,
              t.type,
              t.symbol ?? null,
              t.quantity ?? null,
              t.price ?? null,
              t.amount,
              t.currency,
              t.occurredAt
            )
          )
        );
      }

      const divs = await client.getDividends(acct.providerAccountId);
      if (divs.length) {
        await env.DB.batch(
          divs.map((d) =>
            env.DB.prepare(
              `INSERT INTO investment_dividends
               (id, account_id, user_id, provider_dividend_id, symbol, amount, currency, pay_date)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT (account_id, provider_dividend_id) DO NOTHING`
            ).bind(crypto.randomUUID(), accountId, conn.user_id, d.providerDividendId, d.symbol, d.amount, d.currency, d.payDate)
          )
        );
      }
    }

    await env.DB.prepare(
      "UPDATE investment_connections SET status = 'connected', last_sync_at = now(), last_sync_status = 'ok' WHERE id = ?"
    )
      .bind(conn.id)
      .run();
    await log("ok", `Synced ${accounts.length} account(s).`);
  } catch (e) {
    const pending = e instanceof IntegrationPendingError;
    // Raw provider errors go to the log, never to the connection row the UI reads.
    await env.DB.prepare(
      "UPDATE investment_connections SET status = ?, last_sync_status = 'error' WHERE id = ?"
    )
      .bind(pending ? "disconnected" : "needs_attention", conn.id)
      .run();
    await log("error", e instanceof Error ? e.message : String(e));
  }
}

/** Cron entry point: sync every connection whose interval has lapsed. */
export async function syncDueConnections(env: Env): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM investment_connections
     WHERE status IN ('connected', 'needs_attention')
       AND (last_sync_at IS NULL OR last_sync_at::timestamp + (sync_interval_min || ' minutes')::interval <= now())
     LIMIT 10`
  ).all<ConnectionRow>();
  for (const conn of results) await syncConnection(env, conn);
  return results.length;
}
