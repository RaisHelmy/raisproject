import { expect, test } from "@playwright/test";

/** The usage dashboard loads its charts lazily and reports real spending (§73). */
test("usage shows what was spent after a generation", async ({ page }) => {
  const email = `usage-${Date.now()}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Usage Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "What do you want to create?" })).toBeVisible();

  const orgId = await page.evaluate(async () => {
    const res = await fetch("/api/v1/auth/me", { credentials: "same-origin" });
    return ((await res.json()) as { orgId: string }).orgId;
  });
  await page.evaluate(async (orgId) => {
    const csrf = decodeURIComponent(document.cookie.match(/rais_csrf=([^;]+)/)?.[1] ?? "");
    const headers = { "content-type": "application/json", "x-csrf-token": csrf };
    await fetch("/api/v1/e2e/promote", { method: "POST", headers, body: "{}" });
    await fetch("/api/v1/admin/models/seed", { method: "POST", headers });
    await fetch("/api/v1/admin/balance/deposits", {
      method: "POST", headers, body: JSON.stringify({ orgId, amountSen: 5000 }),
    });
  }, orgId);

  await page.goto("/create/image");
  await page.getByLabel("Prompt").fill("a chart-worthy image");
  await page.getByRole("button", { name: "Generate image" }).click();
  await expect(page.getByRole("heading", { name: "Result" })).toBeVisible({ timeout: 30_000 });

  await page.goto("/usage");
  await expect(page.getByRole("heading", { name: "Usage" })).toBeVisible();
  // The charts arrive in a lazily loaded chunk, so allow for the fetch.
  await expect(page.getByText("Daily spending")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Generations").first()).toBeVisible();
  await expect(page.locator(".highcharts-container").first()).toBeVisible();
});
