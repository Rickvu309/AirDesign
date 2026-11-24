import { editorCopy, textCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { designing, element, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  const { page } = kit
  await designing(kit, "text")
  await selectMany(page, ["w:1"])
  const panel = page.locator("[data-design-element]")
  const style = panel.getByRole("combobox", { name: textCopy.style, exact: true })
  await style.click()
  const heading = editorCopy.textStyles.heading
  await page.getByRole("option", { name: new RegExp(`^${heading}\\b`) }).click()
  await expect(style).toContainText(heading)
  const weight = panel.getByRole("combobox", { name: textCopy.weight, exact: true })
  await expect(weight).not.toHaveText("")
}

export default { name: "design-heading-weight", design: element, drive }
