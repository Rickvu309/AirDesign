import { expect } from "@playwright/test"
import { tableCopy } from "../../apps/web/src/copy/table-copy"
import { test } from "./deck-test"

const long =
  "License cost over five years, in millions of dollars, for every region we sell in and every product line we still support"

test("a new table on a blank deck takes the Neutral table style, with its words in the middle of each row", async ({
  page,
  decks,
}) => {
  await decks.blank()
  await page.locator("[data-slide-paint]").click({ position: { x: 4, y: 4 } })
  await page.getByRole("button", { name: tableCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: tableCopy.sizeOf(2, 2), exact: true }).click()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table.locator('[data-table-text="0.0"]')).toBeFocused()
  for (const word of [`${long}. ${long}. ${long}. ${long}`, "Revenue", "Europe", "48"]) {
    await page.keyboard.type(word)
    await page.keyboard.press("Tab")
  }
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
  for (const spot of ["0.1", "1.1"]) {
    const cell = table.locator(`[data-table-cell="${spot}"]`)
    const words = cell.locator("[data-paragraph]").first()
    await expect(words).toBeVisible()
    const [outer, inner] = [await cell.boundingBox(), await words.boundingBox()]
    if (outer === null || inner === null) throw new Error(spot)
    expect(Math.abs(outer.y + outer.height / 2 - (inner.y + inner.height / 2))).toBeLessThan(1.5)
    expect(await cell.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgba(0, 0, 0, 0)")
  }
  const size = await table
    .locator('[data-table-cell="1.0"] [data-paragraph]')
    .first()
    .evaluate((node) => {
      const run = node.querySelector("span") ?? node
      return (
        parseFloat(getComputedStyle(run).fontSize) /
        parseFloat(getComputedStyle(node.closest("[data-slide-paint]")!).fontSize)
      )
    })
  expect(size).toBeCloseTo(14 / 16, 2)
})
