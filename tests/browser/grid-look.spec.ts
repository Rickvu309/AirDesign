import { expect, type Page } from "@playwright/test"
import { entry, manySlides, openGrid } from "./slide-grid-deck"
import { decksOn, test } from "./deck-test"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

async function atZoom(page: Page, percent: number) {
  await decksOn(page).open({ name: "overview.pptx", mimeType: "application/octet-stream", buffer: await manySlides(3) })
  await openGrid(page)
  await page.locator("[data-zoom-readout]").click()
  await page.locator("[data-zoom-field]").fill(String(percent))
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-zoom-readout]")).toHaveText(`${percent}%`)
}

const handle = (page: Page) => page.locator("[data-group-handle]").first()
const chrome = (page: Page) =>
  page.locator('[data-grid-group-member="0"] [data-grid-card]').evaluateAll((cards) =>
    cards.map((card) => {
      const face = getComputedStyle(card.querySelector("[data-slide-entry]")!)
      return {
        halo: getComputedStyle(card.querySelector("[data-grid-halo]")!).opacity,
        shadow: face.boxShadow,
        number: getComputedStyle(card.querySelector("[data-slide-number]")!).color,
      }
    }),
  )

test("between-slide and slide group end plus controls leave slide and slide group chrome at rest", async ({ page }) => {
  await atZoom(page, 25)
  await page.mouse.move(10, 500)
  const before = await chrome(page)
  for (const kind of ["between", "end"]) {
    const gap = page.locator(`[data-gap-insert="${kind}"]`).first()
    await gap.hover()
    await expect(gap.locator("[data-add-gap]")).toHaveCSS("opacity", "1")
    await expect.poll(() => chrome(page)).toEqual(before)
    await expect(handle(page)).toHaveCSS("opacity", "0")
  }
})

test("a slide group shows a quiet pill until its 28 by 44 handle is hovered or focused", async ({ page }) => {
  await atZoom(page, 25)
  const grip = handle(page)
  const mark = grip.locator("[data-group-grip]")
  await entry(page, 1).hover()
  await expect(grip).toHaveCSS("opacity", "1")
  await expect(mark).toHaveCSS("width", "5px")
  await expect(mark).toHaveCSS("height", "24px")
  await expect(grip.locator("svg")).toBeHidden()
  const hit = (await grip.boundingBox())!
  expect(hit.width).toBeGreaterThanOrEqual(28)
  expect(hit.height).toBeGreaterThanOrEqual(44)

  await grip.hover()
  await expect(mark).toHaveCSS("width", "18px")
  await expect(mark).toHaveCSS("height", "36px")
  await expect(grip.locator("svg")).toBeVisible()
  await page.mouse.move(0, 0)
  await entry(page, 1).focus()
  await page.keyboard.press("Shift+Tab")
  await expect(grip).toBeFocused()
  await expect(grip.locator("svg")).toBeVisible()
})

test("slide group handle previews the same halo, number and edge on every slide", async ({ page }) => {
  await atZoom(page, 25)
  await expect(entry(page, 1)).toHaveAttribute("data-selected")
  await entry(page, 1).hover()
  await handle(page).hover()
  const preview = await chrome(page)
  expect(preview[0]?.halo).toBe("1")
  expect(preview).toEqual(preview.map(() => preview[0]))
  await page.mouse.move(0, 0)
  const restored = await chrome(page)
  expect(restored[0]?.shadow).not.toBe(restored[1]?.shadow)
})

test("keyboard focus distinguishes a tiny slide within a multiple selection", async ({ page }) => {
  await atZoom(page, 4)
  await entry(page, 1).focus()
  await page.keyboard.press("Shift+ArrowRight")
  const first = entry(page, 1)
  const focused = entry(page, 2)
  await expect(first).toHaveAttribute("data-selected")
  await expect(focused).toHaveAttribute("data-selected")
  await expect(focused).toBeFocused()
  await expect(first).toHaveCSS("outline-style", "none")
  await expect(focused).toHaveCSS("outline-style", "solid")
  await expect(focused).toHaveCSS("box-shadow", "none")
  const outset = await focused.evaluate((node) => {
    const style = getComputedStyle(node)
    return Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset)
  })
  expect(outset).toBeLessThanOrEqual(4)
})

test("Enter from the zoom field returns to the Grid canvas", async ({ page }) => {
  await atZoom(page, 9)
  await expect(page.locator("[data-grid-viewport] [data-focus-edge]")).toBeFocused()
})
