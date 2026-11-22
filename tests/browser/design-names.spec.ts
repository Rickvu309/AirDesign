import { expect, type Page } from "@playwright/test"
import { test } from "./deck-test"
import { openDeck, sharedNames, unfoldAll } from "./design-panel"

test.use({ viewport: { width: 1600, height: 1000 } })

async function namesOnSlide(page: Page): Promise<Record<string, string[]>> {
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const panel = page.locator("[data-design-element]")
  const keys = await page
    .locator("[data-slide-paint] [data-canvas-element]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-canvas-element") ?? ""))
  const shared: Record<string, string[]> = {}
  for (const key of keys) {
    await page.locator(`[data-slide-paint] [data-canvas-element="${key}"]`).focus()
    await expect(panel).toHaveAttribute("data-design-element", new RegExp(`\\.${key.split("#")[1]}$`))
    await unfoldAll(panel)
    shared[key] = await sharedNames(panel)
  }
  return shared
}

for (const deck of ["shapes-added.pptx", "connectors.pptx", "clean.pptx", "picture-png.pptx"]) {
  test(`every control in the design panel has a name of its own, for each element of ${deck}`, async ({ page }) => {
    await openDeck(page, deck)
    const shared = await namesOnSlide(page)
    expect(Object.keys(shared).length).toBeGreaterThan(0)
    expect(Object.entries(shared).filter(([, names]) => names.length > 0)).toEqual([])
  })
}
