import { shortcutCopy, textCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { designing, element, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  const { page } = kit
  await designing(kit, "text")
  await selectMany(page, ["w:1"])
  const panel = page.locator("[data-design-element]")
  const font = panel.getByRole("textbox", { name: textCopy.font, exact: true })
  const weight = panel.getByRole("combobox", { name: textCopy.weight, exact: true })
  await weight.click()
  await page.getByRole("option", { name: shortcutCopy.gestures.bold, exact: true }).click()
  const manifest = page.waitForResponse((response) => response.url().includes("family=Montserrat"))
  await font.fill("Montserrat")
  await manifest
  await font.press("Enter")
  await expect(weight).toHaveText(/^Bold\W*$/)
}

export default { name: "design-weight-family-switch", design: element, drive }
