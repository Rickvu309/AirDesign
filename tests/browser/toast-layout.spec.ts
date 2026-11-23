import { productCopy } from "../../apps/web/src/copy/product-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { expect } from "@playwright/test"
import { test } from "./deck-test"

for (const width of [320, 480, 735]) {
  test(`Trash Undo and pointer Close fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 })
    await page.goto("/screens/s33-01-decks-trash-deck-moved-toast")
    const close = page.getByRole("button", { name: productCopy.close, exact: true })
    await expect(close).toBeVisible()
    for (const control of [close, page.getByRole("button", { name: undoCopy.undo, exact: true })]) {
      const box = await control.boundingBox()
      expect(box).not.toBeNull()
      if (box === null) throw new Error("Missing toast control")
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
    }
    await close.click()
    await expect(page.getByRole("button", { name: undoCopy.undo, exact: true })).toHaveCount(0)
  })
}

test("state-owned editor status stays until its owning state changes", async ({ page }) => {
  await page.clock.install()
  await page.goto("/screens/s49-02-editor-errors-offline")
  const notice = page.locator("[data-sonner-toast]")
  await expect(notice).toBeVisible()
  await expect(notice.getByRole("button", { name: productCopy.close, exact: true })).toHaveCount(0)
  await page.clock.fastForward(15000)
  await expect(notice).toBeVisible()
})

test("Trash Undo and Close dismiss by touch on a phone", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 }, hasTouch: true })
  try {
    const page = await context.newPage()
    await page.goto("/screens/s33-01-decks-trash-deck-moved-toast")
    await page.getByRole("button", { name: productCopy.close, exact: true }).tap()
    await expect(page.getByRole("button", { name: undoCopy.undo, exact: true })).toHaveCount(0)
  } finally {
    await context.close()
  }
})
