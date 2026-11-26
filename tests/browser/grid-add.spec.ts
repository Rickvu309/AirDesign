import { expect, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy.ts"
import { test } from "./api-stack"
import {
  boxOf,
  entries,
  entry,
  openGroups,
  picked,
  readout,
  reopenGrid,
  said,
  savedGroups,
  shownGroups,
  wheelAt,
  zoomTo,
} from "./grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const add = (page: Page, number: number) =>
  page.getByRole("button", { name: slideListCopy.addAfter(number), exact: true })
const below = (page: Page, group: number) =>
  page.getByRole("button", { name: slideListCopy.addBelow(group), exact: true })
async function undo(page: Page, saved: () => Promise<unknown>, start: unknown): Promise<void> {
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved).toEqual(start)
}
const sizes = async (page: Page) => (await shownGroups(page)).map((group) => group.length)

test("the plus between two slides adds one there in their slide group, and it saves, reloads and undoes", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openGroups(page, context, stack, [4, 4, 2])
  const saved = () => savedGroups(stack, opened)
  const start = await saved()
  await page.locator("[data-gap-insert]").nth(1).hover()
  const left = await boxOf(entry(page, 2))
  const right = await boxOf(entry(page, 3))
  const plus = await boxOf(add(page, 2))
  expect(plus.x + plus.width / 2).toBeCloseTo((left.x + left.width + right.x) / 2, 0)
  await add(page, 2).click()
  await expect(entries(page)).toHaveCount(11)
  await expect(entry(page, 3)).toBeFocused()
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  await expect(said(page)).toHaveText(slideListCopy.added(3))
  expect(await sizes(page)).toEqual([5, 4, 2])
  await expect.poll(async () => (await saved()).map((group) => group.length)).toEqual([5, 4, 2])
  const added = (await saved())[0]![2]!
  expect((await saved())[0]).toEqual([...picked(opened.ids, [1, 2]), added, ...picked(opened.ids, [3, 4])])
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved).toEqual(start)
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(async () => (await saved()).map((group) => group.length)).toEqual([5, 4, 2])
  await reopenGrid(page)
  await expect.poll(() => sizes(page)).toEqual([5, 4, 2])
})

test("the dot at a slide group's end previews the new slide's place and adds it at that group's end", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openGroups(page, context, stack, [4, 4, 2])
  await zoomTo(page, 10)
  await add(page, 4).hover()
  const placeholder = page.locator("[data-gap-placeholder]:visible")
  await expect(placeholder).toHaveCount(1)
  const preview = await boxOf(placeholder)
  const next = await boxOf(entry(page, 5))
  await add(page, 4).click()
  await expect(entry(page, 5)).toBeFocused()
  expect(await sizes(page)).toEqual([5, 4, 2])
  const made = await boxOf(entry(page, 5))
  expect(made.x).toBeCloseTo(preview.x, 0)
  expect(made.y).toBeCloseTo(preview.y, 0)
  expect(made.width).toBeCloseTo(preview.width, 0)
  expect(await boxOf(entry(page, 6))).toEqual(next)
  await page.keyboard.press("ControlOrMeta+z")
  await expect
    .poll(() => savedGroups(stack, opened))
    .toEqual([picked(opened.ids, [1, 2, 3, 4]), picked(opened.ids, [5, 6, 7, 8]), picked(opened.ids, [9, 10])])
})

test("Tab reaches the plus after the focused slide, Escape goes back to the slide, and Enter adds", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [4, 4, 2])
  await entry(page, 4).click()
  await page.keyboard.press("Tab")
  await expect(add(page, 4)).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(entry(page, 4)).toBeFocused()
  await page.keyboard.press("Tab")
  await page.keyboard.press("Enter")
  await expect(entries(page)).toHaveCount(11)
  await expect(entry(page, 5)).toBeFocused()
  expect(await sizes(page)).toEqual([5, 4, 2])
})

test("the plus under a slide group starts a new group below it, previewed by a line between groups and a slide after the last", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openGroups(page, context, stack, [4, 4, 2])
  const saved = () => savedGroups(stack, opened)
  const start = await saved()
  const fit = await readout(page).textContent()
  const slides = () => entries(page).evaluateAll((all) => all.map((each) => each.getBoundingClientRect().toJSON()))
  const before = await slides()
  await below(page, 1).hover()
  expect(await slides()).toEqual(before)
  const line = page.locator("[data-group-insertion-line]:visible")
  await expect(line).toHaveCount(1)
  const mark = await boxOf(line)
  const first = await boxOf(entry(page, 1))
  const next = await boxOf(entry(page, 5))
  expect(mark.x).toBeCloseTo(first.x, 0)
  expect(mark.width).toBeCloseTo(first.width, 0)
  expect(mark.y).toBeGreaterThan(first.y + first.height)
  expect(mark.y).toBeLessThan(next.y)
  await below(page, 1).click()
  await expect(entries(page)).toHaveCount(11)
  expect(await shownGroups(page)).toEqual([[1, 2, 3, 4], [5], [6, 7, 8, 9], [10, 11]])
  await expect(entry(page, 5)).toHaveAttribute("aria-current", "true")
  await expect(said(page)).toHaveText(slideListCopy.added(5))
  await expect.poll(async () => (await saved()).map((group) => group.length)).toEqual([4, 1, 4, 2])
  await undo(page, saved, start)

  await below(page, 3).click()
  await expect(readout(page)).toHaveText(fit ?? "")
  await expect.poll(async () => (await saved()).map((group) => group.length)).toEqual([4, 4, 2, 1])
  await undo(page, saved, start)

  const nine = await boxOf(entry(page, 9))
  await wheelAt(page, { x: nine.x, y: nine.y }, { x: 0, y: 400 })
  await below(page, 3).hover()
  const placeholder = page.locator("[data-group-placeholder]:visible")
  await expect(placeholder).toHaveCount(1)
  const cell = await boxOf(placeholder)
  const moved = await boxOf(entry(page, 9))
  expect(cell.x).toBeCloseTo(moved.x, 0)
  expect(cell.width).toBeCloseTo(moved.width, 0)
  expect(cell.y).toBeGreaterThan(moved.y + moved.height)
  await below(page, 3).click()
  await expect.poll(async () => (await saved()).map((group) => group.length)).toEqual([4, 4, 2, 1])
  const made = await boxOf(entry(page, 11))
  expect(made.y).toBeCloseTo(cell.y, 0)
  await reopenGrid(page)
  await expect.poll(() => sizes(page)).toEqual([4, 4, 2, 1])
})

test("the inline adds hide at a small zoom, during Space, with the hand and on a full deck", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [4, 4, 2])
  await zoomTo(page, 3)
  await expect(page.locator("[data-add-gap], [data-add-group]")).toHaveCount(0)
  await zoomTo(page, 10)
  await expect(below(page, 1)).toBeAttached()
  await entry(page, 4).focus()
  await page.keyboard.down("Space")
  await expect(page.locator("[data-add-gap], [data-add-group]")).toHaveCount(0)
  await page.keyboard.up("Space")
  await page.keyboard.press("h")
  await expect(page.locator("[data-add-gap], [data-add-group]")).toHaveCount(0)
  await page.keyboard.press("v")
  await expect(below(page, 1)).toBeAttached()
})

test("a deck of fifty slides offers no inline add", async ({ page, context, stack }) => {
  await openGroups(page, context, stack, [10, 10, 10, 10, 10])
  await zoomTo(page, 10)
  await expect(page.locator("[data-add-gap], [data-add-group]")).toHaveCount(0)
  await expect(entries(page)).toHaveCount(50)
})
