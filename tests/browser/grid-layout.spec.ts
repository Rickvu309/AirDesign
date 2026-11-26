import { expect, type Page } from "@playwright/test"
import { test } from "./api-stack"
import { boxOf, card, entries, entry, inside, openGroups, viewport, zoomTo } from "./grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const tops = (page: Page, numbers: readonly number[]) =>
  Promise.all(numbers.map(async (number) => Math.round((await boxOf(entry(page, number))).y)))

const lefts = (page: Page, numbers: readonly number[]) =>
  Promise.all(numbers.map(async (number) => Math.round((await boxOf(entry(page, number))).x)))

async function allInside(page: Page): Promise<boolean> {
  const count = await entries(page).count()
  for (let number = 1; number <= count; number += 1)
    if (!(await inside(entry(page, number), viewport(page)))) return false
  return true
}

test("each slide group is its own block, a long group wraps onto closer lines, and fit shows every slide", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [1, 12, 3, 2])
  expect(await allInside(page)).toBe(true)
  const [one, wrapStart, wrapNext, third, fourth] = await tops(page, [1, 2, 8, 14, 17])
  expect(new Set(await tops(page, [2, 3, 4, 5, 6, 7]))).toEqual(new Set([wrapStart]))
  expect(new Set(await tops(page, [8, 9, 10, 11, 12, 13]))).toEqual(new Set([wrapNext]))
  expect(new Set(await tops(page, [14, 15, 16]))).toEqual(new Set([third]))
  expect(new Set(await tops(page, [17, 18]))).toEqual(new Set([fourth]))
  expect(new Set(await lefts(page, [1, 2, 8, 14, 17])).size).toBe(1)
  const height = Math.round((await boxOf(entry(page, 1))).height)
  const within = wrapNext! - wrapStart! - height
  expect(within).toBeGreaterThan(0)
  expect(wrapStart! - one! - height).toBeGreaterThan(within * 2)
  expect(third! - wrapNext! - height).toBeGreaterThan(within * 2)
  expect(fourth! - third!).toBeCloseTo(third! - wrapNext!, -0.5)
})

test("Zoom to fit refits every slide inside the canvas when the window is resized", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [4, 3])
  const wide = await boxOf(entry(page, 1))
  await page.setViewportSize({ width: 1100, height: 700 })
  await expect.poll(async () => (await boxOf(entry(page, 1))).width).toBeLessThan(wide.width)
  expect(await allInside(page)).toBe(true)
  await page.setViewportSize({ width: 1470, height: 923 })
  await expect.poll(async () => Math.round((await boxOf(entry(page, 1))).width)).toBe(Math.round(wide.width))
  expect(await allInside(page)).toBe(true)
})

test("numbers sit inside the slide at low zoom, above it zoomed in, and hide when the slide is tiny", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [3, 3])
  const number = card(page, 1).locator("[data-slide-number]")
  await zoomTo(page, 5)
  await expect(card(page, 1)).toHaveAttribute("data-number-placement", "inside")
  const slide = await boxOf(entry(page, 1))
  const inner = await boxOf(number)
  expect(inner.y).toBeGreaterThanOrEqual(slide.y)
  expect(inner.y + inner.height).toBeLessThanOrEqual(slide.y + slide.height)
  await zoomTo(page, 50)
  await expect(card(page, 1)).toHaveAttribute("data-number-placement", "above")
  const above = await boxOf(number)
  expect(above.y + above.height).toBeLessThanOrEqual((await boxOf(entry(page, 1))).y + 1)
  await zoomTo(page, 2)
  await expect(card(page, 1)).toHaveAttribute("data-number-placement", /^hidden$/)
  await expect(number).toBeHidden()
})

test("zoomed in, only the slides on or near the screen are painted, and at fit every slide is", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [6, 6])
  const painted = page.locator("[data-editor-grid] [data-slide-thumb]:not(:empty)")
  await expect(painted).toHaveCount(12)
  await entry(page, 1).click()
  await zoomTo(page, 100)
  await expect.poll(() => painted.count()).toBeLessThan(12)
  const room = await boxOf(viewport(page))
  for (let number = 1; number <= 12; number += 1) {
    const box = await boxOf(entry(page, number))
    const near =
      box.x < room.x + room.width + 200 &&
      box.x + box.width > room.x - 200 &&
      box.y < room.y + room.height + 200 &&
      box.y + box.height > room.y - 200
    await expect(card(page, number).locator("[data-slide-thumb]:not(:empty)")).toHaveCount(near ? 1 : 0)
  }
  await page.keyboard.press("Shift+Digit1")
  await expect(painted).toHaveCount(12)
})
