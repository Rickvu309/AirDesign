import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { expect, test, type Page } from "@playwright/test"
import { entry, fixtures, manySlides, openFile, openGrid, settled } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })
const rows = (page: Page) =>
  page
    .locator("[data-grid-row]")
    .evaluateAll((rows) =>
      rows.map((row) =>
        [...row.querySelectorAll("[data-slide-entry]")].map((slide) => Number(slide.getAttribute("data-slide-entry"))),
      ),
    )
async function openTen(page: Page) {
  await openFile(page, {
    name: "ten.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(10),
  })
  await openGrid(page)
}
test("the eleventh slide keeps stored rows across zoom resize and reload", async ({ page }) => {
  await openTen(page)
  expect(await rows(page)).toEqual([
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10],
  ])
  await page.locator('[data-slide-entry="10"]').hover()
  await page.getByRole("button", { name: "Add slide after slide 10", exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(11)
  const after = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11],
  ]
  expect(await rows(page)).toEqual(after)
  await page.getByRole("button", { name: undoCopy.undoNamed.new, exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(10)
  expect(await rows(page)).toEqual([
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10],
  ])
  await page.getByRole("button", { name: undoCopy.redoNamed.new, exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(11)
  expect(await rows(page)).toEqual(after)
  await page.keyboard.press("ControlOrMeta+Equal")
  expect(await rows(page)).toEqual(after)
  await page.setViewportSize({ width: 1000, height: 800 })
  expect(await rows(page)).toEqual(after)
  await page.reload()
  await settled(page)
  await openGrid(page)
  expect(await rows(page)).toEqual(after)
})
test("Grid adds duplicates deletes moves and undoes with its row boundaries", async ({ page }) => {
  await openTen(page)
  const original = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10],
  ]
  await entry(page, 4).focus()
  await page.keyboard.press("ControlOrMeta+d")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(11)
  expect(await rows(page)).toEqual([
    [1, 2, 3, 4, 5],
    [6, 7, 8, 9],
    [10, 11],
  ])
  await page.getByRole("button", { name: undoCopy.undoNamed.duplicate, exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(10)
  expect(await rows(page)).toEqual(original)
  await entry(page, 5).focus()
  await page.keyboard.press("Alt+ArrowUp")
  await expect
    .poll(() => rows(page))
    .toEqual([
      [1, 2, 3, 4, 5],
      [6, 7, 8],
      [9, 10],
    ])
  await page.getByRole("button", { name: undoCopy.undoNamed.order, exact: true }).click()
  await expect.poll(() => rows(page)).toEqual(original)
  await entry(page, 5).focus()
  await page.keyboard.press("Delete")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(9)
  expect(await rows(page)).toEqual([
    [1, 2, 3, 4],
    [5, 6, 7],
    [8, 9],
  ])
  await page.getByRole("button", { name: undoCopy.undoNamed.delete, exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(10)
  expect(await rows(page)).toEqual(original)
})

test("collapsing a whole first row keeps later rows in their cells", async ({ page }) => {
  await openFile(page, {
    name: "sectioned-ten.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(10, true),
  })
  await openGrid(page)
  const before = await entry(page, 6).boundingBox()
  if (before === null) throw new Error("slide")
  await page.locator("[data-section-head]").first().click()
  await expect(entry(page, 1)).toHaveCount(0)
  const after = await entry(page, 6).boundingBox()
  if (after === null) throw new Error("slide")
  expect(after.y).toBeCloseTo(before.y, 1)
  expect(after.x).toBeCloseTo(before.x, 1)
})

test("section markers keep full accessible names and a fixed one-line height at fit zoom", async ({ page }) => {
  await openFile(page, `${fixtures}/doe-heat-pumps.pptx`)
  await openGrid(page)
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator("[data-section-head]")).toHaveCount(4)
  const room = (await page.locator("[data-grid-viewport]").boundingBox())!
  for (const head of await page.locator("[data-section-head]").all()) {
    const box = (await head.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(room.x + 47)
    expect(box.y).toBeGreaterThanOrEqual(room.y + 47)
    expect(box.x + box.width).toBeLessThanOrEqual(room.x + room.width - 47)
    expect(box.y + box.height).toBeLessThanOrEqual(room.y + room.height - 47)
    expect(box.height).toBeCloseTo(20, 1)
    const name = await head.getAttribute("title")
    expect(name).toBeTruthy()
    await expect(head).toHaveAccessibleName(new RegExp(name!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    const label = head.locator("span").first()
    await expect(label).toHaveCSS("white-space", "nowrap")
    await expect(label).toHaveCSS("text-overflow", "ellipsis")
    const geometry = await head.evaluate((button) => {
      const label = button.children[1]
      const badge = button.children[2]
      if (!(label instanceof HTMLElement) || !(badge instanceof HTMLElement)) throw new Error("section marker")
      const text = label.getBoundingClientRect()
      const count = badge.getBoundingClientRect()
      return {
        apart:
          getComputedStyle(badge).display === "none" ||
          (text.right <= count.left + 1 && Math.abs(text.top - count.top) < 1),
      }
    })
    expect(geometry.apart).toBe(true)
  }
})
