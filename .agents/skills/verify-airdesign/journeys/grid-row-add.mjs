import { expect } from "@playwright/test"
import { undoCopy } from "../../../../apps/web/src/copy/undo-copy.ts"
import { gridRows } from "../../../../packages/document/dist/index.js"
import { belowRow, openRowDeck, rowNumbers } from "../look/grid-row-add.mjs"

export default async function drive(kit) {
  const { page, post, deckRoutes, capture, note } = kit
  const { cookie } = await openRowDeck(kit)
  const deck = page.url().split("/").at(-1)
  const saved = async () => (await post(deckRoutes.open, { deck }, cookie)).json.register
  const original = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10],
  ]
  expect(await rowNumbers(page)).toEqual(original)
  const before = await saved()
  await capture("before")
  await belowRow(page).hover()
  await expect(page.locator("[data-row-insertion-line]:visible")).toHaveCount(1)
  expect((await saved()).order).toEqual(before.order)
  await capture("preview")
  await belowRow(page).click()
  const added = [[1, 2, 3, 4], [5], [6, 7, 8, 9], [10, 11]]
  await expect.poll(() => rowNumbers(page)).toEqual(added)
  await expect.poll(async () => (await saved()).order?.length).toBe(1)
  const confirmed = await saved()
  expect(confirmed.order[0]).toMatchObject({ slide: "add", grid: 2, row: "new", after: confirmed.file[0] })
  expect(confirmed.order[0]).not.toHaveProperty("key")
  expect(gridRows(confirmed)).toEqual([
    confirmed.file.slice(0, 4),
    [confirmed.order[0].id],
    confirmed.file.slice(4, 8),
    confirmed.file.slice(8),
  ])
  await page.mouse.move(1400, 90)
  await capture("added")
  await page.getByRole("button", { name: undoCopy.undoNamed.new, exact: true }).click()
  await expect.poll(() => rowNumbers(page)).toEqual(original)
  await capture("undone")
  await page.getByRole("button", { name: undoCopy.redoNamed.new, exact: true }).click()
  await expect.poll(() => rowNumbers(page)).toEqual(added)
  await page.reload()
  await page.waitForFunction(() => document.querySelector(".thin-page")?.hasAttribute("data-deck-ready"))
  await page.getByRole("button", { name: "Grid", exact: true }).click()
  await expect.poll(() => rowNumbers(page)).toEqual(added)
  await capture("reloaded")
  note(
    "Ten slides stayed in their original rows. Hover saved no edit. The server stored one semantic row:new add; Undo, Redo and reload kept the same partition.",
  )
  const sectionAccount = await openRowDeck(kit, 6, true)
  await expect(page.locator("[data-section-head]")).toHaveCount(2)
  await belowRow(page).click()
  await expect.poll(() => rowNumbers(page)).toEqual([[1, 2, 3], [4], [5, 6, 7]])
  await expect(page.locator("[data-section-head]")).toHaveCount(2)
  const sectionDeck = page.url().split("/").at(-1)
  await expect
    .poll(
      async () =>
        (await post(deckRoutes.open, { deck: sectionDeck }, sectionAccount.cookie)).json.register.order?.at(-1)?.row,
    )
    .toBe("new")
  await page.mouse.move(1400, 90)
  await capture("sections")
  note(
    "A deck with Opening and Results kept two section markers after adding a third grid row; grid rows did not create sections.",
  )
}
