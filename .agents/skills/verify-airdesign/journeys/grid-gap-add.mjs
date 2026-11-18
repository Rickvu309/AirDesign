import { expect } from "@playwright/test"
import { gridRows, readSlideState } from "../../../../packages/document/dist/index.js"
import { slideListCopy } from "../../../../apps/web/src/copy/slide-list-copy.ts"
import { undoCopy } from "../../../../apps/web/src/copy/undo-copy.ts"
import { openRowDeck, rowNumbers } from "../look/grid-row-add.mjs"

export default async function drive(kit) {
  const { page, post, deckRoutes, capture, note } = kit
  const { cookie } = await openRowDeck(kit)
  const deck = page.url().split("/").at(-1)
  const saved = async () => (await post(deckRoutes.open, { deck }, cookie)).json.register
  let original
  await page.locator("[data-zoom-readout]").click()
  await page.locator("[data-zoom-field]").fill("25")
  await page.keyboard.press("Enter")
  await page.locator("[data-gap-insert]").nth(1).hover()
  await capture("between-plus-and-end-dot")
  await page.locator("[data-grid-viewport]").hover()
  await page.mouse.wheel(800, 0)
  for (const after of [2, 4, 10]) {
    const button = page.getByRole("button", { name: slideListCopy.addAfter(after), exact: true })
    await page
      .locator("[data-gap-insert]")
      .nth(after - 1)
      .hover()
    await button.hover()
    await capture(`preview-after-${after}`)
    await button.click()
    await expect(page.locator(`[data-slide-entry="${after + 1}"]`)).toBeFocused()
    await expect.poll(async () => (await saved()).order?.at(-1)?.slide).toBe("add")
    const register = await saved()
    const added = register.order.at(-1)
    expect(added).toMatchObject({ row: "same", after: register.file[after - 1], layout: register.file[after - 1] })
    original ??= gridRows(readSlideState({ file: register.file, order: [] }))
    const expected = original.map((row) =>
      row.includes(added.after) ? row.flatMap((id) => (id === added.after ? [id, added.id] : [id])) : row,
    )
    expect(gridRows(readSlideState(register))).toEqual(expected)
    await capture(`added-after-${after}`)
    await page.getByRole("button", { name: undoCopy.undoNamed.new, exact: true }).click()
    await expect
      .poll(() => rowNumbers(page))
      .toEqual([
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10],
      ])
    await expect.poll(async () => gridRows(readSlideState(await saved()))).toEqual(original)
  }
  await page.locator("[data-zoom-readout]").click()
  await page.locator("[data-zoom-field]").fill("10")
  await page.keyboard.press("Enter")
  await capture("small-zoom-hidden")
  note(
    "Server order and rows proved for between neighbours, the first row tail before the next row, the unequal final row tail, and exact Undo restoration. Layout comes from each left neighbour.",
  )
}
