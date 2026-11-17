import { expect, test, type Page } from "@playwright/test"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { entry, manySlides, openFile, openGrid, settled } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const below = (page: Page, row: number) => page.getByRole("button", { name: new RegExp(`new row below row ${row}$`) })
const rows = (page: Page) =>
  page
    .locator("[data-grid-row]")
    .evaluateAll((rows) =>
      rows.map((row) =>
        [...row.querySelectorAll<HTMLElement>("[data-slide-entry]")].map((slide) => Number(slide.dataset.slideEntry)),
      ),
    )
const original = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10],
]

async function ten(page: Page) {
  await openFile(page, { name: "ten.pptx", mimeType: "application/octet-stream", buffer: await manySlides(10) })
  await openGrid(page)
}

async function zoom(page: Page, percent: number) {
  await page.locator("[data-zoom-readout]").click()
  await expect(page.locator("[data-zoom-field]")).toBeFocused()
  await page.keyboard.type(String(percent))
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-zoom-readout]")).toHaveText(new RegExp(`^${percent}`))
}

test("a one-slide deck keeps the below control within the fitted viewport", async ({ page }) => {
  await openFile(page, { name: "one.pptx", mimeType: "application/octet-stream", buffer: await manySlides(1) })
  await openGrid(page)
  await expect(below(page, 1)).toBeInViewport({ ratio: 1 })
  const button = await below(page, 1).boundingBox()
  expect(button?.width).toBeCloseTo(44, 0)
  expect(button?.height).toBeCloseTo(44, 0)
})

test("the below plus previews the new first-column card between rows and keeps the viewport", async ({ page }) => {
  await ten(page)
  await zoom(page, 25)
  const view = await page.locator("[data-focus-edge]").getAttribute("style")
  const next = await entry(page, 5).boundingBox()
  if (next === null) throw new Error("next row")
  await below(page, 1).hover()
  const placeholder = page.locator("[data-row-placeholder]:visible")
  await expect(placeholder).toHaveCount(1)
  const preview = await placeholder.boundingBox()
  const moved = await entry(page, 5).boundingBox()
  if (preview === null || moved === null) throw new Error("preview")
  expect(preview.x).toBeCloseTo(next.x, 0)
  expect(moved.y).toBeGreaterThan(preview.y + preview.height)
  await below(page, 1).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(11)
  const added = await entry(page, 5).boundingBox()
  if (added === null) throw new Error("added")
  expect(added.x).toBeCloseTo(preview.x, 0)
  expect(added.y).toBeCloseTo(preview.y, 0)
  expect(added.width).toBeCloseTo(preview.width, 0)
  expect(added.height).toBeCloseTo(preview.height, 0)
  expect(await rows(page)).toEqual([[1, 2, 3, 4], [5], [6, 7, 8, 9], [10, 11]])
  await expect(page.locator("[data-focus-edge]")).toHaveAttribute("style", view ?? "")
  await expect(entry(page, 5)).toHaveAttribute("aria-current", "true")
})

