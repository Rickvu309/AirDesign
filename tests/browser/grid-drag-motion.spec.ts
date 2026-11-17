import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { entry, fixtures, manySlides, openFile, openGrid } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "no-preference" })

function card(page: Page, number: number) {
  return entry(page, number).locator("..")
}

async function shiftOf(page: Page, number: number): Promise<number> {
  return card(page, number).evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41)
}

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

async function boxOf(page: Page, number: number): Promise<Box> {
  const box = await entry(page, number).boundingBox()
  if (box === null) throw new Error(`no slide ${String(number)}`)
  return box
}

async function pointAt(page: Page, box: Box, across: number): Promise<void> {
  await page.mouse.move(box.x + box.width * across, box.y + box.height / 2, { steps: 8 })
}

async function grab(page: Page, number: number): Promise<number> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          !document.documentElement.matches(":active-view-transition") &&
          document.getAnimations().every((animation) => animation.playState !== "running"),
      ),
    )
    .toBe(true)
  const box = await entry(page, number).boundingBox()
  if (box === null) throw new Error(`no slide ${String(number)}`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  return box.width
}

test("slides move aside to show where a dragged slide lands, go back when it goes back, and stay put on the drop", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openFile(page, { name: "four.pptx", mimeType: "application/octet-stream", buffer: await manySlides(4) })
  await openGrid(page)
  await page.locator("[data-zoom-readout]").click()
  await expect(page.locator("[data-zoom-field]")).toBeFocused()
  await page.keyboard.type("20")
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-zoom-readout]")).toHaveText(/^20/)
  const first = await boxOf(page, 1)
  const third = await boxOf(page, 3)
  const width = await grab(page, 1)
  const step = width + 32
  await pointAt(page, third, 0.8)
  await expect.poll(() => shiftOf(page, 2)).toBeCloseTo(-step, 0)
  await expect.poll(() => shiftOf(page, 3)).toBeCloseTo(-step, 0)
  await expect.poll(() => shiftOf(page, 1)).toBeCloseTo(2 * step, 0)
  expect(await shiftOf(page, 4)).toBe(0)
  await expect(page.locator("[data-drop-bar]")).toBeHidden()
  await expect(card(page, 2)).toHaveCSS("transition-duration", "0.28s")
  await pointAt(page, first, 0.2)
  await expect.poll(() => shiftOf(page, 2)).toBe(0)
  await expect.poll(() => shiftOf(page, 1)).toBe(0)
  await pointAt(page, third, 0.8)
  await expect.poll(() => shiftOf(page, 2)).toBeCloseTo(-step, 0)
  await pointAt(page, third, 0.82)
  await page.mouse.up()
  await expect(page.locator("[data-editor-grid] [data-announcer]")).toHaveText("Moved slide 1 to position 3")
  for (const number of [1, 2, 3, 4]) {
    await expect(card(page, number)).toHaveCSS("transform", "none")
    await expect(card(page, number)).toHaveCSS("transition-duration", "0s")
  }
})

test("a drag keeps the motion setting it started with until the drop", async ({ page }) => {
  await openFile(page, { name: "four.pptx", mimeType: "application/octet-stream", buffer: await manySlides(4) })
  await openGrid(page)
  const third = await boxOf(page, 3)
  const width = await grab(page, 1)
  await pointAt(page, third, 0.8)
  await expect.poll(() => shiftOf(page, 2)).toBeCloseTo(-(width + 32), 0)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await pointAt(page, third, 0.82)
  await expect(page.locator("[data-drop-bar]")).toBeHidden()
  expect(await shiftOf(page, 2)).toBeCloseTo(-(width + 32), 0)
  await page.mouse.up()
  await expect(page.locator("[data-editor-grid] [data-announcer]")).toHaveText("Moved slide 1 to position 3")
})

test("a drag to the first place of a section keeps the slides still and shows the bar where the slide lands", async ({
  page,
}) => {
  await openFile(page, join(fixtures, "sections-after.pptx"))
  await openGrid(page)
  const second = await boxOf(page, 2)
  await grab(page, 3)
  await pointAt(page, second, 0.2)
  await expect(page.locator("[data-drop-bar]")).toHaveAttribute("data-drop-place", "2")
  expect(await shiftOf(page, 2)).toBe(0)
  expect(await shiftOf(page, 3)).toBe(0)
  await page.mouse.up()
  await expect(page.locator("[data-editor-grid] [data-announcer]")).toHaveText("Moved slide 3 to position 2")
})

test("the add mark between slides fades in on hover and stays still with reduced motion", async ({ page }) => {
  await openFile(page, { name: "two.pptx", mimeType: "application/octet-stream", buffer: await manySlides(2) })
  await openGrid(page)
  const plus = page.getByRole("button", { name: "Add slide after slide 1" })
  await expect(plus).toBeHidden()
  await entry(page, 1).hover()
  await expect(plus).toBeVisible()
  await expect(plus).toHaveCSS("opacity", "1")
  await expect(plus).toHaveCSS("transition-duration", /0\.15s/)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect(plus).toHaveCSS("transition-duration", "0s")
})
