import { expect, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { test } from "./api-stack"
import { blankAt, belowRight, centre, crossed, marquee, pick, selectedNumbers, type Point } from "./grid-marquee-deck"
import { openSaved, panOf, picked, roomOf } from "./grid-reorder-deck"
import { groupNumbers, groupSizes } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const announcer = "[data-editor-grid] [data-announcer]"

async function moved(page: Page, before: Point, by: Point) {
  const after = await panOf(page)
  expect(after.x - before.x).toBeCloseTo(by.x, 1)
  expect(after.y - before.y).toBeCloseTo(by.y, 1)
}

test("a drag on empty canvas selects every slide it crosses across slide groups, live and like a Shift-click set, and Delete removes them with one Undo", async ({
  page,
  context,
  stack,
}) => {
  const saved = await openSaved(page, context, stack, 7, groupSizes(7))
  expect((await groupNumbers(page)).length).toBeGreaterThan(1)
  await pick(page, 1)
  const said = await page.locator(announcer).textContent()
  const from = await belowRight(page, 7)
  const to = await centre(page, 2)
  const halfway = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(halfway.x, halfway.y, { steps: 6 })
  await expect(marquee(page)).toBeVisible()
  await expect.poll(() => selectedNumbers(page)).toEqual(await crossed(page, from, halfway))
  await page.mouse.move(to.x, to.y, { steps: 6 })
  const expected = await crossed(page, from, to)
  expect(expected).toEqual(expect.arrayContaining([2, 6, 7]))
  await expect.poll(() => selectedNumbers(page)).toEqual(expected)
  const look = await marquee(page).evaluate((box) => {
    const style = getComputedStyle(box)
    const ring = getComputedStyle(document.documentElement).getPropertyValue("--ring").trim()
    const probe = document.createElement("i")
    probe.style.color = ring
    document.body.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    const rect = box.getBoundingClientRect()
    return {
      edge: style.borderTopColor === color,
      fill: style.backgroundColor,
      transition: style.transitionDuration,
      moving: document.getAnimations().length,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    }
  })
  expect(look.edge).toBe(true)
  expect(look.fill).not.toBe("rgba(0, 0, 0, 0)")
  expect(look.transition).toBe("0s")
  expect(look.moving).toBe(0)
  expect(look.rect.x).toBeCloseTo(to.x, 0)
  expect(look.rect.y).toBeCloseTo(to.y, 0)
  expect(look.rect.width).toBeCloseTo(from.x - to.x, 0)
  await expect(page.locator(announcer)).toHaveText(said ?? "")
  await page.mouse.up()
  await expect(marquee(page)).toBeHidden()
  await expect(page.locator(announcer)).toHaveText(slideListCopy.selected(expected.length))
  await expect(page.locator("[data-grid-selected]")).toHaveText(slideListCopy.selected(expected.length))
  await expect(page.locator("[data-slide-entry][data-selected]:focus")).toHaveCount(1)
  await page.keyboard.press(slideListCopy.deleteKey)
  await expect(page.locator(announcer)).toHaveText(slideListCopy.deletedSet(expected.length))
  const kept = [1, 2, 3, 4, 5, 6, 7].filter((number) => !expected.includes(number))
  await expect.poll(saved.order).toEqual(picked(saved.ids, kept))
  await page.getByRole("button", { name: undoCopy.undoNamed.delete, exact: true }).click()
  await expect.poll(saved.order).toEqual(saved.ids)
})

test("Shift-drag adds to the selection and a slide the drag leaves again goes back to how it was", async ({
  page,
  context,
  stack,
}) => {
  await openSaved(page, context, stack, 7, groupSizes(7))
  await pick(page, 1, 2)
  const from = await belowRight(page, 7)
  await page.mouse.move(from.x, from.y)
  await page.keyboard.down("Shift")
  await page.mouse.down()
  const six = await centre(page, 6)
  await page.mouse.move(six.x, six.y, { steps: 6 })
  await expect
    .poll(() => selectedNumbers(page))
    .toEqual([...new Set([1, 2, ...(await crossed(page, from, six))])].sort())
  const two = await centre(page, 2)
  await page.mouse.move(two.x, two.y, { steps: 6 })
  await expect
    .poll(() => selectedNumbers(page))
    .toEqual([...new Set([1, 2, ...(await crossed(page, from, two))])].sort())
  const seven = await centre(page, 7)
  await page.mouse.move(seven.x, seven.y, { steps: 6 })
  await expect.poll(() => selectedNumbers(page)).toEqual([1, 2, 7])
  await expect(page.locator("[data-grid-viewport]")).toHaveCSS("outline-style", "none")
  await page.mouse.up()
  await page.keyboard.up("Shift")
  await expect(page.locator(announcer)).toHaveText(slideListCopy.selected(3))
  await expect.poll(() => selectedNumbers(page)).toEqual([1, 2, 7])
})

test("a press on empty canvas under the drag threshold clears the selection as a click did", async ({
  page,
  context,
  stack,
}) => {
  await openSaved(page, context, stack, 7, groupSizes(7))
  await pick(page, 2, 3)
  const from = await belowRight(page, 7)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 2, from.y + 2)
  await expect(marquee(page)).toBeHidden()
  await page.mouse.up()
  await expect.poll(() => selectedNumbers(page)).toEqual([])
  await expect(page.locator(announcer)).toHaveText(slideListCopy.nothingSelected)
})

