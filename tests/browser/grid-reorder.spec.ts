import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { test } from "./api-stack"
import { boxOf, canvas, grab, hover, openSaved, panOf, picked, roomOf, zoomTo } from "./grid-reorder-deck"
import { entry, fixtures } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const said = (page: Page) => page.locator("[data-editor-grid] [data-announcer]")

async function stays(page: Page): Promise<void> {
  const held = await panOf(page)
  await page.waitForTimeout(400)
  expect(await panOf(page)).toEqual(held)
}

test.beforeEach(async ({ page }) => {
  if (process.env.AIRDESIGN_GRID_CPU_RATE !== "4") return
  const device = await page.context().newCDPSession(page)
  await device.send("Emulation.setCPUThrottlingRate", { rate: 4 })
})

test("a dragged slide pans the canvas from the first row to the last and lands after slide 50", async ({
  page,
  context,
  stack,
}) => {
  test.setTimeout(180_000)
  const saved = await openSaved(page, context, stack, 50)
  await zoomTo(page, 100)
  await entry(page, 1).focus()
  await grab(page, 1)
  const room = await roomOf(page)
  const start = await panOf(page)
  await page.mouse.move(room.x + room.width / 2, room.y + room.height - 24, { steps: 4 })
  await expect
    .poll(async () => (await boxOf(page, 50)).y, { timeout: 60_000, intervals: [50] })
    .toBeLessThan(room.y + room.height / 2)
  await page.mouse.move(room.x + room.width - 24, room.y + room.height / 2, { steps: 4 })
  await expect
    .poll(
      async () => {
        const box = await boxOf(page, 50)
        return box.x + box.width
      },
      { timeout: 60_000, intervals: [50] },
    )
    .toBeLessThan(room.x + room.width - 120)
  await page.mouse.move(room.x + room.width / 2, room.y + room.height / 2, { steps: 2 })
  await stays(page)
  const moved = await panOf(page)
  expect(start.y - moved.y).toBeGreaterThan(2000)
  expect(start.x - moved.x).toBeGreaterThan(2000)
  expect(await canvas(page).evaluate((element) => [element.scrollLeft, element.scrollTop])).toEqual([0, 0])
  await hover(page, 50, 0.8)
  await expect(page.locator("[data-drop-bar]")).toHaveAttribute("data-drop-place", "51")
  await page.mouse.up()
  await expect(said(page)).toHaveText("Moved slide 1 to position 50")
  await expect.poll(saved.order).toEqual([...saved.ids.slice(1), saved.ids[0]])
})

test("edge panning works at every edge and at the side panel, and stops when the pointer leaves the band", async ({
  page,
  context,
  stack,
}) => {
  test.setTimeout(180_000)
  const saved = await openSaved(page, context, stack, 50)
  await zoomTo(page, 50)
  await entry(page, 23).focus()
  await grab(page, 23)
  const room = await roomOf(page)
  const middle = { x: room.x + room.width / 2, y: room.y + room.height / 2 }
  for (const [x, y, axis, direction] of [
    [middle.x, room.y + room.height - 10, "y", -1],
    [middle.x, room.y + 10, "y", 1],
    [room.x + 10, middle.y, "x", 1],
    [room.x + room.width - 10, middle.y, "x", -1],
  ] as const) {
    const before = await panOf(page)
    await page.mouse.move(x, y, { steps: 3 })
    await expect.poll(async () => ((await panOf(page))[axis] - before[axis]) * direction).toBeGreaterThan(150)
    await page.mouse.move(middle.x, middle.y, { steps: 3 })
    await stays(page)
  }
  await page.keyboard.press("Escape")
  await page.mouse.up()
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await expect.poll(async () => (await roomOf(page)).width).toBeLessThan(room.width - 100)
  const beside = await roomOf(page)
  await entry(page, 23).focus()
  await grab(page, 23)
  const before = await panOf(page)
  await page.mouse.move(beside.x + beside.width - 10, beside.y + beside.height / 2, { steps: 3 })
  await expect.poll(async () => before.x - (await panOf(page)).x).toBeGreaterThan(150)
  await page.mouse.move(beside.x + beside.width + 40, beside.y + beside.height / 2, { steps: 3 })
  await stays(page)
  await expect(page.locator("[data-drop-bar]")).toBeHidden()
  await page.mouse.up()
  await expect.poll(saved.order).toEqual(saved.ids)
})

