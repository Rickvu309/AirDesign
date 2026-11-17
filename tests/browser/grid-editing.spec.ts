import { expect, test, type Page } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { zoomCopy } from "../../apps/web/src/copy/product-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { entry, manySlides, mark, openFile, openGrid } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const live = (page: Page) => page.locator("[data-editor-grid] [data-grid-edit]")
const card = (page: Page, number: number) => page.locator("[data-editor-grid] [data-grid-card]").nth(number - 1)
const thumbText = (page: Page, number: number) => card(page, number).locator("[data-thumb-node]").first()
const number = (page: Page, at: number) => card(page, at).locator("[data-slide-number]")
const said = (page: Page) => page.locator("[data-editor-grid] [data-announcer]")
const frame = (page: Page) => live(page).locator("[data-canvas-element]").first()
const text = (page: Page) => live(page).locator('[contenteditable="true"]').first()

async function slides(page: Page, count: number) {
  await openFile(page, {
    name: `${String(count)}.pptx`,
    mimeType: "application/octet-stream",
    buffer: await manySlides(count),
  })
  await openGrid(page)
}

async function blank(page: Page, at: number, modifiers: ("Shift" | "ControlOrMeta")[] = []) {
  const box = await entry(page, at).boundingBox()
  if (box === null) throw new Error(`slide ${String(at)} is not laid out`)
  await entry(page, at).click({ position: { x: box.width - 12, y: box.height - 12 }, modifiers })
}

async function zoomTo(page: Page, percent: number) {
  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("textbox", { name: zoomCopy.field }).fill(String(percent))
  await page.getByRole("textbox", { name: zoomCopy.field }).press("Enter")
}

test.beforeEach(async ({ page }) => {
  if (process.env.AIRDESIGN_GRID_CPU_RATE !== "4") return
  const device = await page.context().newCDPSession(page)
  await device.send("Emulation.setCPUThrottlingRate", { rate: 4 })
})

test("one click on an element of a slide that is not open selects it with handles in the one live editor", async ({
  page,
}) => {
  await slides(page, 3)
  await expect(live(page)).toHaveCount(0)
  for (const at of [2, 3]) {
    await thumbText(page, at).click({ force: true })
    await expect(live(page)).toHaveCount(1)
    await expect(card(page, at).locator("[data-grid-edit]")).toHaveCount(1)
    await expect(entry(page, at)).toHaveAttribute("aria-current", "true")
    await expect(live(page).locator("[data-selection]")).toHaveCount(1)
    await expect(live(page).locator('[data-grip="bottom-right"]')).toBeVisible()
    await expect(frame(page)).toBeFocused()
    await expect(text(page)).not.toBeFocused()
  }
  await entry(page, 1).focus()
  await page.keyboard.press("Enter")
  await expect(card(page, 1).locator("[data-grid-edit]")).toHaveCount(1)
  await expect(live(page).locator("[data-selection]")).toHaveCount(0)
  await text(page).click()
  await expect(live(page).locator("[data-selection]")).toHaveCount(1)
  await expect(frame(page)).toBeFocused()
  await expect(text(page)).not.toBeFocused()
})

test("a drag from a slide number reorders the slide, and a drag from an element moves only the element", async ({
  page,
}) => {
  await slides(page, 3)
  const from = await number(page, 1).boundingBox()
  const onto = await entry(page, 3).boundingBox()
  if (from === null || onto === null) throw new Error("slides are not laid out")
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(onto.x + onto.width * 0.8, onto.y + onto.height / 2, { steps: 8 })
  await expect(page.locator("[data-drop-bar]")).toBeVisible()
  await page.mouse.up()
  await expect(said(page)).toHaveText(slideListCopy.moved(1, 3))
  await expect(card(page, 3)).toContainText(mark(1, 3))
  const element = thumbText(page, 1)
  const start = await element.boundingBox()
  if (start === null) throw new Error("no element")
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + start.width / 2 + 40, start.y + start.height / 2 + 20, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator("[data-drop-bar]")).toBeHidden()
  await expect(said(page)).toHaveText(slideListCopy.moved(1, 3))
  await expect(card(page, 1)).toContainText(mark(2, 3))
  await expect(card(page, 3)).toContainText(mark(1, 3))
  await expect.poll(async () => (await frame(page).boundingBox())?.x).toBeCloseTo(start.x + 40, 0)
})

