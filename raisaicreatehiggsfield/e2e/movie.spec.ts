import { expect, test, type Page } from "@playwright/test";

/**
 * The flow CLAUDE.md opens with: "I want to make a movie." Idea to storyboard
 * to timeline to export, without ever seeing a node graph (§86, §162).
 */
test.describe("movie mode", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "Movie editing is a desktop task (§95).");

  async function setUp(page: Page) {
    const email = `movie-${Date.now()}@example.test`;
    await page.goto("/signup");
    await page.getByLabel("Name").fill("Director");
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
      await fetch("/api/v1/admin/balance/deposits", {
        method: "POST", headers, body: JSON.stringify({ orgId, amountSen: 50000 }),
      });
    }, orgId);
  }

  test("an idea becomes a storyboard, a timeline and an export", async ({ page }) => {
    await setUp(page);

    // Movie mode is reached from the Create hub, not the sidebar.
    await page.goto("/create");
    await page.getByRole("link", { name: /Movie/ }).click();
    await expect(page.getByRole("heading", { name: "Movies", exact: true })).toBeVisible();

    await page.getByLabel("Title").fill("Neon Rain");
    await page.getByLabel("What is it about?").fill("A cyberpunk detective story set in Kuala Lumpur");
    await page.getByRole("button", { name: "Start a movie" }).click();

    // Story
    await expect(page.getByRole("button", { name: "Write the story" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Write the story" }).click();
    await expect(page.getByText("The Call")).toBeVisible({ timeout: 30_000 });

    // Characters: the story populated the cast, and appearance is editable
    // because it is what gets carried into every shot (§33, §34).
    await page.getByRole("button", { name: "Characters" }).click();
    const card = page.locator("article.card").filter({ hasText: "Aiman" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Appearance").fill("Grey coat, stubble, tired eyes");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("article.card").filter({ hasText: "Grey coat, stubble" })).toBeVisible();

    // Storyboard: generate one shot and see it appear with its cost.
    await page.getByRole("button", { name: "Storyboard" }).click();
    await expect(page.getByText("Rain over the night market")).toBeVisible();
    await page.getByRole("button", { name: "Generate", exact: true }).first().click();
    await expect(page.locator("img[alt*='Rain over the night market']")).toBeVisible({ timeout: 30_000 });

    // A shot keeps every take, and camera settings can be changed (§38, §41).
    await page.getByRole("button", { name: /Shot 1 settings and versions/ }).click();
    const shotDialog = page.getByRole("dialog");
    await expect(shotDialog.getByText("v1")).toBeVisible();
    await expect(shotDialog.getByText("In use")).toBeVisible();
    await shotDialog.getByLabel("Lens").selectOption("anamorphic");
    await shotDialog.getByRole("button", { name: "Save" }).click();
    await expect(shotDialog).toBeHidden();

    // Regenerating keeps the first take rather than replacing it.
    await page.getByRole("button", { name: "Regenerate" }).first().click();
    await page.getByRole("button", { name: /Shot 1 settings and versions/ }).click();
    await expect(page.getByRole("dialog").getByText("v2")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("dialog").getByText("v1")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    // Timeline: built from the shots that exist.
    await page.getByRole("button", { name: "Timeline" }).click();
    await page.getByRole("button", { name: "Rebuild from shots" }).click();
    await expect(page.getByText(/Total length/)).toBeVisible({ timeout: 20_000 });

    // Export: the cut, the subtitles, and a way to assemble them.
    await page.getByRole("button", { name: "Export" }).click();
    await page.getByRole("button", { name: "Export the movie" }).click();
    await expect(page.getByRole("link", { name: "Edit list (JSON)" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: /Render script/ })).toBeVisible();
    // The boundary is stated on screen: a Worker cannot mux video itself.
    await expect(page.getByRole("status").filter({ hasText: "ffmpeg" })).toBeVisible();
  });
});
