import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { expect, type Page } from "@playwright/test"
import { entry, fixtures, manySlides, openGrid, groupNumbers, groupSizes } from "./slide-grid-deck"
import { decksOn, test } from "./deck-test"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })
async function openTen(page: Page) {
  await decksOn(page).open({
    name: "ten.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(10, groupSizes(10)),
  })
  await openGrid(page)
}
test("the eleventh slide keeps stored slide groups across zoom resize and reload", async ({ page, decks }) => {
  await openTen(page)
  expect(await groupNumbers(page)).toEqual([
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10],
  ])
  await page.locator('[data-slide-entry="10"]').hover()
  await page.getByRole("button", { name: "Add slide after slide 10", exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(11)
  const after = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11],
  ]
  expect(await groupNumbers(page)).toEqual(after)
  await page.getByRole("button", { name: undoCopy.undoNamed.new, exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(10)
  expect(await groupNumbers(page)).toEqual([
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10],
  ])
  await page.getByRole("button", { name: undoCopy.redoNamed.new, exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(11)
  expect(await groupNumbers(page)).toEqual(after)
  await page.keyboard.press("ControlOrMeta+Equal")
  expect(await groupNumbers(page)).toEqual(after)
  await page.setViewportSize({ width: 1000, height: 800 })
  expect(await groupNumbers(page)).toEqual(after)
  await page.reload()
  await decks.ready()
  await openGrid(page)
  expect(await groupNumbers(page)).toEqual(after)
})
test("Grid adds duplicates deletes moves and undoes with its slide group boundaries", async ({ page }) => {
  await openTen(page)
  const original = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10],
  ]
  await entry(page, 4).focus()
  await page.keyboard.press("ControlOrMeta+d")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(11)
  expect(await groupNumbers(page)).toEqual([
    [1, 2, 3, 4, 5],
    [6, 7, 8, 9],
    [10, 11],
  ])
  await page.getByRole("button", { name: undoCopy.undoNamed.duplicate, exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(10)
  expect(await groupNumbers(page)).toEqual(original)
  await entry(page, 5).focus()
  await page.keyboard.press("Alt+ArrowUp")
  await expect
    .poll(() => groupNumbers(page))
    .toEqual([
      [1, 2, 3, 4, 5],
      [6, 7, 8],
      [9, 10],
    ])
  await page.getByRole("button", { name: undoCopy.undoNamed.order, exact: true }).click()
  await expect.poll(() => groupNumbers(page)).toEqual(original)
  await entry(page, 5).focus()
  await page.keyboard.press("Delete")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(9)
  expect(await groupNumbers(page)).toEqual([
    [1, 2, 3, 4],
    [5, 6, 7],
    [8, 9],
  ])
  await page.getByRole("button", { name: undoCopy.undoNamed.delete, exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(10)
  expect(await groupNumbers(page)).toEqual(original)
})

test("two named groups stay fully shown, with the second group below the first", async ({ page, decks }) => {
  await decks.open({
    name: "sectioned-ten.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(10, true),
  })
  await openGrid(page)
  expect(await groupNumbers(page)).toEqual([
    [1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10],
  ])
  await expect(page.locator("[data-group-head]")).toHaveCount(0)
  await expect(page.locator("[data-slide-group]").first()).toHaveAccessibleName("Opening")
  await expect(page.locator("[data-slide-group]").last()).toHaveAccessibleName("Results")
  const first = await entry(page, 1).boundingBox()
  const next = await entry(page, 6).boundingBox()
  if (first === null || next === null) throw new Error("slides")
  expect(next.y).toBeGreaterThan(first.y + first.height)
  await expect(entry(page, 1)).toBeVisible()
  await expect(entry(page, 10)).toBeVisible()
})

test("each heat-pump group is announced by its name and draws no heading", async ({ page, decks }) => {
  await decks.open(`${fixtures}/doe-heat-pumps.pptx`)
  await openGrid(page)
  await expect(page.locator("[data-group-head]")).toHaveCount(0)
  await expect(page.locator("[data-group-rule]")).toHaveCount(0)
  const groups = page.locator("[data-slide-group]")
  await expect(groups).toHaveCount(4)
  await expect(groups.nth(0)).toHaveAccessibleName("Introduction")
  await expect(groups.nth(1)).toHaveAccessibleName(/^Part 1:/)
  await expect(groups.nth(2)).toHaveAccessibleName(/^Part 2:/)
  await expect(groups.nth(3)).toHaveAccessibleName("Appendices")
})
