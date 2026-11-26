import { expect } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./deck-test"

const sample = "Annual strategy review"
const tooLong = "Annual strategy review for the board and the three levers behind the year"

test.use({ viewport: { width: 1600, height: 1000 } })

test("the deck name shares the logo's row with the Grid view button and ellipsizes inside it", async ({ page }) => {
  await page.goto("/screens/s43-02-editor-tools-design-panel")
  await page.evaluate(() => document.fonts.ready)
  const sidebar = page.locator("[data-editor-sidebar]")
  const name = page.getByRole("button", { name: `${productCopy.renameDeck}: ${sample}` })
  await expect(name).toHaveText(sample)
  const row = async (element: ReturnType<typeof page.locator>) => {
    const box = await element.boundingBox()
    if (box === null) throw new Error("no box")
    return box.y + box.height / 2
  }
  const grid = page.getByRole("button", { name: slideListCopy.gridView })
  expect(
    Math.abs((await row(name)) - (await row(page.getByRole("link", { name: productCopy.goToDecks })))),
  ).toBeLessThan(2)
  expect(Math.abs((await row(name)) - (await row(grid)))).toBeLessThan(2)

  await name.click()
  const field = page.getByRole("textbox", { name: productCopy.deckName })
  await field.fill(tooLong)
  await field.press("Enter")

  const cut = page.getByRole("button", { name: `${productCopy.renameDeck}: ${tooLong}` })
  await expect(cut).toBeVisible()
  const side = await sidebar.boundingBox()
  const gridBox = await grid.boundingBox()
  const measured = await cut.evaluate((element) => {
    const box = element.getBoundingClientRect()
    return { scroll: element.scrollWidth, client: element.clientWidth, right: box.right }
  })
  if (side === null || gridBox === null) throw new Error("the sidebar has no box")
  expect(measured.scroll).toBeGreaterThan(measured.client + 1)
  expect(measured.right).toBeLessThanOrEqual(gridBox.x + 1)
  expect(gridBox.x + gridBox.width).toBeLessThanOrEqual(side.x + side.width + 1)
})
