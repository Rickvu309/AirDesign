import { zoomToOf } from "../../apps/web/src/copy/product-copy"
import { expect, type Page } from "@playwright/test"
import { test } from "./deck-test"

const bar = (page: Page) => page.locator("[data-notes-bar]")
const handle = (page: Page) => page.getByRole("button", { name: /^(Expand|Collapse) presenter notes$/ })
async function height(page: Page) {
  return bar(page).evaluate((element) => element.getBoundingClientRect().height)
}
async function start(page: Page) {
  const box = await handle(page).boundingBox()
  if (!box) throw new Error("No notes handle")
  const point = { x: box.x + box.width / 2, y: box.y + 12, height: await height(page) }
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  return { ...point, height: await height(page) }
}
async function move(page: Page, from: Awaited<ReturnType<typeof start>>, target: number) {
  await page.mouse.move(from.x, from.y + from.height - target)
  await expect.poll(async () => Math.abs((await height(page)) - target)).toBeLessThanOrEqual(2)
}
async function resized(page: Page, target: number) {
  await expect.poll(() => height(page)).toBeCloseTo(target, 0)
  await expect.poll(() => bar(page).evaluate((e) => e.getAnimations().length)).toBe(0)
}
async function catchSettle(page: Page, settle: () => Promise<void>) {
  await page.clock.install()
  const now = await page.evaluate(() => Date.now())
  await page.clock.pauseAt(now + 60_000)
  await bar(page).evaluate((element) => {
    element.addEventListener(
      "transitionrun",
      () => {
        const [animation] = element.getAnimations()
        const timing = animation?.effect?.getComputedTiming()
        if (timing === undefined) throw new Error("No notes height transition")
        animation.pause()
        animation.currentTime = timing.endTime / 2
      },
      { once: true },
    )
  })
  await settle()
  await expect
    .poll(() => bar(page).evaluate((element) => element.getAnimations().map((animation) => animation.playState)))
    .toEqual(["paused"])
  const rendered = await height(page)
  const point = await start(page)
  await page.clock.resume()
  expect(point.height).toBeCloseTo(rendered, 0)
  expect(await bar(page).evaluate((element) => element.getAnimations().length)).toBe(0)
  return point
}
test.beforeEach(async ({ page, decks }) => {
  await page.setViewportSize({ width: 1470, height: 923 })
  await decks.blank()
  await expect(page.locator("[data-slide-paint]")).toBeVisible()
})

test("tracks the whole range both ways, rubber bands, and snaps by distance", async ({ page }) => {
  await handle(page).focus()
  await page.keyboard.press("End")
  const maximum = await height(page)
  await page.keyboard.press("Home")
  const from = await start(page)
  for (const target of [150, 92, 40, 24, 40, 92, 150, 160, maximum]) await move(page, from, target)
  await page.mouse.move(from.x, from.y + from.height - maximum - 250)
  await expect.poll(() => height(page)).toBeCloseTo(maximum + 50, 0)
  const catchPoint = await catchSettle(page, () => page.mouse.up())
  expect(catchPoint.height).toBeGreaterThan(maximum)
  expect(catchPoint.height).toBeLessThan(maximum + 50)
  await page.mouse.move(catchPoint.x, catchPoint.y - 5)
  await expect.poll(async () => Math.abs((await height(page)) - catchPoint.height)).toBeLessThanOrEqual(2)
  await page.mouse.up()
  await resized(page, maximum)
  const cdp = await page.context().newCDPSession(page)
  for (const [target, result] of [
    [80, 24],
    [110, 160],
  ]) {
    const point = await start(page)
    await move(page, point, target)
    const held = Date.now() / 1000 + 0.13
    const at = { x: point.x, y: point.y + point.height - target + 0.1, button: "left" as const, timestamp: held }
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", buttons: 1, ...at })
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", buttons: 0, clickCount: 1, ...at })
    await resized(page, result)
  }
})

