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
  await expect(page.locator("canvas")).toBeHidden();
});

test("fits a 16:9 game canvas in mobile landscape", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile-landscape", "Landscape viewport is covered by the mobile project.");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await expect(page.locator("#orientation-lock")).toBeHidden();
  const canvasBox = await page.locator("canvas").boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(canvasBox!.width / canvasBox!.height).toBeCloseTo(16 / 9, 2);
  expect(canvasBox!.width).toBeLessThanOrEqual(844);
  expect(canvasBox!.height).toBeLessThanOrEqual(390);
});

test("exposes deterministic combo, fever, hurt, and boss effect states in local QA", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => {
    return Boolean((window as unknown as { __slashRushDebug?: unknown }).__slashRushDebug);
  });
  await page.evaluate(() => {
    (window as unknown as { __slashRushDebug: { startRunner: () => void } }).__slashRushDebug.startRunner();
  });
  await page.waitForTimeout(150);

  await page.evaluate(() => {
    const debug = (window as unknown as { __slashRushDebug: { triggerCombo: () => void; triggerFever: () => void; triggerHurt: () => void } }).__slashRushDebug;
    debug.triggerCombo();
    debug.triggerFever();
    debug.triggerHurt();
  });
  const runnerState = await page.evaluate(() => {
    return (window as unknown as { __slashRushDebug: { getState: () => unknown } }).__slashRushDebug.getState();
  });
  expect(runnerState).toMatchObject({ mode: "runner", combo: 1, feverActive: true, hurt: true });

  await page.evaluate(() => {
    (window as unknown as { __slashRushDebug: { startBoss: () => void; triggerCombo: () => void; triggerFever: () => void } }).__slashRushDebug.startBoss();
    (window as unknown as { __slashRushDebug: { triggerCombo: () => void } }).__slashRushDebug.triggerCombo();
    (window as unknown as { __slashRushDebug: { triggerFever: () => void } }).__slashRushDebug.triggerFever();
  });
  await page.waitForTimeout(100);
  const bossState = await page.evaluate(() => {
    return (window as unknown as { __slashRushDebug: { getState: () => unknown } }).__slashRushDebug.getState();
  });
  expect(bossState).toMatchObject({ mode: "boss", bossCombo: 1, bossFeverActive: true });
  await expect(page.locator("canvas")).toBeVisible();
});
