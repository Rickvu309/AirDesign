import { expect, type Page } from "@playwright/test"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy.ts"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy.ts"
import { test } from "./api-stack"
import { covers } from "./gesture"
import {
  boxOf,
  card,
  entry,
  grab,
  grip,
  hoverOver,
  openGroups,
  otherGrid,
  picked,
  reopenGrid,
  said,
  savedGroups,
  selectedNumbers,
  shownGroups,
  viewport,
  zoomTo,
} from "./grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const space = shortcutCopy.keyNames.Space

const bar = (page: Page) => page.locator("[data-drop-bar]")
const ghost = (page: Page) => page.locator("[data-drag-ghost]")

async function shiftOf(page: Page, number: number): Promise<number> {
  return card(page, number).evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41)
}

test("a slide dropped at another slide group's start joins it there, saves, survives a reload and undoes in one step", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openGroups(page, context, stack, [4, 4])
  const saved = () => savedGroups(stack, opened)
  const start = [picked(opened.ids, [1, 2, 3, 4]), picked(opened.ids, [5, 6, 7, 8])]

  await grab(page, 1)
  await hoverOver(page, 5, 0.2)
  await expect(bar(page)).toHaveAttribute("data-drop-place", "5")
  await expect(ghost(page)).toBeVisible()
  const mark = await boxOf(bar(page))
  const target = await boxOf(entry(page, 5))
  expect(mark.y).toBeCloseTo(target.y, 0)
  expect(mark.x + mark.width).toBeLessThan(target.x)
  await page.mouse.up()
  await expect(ghost(page)).toHaveCount(0)
  await expect.poll(saved).toEqual([picked(opened.ids, [2, 3, 4]), picked(opened.ids, [1, 5, 6, 7, 8])])
  await expect(said(page)).toHaveText(slideListCopy.moved(1, 4))
  await expect(entry(page, 4)).toHaveAttribute("aria-current", "true")
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved).toEqual(start)
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(saved).toEqual([picked(opened.ids, [2, 3, 4]), picked(opened.ids, [1, 5, 6, 7, 8])])
  await reopenGrid(page)
  await expect
    .poll(() => shownGroups(page))
    .toEqual([
      [1, 2, 3],
      [4, 5, 6, 7, 8],
    ])
  await grab(page, 4)
  await hoverOver(page, 1, 0.2)
  await page.mouse.up()
  await expect.poll(saved).toEqual(start)

  await grab(page, 4)
  await hoverOver(page, 5, 0.2)
  await expect(bar(page)).toBeVisible()
  await page.mouse.up()
  await expect.poll(saved).toEqual([picked(opened.ids, [1, 2, 3]), picked(opened.ids, [4, 5, 6, 7, 8])])
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved).toEqual(start)

  await entry(page, 5).click()
  await entry(page, 7).click({ modifiers: ["ControlOrMeta"] })
  await grab(page, 5)
  await hoverOver(page, 1, 0.2)
  await expect(page.locator("[data-drag-count]")).toHaveText("2")
  await expect(bar(page)).toHaveAttribute("data-drop-place", "1")
  await page.mouse.up()
  await expect.poll(saved).toEqual([picked(opened.ids, [5, 7, 1, 2, 3, 4]), picked(opened.ids, [6, 8])])
  await expect(said(page)).toHaveText(slideListCopy.movedSeveral(2, 1))
  expect(await selectedNumbers(page)).toEqual([1, 2])
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved).toEqual(start)

  await zoomTo(page, 10)
  await grab(page, 6)
  await hoverOver(page, 4, 0.8)
  const end = await boxOf(entry(page, 4))
  await page.mouse.move(end.x + end.width + 4, end.y + end.height / 2)
  await expect(bar(page)).toHaveAttribute("data-drop-place", "5")
  expect((await boxOf(bar(page))).x).toBeGreaterThan(end.x + end.width)
  await page.mouse.up()
  await expect.poll(saved).toEqual([picked(opened.ids, [1, 2, 3, 4, 6]), picked(opened.ids, [5, 7, 8])])
})

