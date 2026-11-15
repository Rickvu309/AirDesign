import { expect, test, type Page } from "@playwright/test"
import { designing, openDeck } from "./design-panel"
import { first, second, store } from "./home-store.ts"

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

const windows = [
  { width: 1280, height: 720 },
  { width: 1470, height: 923 },
  { width: 1920, height: 1080 },
] as const

async function boxOf(page: Page, selector: string): Promise<Box> {
  const box = await page.locator(selector).first().boundingBox()
  if (box === null) throw new Error(`no ${selector}`)
  return box
}

function inside(box: Box, window: { width: number; height: number }): boolean {
  return box.x >= 0 && box.y >= 0 && box.x + box.width <= window.width && box.y + box.height <= window.height
}

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

for (const window of windows) {
  test(`the editor fills a ${String(window.width)}x${String(window.height)} window with the slide fully shown`, async ({
    page,
  }) => {
    await page.setViewportSize(window)
    await openDeck(page, "clean.pptx")
    await designing(page, page.locator("[data-slide-paint]").getByRole("group", { name: "Hello" }))

    const toolbar = await boxOf(page, "[data-editor-toolbar]")
    const notes = await boxOf(page, "[data-notes-bar]")
    const exportButton = await boxOf(page, "[data-editor-panel] button:has-text('Export')")
    const panel = await boxOf(page, "[data-editor-panel]")
    const canvas = await boxOf(page, "[data-editor-canvas]")
    const slide = await boxOf(page, "[data-slide-paint]")

    expect(inside(toolbar, window), "toolbar").toBe(true)
    expect(inside(notes, window), "notes").toBe(true)
    expect(inside(exportButton, window), "Export").toBe(true)
    expect(panel.x + panel.width, "panel right edge").toBe(window.width)
    expect(panel.y + panel.height, "panel bottom edge").toBe(window.height)
    expect(canvas.y + canvas.height, "canvas bottom edge").toBe(window.height)

    expect(slide.x, "slide left").toBeGreaterThanOrEqual(canvas.x)
    expect(slide.x + slide.width, "slide right").toBeLessThanOrEqual(canvas.x + canvas.width)
    expect(slide.y, "slide top").toBeGreaterThanOrEqual(canvas.y)
    expect(slide.y + slide.height, "slide bottom above the notes").toBeLessThanOrEqual(notes.y)

    const page_ = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
    }))
    expect(page_.scrollWidth, "no sideways page scroll").toBeLessThanOrEqual(page_.clientWidth)
    expect(page_.scrollHeight, "no page scroll").toBeLessThanOrEqual(page_.clientHeight)

    if (window.width === 1470) {
      expect(slide.width, "the designed size keeps today's slide").toBe(800)
      await expect(page.locator("[data-zoom-readout]")).toHaveText("63%")
    }
  })
}

for (const path of ["/", "/trash"]) {
  test(`${path} fills a 1920x1080 window with no white band`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await store(page, [first], [{ ...second, trashed: first.edited }])
    await page.goto(path)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    const sidebar = await boxOf(page, "[data-decks-sidebar]")
    const main = await boxOf(page, "[data-decks-main]")
    expect(main.x + main.width, "main right edge").toBe(1920)
    expect(sidebar.y + sidebar.height, "sidebar bottom edge").toBe(1080)
    const sizes = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }))
    expect(sizes).toEqual({ scrollWidth: 1920, scrollHeight: 1080 })
  })
}

test("fit zoom refits when the window changes, and a fixed zoom stays", async ({ page }) => {
  await openDeck(page, "clean.pptx")
  const before = await boxOf(page, "[data-slide-paint]")
  expect(before.width).toBe(800)
  await page.setViewportSize({ width: 1920, height: 1080 })
  await expect.poll(async () => (await boxOf(page, "[data-slide-paint]")).width).toBeGreaterThan(800)
  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("menuitemradio", { name: "50%", exact: true }).click()
  await expect.poll(async () => (await boxOf(page, "[data-slide-paint]")).width).toBe(640)
  await page.setViewportSize({ width: 1280, height: 720 })
  await expect(page.locator("[data-zoom-readout]")).toHaveText("50%")
  expect((await boxOf(page, "[data-slide-paint]")).width).toBe(640)
})

test.fail(
  "with a text box selected in a 1280x720 window, the toolbar stays inside the canvas column",
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await openDeck(page, "clean.pptx")
    await designing(page, page.locator("[data-slide-paint]").getByRole("group", { name: "Hello" }))
    const toolbar = await boxOf(page, "[data-editor-toolbar]")
    const canvas = await boxOf(page, "[data-editor-canvas]")
    expect(toolbar.x, "toolbar left").toBeGreaterThanOrEqual(canvas.x)
    expect(toolbar.x + toolbar.width, "toolbar right").toBeLessThanOrEqual(canvas.x + canvas.width)
  },
)
