import { expect, type Page } from "@playwright/test"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy.ts"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy.ts"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { boxOf, chip, entries, entry, openGroups, said, selectedNumbers, viewport, wheelAt, zoomTo } from "./grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const shift = shortcutCopy.chord.other.shift

async function current(page: Page, number: number): Promise<void> {
  await expect(entry(page, number)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, number)).toBeFocused()
}

test("a click picks one slide, Shift-click a range and Ctrl or Cmd-click toggles, and the chip and labels say so", async ({
  page,
  context,
  stack,
}) => {
  covers("select-all", "deselect")
  await openGroups(page, context, stack, [3, 3])
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
  await entry(page, 2).click()
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect(chip(page)).toHaveCount(0)
  expect(await selectedNumbers(page)).toEqual([2])
  await entry(page, 4).click({ modifiers: ["ControlOrMeta"] })
  await expect(chip(page)).toHaveText(slideListCopy.selected(2))
  await expect(entry(page, 2)).toHaveAccessibleName(slideListCopy.selectedName(2, 6))
  await expect(entry(page, 4)).toHaveAccessibleName(slideListCopy.selectedName(4, 6))
  await expect(entry(page, 3)).toHaveAccessibleName(slideListCopy.slideName(3, 6))
  await entry(page, 4).click({ modifiers: ["ControlOrMeta"] })
  await expect(chip(page)).toHaveText(slideListCopy.selected(1))
  await expect(entry(page, 4)).toHaveAccessibleName(slideListCopy.slideName(4, 6))
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await entry(page, 4).click({ modifiers: ["ControlOrMeta"] })
  await entry(page, 6).click({ modifiers: [shift] })
  await expect(chip(page)).toHaveText(slideListCopy.selected(3))
  await expect(said(page)).toHaveText(slideListCopy.selected(3))
  expect(await selectedNumbers(page)).toEqual([4, 5, 6])
  await expect(entry(page, 5)).toHaveAccessibleName(slideListCopy.selectedName(5, 6))
  await expect(entry(page, 2)).toHaveAccessibleName(slideListCopy.slideName(2, 6))
  await page.keyboard.press("Escape")
  await expect(chip(page)).toHaveCount(0)
  await expect(said(page)).toHaveText(slideListCopy.nothingSelected)
  expect(await selectedNumbers(page)).toEqual([])
  await page.keyboard.press("ControlOrMeta+a")
  await expect(chip(page)).toHaveText(slideListCopy.selected(6))
  await expect(said(page)).toHaveText(slideListCopy.selected(6))
  await viewport(page).click({ position: { x: 10, y: 10 } })
  await expect(chip(page)).toHaveCount(0)
  await expect(said(page)).toHaveText(slideListCopy.nothingSelected)
  expect(await selectedNumbers(page)).toEqual([])
})

test("arrow keys move focus and the current slide, Up and Down by where slides sit, Shift extends, Home and End", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [4, 3])
  await entry(page, 3).focus()
  await page.keyboard.press("ArrowDown")
  await current(page, 7)
  await page.keyboard.press("ArrowUp")
  await current(page, 3)
  await page.keyboard.press("Home")
  await current(page, 1)
  await page.keyboard.press("End")
  await current(page, 7)
  await page.keyboard.press("ArrowLeft")
  await current(page, 6)
  await page.keyboard.press("ArrowUp")
  await current(page, 2)
  for (const number of [3, 4, 5]) {
    await page.keyboard.press("ArrowRight")
    await current(page, number)
  }
  await expect(chip(page)).toHaveCount(0)
  await page.keyboard.press("Shift+ArrowLeft")
  await page.keyboard.press("Shift+ArrowLeft")
  await current(page, 3)
  await expect(chip(page)).toHaveText(slideListCopy.selected(3))
  expect(await selectedNumbers(page)).toEqual([3, 4, 5])
  await expect(entries(page).and(page.locator('[tabindex="0"]'))).toHaveCount(1)
  await expect(entry(page, 3)).toHaveAttribute("tabindex", "0")
})

test("a pick stays on the same slides when another tab deletes an earlier slide", async ({ page, context, stack }) => {
  const opened = await openGroups(page, context, stack, [4, 3])
  await entry(page, 3).click()
  await entry(page, 5).click({ modifiers: ["ControlOrMeta"] })
  expect(await selectedNumbers(page)).toEqual([3, 5])
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const landed = await stack.post(
    doomRoutes.edit.path,
    {
      deck: opened.deck,
      edit: {
        once: "grid-delete-earlier",
        author: { kind: "person", id: "other-tab" },
        writes: [{ node: opened.ids[1], prop: "parent", value: null }],
      },
    },
    opened.cookie,
  )
  expect(landed.json.ok).toBe(true)
  await expect(entry(page, 7)).toHaveCount(0)
  await expect(entry(page, 4)).toHaveAttribute("aria-current", "true")
  expect(await selectedNumbers(page)).toEqual([2, 4])
  await entry(page, 1).click({ modifiers: [shift] })
  expect(await selectedNumbers(page)).toEqual([1, 2, 3, 4])
})

test("a click on the visible edge of a slide panned almost out of view picks it", async ({ page, context, stack }) => {
  await openGroups(page, context, stack, [4, 3])
  await entry(page, 1).click()
  await zoomTo(page, 50)
  const room = await boxOf(viewport(page))
  const two = await boxOf(entry(page, 2))
  await wheelAt(page, { x: room.x + 250, y: room.y + 200 }, { x: two.x + two.width - room.x - 20, y: 0 })
  const edge = await boxOf(entry(page, 2))
  expect(edge.x + edge.width - room.x).toBeCloseTo(20, 0)
  await page.mouse.click(room.x + 10, edge.y + edge.height / 2)
  await current(page, 2)
})

for (const mode of ["Grid", "Slides"]) {
  test(`${mode} keeps a toggled-off slide as the anchor of the next Shift-click`, async ({ page, context, stack }) => {
    await openGroups(page, context, stack, [4, 3])
    if (mode === "Slides") await page.getByRole("button", { name: slideListCopy.slidesView }).click()
    const slide = (number: number) => page.locator(`[data-slide-entry="${String(number)}"]`)
    const picked = () =>
      page
        .locator("[data-slide-entry][data-selected]")
        .evaluateAll((all) => all.map((each) => Number(each.getAttribute("data-slide-entry"))))
    await slide(1).click()
    await slide(3).click({ modifiers: ["ControlOrMeta"] })
    await slide(5).click({ modifiers: ["ControlOrMeta"] })
    await slide(3).click({ modifiers: ["ControlOrMeta"] })
    expect(await picked()).toEqual([1, 5])
    await slide(6).click({ modifiers: [shift] })
    expect(await picked()).toEqual([3, 4, 5, 6])
  })
}
