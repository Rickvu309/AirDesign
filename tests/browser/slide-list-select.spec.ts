import { expect, type Page } from "@playwright/test"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { test } from "./api-stack"
import { openSaved, picked } from "./grid-reorder-deck"
import { entry } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const selected = (page: Page) => page.locator("[data-slide-list] [data-slide-entry][data-selected]")

async function selectTwoToFour(page: Page) {
  await entry(page, 2).click()
  await entry(page, 4).click({ modifiers: [shortcutCopy.chord.other.shift] })
  await expect(selected(page)).toHaveCount(3)
}

test("Shift selects a range and Ctrl or Cmd adds or removes one slide, and a plain click selects one again", async ({
  page,
  context,
  stack,
}) => {
  await openSaved(page, context, stack, 6, false, "list")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await selectTwoToFour(page)
  await expect(entry(page, 3)).toHaveAccessibleName(slideListCopy.selectedName(3, 6))
  await entry(page, 6).click({ modifiers: ["ControlOrMeta"] })
  await expect(selected(page)).toHaveCount(4)
  await entry(page, 3).click({ modifiers: ["ControlOrMeta"] })
  await expect(selected(page)).toHaveCount(3)
  await expect(page.locator("[data-design-panel]").first()).toContainText(slideListCopy.selected(3))
  await entry(page, 5).click()
  await expect(selected(page)).toHaveCount(0)
  await expect(entry(page, 5)).toHaveAttribute("aria-current", "true")
})

test("Delete removes every selected slide and one Undo brings them back", async ({ page, context, stack }) => {
  const saved = await openSaved(page, context, stack, 6, false, "list")
  await selectTwoToFour(page)
  await page.keyboard.press("Delete")
  await expect.poll(saved.order).toEqual(picked(saved.ids, [1, 5, 6]))
  await expect(page.locator("[data-slide-list] [data-slide-entry]")).toHaveCount(3)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved.order).toEqual(saved.ids)
})

test("Ctrl+D duplicates the selected slides and selects the copies, and Alt+Down moves the set", async ({
  page,
  context,
  stack,
}) => {
  const saved = await openSaved(page, context, stack, 6, false, "list")
  await selectTwoToFour(page)
  await page.keyboard.press("ControlOrMeta+d")
  await expect.poll(async () => (await saved.order()).length).toBe(9)
  await expect(selected(page)).toHaveCount(3)
  await expect(entry(page, 5)).toHaveAttribute("data-selected")
  await entry(page, 2).click()
  await entry(page, 3).click({ modifiers: [shortcutCopy.chord.other.shift] })
  await page.keyboard.press("Alt+ArrowDown")
  const order = await saved.order()
  await expect.poll(saved.order).toEqual([order[0], order[3], order[1], order[2], ...order.slice(4)])
})

test("the menu on a selected slide acts on the set, and dragging a selected slide moves the set", async ({
  page,
  context,
  stack,
}) => {
  const saved = await openSaved(page, context, stack, 6, false, "list")
  await selectTwoToFour(page)
  await entry(page, 3).click({ button: "right" })
  const menu = page.getByRole("menu")
  const labels = slideListCopy.setActions(3)
  await expect(menu.getByRole("menuitem", { name: new RegExp(labels.clone) })).toBeEnabled()
  await expect(menu.getByRole("menuitem", { name: slideListCopy.skipSet(3) })).toBeVisible()
  await expect(selected(page)).toHaveCount(3)
  await page.keyboard.press("Escape")
  await entry(page, 3).dragTo(entry(page, 6))
  await expect.poll(saved.order).toEqual(picked(saved.ids, [1, 5, 6, 2, 3, 4]))
})

test("a selected set dropped on a slide in another slide group joins that group", async ({ page, context, stack }) => {
  const saved = await openSaved(page, context, stack, 6, [3, 3], "list")
  await entry(page, 1).click()
  await entry(page, 2).click({ modifiers: [shortcutCopy.chord.other.shift] })
  await entry(page, 1).dragTo(entry(page, 5))
  await expect.poll(saved.order).toEqual(picked(saved.ids, [3, 4, 5, 1, 2, 6]))
  await expect.poll(saved.rows).toEqual([picked(saved.ids, [3]), picked(saved.ids, [4, 5, 1, 2, 6])])
})
