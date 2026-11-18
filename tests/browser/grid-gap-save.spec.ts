import { expect } from "@playwright/test"
import { readSlideState } from "../../packages/document/src/index"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { test } from "./api-stack"
import { openSaved, zoomTo } from "./grid-reorder-deck"
import { entry, rowSizes } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("gap and row-boundary adds save left layouts and unequal rows and undo restores both", async ({
  page,
  context,
  stack,
}) => {
  const saved = await openSaved(page, context, stack, 10, rowSizes(10))
  const original = await saved.rows()
  await zoomTo(page, 20)
  for (const number of [2, 4, 10]) {
    await entry(page, number).focus()
    await page.keyboard.press("Tab")
    await expect(page.getByRole("button", { name: slideListCopy.addAfter(number), exact: true })).toBeFocused()
    await page.keyboard.press("Enter")
    await expect.poll(async () => (await saved.order()).length).toBe(11)
    const state = readSlideState((await stack.saved(saved.deck))?.register)
    expect(state?.order.at(-1)).toMatchObject({ slide: "add", layout: saved.ids[number - 1], row: "same" })
    const order = await saved.order()
    const added = order[number]
    expect(order.slice(0, number)).toEqual(saved.ids.slice(0, number))
    expect(order.slice(number + 1)).toEqual(saved.ids.slice(number))
    expect(await saved.rows()).toEqual(
      original.map((row) => row.flatMap((id) => (id === saved.ids[number - 1] ? [id, added] : [id]))),
    )
    await expect(entry(page, number + 1)).toBeFocused()
    await expect(entry(page, number + 1)).toBeInViewport()
    await page.getByRole("button", { name: undoCopy.undoNamed.new, exact: true }).click()
    await expect.poll(saved.order).toEqual(saved.ids)
    expect(await saved.rows()).toEqual(original)
  }
})