test("Escape cancels the drag and restores the selection, and Space does not pan mid-drag", async ({
  page,
  context,
  stack,
}) => {
  await openSaved(page, context, stack, 7, groupSizes(7))
  await pick(page, 1, 2)
  const from = await belowRight(page, 7)
  const six = await centre(page, 6)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(six.x, six.y, { steps: 6 })
  await expect.poll(() => selectedNumbers(page)).toEqual(await crossed(page, from, six))
  const pan = await panOf(page)
  await page.keyboard.down("Space")
  await page.mouse.move(six.x - 30, six.y - 20, { steps: 4 })
  await page.keyboard.up("Space")
  expect(await panOf(page)).toEqual(pan)
  await expect(marquee(page)).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(marquee(page)).toBeHidden()
  await expect.poll(() => selectedNumbers(page)).toEqual([1, 2])
  await page.mouse.move(from.x, from.y, { steps: 3 })
  await page.mouse.up()
  await expect.poll(() => selectedNumbers(page)).toEqual([1, 2])
  await expect(page.locator("[data-grid-selected]")).toHaveText(slideListCopy.selected(2))
})

test("a lost window and a cancelled pointer end the drag like Escape and restore the selection", async ({
  page,
  context,
  stack,
}) => {
  await openSaved(page, context, stack, 7)
  await pick(page, 1, 2)
  const from = await belowRight(page, 7)
  const six = await centre(page, 6)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(six.x, six.y, { steps: 6 })
  await expect.poll(() => selectedNumbers(page)).toEqual(await crossed(page, from, six))
  await page.evaluate(() => window.dispatchEvent(new Event("blur")))
  await expect(marquee(page)).toBeHidden()
  await expect.poll(() => selectedNumbers(page)).toEqual([1, 2])
  await page.mouse.move(from.x, from.y, { steps: 3 })
  await page.mouse.up()
  await expect.poll(() => selectedNumbers(page)).toEqual([1, 2])
  await expect(page.locator("[data-grid-selected]")).toHaveText(slideListCopy.selected(2))

  await page.evaluate(() => {
    window.addEventListener("pointerdown", (event) => {
      const seen = window as unknown as { pointer?: number }
      seen.pointer = event.pointerId
    })
  })
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(six.x, six.y, { steps: 6 })
  await expect.poll(() => selectedNumbers(page)).toEqual(await crossed(page, from, six))
  await page.evaluate(
    (pointer) => window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: pointer })),
    await page.evaluate(() => (window as unknown as { pointer?: number }).pointer),
  )
  await expect(marquee(page)).toBeHidden()
  await expect.poll(() => selectedNumbers(page)).toEqual([1, 2])
  await page.mouse.move(from.x, from.y, { steps: 3 })
  await page.mouse.up()
  await expect.poll(() => selectedNumbers(page)).toEqual([1, 2])
})

