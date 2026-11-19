import { expect, type Page } from "@playwright/test"
import { limits } from "../../packages/document/src/index.ts"
import { test, type Stack } from "./api-stack"
import { openSaved, picked, type Saved } from "./grid-reorder-deck"
import { entry, mark, groupSizes } from "./slide-grid-deck"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

async function select(page: Page, ...indices: number[]) {
  const numbers = page.locator("[data-slide-number]")
  await numbers.nth(indices[0]! - 1).click()
  for (const index of indices.slice(1)) await numbers.nth(index - 1).click({ modifiers: ["ControlOrMeta"] })
  await expect(page.locator("[data-slide-entry][data-selected]")).toHaveCount(indices.length)
}

function revisionOf(stack: Stack, { deck, cookie }: Saved) {
  return async () => {
    const { deckRoutes } = await import("../../packages/catalog/src/index.ts")
    return (await stack.post(deckRoutes.open.path, { deck }, cookie)).json.revision
  }
}

for (const key of [slideListCopy.deleteKey, "Backspace", "menu"]) {
  test(`${key} deletes the selected slides in one server revision and one Undo restores the slide groups`, async ({
    page,
    context,
    stack,
  }) => {
    const saved = await openSaved(page, context, stack, 7, groupSizes(7))
    const revision = revisionOf(stack, saved)
    const before = Number(await revision())
    const rows = await saved.rows()
    await select(page, 1, 5, 6, 7)
    if (key === "menu") {
      await entry(page, 5).press("ContextMenu")
      await page.getByRole("menuitem", { name: new RegExp(slideListCopy.setActions(4).remove) }).click()
    } else await page.keyboard.press(key)
    await expect(page.locator("[data-editor-grid] [data-announcer]")).toHaveText(slideListCopy.deletedSet(4))
    const kept = picked(saved.ids, [2, 3, 4])
    await expect.poll(saved.order).toEqual(kept)
    await expect.poll(saved.rows).toEqual([kept])
    expect(await revision()).toBe(before + 1)
    await page.getByRole("button", { name: undoCopy.undoNamed.delete, exact: true }).click()
    await expect.poll(saved.order).toEqual(saved.ids)
    await expect.poll(saved.rows).toEqual(rows)
    expect(await revision()).toBe(before + 2)
  })
}

for (const key of ["ControlOrMeta+d", "menu"]) {
  test(`${key} duplicates together in presentation order, selects the copies and undoes once`, async ({
    page,
    context,
    stack,
  }) => {
    const saved = await openSaved(page, context, stack, 7, groupSizes(7))
    const revision = revisionOf(stack, saved)
    const before = Number(await revision())
    const rows = await saved.rows()
    await select(page, 5, 2)
    if (key === "menu") {
      await entry(page, 2).click({ button: "right" })
      await page.getByRole("menuitem", { name: new RegExp(slideListCopy.setActions(2).clone) }).click()
    } else await page.keyboard.press(key)
    await expect(page.locator("[data-slide-entry]")).toHaveCount(9)
    await expect(entry(page, 6)).toHaveText(mark(2, 7))
    await expect(entry(page, 7)).toHaveText(mark(5, 7))
    await expect(entry(page, 6)).toHaveAttribute("data-selected", "")
    await expect(entry(page, 7)).toHaveAttribute("data-selected", "")
    await expect(page.locator("[data-slide-entry][data-selected]")).toHaveCount(2)
    await expect.poll(saved.order).toHaveLength(9)
    const order = await saved.order()
    const copies = order.slice(5, 7)
    expect(copies.every((id) => !saved.ids.includes(id))).toBe(true)
    expect(order).toEqual([...saved.ids.slice(0, 5), ...copies, ...saved.ids.slice(5)])
    await expect.poll(saved.rows).toEqual([rows[0], [saved.ids[4], ...copies, ...saved.ids.slice(5)]])
    expect(await revision()).toBe(before + 1)
    await page.getByRole("button", { name: undoCopy.undoNamed.duplicate, exact: true }).click()
    await expect.poll(saved.order).toEqual(saved.ids)
    await expect.poll(saved.rows).toEqual(rows)
    await expect(page.locator("[data-grid-selected]")).toHaveCount(0)
    expect(await revision()).toBe(before + 2)
  })
}

test("refuses to delete the entire selected deck", async ({ page, context, stack }) => {
  const saved = await openSaved(page, context, stack, 7, groupSizes(7))
  const before = await revisionOf(stack, saved)()
  const rows = await saved.rows()
  await entry(page, 1).press("ControlOrMeta+a")
  await page.keyboard.press("Delete")
  await expect(page.getByText(slideListCopy.lastSlide, { exact: true }).first()).toBeAttached()
  await expect(page.locator("[data-slide-entry][data-selected]")).toHaveCount(7)
  expect(await saved.rows()).toEqual(rows)
  expect(await revisionOf(stack, saved)()).toBe(before)
})

test("refuses the whole duplicate when only one of two copies would fit", async ({ page, context, stack }) => {
  const saved = await openSaved(page, context, stack, limits.slides - 1, groupSizes(limits.slides - 1))
  const before = await revisionOf(stack, saved)()
  const rows = await saved.rows()
  await entry(page, 1).focus()
  await page.keyboard.press("Shift+ArrowRight")
  await page.keyboard.press("ControlOrMeta+d")
  await expect(page.getByText(slideListCopy.slideLimit(limits.slides), { exact: true }).first()).toBeAttached()
  await expect(page.locator("[data-slide-entry][data-selected]")).toHaveCount(2)
  expect(await saved.order()).toEqual(saved.ids)
  expect(await saved.rows()).toEqual(rows)
  expect(await revisionOf(stack, saved)()).toBe(before)
})
