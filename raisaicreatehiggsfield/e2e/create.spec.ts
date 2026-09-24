import { expect, test, type Page } from "@playwright/test";

/**
 * The loop CLAUDE.md sets as the bar: a beginner signs up, gets balance, and
 * creates an image, seeing what it cost (§147, "a beginner can create an image
 * in 30 seconds").
 */

const password = "password123";

async function signUp(page: Page): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Smoke Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "What do you want to create?" })).toBeVisible();
  return email;
}

/** Grants admin and balance the way an operator would, through the API. */
async function grantBalance(page: Page, email: string): Promise<void> {
  const orgId = await page.evaluate(async () => {
    const res = await fetch("/api/v1/auth/me", { credentials: "same-origin" });
    return ((await res.json()) as { orgId: string }).orgId;
  });

  const result = await page.evaluate(
    async ({ orgId }) => {
      const csrf = document.cookie.match(/rais_csrf=([^;]+)/)?.[1] ?? "";
      const headers = { "content-type": "application/json", "x-csrf-token": decodeURIComponent(csrf) };
      // The e2e worker exposes an admin promote helper only when APP_ENV is e2e.
      await fetch("/api/v1/e2e/promote", { method: "POST", headers, body: "{}" });
      await fetch("/api/v1/admin/models/seed", { method: "POST", headers });
      const deposit = await fetch("/api/v1/admin/balance/deposits", {
        method: "POST",
        headers,
        body: JSON.stringify({ orgId, amountSen: 5000, note: "Smoke test credit" }),
      });
      return deposit.status;
    },
    { orgId },
  );
  expect(result).toBe(201);
}

test("a new user signs up, adds balance and creates an image", async ({ page }) => {
  const email = await signUp(page);
  await grantBalance(page, email);

  await page.goto("/create/image");
  await expect(page.getByRole("heading", { name: "Create an image" })).toBeVisible();

  await page.getByLabel("Prompt").fill("a rainy cyberpunk street in Kuala Lumpur");

  // A price is shown before anything is spent (§4, §92). Scoped to the
  // estimate itself so it cannot pass on the balance chip by accident.
  const estimate = page.locator("text=Estimated cost").locator("xpath=following-sibling::span[1]");
  await expect(estimate).toHaveText(/^RM\d/);

  await page.getByRole("button", { name: "Generate image" }).click();

  await expect(page.getByRole("heading", { name: "Result" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Charged")).toBeVisible();
  await expect(page.getByText("Remaining balance")).toBeVisible();
  await expect(page.locator("img[alt*='rainy cyberpunk']")).toBeVisible();
});

test("the generation appears in history with its cost", async ({ page }) => {
  const email = await signUp(page);
  await grantBalance(page, email);

  await page.goto("/create/image");
  await page.getByLabel("Prompt").fill("a neon alley");
  await page.getByRole("button", { name: "Generate image" }).click();
  await expect(page.getByRole("heading", { name: "Result" })).toBeVisible({ timeout: 30_000 });

  await page.goto("/history");
  await expect(page.getByText("a neon alley")).toBeVisible();
  // Scoped to the result's own card. Loose matches pick up the status filter's
  // "Completed" option and the sidebar balance, which is hidden on mobile.
  const card = page.locator("article.card").filter({ hasText: "a neon alley" });
  await expect(card.locator(".badge").filter({ hasText: "Completed" })).toBeVisible();
  await expect(card.getByText(/RM\d/)).toBeVisible();
});

test("running without balance explains the shortfall instead of failing silently", async ({ page }) => {
  const email = await signUp(page);
  // Seed models but grant no balance.
  await page.evaluate(async () => {
    const csrf = document.cookie.match(/rais_csrf=([^;]+)/)?.[1] ?? "";
    const headers = { "content-type": "application/json", "x-csrf-token": decodeURIComponent(csrf) };
    await fetch("/api/v1/e2e/promote", { method: "POST", headers, body: JSON.stringify({ email: "" }) });
    await fetch("/api/v1/admin/models/seed", { method: "POST", headers });
  });
  expect(email).toBeTruthy();

  await page.goto("/create/image");
  await page.getByLabel("Prompt").fill("something expensive");
  await page.getByRole("button", { name: "Generate image" }).click();

  // Scoped to the blocking panel: the passive low-balance banner offers the
  // same link, and both being present is correct.
  const panel = page.getByRole("alert").filter({ hasText: "Not enough balance" });
  await expect(panel).toBeVisible({ timeout: 20_000 });
  await expect(panel.getByRole("link", { name: "Add balance" })).toBeVisible();
  await expect(panel.getByText("Estimated cost")).toBeVisible();
});

/** Favourites and recently used (§90), both personal to the signed-in user. */
test("a model can be favourited and shows up under My models", async ({ page }) => {
  const email = `favourite-${Date.now()}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Chooser");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "What do you want to create?" })).toBeVisible();

  await page.evaluate(async () => {
    const csrf = decodeURIComponent(document.cookie.match(/rais_csrf=([^;]+)/)?.[1] ?? "");
    const headers = { "content-type": "application/json", "x-csrf-token": csrf };
    await fetch("/api/v1/e2e/promote", { method: "POST", headers, body: "{}" });
    await fetch("/api/v1/admin/models/seed", { method: "POST", headers });
  });

  await page.goto("/create/image");
  // Nothing is favourited yet, so the group is not offered at all.
  await expect(page.getByRole("button", { name: "My models", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: /Add .* to my models/ }).first().click();
  await page.getByRole("button", { name: "My models", exact: true }).click();
  await expect(page.locator(".list-group-item")).toHaveCount(1);
});