test("slides in the dragged slide's own group move aside, go back, and stay put on the drop", async ({
  page,
  context,
  stack,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  const opened = await openGroups(page, context, stack, [4, 4])
  const first = await boxOf(entry(page, 1))
  const third = await boxOf(entry(page, 3))
  const step = third.x - (await boxOf(entry(page, 2))).x
  await grab(page, 1)
  await hoverOver(page, 3, 0.8)
  await expect.poll(() => shiftOf(page, 2)).toBeCloseTo(-step, 0)
  await expect.poll(() => shiftOf(page, 3)).toBeCloseTo(-step, 0)
  await expect.poll(() => shiftOf(page, 1)).toBeCloseTo(2 * step, 0)
  expect(await shiftOf(page, 4)).toBe(0)
  expect(await shiftOf(page, 5)).toBe(0)
  await expect(bar(page)).toHaveCount(0)
  await expect(card(page, 2)).toHaveCSS("transition-duration", "0.28s")
  await page.mouse.move(first.x + first.width * 0.2, first.y + first.height / 2, { steps: 8 })
  await expect.poll(() => shiftOf(page, 2)).toBe(0)
  await hoverOver(page, 3, 0.8)
  await expect.poll(() => shiftOf(page, 2)).toBeCloseTo(-step, 0)
  await page.mouse.up()
  await expect(said(page)).toHaveText(slideListCopy.moved(1, 3))
  for (const number of [1, 2, 3, 4]) {
    await expect(card(page, number)).toHaveCSS("transform", "none")
    await expect(card(page, number)).toHaveCSS("transition-duration", "0s")
  }
  await expect
    .poll(() => savedGroups(stack, opened))
    .toEqual([picked(opened.ids, [2, 3, 1, 4]), picked(opened.ids, [5, 6, 7, 8])])
  expect(await shiftOf(page, 3)).toBe(0)
  expect(third.x).toBeCloseTo((await boxOf(entry(page, 3))).x, 0)
})

test("a whole slide group drags by its grip: Escape, leaving the canvas and empty canvas cancel, a drop moves it, one undo puts it back", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openGroups(page, context, stack, [4, 4, 2])
  const saved = () => savedGroups(stack, opened)
  const start = [picked(opened.ids, [1, 2, 3, 4]), picked(opened.ids, [5, 6, 7, 8]), picked(opened.ids, [9, 10])]
  const between = async () => {
    const top = await boxOf(entry(page, 1))
    const next = await boxOf(entry(page, 5))
    return { x: top.x + top.width / 2, y: (top.y + top.height + next.y) / 2 }
  }
  for (const cancel of ["Escape", "outside", "empty", "drop"] as const) {
    await grip(page, 3).hover()
    const handle = await boxOf(grip(page, 3))
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.mouse.down()
    const point = await between()
    await page.mouse.move(point.x, point.y, { steps: 6 })
    await expect(page.locator("[data-drag-ghost][data-group-drag]")).toBeVisible()
    await expect(page.locator("[data-drop-bar][data-group-drop]")).toHaveAttribute("data-drop-place", "5")
    const line = await boxOf(page.locator("[data-drop-bar]"))
    expect(line.y).toBeGreaterThan((await boxOf(entry(page, 1))).y + (await boxOf(entry(page, 1))).height)
    expect(line.y + line.height).toBeLessThan((await boxOf(entry(page, 5))).y)
    if (cancel === "Escape") await page.keyboard.press("Escape")
    if (cancel === "outside") await page.mouse.move(700, 10)
    if (cancel === "empty") {
      const one = await boxOf(entry(page, 1))
      await page.mouse.move(one.x + one.width * 0.5, one.y + one.height * 0.5)
      await expect(bar(page)).toHaveCount(0)
    }
    await page.mouse.up()
    await expect(ghost(page)).toHaveCount(0)
    if (cancel !== "drop") expect(await saved()).toEqual(start)
  }
  const moved = [start[0], start[2], start[1]]
  await expect.poll(saved).toEqual(moved)
  await expect(said(page)).toHaveText(slideListCopy.groupMoved(3, 2))
  await expect(grip(page, 2)).toBeFocused()
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved).toEqual(start)
  await expect
    .poll(() => shownGroups(page))
    .toEqual([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10],
    ])
})

test("Alt+Up and Alt+Down move the slide group whose grip has focus, the grip keeps it, and the move is said", async ({
  page,
  context,
  stack,
}) => {
  covers("slide-group-up", "slide-group-down")
  const opened = await openGroups(page, context, stack, [4, 4, 2])
  const saved = () => savedGroups(stack, opened)
  const [one, two, three] = [
    picked(opened.ids, [1, 2, 3, 4]),
    picked(opened.ids, [5, 6, 7, 8]),
    picked(opened.ids, [9, 10]),
  ]
  await grip(page, 3).focus()
  await page.keyboard.press("Alt+ArrowUp")
  await expect.poll(saved).toEqual([one, three, two])
  await expect(said(page)).toHaveText(slideListCopy.groupMoved(3, 2))
  await expect(grip(page, 2)).toBeFocused()
  await page.keyboard.press("Alt+ArrowDown")
  await expect.poll(saved).toEqual([one, two, three])
  await expect(grip(page, 3)).toBeFocused()
  await grip(page, 1).focus()
  await page.keyboard.press("Alt+ArrowDown")
  await expect.poll(saved).toEqual([two, one, three])
  await expect(grip(page, 2)).toBeFocused()
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved).toEqual([one, two, three])
})

