import { expect } from "@playwright/test"
import { test } from "./deck-test"

test.use({ reducedMotion: "reduce" })

for (const width of [390, 1470]) {
  for (const screen of ["consent", "connected"]) {
    test(`${screen} separates its title and subtitle at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 923 })
      await page.goto(
        screen === "consent"
          ? "/screens/s71-01-agents-connect-approve-claude"
          : "/screens/s71-02-agents-connect-claude-connected",
      )
      await expect(page.locator("header h1")).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      const separation = await page.locator("header").evaluate((header) => {
        const title = header.querySelector("h1")?.getBoundingClientRect()
        const subtitle = header.querySelector("p")?.getBoundingClientRect()
        if (!title || !subtitle) throw new Error("Connection header is missing")
        return subtitle.top + subtitle.height / 2 - title.top - title.height / 2
      })
      expect(separation).toBeGreaterThanOrEqual(28)
    })
  }
}
