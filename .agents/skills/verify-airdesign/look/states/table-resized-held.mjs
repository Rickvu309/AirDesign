import { productCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"

const heldStill = 1000

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await page.getByRole("button", { name: productCopy.newDeck, exact: true }).click()
  await page
    .getByRole("menu", { name: productCopy.newDeck })
    .getByRole("menuitem", { name: productCopy.blankDeck, exact: true })
    .click()
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await page.getByRole("button", { name: "Insert table", exact: true }).click()
  await page.getByRole("button", { name: "3 rows, 3 columns", exact: true }).click()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table.locator('[data-table-text="0.0"]')).toBeFocused()
  await page.keyboard.type("Region")
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-design-element]")).toBeVisible()
  const corner = await page.locator('[data-slide-paint] [data-selection] [data-grip="bottom-right"]').boundingBox()
  const from = { x: corner.x + corner.width / 2, y: corner.y + corner.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 120, from.y + 60, { steps: 8 })
  await page.waitForTimeout(heldStill)
  await page.mouse.up()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toBeVisible()
}

export default { name: "table-resized-held", design: "/screens/s43-09-editor-tools-design-element", drive }
