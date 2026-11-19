import { expect, test, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { entry, fifty, manySlides, openFile, openGrid, groupNumbers, settled, groupSizes } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const below = (page: Page, row: number) =>
  page.getByRole("button", { name: new RegExp(`new slide group below slide group ${row}$`) })
const original = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10],
]

async function ten(page: Page) {
  await openFile(page, {
    name: "ten.pptx",
    mimeType: "application/octet-stream",
    buffer: await manySlides(10, groupSizes(10)),
  })
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
  await openFile(page, {
    name: "one.pptx",
    mimeType: "application/octet-stream",
    buffer: await manySlides(1, groupSizes(1)),
  })
  await openGrid(page)
  await expect(below(page, 1)).toBeInViewport({ ratio: 1 })
  const button = await below(page, 1).boundingBox()
  expect(button?.width).toBeCloseTo(44, 0)
  expect(button?.height).toBeCloseTo(44, 0)
})

test("the below plus previews an insertion line without moving any slide", async ({ page }) => {
  await ten(page)
  await zoom(page, 25)
  const slides = page.locator("[data-slide-entry]")
  const boxes = () => slides.evaluateAll((entries) => entries.map((slide) => slide.getBoundingClientRect().toJSON()))
  const before = await boxes()
  const button = (await below(page, 1).boundingBox())!
  const second = (await entry(page, 2).boundingBox())!
  await page.mouse.move(second.x + second.width / 2, button.y + button.height / 2)
  await expect(below(page, 1)).toHaveCSS("opacity", "0")
  await expect(page.locator("[data-group-insertion-line]:visible")).toHaveCount(0)
  await below(page, 1).hover()
  expect(await boxes()).toEqual(before)
  const line = page.locator("[data-group-insertion-line]:visible")
  await expect(line).toHaveCount(1)
  const preview = await line.boundingBox()
  const first = await entry(page, 1).boundingBox()
  const next = await entry(page, 5).boundingBox()
  if (!preview || !first || !next) throw new Error("insertion line")
  expect(preview.x).toBeCloseTo(first.x, 0)
  expect(preview.width).toBeCloseTo(first.width, 0)
  expect(preview.height).toBeCloseTo(1, 0)
  expect(preview.y).toBeGreaterThan(first.y + first.height)
  expect(preview.y).toBeLessThan(next.y)
  await below(page, 1).click()
  await expect(slides).toHaveCount(11)
  expect(await groupNumbers(page)).toEqual([[1, 2, 3, 4], [5], [6, 7, 8, 9], [10, 11]])
  await expect(entry(page, 5)).toHaveAttribute("aria-current", "true")
})

test("the last slide group previews a full cell when there is space below", async ({ page }) => {
  await ten(page)
  await zoom(page, 25)
  await page.locator("[data-grid-viewport]").hover()
  await page.mouse.wheel(0, 375)
  await expect(page.locator("[data-group-placeholder]")).toBeInViewport({ ratio: 1 })
  await below(page, 3).hover()
  const placeholder = page.locator("[data-group-placeholder]:visible")
  await expect(placeholder).toHaveCount(1)
  const card = await entry(page, 9).boundingBox()
  const ghost = await placeholder.boundingBox()
  if (!card || !ghost) throw new Error("final-row preview")
  expect(ghost.x).toBeCloseTo(card.x, 0)
  expect(ghost.width).toBeCloseTo(card.width, 0)
  expect(ghost.height).toBeCloseTo(card.height, 0)
  expect(ghost.y).toBeGreaterThan(card.y + card.height)
  const button = (await below(page, 3).boundingBox())!
  expect(button.y + button.height / 2).toBeCloseTo((card.y + card.height + ghost.y) / 2, 0)
  const stroke = placeholder.locator("rect")
  await expect(stroke).toHaveCSS("stroke-width", "2px")
  await expect(stroke).toHaveCSS("stroke-dasharray", "8px, 7px")
  await expect(placeholder).toBeInViewport({ ratio: 1 })
})

