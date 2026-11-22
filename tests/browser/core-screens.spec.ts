import { expect } from "@playwright/test"
import { coreRoutes } from "../../apps/web/src/core/core-routes"
import { test } from "./deck-test"
import { openScreen } from "./open-screen"

for (const [name, path] of Object.entries(coreRoutes)) {
  test(`${name} paints each line of text inside the width the layout gave it`, async ({ page }) => {
    await openScreen(page, path)
    await page.locator("[data-scene-slide]").waitFor()
    await expect(page.locator("[data-fonts-pending]")).toHaveCount(0)
    const lines = await page.locator("[data-line]").count()
    expect(lines).toBeGreaterThan(0)
    const overflowing = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-line]")]
        .filter((line) => line.scrollWidth > line.clientWidth + 1)
        .map((line) => line.textContent),
    )
    expect(overflowing).toEqual([])
  })
}
