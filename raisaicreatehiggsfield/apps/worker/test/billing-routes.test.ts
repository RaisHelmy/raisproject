import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { findForbiddenCustomerFields, newId } from "@raisai/shared";
import { createApp } from "../src/app";
import { LedgerService } from "../src/services/ledger-service";

interface Signup {
  cookie: string;
  csrf: string;
  orgId: string;
  userId: string;
}

async function signup(app: ReturnType<typeof createApp>, opts: { admin?: boolean } = {}): Promise<Signup> {
  const email = `bill-${newId()}@example.com`;
  const res = await app.request(
    "/api/v1/auth/signup",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "password123", name: "Biller" }) },
    env,
  );
  const cookies = res.headers.getSetCookie();
  const session = cookies.find((c) => c.startsWith("rais_session="))!.split(";")[0]!;
  const csrfCookie = cookies.find((c) => c.startsWith("rais_csrf="))!.split(";")[0]!;
  const csrf = csrfCookie.split("=").slice(1).join("=");
  const body = (await res.json()) as { user: { id: string }; orgId: string };
  if (opts.admin) {
    await env.DB.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).bind(body.user.id).run();
  }
  return { cookie: `${session}; ${csrfCookie}`, csrf, orgId: body.orgId, userId: body.user.id };
}

describe("billing routes", () => {
  it("returns a zero balance for a new workspace", async () => {
    const app = createApp();
    const user = await signup(app);
    const res = await app.request("/api/v1/balance", { headers: { cookie: user.cookie } }, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ availableSen: 0, reservedSen: 0, currency: "MYR" });
  });

  it("requires authentication", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/balance", {}, env);
    expect(res.status).toBe(401);
  });

  it("lists transactions newest first", async () => {
    const app = createApp();
    const user = await signup(app);
    const ledger = new LedgerService(env);
    await ledger.deposit(user.orgId, 5000);
    const { reservationId } = await ledger.reserve(user.orgId, 200);
    await ledger.settleReservation(reservationId, 175);

    const res = await app.request("/api/v1/balance/transactions", { headers: { cookie: user.cookie } }, env);
    const body = (await res.json()) as { items: { type: string }[] };
    expect(body.items.length).toBe(4);
    expect(body.items[0]!.type).toMatch(/charge|refund/);
  });

  it("blocks non-admins from the manual deposit route", async () => {
    const app = createApp();
    const user = await signup(app);
    const res = await app.request(
      "/api/v1/admin/balance/deposits",
      {
        method: "POST",
        headers: { cookie: user.cookie, "content-type": "application/json", "x-csrf-token": user.csrf },
        body: JSON.stringify({ orgId: user.orgId, amountSen: 5000 }),
      },
      env,
    );
    expect(res.status).toBe(403);
  });

  it("lets an admin deposit and records an audit event", async () => {
    const app = createApp();
    const admin = await signup(app, { admin: true });
    const res = await app.request(
      "/api/v1/admin/balance/deposits",
      {
        method: "POST",
        headers: { cookie: admin.cookie, "content-type": "application/json", "x-csrf-token": admin.csrf },
        body: JSON.stringify({ orgId: admin.orgId, amountSen: 5000, note: "Launch credit" }),
      },
      env,
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ balance: { availableSen: 5000 } });

    const audit = await env.DB.prepare(`SELECT event FROM audit_log WHERE actor_user_id = ? AND event = 'balance.deposit'`)
      .bind(admin.userId)
      .first<{ event: string }>();
    expect(audit?.event).toBe("balance.deposit");
  });

  it("rejects a mutation without the CSRF token", async () => {
    const app = createApp();
    const admin = await signup(app, { admin: true });
    const res = await app.request(
      "/api/v1/admin/balance/deposits",
      {
        method: "POST",
        headers: { cookie: admin.cookie, "content-type": "application/json" },
        body: JSON.stringify({ orgId: admin.orgId, amountSen: 5000 }),
      },
      env,
    );
    expect(res.status).toBe(403);
  });

  // ADR-006: the guard that keeps provider economics out of customer payloads.
  it("never leaks admin-only fields in customer billing payloads", async () => {
    const app = createApp();
    const user = await signup(app);
    const ledger = new LedgerService(env);
    await ledger.deposit(user.orgId, 5000);
    const { reservationId } = await ledger.reserve(user.orgId, 100);
    await ledger.settleReservation(reservationId, 130); // includes an overage charge

    for (const path of ["/api/v1/balance", "/api/v1/balance/transactions"]) {
      const res = await app.request(path, { headers: { cookie: user.cookie } }, env);
      const body = await res.json();
      expect(findForbiddenCustomerFields(body), `leak in ${path}`).toEqual([]);
      // Accounting deltas are admin-only detail; customers see amount + balance.
      expect(JSON.stringify(body)).not.toContain("DeltaSen");
    }
  });
});
