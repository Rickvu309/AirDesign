import { productCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"

const pastRepaint = 1500

async function drive(kit) {
  const { page } = kit
  const { cookie } = await kit.signIn()
  await page.goto("/")
  await page.getByRole("button", { name: productCopy.newDeck, exact: true }).click()
  await page
    .getByRole("menu", { name: productCopy.newDeck })
    .getByRole("menuitem", { name: productCopy.blankDeck, exact: true })
    .click()
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await page.getByRole("button", { name: "Insert table", exact: true }).click()
  await page.getByRole("button", { name: "3 rows, 3 columns", exact: true }).click()
  await expect(page.locator('[data-slide-paint] [data-canvas-table] [data-table-text="0.0"]')).toBeFocused()
  await page.keyboard.type("Region")
  const held = async () => JSON.stringify((await kit.post(kit.deckRoutes.open, { deck }, cookie)).json.register)
  await expect.poll(held, { intervals: [250] }).toContain("Region")
  await page.waitForTimeout(pastRepaint)
}

export default { name: "table-cell-saved", design: editor, drive }
