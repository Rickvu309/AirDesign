import { toolbarCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { designing } from "../doom-design.mjs"

async function drive(kit) {
  const { page } = kit
  await designing(kit)
  await page.getByRole("button", { name: toolbarCopy.actions, exact: true }).click()
  const field = page.locator("[data-actions-panel] input")
  await field.fill("chart")
  await field.press("ArrowDown")
  await expect(page.locator("[data-actions-group='icons'] svg").first()).toBeVisible()
}

export default { name: "actions-highlight", design: null, drive }
