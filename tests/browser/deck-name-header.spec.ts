import { expect } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { test } from "./deck-test"

const sample = "Annual strategy review"
const tooLong = "Annual strategy review for the board and the three levers behind the year"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a normal deck name shows whole, and a longer one ellipsizes inside the sidebar", async ({ page }) => {
  await page.goto("/screens/s43-02-editor-tools-design-panel")
  await page.evaluate(() => document.fonts.ready)
  const sidebar = page.locator("[data-editor-sidebar]")
  const name = page.getByRole("button", { name: `${productCopy.renameDeck}: ${sample}` })
  await expect(name).toHaveText(sample)
  const fitted = await name.evaluate((element) => ({
    scroll: element.scrollWidth,
    client: element.clientWidth,
  }))
  expect(fitted.scroll).toBeLessThanOrEqual(fitted.client + 1)

  await name.click()
  const field = page.getByRole("textbox", { name: productCopy.deckName })
  await field.fill(tooLong)
  await field.press("Enter")

  const cut = page.getByRole("button", { name: `${productCopy.renameDeck}: ${tooLong}` })
  await expect(cut).toBeVisible()
  const side = await sidebar.boundingBox()
  const measured = await cut.evaluate((element) => {
    const box = element.getBoundingClientRect()
    return { scroll: element.scrollWidth, client: element.clientWidth, right: box.right }
  })
  if (side === null) throw new Error("the sidebar has no box")
  expect(measured.scroll).toBeGreaterThan(measured.client + 1)
  expect(measured.right).toBeLessThanOrEqual(side.x + side.width + 1)
})
