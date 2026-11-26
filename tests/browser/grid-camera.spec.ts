import { expect, type Page } from "@playwright/test"
import { editorCopy } from "../../apps/web/src/copy/editor-copy.ts"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy.ts"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { boxOf, chip, entry, openGroups, percent, viewport, wheelAt } from "./grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

async function movedBy(page: Page, number: number, before: { x: number; y: number }, by: { x: number; y: number }) {
  const after = await boxOf(entry(page, number))
  expect(after.x - before.x).toBeCloseTo(by.x, 0)
  expect(after.y - before.y).toBeCloseTo(by.y, 0)
}

async function drag(
  page: Page,
  from: { x: number; y: number },
  by: { x: number; y: number },
  button: "left" | "middle",
) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down({ button })
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 5 })
  await page.mouse.up({ button })
}

const tools = (page: Page) => page.getByRole("toolbar", { name: editorCopy.tools })

test("the wheel pans, Shift turns it sideways, and Ctrl or Cmd with the wheel zooms about the cursor", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [4, 3])
  const room = await boxOf(viewport(page))
  const middle = { x: room.x + room.width / 2, y: room.y + room.height / 2 }
  let first = await boxOf(entry(page, 1))
  await wheelAt(page, middle, { x: 100, y: 60 })
  await movedBy(page, 1, first, { x: -100, y: -60 })
  first = await boxOf(entry(page, 1))
  await wheelAt(page, middle, { x: 0, y: 80 }, { shiftKey: true })
  await movedBy(page, 1, first, { x: -80, y: 0 })
  const sixth = await boxOf(entry(page, 6))
  const cursor = { x: Math.round(sixth.x + sixth.width * 0.3), y: Math.round(sixth.y + sixth.height * 0.4) }
  const before = await percent(page)
  for (let step = 0; step < 10; step += 1) await wheelAt(page, cursor, { x: 0, y: -10 }, { ctrlKey: true })
  await expect.poll(() => percent(page)).toBeGreaterThan(before * 2)
  const zoomed = await boxOf(entry(page, 6))
  expect(zoomed.x + ((cursor.x - sixth.x) / sixth.width) * zoomed.width).toBeCloseTo(cursor.x, 0)
  expect(zoomed.y + ((cursor.y - sixth.y) / sixth.height) * zoomed.height).toBeCloseTo(cursor.y, 0)
})

test("Space-drag pans over a focused slide with a grab cursor, without picking the slide", async ({
  page,
  context,
  stack,
}) => {
  covers("pan")
  await openGroups(page, context, stack, [4, 3])
  await entry(page, 1).focus()
  const second = await boxOf(entry(page, 2))
  await page.keyboard.down(shortcutCopy.keyNames.Space)
  await expect(viewport(page)).toHaveCSS("cursor", "grab")
  await expect(entry(page, 2)).toHaveCSS("cursor", "grab")
  await drag(page, { x: second.x + 20, y: second.y + 20 }, { x: 80, y: 40 }, "left")
  await page.keyboard.up(shortcutCopy.keyNames.Space)
  await movedBy(page, 2, second, { x: 80, y: 40 })
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, 1)).toBeFocused()
  await expect(chip(page)).toHaveCount(0)
  await expect(viewport(page)).not.toHaveCSS("cursor", "grab")
  expect(await page.evaluate(() => [scrollX, scrollY, document.scrollingElement?.scrollTop ?? 0])).toEqual([0, 0, 0])
})

test("H picks the hand tool, whose drag pans and click picks nothing, V returns to move, and the middle button pans", async ({
  page,
  context,
  stack,
}) => {
  covers("tool-hand", "tool-move")
  await openGroups(page, context, stack, [4, 3])
  await page.keyboard.press("h")
  await expect(tools(page).getByRole("button", { name: editorCopy.toolHand, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  let third = await boxOf(entry(page, 3))
  await drag(page, { x: third.x + 20, y: third.y + 20 }, { x: 60, y: 40 }, "left")
  await movedBy(page, 3, third, { x: 60, y: 40 })
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
  await entry(page, 2).click()
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, 1)).toHaveAttribute("data-selected", "true")
  await page.keyboard.press("v")
  await expect(tools(page).getByRole("button", { name: editorCopy.toolMove, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  third = await boxOf(entry(page, 3))
  await drag(page, { x: third.x + 20, y: third.y + 20 }, { x: -50, y: -30 }, "middle")
  await movedBy(page, 3, third, { x: -50, y: -30 })
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
  await entry(page, 3).click()
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
})

test("arrows with no slide focused pan the canvas, while a focused slide's arrows move between slides", async ({
  page,
  context,
  stack,
}) => {
  covers("pan-arrows")
  await openGroups(page, context, stack, [4, 3])
  const first = await boxOf(entry(page, 1))
  await viewport(page).click({ position: { x: 10, y: 10 } })
  await page.keyboard.press("ArrowRight")
  await movedBy(page, 1, first, { x: -80, y: 0 })
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  await page.keyboard.press("ArrowDown")
  await movedBy(page, 1, first, { x: -80, y: -80 })
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
  await page.keyboard.press("ArrowUp")
  await movedBy(page, 1, first, { x: -80, y: 0 })
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
  await entry(page, 1).focus()
  const focused = await boxOf(entry(page, 1))
  await page.keyboard.press("ArrowRight")
  await expect(entry(page, 2)).toBeFocused()
  await movedBy(page, 1, focused, { x: 0, y: 0 })
})

test("thirty pinch steps zoom at once and keep the camera with one write once they settle", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [4, 3])
  const before = await percent(page)
  await viewport(page).evaluate((element) => {
    const counted = window as unknown as { gridWrites: number }
    counted.gridWrites = 0
    const write = Storage.prototype.setItem
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith("airdesign.grid-viewport.")) counted.gridWrites += 1
      write.call(this, key, value)
    }
    const box = element.getBoundingClientRect()
    for (let step = 0; step < 30; step += 1)
      element.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: -2,
          ctrlKey: true,
          clientX: box.x + box.width / 2,
          clientY: box.y + box.height / 2,
          bubbles: true,
          cancelable: true,
        }),
      )
  })
  await expect.poll(() => percent(page)).toBeGreaterThan(before)
  const writes = () => page.evaluate(() => (window as unknown as { gridWrites: number }).gridWrites)
  await expect.poll(writes).toBe(1)
  const kept = await page.evaluate(
    () => Object.entries(localStorage).find(([key]) => key.startsWith("airdesign.grid-viewport."))?.[1],
  )
  expect(Math.round((JSON.parse(kept ?? "{}") as { scale: number }).scale * 100)).toBe(await percent(page))
  expect(await writes()).toBe(1)
})

test.describe("touch", () => {
  test.use({ hasTouch: true })

  test("a touch drag on empty canvas pans the slides", async ({ page, context, stack }) => {
    await openGroups(page, context, stack, [4, 3])
    const room = await boxOf(viewport(page))
    const first = await boxOf(entry(page, 1))
    const from = { x: room.x + 20, y: room.y + room.height - 20 }
    const touch = await context.newCDPSession(page)
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] })
    for (let step = 1; step <= 5; step += 1)
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: from.x + step * 12, y: from.y - step * 8 }],
      })
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    await movedBy(page, 1, first, { x: 60, y: -40 })
  })
})
