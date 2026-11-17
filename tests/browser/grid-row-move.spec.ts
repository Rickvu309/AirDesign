import { expect, type Page } from "@playwright/test"
import { test } from "./api-stack"
import { boxOf, grab, hover, moveRequests, openSaved, picked, zoomTo } from "./grid-reorder-deck"
import { entry } from "./slide-grid-deck"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"

const handle = (page: Page, row: number) => page.getByRole("button", { name: slideListCopy.moveRow(row), exact: true })
test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("a group drop is one saved edit and one undo restores both slides", async ({ page, context, stack }) => {
  const saved = await openSaved(page, context, stack, 8)
  const moves = moveRequests(page)
  await zoomTo(page, 25)
  await entry(page, 2).focus()
  await page.keyboard.press("ArrowLeft")
  await entry(page, 4).click({ modifiers: ["ControlOrMeta"] })
  await grab(page, 4)
  await hover(page, 6, 0.8)
  await page.mouse.up()
  await expect.poll(saved.order).toEqual(picked(saved.ids, [2, 3, 5, 6, 1, 4, 7, 8]))
  await expect.poll(saved.rows).toEqual([picked(saved.ids, [2, 3]), picked(saved.ids, [5, 6, 1, 4, 7, 8])])
  expect(moves()).toBe(1)
  await page.getByRole("button", { name: undoCopy.undoNamed.order, exact: true }).click()
  await expect.poll(saved.order).toEqual(saved.ids)
  await expect.poll(saved.rows).toEqual([saved.ids.slice(0, 4), saved.ids.slice(4)])
})

test("row hover yields to slide hover, Space, editing and small zoom", async ({ page, context, stack }) => {
  const saved = await openSaved(page, context, stack, 10)
  await zoomTo(page, 50)
  const one = await boxOf(page, 1),
    two = await boxOf(page, 2)
  await page.mouse.move((one.x + one.width + two.x) / 2, one.y + one.height / 2)
  await expect(page.locator('[data-row-hover="band"]')).toHaveCount(1)
  await expect(handle(page, 1)).toBeVisible()
  await entry(page, 2).hover()
  await expect(page.locator('[data-row-hover="band"]')).toHaveCount(0)
  await entry(page, 2).focus()
  await page.keyboard.down("Space")
  await expect(handle(page, 1)).toBeHidden()
  await page.keyboard.up("Space")
  await handle(page, 1).focus()
  await page.keyboard.down("Space")
  await expect(handle(page, 1)).toBeHidden()
  await page.keyboard.up("Space")
  await zoomTo(page, 10)
  await expect(handle(page, 1)).toBeHidden()
  await zoomTo(page, 50)
  await page.keyboard.press("h")
  await expect(handle(page, 1)).toBeHidden()
  await page.keyboard.press("v")
  await entry(page, 2).focus()
  await page.keyboard.press("Enter")
  await page.locator('[data-grid-edit] [contenteditable="true"]').first().focus()
  await expect(handle(page, 1)).toBeHidden()
  expect(await saved.order()).toEqual(saved.ids)
  expect(await saved.rows()).toEqual([saved.ids.slice(0, 4), saved.ids.slice(4, 8), saved.ids.slice(8)])
})

