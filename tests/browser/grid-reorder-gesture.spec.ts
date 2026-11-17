import { expect, type Page } from "@playwright/test"
import { test } from "./api-stack"
import { boxOf, grab, hover, moveRequests, openSaved, picked, roomOf, zoomTo } from "./grid-reorder-deck"
import { entry } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 } })

const said = (page: Page) => page.locator("[data-editor-grid] [data-announcer]")

function card(page: Page, number: number) {
  return entry(page, number).locator("..")
}

test.beforeEach(async ({ page }) => {
  if (process.env.AIRDESIGN_GRID_CPU_RATE !== "4") return
  const device = await page.context().newCDPSession(page)
  await device.send("Emulation.setCPUThrottlingRate", { rate: 4 })
})

test("several selected slides travel together in deck order, and the drag shows how many", async ({
  page,
  context,
  stack,
}) => {
  const saved = await openSaved(page, context, stack, 8)
  const moves = moveRequests(page)
  await zoomTo(page, 25)
  await entry(page, 1).focus()
  await page.keyboard.press("ArrowRight")
  await entry(page, 4).click({ modifiers: ["ControlOrMeta"] })
  await expect(page.locator("[data-grid-selected]")).toHaveText("2 slides selected")
  await grab(page, 4)
  const ghost = page.locator("[data-drag-ghost]")
  await expect(ghost).toBeVisible()
  await expect(ghost.locator("[data-drag-count]")).toHaveText("2")
  await expect(entry(page, 2)).toHaveCSS("opacity", "0.4")
  await expect(entry(page, 4)).toHaveCSS("opacity", "0.4")
  await hover(page, 6, 0.8)
  await expect(page.locator("[data-drop-bar]")).toHaveAttribute("data-drop-place", "7")
  await page.mouse.up()
  await expect(ghost).toHaveCount(0)
  await expect(said(page)).toHaveText("Moved 2 slides to position 5")
  await expect.poll(saved.order).toEqual(picked(saved.ids, [1, 3, 5, 6, 2, 4, 7, 8]))
  expect(moves()).toBe(2)
  await expect(page.locator("[data-grid-selected]")).toHaveText("2 slides selected")
  await expect(entry(page, 5)).toHaveAttribute("aria-label", /selected$/)
  await expect(entry(page, 6)).toHaveAttribute("aria-label", /selected$/)
})

test("Escape mid-drag and a drop outside the canvas put every slide back and send no move", async ({
  page,
  context,
  stack,
}) => {
  const saved = await openSaved(page, context, stack, 8)
  const moves = moveRequests(page)
  for (const cancel of ["Escape", "outside"]) {
    await grab(page, 1)
    await hover(page, 3, 0.8)
    await expect
      .poll(async () => card(page, 2).evaluate((element) => getComputedStyle(element).transform))
      .not.toBe("none")
    if (cancel === "Escape") await page.keyboard.press("Escape")
    else await page.mouse.move(700, 30, { steps: 4 })
    await expect(page.locator("[data-drop-bar]")).toBeHidden()
    await expect.poll(async () => card(page, 2).evaluate((element) => getComputedStyle(element).transform)).toBe("none")
    await page.mouse.up()
    await expect(entry(page, 1)).toHaveCSS("opacity", "1")
    await expect(page.locator("[data-drag-ghost]")).toHaveCount(0)
    await expect(page.locator("[data-grid-edit]")).toHaveCount(0)
  }
  await expect(said(page)).not.toContainText("Moved")
  await page.waitForTimeout(500)
  expect(moves()).toBe(0)
  expect(await saved.order()).toEqual(saved.ids)
})