test("a final slide group add keeps fit zoom then survives undo redo and reload", async ({ page }) => {
  await ten(page)
  const percent = await page.locator("[data-zoom-readout]").textContent()
  await below(page, 3).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(11)
  const added = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10], [11]]
  expect(await groupNumbers(page)).toEqual(added)
  await expect(page.locator("[data-zoom-readout]")).toHaveText(percent ?? "")
  await page.getByRole("button", { name: undoCopy.undoNamed.new, exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(10)
  expect(await groupNumbers(page)).toEqual(original)
  await page.getByRole("button", { name: undoCopy.redoNamed.new, exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(11)
  await zoom(page, 50)
  expect(await groupNumbers(page)).toEqual(added)
  await page.setViewportSize({ width: 1000, height: 800 })
  expect(await groupNumbers(page)).toEqual(added)
  await page.reload()
  await settled(page)
  await openGrid(page)
  expect(await groupNumbers(page)).toEqual(added)
})

test("keyboard focus previews below and Escape returns to the originating slide", async ({ page }) => {
  await ten(page)
  await entry(page, 1).focus()
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("Tab")
  const before = await page
    .locator("[data-slide-entry]")
    .evaluateAll((slides) => slides.map((slide) => slide.getBoundingClientRect().toJSON()))
  await page.keyboard.press("Tab")
  expect(
    await page
      .locator("[data-slide-entry]")
      .evaluateAll((slides) => slides.map((slide) => slide.getBoundingClientRect().toJSON())),
  ).toEqual(before)
  await expect(below(page, 1)).toBeFocused()
  expect(await below(page, 1).evaluate((button) => getComputedStyle(button).outlineStyle)).not.toBe("none")
  await expect(page.locator("[data-group-insertion-line]:visible")).toHaveCount(1)
  await page.keyboard.press("Escape")
  await expect(entry(page, 3)).toBeFocused()
  await expect(page.locator("[data-group-insertion-line]:visible")).toHaveCount(0)
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
  await expect(page.locator("[data-group-insertion-line]:visible")).toHaveCount(1)
  await entry(page, 1).focus()
  await page.keyboard.down("Space")
  await expect(below(page, 1)).toBeHidden()
  await expect(page.locator("[data-group-insertion-line]:visible")).toHaveCount(0)
  await page.keyboard.up("Space")
  await page.keyboard.press("h")
  await expect(below(page, 1)).toBeHidden()
  await page.keyboard.press("v")
  await expect(below(page, 1)).toBeVisible()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(10)
})

test("a full deck removes every inline add and describes the limit in the top bar", async ({ page }) => {
  await openFile(page, {
    name: "fifty.pptx",
    mimeType: "application/octet-stream",
    buffer: await manySlides(fifty, groupSizes(fifty)),
  })
  await openGrid(page)
  await zoom(page, 25)
  await expect(page.locator("[data-add-group], [data-add-gap]")).toHaveCount(0)
  const newSlide = page.getByRole("button", { name: slideListCopy.newSlide, exact: true })
  await expect(newSlide).toBeDisabled()
  await expect(newSlide).toHaveAccessibleDescription(slideListCopy.addLimit(fifty))
  await expect(page.locator("[data-group-insertion-line]:visible")).toHaveCount(0)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(50)
})

test("leaving text editing restores the below add and keeps the text edit", async ({ page }) => {
  await ten(page)
  await entry(page, 1).focus()
  await page.keyboard.press("Enter")
  const text = page.locator('[data-grid-edit] [contenteditable="true"]').first()
  await expect(text).toBeVisible()
  await text.fill("Changed before adding below")
  await expect(page.locator("[data-add-group], [data-add-gap]")).toHaveCount(0)
  await entry(page, 2).click()
  await zoom(page, 25)
  await below(page, 1).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(11)
  await expect(entry(page, 5)).toHaveAttribute("aria-current", "true")
  await page.getByRole("button", { name: "Add text", exact: true }).click()
  await page.locator('[data-grid-edit] [contenteditable="true"]').first().fill("Text in the new row")
  await entry(page, 1).focus()
  await page.reload()
  await settled(page)
  await openGrid(page)
  await expect(entry(page, 1)).toContainText("Changed before adding below")
  await expect(entry(page, 5)).toContainText("Text in the new row")
})

test("an offline below add and undo keep the original slide groups after reconnect and reload", async ({
  page,
  context,
}) => {
  await ten(page)
  await context.setOffline(true)
  await below(page, 1).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(11)
  await page.getByRole("button", { name: undoCopy.undoNamed.new, exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(10)
  expect(await groupNumbers(page)).toEqual(original)
  await context.setOffline(false)
  await page.reload()
  await settled(page)
  await openGrid(page)
  expect(await groupNumbers(page)).toEqual(original)
})

test.describe("touch", () => {
  test.use({ hasTouch: true })
  test("a touch tap leaves no inline add in Grid", async ({ page }) => {
    await ten(page)
    await zoom(page, 25)
    await entry(page, 1).tap()
    await expect(page.locator("[data-add-group], [data-add-gap]")).toHaveCount(0)
    await expect(page.locator("[data-slide-entry]")).toHaveCount(10)
    await expect(page.getByRole("button", { name: slideListCopy.newSlide, exact: true })).toBeEnabled()
  })
})
