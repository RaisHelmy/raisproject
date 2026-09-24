import { expect, test, type Page } from "@playwright/test";

/**
 * The pages that turn finished work into the next piece of work: projects,
 * assets, and what a result can become (§48, §69, §101, §145).
 */

async function setUp(page: Page) {
  const email = `lib-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Librarian");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "What do you want to create?" })).toBeVisible();

  const orgId = await page.evaluate(async () => {
    const r = await fetch("/api/v1/auth/me", { credentials: "same-origin" });
    return ((await r.json()) as { orgId: string }).orgId;
  });
  await page.evaluate(async (orgId) => {
    const csrf = decodeURIComponent(document.cookie.match(/rais_csrf=([^;]+)/)?.[1] ?? "");
    const headers = { "content-type": "application/json", "x-csrf-token": csrf };
    await fetch("/api/v1/e2e/promote", { method: "POST", headers, body: "{}" });
    await fetch("/api/v1/admin/models/seed", { method: "POST", headers });
    await fetch("/api/v1/admin/balance/deposits", { method: "POST", headers, body: JSON.stringify({ orgId, amountSen: 50000 }) });
  }, orgId);
}

/**
 * Takes an image-to-image model from discovered to enabled, the way an operator
 * would. Nothing in the seeded catalog accepts an image until this runs, which
 * is deliberate: the model ships disabled because Cloudflare publishes no rate.
 */
async function enableImageEditing(page: Page) {
  await page.evaluate(async () => {
    const csrf = decodeURIComponent(document.cookie.match(/rais_csrf=([^;]+)/)?.[1] ?? "");
    const headers = { "content-type": "application/json", "x-csrf-token": csrf };
    const id = encodeURIComponent("@cf/bytedance/stable-diffusion-xl-lightning");
    await fetch(`/api/v1/admin/models/${id}/pricing`, {
      method: "PUT", headers,
      body: JSON.stringify({ unit: "tile_step", providerUsd: { per512Tile: 0.0002, perStep: 0.00004 } }),
    });
    await fetch(`/api/v1/admin/models/${id}/test`, { method: "POST", headers, body: "{}" });
    await fetch(`/api/v1/admin/models/${id}/status`, { method: "PUT", headers, body: JSON.stringify({ status: "enabled" }) });
  });
}

async function generateOnce(page: Page, prompt: string) {
  await page.goto("/create/image");
  await page.getByLabel("Prompt").fill(prompt);
  await page.getByRole("button", { name: "Generate image" }).click();
  await expect(page.getByRole("heading", { name: "Result" })).toBeVisible({ timeout: 30_000 });
}

test("a project can be created and shows the work made inside it", async ({ page }) => {
  await setUp(page);
  await generateOnce(page, "a project result");

  await page.goto("/projects");
  await page.getByLabel("New project").fill("Cyberpunk Movie");
  await page.getByRole("button", { name: "Create project" }).click();

  // The new project appears, alongside the default one the generation went to.
  await expect(page.getByRole("link", { name: /Cyberpunk Movie/ })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("link", { name: /My first project/ }).click();
  await expect(page.getByText(/1 result/)).toBeVisible({ timeout: 15_000 });
});

test("a result can be reopened on the canvas and kept as a template", async ({ page }) => {
  await setUp(page);
  await generateOnce(page, "a reusable result");

  await page.getByRole("button", { name: "Save as template" }).click();
  await expect(page.getByText("Saved to your templates.")).toBeVisible({ timeout: 20_000 });

  await page.goto("/templates");
  await expect(page.getByText("a reusable result")).toBeVisible({ timeout: 15_000 });

  // Opening the graph that made it lands on the canvas.
  await page.goto("/history");
  await page.getByRole("button", { name: "Open" }).first().click();
  await page.getByRole("button", { name: "Open in Canvas" }).click();
  await expect(page).toHaveURL(/\/canvas\//, { timeout: 20_000 });
  await expect(page.locator(".cv-board")).toBeVisible();
});

test("using a result as input is offered only when a model can take one", async ({ page }) => {
  await setUp(page);
  await generateOnce(page, "a first pass");

  // Nothing enabled accepts an image yet, so the action is absent rather than
  // present and leading nowhere.
  await expect(page.getByRole("button", { name: "Use as input" })).toBeHidden();

  await enableImageEditing(page);
  await generateOnce(page, "a second pass");

  await page.getByRole("button", { name: "Use as input" }).click();
  await expect(page.getByRole("heading", { name: "Result" })).toBeHidden();
  // The image is now a chosen reference, visible and removable.
  await expect(page.getByRole("group", { name: /Reference image/ }).getByRole("button", { pressed: true })).toBeVisible();
});

test("history filters narrow what is shown", async ({ page }) => {
  await setUp(page);
  await generateOnce(page, "the only image");

  await page.goto("/history");
  await expect(page.getByText("the only image")).toBeVisible({ timeout: 15_000 });

  // Filtering to a type with nothing in it says so rather than showing nothing.
  await page.getByRole("button", { name: "Videos" }).click();
  await expect(page.getByText("Nothing matches those filters.")).toBeVisible();

  await page.getByRole("button", { name: "Images" }).click();
  await expect(page.getByText("the only image")).toBeVisible();
});

test("assets lists generated files and can delete one", async ({ page }) => {
  await setUp(page);
  await generateOnce(page, "an asset to keep");

  await page.goto("/assets");
  await expect(page.getByRole("heading", { name: "Assets", exact: true })).toBeVisible();
  const cards = page.locator(".card");
  await expect(cards.first()).toBeVisible({ timeout: 15_000 });

  await cards.first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();

  await expect(page.getByText("Nothing stored yet.")).toBeVisible({ timeout: 15_000 });
});

/** A template at its own address, so it can be shared (§53). */
test("a template has a page of its own showing what it does", async ({ page }) => {
  await setUp(page);

  // Make something, then keep it as a template.
  await generateOnce(page, "a shareable picture");
  await page.getByRole("button", { name: "Save as template" }).click();
  await expect(page.getByText("Saved to your templates.")).toBeVisible({ timeout: 20_000 });

  await page.goto("/templates");
  await page.getByRole("link", { name: "a shareable picture" }).click();
  await expect(page).toHaveURL(/\/templates\/[^/]+$/);

  await expect(page.getByRole("heading", { name: "What it does" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What it needs from you" })).toBeVisible();
  // The cost is stated before anyone commits to running it (§92).
  await expect(page.getByText("A run costs about")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use template" })).toBeVisible();
});