test("a slide group's grip shows beside it on hover, tints the group, and hides for Space, the hand and a small zoom", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [4, 4])
  const one = await boxOf(entry(page, 1))
  await expect(grip(page, 1)).toHaveCSS("opacity", "0")
  await page.mouse.move(one.x - 12, one.y + one.height / 2)
  await expect(page.locator('[data-grid-group-frame][data-group-hover="band"]')).toHaveCount(1)
  await expect(grip(page, 1)).toHaveCSS("opacity", "1")
  await grip(page, 1).hover()
  await expect(page.locator("[data-grid-card][data-group-tint]")).toHaveCount(4)
  await entry(page, 2).hover()
  await expect(page.locator('[data-group-hover="band"]')).toHaveCount(0)
  await expect(page.locator("[data-grid-card][data-group-tint]")).toHaveCount(0)
  await entry(page, 2).focus()
  await page.keyboard.down(space)
  await expect(grip(page, 1)).toBeHidden()
  await page.keyboard.up(space)
  await page.keyboard.press("h")
  await expect(grip(page, 1)).toBeHidden()
  await page.keyboard.press("v")
  await expect(grip(page, 1)).toBeAttached()
  await zoomTo(page, 5)
  await expect(grip(page, 1)).toHaveCount(0)
})

test("dragging a slide near an edge pans the canvas, and Escape saves nothing", async ({ page, context, stack }) => {
  const opened = await openGroups(page, context, stack, [10, 10, 10])
  const start = await savedGroups(stack, opened)
  await zoomTo(page, 50)
  await entry(page, 1).focus()
  const list = page.locator("[data-editor-grid] [data-slide-list]")
  const before = await list.getAttribute("style")
  await grab(page, 1)
  const room = await boxOf(viewport(page))
  await page.mouse.move(room.x + room.width / 2, room.y + room.height - 12, { steps: 5 })
  await expect.poll(() => list.getAttribute("style")).not.toBe(before)
  await expect(ghost(page)).toBeVisible()
  await page.keyboard.press("Escape")
  await page.mouse.up()
  await expect(ghost(page)).toHaveCount(0)
  expect(await savedGroups(stack, opened)).toEqual(start)
})

test("a slide group moved and a slide added in a new group offline land once the tab is back online", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openGroups(page, context, stack, [4, 4, 2])
  const saved = () => savedGroups(stack, opened)
  const start = await saved()
  let offline = true
  await page.route(
    (url) => url.pathname.startsWith("/doom/"),
    (route) => (offline ? route.abort("internetdisconnected") : route.fallback()),
  )
  await grip(page, 3).focus()
  await page.keyboard.press("Alt+ArrowUp")
  await expect
    .poll(() => shownGroups(page))
    .toEqual([
      [1, 2, 3, 4],
      [5, 6],
      [7, 8, 9, 10],
    ])
  await entry(page, 5).click({ button: "right" })
  await page.getByRole("menuitem", { name: slideListCopy.addBelowMenu }).click()
  await expect.poll(() => shownGroups(page)).toEqual([[1, 2, 3, 4], [5, 6], [7], [8, 9, 10, 11]])
  expect(await saved()).toEqual(start)
  offline = false
  await expect.poll(async () => (await saved()).map((group) => group.length), { timeout: 15_000 }).toEqual([4, 2, 1, 4])
  expect((await saved())[1]).toEqual(start[2])
  await reopenGrid(page)
  await expect.poll(() => shownGroups(page)).toEqual([[1, 2, 3, 4], [5, 6], [7], [8, 9, 10, 11]])
})

test("a slide drag cancels when another tab changes the slide groups but not the slide order", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openGroups(page, context, stack, [4, 1, 4])
  const other = await otherGrid(context, stack, opened)
  await grab(page, 6)
  await hoverOver(page, 4, 0.8)
  await expect(ghost(page)).toBeVisible()
  await grab(other, 5)
  await hoverOver(other, 6, 0.2)
  await expect(bar(other)).toBeVisible()
  await other.mouse.up()
  await expect
    .poll(() => shownGroups(page))
    .toEqual([
      [1, 2, 3, 4],
      [5, 6, 7, 8, 9],
    ])
  const moved = await savedGroups(stack, opened)
  await expect(ghost(page)).toHaveCount(0)
  await page.mouse.up()
  expect(await savedGroups(stack, opened)).toEqual(moved)
})

test("Space or the hand tool during a slide drag cancels it, and the release saves nothing", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openGroups(page, context, stack, [4, 4])
  const before = await savedGroups(stack, opened)
  for (const key of [space, "h"]) {
    await grab(page, 1)
    await hoverOver(page, 5, 0.2)
    await expect(ghost(page)).toBeVisible()
    await page.keyboard.down(key)
    await expect(ghost(page)).toHaveCount(0)
    await page.mouse.up()
    await page.keyboard.up(key)
    await page.keyboard.press("v")
    expect(await savedGroups(stack, opened)).toEqual(before)
  }
})
