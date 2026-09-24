import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";

describe("Postgres migrations", () => {
  it("creates the expected core tables", async () => {
    const { results } = await env.DB.prepare(
      "SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    ).all<{ name: string }>();
    const names = results.map((r: { name: string }) => r.name);
    for (const table of [
      "users", "organizations", "organization_members", "sessions", "api_keys", "mcp_tokens", "audit_log",
      "projects", "project_members",
      "models", "model_pricing", "model_favorites", "model_usage_stats",
      "assets", "asset_versions",
      "generations", "generation_inputs", "generation_outputs",
      "workflows", "workflow_versions", "workflow_drafts", "workflow_runs", "node_runs", "node_cache",
      "templates", "template_versions",
      "balances", "balance_transactions", "payments", "usage_records",
      "webhooks", "webhook_deliveries", "connectors",
    ]) {
      expect(names, `missing table ${table}`).toContain(table);
    }
  });

  it("round-trips a user row", async () => {
    await env.DB.prepare(
      "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)",
    ).bind("usr_test1", "test@example.com", "hash", "Test User").run();
    const row = await env.DB.prepare("SELECT email FROM users WHERE id = ?").bind("usr_test1").first<{ email: string }>();
    expect(row?.email).toBe("test@example.com");
  });
});
