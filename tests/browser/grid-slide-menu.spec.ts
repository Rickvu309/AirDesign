import { expect, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy.ts"
import { test } from "./api-stack"
import { covers } from "./gesture"
import {
  entries,
  entry,
  openGroups,
  otherGrid,
  picked,
  said,
  savedGroups,
  selectedNumbers,
  shownGroups,
} from "./grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const menu = (page: Page) => page.getByRole("menu")
const item = (page: Page, name: string) => page.getByRole("menuitem", { name })

async function ready(page: Page): Promise<void> {
  await expect(menu(page)).toBeVisible()
  await expect.poll(() => menu(page).evaluate((open) => open.contains(document.activeElement))).toBe(true)
}

test("the slide menu opens on a right click, the menu key or Shift+F10, and Escape puts focus back on the slide", async ({
  page,
  context,
  stack,
}) => {
  covers("slide-menu")
  await openGroups(page, context, stack, [4, 4])
  const held = () =>
    page.evaluate(() => ({
      slide: document.activeElement?.getAttribute("data-slide-entry") ?? null,
      ring: document.activeElement?.matches(":focus-visible") ?? false,
    }))
  await entry(page, 3).click({ button: "right" })
  await ready(page)
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  expect(await menu(page).getByRole("menuitem").allTextContents()).toEqual([
    `${slideListCopy.open}${slideListCopy.openKey}`,
    `${slideListCopy.duplicate}${slideListCopy.duplicateKey}`,
    `${slideListCopy.delete}${slideListCopy.deleteKey}`,
    `${slideListCopy.moveUp}${slideListCopy.moveUpKey}`,
    `${slideListCopy.moveDown}${slideListCopy.moveDownKey}`,
    slideListCopy.skip,
    slideListCopy.addAfterMenu,
    slideListCopy.addBelowMenu,
    slideListCopy.moveBelowMenu,
  ])
  await page.keyboard.press("Escape")
  await expect(menu(page)).toBeHidden()
  expect(await held()).toEqual({ slide: "3", ring: true })
  await page.keyboard.press("ContextMenu")
  await ready(page)
  await page.keyboard.press("Escape")
  await expect(menu(page)).toBeHidden()
  await page.keyboard.press("Shift+F10")
  await ready(page)
  await page.keyboard.press("Escape")
  expect(await held()).toEqual({ slide: "3", ring: true })
  await entry(page, 2).click({ button: "right" })
  await ready(page)
  await item(page, slideListCopy.skip).click()
  await expect(menu(page)).toBeHidden()
  expect(await held()).toEqual({ slide: "2", ring: false })
})

test("each slide menu row acts on its slide, saves, and one undo takes it back", async ({ page, context, stack }) => {
  const opened = await openGroups(page, context, stack, [4, 4])
  const saved = () => savedGroups(stack, opened)
  const start = await saved()
  const sizes = async () => (await saved()).map((group) => group.length)
  const choose = async (number: number, name: string) => {
    await entry(page, number).click({ button: "right" })
    await ready(page)
    await item(page, name).click()
    await expect(menu(page)).toBeHidden()
  }
  const undo = async () => {
    await page.keyboard.press("ControlOrMeta+z")
    await expect.poll(saved).toEqual(start)
  }

  await choose(2, slideListCopy.duplicate)
  await expect(entries(page)).toHaveCount(9)
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, 3)).toBeFocused()
  await expect(said(page)).toHaveText(slideListCopy.duplicated(2))
  await expect.poll(sizes).toEqual([5, 4])
  await undo()

  await choose(2, slideListCopy.delete)
  await expect(entries(page)).toHaveCount(7)
  await expect(said(page)).toHaveText(slideListCopy.deleted(2))
  await expect(entry(page, 2)).toBeFocused()
  await expect.poll(saved).toEqual([picked(opened.ids, [1, 3, 4]), picked(opened.ids, [5, 6, 7, 8])])
  await undo()

  await choose(5, slideListCopy.moveUp)
  await expect.poll(saved).toEqual([picked(opened.ids, [1, 2, 3, 5, 4]), picked(opened.ids, [6, 7, 8])])
  await expect(entry(page, 4)).toHaveAttribute("aria-current", "true")
  await expect(said(page)).toHaveText(slideListCopy.moved(5, 4))
  await undo()

  await choose(4, slideListCopy.moveDown)
  await expect.poll(saved).toEqual([picked(opened.ids, [1, 2, 3]), picked(opened.ids, [5, 4, 6, 7, 8])])
  await undo()

  await choose(3, slideListCopy.skip)
  await expect(entry(page, 3)).toHaveAttribute("data-slide-skipped", "true")
  await expect(said(page)).toHaveText(slideListCopy.skippedInPresent(1, 3))
  await page.keyboard.press("ControlOrMeta+z")
  await expect(entry(page, 3)).not.toHaveAttribute("data-slide-skipped", "true")

  await choose(1, slideListCopy.addAfterMenu)
  await expect(entries(page)).toHaveCount(9)
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect.poll(sizes).toEqual([5, 4])
  await undo()

  await choose(2, slideListCopy.addBelowMenu)
  await expect(entries(page)).toHaveCount(9)
  await expect(entry(page, 5)).toHaveAttribute("aria-current", "true")
  await expect.poll(sizes).toEqual([4, 1, 4])
  await undo()

  await choose(2, slideListCopy.moveBelowMenu)
  await expect
    .poll(saved)
    .toEqual([picked(opened.ids, [1, 3, 4]), picked(opened.ids, [2]), picked(opened.ids, [5, 6, 7, 8])])
  await expect(entry(page, 4)).toHaveAttribute("aria-current", "true")
  expect(await shownGroups(page)).toEqual([[1, 2, 3], [4], [5, 6, 7, 8]])
  await undo()

  await choose(6, slideListCopy.open)
  await expect(page.locator("[data-editor-grid]")).toHaveCount(0)
  await expect(page.locator(`[data-slide-entry="6"]`)).toHaveAttribute("aria-current", "true")
})