for (const cancel of ["Escape", "outside", "drop"]) {
  test(`a whole row drags between unequal rows: ${cancel}`, async ({ page, context, stack }) => {
    const saved = await openSaved(page, context, stack, 10)
    const moves = moveRequests(page)
    await zoomTo(page, 20)
    await handle(page, 3).focus()
    const button = await handle(page, 3).boundingBox()
    if (button === null) throw new Error("handle")
    await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2)
    await page.mouse.down()
    const first = await boxOf(page, 1),
      second = await boxOf(page, 5)
    await page.mouse.move(first.x + first.width / 2, (first.y + first.height + second.y) / 2, { steps: 6 })
    await expect(page.locator("[data-drag-ghost][data-row-drag]")).toBeVisible()
    await expect(page.locator("[data-drop-bar][data-row-drop]")).toBeVisible()
    if (cancel === "Escape") await page.keyboard.press("Escape")
    if (cancel === "outside") await page.mouse.move(700, 20)
    await page.mouse.up()
    await expect(page.locator("[data-drag-ghost]")).toHaveCount(0)
    await expect
      .poll(saved.order)
      .toEqual(cancel === "drop" ? picked(saved.ids, [1, 2, 3, 4, 9, 10, 5, 6, 7, 8]) : saved.ids)
    await expect
      .poll(saved.rows)
      .toEqual(
        cancel === "drop"
          ? [saved.ids.slice(0, 4), saved.ids.slice(8), saved.ids.slice(4, 8)]
          : [saved.ids.slice(0, 4), saved.ids.slice(4, 8), saved.ids.slice(8)],
      )
    expect(moves()).toBe(cancel === "drop" ? 1 : 0)
    if (cancel === "drop") {
      await page.getByRole("button", { name: undoCopy.undoNamed.order, exact: true }).click()
      await expect.poll(saved.order).toEqual(saved.ids)
      await expect.poll(saved.rows).toEqual([saved.ids.slice(0, 4), saved.ids.slice(4, 8), saved.ids.slice(8)])
    }
  })
}

test("Alt+Up and Alt+Down move the focused row and announce its position", async ({ page, context, stack }) => {
  const saved = await openSaved(page, context, stack, 10)
  await handle(page, 3).focus()
  await page.keyboard.press("Alt+ArrowUp")
  await expect.poll(saved.order).toEqual(picked(saved.ids, [1, 2, 3, 4, 9, 10, 5, 6, 7, 8]))
  await expect(page.locator("[data-editor-grid] [data-announcer]")).toHaveText(slideListCopy.rowMoved(3, 2))
  await expect.poll(saved.rows).toEqual([saved.ids.slice(0, 4), saved.ids.slice(8), saved.ids.slice(4, 8)])
  await expect(handle(page, 2)).toBeFocused()
  await page.keyboard.press("Alt+ArrowDown")
  await expect.poll(saved.order).toEqual(saved.ids)
  await expect.poll(saved.rows).toEqual([saved.ids.slice(0, 4), saved.ids.slice(4, 8), saved.ids.slice(8)])
  await expect(handle(page, 3)).toBeFocused()
  const one = await boxOf(page, 1),
    two = await boxOf(page, 2)
  await page.mouse.move((one.x + one.width + two.x) / 2, one.y + one.height / 2)
  await expect(page.locator('[data-row-hover="band"]')).toHaveCount(1)
  await handle(page, 1).focus()
  await page.keyboard.press("Alt+ArrowDown")
  await expect.poll(saved.rows).toEqual([saved.ids.slice(4, 8), saved.ids.slice(0, 4), saved.ids.slice(8)])
  await expect(handle(page, 2)).toBeFocused()
  await expect(page.locator('[data-row-hover="band"]')).toHaveCount(0)
  await page.keyboard.press("Alt+ArrowUp")
  await expect.poll(saved.order).toEqual(saved.ids)
  await expect.poll(saved.rows).toEqual([saved.ids.slice(0, 4), saved.ids.slice(4, 8), saved.ids.slice(8)])
  await expect(handle(page, 1)).toBeFocused()
})

test("a row crossing a named section follows placement and saves the same rows", async ({ page, context, stack }) => {
  const saved = await openSaved(page, context, stack, 6, true)
  await handle(page, 1).focus()
  const control = await handle(page, 1).boundingBox(),
    slide = await boxOf(page, 1)
  if (control === null) throw new Error("handle")
  expect(control.y + control.height / 2).toBeCloseTo(slide.y + slide.height / 2, 0)
  await page.keyboard.press("Alt+ArrowDown")
  await expect.poll(saved.order).toEqual(picked(saved.ids, [5, 6, 1, 2, 3, 4]))
  await expect.poll(saved.rows).toEqual([saved.ids.slice(4), saved.ids.slice(0, 4)])
  await expect(page.locator("[data-section-head]")).toHaveCount(1)
  await expect(page.locator("[data-section-head]")).toContainText("Results")
  await page.getByRole("button", { name: undoCopy.undoNamed.order, exact: true }).click()
  await expect.poll(saved.order).toEqual(saved.ids)
  await expect.poll(saved.rows).toEqual([saved.ids.slice(0, 4), saved.ids.slice(4)])
  await expect(page.locator("[data-section-head]")).toHaveCount(2)
})