for (const percent of [12, 200]) {
  test(`the drop bar and drag image keep their screen size at ${String(percent)}%, and nothing animates with reduced motion`, async ({
    page,
    context,
    stack,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await openSaved(page, context, stack, 4)
    await zoomTo(page, percent)
    await entry(page, 2).focus()
    if (percent === 200) {
      const room = await roomOf(page)
      await page.mouse.move(room.x + room.width / 2, room.y + room.height / 2)
      await page.mouse.wheel((await boxOf(page, 2)).x - room.x - room.width / 2, 0)
    }
    await grab(page, 2)
    await hover(page, 2, 0.05)
    const bar = page.locator("[data-drop-bar]")
    await expect(bar).toHaveAttribute("data-drop-place", "2")
    const mark = await bar.boundingBox()
    const before = await boxOf(page, 1)
    const after = await boxOf(page, 2)
    expect(mark?.width).toBeCloseTo(4, 0)
    expect((mark?.x ?? 0) + (mark?.width ?? 0) / 2).toBeCloseTo((before.x + before.width + after.x) / 2, 0)
    const ghost = await page.locator("[data-drag-ghost]").boundingBox()
    expect(ghost?.width).toBeCloseTo(160, 0)
    await expect(entry(page, 2)).toHaveCSS("opacity", "0.4")
    for (const number of [1, 2, 3, 4]) {
      await expect(card(page, number)).toHaveCSS("transform", "none")
      await expect(card(page, number)).toHaveCSS("transition-duration", "0s")
    }
    await page.keyboard.press("Escape")
    await page.mouse.up()
  })
}

test("bracket keys and Alt+arrows move a slide and pan the canvas to keep it in view", async ({
  page,
  context,
  stack,
}) => {
  const saved = await openSaved(page, context, stack, 6)
  await zoomTo(page, 200)
  await entry(page, 1).focus()
  const inView = async (number: number) => {
    const room = await roomOf(page)
    const box = await boxOf(page, number)
    const middle = box.x + box.width / 2
    return (
      middle > room.x && middle < room.x + room.width && box.y < room.y + room.height && box.y > room.y - box.height
    )
  }
  await page.keyboard.press("ControlOrMeta+]")
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, 2)).toBeFocused()
  await expect.poll(() => inView(2)).toBe(true)
  await expect.poll(saved.order).toEqual(picked(saved.ids, [2, 1, 3, 4, 5, 6]))
  await page.keyboard.press("ControlOrMeta+]")
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, 3)).toBeFocused()
  await page.keyboard.press("ControlOrMeta+]")
  await expect(entry(page, 4)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, 4)).toBeFocused()
  await expect.poll(() => inView(4)).toBe(true)
  await page.keyboard.press("ControlOrMeta+[")
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, 3)).toBeFocused()
  await expect.poll(() => inView(3)).toBe(true)
  await page.keyboard.press("Alt+ArrowRight")
  await expect(entry(page, 4)).toHaveAttribute("aria-current", "true")
  await expect.poll(() => inView(4)).toBe(true)
  await expect.poll(saved.order).toEqual(picked(saved.ids, [2, 3, 4, 1, 5, 6]))
})

test("a slide number, a slide's blank background and a touch drag reorder; an object on the open slide does not", async ({
  page,
  context,
  stack,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  const saved = await openSaved(page, context, stack, 4)
  await zoomTo(page, 20)
  const number = await page.locator("[data-slide-number]").first().boundingBox()
  if (number === null) throw new Error("no slide number")
  await page.mouse.move(number.x + number.width / 2, number.y + number.height / 2)
  await page.mouse.down()
  await hover(page, 2, 0.8)
  await page.mouse.up()
  await expect.poll(saved.order).toEqual(picked(saved.ids, [2, 1, 3, 4]))
  await card(page, 4).locator("[data-thumb-node]").first().click({ force: true })
  const open = page.locator("[data-grid-edit]")
  await expect(open).toHaveCount(1)
  const shown = await open.boundingBox()
  if (shown === null) throw new Error("no open slide")
  const object = await open.locator("[data-canvas-element]").first().boundingBox()
  if (object === null) throw new Error("no object")
  await page.mouse.move(object.x + object.width / 2, object.y + object.height / 2)
  await page.mouse.down()
  await hover(page, 1, 0.2)
  await expect(page.locator("[data-drop-bar]")).toBeHidden()
  await expect(page.locator("[data-drag-ghost]")).toHaveCount(0)
  await page.mouse.up()
  await expect.poll(saved.order).toEqual(picked(saved.ids, [2, 1, 3, 4]))
  await page.mouse.move(shown.x + shown.width - 6, shown.y + shown.height - 6)
  await page.mouse.down()
  await hover(page, 1, 0.2)
  await expect(page.locator("[data-drop-bar]")).toHaveAttribute("data-drop-place", "1")
  await page.mouse.up()
  await expect.poll(saved.order).toEqual(picked(saved.ids, [4, 2, 1, 3]))
  const touch = await page.context().newCDPSession(page)
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 })
  const from = await boxOf(page, 4)
  const to = await boxOf(page, 2)
  const steps = [0, 0.25, 0.5, 0.75, 1].map((share) => ({
    x: from.x + from.width / 2 + (to.x + to.width * 0.8 - from.x - from.width / 2) * share,
    y: from.y + from.height / 2 + (to.y - from.y) * share,
  }))
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [steps[0] ?? { x: 0, y: 0 }] })
  for (const point of steps.slice(1))
    await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] })
  await expect(page.locator("[data-drop-bar]")).toHaveAttribute("data-drop-place", "3")
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  await expect.poll(saved.order).toEqual(picked(saved.ids, [4, 2, 3, 1]))
})
