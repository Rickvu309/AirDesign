import { expect } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy.ts"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { entries, entry, openGroups, picked, said, savedGroups, selectedNumbers } from "./grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("Delete, Ctrl+D, Ctrl+[ and ] and Alt with Left or Right act on the focused slide, one undo each", async ({
  page,
  context,
  stack,
}) => {
  covers("slide-delete", "slide-duplicate", "slide-up", "slide-down", "slide-earlier", "slide-later")
  const opened = await openGroups(page, context, stack, [3, 3])
  const saved = () => savedGroups(stack, opened)
  const start = await saved()
  const undo = async () => {
    await page.keyboard.press("ControlOrMeta+z")
    await expect.poll(saved).toEqual(start)
  }
  await entry(page, 2).click()

  await page.keyboard.press("ControlOrMeta+d")
  await expect(entries(page)).toHaveCount(7)
  await expect(entry(page, 3)).toBeFocused()
  await expect(said(page)).toHaveText(slideListCopy.duplicated(2))
  await expect.poll(async () => (await saved()).map((group) => group.length)).toEqual([4, 3])
  await undo()

  await entry(page, 2).focus()
  await page.keyboard.press("Delete")
  await expect(entries(page)).toHaveCount(5)
  await expect(said(page)).toHaveText(slideListCopy.deleted(2))
  await expect(entry(page, 2)).toBeFocused()
  await undo()

  await entry(page, 3).click()
  await page.keyboard.press("ControlOrMeta+BracketRight")
  await expect.poll(saved).toEqual([picked(opened.ids, [1, 2]), picked(opened.ids, [4, 3, 5, 6])])
  await expect(entry(page, 4)).toBeFocused()
  await page.keyboard.press("Alt+ArrowRight")
  await expect.poll(saved).toEqual([picked(opened.ids, [1, 2]), picked(opened.ids, [4, 5, 3, 6])])
  await expect(entry(page, 5)).toBeFocused()
  await page.keyboard.press("Alt+ArrowLeft")
  await page.keyboard.press("ControlOrMeta+BracketLeft")
  await expect.poll(saved).toEqual([picked(opened.ids, [1, 2, 3]), picked(opened.ids, [4, 5, 6])])
  await expect(entry(page, 3)).toBeFocused()
  await expect(said(page)).toHaveText(slideListCopy.moved(4, 3))
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved).toEqual([picked(opened.ids, [1, 2]), picked(opened.ids, [4, 3, 5, 6])])
})

test("on several picked slides the keys act on all of them, copies end up picked, and Delete keeps a slide", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openGroups(page, context, stack, [3, 3])
  const saved = () => savedGroups(stack, opened)
  const start = await saved()
  await entry(page, 2).click()
  await entry(page, 3).click({ modifiers: ["Shift"] })
  await page.keyboard.press("ControlOrMeta+d")
  await expect(entries(page)).toHaveCount(8)
  await expect(said(page)).toHaveText(slideListCopy.duplicatedSet(2))
  expect(await selectedNumbers(page)).toEqual([3, 5])
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved).toEqual(start)

  await entry(page, 2).click()
  await entry(page, 3).click({ modifiers: ["Shift"] })
  await page.keyboard.press("Alt+ArrowRight")
  await expect.poll(saved).toEqual([picked(opened.ids, [1]), picked(opened.ids, [4, 2, 3, 5, 6])])
  expect(await selectedNumbers(page)).toEqual([3, 4])
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved).toEqual(start)

  await entry(page, 2).click()
  await entry(page, 3).click({ modifiers: ["Shift"] })
  await page.keyboard.press("Delete")
  await expect(entries(page)).toHaveCount(4)
  await expect(said(page)).toHaveText(slideListCopy.deletedSet(2))
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved).toEqual(start)

  await entry(page, 1).focus()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Delete")
  await expect(page.getByText(slideListCopy.lastSlide)).toBeVisible()
  await expect(entries(page)).toHaveCount(6)
  expect(await saved()).toEqual(start)
})
