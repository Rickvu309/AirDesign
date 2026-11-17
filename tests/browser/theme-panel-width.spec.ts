import { expect, test } from "@playwright/test"
import { openDeck } from "./design-panel"

test.use({ viewport: { width: 1470, height: 923 } })

test("every theme color name stays readable at 220, 240 and 440 px", async ({ page }) => {
  await openDeck(page, "clean.pptx")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const resize = page.getByRole("separator")
  for (const width of [220, 240, 440]) {
    await resize.focus()
    await resize.press("Home")
    for (let at = 220; at < width; at += 10) await resize.press("ArrowLeft")
    const names = await page
      .locator("[data-design-theme] [data-control=hex] span[id]")
      .evaluateAll((spans) =>
        spans.filter((span) => span.clientWidth < span.scrollWidth).map((span) => span.textContent),
      )
    expect(names, String(width)).toEqual([])
  }
})
