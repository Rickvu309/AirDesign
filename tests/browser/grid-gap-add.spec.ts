import { expect, test, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { entry, manySlides, openFile, openGrid } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })
const add = (page: Page, number: number) =>
  page.getByRole("button", { name: slideListCopy.addAfter(number), exact: true })
const rows = (page: Page) =>
  page
    .locator("[data-grid-row]")
    .evaluateAll((rows) => rows.map((row) => row.querySelectorAll("[data-slide-entry]").length))
async function open(page: Page, count = 10) {
  await openFile(page, { name: "gap.pptx", mimeType: "application/octet-stream", buffer: await manySlides(count) })
  await openGrid(page)
}
async function zoom(page: Page, percent: number) {
  await page.locator("[data-zoom-readout]").click()
  await page.locator("[data-zoom-field]").fill(String(percent))
  await page.keyboard.press("Enter")
}

test("a gap plus is centred between neighbours and adds from the left layout", async ({ page }) => {
  await open(page)
  await zoom(page, 25)
  await entry(page, 2).hover()
  const left = await entry(page, 2).boundingBox()
  const right = await entry(page, 3).boundingBox()
  const button = await add(page, 2).boundingBox()
  if (!left || !right || !button) throw new Error("gap geometry")
  expect(button.x + button.width / 2).toBeCloseTo((left.x + left.width + right.x) / 2, 0)
  await add(page, 2).click()
  await expect(entry(page, 3)).toBeFocused()
  expect(await rows(page)).toEqual([5, 4, 2])
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
})

test("row-end dot previews the exact cell and keeps the next unequal row intact through undo", async ({ page }) => {
  await open(page)
  await zoom(page, 25)
  await page.locator("[data-grid-viewport]").hover()
  await page.mouse.wheel(400, 0)
  await add(page, 4).hover()
  const placeholder = page.locator("[data-gap-placeholder]:visible")
  await expect(placeholder).toHaveCount(1)
  const before = await placeholder.boundingBox()
  const next = await entry(page, 5).boundingBox()
  await add(page, 4).click()
  await expect(entry(page, 5)).toBeFocused()
  expect(await rows(page)).toEqual([5, 4, 2])
  const inserted = await entry(page, 5).boundingBox()
  const shifted = await entry(page, 6).boundingBox()
  if (!inserted || !before) throw new Error("preview geometry")
  expect(inserted.x).toBeCloseTo(before.x, 0)
  expect(inserted.y).toBeCloseTo(before.y, 0)
  expect(inserted.width).toBeCloseTo(before.width, 0)
  expect(inserted.height).toBeCloseTo(before.height, 0)
  expect(shifted).toEqual(next)
  await page.getByRole("button", { name: undoCopy.undoNamed.new, exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(10)
  expect(await rows(page)).toEqual([4, 4, 2])
})

test("Tab reaches the gap after its slide and Escape returns before Enter selects the addition", async ({ page }) => {
  await open(page)
  await entry(page, 4).focus()
  await page.keyboard.press("Tab")
  await expect(add(page, 4)).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(entry(page, 4)).toBeFocused()
  await page.keyboard.press("Tab")
  await page.keyboard.press("Enter")
  await expect(entry(page, 5)).toBeFocused()
  await expect(page.locator("[data-grid-edit]")).toHaveCount(0)
})

test("gap affordances hide at small zoom during Space and Hand and during text editing", async ({ page }) => {
  await open(page)
  await zoom(page, 10)
  await expect(add(page, 4)).toBeHidden()
  await zoom(page, 25)
  await add(page, 4).hover()
  await entry(page, 4).focus()
  await page.keyboard.down("Space")
  await expect(add(page, 4)).toBeHidden()
  await expect(page.locator("[data-gap-placeholder]:visible")).toHaveCount(0)
  await page.keyboard.up("Space")
  await page.keyboard.press("h")
  await expect(add(page, 4)).toBeHidden()
  await page.keyboard.press("v")
  await entry(page, 4).focus()
  await page.keyboard.press("Enter")
  await expect(add(page, 4)).toBeHidden()
})

test("fifty slides disable row-end addition without a preview", async ({ page }) => {
  await open(page, 50)
  await zoom(page, 25)
  await expect(page.locator("[data-add-gap]").nth(8)).toBeDisabled()
  await expect(page.locator("[data-gap-placeholder]:visible")).toHaveCount(0)
  expect(await rows(page)).toEqual([9, 9, 9, 9, 9, 5])
})

test("slide drag and canvas pan suppress additions and reduced motion has no animation", async ({ page }) => {
  await open(page)
  await zoom(page, 25)
  const box = await entry(page, 1).boundingBox()
  if (!box) throw new Error("slide")
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 20)
  await expect(add(page, 4)).toBeHidden()
  await expect(page.locator("[data-gap-placeholder]:visible")).toHaveCount(0)
  await page.keyboard.press("Escape")
  await page.mouse.up()
  await add(page, 4).hover()
  expect(await add(page, 4).evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
})

test.describe("touch", () => {
  test.use({ hasTouch: true, isMobile: true })
  test("a touch tap leaves no gap plus or row-end preview", async ({ page }) => {
    await open(page)
    await zoom(page, 25)
    await entry(page, 1).tap()
    await expect(page.locator("[data-gap-placeholder]:visible")).toHaveCount(0)
    await expect(add(page, 4)).toBeHidden()
  })
})
