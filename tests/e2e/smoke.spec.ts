import { expect, test } from "@playwright/test";

test("loads the landscape game and starts a run", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/SLASHRUSH/);
  await expect(page.locator("canvas")).toBeVisible();
  await page.keyboard.press("Space");
  await page.waitForTimeout(350);
  await expect(page.locator("canvas")).toBeVisible();
});

test("shows the orientation guidance in portrait", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#orientation-lock")).toBeVisible();
  await expect(page.locator("#orientation-lock")).toContainText("가로모드");
});
