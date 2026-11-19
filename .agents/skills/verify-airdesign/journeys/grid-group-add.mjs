import { expect } from "@playwright/test"
import { undoCopy } from "../../../../apps/web/src/copy/undo-copy.ts"
import { gridGroups } from "../../../../packages/document/dist/index.js"
import { belowGroup, openGroupDeck, groupNumbers } from "../look/grid-group-add.mjs"

export default async function drive(kit) {
  const { page, post, deckRoutes, capture, note } = kit
  const { cookie } = await openGroupDeck(kit)
  const deck = page.url().split("/").at(-1)
  const saved = async () => (await post(deckRoutes.open, { deck }, cookie)).json.register
  const original = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10],
  ]
  expect(await groupNumbers(page)).toEqual(original)
  const before = await saved()
  await capture("before")
  await belowGroup(page).hover()
  await expect(page.locator("[data-group-insertion-line]:visible")).toHaveCount(1)
  expect((await saved()).order).toEqual(before.order)
  await capture("preview")
  await belowGroup(page).click()
  const added = [[1, 2, 3, 4], [5], [6, 7, 8, 9], [10, 11]]
  await expect.poll(() => groupNumbers(page)).toEqual(added)
  await expect.poll(async () => (await saved()).order?.length).toBe(1)
  const confirmed = await saved()
  expect(confirmed.order[0]).toMatchObject({ slide: "add", grid: 3, row: "new", after: confirmed.file[0] })
  expect(confirmed.order[0]).not.toHaveProperty("key")
  expect(gridGroups(confirmed)).toEqual([
    confirmed.file.slice(0, 4),
    [confirmed.order[0].id],
    confirmed.file.slice(4, 8),
    confirmed.file.slice(8),
  ])
  await page.mouse.move(1400, 90)
  await capture("added")
  await page.getByRole("button", { name: undoCopy.undoNamed.new, exact: true }).click()
  await expect.poll(() => groupNumbers(page)).toEqual(original)
  await capture("undone")
  await page.getByRole("button", { name: undoCopy.redoNamed.new, exact: true }).click()
  await expect.poll(() => groupNumbers(page)).toEqual(added)
  await page.reload()
  await page.waitForFunction(() => document.querySelector(".thin-page")?.hasAttribute("data-deck-ready"))
  await page.getByRole("button", { name: "Grid", exact: true }).click()
  await expect.poll(() => groupNumbers(page)).toEqual(added)
  await capture("reloaded")
  note(
    "Ten slides stayed in their original slide groups. Hover saved no edit. The server stored one row:new add at version three; Undo, Redo and reload kept the same slide groups.",
  )
  const sectionAccount = await openGroupDeck(kit, 6, true)
  await expect(page.locator("[data-editor-grid] [data-group-head]")).toHaveCount(0)
  await belowGroup(page).click()
  await expect.poll(() => groupNumbers(page)).toEqual([[1, 2, 3], [4], [5, 6, 7]])
  await expect(page.locator("[data-editor-grid] [data-group-head]")).toHaveCount(0)
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
    "A deck with Opening and Results sections showed no headings in Grid, and adding a slide in a new slide group put it between them.",
  )
}
