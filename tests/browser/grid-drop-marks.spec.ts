import { expect, test, type Page } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { boxOf, roomOf, zoomTo } from "./grid-reorder-deck"
import { entry, manySlides, openFile, openGrid, rowNumbers } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

const number = (page: Page, slide: number) => entry(page, slide).locator("..").locator("[data-slide-number]")
const rowHandle = (page: Page, row: number) =>
  page.getByRole("button", { name: slideListCopy.moveRow(row), exact: true })

async function boxIn(page: Page, selector: string): Promise<Box> {
  const box = await page.locator(selector).boundingBox()
  if (box === null) throw new Error(selector)
  return box
}

async function eight(page: Page, percent: number): Promise<void> {
  await openFile(page, {
    name: "eight.pptx",
    mimeType: "application/octet-stream",
    buffer: await manySlides(8, [4, 4]),
  })
  await openGrid(page)
  await zoomTo(page, percent)
  await expect
    .poll(() => rowNumbers(page))
    .toEqual([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ])
}

test("the add-a-row line between rows sits on the plus, clear of the slides and numbers", async ({ page }) => {
  await eight(page, 23)
  await expect(page.locator('[data-number-placement="above"]')).toHaveCount(8)
  await page.locator('[data-row-insert="between"]').hover()
  const line = page.locator('[data-row-insert="between"] [data-row-insertion-line]')
  await expect(line).toBeVisible()
  const [mark, plus, upper, lower] = await Promise.all([
    boxIn(page, '[data-row-insert="between"] [data-row-insertion-line]'),
    boxIn(page, '[data-row-insert="between"] [data-add-mark]'),
    boxOf(page, 1),
    number(page, 5).boundingBox(),
  ])
  if (lower === null) throw new Error("number 5")
  expect(mark.y).toBeGreaterThan(upper.y + upper.height)
  expect(mark.y + mark.height).toBeLessThan(lower.y)
  expect(Math.abs(mark.y + mark.height / 2 - (plus.y + plus.height / 2))).toBeLessThan(1)
})

test("the pointer keeps the hover look on its way from a slide up to its number", async ({ page }) => {
  await eight(page, 53)
  const slide = await boxOf(page, 1)
  const label = await number(page, 1).boundingBox()
  if (label === null) throw new Error("number 1")
  const halo = entry(page, 1).locator("..").locator("[data-grid-halo]")
  await page.mouse.move(label.x + label.width / 2, slide.y + slide.height / 2)
  await expect(halo).toHaveCSS("opacity", "1")
  for (const y of [slide.y - 1, slide.y - 4, slide.y - 7, label.y + 4]) {
    await page.mouse.move(label.x + label.width / 2, y)
    await expect(halo).toHaveCSS("opacity", "1")
  }
  expect(label.y).toBeCloseTo(slide.y - 23, 0)
  expect(label.y + label.height).toBeCloseTo(slide.y, 0)
})

test("a whole row dragged above the first row or below the last shows the bar outside the rows", async ({ page }) => {
  await eight(page, 23)
  const bar = page.locator("[data-drop-bar][data-row-drop]")
  const first = await number(page, 1).boundingBox()
  const firstSlide = await boxOf(page, 1)
  const lastSlide = await boxOf(page, 5)
  if (first === null) throw new Error("number 1")
  await rowHandle(page, 2).focus()
  const grip = await rowHandle(page, 2).boundingBox()
  if (grip === null) throw new Error("row 2 handle")
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(firstSlide.x + firstSlide.width / 2, first.y - 12, { steps: 6 })
  await expect(bar).toHaveAttribute("data-drop-place", "1")
  const above = await bar.boundingBox()
  if (above === null) throw new Error("bar above")
  expect(above.y + above.height).toBeLessThan(first.y)
  await page.keyboard.press("Escape")
  await page.mouse.up()
  await rowHandle(page, 1).focus()
  const top = await rowHandle(page, 1).boundingBox()
  if (top === null) throw new Error("row 1 handle")
  await page.mouse.move(top.x + top.width / 2, top.y + top.height / 2)
  await page.mouse.down()
  await page.mouse.move(lastSlide.x + lastSlide.width / 2, lastSlide.y + lastSlide.height + 12, { steps: 6 })
  await expect(bar).toHaveAttribute("data-drop-place", "9")
  const below = await bar.boundingBox()
  if (below === null) throw new Error("bar below")
  expect(below.y).toBeGreaterThan(lastSlide.y + lastSlide.height)
  await page.keyboard.press("Escape")
  await page.mouse.up()
})

test("the Design panel says to select a slide when Grid has none selected", async ({ page }) => {
  await eight(page, 23)
  await entry(page, 2).click()
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const panel = page.locator("[data-design-panel]")
  await expect(panel).toContainText(designCopy.slide(2))
  const room = await roomOf(page)
  const last = await boxOf(page, 8)
  await page.mouse.click(room.x + 40, last.y + last.height + 40)
  await expect(page.locator("[data-editor-grid] [data-slide-entry][data-selected]")).toHaveCount(0)
  await expect(panel).toContainText(slideListCopy.nothingSelected)
  await expect(panel).toContainText(designCopy.selectSlide)
  await expect(panel).not.toContainText(designCopy.background)
  await entry(page, 3).click()
  await expect(panel).toContainText(designCopy.slide(3))
})

test("Move to a new row below is disabled for slides that already make up their row", async ({ page }) => {
  await eight(page, 23)
  const item = page.getByRole("menuitem", { name: slideListCopy.moveBelowMenu, exact: true })
  await entry(page, 4).click({ button: "right" })
  await expect(item).toBeEnabled()
  await item.click()
  await expect.poll(() => rowNumbers(page)).toEqual([[1, 2, 3], [4], [5, 6, 7, 8]])
  await entry(page, 4).click({ button: "right" })
  await expect(item).toBeDisabled()
  await page.keyboard.press("Escape")
  await entry(page, 3).click({ button: "right" })
  await expect(item).toBeEnabled()
})
