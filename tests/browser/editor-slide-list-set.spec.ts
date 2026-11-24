import { expect, type Page } from "@playwright/test"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { openEditor, savedSlides } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const shift = shortcutCopy.chord.other.shift
const entries = (page: Page) => page.locator("[data-slide-entry]")
const entry = (page: Page, number: number) => page.locator(`[data-slide-entry="${String(number)}"]`)
const picked = (page: Page) =>
  page.locator("[data-slide-entry][data-selected]").evaluateAll((all) => all.map((each) => each.dataset.slideEntry))

test("several slides picked in the list move, duplicate and delete together, each as one undoable edit", async ({
  page,
  context,
  stack,
}) => {
  covers("slide-duplicate", "slide-delete", "slide-up", "slide-down", "undo")
  const faults: string[] = []
  page.on("pageerror", (error) => faults.push(error.message))
  const opened = await openEditor(page, context, stack)
  const saved = () => savedSlides(stack, opened)
  for (const count of [2, 3, 4]) {
    await page.getByRole("button", { name: slideListCopy.addSlide }).click()
    await expect(entries(page)).toHaveCount(count)
  }
  await expect.poll(async () => (await saved()).length).toBe(4)
  const [one, two, three, four] = await saved()

  await entry(page, 1).click()
  await entry(page, 2).click({ modifiers: [shift] })
  expect(await picked(page)).toEqual(["1", "2"])

  await entry(page, 1).dragTo(entry(page, 4))
  await expect.poll(saved).toEqual([three, four, one, two])
  expect(await picked(page)).toEqual(["3", "4"])

  await entry(page, 3).focus()
  await page.keyboard.press("Alt+ArrowUp")
  await expect.poll(saved).toEqual([three, one, two, four])
  expect(await picked(page)).toEqual(["2", "3"])

  await entry(page, 2).click({ button: "right" })
  const gaps = await page.getByRole("menuitem").evaluateAll((rows) =>
    rows.flatMap((row) => {
      const [label, shortcut] = Array.from(row.querySelectorAll("span"))
      if (label === undefined || shortcut === undefined) return []
      const text = document.createRange()
      text.selectNodeContents(label)
      return [shortcut.getBoundingClientRect().left - text.getBoundingClientRect().right]
    }),
  )
  expect(gaps.length).toBeGreaterThan(0)
  for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(20)
  await page.getByRole("menuitem", { name: slideListCopy.setActions(2).down }).click()
  await expect.poll(saved).toEqual([three, four, one, two])
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved).toEqual([three, one, two, four])

  await entry(page, 2).focus()
  await page.keyboard.press("ControlOrMeta+d")
  await expect(entries(page)).toHaveCount(6)
  await expect.poll(async () => (await saved()).length).toBe(6)
  expect(await picked(page)).toHaveLength(2)
  await page.keyboard.press("ControlOrMeta+z")
  await expect(entries(page)).toHaveCount(4)
  await expect.poll(saved).toEqual([three, one, two, four])
  expect(await picked(page)).toEqual(["2", "3"])

  await entry(page, 2).click()
  await entry(page, 3).click({ modifiers: [shift] })
  await page.keyboard.press("Delete")
  await expect(entries(page)).toHaveCount(2)
  await expect.poll(saved).toEqual([three, four])
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, 2)).toBeFocused()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(entries(page)).toHaveCount(4)
  await expect.poll(saved).toEqual([three, one, two, four])
  expect(await picked(page)).toEqual(["2", "3"])

  await page.keyboard.press("Alt+ArrowDown")
  await expect.poll(saved).toEqual([three, four, one, two])
  await expect(entry(page, 4)).toBeFocused()
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved).toEqual([three, one, two, four])
  await expect(page.locator("[data-slide-entry][aria-current]")).toBeFocused()
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(saved).toEqual([three, four, one, two])
  await expect(page.locator("[data-slide-entry][aria-current]")).toBeFocused()
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved).toEqual([three, one, two, four])

  await entry(page, 1).click()
  await entry(page, 4).click({ modifiers: [shift] })
  await page.keyboard.press("Delete")
  await expect(page.getByText(slideListCopy.lastSlide)).toBeVisible()
  await expect(entries(page)).toHaveCount(4)
  expect(await saved()).toEqual([three, one, two, four])
  expect(faults).toEqual([])
})

test("an undo or another tab's edit later on never puts an old pick back", async ({ page, context, stack }) => {
  covers("slide-duplicate", "slide-down", "undo")
  const opened = await openEditor(page, context, stack)
  const saved = () => savedSlides(stack, opened)
  for (const count of [2, 3, 4, 5, 6, 7, 8]) {
    await page.getByRole("button", { name: slideListCopy.addSlide }).click()
    await expect(entries(page)).toHaveCount(count)
  }
  await expect.poll(async () => (await saved()).length).toBe(8)
  const before = await saved()

  await entry(page, 2).click()
  await entry(page, 3).click({ modifiers: [shift] })
  await page.keyboard.press("ControlOrMeta+d")
  await expect(entries(page)).toHaveCount(10)
  await expect.poll(async () => (await saved()).length).toBe(10)
  expect(await picked(page)).toHaveLength(2)

  await entry(page, 1).click()
  await entry(page, 1).focus()
  await page.keyboard.press("Alt+ArrowDown")
  await expect.poll(async () => (await saved())[0]).toBe(before[1])
  await entry(page, 8).click()
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await saved())[0]).toBe(before[0])
  expect(await picked(page)).toEqual([])
  await expect(entry(page, 8)).toHaveAttribute("aria-current", "true")

  const base = await saved()
  await entry(page, 2).click()
  await entry(page, 3).click({ modifiers: [shift] })
  await page.keyboard.press("ControlOrMeta+d")
  await expect(entries(page)).toHaveCount(12)
  await expect.poll(async () => (await saved()).length).toBe(12)
  const copies = (await saved()).filter((id) => !base.includes(id))
  expect(copies).toHaveLength(2)
  expect(await picked(page)).toHaveLength(2)

  const removeFromOtherTab = async (slide: string) => {
    const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
    const edit = {
      once: `gone-${slide}`,
      author: { kind: "person", id: "other-tab" },
      writes: [{ node: slide, prop: "parent", value: null }],
    }
    const landed = await stack.post(doomRoutes.edit.path, { deck: opened.deck, edit }, opened.cookie)
    if (landed.json.ok !== true) throw new Error(JSON.stringify(landed.json))
  }
  await removeFromOtherTab(copies[0] ?? "")
  await expect(entries(page)).toHaveCount(11)
  await removeFromOtherTab(copies[1] ?? "")
  await expect(entries(page)).toHaveCount(10)
  expect(await picked(page)).toEqual([])
})