test("the rectangle edge-pans the canvas and stays anchored to its start in canvas space", async ({
  page,
  context,
  stack,
}) => {
  await openSaved(page, context, stack, 7, groupSizes(7))
  const room = await roomOf(page)
  const from = await blankAt(page, { x: room.x + room.width - 120, y: room.y + 120 })
  const pan = await panOf(page)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(room.x + room.width / 2, room.y + room.height - 8, { steps: 8 })
  await expect.poll(async () => pan.y - (await panOf(page)).y).toBeGreaterThan(80)
  const held = await page.evaluate(() => {
    const world = document.querySelector('[role="group"][aria-label="Slides"]')!
    const matrix = new DOMMatrixReadOnly(getComputedStyle(world).transform)
    const box = document.querySelector("[data-grid-marquee]")!.getBoundingClientRect()
    return { y: matrix.m42, top: box.top, right: box.right }
  })
  expect(held.top).toBeCloseTo(from.y + held.y - pan.y, 0)
  expect(held.right).toBeCloseTo(from.x, 0)
  await page.mouse.up()
  await expect(marquee(page)).toBeHidden()
  expect((await selectedNumbers(page)).length).toBeGreaterThan(0)
})

test("touch, the hand tool and the middle button still pan from empty canvas without a rectangle", async ({
  page,
  context,
  stack,
}) => {
  await openSaved(page, context, stack, 7, groupSizes(7))
  await pick(page, 3)
  const from = await belowRight(page, 7)
  const touch = await page.context().newCDPSession(page)
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 })
  let pan = await panOf(page)
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] })
  for (const share of [0.25, 0.5, 0.75, 1])
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x - 60 * share, y: from.y - 40 * share }],
    })
  await expect(marquee(page)).toBeHidden()
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  await moved(page, pan, { x: -60, y: -40 })
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: false })
  expect(await selectedNumbers(page)).toEqual([3])
  for (const way of ["hand", "middle"] as const) {
    const start = await belowRight(page, 7)
    if (way === "hand") await page.keyboard.press("h")
    pan = await panOf(page)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down({ button: way === "hand" ? "left" : "middle" })
    await page.mouse.move(start.x - 50, start.y - 30, { steps: 4 })
    await expect(marquee(page)).toBeHidden()
    await page.mouse.up({ button: way === "hand" ? "left" : "middle" })
    await moved(page, pan, { x: -50, y: -30 })
    if (way === "hand") await page.keyboard.press("v")
  }
  expect(await selectedNumbers(page)).toEqual([3])
})

test("selects tiny slides with hidden numbers in a deck with named groups and stored slide groups", async ({
  page,
  context,
  stack,
}) => {
  await openSaved(page, context, stack, 7, true)
  await expect(page.locator("[data-slide-group]").first()).toHaveAccessibleName("Opening")
  await expect(page.locator("[data-group-head]")).toHaveCount(0)
  await page.locator("[data-grid-viewport]").evaluate((host) => {
    const box = host.getBoundingClientRect()
    const at = { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }
    for (let delta = Math.log(25 / 4) * 100; delta > 0; delta -= 10)
      host.dispatchEvent(
        new WheelEvent("wheel", { ...at, deltaY: Math.min(10, delta), ctrlKey: true, bubbles: true, cancelable: true }),
      )
  })
  await expect(page.locator('[data-number-placement="hidden"]')).toHaveCount(7)
  const room = await roomOf(page)
  const from = await blankAt(page, { x: room.x + room.width - 100, y: room.y + room.height - 100 })
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(room.x + 70, room.y + 70, { steps: 8 })
  await expect.poll(() => selectedNumbers(page)).toEqual([1, 2, 3, 4, 5, 6, 7])
  await page.mouse.up()
  await expect(page.locator(announcer)).toHaveText(slideListCopy.selected(7))
})
