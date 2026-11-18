import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { test } from "./api-stack"
import { canvas, openSaved, roomOf, zoomTo } from "./grid-reorder-deck"
import { entry, fixtures, openFile, openGrid } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const readout = (page: Page) => page.locator("[data-zoom-readout]")
const design = (page: Page) => page.getByRole("button", { name: "Design", exact: true })
const panel = (page: Page) => page.locator("[data-editor-panel]")

async function coveredPx(page: Page, target: Locator): Promise<number> {
  const [box, cover] = await Promise.all([target.boundingBox(), panel(page).boundingBox()])
  if (box === null || cover === null) throw new Error("missing box")
  return Math.max(0, Math.round(Math.min(box.x + box.width, cover.x + cover.width) - Math.max(box.x, cover.x)))
}

async function insideRoom(page: Page, target: Locator): Promise<void> {
  const [box, room] = await Promise.all([target.boundingBox(), roomOf(page)])
  if (box === null) throw new Error("missing target")
  expect(box.x).toBeGreaterThanOrEqual(room.x - 1)
  expect(box.x + box.width).toBeLessThanOrEqual(room.x + room.width + 1)
}

test("Escape from the toolbar returns to the canvas when nothing is selected", async ({ page, context, stack }) => {
  await openSaved(page, context, stack, `${fixtures}/clean.pptx`)
  await zoomTo(page, 40)
  await canvas(page).click({ position: { x: 4, y: 4 } })
  await expect(page.locator("[data-slide-entry][data-selected]")).toHaveCount(0)
  for (const control of [design(page), readout(page)]) {
    await control.focus()
    await page.keyboard.press("Escape")
    const edge = page.locator("[data-focus-edge]")
    await expect(edge).toBeFocused()
    expect(await edge.evaluate((node) => node.matches(":focus-visible"))).toBe(true)
    await expect(page.locator("[data-slide-entry][data-selected]")).toHaveCount(0)
  }
})

test("typing a zoom and pressing Enter returns to the canvas without its ring", async ({ page }) => {
  await openFile(page, join(fixtures, "clean.pptx"))
  await openGrid(page)
  await readout(page).click()
  await page.locator("[data-zoom-field]").fill("9")
  await page.keyboard.press("Enter")
  await expect(readout(page)).toHaveText("9%")
  const edge = page.locator("[data-focus-edge]")
  await expect(edge).toBeFocused()
  const framed = () =>
    page.locator("[data-grid-viewport]").evaluate((node) => {
      const focused = node.querySelector("[data-focus-edge]")?.matches(":focus-visible") === true
      const shadow = getComputedStyle(node, "::after").boxShadow
      return focused || (shadow !== "none" && shadow !== "")
    })
  expect(await framed()).toBe(false)
  await page.locator("[data-grid-viewport]").dispatchEvent("wheel", { deltaX: 40, deltaY: 20 })
  await entry(page, 1).hover()
  await expect(edge).toBeFocused()
  expect(await framed()).toBe(false)
})

test("clicking empty canvas clears the selection without the canvas ring", async ({ page, context, stack }) => {
  await openSaved(page, context, stack, 2)
  await entry(page, 1).click()
  await expect(entry(page, 1)).toHaveAttribute("data-selected", "")
  await canvas(page).click({ position: { x: 4, y: 4 } })
  await expect(page.locator("[data-slide-entry][data-selected]")).toHaveCount(0)
  const edge = page.locator("[data-focus-edge]")
  await expect(edge).toBeFocused()
  expect(await edge.evaluate((node) => node.matches(":focus-visible"))).toBe(false)
})

test("keyboard Undo shows the slide focus ring and a clicked Undo does not", async ({ page, context, stack }) => {
  await openSaved(page, context, stack, 2)
  await entry(page, 1).click()
  await page.keyboard.press("ControlOrMeta+d")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await entry(page, 2).click()
  expect(await entry(page, 2).evaluate((node) => node.matches(":focus-visible"))).toBe(false)
  await page.keyboard.press("ControlOrMeta+z")
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.activeElement?.matches("[data-slide-entry]") === true &&
          document.activeElement?.matches(":focus-visible") === true,
      ),
    )
    .toBe(true)
  await page.keyboard.press("ControlOrMeta+d")
  await page.locator("[data-undo-buttons] button").first().click()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.activeElement?.matches("[data-slide-entry]") === true &&
          document.activeElement?.matches(":focus-visible") === false,
      ),
    )
    .toBe(true)
})

async function zoomedHeatTitle(page: Page, viewport: { width: number; height: number }) {
  test.setTimeout(120_000)
  await page.setViewportSize(viewport)
  await openFile(page, join(fixtures, "doe-heat-pumps.pptx"))
  await openGrid(page)
  await zoomTo(page, 40)
  await entry(page, 1).locator("[data-thumb-node]").filter({ hasText: "Introduction to Heat Pumps" }).click()
  const title = page.locator('[data-grid-edit] [data-canvas-element][aria-label="Introduction to Heat Pumps"]')
  await expect(title).toBeVisible()
  await expect(page.locator("[data-grid-edit] [data-selection]")).toBeVisible()
  await page.keyboard.press("Shift+Digit2")
  const room = await roomOf(page)
  const box = await title.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(room.width - 160)
  return title
}

