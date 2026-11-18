import { join } from "node:path"
import { savedExport } from "./export-dialog"
import { expect } from "@playwright/test"
import { presentCopy } from "../../apps/web/src/copy/present-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { forward, test } from "./api-stack"
import { boxOf, openSaved } from "./grid-reorder-deck"
import { entry, fixtures, openFile, openGrid } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("skips two Grid slides, presents past them and undoes the edit once in both tabs", async ({
  page,
  context,
  stack,
}) => {
  await openSaved(page, context, stack, 5)
  const other = await context.newPage()
  await forward(other, stack)
  await other.goto(page.url())
  await openGrid(other)
  await expect(entry(other, 5)).toBeVisible()

  const numbers = page.locator("[data-slide-number]")
  await numbers.nth(1).click()
  await numbers.nth(2).click({ modifiers: ["ControlOrMeta"] })
  await entry(page, 2).click({ button: "right" })
  await page.getByRole("menuitem", { name: slideListCopy.skipSet(2), exact: true }).click()
  const mark = (tab: typeof page) => tab.locator("[data-slide-skip-mark]")
  await expect(mark(page)).toHaveCount(2)
  await expect(mark(other)).toHaveCount(2)
  await entry(page, 2).click({ button: "right" })
  await expect(page.getByRole("menuitem", { name: slideListCopy.unskipSet(2), exact: true })).toBeVisible()
  await page.keyboard.press("Escape")

  await entry(page, 1).click()
  await page.getByRole("button", { name: presentCopy.present, exact: true }).click()
  const shown = page.locator("[data-present-show] [data-present-slide]")
  await expect(shown).toHaveAttribute("data-present-slide", "1")
  await page.keyboard.press("ArrowRight")
  await expect(shown).toHaveAttribute("data-present-slide", "4")
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: slideListCopy.listName, exact: true }).click()
  await expect(page.locator("[data-editor-sidebar] [data-slide-skip-mark]")).toHaveCount(2)
  await page.getByRole("button", { name: undoCopy.undoNamed["skip-slide"], exact: true }).click()
  await expect(mark(page)).toHaveCount(0)
  await expect(mark(other)).toHaveCount(0)
  await other.reload()
  if ((await other.locator("[data-editor-grid]").count()) === 0) await openGrid(other)
  await expect(entry(other, 5)).toBeVisible()
  await expect(mark(other)).toHaveCount(0)
})

test("exports a skipped slide and unskips it after re-import @export", async ({ page, context, stack }) => {
  await openSaved(page, context, stack, join(fixtures, "blank.pptx"))
  await entry(page, 1).click({ button: "right" })
  await page.getByRole("menuitem", { name: slideListCopy.skip, exact: true }).click()
  await expect(entry(page, 1)).toHaveAttribute("data-slide-skipped", "true")
  const hidden = join(process.cwd(), "tests/browser/exported-slide-hidden.pptx")
  await savedExport(page, hidden)
  await openFile(page, hidden)
  await openGrid(page)
  await expect(entry(page, 1)).toHaveAttribute("data-slide-skipped", "true")
  await entry(page, 1).click({ button: "right" })
  await page.getByRole("menuitem", { name: slideListCopy.unskip, exact: true }).click()
  await expect(entry(page, 1)).not.toHaveAttribute("data-slide-skipped", "true")
  await savedExport(page, join(process.cwd(), "tests/browser/exported-slide-shown.pptx"))
})

test("a skipped Grid slide still responds to hover, drag and in-place editing", async ({ page, context, stack }) => {
  const saved = await openSaved(page, context, stack, 3)
  const first = entry(page, 1)
  await first.click({ button: "right" })
  await page.getByRole("menuitem", { name: slideListCopy.skip, exact: true }).click()
  await first.hover()
  const card = page.locator("[data-grid-card]").filter({ has: first })
  await expect(card.locator("[data-grid-halo]")).toHaveCSS("opacity", "1")
  const from = await card.locator("[data-slide-number]").boundingBox()
  if (from === null) throw new Error("slide number")
  const onto = await boxOf(page, 3)
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(onto.x + onto.width * 0.8, onto.y + onto.height / 2, { steps: 8 })
  await expect(page.locator("[data-drop-bar]")).toBeVisible()
  await page.mouse.up()
  await expect.poll(saved.order).toEqual([saved.ids[1], saved.ids[2], saved.ids[0]])
  const moved = entry(page, 3)
  await expect(moved).toHaveAttribute("data-slide-skipped", "true")
  await moved.locator("[data-thumb-node]").first().dblclick({ force: true })
  const text = page.locator('[data-grid-edit] [contenteditable="true"]').first()
  await expect(text).toBeFocused()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.insertText("Still editable")
  await expect(text).toHaveText("Still editable")
})