test("a slide too small to show its number reorders from anywhere on it, its elements included", async ({ page }) => {
  await page.setViewportSize({ width: 1470, height: 500 })
  await slides(page, 50)
  await page.addStyleTag({ content: "[data-grid-viewport] { max-height: 180px }" })
  await page.keyboard.press("Shift+Digit1")
  await expect(number(page, 1)).toBeHidden()
  await expect(thumbText(page, 19)).toBeAttached()
  const from = await thumbText(page, 19).boundingBox()
  const onto = await entry(page, 21).boundingBox()
  if (from === null || onto === null) throw new Error("slides are not laid out")
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(onto.x + onto.width * 0.8, onto.y + onto.height / 2, { steps: 8 })
  await expect(page.locator("[data-drop-bar]")).toBeVisible()
  await page.mouse.up()
  await expect(said(page)).toHaveText(slideListCopy.moved(19, 21))
  await expect(live(page)).toHaveCount(0)
})

test("a double click on text, or Enter on a selected text box, edits the text", async ({ page }) => {
  await slides(page, 2)
  await thumbText(page, 2).dblclick({ force: true })
  await expect(text(page)).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(frame(page)).toBeFocused()
  await expect(live(page).locator("[data-selection]")).toHaveCount(1)
  await page.keyboard.press("Enter")
  await expect(text(page)).toBeFocused()
})

test("the slide number or a blank part of a slide selects the slide, and Shift or Ctrl adds slides", async ({
  page,
}) => {
  await slides(page, 4)
  await number(page, 2).click()
  await expect(entry(page, 2)).toHaveAttribute("data-selected", "")
  await expect(number(page, 2)).toHaveClass(/text-primary-strong/)
  await expect(number(page, 1)).not.toHaveClass(/text-primary-strong/)
  await expect(live(page)).toHaveCount(0)
  await blank(page, 3)
  await expect(entry(page, 3)).toHaveAttribute("data-selected", "")
  await expect(entry(page, 2)).not.toHaveAttribute("data-selected")
  await expect(live(page)).toHaveCount(0)
  await number(page, 1).click({ modifiers: ["Shift"] })
  await expect(page.locator("[data-grid-selected]")).toHaveText(slideListCopy.selected(3))
  await blank(page, 4, ["ControlOrMeta"])
  await expect(page.locator("[data-grid-selected]")).toHaveText(slideListCopy.selected(4))
  await thumbText(page, 2).click({ force: true })
  await expect(card(page, 2).locator("[data-grid-edit]")).toHaveCount(1)
  await expect(page.locator("[data-grid-selected]")).toHaveCount(0)
  const paint = live(page).locator("[data-slide-paint]")
  const box = await paint.boundingBox()
  if (box === null) throw new Error("no live slide")
  await paint.click({ position: { x: box.width - 12, y: box.height - 12 } })
  await expect(live(page)).toHaveCount(0)
  await expect(entry(page, 2)).toHaveAttribute("data-selected", "")
  await expect(entry(page, 2)).toBeFocused()
})

test("Escape steps out one level at a time with focus and words to match, and Enter steps back in", async ({
  page,
}) => {
  await slides(page, 3)
  await thumbText(page, 2).dblclick({ force: true })
  await expect(text(page)).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(frame(page)).toBeFocused()
  await expect(live(page).locator("[data-selection]")).toHaveCount(1)
  await page.keyboard.press("Escape")
  await expect(live(page)).toHaveCount(0)
  await expect(entry(page, 2)).toBeFocused()
  await expect(entry(page, 2)).toHaveAttribute("data-selected", "")
  await expect(said(page)).toHaveText(slideListCopy.selected(1))
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-editor-grid] [data-selected]")).toHaveCount(0)
  await expect(page.getByRole("group", { name: slideListCopy.listName, exact: true })).toBeFocused()
  await expect(page.getByRole("group", { name: slideListCopy.listName, exact: true })).toHaveCSS(
    "outline-style",
    "none",
  )
  await expect
    .poll(() =>
      page.locator("[data-grid-viewport]").evaluate((canvas) => getComputedStyle(canvas, "::after").boxShadow),
    )
    .toMatch(/inset/)
  await expect(said(page)).toHaveText(slideListCopy.nothingSelected)
  await page.keyboard.press("ArrowRight")
  await expect(page.getByRole("group", { name: slideListCopy.listName, exact: true })).toBeFocused()
  await expect(entry(page, 2)).not.toHaveAttribute("data-selected")
  await entry(page, 2).focus()
  await page.keyboard.press("Enter")
  await expect(card(page, 2).locator("[data-grid-edit]")).toHaveCount(1)
  await expect(live(page).locator("[data-slide-paint]")).toBeFocused()
  await expect(said(page)).toHaveText(slideListCopy.entered(2))
  await page.keyboard.press("Tab")
  await expect(text(page)).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(frame(page)).toBeFocused()
  await expect(live(page).locator("[data-selection]")).toHaveCount(1)
  await page.keyboard.press("Escape")
  await expect(live(page)).toHaveCount(0)
  await expect(entry(page, 2)).toBeFocused()
  await thumbText(page, 3).click({ force: true })
  await page.locator("[data-slide-list]").click({ position: { x: 8, y: 8 } })
  await expect(live(page)).toHaveCount(0)
  await expect(page.locator("[data-editor-grid] [data-selected]")).toHaveCount(0)
})

