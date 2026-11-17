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
      expect(slide.width, "the designed size keeps today's slide").toBe(920)
      await expect(page.locator("[data-zoom-readout]")).toHaveText("72%")
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
  await page.getByRole("menuitemradio", { name: "Zoom to 50%", exact: true }).click()
  await expect.poll(async () => (await boxOf(page, "[data-slide-paint]")).width).toBe(640)
  await page.setViewportSize({ width: 1280, height: 720 })
  await expect(page.locator("[data-zoom-readout]")).toHaveText("50%")
  expect((await boxOf(page, "[data-slide-paint]")).width).toBe(640)
})

for (const window of windows) {
  test(`with a text box selected in a ${String(window.width)}x${String(window.height)} window, every toolbar control stays inside the canvas column`, async ({
    page,
  }) => {
    await page.setViewportSize(window)
    await openDeck(page, "clean.pptx")
    await designing(page, page.locator("[data-slide-paint]").getByRole("group", { name: "Hello" }))
    await page.locator('[data-slide-paint] [contenteditable="true"]').first().click()
    await expect(page.locator("[data-editor-toolbar] [data-text-format]")).toBeVisible()
    const canvas = await boxOf(page, "[data-editor-canvas]")
    const list = await boxOf(page, "[data-slide-list]")
    const panel = await boxOf(page, "[data-editor-panel]")
    const toolbar = await boxOf(page, "[data-editor-toolbar]")
    expect(toolbar.x, "toolbar left").toBeGreaterThanOrEqual(canvas.x)
    expect(toolbar.x + toolbar.width, "toolbar right").toBeLessThanOrEqual(canvas.x + canvas.width)
    expect(toolbar.x, "toolbar clear of the slide list").toBeGreaterThanOrEqual(list.x + list.width)
    expect(toolbar.x + toolbar.width, "toolbar clear of the panel").toBeLessThanOrEqual(panel.x)
    const controls = page.locator("[data-editor-toolbar] button")
    for (const control of await controls.all()) {
      const box = await control.boundingBox()
      if (box === null) throw new Error("a toolbar control has no box")
      expect(box.x, "control left").toBeGreaterThanOrEqual(canvas.x)
      expect(box.x + box.width, "control right").toBeLessThanOrEqual(canvas.x + canvas.width)
    }
    for (const name of ["Agent", "Design"]) {
      await expect(page.locator("[data-editor-toolbar]").getByRole("button", { name, exact: true })).toBeInViewport({
        ratio: 1,
      })
    }
  })
}

test("in a 1280x720 window the controls that do not fit sit in More, reached and used by keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openDeck(page, "clean.pptx")
  const text = page.locator('[data-slide-paint] [contenteditable="true"]').first()
  await text.click()
  await text.press("ControlOrMeta+a")
  const toolbar = page.locator("[data-editor-toolbar]")
  await expect(toolbar.getByRole("button", { name: "Bold" })).toBeVisible()
  await expect(toolbar.getByRole("button", { name: "Bullets" })).toHaveCount(0)
  await toolbar.getByRole("button", { name: "More", exact: true }).focus()
  await page.keyboard.press("Enter")
  const more = page.locator("[data-toolbar-more]")
  await expect(more).toBeVisible()
  await page.screenshot({ path: test.info().outputPath("more-open.png") })
  const order = await more.getByRole("button").evaluateAll((all) => all.map((each) => each.getAttribute("aria-label")))
  expect(order.at(-1)).toBe("Bullets")
  const bullets = more.getByRole("button", { name: "Bullets" })
  for (const _ of order) {
    if (await bullets.evaluate((each) => each === document.activeElement)) break
    await page.keyboard.press("Tab")
  }
  await expect(bullets).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(bullets).toHaveAttribute("aria-pressed", "true")
  await page.keyboard.press("Escape")
  await expect(more).toBeHidden()
})

test("in a 1280x720 window a shape added through More while text is aimed lands on the slide", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openDeck(page, "clean.pptx")
  await page.locator('[data-slide-paint] [contenteditable="true"]').first().click()
  const elements = page.locator("[data-slide-paint] [data-canvas-element]")
  const before = await elements.count()
  await page.locator("[data-editor-toolbar]").getByRole("button", { name: "More", exact: true }).click()
  await page.locator("[data-toolbar-more]").getByRole("button", { name: "Shapes", exact: true }).click()
  await page.locator("[data-shape-tray]").getByRole("button", { name: "Rectangle", exact: true }).click()
  await expect(elements).toHaveCount(before + 1)
})
