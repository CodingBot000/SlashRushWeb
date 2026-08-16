import { expect, test } from "@playwright/test";

test("loads the source-derived menu, runner, and boss flow", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/SLASHRUSH/);
  await expect(page.locator("canvas")).toBeVisible();
  await page.keyboard.press("Space");
  await page.waitForTimeout(350);
  await page.mouse.click(945, 260);
  await page.waitForTimeout(500);
  await page.keyboard.press("b");
  await page.waitForTimeout(350);
  await expect(page.locator("canvas")).toBeVisible();
});

test("shows the orientation guidance in portrait", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#orientation-lock")).toBeVisible();
  await expect(page.locator("#orientation-lock")).toContainText("가로모드");
});
