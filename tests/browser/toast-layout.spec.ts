import { productCopy } from "../../apps/web/src/copy/product-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { expect } from "@playwright/test"
import { test } from "./deck-test"

test("a normal deck name stays whole on the trash notice", async ({ page }) => {
  await page.setViewportSize({ width: 1470, height: 923 })
  await page.goto("/screens/s33-01-decks-trash-deck-moved-toast")
  const name = "Pricing Strategy Review"
  const notice = page.locator("[data-sonner-toast]")
  await expect(notice).toContainText(`${name} moved to Trash`)
  const deck = notice.locator("bdi")
  await expect(deck).toHaveText(name)
  const cut = await deck.evaluate((element) => {
    const style = getComputedStyle(element)
    const clamp = style.webkitLineClamp !== "none" && style.webkitLineClamp !== ""
    const tall = element.scrollHeight > element.clientHeight + 1
    const wide = element.scrollWidth > element.clientWidth + 1
    return { clamp, tall, wide, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }
  })
  expect(cut.clamp ? cut.tall : cut.wide).toBe(false)
  const action = notice.locator("span").filter({ hasText: /^moved to Trash$/ })
  await expect(action).toHaveText("moved to Trash")
  const actionCut = await action.evaluate((element) => element.scrollWidth > element.clientWidth + 1)
  expect(actionCut).toBe(false)
})

test("a long deck name and the phrase after it share one left edge", async ({ page }) => {
  await page.setViewportSize({ width: 1470, height: 923 })
  await page.goto("/screens/s33-01-decks-trash-deck-moved-toast")
  const notice = page.locator("[data-sonner-toast]")
  const deck = notice.locator("bdi")
  await deck.evaluate((element) => {
    element.textContent = "Quarterly pricing review for regional leads"
  })
  const phrase = notice.locator("span").filter({ hasText: /^moved to Trash$/ })
  const [deckBox, phraseBox] = await Promise.all([deck.boundingBox(), phrase.boundingBox()])
  if (deckBox === null || phraseBox === null) throw new Error("Missing notice parts")
  expect(phraseBox.y).toBeGreaterThan(deckBox.y + deckBox.height - 1)
  expect(Math.abs(phraseBox.x - deckBox.x)).toBeLessThanOrEqual(0.5)
})

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