for (const viewport of [
  { width: 1470, height: 923 },
  { width: 1280, height: 720 },
] as const) {
  test(`Design clears the zoomed heat-pump title at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const title = await zoomedHeatTitle(page, viewport)
    const before = (await title.boundingBox())!
    const zoom = Number.parseInt((await readout(page).textContent()) ?? "", 10)
    await design(page).click()
    await expect(panel(page)).toBeVisible()
    expect(await coveredPx(page, title)).toBe(0)
    await insideRoom(page, title)
    const after = (await title.boundingBox())!
    expect(after.y + after.height / 2).toBeCloseTo(before.y + before.height / 2, 0)
    expect(Number.parseInt((await readout(page).textContent()) ?? "", 10)).toBeLessThanOrEqual(zoom)
    const zoomed = await readout(page).textContent()
    await design(page).click()
    await expect(panel(page)).toHaveCount(0)
    await expect(readout(page)).toHaveText(zoomed ?? "")
  })
}

test("Design clears an 80% slide of the panel at 1280x720", async ({ page, context, stack }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openSaved(page, context, stack, 1)
  await zoomTo(page, 80)
  const slide = entry(page, 1)
  const before = (await slide.boundingBox())!
  await design(page).click()
  await expect(panel(page)).toBeVisible()
  expect(await coveredPx(page, slide)).toBe(0)
  await insideRoom(page, slide)
  const after = (await slide.boundingBox())!
  const room = await roomOf(page)
  if (before.width <= room.width + 1) {
    expect(after.width).toBeCloseTo(before.width, 0)
    await expect(readout(page)).toHaveText(/^80%/)
  } else {
    expect(after.width).toBeLessThan(before.width)
    expect(Number.parseInt((await readout(page).textContent()) ?? "", 10)).toBeLessThan(80)
    expect(after.y + after.height / 2).toBeCloseTo(before.y + before.height / 2, 0)
  }
})

test("a narrower window keeps a zoomed title inside the canvas", async ({ page }) => {
  const title = await zoomedHeatTitle(page, { width: 1470, height: 923 })
  const zoom = Number.parseInt((await readout(page).textContent()) ?? "", 10)
  await page.setViewportSize({ width: 1280, height: 720 })
  await expect
    .poll(async () => {
      const [box, room] = await Promise.all([title.boundingBox(), roomOf(page)])
      if (box === null) return false
      return box.x >= room.x - 1 && box.x + box.width <= room.x + room.width + 1
    })
    .toBe(true)
  expect(Number.parseInt((await readout(page).textContent()) ?? "", 10)).toBeLessThanOrEqual(zoom)
})

test("section headings use the free room and drop the count before the name", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openFile(page, join(fixtures, "doe-heat-pumps.pptx"))
  await openGrid(page)
  const introduction = page.locator("[data-section-head]").filter({ hasText: "Introduction" })
  const label = introduction.getByText("Introduction", { exact: true })
  await expect(label).toBeVisible()
  expect(await label.evaluate((node) => node.clientWidth >= node.scrollWidth - 1)).toBe(true)
  const [head, slide] = await Promise.all([introduction.boundingBox(), entry(page, 1).boundingBox()])
  expect(head?.width ?? 0).toBeGreaterThan(slide?.width ?? 0)
  await zoomTo(page, 3)
  await expect(label).toBeVisible()
  expect(await label.evaluate((node) => getComputedStyle(node).visibility)).toBe("visible")
  expect(await label.evaluate((node) => node.clientWidth >= node.scrollWidth - 1)).toBe(true)

  await openFile(page, join(fixtures, "sections-after.pptx"))
  await openGrid(page)
  await zoomTo(page, 5)
  const opening = page.locator("[data-section-head]").filter({ hasText: "Opening" })
  const openingName = opening.getByText("Opening", { exact: true })
  await expect(openingName).toBeVisible()
  const state = await opening.evaluate((node) => {
    const name = [...node.querySelectorAll("span")].find((span) => span.textContent === "Opening")
    const count = [...node.querySelectorAll("span")].find((span) => span.textContent?.includes("slide"))
    const hidden =
      count === undefined ||
      count.hidden ||
      getComputedStyle(count).visibility === "hidden" ||
      getComputedStyle(count).display === "none"
    return {
      nameCut: name !== undefined && name.scrollWidth > name.clientWidth + 1,
      countHidden: hidden,
      nameVisibility: name === undefined ? "missing" : getComputedStyle(name).visibility,
    }
  })
  expect(state.nameVisibility).toBe("visible")
  expect(state.nameCut && !state.countHidden).toBe(false)
  const [first, next] = await Promise.all([
    opening.boundingBox(),
    page.locator("[data-section-head]").filter({ hasText: "Numbers" }).boundingBox(),
  ])
  expect((first?.x ?? 0) + (first?.width ?? 0)).toBeLessThanOrEqual((next?.x ?? 0) + 1)
})
