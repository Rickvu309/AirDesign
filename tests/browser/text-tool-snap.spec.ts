import { expect, type Locator, type Page } from "@playwright/test"
import { test } from "./deck-test"

async function frameOf(text: Locator) {
  return text.evaluate((node) => {
    const box = node.closest("[data-canvas-element]")?.getBoundingClientRect()
    return box === undefined ? [] : [box.x, box.y, box.width, box.height]
  })
}

async function slideBox(page: Page) {
  const box = await page.locator("[data-slide-paint]").first().boundingBox()
  if (box === null) throw new Error("slide")
  return box
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("a Text tool drag snaps to a layer's edge and the slide's centre with a red guide, and Control turns it off", async ({
  page,
  decks,
}) => {
  await decks.blank()
  const slide = await slideBox(page)
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  const guides = page.locator("[data-slide-paint] [data-guides]")
  await page
    .locator("[data-slide-paint]")
    .first()
    .click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("t")
  await page.mouse.click(slide.x + 120, slide.y + 80)
  await page.keyboard.type("Anchor", { delay: 10 })
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
  const anchor = await frameOf(texts.first())

  const middle = slide.x + slide.width / 2
  await page.keyboard.press("t")
  await page.mouse.move(slide.x + 123, slide.y + 220)
  await page.mouse.down()
  await page.mouse.move(slide.x + 300, slide.y + 260, { steps: 4 })
  await page.mouse.move(middle - 3, slide.y + 300, { steps: 4 })
  await expect(guides).toBeVisible()
  await expect(page.locator("[data-text-drawn]")).toBeVisible()
  await page.mouse.up()
  await expect(guides).toHaveCount(0)
  await expect(texts.last()).toBeFocused()
  await page.keyboard.type("Snapped", { delay: 10 })
  const snapped = await frameOf(texts.last())
  expect(Math.abs((snapped[0] ?? 0) - (anchor[0] ?? 0))).toBeLessThan(1)
  expect(Math.abs((snapped[0] ?? 0) + (snapped[2] ?? 0) - middle)).toBeLessThan(1)
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")

  await page.keyboard.press("t")
  await page.mouse.move(slide.x + 123, slide.y + 340)
  await page.keyboard.down("Control")
  await page.mouse.down()
  await page.mouse.move(slide.x + 300, slide.y + 380, { steps: 4 })
  await page.mouse.move(middle - 3, slide.y + 420, { steps: 4 })
  await expect(guides).toHaveCount(0)
  await page.mouse.up()
  await page.keyboard.up("Control")
  await expect(texts.last()).toBeFocused()
  await page.keyboard.type("Free", { delay: 10 })
  const free = await frameOf(texts.last())
  expect(Math.round(free[0] ?? 0)).toBe(Math.round(slide.x + 123))
  expect(Math.round((free[0] ?? 0) + (free[2] ?? 0))).toBe(Math.round(middle - 3))
})
