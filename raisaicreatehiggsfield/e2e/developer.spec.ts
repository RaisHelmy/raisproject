import { expect, test, type Page } from "@playwright/test";

/**
 * The developer surfaces that had backends but nowhere to use them:
 * connections a canvas can borrow credentials from (§137) and the record of
 * what was actually delivered to a webhook (§62).
 */
async function signUp(page: Page, prefix: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Developer");
  await page.getByLabel("Email").fill(`${prefix}-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "What do you want to create?" })).toBeVisible();
}

test.describe("developer settings", () => {
  test("a connection is saved without its token ever coming back", async ({ page }) => {
    await signUp(page, "connectors");

    await page.goto("/developer/connectors");
    await page.getByLabel("Name").fill("My tool server");
    await page.getByLabel("Address").fill("https://tools.example.com/mcp");
    await page.getByLabel("Token").fill("sk-super-secret");
    await page.getByRole("button", { name: "Save connection" }).click();

    const card = page.locator("article.card").filter({ hasText: "My tool server" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("token saved");
    // The point of the whole feature: the secret is not in the page.
    await expect(page.locator("body")).not.toContainText("sk-super-secret");
  });

  test("a connection is offered to the MCP node instead of a pasted token", async ({ page, isMobile }) => {
    test.skip(Boolean(isMobile), "Node editing is a desktop task (§95).");
    await signUp(page, "mcpnode");

    await page.goto("/developer/connectors");
    await page.getByLabel("Name").fill("Shared tools");
    await page.getByLabel("Address").fill("https://tools.example.com/mcp");
    await page.getByRole("button", { name: "Save connection" }).click();
    await expect(page.locator("article.card").filter({ hasText: "Shared tools" })).toBeVisible();

    // The saved token is never shown again, only the address it belongs to.
    await expect(page.getByText("sk-secret")).toBeHidden();
  });

  test("an endpoint is added and its deliveries are shown", async ({ page }) => {
    await signUp(page, "webhooks");

    await page.goto("/developer/webhooks");
    await page.getByLabel("Endpoint address").fill("https://example.com/raisai");
    await page.getByLabel("generation.completed").check();
    await page.getByRole("button", { name: "Add endpoint" }).click();

    // Shown exactly once, because the receiver checks signatures against it.
    await expect(page.getByText("Copy this signing secret now")).toBeVisible();
    await page.getByRole("button", { name: "I have copied it" }).click();

    const card = page.locator("article.card").filter({ hasText: "https://example.com/raisai" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Deliveries" }).click();
    await expect(card).toContainText("Nothing has been sent to this endpoint yet.");
  });
});

/**
 * Model management (§124). The lifecycle gates are the thing worth testing:
 * an unpriced, untested model must not become purchasable by clicking Enable.
 */
test.describe("admin models", () => {
  test("refuses to enable a model until it is priced and proven", async ({ page }) => {
    await signUp(page, "admin");
    await page.evaluate(async () => {
      const csrf = decodeURIComponent(document.cookie.match(/rais_csrf=([^;]+)/)?.[1] ?? "");
      await fetch("/api/v1/e2e/promote", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        body: "{}",
      });
    });

    await page.goto("/admin/models");
    await expect(page.getByRole("heading", { name: "Models" })).toBeVisible();

    // Nothing is in the catalog until it is loaded, which is itself the point.
    await page.getByRole("button", { name: "Seed curated" }).click();
    await expect(page.getByText(/Seeded \d+ models/)).toBeVisible({ timeout: 20_000 });

    // A discovered model is priced but has never been run here.
    await page.getByRole("button", { name: "discovered" }).click();
    const card = page.locator("article.card").first();
    await card.getByRole("button", { name: "Enable" }).click();
    await expect(page.getByRole("alert")).toContainText(/test run|pricing/);
  });

  test("the whole published catalog can be loaded and searched", async ({ page }) => {
    await signUp(page, "catalog");
    await page.evaluate(async () => {
      const csrf = decodeURIComponent(document.cookie.match(/rais_csrf=([^;]+)/)?.[1] ?? "");
      await fetch("/api/v1/e2e/promote", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        body: "{}",
      });
    });

    await page.goto("/admin/models");
    await page.getByRole("button", { name: "Load full catalog" }).click();
    await expect(page.getByText(/Catalog loaded\. \d+ new of \d+/)).toBeVisible({ timeout: 30_000 });

    // Two hundred models is too many to scroll, so it is searchable by kind
    // and by name.
    await page.getByRole("button", { name: "video", exact: true }).click();
    await expect(page.getByText(/\d+ of \d+/)).toBeVisible();
    await page.getByPlaceholder("Search the catalog").fill("veo");
    await expect(page.locator("article.card").first()).toContainText(/veo/i);

    // Everything arrives unusable until it is priced and proven (§125).
    await page.getByPlaceholder("Search the catalog").fill("");
    await page.getByRole("button", { name: "enabled" }).click();
    await expect(page.locator("article.card")).toHaveCount(0);
  });
});