test("drops land where the bar shows at 25% and 150%, after panning, at the first and last place", async ({
  page,
  context,
  stack,
}) => {
  test.setTimeout(120_000)
  const saved = await openSaved(page, context, stack, 8)
  await zoomTo(page, 25)
  await page.mouse.move(700, 400)
  await page.mouse.wheel(120, 60)
  await grab(page, 1)
  await hover(page, 8, 0.8)
  await expect(page.locator("[data-drop-bar]")).toHaveAttribute("data-drop-place", "9")
  await page.mouse.up()
  await expect(said(page)).toHaveText("Moved slide 1 to position 8")
  await expect.poll(saved.order).toEqual(picked(saved.ids, [2, 3, 4, 5, 6, 7, 8, 1]))
  await zoomTo(page, 150)
  await entry(page, 2).focus()
  await grab(page, 2)
  const room = await roomOf(page)
  await page.mouse.wheel((await boxOf(page, 1)).x - room.x - 200, 0)
  await expect.poll(async () => (await boxOf(page, 1)).x).toBeGreaterThan(room.x)
  const first = await boxOf(page, 1)
  await page.mouse.move(first.x + 120, first.y + first.height / 2, { steps: 6 })
  await expect(page.locator("[data-drop-bar]")).toHaveAttribute("data-drop-place", "1")
  await page.mouse.up()
  await expect(said(page)).toHaveText("Moved slide 2 to position 1")
  await expect.poll(saved.order).toEqual(picked(saved.ids, [3, 2, 4, 5, 6, 7, 8, 1]))
})

test("a slide dropped into another section at 60% joins it where the bar shows", async ({ page, context, stack }) => {
  const saved = await openSaved(page, context, stack, join(fixtures, "sections-after.pptx"))
  await zoomTo(page, 60)
  await entry(page, 1).focus()
  await grab(page, 1)
  await hover(page, 3, 0.7)
  await expect(page.locator("[data-drop-bar]")).toHaveAttribute("data-drop-place", "4")
  await page.mouse.up()
  await expect(said(page)).toHaveText("Moved slide 1 to position 3")
  await expect.poll(saved.order).toEqual(picked(saved.ids, [2, 3, 1]))
})

test("edge pan stores once after cancellation and restores the panned place", async ({ page, context, stack }) => {
  const saved = await openSaved(page, context, stack, 8)
  await zoomTo(page, 100)
  await entry(page, 1).focus()
  const key = `airdesign.grid-viewport.${saved.deck}`
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.scale, key)).toBe(1)
  await canvas(page).evaluate((host) => {
    host.setAttribute("data-place-writes", "0")
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("airdesign.grid-viewport."))
        host.setAttribute("data-place-writes", String(Number(host.getAttribute("data-place-writes")) + 1))
      original.call(this, key, value)
    }
  })
  await grab(page, 1)
  const room = await roomOf(page)
  const before = await panOf(page)
  await page.mouse.move(room.x + room.width / 2, room.y + room.height - 10)
  await expect.poll(async () => before.y - (await panOf(page)).y).toBeGreaterThan(200)
  await page.mouse.move(room.x + room.width / 2, room.y + room.height / 2)
  await expect(canvas(page)).toHaveAttribute("data-place-writes", "0")
  await page.keyboard.press("Escape")
  await page.mouse.up()
  await expect(canvas(page)).toHaveAttribute("data-place-writes", "1")
  const held = await panOf(page)
  await page.reload()
  await page.waitForFunction(() => document.querySelector(".thin-page[data-deck-ready]"))
  await page.getByRole("button", { name: "Grid", exact: true }).click()
  expect(await panOf(page)).toEqual(held)
  expect(await saved.order()).toEqual(saved.ids)
})