test("with several slides picked the menu acts on all of them, and a slide alone in its group cannot move to a new one", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openGroups(page, context, stack, [4, 1, 3])
  const saved = () => savedGroups(stack, opened)
  await entry(page, 5).click({ button: "right" })
  await ready(page)
  await expect(item(page, slideListCopy.moveBelowMenu)).toBeDisabled()
  await page.keyboard.press("Escape")
  await entry(page, 2).click()
  await entry(page, 3).click({ modifiers: ["ControlOrMeta"] })
  await entry(page, 3).click({ button: "right" })
  await ready(page)
  await expect(item(page, slideListCopy.open)).toBeDisabled()
  await item(page, slideListCopy.setActions(2).clone).click()
  await expect(entries(page)).toHaveCount(10)
  expect(await selectedNumbers(page)).toHaveLength(2)
  await expect(said(page)).toHaveText(slideListCopy.duplicatedSet(2))
  await page.keyboard.press("ControlOrMeta+z")
  await expect(entries(page)).toHaveCount(8)
  await entry(page, 2).click()
  await entry(page, 3).click({ modifiers: ["ControlOrMeta"] })
  await entry(page, 2).click({ button: "right" })
  await ready(page)
  await item(page, slideListCopy.moveBelowMenu).click()
  await expect
    .poll(saved)
    .toEqual([
      picked(opened.ids, [1, 4]),
      picked(opened.ids, [2, 3]),
      picked(opened.ids, [5]),
      picked(opened.ids, [6, 7, 8]),
    ])
  expect(await selectedNumbers(page)).toEqual([3, 4])
  await entry(page, 3).click({ button: "right" })
  await ready(page)
  await item(page, slideListCopy.skipSet(2)).click()
  await expect(entry(page, 3)).toHaveAttribute("data-slide-skipped", "true")
  await expect(entry(page, 4)).toHaveAttribute("data-slide-skipped", "true")
})

test("an open slide menu acts on its own slide after another tab adds one above it, and closes when its slide goes", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openGroups(page, context, stack, [4, 4])
  const other = await otherGrid(context, stack, opened)
  await entry(page, 5).click({ button: "right" })
  await ready(page)
  await entry(other, 2).click({ button: "right" })
  await item(other, slideListCopy.addAfterMenu).click()
  await expect(entries(page)).toHaveCount(9)
  await expect(menu(page)).toBeVisible()
  await item(page, slideListCopy.delete).click()
  await expect.poll(async () => (await savedGroups(stack, opened)).flat()).not.toContain(opened.ids[4])
  expect((await savedGroups(stack, opened)).flat()).toEqual(expect.arrayContaining(picked(opened.ids, [1, 2, 3, 4])))

  await expect(entries(other)).toHaveCount(8)
  await entry(page, 5).click({ button: "right" })
  await ready(page)
  await entry(other, 5).click()
  await other.keyboard.press("Delete")
  await expect(entries(page)).toHaveCount(7)
  await expect(menu(page)).toBeHidden()
})