test("a row drag edge-pans and cancellation saves no move", async ({ page, context, stack }) => {
  const saved = await openSaved(page, context, stack, 50)
  await zoomTo(page, 50)
  await handle(page, 1).focus()
  const button = await handle(page, 1).boundingBox()
  if (button === null) throw new Error("handle")
  const world = page.locator("[data-focus-edge]")
  const before = await world.getAttribute("style")
  await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2)
  await page.mouse.down()
  const room = await page.locator("[data-grid-viewport]").boundingBox()
  if (room === null) throw new Error("viewport")
  await page.mouse.move(room.x + room.width / 2, room.y + room.height - 12, { steps: 5 })
  await expect.poll(() => world.getAttribute("style")).not.toBe(before)
  await expect(page.locator("[data-drag-ghost][data-row-drag]")).toBeVisible()
  await page.keyboard.press("Escape")
  await page.mouse.up()
  await expect.poll(saved.order).toEqual(saved.ids)
  expect((await saved.rows()).flat()).toEqual(saved.ids)
})

test.describe("row touch", () => {
  test.use({ hasTouch: true })
  test("a touch tap never leaves row chrome", async ({ page, context, stack }) => {
    const saved = await openSaved(page, context, stack, 10)
    await entry(page, 2).tap({ position: { x: 100, y: 80 } })
    await expect(page.locator("[data-row-hover]")).toHaveCount(0)
    await expect(handle(page, 1)).toHaveCSS("opacity", "0")
    expect(await saved.order()).toEqual(saved.ids)
    expect(await saved.rows()).toEqual([saved.ids.slice(0, 4), saved.ids.slice(4, 8), saved.ids.slice(8)])
  })
})

test("a foreign structural edit cancels a held row without moving different slides", async ({
  page,
  context,
  stack,
}) => {
  const saved = await openSaved(page, context, stack, 10)
  const moves = moveRequests(page)
  await zoomTo(page, 20)
  await handle(page, 2).focus()
  const button = await handle(page, 2).boundingBox(),
    first = await boxOf(page, 1),
    second = await boxOf(page, 5)
  if (button === null) throw new Error("handle")
  await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2)
  await page.mouse.down()
  await page.mouse.move(first.x + first.width / 2, (first.y + first.height + second.y) / 2, { steps: 5 })
  await expect(page.locator("[data-drag-ghost]")).toBeVisible()
  const read = await stack.callTool("airdesign_read_deck", { deck: saved.deck }, saved.cookie)
  await stack.callTool(
    "airdesign_edit_deck",
    {
      deck: saved.deck,
      base: read.revision,
      changes: [{ op: "add_slide", after: saved.ids[4], layout: saved.ids[0] }],
    },
    saved.cookie,
  )
  await expect(page.locator("[data-slide-entry]")).toHaveCount(11)
  await expect(page.locator("[data-drag-ghost]")).toHaveCount(0)
  await page.mouse.up()
  const order = await saved.order(),
    added = order.find((id) => !saved.ids.includes(id))
  if (added === undefined) throw new Error("foreign slide")
  expect(order).toEqual([...saved.ids.slice(0, 5), added, ...saved.ids.slice(5)])
  expect(await saved.rows()).toEqual([
    saved.ids.slice(0, 4),
    [saved.ids[4], added, ...saved.ids.slice(5, 8)],
    saved.ids.slice(8),
  ])
  expect(moves()).toBe(0)
})