test("no side panel opens until asked, and an open Design panel follows the element or the slide", async ({ page }) => {
  await slides(page, 2)
  const panel = page.locator("[data-editor-panel]")
  await thumbText(page, 1).click({ force: true })
  await expect(live(page)).toHaveCount(1)
  await number(page, 2).click()
  await expect(entry(page, 2)).toHaveAttribute("data-selected", "")
  await expect(panel).toHaveCount(0)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await expect(panel.getByText(designCopy.slide(2), { exact: true })).toBeVisible()
  await expect(panel.locator("[data-design-element]")).toHaveCount(0)
  await thumbText(page, 1).click({ force: true })
  await expect(panel.locator("[data-design-element]")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(panel.getByText(designCopy.slide(1), { exact: true })).toBeVisible()
  await expect(panel.locator("[data-design-element]")).toHaveCount(0)
})

for (const zoom of ["fit", 50, 200] as const) {
  test(`Slides view keeps the slide and its selected element, and Grid comes back where it was at ${String(zoom)}`, async ({
    page,
  }) => {
    await slides(page, 3)
    if (zoom !== "fit") await zoomTo(page, zoom)
    const thumb = thumbText(page, 2)
    if (zoom === 200) {
      const box = await entry(page, 2).boundingBox()
      const room = await page.locator("[data-grid-viewport]").boundingBox()
      if (box === null || room === null) throw new Error("no slide")
      await page.mouse.move(room.x + room.width / 2, room.y + room.height / 2)
      await page.mouse.wheel(
        box.x + box.width * 0.25 - room.x - room.width / 2,
        box.y + box.height * 0.2 - room.y - room.height / 2,
      )
    }
    await thumb.click({ force: true })
    await expect(live(page).locator("[data-selection]")).toHaveCount(1)
    await page.mouse.move(700, 450)
    await page.mouse.wheel(40, 30)
    await expect.poll(async () => (await entry(page, 2).boundingBox())?.y).not.toBe(undefined)
    const before = await entry(page, 2).boundingBox()
    await page.getByRole("button", { name: slideListCopy.listName, exact: true }).click()
    await expect(page.locator("[data-editor-grid]")).toHaveCount(0)
    await expect(page.locator("[data-slide-label]")).toHaveText("2")
    await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(1)
    await openGrid(page)
    await expect(card(page, 2).locator("[data-grid-edit] [data-selection]")).toHaveCount(1)
    const after = await entry(page, 2).boundingBox()
    expect(after?.x).toBeCloseTo(before?.x ?? Number.NaN, 0)
    expect(after?.y).toBeCloseTo(before?.y ?? Number.NaN, 0)
    expect(after?.width).toBeCloseTo(before?.width ?? Number.NaN, 0)
  })
}

test("Shift+2 fits the slides selected by the grid model, including a slide with elements selected", async ({
  page,
}) => {
  await slides(page, 3)
  await thumbText(page, 2).click({ force: true })
  await page.keyboard.press("Shift+Digit2")
  const room = await page.locator("[data-grid-viewport]").boundingBox()
  const second = await entry(page, 2).boundingBox()
  if (room === null || second === null) throw new Error("no canvas")
  expect(second.x).toBeGreaterThanOrEqual(room.x + 47)
  expect(second.y).toBeGreaterThanOrEqual(room.y + 47)
  expect(second.x + second.width).toBeLessThanOrEqual(room.x + room.width - 47)
  expect(second.y + second.height).toBeLessThanOrEqual(room.y + room.height - 47)
  await expect(live(page).locator("[data-selection]")).toHaveCount(1)
  await page.keyboard.press("Shift+Digit1")
  await number(page, 1).click()
  await number(page, 3).click({ modifiers: ["ControlOrMeta"] })
  await page.keyboard.press("Shift+Digit2")
  await expect(entry(page, 1)).toBeInViewport()
  await expect(entry(page, 3)).toBeInViewport()
  await expect(page.locator("[data-grid-selected]")).toHaveText(slideListCopy.selected(2))
})