test("snaps by velocity when flicked across a short distance", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page)
  async function flick(distance: number) {
    const box = await handle(page).boundingBox()
    if (!box) throw new Error("No notes handle")
    const x = box.x + box.width / 2
    const y = box.y + 12
    const initial = await height(page)
    const timestamp = Date.now() / 1000
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, timestamp })
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x,
      y,
      button: "left",
      clickCount: 1,
      timestamp: timestamp + 0.01,
    })
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x,
      y: y + distance,
      button: "left",
      buttons: 1,
      timestamp: timestamp + 0.03,
    })
    await expect.poll(async () => Math.abs((await height(page)) - (initial - distance))).toBeLessThanOrEqual(2)
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x,
      y: y + distance,
      button: "left",
      clickCount: 1,
      timestamp: timestamp + 0.05,
    })
  }
  await flick(10)
  await resized(page, 24)
  await flick(-16)
  await resized(page, 160)
})

test("catches a settle at its rendered height and keeps keyboard and reduced motion instant", async ({ page }) => {
  const expandedHeight = await height(page)
  const point = await catchSettle(page, () => handle(page).click())
  expect(point.height).toBeGreaterThan(24)
  expect(point.height).toBeLessThan(expandedHeight)
  await move(page, point, point.height + 10)
  await page.mouse.up()
  await handle(page).focus()
  for (const press of [
    () => page.keyboard.press("Home"),
    () => page.keyboard.press("End"),
    () => page.keyboard.press("ArrowDown"),
    () => page.keyboard.press("ArrowUp"),
    () => page.keyboard.press("Enter"),
    () => page.keyboard.press("Space"),
  ]) {
    await handle(page).focus()
    await press()
    expect(await bar(page).evaluate((e) => e.getAnimations().length)).toBe(0)
  }
  await page.emulateMedia({ reducedMotion: "reduce" })
  await handle(page).focus()
  await page.keyboard.press("Home")
  const reduced = await start(page)
  await move(page, reduced, 80)
  await page.mouse.up()
  expect(await height(page)).toBe(24)
  expect(await bar(page).evaluate((e) => e.getAnimations().length)).toBe(0)
})

test("fits the slide in the same frame and preserves a panned zoom", async ({ page }) => {
  const sampling = page.evaluate(async () => {
    const errors: number[] = []
    for (let i = 0; i < 90; i++) {
      await new Promise(requestAnimationFrame)
      const notes = document.querySelector("[data-notes-bar]")?.getBoundingClientRect()
      const slide = document.querySelector("[data-slide-paint]")?.getBoundingClientRect()
      const canvas = document.querySelector("[data-editor-canvas]")?.getBoundingClientRect()
      const overlay = document.querySelector("[data-canvas-overlay]")?.getBoundingClientRect()
      if (!notes || !slide || !canvas || !overlay) throw new Error("Missing canvas")
      const gap = notes.top - slide.bottom
      const settledGap = Math.max(40, (canvas.height - overlay.height - slide.height) / 2)
      errors.push(Math.max(-gap, Math.abs(gap - settledGap)))
    }
    return errors
  })
  const point = await start(page)
  await page.mouse.move(point.x, point.y - 150, { steps: 30 })
  await page.mouse.up()
  expect(Math.max(...(await sampling))).toBeLessThanOrEqual(1)
  for (const zoom of [50, 100, 200]) {
    await page.getByRole("button", { name: /%/ }).click()
    await page.getByRole("menuitemradio", { name: zoomToOf(zoom), exact: true }).click()
    const stage = page.locator("[data-canvas-stage]")
    const scroll = await stage.evaluate((e) => {
      e.scrollLeft = 17
      e.scrollTop = 19
      return [e.scrollLeft, e.scrollTop]
    })
    const grip = await start(page)
    await page.mouse.move(grip.x, grip.y + 30, { steps: 5 })
    await page.mouse.up()
    await expect.poll(() => bar(page).evaluate((e) => e.getAnimations().length)).toBe(0)
    expect(await stage.evaluate((e) => [e.scrollLeft, e.scrollTop])).toEqual(scroll)
  }
})