test("a final-row add keeps fit zoom then survives undo redo and reload", async ({ page }) => {
  await ten(page)
  const percent = await page.locator("[data-zoom-readout]").textContent()
  await below(page, 3).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(11)
  const added = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10], [11]]
  expect(await rows(page)).toEqual(added)
  await expect(page.locator("[data-zoom-readout]")).toHaveText(percent ?? "")
  await page.getByRole("button", { name: undoCopy.undoNamed.new, exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(10)
  expect(await rows(page)).toEqual(original)
  await page.getByRole("button", { name: undoCopy.redoNamed.new, exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(11)
  await zoom(page, 50)
  expect(await rows(page)).toEqual(added)
  await page.setViewportSize({ width: 1000, height: 800 })
  expect(await rows(page)).toEqual(added)
  await page.reload()
  await settled(page)
  await openGrid(page)
  expect(await rows(page)).toEqual(added)
})

test("keyboard focus previews below and Escape returns to the row before Enter adds", async ({ page }) => {
  await ten(page)
  await entry(page, 1).focus()
  await page.keyboard.press("Tab")
  await expect(below(page, 1)).toBeFocused()
  expect(await below(page, 1).evaluate((button) => getComputedStyle(button).outlineStyle)).not.toBe("none")
  await expect(page.locator("[data-row-placeholder]:visible")).toHaveCount(1)
  await page.keyboard.press("Escape")
  await expect(entry(page, 1)).toBeFocused()
  await expect(page.locator("[data-row-placeholder]:visible")).toHaveCount(0)
  await below(page, 1).focus()
  const view = await page.locator("[data-focus-edge]").getAttribute("style")
  await page.keyboard.press("ArrowDown")
  await expect(page.locator("[data-focus-edge]")).toHaveAttribute("style", view ?? "")
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(11)
  await expect(entry(page, 5)).toBeFocused()
  await expect(page.locator("[data-grid-edit]")).toHaveCount(0)
})

test("below controls and the preview yield to Space pan and Hand mode", async ({ page }) => {
  await ten(page)
  await below(page, 1).hover()
  await expect(page.locator("[data-row-placeholder]:visible")).toHaveCount(1)
  await entry(page, 1).focus()
  await page.keyboard.down("Space")
  await expect(below(page, 1)).toBeHidden()
  await expect(page.locator("[data-row-placeholder]:visible")).toHaveCount(0)
  await page.keyboard.up("Space")
  await page.keyboard.press("h")
  await expect(below(page, 1)).toBeHidden()
  await page.keyboard.press("v")
  await expect(below(page, 1)).toBeVisible()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(10)
})

test("a fifty-slide deck exposes disabled below controls and no insertion preview", async ({ page }) => {
  await openFile(page, { name: "fifty.pptx", mimeType: "application/octet-stream", buffer: await manySlides(50) })
  await openGrid(page)
  for (const button of await page.locator("[data-add-row]").all()) await expect(button).toBeDisabled()
  await expect(page.locator("[data-row-placeholder]:visible")).toHaveCount(0)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(50)
})

test("a below add flushes the text being edited and selects the new slide", async ({ page }) => {
  await ten(page)
  await entry(page, 1).focus()
  await page.keyboard.press("Enter")
  const text = page.locator('[data-grid-edit] [contenteditable="true"]').first()
  await expect(text).toBeVisible()
  await text.fill("Changed before adding below")
  await below(page, 1).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(11)
  await expect(entry(page, 5)).toHaveAttribute("aria-current", "true")
  await page.getByRole("button", { name: "Add text box", exact: true }).click()
  await page.locator('[data-grid-edit] [contenteditable="true"]').first().fill("Text in the new row")
  await entry(page, 1).focus()
  await page.reload()
  await settled(page)
  await openGrid(page)
  await expect(entry(page, 1)).toContainText("Changed before adding below")
  await expect(entry(page, 5)).toContainText("Text in the new row")
})

test("an offline below add and undo keep the original rows after reconnect and reload", async ({ page, context }) => {
  await ten(page)
  await context.setOffline(true)
  await below(page, 1).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(11)
  await page.getByRole("button", { name: undoCopy.undoNamed.new, exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(10)
  expect(await rows(page)).toEqual(original)
  await context.setOffline(false)
  await page.reload()
  await settled(page)
  await openGrid(page)
  expect(await rows(page)).toEqual(original)
})

test.describe("touch", () => {
  test.use({ hasTouch: true })
  test("one tap adds a row without panning reordering or entering an element", async ({ page }) => {
    await ten(page)
    const button = await below(page, 1).boundingBox()
    if (button === null) throw new Error("below button")
    await page.touchscreen.tap(button.x + button.width / 2, button.y + button.height / 2)
    await expect(page.locator("[data-slide-entry]")).toHaveCount(11)
    expect(await rows(page)).toEqual([[1, 2, 3, 4], [5], [6, 7, 8, 9], [10, 11]])
    await expect(page.locator("[data-grid-edit]")).toHaveCount(0)
    await expect(page.locator("[data-drop-bar]")).toBeHidden()
  })
})
