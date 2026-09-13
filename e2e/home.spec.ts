import { expect, test } from "@playwright/test";

test("home page loads with navbar", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "DraftTier" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
});
