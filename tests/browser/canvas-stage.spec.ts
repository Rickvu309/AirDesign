import { presentCopy } from "../../apps/web/src/copy/present-copy"
import { expect, type Page } from "@playwright/test"
import { test } from "./deck-test"

async function gaps(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("[data-editor-canvas]")?.getBoundingClientRect()
    const slide = document.querySelector("[data-slide-paint]")?.getBoundingClientRect()
    const overlay = document.querySelector("[data-canvas-overlay]")?.getBoundingClientRect()
    if (!canvas || !slide || !overlay) throw new Error("Canvas is not ready")
    return { above: slide.top - canvas.top, below: overlay.top - slide.bottom, width: slide.width }
  })
}

test("Fit centres the slide above notes and follows their resized height", async ({ page, decks }) => {
  await decks.blank()
  await expect(page.locator("[data-slide-paint]")).toBeVisible()
  await page.getByRole("button", { name: "Collapse presenter notes" }).click()
  await expect
    .poll(async () => {
      const gap = await gaps(page)
      return Math.abs(gap.above - gap.below)
    })
    .toBeLessThanOrEqual(1)
  await page.getByRole("button", { name: "Expand presenter notes" }).click()
  await expect(page.getByRole("textbox", { name: presentCopy.notes })).toBeVisible()
  await expect.poll(async () => (await gaps(page)).below).toBeGreaterThanOrEqual(40)
  const opened = await gaps(page)
  await page.getByRole("button", { name: "Collapse presenter notes" }).focus()
  await page.keyboard.press("End")
  await expect.poll(async () => (await gaps(page)).width).toBeLessThan(opened.width)
  await expect
    .poll(async () => {
      const gap = await gaps(page)
      return Math.abs(gap.above - gap.below)
    })
    .toBeLessThanOrEqual(1)
  await expect.poll(async () => (await gaps(page)).below).toBeGreaterThanOrEqual(40)
})

test("a zoomed slide pans with Hand until 64 px of it stays in view on any side", async ({ page, decks }) => {
  await decks.blank()
  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("menuitemradio", { name: "Zoom to 200%", exact: true }).click()
  await page.keyboard.press("h")
  const stage = page.locator("[data-canvas-stage]")
  const before = await stage.evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop }))
  await page.mouse.move(600, 350)
  await page.mouse.down()
  await page.mouse.move(550, 300, { steps: 5 })
  await page.mouse.up()
  expect(await stage.evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop }))).toEqual({
    x: before.x + 50,
    y: before.y + 50,
  })
  await page.mouse.move(550, 300)
  await page.mouse.down()
  await page.mouse.move(600, 350, { steps: 5 })
  await page.mouse.up()
  expect(await stage.evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop }))).toEqual(before)
  await stage.evaluate((el) => {
    el.scrollLeft = 0
    el.scrollTop = 0
  })
  expect(await reach(page)).toEqual({ left: 64, top: 64 })
  await stage.evaluate((el) => {
    el.scrollLeft = el.scrollWidth
    el.scrollTop = el.scrollHeight
  })
  expect(await reach(page)).toEqual({ left: -64, top: -64 })
})

async function reach(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("[data-editor-canvas]")?.getBoundingClientRect()
    const slide = document.querySelector("[data-slide-paint]")?.getBoundingClientRect()
    const overlay = document.querySelector("[data-canvas-overlay]")?.getBoundingClientRect()
    if (!canvas || !slide || !overlay) throw new Error("Canvas is not ready")
    return slide.left > canvas.left
      ? { left: Math.round(canvas.right - slide.left), top: Math.round(overlay.top - slide.top) }
      : { left: Math.round(canvas.left - slide.right), top: Math.round(canvas.top - slide.bottom) }
  })
}
