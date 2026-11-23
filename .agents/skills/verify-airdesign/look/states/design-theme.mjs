import { expect } from "@playwright/test"
import { colorCopy } from "../../bin/product-copy.mjs"
import { designing, slidePanel } from "../doom-design.mjs"

async function drive(kit) {
  const { page } = kit
  await designing(kit)
  await page.locator("[data-design-panel] [data-template-style]").click()
  const theme = page.locator("[data-template-style-dialog]")
  await expect(theme).toBeVisible()
  const swatch = theme.locator("button[title]").nth(4)
  await swatch.click()
  const picker = page.locator("[data-color-picker]")
  const hex = picker.getByRole("textbox", { name: colorCopy.hex, exact: true })
  if ((await hex.count()) === 0) await picker.getByRole("button", { name: colorCopy.add, exact: true }).click()
  await hex.fill("#c00000")
  await hex.press("Enter")
  await page.keyboard.press("Escape")
  await expect(swatch).toHaveAttribute("title", /#C00000/i)
}

export default { name: "design-theme", design: slidePanel, drive }
